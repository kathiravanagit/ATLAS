"""Focused security contracts; use fake ML outputs, never train or dispatch jobs."""
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import text

import auth
import main
from access_control import require_case
from encryption import encrypt, seal, unseal
from evidence_chain import EvidenceChain
from models_db import Alert, AuditLog, Case, FieldOutcome, NotificationJob, IdempotencyKey, Suspect, TransactionRecord, User
from security_config import SECURITY_CONFIG, load_security_config
from .conftest import TestingSessionLocal


@pytest.fixture
def headers():
    def make(role="inspector"):
        email = {"admin": "admin@atlas.gov", "inspector": "inspector@atlas.gov",
                 "analyst": "analyst@atlas.gov", "bank_officer": "bank@atlas.gov"}[role]
        return {"Authorization": "Bearer " + auth.create_access_token({"sub": email}),
                "X-CSRF-Token": auth.generate_csrf_token(role)}
    return make


@pytest.fixture
def scoped_cases():
    with TestingSessionLocal() as db:
        db.add_all([
            Case(case_id="SEC-OWN", crime_type="test", amount=100, department="Cybercrime Division"),
            # Assignment must not bypass the department boundary.
            Case(case_id="SEC-FOREIGN", crime_type="test", amount=900, department="Other Department", assigned_to="INS-001"),
            Case(case_id="SEC-ASSIGNED", crime_type="test", amount=1, department="", assigned_to="ADM-001"),
        ])
        db.add(Alert(alert_id="SEC-ALERT", case_id="SEC-FOREIGN", message="private", risk_level="High",
                     location="private location", time_window="18:00", timestamp="12:00"))
        db.add(AuditLog(case_id="SEC-FOREIGN", action="Private event", details="foreign classified note"))
        db.add(FieldOutcome(case_id="SEC-FOREIGN", atm_id="ATM-CH-001", outcome="cash_recovered", officer_id="ADM-001", notes="private"))
        db.commit()


@pytest.fixture
def fake_model(monkeypatch):
    seen = []
    def predict(features, case_id=""):
        seen.append((dict(features), case_id))
        return {"risk_score": 64.2, "confidence": 64.2, "model_version": "security-test-v1",
                "ensemble": {"random_forest": {"probability": .642}},
                "model_weights": {"random_forest": 1}, "contributions": [], "drift": {"drifted": False}}
    monkeypatch.setattr(main, "predict_cashout", predict)
    monkeypatch.setattr(main, "get_metadata", lambda: {"model_version": "security-test-v1"})
    monkeypatch.setattr(main, "load_models", lambda: (object(), None))
    monkeypatch.setattr(main, "explain_cashout", None)
    main._city_prediction_cache.clear()
    return seen


def production_env():
    return {"JWT_SECRET_KEY": "access-key-with-at-least-32-characters-unique",
            "REFRESH_SECRET_KEY": "refresh-key-with-at-least-32-characters-unique",
            "ENCRYPTION_KEY": bytes(range(32)).hex()}


@pytest.mark.parametrize("field,value", [
    ("JWT_SECRET_KEY", ""), ("REFRESH_SECRET_KEY", ""), ("ENCRYPTION_KEY", ""),
    ("JWT_SECRET_KEY", "dev-secret-key-do-not-use-in-production"),
    ("REFRESH_SECRET_KEY", "dev-refresh-secret-do-not-use-in-production"),
    ("JWT_SECRET_KEY", "atlas-jwt-secret-key-change-in-production-2026"),
    ("ENCRYPTION_KEY", "00" * 32), ("ENCRYPTION_KEY", "invalid"),
])
def test_production_secrets_fail_closed(field, value):
    env = production_env()
    env[field] = value
    with pytest.raises(RuntimeError):
        load_security_config(env)


