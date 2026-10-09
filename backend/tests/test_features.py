"""Tests for evidence chain, mule network, and NLP triage features."""
import os
import pytest
import hashlib
from tests.conftest import auth_header, TestingSessionLocal
from models_db import Alert, NotificationJob

def get_csrf_header(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    if resp.status_code == 200:
        return {"X-CSRF-Token": resp.json()["csrf_token"]}
    return {}


# ─── Evidence Chain ──────────────────────────────────────────────────────────

class TestEvidenceChain:
    """Comprehensive tests for the evidence chain (SHA-256 + Merkle tree)."""

    def _anchor(self, client, token, case_id="CASE-001", content=None, evidence_type="transaction_log"):
        content = content or f"evidence-{os.urandom(8).hex()}"
        csrf = get_csrf_header(client, token)
        resp = client.post("/api/evidence/anchor", json={
            "case_id": case_id, "evidence_type": evidence_type,
            "content": content, "officer_id": "INS-001"
        }, headers={**auth_header(token), **csrf})
        return resp, content

    def test_anchor_returns_required_fields(self, client, admin_token):
        resp, content = self._anchor(client, admin_token)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "anchored"
        assert "block_id" in data
        assert "evidence_hash" in data
        assert "block_hash" in data
        assert "merkle_root" in data
        assert data["persisted"] is True

    def test_anchor_hash_is_sha256(self, client, admin_token):
        content = f"hash-test-{os.urandom(8).hex()}"
        resp, _ = self._anchor(client, admin_token, content=content)
        assert resp.status_code == 200
        returned_hash = resp.json()["evidence_hash"]
        expected_hash = hashlib.sha256(content.encode()).hexdigest()
        assert returned_hash == expected_hash

    def test_verify_valid_content(self, client, admin_token):
        content = f"verify-valid-{os.urandom(8).hex()}"
        resp, _ = self._anchor(client, admin_token, content=content)
        block_id = resp.json()["block_id"]
        resp2 = client.get(f"/api/evidence/verify/{block_id}",
                           params={"content": content},
                           headers=auth_header(admin_token))
        assert resp2.status_code == 200
        assert resp2.json()["valid"] is True

    def test_verify_tampered_content_fails(self, client, admin_token):
        content = f"verify-tamper-{os.urandom(8).hex()}"
        resp, _ = self._anchor(client, admin_token, content=content)
        block_id = resp.json()["block_id"]
        resp2 = client.get(f"/api/evidence/verify/{block_id}",
                           params={"content": content + "TAMPERED"},
                           headers=auth_header(admin_token))
        assert resp2.status_code == 200
        assert resp2.json()["valid"] is False

    def test_verify_nonexistent_block_returns_404(self, client, admin_token):
        resp = client.get("/api/evidence/verify/999999",
                          params={"content": "whatever"},
                          headers=auth_header(admin_token))
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Evidence block not found"

    def test_merkle_proof_returns_valid_structure(self, client, admin_token):
        content = f"merkle-test-{os.urandom(8).hex()}"
        resp, _ = self._anchor(client, admin_token, content=content)
        block_id = resp.json()["block_id"]
        resp2 = client.get(f"/api/evidence/proof/{block_id}",
                           headers=auth_header(admin_token))
        assert resp2.status_code == 200
        data = resp2.json()
        assert "block_id" in data
        assert "proof" in data
        assert "merkle_root" in data
        assert "verified" in data
        assert isinstance(data["proof"], list)
        assert data["verified"] is True

    def test_chain_list_returns_blocks_and_stats(self, client, admin_token):
        self._anchor(client, admin_token, content="chain-list-1")
        self._anchor(client, admin_token, content="chain-list-2")
        resp = client.get("/api/evidence/chain", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "blocks" in data
        assert "stats" in data
        assert len(data["blocks"]) >= 2
        assert "total_blocks" in data["stats"]
        assert "merkle_root" in data["stats"]

    def test_chain_filter_by_case_id(self, client, admin_token):
        self._anchor(client, admin_token, case_id="CASE-001", content="case1-evidence")
        self._anchor(client, admin_token, case_id="CASE-002", content="case2-evidence")
        resp = client.get("/api/evidence/chain",
                          params={"case_id": "CASE-001"},
                          headers=auth_header(admin_token))
        assert resp.status_code == 200
        blocks = resp.json()["blocks"]
        assert all(b["case_id"] == "CASE-001" for b in blocks)

    def test_export_pdf_returns_valid_pdf(self, client, admin_token):
        self._anchor(client, admin_token, case_id="CASE-001", content="pdf-evidence-1")
        self._anchor(client, admin_token, case_id="CASE-001", content="pdf-evidence-2")
        resp = client.get("/api/evidence/export-pdf/CASE-001",
                          headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
        assert b"CASE-001" in resp.content
        assert 'attachment; filename="case-diary-CASE-001.pdf"' == resp.headers["content-disposition"]

    def test_export_pdf_404_without_evidence(self, client, admin_token):
        resp = client.get("/api/evidence/export-pdf/CASE-NOPE",
                          headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_export_pdf_requires_auth(self, client):
        assert client.get("/api/evidence/export-pdf/CASE-001").status_code in (401, 403)

    def test_corrupt_payload_rows_skipped_with_counts(self, tmp_path):
        import json
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from database import Base
        from models_db import EvidenceBlockRow
        from evidence_chain import EvidenceChain, DbEvidenceStore
        eng = create_engine(f"sqlite:///{tmp_path}/chain.db")
        Base.metadata.create_all(bind=eng)
        mk = sessionmaker(bind=eng)
        db = mk()
        db.add(EvidenceBlockRow(block_id=1, case_id="C", block_hash="h",
                               prev_hash="0", payload="not-json{{{"))
        db.add(EvidenceBlockRow(block_id=2, case_id="C", block_hash="h2",
                               prev_hash="h", payload=json.dumps({"block_id": 2, "hash": "abc"})))
        db.commit()
        db.close()
        chain = EvidenceChain(store=DbEvidenceStore(session_factory=mk))
        assert chain.corrupt_blocks == 1
        assert chain.degraded is True
        assert len(chain.evidence_blocks) == 1

    def test_verify_tampered_case_binding_returns_tampered(self, client, admin_token):
        import evidence_chain as ec
        resp, content = self._anchor(client, admin_token, case_id="CASE-001",
                                     content="tamper-binding-check")
        assert resp.status_code == 200
        bid = resp.json()["block_id"]
        block = next(b for b in ec._evidence_chain.evidence_blocks if b["block_id"] == bid)
        block["case_id"] = "CASE-NOPE-DOES-NOT-EXIST"
        try:
            r = client.get(f"/api/evidence/verify/{bid}", params={"content": content},
                           headers=auth_header(admin_token))
            assert r.status_code == 200
            assert r.json()["valid"] is False
            assert r.json()["integrity"] == "tampered"
        finally:
            block["case_id"] = "CASE-001"

    def test_chain_stats_expose_integrity_counts(self, client, admin_token):
        self._anchor(client, admin_token, case_id="CASE-001", content="stats-check")
        resp = client.get("/api/evidence/chain", headers=auth_header(admin_token))
        assert resp.status_code == 200
        stats = resp.json()["stats"]
        assert "stored_blocks" in stats
        assert "corrupt_blocks_skipped" in stats
        assert "degraded" in stats

    def test_multiple_anchors_chain_integrity(self, client, admin_token):
        contents = [f"chain-integrity-{i}-{os.urandom(4).hex()}" for i in range(5)]
        block_ids = []
        for c in contents:
            resp, _ = self._anchor(client, admin_token, content=c)
            assert resp.status_code == 200
            block_ids.append(resp.json()["block_id"])

        # Each block should verify with its original content
        for bid, content in zip(block_ids, contents):
            resp = client.get(f"/api/evidence/verify/{bid}",
                              params={"content": content},
                              headers=auth_header(admin_token))
            assert resp.json()["valid"] is True

        # All blocks should be in the chain
        resp = client.get("/api/evidence/chain", headers=auth_header(admin_token))
        assert len(resp.json()["blocks"]) >= 5

    def test_bank_officer_cannot_anchor_evidence(self, client, bank_officer_token):
        # Generic write permission does not authorize evidence custody.
        resp, _ = self._anchor(client, bank_officer_token)
        assert resp.status_code == 403

    def test_evidence_different_types(self, client, admin_token):
        for ev_type in ["transaction_log", "call_recording", "screenshot", "bank_statement"]:
            resp, _ = self._anchor(client, admin_token, evidence_type=ev_type)
            assert resp.status_code == 200
            assert resp.json()["status"] == "anchored"


# ─── Mule Network ───────────────────────────────────────────────────────────

class TestMuleNetwork:
    """Tests for the graph-based mule account detection system."""

    def test_returns_required_fields(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data
        assert "clusters" in data
        assert "total_nodes" in data
        assert "total_edges" in data
        assert "graph_density" in data
        assert "suspicious_accounts" in data

    def test_nodes_have_required_properties(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        assert resp.status_code == 200
        nodes = resp.json()["nodes"]
        assert len(nodes) > 0
        for node in nodes:
            assert "id" in node
            assert "label" in node
            assert "risk" in node
            assert "case" in node
            assert "balance" in node

    def test_edges_have_required_properties(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        assert resp.status_code == 200
        edges = resp.json()["edges"]
        assert len(edges) > 0
        for edge in edges:
            assert "source" in edge
            assert "target" in edge
            assert "weight" in edge
            assert "amount" in edge

    def test_clusters_have_required_properties(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        assert resp.status_code == 200
        clusters = resp.json()["clusters"]
        for cluster in clusters:
            assert "cluster_id" in cluster
            assert "size" in cluster
            assert "accounts" in cluster
            assert "total_flow" in cluster
            assert "risk_level" in cluster
            assert cluster["risk_level"] in ("Low", "Medium", "High")

    def test_filter_by_case_id(self, client, admin_token):
        resp = client.get("/api/model/mule-network",
                          params={"case_id": "CASE-001"},
                          headers=auth_header(admin_token))
        assert resp.status_code == 200
        nodes = resp.json()["nodes"]
        # All nodes should belong to CASE-001
        assert all(n["case"] == "CASE-001" for n in nodes)

    def test_suspicious_accounts_are_list(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        assert resp.status_code == 200
        suspicious = resp.json()["suspicious_accounts"]
        assert isinstance(suspicious, list)

    def test_graph_density_range(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        assert resp.status_code == 200
        density = resp.json()["graph_density"]
        assert 0 <= density <= 1

    def test_total_counts_match_data(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        data = resp.json()
        assert data["total_nodes"] == len(data["nodes"])
        assert data["total_edges"] == len(data["edges"])

    def test_nodes_get_cluster_assignment(self, client, admin_token):
        resp = client.get("/api/model/mule-network", headers=auth_header(admin_token))
        data = resp.json()
        cluster_ids = {c["cluster_id"] for c in data["clusters"]}
        for node in data["nodes"]:
            if node.get("cluster") is not None:
                assert node["cluster"] in cluster_ids


# ─── NLP Triage ─────────────────────────────────────────────────────────────

class TestNlpTriage:
    """Tests for the NLP complaint triage (keyword-based classification)."""

    def _triage(self, client, token, text):
        return client.post("/api/nlp/triage", json={"text": text},
                           headers=auth_header(token))

    def test_vishing_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "I received a phone call asking for my OTP and I shared it. Rs.45000 was debited.")
        assert resp.status_code == 200
        data = resp.json()
        assert data["category"] == "Vishing / Social Engineering"
        assert data["keyword_match_score"] > 0.6

    def test_card_cloning_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "My credit card was cloned and used at an ATM. Rs.80000 was withdrawn.")
        assert resp.status_code == 200
        assert resp.json()["category"] == "Card Cloning / Skimming"

    def test_investment_fraud_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "I invested Rs.500000 in a crypto trading app on Telegram. The app shows zero balance now.")
        assert resp.status_code == 200
        assert resp.json()["category"] == "Investment Fraud"

    def test_upi_fraud_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Someone used my UPI PIN to transfer Rs.35000 to an unknown account.")
        assert resp.status_code == 200
        assert resp.json()["category"] == "UPI Fraud"

    def test_advance_fee_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "I received a message saying I won a lottery of Rs.1000000. After paying processing fee of Rs.25000 they stopped responding.")
        assert resp.status_code == 200
        assert resp.json()["category"] == "Advance Fee Fraud"

    def test_phishing_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "I clicked a link in an email and logged into a fake website. My password was stolen.")
        assert resp.status_code == 200
        assert resp.json()["category"] == "Phishing"

    def test_identity_theft_classification(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Someone used my Aadhaar card and PAN card to open fake accounts. My identity was stolen.")
        assert resp.status_code == 200
        assert resp.json()["category"] == "Identity Theft"

    def test_unrecognized_complaint_returns_general(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "I want to report something suspicious in my neighborhood.")
        assert resp.status_code == 200
        data = resp.json()
        assert data["category"] == "General Cyber Fraud"
        assert data["keyword_match_score"] == 0.55

    def test_entity_extraction_amount(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Rs.1,50,000 was transferred from my SBI account via UPI.")
        data = resp.json()
        amounts = [e for e in data["entities"] if e["type"] == "AMOUNT"]
        assert len(amounts) >= 1
        assert "1,50,000" in amounts[0]["value"] or "150000" in amounts[0]["value"]

    def test_entity_extraction_bank(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "My HDFC bank account was compromised via phishing.")
        data = resp.json()
        banks = [e for e in data["entities"] if e["type"] == "BANK"]
        assert len(banks) >= 1
        assert any("HDFC" in b["value"] for b in banks)

    def test_entity_extraction_location(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "The ATM fraud happened in Chennai. Rs.50000 was stolen.")
        data = resp.json()
        locations = [e for e in data["entities"] if e["type"] == "LOCATION"]
        assert len(locations) >= 1
        assert any("Chennai" in l["value"] for l in locations)

    def test_entity_extraction_platform(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "I was scammed on Telegram. Someone asked me to invest via a Telegram group.")
        data = resp.json()
        platforms = [e for e in data["entities"] if e["type"] == "PLATFORM"]
        assert len(platforms) >= 1
        assert any("Telegram" in p["value"] for p in platforms)

    def test_priority_critical_high_amount(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Rs.250000 was stolen from my account via UPI fraud.")
        assert resp.json()["priority"] == "Critical"

    def test_priority_high_medium_amount(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Rs.75000 was stolen from my account via card cloning.")
        assert resp.json()["priority"] == "High"

    def test_priority_medium_amount(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Rs.15000 was stolen from my account via phishing.")
        assert resp.json()["priority"] == "Medium"

    def test_priority_low_amount(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Rs.5000 was deducted via fake QR code.")
        assert resp.json()["priority"] == "Low"

    def test_suggested_action_present(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "My UPI PIN was used to transfer Rs.20000.")
        data = resp.json()
        assert "suggested_action" in data
        assert len(data["suggested_action"]) > 10

    def test_keyword_match_score_range(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "OTP was shared and Rs.45000 was debited via phone call.")
        score = resp.json()["keyword_match_score"]
        assert 0.0 <= score <= 1.0

    def test_confidence_note_present(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "UPI fraud via QR code Rs.10000.")
        data = resp.json()
        assert "confidence_note" in data
        assert "keyword" in data["confidence_note"].lower()

    def test_no_amount_returns_unknown(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "My card was cloned at an ATM.")
        assert resp.json()["estimated_loss"] == "Unknown"

    def test_all_seven_categories_exist(self, client, admin_token):
        test_cases = [
            ("Vishing / Social Engineering", "called me asking for OTP sharing"),
            ("Card Cloning / Skimming", "credit card cloned at ATM skimming"),
            ("Investment Fraud", "invested in crypto trading app returns"),
            ("UPI Fraud", "UPI PIN gpay phonepe transfer"),
            ("Advance Fee Fraud", "won lottery prize processing fee winner"),
            ("Phishing", "clicked email link website login password"),
            ("Identity Theft", "aadhaar pan card identity documents fake account"),
        ]
        for expected_category, text in test_cases:
            resp = self._triage(client, admin_token, text)
            assert resp.status_code == 200, f"Failed for {expected_category}"
            assert resp.json()["category"] == expected_category, \
                f"Expected '{expected_category}', got '{resp.json()['category']}'"

    def test_amount_formats_rupee_symbol_and_plain_rs(self, client, admin_token):
        for text, expected in [
            ("I lost \u20b945,000 in a UPI scam using PhonePe.", "\u20b945,000"),
            ("Rs 12,500 taken from my account via UPI.", "Rs 12,500"),
            ("Transferred INR 80000 to a crypto investment app.", "INR 80000"),
        ]:
            resp = self._triage(client, admin_token, text)
            assert resp.status_code == 200
            data = resp.json()
            assert data["estimated_loss"] == expected, f"{text} -> {data['estimated_loss']}"
            assert any(e["type"] == "AMOUNT" for e in data["entities"])

    def test_upi_id_entity_extracted(self, client, admin_token):
        resp = self._triage(client, admin_token,
            "Paid Rs.5000 to fraudster@ybl over a fake call asking for OTP.")
        data = resp.json()
        assert any(e["type"] == "UPI_ID" and e["value"] == "fraudster@ybl"
                   for e in data["entities"])

    def test_non_cybercrime_text_routed_out_of_scope(self, client, admin_token):
        for text in ["Weather in Mumbai today", "My neighbour's dog keeps barking"]:
            resp = self._triage(client, admin_token, text)
            assert resp.status_code == 200
            assert resp.json()["category"] == "Non-Cybercrime"

    def test_triage_rejects_empty_and_oversize_text(self, client, admin_token):
        from tests.conftest import auth_header as _ah
        for bad in ["", "x" * 5001]:
            resp = client.post("/api/nlp/triage", json={"text": bad},
                               headers=_ah(admin_token))
            assert resp.status_code == 422

class TestPredictionAlerts:
    """HIGH (>70) predictions raise toast + SMS every time; Alert rows dedupe."""

    def test_high_city_prediction_creates_alert_and_sms_job(self, client, admin_token):
        resp = client.get("/api/cities/puducherry/predictions",
                          headers=auth_header(admin_token))
        assert resp.status_code == 200
        primary = resp.json().get("primary_location") or {}
        assert primary.get("risk_score", 0) > 70
        db = TestingSessionLocal()
        try:
            alert = db.query(Alert).filter(
                Alert.case_id == "SYN-CITY-PUDUCHERRY",
                Alert.acknowledged == False).first()
            assert alert is not None
            assert alert.risk_level == "High"
            job = db.query(NotificationJob).filter(
                NotificationJob.kind == "sms").order_by(NotificationJob.id.desc()).first()
            assert job is not None
            assert "SYN-CITY-PUDUCHERRY" in (job.payload or "")
        finally:
            db.close()

    def test_repeat_prediction_sms_every_time_but_single_open_alert(self, client, admin_token):
        import main as main_module
        main_module._city_prediction_cache.pop("puducherry", None)
        db = TestingSessionLocal()
        try:
            jobs_before = db.query(NotificationJob).filter(NotificationJob.kind == "sms").count()
        finally:
            db.close()
        for _ in range(2):
            main_module._city_prediction_cache.pop("puducherry", None)
            resp = client.get("/api/cities/puducherry/predictions",
                              headers=auth_header(admin_token))
            assert resp.status_code == 200
        db = TestingSessionLocal()
        try:
            alerts = db.query(Alert).filter(
                Alert.case_id == "SYN-CITY-PUDUCHERRY",
                Alert.acknowledged == False).all()
            assert len(alerts) == 1
            jobs_after = db.query(NotificationJob).filter(NotificationJob.kind == "sms").count()
            assert jobs_after >= jobs_before + 2
        finally:
            db.close()
class TestSmsDispatcher:
    """SMS provider swap: GSM sanitize, fast2sms gating, offline-safe."""

    def test_sanitize_gsm_ascii(self):
        import sms_client
        out = sms_client.sanitize_gsm("Risk \u20b9""25000 \u2014 window 18:00")
        assert out == "Risk Rs.25000 - window 18:00"
        out.encode("ascii")

    def test_fast2sms_missing_key_returns_false(self, monkeypatch):
        import sms_client
        monkeypatch.setattr(sms_client, "FAST2SMS_API_KEY", "")
        assert sms_client._send_fast2sms("hello", "+919876543210") is False

    def test_fast2sms_success_strips_plus(self, monkeypatch):
        import sms_client
        calls = {}
        class FakeResp:
            def json(self):
                return {"return": True, "request_id": "req-1"}
        def fake_post(url, headers=None, data=None, timeout=None):
            calls.update(url=url, headers=headers, data=data)
            return FakeResp()
        monkeypatch.setattr(sms_client, "FAST2SMS_API_KEY", "test-key")
        monkeypatch.setattr(sms_client.httpx, "post", fake_post)
        assert sms_client._send_fast2sms("hello", "+919876543210") is True
        assert calls["data"]["numbers"] == "919876543210"
        assert calls["headers"]["authorization"] == "test-key"

    def test_fast2sms_rejection_returns_false(self, monkeypatch):
        import sms_client
        class FakeResp:
            def json(self):
                return {"return": False, "message": "invalid key"}
        monkeypatch.setattr(sms_client, "FAST2SMS_API_KEY", "bad-key")
        monkeypatch.setattr(sms_client.httpx, "post", lambda *a, **k: FakeResp())
        assert sms_client._send_fast2sms("hello", "919876543210") is False

    def test_dispatcher_rejects_unknown_provider(self, monkeypatch):
        import sms_client
        monkeypatch.setattr(sms_client, "PROVIDER", "carrier-pigeon")
        assert sms_client.send_sms_alert("hello", "919876543210") is False

    def test_dispatcher_defaults_to_fast2sms(self, monkeypatch):
        import sms_client
        monkeypatch.setattr(sms_client, "PROVIDER", "fast2sms")
        monkeypatch.setattr(sms_client, "FAST2SMS_API_KEY", "")
        assert sms_client.send_sms_alert("hello", "919876543210") is False