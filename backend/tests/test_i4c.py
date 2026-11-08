"""GET /api/i4c/summary: national counts only, no case detail.

District-scoped officers are denied outright. The response must contain no
case_id anywhere — that is the whole point of the aggregation view.
"""
import json

from database import SessionLocal
from models_db import Alert
from tests.conftest import auth_header


def _seed_alert():
    with SessionLocal() as db:
        db.add(Alert(
            alert_id="ALT-I4C-1", case_id="CASE-001", message="probe",
            risk_level="High", location="PNY-001", district="Puducherry",
            time_window="17:00-20:00", timestamp="10:00:00", acknowledged=False))
        db.commit()


def test_i4c_summary_counts_by_district_for_national(client, admin_token):
    _seed_alert()
    resp = client.get("/api/i4c/summary", headers=auth_header(admin_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["label"] == "synthetic — national aggregation"
    by_district = {d["district"]: d for d in body["districts"]}
    assert by_district["Puducherry"]["cases_total"] == 2  # CASE-001, CASE-005
    assert by_district["Puducherry"]["alerts_total"] == 1
    assert by_district["Puducherry"]["alerts_pending"] == 1
    assert by_district["Chennai"]["cases_total"] == 1


def test_i4c_summary_has_no_case_detail(client, admin_token):
    _seed_alert()
    resp = client.get("/api/i4c/summary", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert "case_id" not in json.dumps(resp.json())
    assert "CASE-00" not in json.dumps(resp.json())


def test_i4c_summary_denies_district_scoped_officer(client, district_inspector_token):
    resp = client.get("/api/i4c/summary", headers=auth_header(district_inspector_token))
    assert resp.status_code == 403, resp.text


def test_i4c_summary_requires_auth(client):
    assert client.get("/api/i4c/summary").status_code == 401