def test_secret_alias_and_explicit_relaxed_modes():
    env = production_env()
    config = load_security_config(env)
    assert config.access_secret == env["JWT_SECRET_KEY"]
    assert load_security_config({"TESTING": "1"}).encryption_key
    assert load_security_config({"DEMO_MODE": "true"}).access_secret
    with pytest.raises(RuntimeError):
        load_security_config({"TESTING": "false"})
    with pytest.raises(RuntimeError):
        load_security_config({**env, "SECRET_KEY": "different-secret"})
    with pytest.raises(RuntimeError):
        load_security_config({**env, "REFRESH_SECRET_KEY": env["JWT_SECRET_KEY"]})
    assert auth.SECRET_KEY == SECURITY_CONFIG.access_secret
    assert auth.REFRESH_SECRET_KEY == SECURITY_CONFIG.refresh_secret
    assert auth.decode_access_token(auth.create_access_token({"sub": "officer"}))["sub"] == "officer"
    with pytest.raises(HTTPException):
        auth.decode_access_token(auth.create_refresh_token({"sub": "officer"}))


def test_production_module_import_rejects_missing_secrets(tmp_path):
    env = dict(os.environ)
    for key in ("TESTING", "DEMO_MODE", "SECRET_KEY", "JWT_SECRET_KEY", "REFRESH_SECRET_KEY", "ENCRYPTION_KEY", "PYTEST_CURRENT_TEST"):
        env.pop(key, None)
    env["PYTHONPATH"] = str(Path(main.__file__).parent)
    result = subprocess.run([sys.executable, "-c", "import security_config"], cwd=tmp_path, env=env,
                            capture_output=True, text=True, timeout=15)
    assert result.returncode != 0
    assert "JWT_SECRET_KEY/SECRET_KEY" in result.stderr


@pytest.mark.parametrize("path", ["../backend/main.py", "..\\backend\\main.py", "%2e%2e/backend/main.py", "/etc/passwd", "C:/Windows/win.ini", "api/missing", "bad\x00file"])
def test_spa_rejects_traversal(monkeypatch, tmp_path, path):
    monkeypatch.setattr(main, "FRONTEND_DIR", str(tmp_path))
    (tmp_path / "index.html").write_text("SPA")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(main.serve_spa(path))
    assert exc.value.status_code == 404


def test_spa_serves_contained_files_and_fallback(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "FRONTEND_DIR", str(tmp_path))
    (tmp_path / "index.html").write_text("SPA")
    (tmp_path / "app.js").write_text("safe")
    assert Path(asyncio.run(main.serve_spa("app.js")).path) == tmp_path / "app.js"
    assert Path(asyncio.run(main.serve_spa("cases/123")).path) == tmp_path / "index.html"


@pytest.mark.parametrize("method,url,payload", [
    ("get", "/api/predictions/SEC-FOREIGN", None),
    ("get", "/api/model/shap/SEC-FOREIGN", None),
    ("get", "/api/suspects/SEC-FOREIGN", None),
    ("get", "/api/evidence/export-pdf/SEC-FOREIGN", None),
    ("get", "/api/evidence/chain?case_id=SEC-FOREIGN", None),
    ("get", "/api/review/history?case_id=SEC-FOREIGN", None),
    ("get", "/api/model/mule-network?case_id=SEC-FOREIGN", None),
    ("post", "/api/cases/SEC-FOREIGN/resolve", {}),
    ("post", "/api/cases/SEC-FOREIGN/action", {"type": "close", "reason": "test"}),
    ("post", "/api/review/SEC-FOREIGN", {"action": "override", "reason": "test", "reviewer_id": "spoof"}),
    ("post", "/api/alerts/SEC-ALERT/acknowledge", {}),
    ("post", "/api/alerts", {"case_id": "SEC-FOREIGN", "message": "x", "risk_level": "High", "location": "x", "time_window": "x"}),
    ("post", "/api/transactions", {"case_id": "SEC-FOREIGN", "amount": 1, "from_account": "a", "to_account": "b"}),
    ("post", "/api/field-outcomes", {"case_id": "SEC-FOREIGN", "atm_id": "ATM-CH-001", "outcome": "cash_recovered"}),
    ("post", "/api/evidence/anchor", {"case_id": "SEC-FOREIGN", "evidence_type": "note", "content": "x", "officer_id": "spoof"}),
])
def test_department_boundaries(client, headers, scoped_cases, method, url, payload):
    kwargs = {"headers": headers()}
    if payload is not None:
        kwargs["json"] = payload
    response = getattr(client, method)(url, **kwargs)
    assert response.status_code == 404, response.text


