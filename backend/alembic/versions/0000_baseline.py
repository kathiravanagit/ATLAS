"""Frozen application schema before production hardening.

Existing create_all-based installations keep their tables and data. Later
revisions own ownership columns, model_version, and transaction_records.
Do not import live ORM metadata here: historical migrations must not change
when application models evolve.
"""
from alembic import op
import sqlalchemy as sa


revision = "0000_baseline"
down_revision = None
branch_labels = None
depends_on = None


def _schema():
    metadata = sa.MetaData()
    sa.Table(
        "users", metadata,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("badge", sa.String()),
        sa.Column("department", sa.String()),
        sa.Column("is_active", sa.Boolean()),
        sa.Column("is_approved", sa.Boolean()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("last_login", sa.DateTime()),
    )
    sa.Table(
        "refresh_tokens", metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean()),
        sa.Column("replaced_by", sa.String()),
    )
    sa.Table(
        "cases", metadata,
        sa.Column("case_id", sa.String(), primary_key=True),
        sa.Column("crime_type", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("linked_accounts", sa.Integer()),
        sa.Column("current_risk", sa.String()),
        sa.Column("last_updated", sa.String()),
        sa.Column("status", sa.String()),
        sa.Column("victim_name", sa.String()),
        sa.Column("contact", sa.String()),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )
    sa.Table(
        "predictions", metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.case_id"), nullable=False),
        sa.Column("status", sa.String()),
        sa.Column("risk_trend", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )
    sa.Table(
        "ranked_locations", metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("prediction_id", sa.Integer(), sa.ForeignKey("predictions.id"), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("atm_id", sa.String(), nullable=False),
        sa.Column("location_name", sa.String(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("expected_window", sa.String(), nullable=False),
        sa.Column("distance", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String()),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
    )
    sa.Table(
        "alerts", metadata,
        sa.Column("alert_id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.case_id"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("risk_level", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("time_window", sa.String(), nullable=False),
        sa.Column("timestamp", sa.String(), nullable=False),
        sa.Column("acknowledged", sa.Boolean()),
        sa.Column("acknowledged_at", sa.String()),
    )
    sa.Table(
        "suspects", metadata,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.case_id"), nullable=False),
        sa.Column("name", sa.String()),
        sa.Column("risk_level", sa.String()),
        sa.Column("last_seen", sa.String()),
        sa.Column("accounts_linked", sa.Integer()),
        sa.Column("status", sa.String()),
    )
    sa.Table(
        "audit_logs", metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.case_id")),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("action_type", sa.String()),
        sa.Column("timestamp", sa.DateTime()),
    )
    sa.Table(
        "atm_locations", metadata,
        sa.Column("atm_id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("area", sa.String(), nullable=False),
    )
    sa.Table(
        "field_outcomes", metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("cases.case_id"), nullable=False),
        sa.Column("atm_id", sa.String(), nullable=False),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("officer_id", sa.String(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )
    return metadata


def upgrade() -> None:
    # checkfirst preserves unversioned installations created by the old app.
    _schema().create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # Baseline tables may predate Alembic and contain user data. Never remove
    # them implicitly when downgrading an adopted, previously unversioned DB.
    pass
