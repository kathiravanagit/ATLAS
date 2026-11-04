"""Signed outbound webhook for alerts (HMAC-SHA256 over `timestamp.body`).

Why this exists: the durable queue could already retry SMS and email, but a
partner system (a bank's fraud desk, a state police control room) has no way to
receive an alert except by polling. A webhook is the push channel, and the only
safe way to publish one is signed: the receiver must be able to tell a real
ATLAS alert from anything else that can reach its URL.

Contract (also in docs/PS_GAP_PLAN.md §3.3.1):

    POST <ALERT_WEBHOOK_URL>
    X-ATLAS-Timestamp: <unix seconds>
    X-ATLAS-Signature: sha256=<hex hmac of "<timestamp>.<exact body bytes>">
    Content-Type: application/json

The timestamp is inside the signed material, so a captured request cannot be
replayed later without failing the receiver's freshness check. Every retry is
signed again with a fresh timestamp.

There is deliberately **no unsigned fallback**. If the URL or secret is
missing, or the secret is too short outside demo/test, dispatch is refused and
the reason is recorded on the job. A webhook nobody can verify is worse than no
webhook at all.

Secrets are never logged and never written into `notification_jobs.last_error`:
only the host of the URL and the HTTP status are.
"""
import hashlib
import hmac
import json
import logging
import os
import time
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

MIN_SECRET_LENGTH = 32
DEFAULT_TIMEOUT_S = 10.0
# A receiver should reject anything older than this; exported so the documented
# contract and `verify_signature` use the same number.
TOLERANCE_S = 300


def _relaxed(env=None) -> bool:
    env = os.environ if env is None else env
    return (env.get("DEMO_MODE", "false").lower() in ("true", "1", "yes")
            or env.get("TESTING") == "1")


def config_status(env=None) -> tuple:
    """(configured, reason) — reasons never contain the secret or the URL."""
    env = os.environ if env is None else env
    url = (env.get("ALERT_WEBHOOK_URL") or "").strip()
    secret = (env.get("ALERT_WEBHOOK_SECRET") or "").strip()
    if not url:
        return False, "webhook not configured (ALERT_WEBHOOK_URL unset)"
    if not secret:
        return False, "webhook not configured (ALERT_WEBHOOK_SECRET unset); refusing unsigned dispatch"
    if not _relaxed(env) and len(secret) < MIN_SECRET_LENGTH:
        return False, f"webhook secret must be at least {MIN_SECRET_LENGTH} characters"
    return True, "ok"


def sign(secret: str, timestamp: str, body: bytes) -> str:
    """Signature header value for one attempt: sha256 over `timestamp.body`."""
    message = f"{timestamp}.".encode("utf-8") + body
    return "sha256=" + hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_signature(secret: str, timestamp: str, body: bytes, signature: str,
                     tolerance_s: int = TOLERANCE_S, now: float = None) -> bool:
    """Receiver-side check, and the executable statement of the contract.

    Rejects a stale timestamp as well as a wrong signature: without freshness a
    captured request stays valid forever.
    """
    try:
        sent_at = int(timestamp)
    except (TypeError, ValueError):
        return False
    if tolerance_s is not None:
        current = time.time() if now is None else now
        if abs(current - sent_at) > tolerance_s:
            return False
    return hmac.compare_digest(sign(secret, timestamp, body), signature or "")


def encode_body(body: dict) -> bytes:
    """Canonical body bytes. The signature is over these bytes, not re-serialised JSON."""
    return json.dumps(body, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")


def send_webhook(body: dict, url: str = None, secret: str = None,
                 timeout_s: float = None, now: float = None) -> bool:
    """POST one signed delivery. Never raises, never logs the secret.

    Returns True only on a 2xx response; anything else is a failed attempt that
    the durable queue will retry and, on exhaustion, dead-letter.
    """
    url = (url if url is not None else os.getenv("ALERT_WEBHOOK_URL", "")).strip()
    secret = (secret if secret is not None else os.getenv("ALERT_WEBHOOK_SECRET", "")).strip()
    if not url:
        logger.warning("Webhook URL not configured; skipping dispatch.")
        return False
    if not secret:
        # Never send what the receiver cannot verify.
        logger.warning("Webhook secret not configured; refusing unsigned dispatch.")
        return False
    if not _relaxed() and len(secret) < MIN_SECRET_LENGTH:
        logger.warning("Webhook secret is shorter than %s characters; refusing dispatch.",
                       MIN_SECRET_LENGTH)
        return False

    payload = encode_body(body if isinstance(body, dict) else {"body": body})
    timestamp = str(int(time.time() if now is None else now))
    headers = {
        "Content-Type": "application/json",
        "X-ATLAS-Timestamp": timestamp,
        "X-ATLAS-Signature": sign(secret, timestamp, payload),
        "X-ATLAS-Event": str((body or {}).get("event", "alert")) if isinstance(body, dict) else "alert",
    }
    host = urlparse(url).hostname or "configured host"
    try:
        resp = httpx.post(url, content=payload, headers=headers,
                          timeout=timeout_s or DEFAULT_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — network errors become job state
        logger.error("Webhook delivery to %s failed: %s", host, type(exc).__name__)
        return False
    if 200 <= resp.status_code < 300:
        logger.info("Webhook delivered to %s (status=%s)", host, resp.status_code)
        return True
    logger.error("Webhook rejected by %s (status=%s): %s", host, resp.status_code,
                 str(resp.text)[:200])
    return False