def test_lists_and_dashboard_are_scoped(client, headers, scoped_cases):
    h = headers()
    cases = client.get("/api/cases", headers=h).json()
    assert "SEC-OWN" in {c["case_id"] for c in cases}
    assert not {"SEC-FOREIGN", "SEC-ASSIGNED"} & {c["case_id"] for c in cases}
    for url in ("/api/alerts", "/api/audit", "/api/field-outcomes"):
        assert all(item["case_id"] != "SEC-FOREIGN" for item in client.get(url, headers=h).json())
    queue = client.get("/api/review/queue", headers=h).json()["queue"]
    assert all(c["case_id"] != "SEC-FOREIGN" for c in queue)
    expected = sum(c["status"] == "active" for c in cases)
    assert client.get("/api/dashboard", headers=h).json()["active_cases"] == expected
    assert "SEC-FOREIGN" in {c["case_id"] for c in client.get("/api/cases", headers=headers("admin")).json()}


@pytest.mark.parametrize("role", ["analyst", "bank_officer"])
def test_action_specific_permissions(client, headers, role):
    h = headers(role)
    assert client.post("/api/cases/CASE-001/action", headers=h, json={"type": "close", "reason": "x"}).status_code == 403
    assert client.post("/api/cases/CASE-001/action", headers=h, json={"type": "assign", "assigned_to": "ADM-001"}).status_code == 403
    assert client.post("/api/review/CASE-001", headers=h, json={"action": "override", "reason": "x"}).status_code == 403
    assert client.post("/api/field-outcomes", headers=h, json={"case_id": "CASE-001", "atm_id": "ATM-CH-001", "outcome": "cash_recovered"}).status_code == 403
    assert client.post("/api/cases/CASE-001/action", headers=h, json={"type": "acknowledge"}).status_code == 200


def test_department_is_not_self_editable(client, headers):
    response = client.put("/api/auth/me", headers=headers(), json={"department": "Other Department", "name": "should not update"})
    assert response.status_code == 403
    with TestingSessionLocal() as db:
        assert db.query(User).filter_by(id="INS-001").one().department == "Cybercrime Division"


def test_review_actor_comes_from_authentication(client, headers):
    response = client.post("/api/review/CASE-001", headers=headers(), json={"action": "approve", "reason": "private review", "reviewer_id": "spoofed-admin"})
    assert response.status_code == 200, response.text
    assert response.json()["reviewer_id"] == "INS-001"
    with TestingSessionLocal() as db:
        log = db.query(AuditLog).filter_by(action_type="review").one()
        assert "INS-001" in log.details and "spoofed-admin" not in log.details
        assert db.execute(text("SELECT details FROM audit_logs WHERE action_type='review'")).scalar().startswith("enc:v1:")


class MemoryStore:
    def __init__(self):
        self.blocks = []
    def load(self):
        return self.blocks, None, 0
    def save(self, blocks, root):
        self.blocks = list(blocks)
    def persist_block(self, block):
        return True


def test_evidence_actor_and_encrypted_preview(client, headers, monkeypatch):
    chain = EvidenceChain(MemoryStore())
    monkeypatch.setattr(main, "get_evidence_chain", lambda: chain)
    class FakeBlockchain:
        def add_transaction(self, **kwargs):
            assert kwargs["payload"]["officer_id"] == "INS-001"
            assert kwargs["payload"]["content_preview"].startswith("enc:v1:")
            return kwargs
        def mine_pending(self, **kwargs):
            return {"status": "test"}
    monkeypatch.setattr(main, "get_blockchain", FakeBlockchain)
    response = client.post("/api/evidence/anchor", headers=headers(), json={"case_id": "CASE-001", "evidence_type": "note", "content": "classified evidence", "officer_id": "spoof"})
    assert response.status_code == 200, response.text
    assert chain.evidence_blocks[0]["officer_id"] == "INS-001"
    assert chain.evidence_blocks[0]["content_preview"].startswith("enc:v1:")
    assert chain.get_chain()[0]["content_preview"] == "classified evidence"
    assert chain.verify_evidence(1, "classified evidence")["valid"]


