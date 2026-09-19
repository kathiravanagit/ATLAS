"""
AES-256-GCM authenticated encryption for sensitive data at rest.

Provides envelope encryption with:
- Key derivation via PBKDF2-HMAC-SHA256 (600,000 iterations)
- AES-256-GCM for authenticated encryption (12-byte random nonce)
- Base64-encoded ciphertext with prepended nonce for storage
"""
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

_KDF_ITERATIONS = 600_000
_SALT = b"atlas-2026-sih-v1"  # fixed per-deployment; rotate with new key


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
    return encrypt(value, master_key)


def decrypt_field(value: str | None, master_key: str) -> str | None:
    """Decrypt a model field value. Skips if not encrypted."""
    if value is None:
        return None
    if not is_encrypted(value):
        return value  # plaintext passthrough for non-encrypted data
    return decrypt(value, master_key)
