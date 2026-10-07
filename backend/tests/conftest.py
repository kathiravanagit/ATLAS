"""Isolated API fixtures: no project database, ledger, or external dispatch."""
import os
from pathlib import Path
import shutil
import sys
import tempfile

# Import-time application side effects must also be isolated, before fixtures
# are available. Per-test databases below belong to pytest tmp_path.
BACKEND_DIR = Path(__file__).resolve().parents[1]
_ORIGINAL_CWD = Path.cwd()
_BOOTSTRAP = tempfile.TemporaryDirectory(prefix="atlas-pytest-bootstrap-")
_BOOTSTRAP_DIR = Path(_BOOTSTRAP.name)
os.environ.update({
    "TESTING": "1", "DEMO_MODE": "false", "REGISTRATION_ENABLED": "true",
    "DATABASE_URL": "sqlite:///" + (_BOOTSTRAP_DIR / "bootstrap.db").as_posix(),
    "CHAIN_BACKEND": "db",
    "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1",
    "NUMEXPR_NUM_THREADS": "1",
    "JWT_SECRET_KEY": "", "SECRET_KEY": "isolated-tests-access-secret-at-least-32-chars",
    "REFRESH_SECRET_KEY": "isolated-tests-refresh-secret-at-least-32-chars",
    "ENCRYPTION_KEY": bytes(range(32)).hex(),
    "COOKIE_SECURE": "false",
})
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import close_all_sessions
import database
import models_db
# The DB evidence singleton loads during import, before main creates its schema.
# This schema is exclusively the explicit temporary bootstrap URL above.
database.Base.metadata.create_all(bind=database.engine)
import auth
import blockchain
import evidence_chain
import main
import ml_engine
from database import Base, get_db
from models_db import Case, AtmLocation, User

app = main.app
_BOOTSTRAP_ENGINE = database.engine
# Keep this shared factory stable for tests importing it at collection time.
TestingSessionLocal = database.SessionLocal
engine = _BOOTSTRAP_ENGINE


def override_get_db():
    with TestingSessionLocal() as db:
        yield db


app.dependency_overrides[get_db] = override_get_db


def pytest_sessionfinish(session, exitstatus):
    close_all_sessions()
    _BOOTSTRAP_ENGINE.dispose()
    os.chdir(_ORIGINAL_CWD)
    _BOOTSTRAP.cleanup()


DEMO_CASES = [
    {"case_id": "CASE-001", "crime_type": "UPI Fraud", "amount": 150000, "linked_accounts": 4,
     "current_risk": "High", "status": "active", "victim_name": "Ravi Kumar",
     "contact": "+91-9876543210", "description": "UPI fraud via phishing link"},
    {"case_id": "CASE-002", "crime_type": "Card Cloning", "amount": 85000, "linked_accounts": 3,
     "current_risk": "Medium", "status": "active", "victim_name": "Sneha Patel",
     "contact": "+91-9876543211", "description": "ATM card skimming incident"},
    {"case_id": "CASE-003", "crime_type": "Investment Fraud", "amount": 500000, "linked_accounts": 6,
     "current_risk": "High", "status": "investigating", "victim_name": "Arun Mehta",
     "contact": "+91-9876543212", "description": "Crypto investment scam"},
    {"case_id": "CASE-004", "crime_type": "Vishing", "amount": 35000, "linked_accounts": 2,
     "current_risk": "Low", "status": "active", "victim_name": "Deepa Nair",
     "contact": "+91-9876543213", "description": "Phone call OTP fraud"},
    {"case_id": "CASE-005", "crime_type": "Identity Theft", "amount": 220000, "linked_accounts": 5,
     "current_risk": "High", "status": "investigating", "victim_name": "Mohammed Ali",
     "contact": "+91-9876543214", "description": "Aadhaar-based identity fraud"},
]

@pytest.fixture(scope="session")
def demo_user_rows():
    # Hash real passwords once, not four expensive bcrypt hashes per test.
    return [{**{key: value for key, value in row.items() if key != "password"},
             "hashed_password": auth.pwd_context.hash(row["password"])}
            for row in auth.DEMO_USER_SEEDS]


