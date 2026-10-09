"""Persist human review decisions (approve/override/dismiss) in review_records."""
from alembic import op
import sqlalchemy as sa


revision = "0004_review_records"
down_revision = "0003_tx_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "review_records" not in inspector.get_table_names():
        op.create_table(
            "review_records",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("case_id", sa.String(), nullable=False),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("reviewer_id", sa.String(), nullable=False),
            sa.Column("previous_risk", sa.String(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["case_id"], ["cases.case_id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_review_records_case_id", "review_records", ["case_id"])


def downgrade() -> None:
    op.drop_index("ix_review_records_case_id", table_name="review_records")
    op.drop_table("review_records")
