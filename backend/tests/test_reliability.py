"""Tests for production-hardening: idempotency, jobs, v1 prefix, pagination, scoping, model protocol, DB chain backends."""
import json
import os
import pytest
from tests.conftest import auth_header, TestingSessionLocal
from tests.test_api import get_csrf_header


def _h(token, csrf=None, idem=None):
    h = dict(auth_header(token))
    if csrf:
        h.update(csrf)
    if idem:
        h["Idempotency-Key"] = idem
    return h


# ─── Idempotency ─────────────────────────────────────────────────────────────

class TestIdempotency:
    def test_alert_replay_returns_identical_response(self, client, admin_token):
        csrf = get_csrf_header(client, admin_token)
        from models_db import Alert
        db = TestingSessionLocal()
        before = db.query(Alert).count()
        db.close()
        body = {"case_id": "CASE-001", "message": "idem-test", "risk_level": "Low",
                "location": "test", "time_window": "10:00-12:00"}
        r1 = client.post("/api/alerts", json=body, headers=_h(admin_token, csrf, "key-abc-123"))
        assert r1.status_code == 200
        r2 = client.post("/api/alerts", json=body, headers=_h(admin_token, csrf, "key-abc-123"))
        assert r2.status_code == 200
        assert r2.headers.get("X-Idempotent-Replay") == "true"
        assert r2.json() == r1.json()
        db = TestingSessionLocal()
        assert db.query(Alert).count() == before + 1  # no duplicate side effect
        db.close()

    def test_different_keys_execute_independently(self, client, admin_token):
        csrf = get_csrf_header(client, admin_token)
        body = {"case_id": "CASE-001", "message": "idem-test-2", "risk_level": "Low",
                "location": "test", "time_window": "10:00-12:00"}
        r1 = client.post("/api/alerts", json=body, headers=_h(admin_token, csrf, "key-one"))
        r2 = client.post("/api/alerts", json=body, headers=_h(admin_token, csrf, "key-two"))
        assert r1.json()["alert_id"] != r2.json()["alert_id"]
        assert "X-Idempotent-Replay" not in r2.headers

    def test_transaction_replay(self, client, admin_token):
        csrf = get_csrf_header(client, admin_token)
        body = {"case_id": "CASE-001", "amount": 500,
                "from_account": "ACC-1", "to_account": "ACC-2"}
        r1 = client.post("/api/transactions", json=body, headers=_h(admin_token, csrf, "key-tx-1"))
        assert r1.status_code == 200
        r2 = client.post("/api/transactions", json=body, headers=_h(admin_token, csrf, "key-tx-1"))
        assert r2.status_code == 200
        assert r2.headers.get("X-Idempotent-Replay") == "true"
        assert r2.json() == r1.json()


# ─── Notification jobs ───────────────────────────────────────────────────────

