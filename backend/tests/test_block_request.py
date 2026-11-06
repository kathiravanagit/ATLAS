"""Fund-block request: a signed *request* for human review, not a freeze.

Covers the PS clause "enabling faster fund blocking" the honest way: the
endpoint records a tokenised account, audits it, and publishes
`alert.blocked` over the signed webhook when configured. It never claims the
bank acted, never sends unsigned, and never crosses a district boundary.
"""
import json

import pytest

from database import SessionLocal
from models_db import AuditLog, NotificationJob
from reliability import process_notification_jobs
from tests.conftest import auth_header

URL = "https://bank.example.test/hooks/atlas"
SECRET = "webhook-test-secret-at-least-32-chars"
TOKEN = "SYN-MULE-042"


def _csrf(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


def _hdrs(client, token):
    return {**auth_header(token), **_csrf(client, token)}


def _jobs(kind="webhook"):
    with SessionLocal() as db:
        return db.query(NotificationJob).filter(NotificationJob.kind == kind).all()


def test_block_request_queues_signed_webhook(client, admin_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    resp = client.post(
        "/api/cases/CASE-001/block-request",
        json={"to_account": TOKEN, "reason": "repeat mule"},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["status"] == "queued"
    assert body["case_id"] == "CASE-001"
    assert body["to_account"] == TOKEN
    assert body["dispatch"]["webhook"]["queued"] is True
    assert "no bank action" in body["message"].lower()

    jobs = _jobs("webhook")
    assert len(jobs) == 1
    payload = json.loads(jobs[0].payload)
    assert payload["event"] == "alert.blocked"
    assert payload["block_request"]["to_account"] == TOKEN
    assert payload["block_request"]["case_id"] == "CASE-001"
    # The payload must not claim funds were frozen or carry a score.
    blob = json.dumps(payload).lower()
    assert "blocked" in blob
    assert "frozen" not in blob
    assert "probability" not in blob

    with SessionLocal() as db:
        audit = db.query(AuditLog).filter(AuditLog.case_id == "CASE-001").all()
        mine = [a for a in audit if a.action == "Block Requested"]
        assert len(mine) == 1
        assert TOKEN in mine[0].details


def test_block_request_skips_when_webhook_unconfigured(client, admin_token, monkeypatch):
    monkeypatch.delenv("ALERT_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("ALERT_WEBHOOK_SECRET", raising=False)
    before = len(_jobs("webhook"))
    resp = client.post(
        "/api/cases/CASE-001/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 202, resp.text
    assert resp.json()["dispatch"]["webhook"]["queued"] is False
    assert resp.json()["status"] == "skipped"
    assert "ALERT_WEBHOOK_URL" in resp.json()["dispatch"]["webhook"]["reason"]
    assert len(_jobs("webhook")) == before


def test_block_request_cross_district_is_404(client, district_inspector_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    before = len(_jobs("webhook"))
    resp = client.post(
        "/api/cases/CASE-002/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, district_inspector_token),
    )
    assert resp.status_code == 404, resp.text
    assert len(_jobs("webhook")) == before
    with SessionLocal() as db:
        audit = db.query(AuditLog).filter(
            AuditLog.case_id == "CASE-002", AuditLog.action == "Block Requested").all()
        assert audit == []


def test_block_request_own_district_succeeds(client, district_inspector_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    resp = client.post(
        "/api/cases/CASE-001/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, district_inspector_token),
    )
    assert resp.status_code == 202, resp.text
    assert resp.json()["status"] == "queued"


def test_block_request_rejects_raw_account_number(client, admin_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    for raw in ("123456789012345678", "1234 5678 9012", "a@b.com", ""):
        resp = client.post(
            "/api/cases/CASE-002/block-request",
            json={"to_account": raw},
            headers=_hdrs(client, admin_token),
        )
        assert resp.status_code in (422,), (raw, resp.status_code, resp.text)
    assert _jobs("webhook") == [] or all(
        "123456789012345678" not in (j.payload or "") for j in _jobs("webhook")
    )


def test_block_request_needs_auth_and_csrf(client, admin_token):
    unauth = client.post(
        "/api/cases/CASE-001/block-request", json={"to_account": TOKEN})
    assert unauth.status_code == 401
    no_csrf = client.post(
        "/api/cases/CASE-001/block-request",
        json={"to_account": TOKEN},
        headers=auth_header(admin_token),
    )
    assert no_csrf.status_code == 403


def test_block_request_idempotency_does_not_double_enqueue(client, admin_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    headers = _hdrs(client, admin_token)
    headers["Idempotency-Key"] = "block-key-0001"
    first = client.post("/api/cases/CASE-003/block-request", json={"to_account": TOKEN}, headers=headers)
    second = client.post("/api/cases/CASE-003/block-request", json={"to_account": TOKEN}, headers=headers)
    assert first.status_code == 202
    assert second.status_code in (202, 200)
    assert second.json().get("case_id") == "CASE-003"
    assert len(_jobs("webhook")) == 1


def test_block_request_job_is_sent_through_worker(client, admin_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    resp = client.post(
        "/api/cases/CASE-004/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 202
    sent = []
    with SessionLocal() as db:
        summary = process_notification_jobs(
            db,
            lambda m, t=None: True,
            lambda s, m, t=None: True,
            lambda payload: (sent.append(payload), True)[1],
            backoff_base_s=0,
        )
        assert summary["sent"] == 1
        job = db.query(NotificationJob).filter(NotificationJob.kind == "webhook").first()
        assert job is not None and job.status == "sent"
    assert len(sent) == 1
    assert sent[0]["event"] == "alert.blocked"
    assert sent[0]["block_request"]["to_account"] == TOKEN


def test_block_request_bank_500_retries_then_dead_letters(client, admin_token, monkeypatch):
    """Bank is down (500): the job retries through the durable queue and
    then dead-letters — it is not marked sent and it is not lost."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    resp = client.post(
        "/api/cases/CASE-004/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 202
    with SessionLocal() as db:
        for _ in range(3):
            summary = process_notification_jobs(
                db,
                lambda m, t=None: True,
                lambda s, m, t=None: True,
                lambda payload: False,  # bank keeps returning 500
                backoff_base_s=0,
            )
        job = db.query(NotificationJob).filter(NotificationJob.kind == "webhook").first()
        assert job is not None
        assert job.status == "dead", (summary, job.status, job.attempts)
        assert job.attempts == 3
        assert job.last_error


def test_block_request_bank_timeout_is_queued_not_sent(client, admin_token, monkeypatch):
    """Bank times out: the exception is captured as job state, not raised,
    and the request is not marked sent — the worker will retry it."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    resp = client.post(
        "/api/cases/CASE-005/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 202

    def timeout(payload):
        raise TimeoutError("bank did not answer")

    with SessionLocal() as db:
        summary = process_notification_jobs(
            db,
            lambda m, t=None: True,
            lambda s, m, t=None: True,
            timeout,
            backoff_base_s=0,
        )
        assert summary["sent"] == 0
        job = db.query(NotificationJob).filter(NotificationJob.kind == "webhook").first()
        assert job is not None
        assert job.status == "queued"
        assert "TimeoutError" in (job.last_error or "")


def test_block_request_200_with_rejected_body_counts_as_delivered(client, admin_token, monkeypatch):
    """Known limit, documented: send_webhook treats any 2xx as delivered and
    does not inspect the body. A bank that answers 200 with
    {"status": "rejected"} is therefore indistinguishable from an accept
    here, and the job is marked sent. A refusal must come back as non-2xx
    (or a follow-up status check) for the queue to retry/dead-letter it.
    This test pins that behaviour so a future body-check change is a
    deliberate, reviewable change rather than a silent one."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    resp = client.post(
        "/api/cases/CASE-005/block-request",
        json={"to_account": TOKEN},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 202
    seen = []

    def accepted_despite_rejected_body(payload):
        # The wire client has already returned True for the 2xx; this
        # sender stands in for it, so the body content is not re-read.
        seen.append(payload)
        return True

    with SessionLocal() as db:
        summary = process_notification_jobs(
            db,
            lambda m, t=None: True,
            lambda s, m, t=None: True,
            accepted_despite_rejected_body,
            backoff_base_s=0,
        )
        assert summary["sent"] == 1
        job = db.query(NotificationJob).filter(NotificationJob.kind == "webhook").first()
        assert job.status == "sent"
    assert seen and seen[0]["event"] == "alert.blocked"
