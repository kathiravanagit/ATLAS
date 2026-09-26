from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="analyst")  # inspector, analyst, bank_officer, admin
    badge = Column(String, default="")
    department = Column(String, default="")
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, nullable=True)

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    replaced_by = Column(String, nullable=True)  # token that replaced this one on rotation

    user = relationship("User", back_populates="refresh_tokens")


class Case(Base):
    __tablename__ = "cases"

    case_id = Column(String, primary_key=True)
    crime_type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    linked_accounts = Column(Integer, default=1)
    current_risk = Column(String, default="Low")
    last_updated = Column(String, default="Just now")
    status = Column(String, default="active")
    victim_name = Column(String, default="")
    contact = Column(String, default="")
    description = Column(Text, default="")
    assigned_to = Column(String, nullable=True, default=None)  # user.id of owning officer
    department = Column(String, default="")  # owning department; "" = shared pool
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    predictions = relationship("Prediction", back_populates="case")
    alerts = relationship("Alert", back_populates="case")
    suspects = relationship("Suspect", back_populates="case")
    audit_logs = relationship("AuditLog", back_populates="case")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.case_id"), nullable=False)
    status = Column(String, default="PENDING")
    risk_trend = Column(Text, default="[]")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="predictions")
    ranked_locations = relationship("RankedLocation", back_populates="prediction")


class RankedLocation(Base):
    __tablename__ = "ranked_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False)
    rank = Column(Integer, nullable=False)
    atm_id = Column(String, nullable=False)
    location_name = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False)
    expected_window = Column(String, nullable=False)
    distance = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String, default="Watch")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    prediction = relationship("Prediction", back_populates="ranked_locations")


class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(String, primary_key=True)
    case_id = Column(String, ForeignKey("cases.case_id"), nullable=False)
    message = Column(Text, nullable=False)
    risk_level = Column(String, nullable=False)
    location = Column(String, nullable=False)
    time_window = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(String, nullable=True)

    case = relationship("Case", back_populates="alerts")


class Suspect(Base):
    __tablename__ = "suspects"

    id = Column(String, primary_key=True)
    case_id = Column(String, ForeignKey("cases.case_id"), nullable=False)
    name = Column(String, default="Unknown Suspect")
    risk_level = Column(String, default="Medium")
    last_seen = Column(String, default="")
    accounts_linked = Column(Integer, default=1)
    status = Column(String, default="active")

    case = relationship("Case", back_populates="suspects")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.case_id"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=False)
    action_type = Column(String, default="action")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    case = relationship("Case", back_populates="audit_logs")


class AtmLocation(Base):
    __tablename__ = "atm_locations"

    atm_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    area = Column(String, nullable=False)


class FieldOutcome(Base):
    __tablename__ = "field_outcomes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.case_id"), nullable=False)
    atm_id = Column(String, nullable=False)
    outcome = Column(String, nullable=False)  # apprehended, cash_recovered, transaction_prevented, false_positive
    officer_id = Column(String, nullable=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ─── Production-hardening tables ────────────────────────────────────────────
# Evidence/blockchain rows replace local JSON files when CHAIN_BACKEND=db
# (default for Postgres deployments; file backend stays for offline demos/tests).

class EvidenceBlockRow(Base):
    __tablename__ = "evidence_blocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    block_id = Column(Integer, unique=True, nullable=False, index=True)
    case_id = Column(String, nullable=False, index=True)
    block_hash = Column(String, nullable=False)
    prev_hash = Column(String, nullable=False)
    payload = Column(Text, nullable=False)  # full block dict as JSON
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BlockchainBlockRow(Base):
    __tablename__ = "blockchain_blocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chain_name = Column(String, nullable=False, default="primary", index=True)
    block_index = Column(Integer, nullable=False)
    block_hash = Column(String, nullable=False)
    prev_hash = Column(String, nullable=False)
    payload = Column(Text, nullable=False)  # full block dict as JSON
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        # one row per (chain, height); DB-level guard against fork writes
        UniqueConstraint("chain_name", "block_index", name="uq_chain_height"),
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    key = Column(String, primary_key=True)
    method = Column(String, nullable=False)
    path = Column(String, nullable=False)
    status_code = Column(Integer, nullable=False)
    response_body = Column(Text, nullable=False)  # JSON of the original response
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NotificationJob(Base):
    __tablename__ = "notification_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String, nullable=False)  # sms | email
    payload = Column(Text, nullable=False)  # JSON: {message, subject?, to?}
    status = Column(String, default="queued", index=True)  # queued|sending|sent|failed|dead
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    last_error = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
