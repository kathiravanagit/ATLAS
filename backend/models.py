from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ─── Request Models ───────────────────────────────────────────────────────────

class ComplaintCreate(BaseModel):
    """A complaint as a cybercrime desk would file it (NCRP shape, not a schema mirror).

    `district` is the jurisdiction key and `incident_at` is T0. `description` is
    free text kept for the officer: it is never parsed to decide a district,
    because a complaint that mentions another city in prose must not move between
    ATM registries.
    """

    external_ref: str = Field(min_length=1, max_length=64)
    district: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0, le=100_000_000)
    incident_at: datetime
    description: str = Field(default="", max_length=4000)
    victim_name: str = Field(default="", max_length=120)
    contact: str = Field(default="", max_length=64)


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
    observed_window: dict
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
