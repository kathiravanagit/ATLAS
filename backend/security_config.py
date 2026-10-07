"""One source of truth for signing and at-rest encryption configuration."""
import os
from dataclasses import dataclass


_DEFAULTS = {
    "dev-secret-key-do-not-use-in-production",
    "dev-refresh-secret-do-not-use-in-production",
    "atlas-jwt-secret-key-change-in-production-2026",
    "changeme", "change-me", "secret", "default",
}


@dataclass(frozen=True)
class SecurityConfig:
    access_secret: str
    refresh_secret: str
    encryption_key: str
    relaxed: bool


def load_security_config(environ=None) -> SecurityConfig:
    env = os.environ if environ is None else environ
    relaxed = env.get("DEMO_MODE", "false").lower() in ("true", "1", "yes") or env.get("TESTING") == "1"
    access = env.get("JWT_SECRET_KEY", "").strip() or env.get("SECRET_KEY", "").strip()
    legacy = env.get("SECRET_KEY", "").strip()
    if env.get("JWT_SECRET_KEY", "").strip() and legacy and access != legacy:
        raise RuntimeError("JWT_SECRET_KEY and SECRET_KEY disagree; configure one signing secret")
    refresh = env.get("REFRESH_SECRET_KEY", "").strip()
    encryption = env.get("ENCRYPTION_KEY", "").strip()
    if not relaxed:
        for name, value in (("JWT_SECRET_KEY/SECRET_KEY", access), ("REFRESH_SECRET_KEY", refresh)):
            if len(value) < 32 or value.lower() in _DEFAULTS or "do-not-use-in-production" in value.lower() or "change-in-production" in value.lower():
                raise RuntimeError(f"{name} must be a unique non-default secret of at least 32 characters")
        if access == refresh:
            raise RuntimeError("Access and refresh signing secrets must differ")
        try:
            key = bytes.fromhex(encryption)
        except ValueError:
            key = b""
        if len(encryption) != 64 or len(key) != 32 or len(set(key)) < 8:
            raise RuntimeError("ENCRYPTION_KEY must be a non-default 64-hex-character key")
    # Deterministic test/demo keys allow encrypted persistence rather than silently
    # disabling encryption. These must never be selected in production.
    return SecurityConfig(
        access or "dev-secret-key-do-not-use-in-production",
        refresh or "dev-refresh-secret-do-not-use-in-production",
        encryption or "d9b29bc01a07a43e51c70fddbd92e854736c16a9fe41f05a8632688ded51ef52",
        relaxed,
    )


SECURITY_CONFIG = load_security_config()
