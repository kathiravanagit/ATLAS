"""Give an ingested complaint a stable external reference.

Intake arrives over a network and will be retried: a client that times out after
the server committed must be able to resend without filing the same complaint
twice. The reference the complainant's own system already assigns (the NCRP
acknowledgement number) is that key.

Nullable on purpose. Every case that predates intake - demo seeds and synthetic
fixtures - has no external reference and must not be forced to invent one.
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_case_external_ref"
down_revision = "0005_case_district"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "cases" not in set(inspector.get_table_names()):
        return
    if _has_column(inspector, "cases", "external_ref"):
        return
    op.add_column("cases", sa.Column("external_ref", sa.String(), nullable=True))
    # Unique index rather than a table constraint: both SQLite and PostgreSQL
    # treat NULLs as distinct here, so any number of seeded cases stay legal.
    op.create_index("ix_cases_external_ref", "cases", ["external_ref"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "cases" not in set(inspector.get_table_names()):
        return
    if not _has_column(inspector, "cases", "external_ref"):
        return
    op.drop_index("ix_cases_external_ref", table_name="cases")
    op.drop_column("cases", "external_ref")