class TestNotificationJobs:
    def test_enqueue_process_and_list(self, client, admin_token):
        from reliability import enqueue_notification, process_notification_jobs
        db = TestingSessionLocal()
        try:
            jid = enqueue_notification(db, "sms", {"message": "hello"})
            assert jid > 0
            # Failing sender: stays queued with attempts recorded
            out = process_notification_jobs(db, lambda m, t=None: False, lambda s, m, t=None: True,
                                            backoff_base_s=0)
            assert out["processed"] == 1
            from models_db import NotificationJob
            job = db.query(NotificationJob).filter(NotificationJob.id == jid).first()
            assert job.status == "queued" and job.attempts == 1
            # Succeeding sender: sent
            out = process_notification_jobs(db, lambda m, t=None: True, lambda s, m, t=None: True,
                                            backoff_base_s=0)
            job = db.query(NotificationJob).filter(NotificationJob.id == jid).first()
            assert job.status == "sent"
        finally:
            db.close()
        resp = client.get("/api/notifications/jobs", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert any(j["id"] == jid for j in resp.json())

    def test_dead_letter_after_max_attempts(self, client, admin_token):
        from reliability import enqueue_notification, process_notification_jobs
        from models_db import NotificationJob
        db = TestingSessionLocal()
        try:
            jid = enqueue_notification(db, "email", {"subject": "s", "message": "m"}, max_attempts=2)
            fail = lambda *a, **k: False
            process_notification_jobs(db, fail, fail, backoff_base_s=0)
            process_notification_jobs(db, fail, fail, backoff_base_s=0)
            job = db.query(NotificationJob).filter(NotificationJob.id == jid).first()
            assert job.status == "dead" and job.attempts == 2
        finally:
            db.close()


# ─── Versioning / pagination / scoping / model protocol ─────────────────────

class TestApiHardening:
    def test_v1_prefix_mirrors_api(self, client, admin_token):
        r1 = client.get("/api/cases", headers=auth_header(admin_token))
        r2 = client.get("/api/v1/cases", headers=auth_header(admin_token))
        assert r2.status_code == 200
        assert r2.json() == r1.json()

    def test_cases_pagination(self, client, admin_token):
        full = client.get("/api/cases", headers=auth_header(admin_token)).json()
        assert len(full) >= 2
        page = client.get("/api/cases?limit=1&offset=1", headers=auth_header(admin_token)).json()
        assert len(page) == 1
        assert page[0]["case_id"] == full[1]["case_id"]

    def test_case_scoping_by_department(self, client, admin_token, analyst_token):
        from models_db import Case
        db = TestingSessionLocal()
        try:
            db.add(Case(case_id="CASE-XXX", crime_type="UPI Fraud", amount=10,
                        linked_accounts=1, current_risk="Low", status="active",
                        victim_name="X", contact="X", description="restricted",
                        department="Restricted-Unit", assigned_to=None))
            db.commit()
            admin_ids = {c["case_id"] for c in
                         client.get("/api/cases", headers=auth_header(admin_token)).json()}
            analyst_ids = {c["case_id"] for c in
                           client.get("/api/cases", headers=auth_header(analyst_token)).json()}
            assert "CASE-XXX" in admin_ids
            assert "CASE-XXX" not in analyst_ids
            assert "CASE-001" in analyst_ids  # shared pool still visible
        finally:
            db.close()

    def test_model_card_has_validation_protocol(self, client, admin_token):
        data = client.get("/api/model/card", headers=auth_header(admin_token)).json()
        proto = data.get("validation_protocol")
        assert proto is not None
        assert proto["calibration_status"].startswith("uncalibrated")
        assert proto["baseline_majority_accuracy"] == "96.36%"
        assert "human review" in proto["intended_use"].lower()


# ─── DB chain backends ───────────────────────────────────────────────────────

@pytest.fixture()
def chain_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from database import Base
    path = "test_chains_tmp.db"
    if os.path.exists(path):
        os.remove(path)
    eng = create_engine(f"sqlite:///{path}")
    Base.metadata.create_all(eng)
    SM = sessionmaker(bind=eng)
    yield SM
    eng.dispose()
    if os.path.exists(path):
        os.remove(path)


class TestDbChainBackends:
    def test_evidence_chain_db_roundtrip(self, chain_session):
        from evidence_chain import EvidenceChain, DbEvidenceStore
        c1 = EvidenceChain(store=DbEvidenceStore(session_factory=chain_session))
        assert c1.backend == "db"
        r = c1.add_evidence("CASE-001", "log", "db-content-1", "OFF-1")
        assert r["status"] == "anchored"
        c2 = EvidenceChain(store=DbEvidenceStore(session_factory=chain_session))
        assert len(c2.get_chain()) == 1
        assert c2.verify_evidence(1, "db-content-1")["valid"] is True

    def test_blockchain_db_roundtrip(self, chain_session):
        from blockchain import Blockchain
        bc = Blockchain(node_id="dbn", persist=True, backend="db",
                        session_factory=chain_session, chain_name="t9")
        assert bc.backend == "db"
        bc.add_transaction("tx", {"i": 1})
        assert bc.mine_pending()["status"] == "mined"
        bc2 = Blockchain(node_id="dbn", persist=True, backend="db",
                         session_factory=chain_session, chain_name="t9")
        assert len(bc2.chain) == 2
        assert Blockchain.validate_chain(bc2.get_chain())["valid"] is True


# --- Demo credentials / retention / CSP / audit search --------------------------

class TestDemoCredentialsEndpoint:
    def test_demo_credentials_follow_demo_mode(self, client):
        import auth
        r = client.get("/api/auth/demo-credentials")
        if auth.DEMO_MODE:
            assert r.status_code == 200
            rows = r.json()
            assert isinstance(rows, list) and len(rows) >= 4
            for row in rows:
                assert set(row) == {"label", "email", "password"}
        else:
            assert r.status_code == 404

    def test_demo_credentials_not_in_frontend_bundle(self):
        import glob as _g
        bundles = _g.glob(os.path.join("..", "frontend", "dist", "assets", "*.js"))
        if not bundles:
            pytest.skip("frontend not built")
        for path in bundles:
            with open(path, encoding="utf-8", errors="ignore") as fh:
                src = fh.read()
            assert "inspector123" not in src, f"demo password leaked into {path}"


class TestRetention:
    def test_retention_policy_requires_admin(self, client, analyst_token):
        r = client.get("/api/admin/retention", headers=auth_header(analyst_token))
        assert r.status_code in (401, 403)

    def test_retention_policy_documented(self, client, admin_token):
        r = client.get("/api/admin/retention", headers=auth_header(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["audit_log_days"] >= 7
        assert "no automatic deletion" in body["enforcement"]

    def test_purge_requires_csrf(self, client, admin_token):
        r = client.post("/api/admin/retention/purge", headers=auth_header(admin_token))
        assert r.status_code == 403

    def test_purge_removes_old_audit_keeps_cases(self, client, admin_token):
        from datetime import datetime, timedelta, timezone
        from tests.test_api import get_csrf_header
        from tests.conftest import TestingSessionLocal
        from models_db import AuditLog, Case
        db = TestingSessionLocal()
        try:
            old = AuditLog(action="Old Entry", details="ancient", action_type="system",
                           timestamp=datetime.now(timezone.utc) - timedelta(days=400))
            db.add(old)
            db.commit()
            old_id = old.id
            case_count = db.query(Case).count()
        finally:
            db.close()

        csrf = get_csrf_header(client, admin_token)
        r = client.post("/api/admin/retention/purge?days=365",
                        headers={**auth_header(admin_token), **csrf})
        assert r.status_code == 200
        body = r.json()
        assert body["purged"]["audit_logs"] >= 1
        assert "Case/evidence/alert records are never purged" in body["note"]

        db = TestingSessionLocal()
        try:
            # row with same id may be reused by the purge audit entry itself; assert content gone
            assert db.query(AuditLog).filter(AuditLog.action == "Old Entry").first() is None
            assert db.query(Case).count() == case_count  # cases untouched
        finally:
            db.close()


class TestSecurityHeaders:
    def test_csp_has_no_unsafe_eval_or_inline_scripts(self, client):
        r = client.get("/health/live")
        csp = r.headers.get("Content-Security-Policy", "")
        assert csp
        assert "unsafe-eval" not in csp
        # scripts: self only (no unsafe-inline in script-src)
        script_src = [p for p in csp.split(";") if p.strip().startswith("script-src")]
        assert script_src and "unsafe-inline" not in script_src[0]
        assert "unsafe-eval" not in script_src[0]
        assert "object-src 'none'" in csp
        assert "base-uri 'self'" in csp
        assert "frame-ancestors 'none'" in csp


class TestAuditSearch:
    def test_audit_q_filter(self, client, admin_token):
        from tests.conftest import TestingSessionLocal
        from models_db import AuditLog
        db = TestingSessionLocal()
        try:
            db.add(AuditLog(action="NeedleAction", details="haystack text", action_type="system"))
            db.commit()
        finally:
            db.close()
        r = client.get("/api/audit?q=NeedleAction", headers=auth_header(admin_token))
        assert r.status_code == 200
        rows = r.json()
        assert any(row["action"] == "NeedleAction" for row in rows)
        # non-matching query returns no such rows
        r2 = client.get("/api/audit?q=zzz_no_such_entry", headers=auth_header(admin_token))
        assert r2.status_code == 200
        assert all(row["action"] != "NeedleAction" for row in r2.json())

    def test_audit_requires_auth(self, client):
        assert client.get("/api/audit").status_code in (401, 403)

    def test_audit_returns_case_id_field(self, client, admin_token):
        r = client.get("/api/audit?limit=5", headers=auth_header(admin_token))
        assert r.status_code == 200
        rows = r.json()
        assert all("case_id" in row and "date" in row for row in rows)
