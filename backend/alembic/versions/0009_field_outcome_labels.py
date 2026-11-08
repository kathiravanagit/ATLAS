"""Outcome-capture labels on field_outcomes.

The validation plan needs, per resolved case, whether the cash-out happened in
the predicted zone, whether a requested block succeeded, and where the activity
was actually seen. Those were nowhere to put them; the resolve flow now asks
and these nullable columns hold the answer (NULL = not asked / unknown).
"""
from alembic import op
import sqlalchemy as sa


revision = "0009_field_outcome_labels"
down_revision = "0008_user_district"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "field_outcomes" not in set(inspector.get_table_names()):
        return
    if not _has_column(inspector, "field_outcomes", "was_cashout_in_predicted_zone"):
        op.add_column("field_outcomes", sa.Column("was_cashout_in_predicted_zone", sa.Boolean(), nullable=True))
    if not _has_column(inspector, "field_outcomes", "block_successful"):
        op.add_column("field_outcomes", sa.Column("block_successful", sa.Boolean(), nullable=True))
    if not _has_column(inspector, "field_outcomes", "actual_location"):
        op.add_column("field_outcomes", sa.Column("actual_location", sa.String(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "field_outcomes" not in set(inspector.get_table_names()):
        return
    with op.batch_alter_table("field_outcomes") as batch:
        for column in ("was_cashout_in_predicted_zone", "block_successful", "actual_location"):
            if _has_column(inspector, "field_outcomes", column):
                batch.drop_column(column)