def test_encrypted_runtime_writes_and_legacy_reads(client, headers):
    payload = {"case_id": "CASE-001", "message": "confidential alert", "risk_level": "High", "location": "private ATM", "time_window": "18:00"}
    response = client.post("/api/alerts", headers=headers(), json=payload)
    assert response.status_code == 200
    with TestingSessionLocal() as db:
        raw = db.execute(text("SELECT message, location FROM alerts WHERE alert_id=:id"), {"id": response.json()["alert_id"]}).one()
        assert all(value.startswith("enc:v1:") for value in raw)
        case = db.query(Case).filter_by(case_id="CASE-001").one()
        case.victim_name, case.contact, case.description = "private victim", "private contact", "private description"
        db.add(Suspect(id="SEC-SUS", case_id=case.case_id, name="private suspect", last_seen="private street"))
        db.add(FieldOutcome(case_id=case.case_id, atm_id="ATM-CH-001", outcome="false_positive", officer_id="INS-001", notes="private notes"))
        db.add(TransactionRecord(case_id=case.case_id, from_account="private source", to_account="private target", amount=1, occurred_at=main.datetime.now(), location="private route"))
        db.add(NotificationJob(kind="sms", payload=json.dumps({"message": "private sms"})))
        db.add(IdempotencyKey(key="security-test", method="POST", path="/test", status_code=200, response_body=json.dumps({"secret": "private replay"})))
        db.commit()
        for table, columns in [("cases", "victim_name,contact,description"), ("suspects", "name,last_seen"),
                               ("field_outcomes", "notes"), ("transaction_records", "from_account,to_account,location"),
                               ("notification_jobs", "payload"), ("idempotency_keys", "response_body")]:
            rows = db.execute(text(f"SELECT {columns} FROM {table}")).all()
            assert any(all(value and value.startswith("enc:v1:") for value in row) for row in rows)
        db.execute(text("UPDATE cases SET victim_name='legacy plaintext' WHERE case_id='CASE-001'"))
        db.commit()
        db.expire_all()
        assert case.victim_name == "legacy plaintext"
    alerts = client.get("/api/alerts", headers=headers()).json()
    assert next(a for a in alerts if a["alert_id"] == response.json()["alert_id"])["message"] == payload["message"]
    assert unseal(encrypt("legacy encrypted", SECURITY_CONFIG.encryption_key)) == "legacy encrypted"
    assert unseal(seal("sensitive")) == "sensitive"
    with pytest.raises(Exception):
        unseal("enc:v1:corrupt")


@pytest.mark.parametrize("failure", ["sentinel", "exception"])
def test_model_failure_is_503(client, headers, monkeypatch, failure):
    def broken(*args, **kwargs):
        if failure == "exception":
            raise RuntimeError("missing artifact")
        return {"error": "No models loaded", "risk_score": 50, "confidence": 0}
    monkeypatch.setattr(main, "predict_cashout", broken)
    main._city_prediction_cache.clear()
    for url in ("/api/predictions/CASE-001", "/api/cities/chennai/predictions"):
        response = client.get(url, headers=headers())
        assert response.status_code == 503, response.text
        assert "model unavailable" in response.json()["detail"].lower()


