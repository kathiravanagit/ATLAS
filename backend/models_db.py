from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone


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
