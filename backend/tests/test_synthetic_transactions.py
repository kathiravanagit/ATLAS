import os
import sys
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base  # noqa: E402
from main import ensure_synthetic_transactions, stable_int  # noqa: E402
from models_db import AtmLocation, Case, TransactionRecord  # noqa: E402


def test_stable_fixture_seed_is_process_independent():
    assert stable_int("SYN-CITY-PUDUCHERRY") == stable_int("SYN-CITY-PUDUCHERRY")
    assert stable_int("SYN-CITY-PUDUCHERRY") != stable_int("SYN-CITY-CHENNAI")


def test_prediction_fixture_records_are_persisted_and_reused(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'synthetic.db'}")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    session.add(Case(case_id="SYN-TEST-001", crime_type="Synthetic", amount=0))
    atms = [AtmLocation(atm_id="PNY-001", name="Synthetic ATM", latitude=11.9, longitude=79.8, area="Synthetic")]
    session.add_all(atms)
    session.commit()

    first = ensure_synthetic_transactions(session, "SYN-TEST-001", "puducherry", atms)
    second = ensure_synthetic_transactions(session, "SYN-TEST-001", "puducherry", atms)

    assert len(first) == 12
    assert len(second) == 12
    assert session.query(TransactionRecord).count() == 12
    assert all(record.source == "synthetic-fixture" for record in second)
    assert all(isinstance(record.occurred_at, datetime) for record in second)


@pytest.mark.skipif(
    not os.getenv("POSTGRES_TEST_DATABASE_URL"),
    reason="Set POSTGRES_TEST_DATABASE_URL to run PostgreSQL/PostGIS integration fixtures",
)
def test_postgresql_postgis_integration_fixture():
    from sqlalchemy import text

    engine = create_engine(os.environ["POSTGRES_TEST_DATABASE_URL"])
    with engine.connect() as connection:
        postgis = connection.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')")
        ).scalar()
    assert postgis, "PostGIS extension is required for the integration fixture"