def test_shap_explains_exact_selected_stored_input(client, headers, fake_model, monkeypatch):
    prediction = client.get("/api/predictions/CASE-001", headers=headers())
    assert prediction.status_code == 200, prediction.text
    result = prediction.json()
    selected = result["ranked_locations"][-1]
    assert selected["prediction_features"] in [features for features, _ in fake_model]
    explained = []
    def shap(features, case_id=None):
        explained.append((features, case_id))
        return [{"feature": "amount", "contribution": .1}]
    monkeypatch.setattr(main, "compute_shap_values", shap)
    # Mutating case data after prediction must not change explanation inputs.
    with TestingSessionLocal() as db:
        db.query(Case).filter_by(case_id="CASE-001").one().amount = 999999
        db.commit()
        assert db.execute(text("SELECT reason FROM ranked_locations LIMIT 1")).scalar().startswith("enc:v1:")
    count = len(fake_model)
    response = client.get("/api/model/shap/CASE-001", params={"atm_id": selected["atm_id"]}, headers=headers())
    assert response.status_code == 200, response.text
    explanation = response.json()
    assert explanation["prediction_features"] == selected["prediction_features"] == explained[0][0]
    assert explanation["model_output"] == selected["model_output"]
    assert explanation["risk_score"] == selected["risk_score"]
    assert len(fake_model) == count  # no new prediction, no reconstructed case hash
    assert explained[0][1] != "CASE-001"
    assert "not the stored ensemble" in explanation["explained_model"]
    assert "top_k_accuracy" not in result["model_info"]
    assert all(e["data_source"] == "simulated, not verified" for e in result["evidence"].values())
    assert selected["model_output"]["drift"]["verified"] is False
    assert "heuristic" in selected["model_output"]["drift"]["metric_method"]


def test_city_and_case_prediction_shapes_match(client, headers, fake_model):
    city = client.get("/api/cities/chennai/predictions", headers=headers())
    assert city.status_code == 200, city.text
    city_result = city.json()
    assert city_result["case_id"] == "SYN-CITY-CHENNAI"
    case = client.get("/api/predictions/CASE-001", headers=headers()).json()
    assert set(city_result["primary_location"]) == set(case["primary_location"])
    assert city_result["primary_location"]["prediction_features"] in [features for features, _ in fake_model]


def test_city_cache_restores_exact_snapshot(client, headers, fake_model, monkeypatch):
    city = client.get("/api/cities/chennai/predictions", headers=headers()).json()
    case_id = city["case_id"]
    assert client.get(f"/api/predictions/{case_id}", headers=headers()).status_code == 200
    cached = client.get("/api/cities/chennai/predictions", headers=headers()).json()
    assert cached == city
    seen = []
    def explain(features, case_id=None):
        seen.append(features)
        return []
    monkeypatch.setattr(main, "compute_shap_values", explain)
    explanation = client.get(f"/api/model/shap/{case_id}", params={"atm_id": city["primary_location"]["atm_id"]}, headers=headers())
    assert explanation.status_code == 200, explanation.text
    assert seen == [city["primary_location"]["prediction_features"]]


def test_structured_ensemble_explanation_and_fallback(client, headers, fake_model, monkeypatch):
    result = client.get("/api/predictions/CASE-001", headers=headers()).json()
    selected = result["primary_location"]
    seen = []
    def explain(features, case_id=None):
        seen.append(features)
        return {"available": True, "local_attribution": True, "base_value": .5,
                "probability": .642, "method": "kernel_shap_ensemble", "units": "probability",
                "contributions": [{"feature": "amount", "contribution": .142}]}
    monkeypatch.setattr(main, "explain_cashout", explain)
    response = client.get("/api/model/shap/CASE-001", headers=headers())
    assert response.status_code == 200, response.text
    data = response.json()
    assert seen == [selected["prediction_features"]]
    assert data["base_value"] == .5
    assert data["shap_available"] and data["explained_model"] == "stored ensemble"
    assert data["explanation_probability"] == .642
    monkeypatch.setattr(main, "explain_cashout", lambda *args, **kwargs: {
        "available": False, "local_attribution": False, "method": "global_feature_importance",
        "reason": "No empirical background", "contributions": [{"feature": "amount", "importance": 1}],
    })
    fallback = client.get("/api/model/shap/CASE-001", headers=headers()).json()
    assert not fallback["shap_available"] and fallback["base_value"] is None
    assert fallback["explanation_reason"] == "No empirical background"


def test_explanation_rejects_changed_model_and_mismatched_output(client, headers, fake_model, monkeypatch):
    assert client.get("/api/predictions/CASE-001", headers=headers()).status_code == 200
    monkeypatch.setattr(main, "explain_cashout", lambda *args, **kwargs: {
        "available": True, "local_attribution": True, "probability": .1,
        "contributions": [{"feature": "amount", "contribution": .1}],
    })
    assert client.get("/api/model/shap/CASE-001", headers=headers()).status_code == 409
    monkeypatch.setattr(main, "_current_model_fingerprint", lambda: "changed-artifact")
    assert client.get("/api/model/shap/CASE-001", headers=headers()).status_code == 409
    monkeypatch.setattr(main, "load_models", lambda: (None, None))
    assert client.get("/api/model/shap/CASE-001", headers=headers()).status_code == 503


