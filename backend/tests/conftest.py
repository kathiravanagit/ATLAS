import sys
import os
import glob

# Set test env BEFORE importing main (skips production security checks)
os.environ["TESTING"] = "1"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from models_db import Case, AtmLocation
from main import app
from auth import seed_demo_users

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


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


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_demo_users(db)
    for c in DEMO_CASES:
        existing = db.query(Case).filter(Case.case_id == c["case_id"]).first()
        if not existing:
            db.add(Case(**c))
    test_atms = [
        {"atm_id": "ATM-CH-001", "name": "T. Nagar ATM", "latitude": 13.0418, "longitude": 80.2341, "area": "T. Nagar"},
        {"atm_id": "ATM-CH-002", "name": "Anna Nagar ATM", "latitude": 13.0850, "longitude": 80.2101, "area": "Anna Nagar"},
        {"atm_id": "ATM-CH-003", "name": "Velachery ATM", "latitude": 12.9815, "longitude": 80.2180, "area": "Velachery"},
    ]
    for a in test_atms:
        existing = db.query(AtmLocation).filter(AtmLocation.atm_id == a["atm_id"]).first()
        if not existing:
            db.add(AtmLocation(**a))
    db.commit()
    db.close()
    yield
    try:
        engine.dispose()
        for f in glob.glob("test.db*"):
            try:
                os.remove(f)
            except PermissionError:
                pass
    except Exception:
        pass


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(client):
    resp = client.post("/api/auth/login", json={"email": "admin@atlas.gov", "password": "admin123"})
    return resp.json()["access_token"]


@pytest.fixture
def inspector_token(client):
    resp = client.post("/api/auth/login", json={"email": "inspector@atlas.gov", "password": "inspector123"})
    return resp.json()["access_token"]


@pytest.fixture
def analyst_token(client):
    resp = client.post("/api/auth/login", json={"email": "analyst@atlas.gov", "password": "analyst123"})
    return resp.json()["access_token"]


@pytest.fixture
def bank_officer_token(client):
    resp = client.post("/api/auth/login", json={"email": "bank@atlas.gov", "password": "bank123"})
    return resp.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