@pytest.fixture(autouse=True)
def isolated_runtime(tmp_path, monkeypatch, request):
    work_dir = tmp_path / "backend"
    work_dir.mkdir()
    monkeypatch.chdir(work_dir)
    model_dir = work_dir / "model"
    model_dir.mkdir()
    # Artifact metadata and estimators are read-only via ml_engine's absolute
    # paths. This model directory is only a safe fallback ledger location.
    if request.node.name == "test_demo_credentials_not_in_frontend_bundle":
        # Preserve that test's real build inspection despite the isolated CWD.
        # Copy bundles read-only into its expected sibling frontend layout.
        assets = BACKEND_DIR.parent / "frontend" / "dist" / "assets"
        for source in assets.glob("*.js"):
            destination = tmp_path / "frontend" / "dist" / "assets" / source.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)

    url = "sqlite:///" + (tmp_path / "app.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url)
    test_engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(test_engine, "connect")
    def enforce_foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    TestingSessionLocal.configure(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    monkeypatch.setattr(database, "engine", test_engine)
    monkeypatch.setattr(database, "DATABASE_URL", url)
    monkeypatch.setattr(main, "engine", test_engine)
    if "seed" in sys.modules:
        monkeypatch.setattr(sys.modules["seed"], "engine", test_engine)
    monkeypatch.setattr(evidence_chain, "CHAIN_FILE", str(model_dir / "evidence_chain.json"))
    monkeypatch.setattr(blockchain, "CHAIN_FILE", str(model_dir / "atlas_chain.json"))
    monkeypatch.setattr(evidence_chain, "_evidence_chain", evidence_chain.EvidenceChain())
    monkeypatch.setattr(blockchain, "_primary", None)
    monkeypatch.setattr(blockchain, "_network", None)
    app.dependency_overrides[get_db] = override_get_db
    main._city_prediction_cache.clear()
    main._model_fingerprint_cache.clear()
    main.REVIEW_QUEUE.clear()
    main.manager.active.clear()
    main.manager.users.clear()
    auth._csrf_tokens.clear()
    auth._ws_tickets.clear()
    auth.rate_limiter._attempts.clear()
    main.limiter._storage.reset()
    original_loader = ml_engine.load_models

    def single_thread_models():
        models = original_loader()
        for model in models:
            if model is not None and hasattr(model, "n_jobs"):
                model.n_jobs = 1
        return models

    # Exercise the real estimators, without machine-sized inference thread pools.
    monkeypatch.setattr(ml_engine, "load_models", single_thread_models)
    monkeypatch.setattr(main, "load_models", single_thread_models)
    try:
        yield test_engine
    finally:
        close_all_sessions()
        TestingSessionLocal.configure(bind=_BOOTSTRAP_ENGINE)
        test_engine.dispose()
        main._city_prediction_cache.clear()
        main._model_fingerprint_cache.clear()
        main.REVIEW_QUEUE.clear()
        auth._csrf_tokens.clear()
        auth._ws_tickets.clear()
        # Delete only the database we created, never glob project artifacts.
        for suffix in ("", "-wal", "-shm"):
            (tmp_path / ("app.db" + suffix)).unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def setup_db(isolated_runtime, demo_user_rows):
    Base.metadata.create_all(bind=isolated_runtime)
    with TestingSessionLocal() as db:
        db.add_all(User(**row) for row in demo_user_rows)
        db.add_all(Case(**row) for row in DEMO_CASES)
        db.add_all([
            AtmLocation(atm_id="ATM-CH-001", name="T. Nagar ATM", latitude=13.0418, longitude=80.2341, area="T. Nagar"),
            AtmLocation(atm_id="ATM-CH-002", name="Anna Nagar ATM", latitude=13.0850, longitude=80.2101, area="Anna Nagar"),
            AtmLocation(atm_id="ATM-CH-003", name="Velachery ATM", latitude=12.9815, longitude=80.2180, area="Velachery"),
        ])
        db.commit()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login_token(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def admin_token(client):
    return _login_token(client, "admin@atlas.gov", "admin123")


@pytest.fixture
def inspector_token(client):
    return _login_token(client, "inspector@atlas.gov", "inspector123")


@pytest.fixture
def analyst_token(client):
    return _login_token(client, "analyst@atlas.gov", "analyst123")


@pytest.fixture
def bank_officer_token(client):
    return _login_token(client, "bank@atlas.gov", "bank123")


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