def test_evidence_block_id_and_stats_are_scoped(client, headers, scoped_cases, monkeypatch):
    chain = EvidenceChain(MemoryStore())
    chain.add_evidence("SEC-FOREIGN", "note", "private", "ADM-001")
    chain.add_evidence("SEC-OWN", "note", "visible", "INS-001")
    monkeypatch.setattr(main, "get_evidence_chain", lambda: chain)
    for url in ("/api/evidence/verify/1?content=private", "/api/evidence/proof/1"):
        assert client.get(url, headers=headers()).status_code == 404
    # Even malformed ciphertext in an inaccessible case must not be decrypted.
    chain.evidence_blocks[0]["content_preview"] = "enc:v1:corrupt"
    response = client.get("/api/evidence/chain", headers=headers())
    assert response.status_code == 200, response.text
    result = response.json()
    assert [b["case_id"] for b in result["blocks"]] == ["SEC-OWN"]
    assert result["stats"]["cases_covered"] == ["SEC-OWN"]
    assert result["blocks"][0]["content_preview"] == "visible"
    assert result["blocks"][0]["stored_content_preview"].startswith("enc:v1:")


def test_idempotency_is_bound_to_actor_and_case(client, headers):
    payload = {"case_id": "CASE-001", "message": "first", "risk_level": "High", "location": "x", "time_window": "x"}
    h = {**headers(), "Idempotency-Key": "shared-security-key"}
    first = client.post("/api/alerts", headers=h, json=payload).json()
    second = client.post("/api/alerts", headers=h, json={**payload, "case_id": "CASE-002"}).json()
    third = client.post("/api/alerts", headers={**headers("admin"), "Idempotency-Key": "shared-security-key"}, json=payload).json()
    assert len({first["alert_id"], second["alert_id"], third["alert_id"]}) == 3
    assert client.post("/api/alerts", headers=h, json=payload).json() == first


def test_untrusted_ciphertext_marker_cannot_bypass_encryption(client, headers):
    value = "enc:v1:not-authenticated-ciphertext"
    payload = {"case_id": "CASE-001", "message": value, "risk_level": "Low", "location": "x", "time_window": "x"}
    response = client.post("/api/alerts", headers=headers(), json=payload)
    assert response.status_code == 200
    with TestingSessionLocal() as db:
        raw = db.execute(text("SELECT message FROM alerts WHERE alert_id=:id"), {"id": response.json()["alert_id"]}).scalar()
        assert raw != value and unseal(raw) == value
    assert any(a["message"] == value for a in client.get("/api/alerts", headers=headers()).json())


def test_test_runtime_is_isolated(tmp_path, isolated_runtime):
    import blockchain
    import database
    import evidence_chain
    assert Path(database.engine.url.database).parent == tmp_path
    assert main.engine is database.engine is isolated_runtime
    assert database.SessionLocal is TestingSessionLocal
    assert TestingSessionLocal.kw["bind"] is isolated_runtime
    assert Path(evidence_chain.CHAIN_FILE).parent == tmp_path / "backend" / "model"
    assert Path(blockchain.CHAIN_FILE).parent == tmp_path / "backend" / "model"
    assert evidence_chain.get_evidence_chain().backend == "db"
    assert not evidence_chain.get_evidence_chain().evidence_blocks
    with TestingSessionLocal() as db:
        assert db.query(Case).count() == 5
        assert db.query(Alert).count() == db.query(AuditLog).count() == 0
    assert not hasattr(main, "_cleanup_thread")


