"""District is a first-class jurisdiction key, not a description substring.

Before this, a case's city was inferred by searching its free-text description
for a city name and defaulting to Puducherry. That made geography unreachable
for filtering or scoping, and it broke outright when descriptions are encrypted
(the default in non-demo deployments).
"""
import pytest

from city_data import CITIES
from main import app, district_to_city
from models_db import Case


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def db_session():
    from database import SessionLocal
    with SessionLocal() as db:
        yield db


# ── City/district mapping ────────────────────────────────────────────────────

def test_every_city_declares_a_district():
    for city_id, data in CITIES.items():
        assert data.get("district"), f"{city_id} has no district"


def test_districts_are_unique_so_lookup_is_unambiguous():
    districts = [data["district"] for data in CITIES.values()]
    assert len(districts) == len(set(districts))


def test_district_resolves_back_to_its_city():
    for city_id, data in CITIES.items():
        resolved = district_to_city(data["district"])
        assert resolved is not None
        assert resolved[0] == city_id


def test_district_lookup_is_case_insensitive_and_trimmed():
    city_id, data = district_to_city("  puducherry  ")
    assert city_id == "puducherry"
    assert data["district"] == "Puducherry"


@pytest.mark.parametrize("district", ["", None, "Atlantis", "Unknown District"])
def test_unknown_district_returns_none(district):
    assert district_to_city(district) is None


# ── Case registry ────────────────────────────────────────────────────────────

def test_cases_response_includes_district(client, admin_token):
    resp = client.get("/api/cases", headers=auth_header(admin_token))
    assert resp.status_code == 200
    rows = resp.json()
    assert rows
    assert all("district" in row for row in rows)
    assert {row["district"] for row in rows} >= {"Puducherry", "Chennai"}


def test_cases_filter_by_district(client, admin_token):
    resp = client.get("/api/cases?district=Chennai", headers=auth_header(admin_token))
    assert resp.status_code == 200
    rows = resp.json()
    assert [row["case_id"] for row in rows] == ["CASE-002"]
    assert all(row["district"] == "Chennai" for row in rows)


def test_cases_filter_by_district_is_case_insensitive(client, admin_token):
    lower = client.get("/api/cases?district=chennai", headers=auth_header(admin_token)).json()
    upper = client.get("/api/cases?district=CHENNAI", headers=auth_header(admin_token)).json()
    assert lower == upper
    assert len(lower) == 1


def test_cases_filter_by_crime_type(client, admin_token):
    resp = client.get("/api/cases?crime_type=Identity%20Theft", headers=auth_header(admin_token))
    rows = resp.json()
    assert [row["case_id"] for row in rows] == ["CASE-005"]


def test_crime_and_district_filters_combine(client, admin_token):
    resp = client.get(
        "/api/cases?crime_type=UPI%20Fraud&district=Puducherry",
        headers=auth_header(admin_token))
    assert [row["case_id"] for row in resp.json()] == ["CASE-001"]

    # Same crime type in another district must not match.
    resp = client.get(
        "/api/cases?crime_type=UPI%20Fraud&district=Chennai",
        headers=auth_header(admin_token))
    assert resp.json() == []


def test_district_filter_does_not_widen_on_wildcards(client, admin_token):
    # "%" is a literal district name here, never a match-everything wildcard.
    resp = client.get("/api/cases?district=%25", headers=auth_header(admin_token))
    assert resp.json() == []


