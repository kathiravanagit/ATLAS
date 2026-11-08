"""Outcome capture at resolve: the validation-plan labels are stored and returned.

POST /api/field-outcomes accepts was_cashout_in_predicted_zone,
block_successful and actual_location (the labels the validation plan needs).
Without them they store as NULL (unknown) instead of inventing a default.
"""
from tests.conftest import auth_header


def _csrf(client, token):
    resp = client.get("/api/csrf-token", headers=auth_header(token))
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


def _hdrs(client, token):
    return {**auth_header(token), **_csrf(client, token)}


def test_field_outcome_stores_labels(client, admin_token):
    resp = client.post(
        "/api/field-outcomes",
        json={
            "case_id": "CASE-001", "atm_id": "PNY-001",
            "outcome": "cash_recovered", "notes": "seen at ATM",
            "was_cashout_in_predicted_zone": True,
            "block_successful": False,
            "actual_location": "PNY-001, White Town Main Road",
        },
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "recorded"

    listed = client.get("/api/field-outcomes", headers=auth_header(admin_token))
    assert listed.status_code == 200
    mine = [o for o in listed.json() if o["case_id"] == "CASE-001" and o["outcome"] == "cash_recovered"]
    assert mine, listed.json()
    last = mine[0]
    assert last["was_cashout_in_predicted_zone"] is True
    assert last["block_successful"] is False
    assert last["actual_location"] == "PNY-001, White Town Main Road"


def test_field_outcome_labels_default_to_unknown(client, admin_token):
    resp = client.post(
        "/api/field-outcomes",
        json={"case_id": "CASE-002", "atm_id": "TN-001", "outcome": "apprehended"},
        headers=_hdrs(client, admin_token),
    )
    assert resp.status_code == 200, resp.text
    listed = client.get("/api/field-outcomes", headers=auth_header(admin_token))
    mine = [o for o in listed.json() if o["case_id"] == "CASE-002" and o["outcome"] == "apprehended"]
    assert mine
    assert mine[0]["was_cashout_in_predicted_zone"] is None
    assert mine[0]["block_successful"] is None
    assert mine[0]["actual_location"] is None
