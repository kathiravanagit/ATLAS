"""District RBAC: an account can be scoped to one jurisdiction.

Reads were already scoped by department, but accounts carried no district, so
half of `role x district` could not be enforced: every officer saw and could act
on every district's shared pool. These tests pin the district half on the write
paths that touch a case, and check that a refusal leaves no trace.

The fixture accounts are deliberate: `INS-002` is a Puducherry inspector and the
seeded cases span four districts, so both branches exist in every test.
"""
import pytest

from database import SessionLocal
from models_db import Alert, Case
from tests.conftest import auth_header


def _csrf(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


@pytest.fixture
def district_headers(client, district_inspector_token):
    return {**auth_header(district_inspector_token),
            **_csrf(client, district_inspector_token)}


def _stored_case(case_id):
    with SessionLocal() as db:
        return db.query(Case).filter(Case.case_id == case_id).first()


def _alerts_for(case_id):
    with SessionLocal() as db:
        return db.query(Alert).filter(Alert.case_id == case_id).all()


# ── Reads ────────────────────────────────────────────────────────────────────

def test_scoped_officer_only_lists_cases_in_their_district(client, district_inspector_token):
    resp = client.get("/api/cases", headers=auth_header(district_inspector_token))
    assert resp.status_code == 200, resp.text
    ids = {row["case_id"] for row in resp.json()}
    # CASE-001 and CASE-005 are Puducherry; the other three are not.
    assert ids == {"CASE-001", "CASE-005"}, ids


def test_scoped_officer_cannot_read_another_districts_prediction(client, district_inspector_token):
    resp = client.get("/api/predictions/CASE-002",
                      headers=auth_header(district_inspector_token))
    assert resp.status_code == 404


def test_admin_still_reads_every_district(client, admin_token):
    resp = client.get("/api/predictions/CASE-002", headers=auth_header(admin_token))
    assert resp.status_code == 200


# ── Writes: refused, and nothing changes ─────────────────────────────────────

def test_cross_district_close_is_refused_without_side_effect(client, district_headers):
    before = _stored_case("CASE-002").status
    resp = client.post("/api/cases/CASE-002/resolve", headers=district_headers)
    assert resp.status_code == 404
    assert _stored_case("CASE-002").status == before


def test_cross_district_case_action_is_refused_without_side_effect(client, district_headers):
    before = _stored_case("CASE-002").status
    resp = client.post("/api/cases/CASE-002/action",
                       json={"type": "close", "reason": "jurisdiction probe attempt"},
                       headers=district_headers)
    assert resp.status_code == 404
    assert _stored_case("CASE-002").status == before


def test_cross_district_alert_creation_is_refused_without_side_effect(client, district_headers):
    before = len(_alerts_for("CASE-002"))
    resp = client.post("/api/alerts", json={
        "case_id": "CASE-002", "message": "probe", "risk_level": "Low",
        "location": "probe", "time_window": "10:00-12:00",
    }, headers=district_headers)
    assert resp.status_code == 404
    assert len(_alerts_for("CASE-002")) == before


def test_cross_district_acknowledge_and_notify_are_refused(client, district_headers, admin_token):
    created = client.post("/api/alerts", json={
        "case_id": "CASE-002", "message": "probe", "risk_level": "Low",
        "location": "probe", "time_window": "10:00-12:00",
    }, headers={**auth_header(admin_token), **_csrf(client, admin_token)})
    assert created.status_code == 200, created.text
    alert_id = created.json()["alert_id"]

    ack = client.post(f"/api/alerts/{alert_id}/acknowledge", headers=district_headers)
    assert ack.status_code == 404
    notify = client.post(f"/api/alerts/{alert_id}/notify", headers=district_headers)
    assert notify.status_code == 404

    with SessionLocal() as db:
        alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
        assert alert.acknowledged is False


def test_cross_district_complaint_is_refused_before_anything_is_written(client, district_headers):
    body = {
        "external_ref": "NCRP-DISTRICT-0001",
        "district": "Chennai",
        "category": "UPI fraud",
        "amount": 42000,
        "incident_at": "2026-09-01T17:20:00Z",
        "description": "filed from the wrong jurisdiction",
    }
    resp = client.post("/api/complaints", json=body, headers=district_headers)
    assert resp.status_code == 403, resp.text
    with SessionLocal() as db:
        assert db.query(Case).filter(Case.external_ref == body["external_ref"]).first() is None


def test_replay_reference_cannot_read_another_districts_case(client, admin_token, district_headers):
    """`external_ref` replay used to bypass visibility entirely.

    The lookup is by reference, not by an id the caller was authorised for, so
    an officer could post another district's reference and receive that case and
    its prediction. Filing outside the officer's district is refused before the
    lookup; a reference that exists elsewhere but is filed inside the officer's
    district reaches the lookup and must be refused there.
    """
    body = {
        "external_ref": "NCRP-DISTRICT-0002",
        "district": "Chennai",
        "category": "UPI fraud",
        "amount": 51000,
        "incident_at": "2026-09-02T18:10:00Z",
        "description": "filed by a national account",
    }
    created = client.post("/api/complaints", json=body,
                          headers={**auth_header(admin_token), **_csrf(client, admin_token)})
    assert created.status_code == 201, created.text

    # Same reference, but the district is the officer's own, so the request is
    # not refused up front and the replay lookup is what has to stop it.
    replay = client.post("/api/complaints", json={**body, "district": "Puducherry"},
                         headers=district_headers)
    assert replay.status_code == 404
    assert "prediction" not in replay.json()
    assert "case_id" not in replay.json()

    # And filing into another district with its reference is refused before any
    # lookup happens.
    cross = client.post("/api/complaints", json=body, headers=district_headers)
    assert cross.status_code == 403
    assert "prediction" not in cross.json()


# ── The same officer is not simply denied everything ─────────────────────────

def test_own_district_close_succeeds(client, district_headers):
    resp = client.post("/api/cases/CASE-001/resolve", headers=district_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "resolved"
    assert _stored_case("CASE-001").status == "resolved"


def test_own_district_complaint_is_accepted(client, district_headers):
    body = {
        "external_ref": "NCRP-DISTRICT-0003",
        "district": "Puducherry",
        "category": "Card cloning",
        "amount": 33000,
        "incident_at": "2026-09-03T19:00:00Z",
        "description": "filed inside the officer's district",
    }
    resp = client.post("/api/complaints", json=body, headers=district_headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["district"] == "Puducherry"
    stored = _stored_case(resp.json()["case_id"])
    assert stored.department == "Cybercrime Division"
