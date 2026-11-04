"""Signed outbound webhook: the receiver can prove the alert came from ATLAS.

The risk this closes is not "the webhook might fail" (the durable queue already
retries), it is a receiver that cannot tell a real alert from an injected one.
So the tests are mostly about the signature contract: it covers the exact bytes,
it covers the timestamp, it rejects a stale replay, and nothing is ever sent
unsigned.

Secrets must not appear in logs or in `notification_jobs.last_error`, because
both are readable by an admin and one of them is exported by the retention path.
"""
import hashlib
import hmac
import json
import time

import pytest

import webhook_client
from database import SessionLocal
from models_db import NotificationJob
from reliability import enqueue_notification, process_notification_jobs
from tests.conftest import auth_header

SECRET = "webhook-test-secret-at-least-32-chars"
URL = "https://bank.example.test/hooks/atlas"


class _Resp:
    def __init__(self, status_code, text=""):
        self.status_code = status_code
        self.text = text


def _csrf(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


# ── The signature contract ───────────────────────────────────────────────────

def test_signature_is_hmac_over_timestamp_and_exact_body():
    body = webhook_client.encode_body({"event": "alert.created", "alert": {"alert_id": "ALT-1"}})
    timestamp = "1793600000"
    expected = "sha256=" + hmac.new(
        SECRET.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    assert webhook_client.sign(SECRET, timestamp, body) == expected
    assert webhook_client.verify_signature(
        SECRET, timestamp, body, expected, tolerance_s=None)


def test_timestamp_is_inside_the_signed_material():
    body = webhook_client.encode_body({"event": "alert.created"})
    signature = webhook_client.sign(SECRET, "1793600000", body)
    # Replaying the same body under a new timestamp must not verify.
    assert not webhook_client.verify_signature(
        SECRET, "1793600001", body, signature, tolerance_s=None)


def test_stale_delivery_is_rejected_but_a_fresh_one_is_accepted():
    now = time.time()
    body = webhook_client.encode_body({"event": "alert.created"})
    old = str(int(now - webhook_client.TOLERANCE_S - 60))
    fresh = str(int(now))
    assert not webhook_client.verify_signature(
        SECRET, old, body, webhook_client.sign(SECRET, old, body), now=now)
    assert webhook_client.verify_signature(
        SECRET, fresh, body, webhook_client.sign(SECRET, fresh, body), now=now)


def test_a_different_secret_cannot_forge_the_signature():
    body = webhook_client.encode_body({"event": "alert.created"})
    timestamp = str(int(time.time()))
    forged = webhook_client.sign("some-other-secret-at-least-32-chars!!", timestamp, body)
    assert not webhook_client.verify_signature(SECRET, timestamp, body, forged)


# ── Sending ──────────────────────────────────────────────────────────────────

def test_nothing_is_sent_without_a_secret(monkeypatch, caplog):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.delenv("ALERT_WEBHOOK_SECRET", raising=False)
    called = []
    monkeypatch.setattr(webhook_client.httpx, "post", lambda *a, **k: called.append(1))

    assert webhook_client.send_webhook({"event": "alert.created"}) is False
    assert called == [], "an unsigned request must never leave the process"


def test_nothing_is_sent_without_a_url(monkeypatch):
    monkeypatch.delenv("ALERT_WEBHOOK_URL", raising=False)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    called = []
    monkeypatch.setattr(webhook_client.httpx, "post", lambda *a, **k: called.append(1))
    assert webhook_client.send_webhook({"event": "alert.created"}) is False
    assert called == []


def test_delivery_posts_the_signed_body_a_receiver_can_verify(monkeypatch):
    captured = {}

    def fake_post(url, content=None, headers=None, timeout=None):
        captured.update(url=url, content=content, headers=headers, timeout=timeout)
        return _Resp(202)

    monkeypatch.setattr(webhook_client.httpx, "post", fake_post)
    body = {"event": "alert.created", "alert": {"alert_id": "ALT-9", "case_id": "CASE-001"}}

    assert webhook_client.send_webhook(body, url=URL, secret=SECRET) is True
    assert captured["url"] == URL
    assert captured["headers"]["X-ATLAS-Event"] == "alert.created"
    assert webhook_client.verify_signature(
        SECRET,
        captured["headers"]["X-ATLAS-Timestamp"],
        captured["content"],
        captured["headers"]["X-ATLAS-Signature"],
    )
    assert json.loads(captured["content"]) == body


def test_a_non_2xx_response_is_a_failed_attempt_not_an_exception(monkeypatch):
    monkeypatch.setattr(webhook_client.httpx, "post", lambda *a, **k: _Resp(500, "boom"))
    assert webhook_client.send_webhook({"event": "alert.created"}, url=URL, secret=SECRET) is False


def test_a_network_error_is_a_failed_attempt_and_does_not_leak_the_secret(monkeypatch, caplog):
    def explode(*args, **kwargs):
        raise ConnectionError(f"connect failed for {URL}?token={SECRET}")

    monkeypatch.setattr(webhook_client.httpx, "post", explode)
    caplog.set_level("DEBUG", logger="webhook_client")

    assert webhook_client.send_webhook({"event": "alert.created"}, url=URL, secret=SECRET) is False
    assert SECRET not in caplog.text
    assert "bank.example.test" in caplog.text


# ── The durable queue is the retry story ────────────────────────────────────

def test_queued_webhook_job_is_sent_through_the_worker(monkeypatch):
    monkeypatch.setattr(webhook_client.httpx, "post", lambda *a, **k: _Resp(200))
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)

    with SessionLocal() as db:
        job_id = enqueue_notification(
            db, "webhook", {"event": "alert.created", "alert": {"alert_id": "ALT-2"}})
        summary = process_notification_jobs(
            db, lambda m, t=None: True, lambda s, m, t=None: True,
            webhook_client.send_webhook, backoff_base_s=0)
        assert summary["sent"] == 1
        job = db.query(NotificationJob).filter(NotificationJob.id == job_id).first()
        assert job.status == "sent"


def test_webhook_dead_letters_on_exhaustion_without_storing_the_secret():
    with SessionLocal() as db:
        job_id = enqueue_notification(db, "webhook", {"event": "alert.created"}, max_attempts=2)
        for _ in range(2):
            process_notification_jobs(
                db, lambda m, t=None: True, lambda s, m, t=None: True,
                lambda payload: False, backoff_base_s=0)
        job = db.query(NotificationJob).filter(NotificationJob.id == job_id).first()
        assert job.status == "dead"
        assert job.attempts == 2
        assert SECRET not in (job.last_error or "")


# ── Integration: an unconfigured deployment queues nothing ──────────────────

def _create_alert(client, token):
    resp = client.post("/api/alerts", json={
        "case_id": "CASE-001", "message": "webhook probe", "risk_level": "Low",
        "location": "probe", "time_window": "10:00-12:00",
    }, headers={**auth_header(token), **_csrf(client, token)})
    assert resp.status_code == 200, resp.text
    return resp.json()["alert_id"]


def _webhook_job_count():
    with SessionLocal() as db:
        return db.query(NotificationJob).filter(NotificationJob.kind == "webhook").count()


def test_notify_reports_webhook_skipped_when_unconfigured(client, admin_token, monkeypatch):
    monkeypatch.delenv("ALERT_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("ALERT_WEBHOOK_SECRET", raising=False)
    alert_id = _create_alert(client, admin_token)

    resp = client.post(f"/api/alerts/{alert_id}/notify",
                       headers={**auth_header(admin_token), **_csrf(client, admin_token)})
    assert resp.status_code == 200, resp.text
    webhook = resp.json()["dispatch"]["webhook"]
    assert webhook["queued"] is False
    assert "ALERT_WEBHOOK_URL" in webhook["reason"]
    assert _webhook_job_count() == 0


def test_notify_queues_a_webhook_when_configured(client, admin_token, monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", URL)
    monkeypatch.setenv("ALERT_WEBHOOK_SECRET", SECRET)
    alert_id = _create_alert(client, admin_token)

    resp = client.post(f"/api/alerts/{alert_id}/notify",
                       headers={**auth_header(admin_token), **_csrf(client, admin_token)})
    assert resp.status_code == 200, resp.text
    assert resp.json()["dispatch"]["webhook"]["queued"] is True

    with SessionLocal() as db:
        job = db.query(NotificationJob).filter(
            NotificationJob.kind == "webhook").order_by(NotificationJob.id.desc()).first()
        assert job is not None and job.status == "queued"
        payload = json.loads(job.payload)
    assert payload["event"] == "alert.notified"
    assert payload["alert"]["alert_id"] == alert_id