def test_unknown_district_returns_no_cases(client, admin_token):
    resp = client.get("/api/cases?district=Atlantis", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


# ── Alert path carries district ──────────────────────────────────────────────

def _csrf(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


def test_created_alert_inherits_case_district(client, analyst_token):
    headers = {**auth_header(analyst_token), **_csrf(client, analyst_token)}
    resp = client.post("/api/alerts", json={
        "case_id": "CASE-002", "message": "district carry test",
        "risk_level": "Medium", "location": "CHN-001", "time_window": "18:00-20:00",
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["alert"]["district"] == "Chennai"


def test_client_cannot_file_an_alert_into_another_district(client, analyst_token):
    headers = {**auth_header(analyst_token), **_csrf(client, analyst_token)}
    resp = client.post("/api/alerts", json={
        "case_id": "CASE-002", "message": "spoofed district",
        "risk_level": "Medium", "location": "CHN-001", "time_window": "18:00-20:00",
        "district": "Mumbai City",
    }, headers=headers)
    assert resp.status_code == 200
    # Derived from the case, never from the request body.
    assert resp.json()["alert"]["district"] == "Chennai"


def test_listed_alerts_include_district(client, admin_token):
    rows = client.get("/api/alerts", headers=auth_header(admin_token)).json()
    assert all("district" in row for row in rows)


# ── Prediction routing ───────────────────────────────────────────────────────

def test_prediction_prefers_district_over_description(db_session):
    """A case whose description names another city must follow its district."""
    from main import get_predictions_for_case

    case = Case(
        case_id="CASE-DISTRICT-ROUTE", crime_type="UPI Fraud", amount=10000,
        linked_accounts=1, current_risk="Low", status="active",
        victim_name="Test", contact="+91-000", district="Chennai",
        # Description claims Puducherry; district must win.
        description="Complaint filed in Puducherry",
    )
    db_session.add(case)
    db_session.commit()

    result = get_predictions_for_case("CASE-DISTRICT-ROUTE", db_session)
    assert result["city"] == "Chennai"
    assert result["ranked_locations"]


def test_prediction_description_fallback_still_works_without_district(db_session):
    """Rows predating the column keep resolving from their description."""
    from main import get_predictions_for_case

    case = Case(
        case_id="CASE-DISTRICT-FALLBACK", crime_type="UPI Fraud", amount=9000,
        linked_accounts=1, current_risk="Low", status="active",
        victim_name="Test", contact="+91-001", district="",
        description="Complaint filed in Chennai",
    )
    db_session.add(case)
    db_session.commit()

    result = get_predictions_for_case("CASE-DISTRICT-FALLBACK", db_session)
    assert result["city"] == "Chennai"


def test_prediction_defaults_to_puducherry_when_nothing_resolves(db_session):
    from main import get_predictions_for_case

    case = Case(
        case_id="CASE-DISTRICT-BLANK", crime_type="UPI Fraud", amount=9000,
        linked_accounts=1, current_risk="Low", status="active",
        victim_name="Test", contact="+91-002", district="",
        description="No city named here",
    )
    db_session.add(case)
    db_session.commit()

    result = get_predictions_for_case("CASE-DISTRICT-BLANK", db_session)
    assert result["city"] == "Puducherry"


# ── Pipeline-raised alerts ───────────────────────────────────────────────────
# Most alerts in a seeded database come from the prediction pipeline, not from
# POST /api/alerts, so the pipeline path needs its own coverage.

def test_pipeline_alert_carries_case_district(db_session):
    from main import _raise_high_risk_alert

    case = Case(
        case_id="CASE-DISTRICT-PIPELINE", crime_type="UPI Fraud", amount=90000,
        linked_accounts=2, current_risk="High", status="active",
        victim_name="Test", contact="+91-003", district="Mumbai City",
        description="No city named here",
    )
    db_session.add(case)
    db_session.commit()

    alert = _raise_high_risk_alert(db_session, case.case_id, {
        "atm_id": "MUM-001",
        "location_name": "Test Junction",
        "risk_score": 99.0,
        "expected_window": "18:00-20:00",
        "risk_area": "priority",
    }, city="Mumbai")
    db_session.commit()

    assert alert is not None
    assert alert.district == "Mumbai City"


def test_pipeline_alert_district_follows_the_case_not_the_city_argument(db_session):
    """The `city` label is cosmetic; jurisdiction is read from the case row."""
    from main import _raise_high_risk_alert

    case = Case(
        case_id="CASE-DISTRICT-PIPELINE-2", crime_type="UPI Fraud", amount=90000,
        linked_accounts=2, current_risk="High", status="active",
        victim_name="Test", contact="+91-004", district="Kolkata",
        description="No city named here",
    )
    db_session.add(case)
    db_session.commit()

    alert = _raise_high_risk_alert(db_session, case.case_id, {
        "atm_id": "KOL-002",
        "location_name": "Test Junction",
        "risk_score": 99.0,
        "expected_window": "18:00-20:00",
        "risk_area": "priority",
    }, city="Puducherry")
    db_session.commit()

    assert alert.district == "Kolkata"
