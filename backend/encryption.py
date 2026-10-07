"""
AES-256-GCM authenticated encryption for sensitive data at rest.

Provides envelope encryption with:
- Key derivation via PBKDF2-HMAC-SHA256 (600,000 iterations)
- AES-256-GCM for authenticated encryption (12-byte random nonce)
- Base64-encoded ciphertext with prepended nonce for storage
"""
import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

_KDF_ITERATIONS = 600_000
_SALT = b"atlas-2026-sih-v1"  # fixed per-deployment; rotate with new key

from security_config import SECURITY_CONFIG


def _derive_key(master_key: str) -> bytes:
    """Derive a 256-bit AES key from the master secret using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=_KDF_ITERATIONS,
    )
    return kdf.derive(master_key.encode("utf-8"))


_cache: dict[str, AESGCM] = {}


def _get_aesgcm(master_key: str) -> AESGCM:
    if master_key not in _cache:
        _cache[master_key] = AESGCM(_derive_key(master_key))
    return _cache[master_key]


def encrypt(plaintext: str, master_key: str) -> str:
    """
    Encrypt a plaintext string with AES-256-GCM.

    Returns a base64 string: nonce(12 bytes) + ciphertext + tag(16 bytes)
    """
    if not plaintext:
        return plaintext
    aesgcm = _get_aesgcm(master_key)
    nonce = os.urandom(12)  # 96-bit random nonce
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def decrypt(ciphertext_b64: str, master_key: str) -> str:
    """
    Decrypt a base64 string produced by encrypt().

    Raises cryptography.exceptions.InvalidTag if tampered or wrong key.
    """
    if not ciphertext_b64:
        return ciphertext_b64
    aesgcm = _get_aesgcm(master_key)
    raw = base64.b64decode(ciphertext_b64)
    nonce = raw[:12]
    ct = raw[12:]
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")


def is_encrypted(value: str) -> bool:
    """Heuristic: check if a string looks like base64-encoded ciphertext."""
    if value and value.startswith("enc:v1:"):
        return True
    if not value or len(value) < 20:
        return False
    try:
        decoded = base64.b64decode(value, validate=True)
        return len(decoded) >= 28  # 12 nonce + 16 tag minimum
    except Exception:
        return False


def encrypt_field(value: str | None, master_key: str) -> str | None:
    """Encrypt a model field value. Returns None for None inputs."""
    if value is None:
        return None
    if value.startswith("enc:v1:"):
        return value
    return "enc:v1:" + encrypt(value, master_key) if value else value


def decrypt_field(value: str | None, master_key: str) -> str | None:
    """Decrypt a model field value. Skips if not encrypted."""
    if value is None:
        return None
    if value.startswith("enc:v1:"):
        return decrypt(value[7:], master_key)
    if not is_encrypted(value):
        return value
    # Legacy ciphertext was unmarked. Ordinary base64 plaintext remains valid
    # legacy data; marked ciphertext always fails closed on corruption.
    from cryptography.exceptions import InvalidTag
    try:
        return decrypt(value, master_key)
    except (InvalidTag, ValueError, UnicodeDecodeError):
        return value


def _unwrap_authenticated_layers(value, limit=4):
    """Normalize pre-encrypted seed values without trusting a format marker."""
    from cryptography.exceptions import InvalidTag
    for _ in range(limit):
        if not is_encrypted(value):
            break
        candidate = value[7:] if value.startswith("enc:v1:") else value
        try:
            plaintext = decrypt(candidate, SECURITY_CONFIG.encryption_key)
        except (InvalidTag, ValueError, UnicodeDecodeError):
            break
        value = plaintext
    return value


def seal(value):
    if value is None or value == "":
        return value
    # seed._enc() and older tools may encrypt before the ORM binds the value.
    # Authenticate and normalize those inputs, then always encrypt again with a
    # fresh nonce. An invalid/untrusted marker never bypasses encrypted writes.
    value = _unwrap_authenticated_layers(value)
    return "enc:v1:" + encrypt(value, SECURITY_CONFIG.encryption_key)


def unseal(value):
    value = decrypt_field(value, SECURITY_CONFIG.encryption_key)
    # Recover historical doubly encrypted seed rows. The outer marked layer
    # above remains fail-closed; an inner invalid marker may be literal text.
    return _unwrap_authenticated_layers(value) if value else value


def install_runtime_encryption():
    """Apply bind/result encryption without changing the database schema.

    ORM values remain plaintext, but SQL writes (including notification and
    idempotency payloads) are encrypted. Raw SQL/migration tools are outside
    this runtime boundary. Encrypted fields cannot be searched with SQL LIKE.
    """
    from sqlalchemy import Text
    from sqlalchemy.types import TypeDecorator
    import models_db

    class EncryptedText(TypeDecorator):
        impl = Text
        cache_ok = True

        def process_bind_param(self, value, dialect):
            return seal(value)

        def process_result_value(self, value, dialect):
            return unseal(value)

    fields = {
        "Case": ("victim_name", "contact", "description"),
        "Suspect": ("name", "last_seen"),
        "Alert": ("message", "location"),
        "AuditLog": ("details",),
        "FieldOutcome": ("notes",),
        "TransactionRecord": ("from_account", "to_account", "location"),
        "RankedLocation": ("reason",),
        "NotificationJob": ("payload", "last_error"),
        "IdempotencyKey": ("response_body",),
    }
    for model_name, names in fields.items():
        table = getattr(models_db, model_name).__table__
        for name in names:
            column = table.c[name]
            if not getattr(column.type, "_atlas_encrypted", False):
                column.type = EncryptedText()
                column.type._atlas_encrypted = True
