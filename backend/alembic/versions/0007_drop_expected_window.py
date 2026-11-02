"""Remove the predicted cash-out window from stored predictions.

`expected_window` was built by taking the mean hour of the transaction records
the same request had just generated and mapping it to a hardcoded two-hour
bucket. It was presented as a forecast but was a relabelling of its own input,
so it could not be wrong and carried no information.

The response now carries `observed_window`, a descriptive span of the stored
records (start, end, record count, observed hours). Nothing predicted is stored
under a time name, so the column goes.

SQLite cannot drop a column in place; batch mode rebuilds the table and copies
rows, which is why the width here does not matter.
"""
from alembic import op
import sqlalchemy as sa


revision = "0007_drop_expected_window"
down_revision = "0006_case_external_ref"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "ranked_locations" not in set(inspector.get_table_names()):
        return
    if not _has_column(inspector, "ranked_locations", "expected_window"):
        return
    with op.batch_alter_table("ranked_locations") as batch:
        batch.drop_column("expected_window")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "ranked_locations" not in set(inspector.get_table_names()):
        return
    if _has_column(inspector, "ranked_locations", "expected_window"):
        return
    # Not backfilled: the value was derived from transaction records that are
    # still present, so a caller needing it can recompute it from those rows.
    with op.batch_alter_table("ranked_locations") as batch:
        batch.add_column(sa.Column("expected_window", sa.String(), nullable=False, server_default=""))
