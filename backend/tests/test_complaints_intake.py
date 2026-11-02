"""Complaint intake: the entry point the prototype never had.

Before this, a case could only arrive by seeding, and every prediction took a
case_id that already existed. These tests pin the contract a real NCRP-style
filer depends on: the district decides the registry, a retried reference does
not file twice, and the synthetic cash-out records are anchored to the complaint
rather than to a fixed fixture timestamp.
"""
from datetime import datetime, timedelta, timezone

import pytest

from database import SessionLocal
from models_db import AtmLocation, Case, TransactionRecord


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def _csrf(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


@pytest.fixture
def intake_headers(client, analyst_token):
    return {**auth_header(analyst_token), **_csrf(client, analyst_token)}


def complaint(**overrides):
    body = {
        "external_ref": "NCRP-2026-000123",
        "district": "Chennai",
        "category": "UPI fraud",
        "amount": 48000,
        "incident_at": "2026-09-01T17:20:00Z",
        "description": "Unauthorised UPI transfer to an unknown beneficiary",
        "victim_name": "Test Victim",
        "contact": "+91-000",
    }
    body.update(overrides)
    return body


def _stored_cases(case_id=None):
    """Cases that arrived through intake, excluding the seeded demo fixtures."""
    with SessionLocal() as db:
        query = db.query(Case).filter(Case.external_ref.isnot(None))
        if case_id:
            query = query.filter(Case.case_id == case_id)
        return [case for case in query.all()]


# ── The happy path ───────────────────────────────────────────────────────────

def test_intake_creates_one_case_twelve_records_and_a_prediction(client, intake_headers):
    resp = client.post("/api/complaints", json=complaint(), headers=intake_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["status"] == "created"
    assert body["case_id"].startswith("CC-2026-")
    assert body["district"] == "Chennai"
    assert body["city_id"] == "chennai"
    assert body["external_ref"] == "NCRP-2026-000123"
    assert body["record_count"] == 12

    prediction = body["prediction"]
    assert prediction["primary_location"]["atm_id"]
    assert prediction["ranked_locations"], "intake must rank locations in the same request"
    assert prediction["observed_window"]["records"] == 12

    cases = _stored_cases(body["case_id"])
    assert len(cases) == 1
    # Filed as "UPI fraud"; stored under the registry's own spelling so the
    # case table's category drill-down links it with seeded cases.
    assert cases[0].crime_type == "UPI Fraud"
    assert cases[0].amount == 48000
    with SessionLocal() as db:
        records = db.query(TransactionRecord).filter(
            TransactionRecord.case_id == body["case_id"]).all()
        assert len(records) == 12


def test_intake_response_carries_no_predicted_time_window(client, intake_headers):
    """The old field mapped the request's own records back into a clock bucket."""
    resp = client.post("/api/complaints", json=complaint(), headers=intake_headers)
    assert resp.status_code == 201
    assert "expected_window" not in resp.text
    assert "observed_window" in resp.json()["prediction"]


def test_intake_case_is_owned_by_the_filing_department(client, intake_headers):
    body = client.post("/api/complaints", json=complaint(), headers=intake_headers).json()
    case = _stored_cases(body["case_id"])[0]
    # Analyst seeds belong to the Intelligence Unit; visibility_filter scopes on it.
    assert case.department == "Intelligence Unit"
    assert case.assigned_to


def test_new_case_is_visible_to_its_filer(client, intake_headers):
    body = client.post("/api/complaints", json=complaint(), headers=intake_headers).json()
    listed = client.get("/api/cases", headers=intake_headers).json()
    ids = [row["case_id"] for row in listed]
    assert body["case_id"] in ids


# ── District is authoritative ────────────────────────────────────────────────

def test_district_decides_the_registry_and_prose_cannot_move_it(client, intake_headers):
    with SessionLocal() as db:
        db.add_all([
            AtmLocation(atm_id="CHN-001", name="T Nagar", latitude=13.0405, longitude=80.2342, area="T Nagar"),
            AtmLocation(atm_id="MUM-001", name="Andheri", latitude=19.1197, longitude=72.8468, area="Andheri"),
        ])
        db.commit()

    body = client.post("/api/complaints", json=complaint(
        district="Mumbai City",
        description="Victim says the men met them near Chennai and travelled to Mumbai",
    ), headers=intake_headers).json()

    assert body["district"] == "Mumbai City"
    assert body["city_id"] == "mumbai"
    # ATM ids are prefixed by their city registry, so this also proves which
    # registry was scored rather than only what was stored.
    assert all(loc["atm_id"].startswith("MUM-") for loc in body["prediction"]["ranked_locations"])


def test_unknown_district_is_rejected_and_writes_nothing(client, intake_headers):
    before = len(_stored_cases())
    resp = client.post("/api/complaints", json=complaint(district="Atlantis"), headers=intake_headers)
    assert resp.status_code == 422
    assert "known_districts" in resp.json()["detail"]
    assert len(_stored_cases()) == before


def test_district_is_required(client, intake_headers):
    payload = complaint()
    payload.pop("district")
    resp = client.post("/api/complaints", json=payload, headers=intake_headers)
    assert resp.status_code == 422


# ── Replay ───────────────────────────────────────────────────────────────────

def test_same_external_ref_replays_instead_of_filing_twice(client, intake_headers):
    first = client.post("/api/complaints", json=complaint(), headers=intake_headers)
    second = client.post("/api/complaints", json=complaint(), headers=intake_headers)

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["status"] == "replayed"
    assert second.json()["case_id"] == first.json()["case_id"]
    assert len(_stored_cases()) == 1
    with SessionLocal() as db:
        records = db.query(TransactionRecord).filter(
            TransactionRecord.case_id == first.json()["case_id"]).all()
        assert len(records) == 12, "a replay must not reseed the fixture"


def test_same_external_ref_with_different_content_conflicts(client, intake_headers):
    client.post("/api/complaints", json=complaint(), headers=intake_headers)
    resp = client.post("/api/complaints", json=complaint(amount=99000), headers=intake_headers)

    assert resp.status_code == 409
    assert resp.json()["detail"]["fields"] == ["amount"]
    assert len(_stored_cases()) == 1


def test_repeated_external_ref_ignores_case_only_differences(client, intake_headers):
    """A retry may resend the same complaint with different optional prose."""
    first = client.post("/api/complaints", json=complaint(), headers=intake_headers)
    second = client.post("/api/complaints", json=complaint(
        description="same complaint, resent", victim_name="", contact="",
    ), headers=intake_headers)

    assert second.status_code == 200
    assert second.json()["case_id"] == first.json()["case_id"]


def test_category_casing_is_one_case_for_replay_and_the_registry(client, intake_headers):
    """Filers type "UPI fraud"; the registry's pill reads "UPI Fraud".

    Storing the raw casing split one case out of the drill-down, and a retry
    with different casing would then look like a conflict.
    """
    first = client.post("/api/complaints", json=complaint(category="UPI fraud"), headers=intake_headers)
    second = client.post("/api/complaints", json=complaint(category="UPI  FRAUD"), headers=intake_headers)

    assert first.status_code == 201
    assert second.status_code == 200, second.text
    assert _stored_cases(first.json()["case_id"])[0].crime_type == "UPI Fraud"


def test_unknown_category_is_kept_as_filed(client, intake_headers):
    body = client.post("/api/complaints", json=complaint(category="Deepfake Extortion"), headers=intake_headers)
    assert body.status_code == 201
    assert _stored_cases(body.json()["case_id"])[0].crime_type == "Deepfake Extortion"


# ── Records are anchored to the complaint ────────────────────────────────────

def test_records_follow_the_complaint_time_not_the_fixture_base(client, intake_headers):
    body = client.post("/api/complaints", json=complaint(
        incident_at="2026-09-01T17:20:00Z",
    ), headers=intake_headers).json()

    with SessionLocal() as db:
        records = db.query(TransactionRecord).filter(
            TransactionRecord.case_id == body["case_id"]).all()
    stamps = sorted(record.occurred_at for record in records)
    anchor = datetime(2026, 9, 1, 17, 20)

    assert stamps[0] >= anchor, "cash-out cannot precede the complaint that reports it"
    assert stamps[-1] - anchor <= timedelta(hours=18)
    # The fixed base used by seeded fixtures would put records at 17:00-10:00
    # regardless of the complaint clock. These must move with it.
    late = client.post("/api/complaints", json=complaint(
        external_ref="NCRP-2026-000999",
        incident_at="2026-09-01T03:05:00Z",
    ), headers=intake_headers).json()
    with SessionLocal() as db:
        late_records = db.query(TransactionRecord).filter(
            TransactionRecord.case_id == late["case_id"]).all()
    assert min(record.occurred_at.hour for record in late_records) < 12


def test_observed_window_describes_the_stored_records(client, intake_headers):
    body = client.post("/api/complaints", json=complaint(), headers=intake_headers).json()
    observed = body["prediction"]["observed_window"]

    assert observed["records"] == 12
    assert observed["start"] and observed["end"]
    assert observed["hours"], "the filter needs the hours that actually appear"
    assert all(0 <= hour <= 23 for hour in observed["hours"])
    assert observed["label"].endswith("UTC")


# ── Validation and authorization ─────────────────────────────────────────────

@pytest.mark.parametrize("field,value", [
    ("amount", 0),
    ("amount", -5),
    ("category", ""),
    ("category", "   "),
    ("external_ref", ""),
    ("external_ref", "   "),
])
def test_invalid_fields_are_rejected(client, intake_headers, field, value):
    before = len(_stored_cases())
    resp = client.post("/api/complaints", json=complaint(**{field: value}), headers=intake_headers)
    assert resp.status_code == 422
    assert len(_stored_cases()) == before


def test_future_incident_is_rejected(client, intake_headers):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    resp = client.post("/api/complaints", json=complaint(incident_at=future), headers=intake_headers)
    assert resp.status_code == 422


def test_intake_requires_csrf(client, analyst_token):
    resp = client.post("/api/complaints", json=complaint(),
                       headers=auth_header(analyst_token))
    assert resp.status_code == 403
    assert "CSRF" in resp.json()["detail"]


def test_intake_requires_a_token(client):
    resp = client.post("/api/complaints", json=complaint())
    assert resp.status_code in (401, 403)
    assert len(_stored_cases()) == 0
