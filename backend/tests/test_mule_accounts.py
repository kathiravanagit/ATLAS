"""GET /api/cases/{id}/mule-accounts: deterministic token list for the case UI.

The block-request button must send a token that exists on the case instead of
inventing one client-side. This endpoint is read-only: distinct to_account
values from transaction_records, ordered ascending by token so "first linked
account" is stable across clients and clicks.
"""
from datetime import datetime, timezone

from database import SessionLocal
from models_db import TransactionRecord
from tests.conftest import auth_header


def _seed_case_accounts():
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        db.add(TransactionRecord(
            case_id="CASE-001", from_account="SYN-SRC-001",
            to_account="SYN-MULE-009", amount=12000,
            occurred_at=now, source="synthetic-fixture"))
        db.add(TransactionRecord(
            case_id="CASE-001", from_account="SYN-SRC-002",
            to_account="SYN-MULE-003", amount=48000,
            occurred_at=now, source="synthetic-fixture"))
        db.add(TransactionRecord(
            case_id="CASE-001", from_account="SYN-SRC-003",
            to_account="SYN-MULE-003", amount=500,
            occurred_at=now, source="synthetic-fixture"))
        db.commit()


def test_mule_accounts_ordered_by_token(client, admin_token):
    _seed_case_accounts()
    resp = client.get("/api/cases/CASE-001/mule-accounts", headers=auth_header(admin_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["case_id"] == "CASE-001"
    assert [a["to_account"] for a in body["accounts"]] == ["SYN-MULE-003", "SYN-MULE-009"]
    assert body["accounts"][0]["max_amount"] == 48000


def test_mule_accounts_empty_when_no_transactions(client, admin_token):
    resp = client.get("/api/cases/CASE-005/mule-accounts", headers=auth_header(admin_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["accounts"] == []


def test_mule_accounts_cross_district_is_404(client, district_inspector_token):
    _seed_case_accounts()
    resp = client.get("/api/cases/CASE-002/mule-accounts", headers=auth_header(district_inspector_token))
    assert resp.status_code == 404, resp.text


def test_mule_accounts_requires_auth(client):
    assert client.get("/api/cases/CASE-001/mule-accounts").status_code == 401
