from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ─── Request Models ───────────────────────────────────────────────────────────

class ComplaintCreate(BaseModel):
    victim_name: str
    crime_type: str
    amount: float
    description: str
    contact: str


# ─── Response Models ──────────────────────────────────────────────────────────

class CaseResponse(BaseModel):
    case_id: str
    crime_type: str
    amount: float
    linked_accounts: int
    current_risk: str
    last_updated: str
    status: str
    victim_name: str = ""
    contact: str = ""
    description: str = ""


class PredictionLocationResponse(BaseModel):
    rank: int
    atm_id: str
    location_name: str
    risk_score: float
    expected_window: str
    distance: str
    reason: str
    status: str
    latitude: float
    longitude: float


class PredictionResponse(BaseModel):
    case_id: str
    status: str
    primary_location: PredictionLocationResponse
    ranked_locations: List[PredictionLocationResponse]
    risk_trend: List[float]
    evidence: dict


class AlertResponse(BaseModel):
    alert_id: str
    case_id: str
    message: str
    risk_level: str
    location: str
    time_window: str
    timestamp: str
    acknowledged: bool
    acknowledged_at: Optional[str] = None


class DashboardStatsResponse(BaseModel):
    active_cases: int
    high_risk_locations: int
    alerts_today: int
    avg_lead_time: str


class AuditEntryResponse(BaseModel):
    time: str
    action: str
    details: str
    action_type: str


class SuspectResponse(BaseModel):
    id: str
    name: str
    risk_level: str
    last_seen: str
    accounts_linked: int
    status: str
