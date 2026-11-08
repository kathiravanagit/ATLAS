"""GET /api/campaigns: a query, not a model; district-scoped in both directions.

A campaign is a destination account appearing in >= min_cases different
cases. Runs as GROUP BY to_account with Python dedupe (accounts are encrypted
at rest, so SQL grouping would split the same token). A district-scoped
officer only contributes their district's cases and only sees those case ids.
"""
from datetime import datetime, timezone

from database import SessionLocal
from models_db import TransactionRecord
from tests.conftest import auth_header

NOW = datetime.now(timezone.utc)


def _seed():
    with SessionLocal() as db:
        # Shared token across two cases (a planted ring).
        db.add(TransactionRecord(case_id="CASE-001", from_account="SYN-SRC-001",
                                 to_account="SYN-MULE-007", amount=10000,
                                 occurred_at=NOW, source="synthetic-fixture"))
        db.add(TransactionRecord(case_id="CASE-003", from_account="SYN-SRC-002",
                                 to_account="SYN-MULE-007", amount=20000,
                                 occurred_at=NOW, source="synthetic-fixture"))
        # Single-case account (below the min_cases floor).
        db.add(TransactionRecord(case_id="CASE-001", from_account="SYN-SRC-003",
                                 to_account="SYN-MULE-010", amount=30000,
                                 occurred_at=NOW, source="synthetic-fixture"))
        # Second shared token.
        db.add(TransactionRecord(case_id="CASE-001", from_account="SYN-SRC-004",
                                 to_account="SYN-MULE-011", amount=5000,
                                 occurred_at=NOW, source="synthetic-fixture"))
        db.add(TransactionRecord(case_id="CASE-005", from_account="SYN-SRC-005",
                                 to_account="SYN-MULE-011", amount=6000,
                                 occurred_at=NOW, source="synthetic-fixture"))
        db.commit()


def test_campaigns_returns_multi_case_accounts(client, admin_token):
    _seed()
    resp = client.get("/api/campaigns?min_cases=2", headers=auth_header(admin_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["label"].startswith("synthetic — destination reuse")
    tokens = {c["account_token"]: c for c in body["campaigns"]}
    assert set(tokens) == {"SYN-MULE-007", "SYN-MULE-011"}
    assert tokens["SYN-MULE-007"]["case_count"] == 2
    assert tokens["SYN-MULE-007"]["case_ids"] == ["CASE-001", "CASE-003"]
    # Sorted by case_count desc then token.
    assert body["campaigns"][0]["case_count"] >= body["campaigns"][1]["case_count"]


def test_campaigns_respects_min_cases(client, admin_token):
    _seed()
    resp = client.get("/api/campaigns?min_cases=5", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json()["campaigns"] == []


def test_campaigns_district_scoped_on_cases_and_ids(client, district_inspector_token):
    _seed()
    resp = client.get("/api/campaigns?min_cases=2", headers=auth_header(district_inspector_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Puducherry cases: CASE-001 and CASE-005.
    tokens = {c["account_token"]: c for c in body["campaigns"]}
    # SYN-MULE-007 spans CASE-001 (Puducherry) + CASE-003 (Mumbai): only
    # CASE-001 is visible, so the campaign drops below the floor.
    assert "SYN-MULE-007" not in tokens
    assert tokens["SYN-MULE-011"]["case_ids"] == ["CASE-001", "CASE-005"]
    for campaign in body["campaigns"]:
        for case_id in campaign["case_ids"]:
            assert case_id in ("CASE-001", "CASE-005"), case_id


def test_campaigns_requires_auth(client):
    assert client.get("/api/campaigns").status_code == 401