def test_legacy_model_card_does_not_invent_verified_holdouts(tmp_path, monkeypatch):
    artifact_dir = tmp_path / "explicit-model-artifacts"
    artifact_dir.mkdir()
    monkeypatch.setattr(main.ml_engine, "MODEL_DIR", str(artifact_dir))
    (artifact_dir / "validation_report.json").write_text(json.dumps({
        "status": "unavailable", "protocol": "provenance-required synthetic validation",
        "calibration": {"status": "unavailable"},
        "previous_prefix_diagnostic": {"status": "withdrawn"},
    }), encoding="utf-8")
    protocol = main._validation_protocol_block({
        "confusion_matrix": {"tp": 10, "fp": 1, "fn": 4, "tn": 85},
        "split_provenance": None,
    })["validation_protocol"]
    assert protocol["baseline_majority_accuracy"] is None
    assert "unavailable" in protocol["split"]
    assert "provenance" in protocol["split"]
    assert protocol["holdout_revalidation"]["status"] == "unavailable"
    assert protocol["holdout_revalidation"]["calibration"]["status"] == "unavailable"
    assert protocol["holdout_revalidation"]["previous_prefix_diagnostic"]["status"] == "withdrawn"


def test_dashboard_computes_live_aggregates(client, headers):
    response = client.get("/api/dashboard", headers=headers())
    assert response.status_code == 200
    data = response.json()
    assert data["active_cases"] == 3
    # Fixture has no resolved cases, predictions, or transaction records:
    # aggregates are real zeros, and lead time honestly uncomputable.
    assert data["prevented_fraud"] == 0
    assert data["mules_flagged"] == 0
    assert data["avg_lead_time"] == "Not measured"
    assert data["resolved_case_amount"] == 0
    assert "case records" in data["metrics_note"]


def test_seed_pre_encryption_is_normalized_at_runtime(monkeypatch):
    import seed
    original = seed._enc
    originals = []
    def record(value):
        if value:
            originals.append(value)
        return original(value)
    monkeypatch.setattr(seed, "_enc", record)
    seed.seed_data(force=True)
    with TestingSessionLocal() as db:
        cases = db.query(Case).all()
        assert len(cases) > 5
        for case in cases:
            assert case.victim_name in originals
            assert case.contact in originals
            assert case.description in originals
        raw = db.execute(text("SELECT victim_name FROM cases LIMIT 1")).scalar()
        # One authenticated storage layer, not ciphertext returned as PII.
        from encryption import decrypt
        assert raw.startswith("enc:v1:")
        assert decrypt(raw[7:], SECURITY_CONFIG.encryption_key) in originals


@pytest.mark.parametrize("form", ["plaintext", "legacy", "marked", "double"])
def test_plaintext_and_pre_encrypted_orm_inputs_read_as_plaintext(form):
    from encryption import encrypt_field, decrypt
    plaintext = "Private legacy victim"
    key = SECURITY_CONFIG.encryption_key
    inputs = {
        "plaintext": plaintext,
        "legacy": encrypt(plaintext, key),
        "marked": encrypt_field(plaintext, key),
        "double": "enc:v1:" + encrypt(encrypt(plaintext, key), key),
    }
    with TestingSessionLocal() as db:
        case = db.query(Case).filter_by(case_id="CASE-001").one()
        case.victim_name = inputs[form]
        db.commit()
        raw = db.execute(text("SELECT victim_name FROM cases WHERE case_id='CASE-001'")).scalar()
        assert decrypt(raw[7:], key) == plaintext
        db.expire_all()
        assert case.victim_name == plaintext
        # Old double-encrypted rows written before normalization remain readable.
        db.execute(text("UPDATE cases SET victim_name=:value WHERE case_id='CASE-001'"), {"value": inputs[form]})
        db.commit()
        db.expire_all()
        assert case.victim_name == plaintext


