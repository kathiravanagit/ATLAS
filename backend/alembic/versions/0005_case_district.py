"""Add a district (jurisdiction) column to cases and alerts.

The prediction path used to infer a case's city by searching its free-text
description for a city name and defaulting to Puducherry. That made geography an
implicit, unreachable property: it could not be filtered on, scoped by role, or
carried onto a notification.

This adds an explicit district. The backfill reproduces the old description
matching exactly, so no existing case changes which ATM registry it is scored
against; anything the old code could not place stays "" and keeps the same
default it had before.
"""
from alembic import op
import sqlalchemy as sa


revision = "0005_case_district"
down_revision = "0004_review_records"
branch_labels = None
depends_on = None

# Mirrors city_data.CITIES name -> district. Inlined on purpose: a migration is
# a historical record and must not drift when application data changes.
CITY_DISTRICTS = [
    ("PUDUCHERRY", "Puducherry"),
    ("CHENNAI", "Chennai"),
    ("DELHI", "New Delhi"),
    ("MUMBAI", "Mumbai City"),
    ("BANGALORE", "Bengaluru Urban"),
    ("KOLKATA", "Kolkata"),
    ("HYDERABAD", "Hyderabad"),
    ("AHMEDABAD", "Ahmedabad"),
]


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "cases" in tables and not _has_column(inspector, "cases", "district"):
        op.add_column("cases", sa.Column("district", sa.String(), server_default=""))
        op.create_index("ix_cases_district", "cases", ["district"])

    if "alerts" in tables and not _has_column(inspector, "alerts", "district"):
        op.add_column("alerts", sa.Column("district", sa.String(), server_default=""))
        op.create_index("ix_alerts_district", "alerts", ["district"])

    # Backfill by reproducing the description match the prediction path used.
    if "cases" in tables:
        cases = sa.table(
            "cases",
            sa.column("case_id", sa.String()),
            sa.column("description", sa.Text()),
            sa.column("district", sa.String()),
        )
        for name, district in CITY_DISTRICTS:
            bind.execute(
                cases.update()
                .where(sa.func.upper(sa.func.coalesce(cases.c.description, "")).like(f"%{name}%"))
                .where(sa.func.coalesce(cases.c.district, "") == "")
                .values(district=district)
            )

        # Alerts inherit the district of their case where it is now known.
        if "alerts" in tables:
            bind.execute(sa.text(
                "UPDATE alerts SET district = COALESCE("
                "(SELECT district FROM cases WHERE cases.case_id = alerts.case_id), '') "
                "WHERE COALESCE(district, '') = ''"
            ))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "alerts" in tables and _has_column(inspector, "alerts", "district"):
        op.drop_index("ix_alerts_district", table_name="alerts")
        op.drop_column("alerts", "district")

    if "cases" in tables and _has_column(inspector, "cases", "district"):
        op.drop_index("ix_cases_district", table_name="cases")
        op.drop_column("cases", "district")
