"""
Reliability helpers: idempotent mutations + durable notification dispatch.

- Idempotency-Key header: repeat POSTs with the same key return the ORIGINAL
  stored response instead of re-executing side effects (no duplicate alerts,
  transactions, or evidence anchors on client retries).
- notification_jobs table: SMS/email work is enqueued transactionally with the
  request and processed by a tracked worker (with retry + dead-letter) instead
  of fire-and-forget threads. Stepping stone toward Celery/RQ.
"""
import json
import time
from datetime import datetime, timezone

from fastapi import Request
from fastapi.responses import JSONResponse

from models_db import IdempotencyKey, NotificationJob


IDEMPOTENCY_HEADER = "Idempotency-Key"
MAX_BODY_BYTES = 200_000


def idempotency_key_from(request: Request):
    return (request.headers.get(IDEMPOTENCY_HEADER) or "").strip() or None


def check_replay(db, key: str, method: str, path: str):
    """Return a stored replay response if this key was seen, else None."""
    row = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if row is None or row.method != method or row.path != path:
        return None
    return JSONResponse(
        status_code=row.status_code,
        content=json.loads(row.response_body),
        headers={"X-Idempotent-Replay": "true"},
    )


def store_replay(db, key: str, method: str, path: str, status_code: int, body: dict):
    """Persist a response for future replays. Best-effort; never fails the request."""
    try:
        raw = json.dumps(body)
        if len(raw) > MAX_BODY_BYTES:
            return
        db.add(IdempotencyKey(
            key=key, method=method, path=path,
            status_code=status_code, response_body=raw,
        ))
        db.commit()
    except Exception:
        db.rollback()


def enqueue_notification(db, kind: str, payload: dict, max_attempts: int = 3) -> int:
    """Enqueue SMS/email work inside the request transaction. Returns job id."""
    job = NotificationJob(
        kind=kind, payload=json.dumps(payload),
        status="queued", attempts=0, max_attempts=max_attempts,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job.id


def process_notification_jobs(db, send_sms, send_email, batch: int = 20,
                              backoff_base_s: float = 1.0) -> dict:
    """Run one pass over queued jobs with retry + dead-letter. Returns a summary."""
    jobs = db.query(NotificationJob).filter(
        NotificationJob.status.in_(["queued", "sending"])
    ).order_by(NotificationJob.id).limit(batch).all()
    summary = {"processed": 0, "sent": 0, "failed": 0, "dead": 0}
    for job in jobs:
        job.status = "sending"
        job.attempts = (job.attempts or 0) + 1
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        try:
            payload = json.loads(job.payload or "{}")
            ok = send_email(payload["subject"], payload["message"], payload.get("to")) \
                if job.kind == "email" else send_sms(payload["message"], payload.get("to"))
        except Exception as exc:  # noqa: BLE001 — provider errors become job state
            ok, err = False, f"{type(exc).__name__}: {exc}"
        else:
            err = ""
        if ok:
            job.status = "sent"
            summary["sent"] += 1
        elif job.attempts >= (job.max_attempts or 3):
            job.status = "dead"
            job.last_error = err or "provider reported failure"
            summary["dead"] += 1
        else:
            job.status = "queued"
            job.last_error = err or "provider reported failure"
            summary["failed"] += 1
            time.sleep(backoff_base_s * (2 ** (job.attempts - 1)))
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        summary["processed"] += 1
    return summary


def run_notification_worker(db_factory, send_sms, send_email):
    """Tracked daemon entrypoint: drain the queue once, then exit."""
    db = db_factory()
    try:
        return process_notification_jobs(db, send_sms, send_email)
    finally:
        db.close()