def test_artifact_metadata_endpoints_work_from_unrelated_cwd(client, headers, tmp_path, monkeypatch):
    report_path = Path(main.ml_engine.MODEL_DIR) / "validation_report.json"
    stats_path = Path(main.ml_engine.STATS_PATH)
    report_bytes, stats_bytes = report_path.read_bytes(), stats_path.read_bytes()
    report, stats = json.loads(report_bytes), json.loads(stats_bytes)
    unrelated = tmp_path / "unrelated-runner-cwd"
    unrelated.mkdir()
    monkeypatch.chdir(unrelated)
    assert not (unrelated / "model").exists()

    card = client.get("/api/model/card", headers=headers())
    distribution = client.get("/api/model/distribution", headers=headers())
    drift = client.get("/api/model/drift", headers=headers())
    assert card.status_code == distribution.status_code == drift.status_code == 200
    loaded_report = card.json()["validation_protocol"]["holdout_revalidation"]
    assert loaded_report["protocol"] == report["protocol"]
    assert loaded_report["slices"] == report["slices"]
    assert distribution.json()["feature_stats"] == stats["feature_stats"]
    assert distribution.json()["total_samples"] == stats.get("total_samples", 0)
    assert drift.json()["total_features"] == len(stats["feature_stats"])
    assert {row["feature"] for row in drift.json()["features"]} == set(stats["feature_stats"])
    assert drift.json()["verified"] is False
    assert report_path.read_bytes() == report_bytes and stats_path.read_bytes() == stats_bytes
    assert not (unrelated / "model").exists()


def test_stats_endpoints_use_explicit_temporary_path(client, headers, tmp_path, monkeypatch):
    artifact_dir = tmp_path / "stats-artifacts"
    artifact_dir.mkdir()
    stats_path = artifact_dir / "custom-stats.json"
    stats = {"feature_stats": {"amount": {"mean": 25, "std": 5}}, "total_samples": 7}
    stats_path.write_text(json.dumps(stats), encoding="utf-8")
    monkeypatch.setattr(main.ml_engine, "STATS_PATH", str(stats_path))
    monkeypatch.setattr(main, "get_metadata", lambda: {"model_version": "explicit-stats-test"})
    unrelated = tmp_path / "empty-cwd"
    unrelated.mkdir()
    monkeypatch.chdir(unrelated)
    distribution = client.get("/api/model/distribution", headers=headers())
    drift = client.get("/api/model/drift", headers=headers())
    assert distribution.status_code == drift.status_code == 200
    assert distribution.json() == stats
    assert drift.json()["total_features"] == 1
    assert drift.json()["features"][0]["feature"] == "amount"
    assert drift.json()["features"][0]["train_mean"] == 25


def test_missing_atms_reject_transaction_without_mutation(client, headers, monkeypatch):
    from models_db import AtmLocation, Prediction, RankedLocation
    tracked_models = (TransactionRecord, AuditLog, Alert, Prediction, RankedLocation, NotificationJob, IdempotencyKey)
    with TestingSessionLocal() as db:
        case = db.query(Case).filter_by(case_id="CASE-001").one()
        case.amount, case.linked_accounts, case.current_risk, case.last_updated = 4242, 1, "Medium", "Before request"
        db.query(AtmLocation).delete()
        db.commit()
        before_case = (case.amount, case.linked_accounts, case.current_risk, case.status, case.last_updated)
        before_counts = [db.query(model).count() for model in tracked_models]
    def unexpected_prediction(*args, **kwargs):
        pytest.fail("ATM preflight must reject before invoking the prediction pipeline")
    monkeypatch.setattr(main, "get_predictions_for_case", unexpected_prediction)
    response = client.post("/api/transactions", headers={**headers(), "Idempotency-Key": "missing-atms-no-mutation"}, json={
        "case_id": "CASE-001", "amount": 1000, "from_account": "source", "to_account": "target",
    })
    assert response.status_code == 503, response.text
    assert "no ATM reference data" in response.json()["detail"]
    with TestingSessionLocal() as db:
        case = db.query(Case).filter_by(case_id="CASE-001").one()
        assert (case.amount, case.linked_accounts, case.current_risk, case.status, case.last_updated) == before_case
        assert [db.query(model).count() for model in tracked_models] == before_counts


def test_spa_rejects_symlink_escape(monkeypatch, tmp_path):
    root = tmp_path / "dist"
    root.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("private")
    try:
        (root / "asset.txt").symlink_to(secret)
    except OSError:
        pytest.skip("Windows symlink privilege unavailable")
    monkeypatch.setattr(main, "FRONTEND_DIR", str(root))
    with pytest.raises(HTTPException):
        asyncio.run(main.serve_spa("asset.txt"))
