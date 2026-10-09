import os
import pytest
from tests.conftest import auth_header


def get_csrf_header(client, token):
    """Get CSRF token header for state-changing requests."""
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    if resp.status_code == 200:
        return {"X-CSRF-Token": resp.json()["csrf_token"]}
    return {}


# ─── Health ───────────────────────────────────────────────────────────────────

def test_health(client, admin_token):
    resp = client.get("/api/health", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["mode"] in ("sqlite", "postgresql")


def test_health_liveness_is_public(client):
    resp = client.get("/health/live")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_health_requires_auth(client):
    assert client.get("/api/health").status_code in (401, 403)
    assert client.get("/api/health/db-check").status_code in (401, 403)


# ─── Auth Flow ────────────────────────────────────────────────────────────────

def test_login_success(client):
    resp = client.post("/api/auth/login", json={"email": "admin@atlas.gov", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["role"] == "admin"


def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"email": "admin@atlas.gov", "password": "wrong"})
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/auth/login", json={"email": "nobody@x.com", "password": "x"})
    assert resp.status_code == 401


def test_register_requires_approval_before_login(client, admin_token):
    response = client.post("/api/auth/register", json={
        "name": "Test User", "email": "test@test.com", "password": "Test@123",
        "role": "analyst", "department": "Intelligence Unit",
    })
    assert response.status_code == 200, response.text
    registration = response.json()
    assert registration["access_token"] == ""
    assert registration["user"]["pending_approval"] is True
    assert client.post("/api/auth/login", json={"email": "test@test.com", "password": "Test@123"}).status_code == 403
    csrf = get_csrf_header(client, admin_token)
    approved = client.post("/api/auth/approve/" + registration["user"]["id"],
                           headers={**auth_header(admin_token), **csrf})
    assert approved.status_code == 200
    login = client.post("/api/auth/login", json={"email": "test@test.com", "password": "Test@123"})
    assert login.status_code == 200 and login.json()["access_token"]


def test_refresh_token(client):
    resp = client.post("/api/auth/login", json={"email": "admin@atlas.gov", "password": "admin123"})
    refresh = resp.json()["refresh_token"]
    resp2 = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert resp2.status_code == 200
    assert "access_token" in resp2.json()


def test_refresh_token_reuse_detected(client):
    resp = client.post("/api/auth/login", json={"email": "admin@atlas.gov", "password": "admin123"})
    refresh = resp.json()["refresh_token"]
    client.post("/api/auth/refresh", json={"refresh_token": refresh})
    resp2 = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert resp2.status_code in (401, 403)


def test_me_endpoint(client, admin_token):
    resp = client.get("/api/auth/me", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


def test_me_no_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


def test_missing_credentials_are_401_not_403(client):
    # Unauthenticated (no identity) vs forbidden (denied identity).
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/cases").status_code == 401


# ─── RBAC: Read-Only Endpoints (all roles) ───────────────────────────────────

READ_ENDPOINTS = [
    ("GET", "/api/cities"),
    ("GET", "/api/cities/chennai"),
    ("GET", "/api/cities/chennai/atms"),
    ("GET", "/api/cities/chennai/predictions"),
    ("GET", "/api/dashboard"),
    ("GET", "/api/cases"),
    ("GET", "/api/predictions"),
    ("GET", "/api/alerts"),
    ("GET", "/api/locations"),
    ("GET", "/api/stats/nationwide"),
    ("GET", "/api/model/card"),
    ("GET", "/api/model/distribution"),
    ("GET", "/api/model/metrics"),
    ("GET", "/api/model/drift"),
    ("GET", "/api/review/history"),
]


def test_read_endpoints_accept_all_roles(client, admin_token, inspector_token, analyst_token, bank_officer_token):
    for method, path in READ_ENDPOINTS:
        for token in [admin_token, inspector_token, analyst_token, bank_officer_token]:
            resp = client.request(method, path, headers=auth_header(token))
            assert resp.status_code == 200, f"{method} {path} failed with status {resp.status_code}"


def test_audit_restricted_to_investigative_roles(client, admin_token, inspector_token, analyst_token, bank_officer_token):
    # Bank officers see cases/alerts but not the audit trail (investigator IDs, reasons).
    for token in [admin_token, inspector_token, analyst_token]:
        assert client.get("/api/audit", headers=auth_header(token)).status_code == 200
    assert client.get("/api/audit", headers=auth_header(bank_officer_token)).status_code == 403


def test_read_endpoints_reject_unauthenticated(client):
    for method, path in READ_ENDPOINTS[:5]:
        resp = client.request(method, path)
        assert resp.status_code in (401, 403), f"{method} {path} should require auth"


# ─── RBAC: Write Endpoints ───────────────────────────────────────────────────

def test_create_alert_requires_csrf(client, bank_officer_token):
    resp = client.post("/api/alerts", json={
        "case_id": "CASE-001", "message": "test", "risk_level": "Low",
        "location": "test", "time_window": "10:00-12:00"
    }, headers=auth_header(bank_officer_token))
    assert resp.status_code == 403


def test_create_alert_works_for_analyst(client, analyst_token):
    csrf = get_csrf_header(client, analyst_token)
    resp = client.post("/api/alerts", json={
        "case_id": "CASE-001", "message": "test", "risk_level": "Low",
        "location": "test", "time_window": "10:00-12:00"
    }, headers={**auth_header(analyst_token), **csrf})
    assert resp.status_code == 200


def test_simulate_transaction_requires_csrf(client, bank_officer_token):
    resp = client.post("/api/transactions", json={
        "case_id": "CASE-001", "amount": 10000, "from_account": "A", "to_account": "B"
    }, headers=auth_header(bank_officer_token))
    assert resp.status_code == 403


def test_simulate_transaction_rejects_invalid_amounts(client, inspector_token):
    # Negative, zero, oversized and non-finite amounts must never reach the case.
    csrf = get_csrf_header(client, inspector_token)
    headers = {**auth_header(inspector_token), **csrf}
    for bad_amount in (-5, 0, 10_000_001, 1e30):
        resp = client.post("/api/transactions", json={
            "case_id": "CASE-001", "amount": bad_amount,
            "from_account": "A", "to_account": "B"
        }, headers=headers)
        assert resp.status_code == 422, f"amount={bad_amount} accepted"


def test_simulate_transaction_does_not_mutate_case_amount(client, inspector_token):
    from tests.conftest import TestingSessionLocal
    from models_db import Case
    csrf = get_csrf_header(client, inspector_token)
    headers = {**auth_header(inspector_token), **csrf}
    db = TestingSessionLocal()
    try:
        before = db.query(Case).filter(Case.case_id == "CASE-001").first().amount
    finally:
        db.close()
    resp = client.post("/api/transactions", json={
        "case_id": "CASE-001", "amount": 10000,
        "from_account": "A", "to_account": "B"
    }, headers=headers)
    assert resp.status_code == 200
    db = TestingSessionLocal()
    try:
        after = db.query(Case).filter(Case.case_id == "CASE-001").first().amount
    finally:
        db.close()
    assert after == before


def test_predictions_list_cached_and_invalidated_on_write(client, inspector_token):
    import main as main_module
    csrf = get_csrf_header(client, inspector_token)
    headers = {**auth_header(inspector_token), **csrf}
    r1 = client.get("/api/predictions", headers=auth_header(inspector_token))
    assert r1.status_code == 200
    assert main_module._predictions_cache, "expected the list response to be cached"
    r2 = client.get("/api/predictions", headers=auth_header(inspector_token))
    assert r2.status_code == 200
    assert r2.json() == r1.json()
    w = client.post("/api/transactions", json={
        "case_id": "CASE-001", "amount": 5000,
        "from_account": "A", "to_account": "B"
    }, headers=headers)
    assert w.status_code == 200
    assert not main_module._predictions_cache, "write must invalidate the cache"
    r3 = client.get("/api/predictions", headers=auth_header(inspector_token))
    assert r3.status_code == 200


def test_anchor_evidence_requires_write(client, bank_officer_token):
    resp = client.post("/api/evidence/anchor", json={
        "case_id": "CASE-001", "evidence_type": "test", "content": "test data", "officer_id": "OFF-001"
    }, headers=auth_header(bank_officer_token))
    assert resp.status_code == 403


# ─── RBAC: Override Endpoints (inspector + admin only) ───────────────────────

def test_resolve_case_requires_override(client, analyst_token):
    resp = client.post("/api/cases/CASE-001/resolve", headers=auth_header(analyst_token))
    assert resp.status_code == 403


def test_resolve_case_works_for_inspector(client, inspector_token):
    csrf = get_csrf_header(client, inspector_token)
    resp = client.post("/api/cases/CASE-001/resolve", headers={**auth_header(inspector_token), **csrf})
    assert resp.status_code == 200


def test_state_changing_endpoints_reject_missing_csrf(client, inspector_token, admin_token):
    # P0-2: every authenticated mutation must require a CSRF token
    cases = [
        ("POST", "/api/auth/logout", {"refresh_token": "x"}, admin_token),
        ("PUT", "/api/auth/me", {"name": "x"}, admin_token),
        ("POST", "/api/auth/change-password", {"current_password": "x", "new_password": "y12345"}, admin_token),
        ("POST", "/api/cases/CASE-001/resolve", None, inspector_token),
        ("POST", "/api/cases/CASE-001/action", {"type": "acknowledge"}, inspector_token),
        ("POST", "/api/review/CASE-001", {"action": "approve", "reason": "t", "reviewer_id": "INS-001"}, inspector_token),
    ]
    for method, path, body, token in cases:
        resp = client.request(method, path, json=body, headers=auth_header(token))
        assert resp.status_code == 403, f"{method} {path} accepted a mutation without CSRF"


def test_transaction_returns_503_without_atm_data(client, admin_token):
    # P0-3: controlled 503 (not 500) when prediction engine has no ATM reference data
    from tests.conftest import TestingSessionLocal
    from models_db import AtmLocation
    db = TestingSessionLocal()
    try:
        db.query(AtmLocation).delete()
        db.commit()
        csrf = get_csrf_header(client, admin_token)
        resp = client.post("/api/transactions", json={
            "case_id": "CASE-001", "amount": 1000,
            "from_account": "ACC-1", "to_account": "ACC-2",
        }, headers={**auth_header(admin_token), **csrf})
        assert resp.status_code == 503
        assert "Prediction service" in resp.json()["detail"]
    finally:
        db.rollback()
        db.close()


def test_review_case_rejects_analyst(client, analyst_token):
    csrf = get_csrf_header(client, analyst_token)
    resp = client.post("/api/review/CASE-001", json={
        "action": "approve", "reason": "analyst lacks review permission here", "reviewer_id": "ANL-001"
    }, headers={**auth_header(analyst_token), **csrf})
    assert resp.status_code == 403


def test_review_case_works_for_inspector(client, inspector_token):
    csrf = get_csrf_header(client, inspector_token)
    resp = client.post("/api/review/CASE-001", json={
        "action": "approve", "reason": "field verification complete", "reviewer_id": "INS-001"
    }, headers={**auth_header(inspector_token), **csrf})
    assert resp.status_code == 200


def test_review_case_rejects_short_reason(client, inspector_token):
    csrf = get_csrf_header(client, inspector_token)
    resp = client.post("/api/review/CASE-001", json={
        "action": "approve", "reason": "ok", "reviewer_id": "INS-001"
    }, headers={**auth_header(inspector_token), **csrf})
    assert resp.status_code == 422


def test_review_case_rejects_already_resolved(client, inspector_token):
    csrf = get_csrf_header(client, inspector_token)
    headers = {**auth_header(inspector_token), **csrf}
    resp = client.post("/api/review/CASE-002", json={
        "action": "dismiss", "reason": "confirmed duplicate filing", "reviewer_id": "INS-001"
    }, headers=headers)
    assert resp.status_code == 200
    resp2 = client.post("/api/review/CASE-002", json={
        "action": "approve", "reason": "second look requested here", "reviewer_id": "INS-001"
    }, headers=headers)
    assert resp2.status_code == 409


def test_review_history_persists_decisions(client, inspector_token):
    csrf = get_csrf_header(client, inspector_token)
    headers = {**auth_header(inspector_token), **csrf}
    client.post("/api/review/CASE-003", json={
        "action": "override", "reason": "risk downgraded after visit", "reviewer_id": "INS-001"
    }, headers=headers)
    resp = client.get("/api/review/history", params={"case_id": "CASE-003"},
                      headers=auth_header(inspector_token))
    assert resp.status_code == 200
    rows = [r for r in resp.json() if r["case_id"] == "CASE-003"]
    assert rows and rows[0]["action"] == "override"
    assert rows[0]["reviewer_id"] == "INS-001"


def test_case_predictions_persist_shap_snapshots(client, admin_token):
    # Seed-time guarantee: pipeline output must carry exact feature snapshots
    # or /api/model/shap/{case} returns 409 for seeded cases.
    import json
    from tests.conftest import TestingSessionLocal
    from models_db import RankedLocation
    resp = client.get("/api/predictions/CASE-001", headers=auth_header(admin_token))
    assert resp.status_code == 200
    db = TestingSessionLocal()
    try:
        rows = db.query(RankedLocation).all()
        assert rows
        for r in rows:
            snap = json.loads(r.reason)
            assert snap.get("snapshot_version") == 1
            assert isinstance(snap.get("prediction_features"), dict)
            assert isinstance(snap.get("model_output"), dict)
    finally:
        db.close()


# ─── Predictions ──────────────────────────────────────────────────────────────

def test_get_predictions(client, admin_token):
    resp = client.get("/api/predictions", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_prediction_by_case(client, admin_token):
    resp = client.get("/api/predictions/CASE-001", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "case_id" in data
    assert "primary_location" in data
    assert "ranked_locations" in data


# ─── Model Endpoints ──────────────────────────────────────────────────────────

def test_model_card(client, admin_token):
    resp = client.get("/api/model/card", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert "accuracy" in resp.json()


def test_model_metrics(client, admin_token):
    resp = client.get("/api/model/metrics", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "ensemble" in data
    assert "random_forest" in data
    assert "xgboost" in data


def test_model_drift(client, admin_token):
    resp = client.get("/api/model/drift", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_heuristic_score" in data
    assert data["verified"] is False
    assert "not population stability index" in data["metric_method"]


def test_shap_explanation(client, admin_token):
    prediction = client.get("/api/predictions/CASE-001", headers=auth_header(admin_token))
    assert prediction.status_code == 200
    resp = client.get("/api/model/shap/CASE-001", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "feature_contributions" in data
    assert "risk_score" in data


def test_mule_network(client, admin_token):
    resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data


def test_detect_anomaly(client, admin_token):
    resp = client.post("/api/model/detect-anomaly", json={
        "amount": 50000, "num_mule_accounts": 3, "hour_of_day": 19, "transaction_velocity": 0.7
    }, headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert "is_anomaly" in resp.json()


# ─── NLP Triage ───────────────────────────────────────────────────────────────

def test_nlp_triage_vishing(client, admin_token):
    resp = client.post("/api/nlp/triage", json={
        "text": "I received a phone call asking for my OTP and I shared it. Rs.45000 was debited."
    }, headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] == "Vishing / Social Engineering"
    assert data["priority"] in ("Medium", "High", "Critical")


def test_nlp_triage_upi(client, admin_token):
    resp = client.post("/api/nlp/triage", json={
        "text": "Someone used a fake UPI QR code and Rs.15000 was deducted from my account."
    }, headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] == "UPI Fraud"


# ─── Evidence Chain ───────────────────────────────────────────────────────────

def test_evidence_anchor_and_verify(client, admin_token):
    content = f"unique evidence {os.urandom(8).hex()}"
    csrf = get_csrf_header(client, admin_token)
    resp = client.post("/api/evidence/anchor", json={
        "case_id": "CASE-001", "evidence_type": "transaction_log",
        "content": content, "officer_id": "INS-001"
    }, headers={**auth_header(admin_token), **csrf})
    assert resp.status_code == 200
    block_id = resp.json()["block_id"]

    resp2 = client.get(f"/api/evidence/verify/{block_id}", params={"content": content},
                       headers=auth_header(admin_token))
    assert resp2.status_code == 200
    assert "valid" in resp2.json()


def test_evidence_chain_list(client, admin_token):
    csrf = get_csrf_header(client, admin_token)
    client.post("/api/evidence/anchor", json={
        "case_id": "CASE-001", "evidence_type": "test", "content": "chain test", "officer_id": "INS-001"
    }, headers={**auth_header(admin_token), **csrf})
    resp = client.get("/api/evidence/chain", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert "blocks" in resp.json()
    assert "stats" in resp.json()


# ─── Review Queue ─────────────────────────────────────────────────────────────

def test_review_queue(client, admin_token):
    resp = client.get("/api/review/queue", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert "queue" in resp.json()


def test_review_history(client, admin_token):
    resp = client.get("/api/review/history", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── Cities ───────────────────────────────────────────────────────────────────

def test_cities_list(client, admin_token):
    resp = client.get("/api/cities", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "chennai" in [c["id"] for c in data]


def test_city_info(client, admin_token):
    resp = client.get("/api/cities/chennai", headers=auth_header(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Chennai"
    assert data["atm_count"] > 0


def test_city_not_found(client, admin_token):
    resp = client.get("/api/cities/nonexistent", headers=auth_header(admin_token))
    assert resp.status_code == 404


def test_city_atms(client, admin_token):
    resp = client.get("/api/cities/chennai/atms", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) > 0


# ─── Security Headers ─────────────────────────────────────────────────────────

def test_security_headers(client):
    resp = client.get("/health/live")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "Strict-Transport-Security" in resp.headers


# ─── CSRF Token ───────────────────────────────────────────────────────────────

def test_csrf_token(client, admin_token):
    resp = client.get("/api/csrf-token", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert "csrf_token" in resp.json()


def test_csrf_token_requires_auth(client):
    resp = client.get("/api/csrf-token")
    assert resp.status_code in (401, 403)
