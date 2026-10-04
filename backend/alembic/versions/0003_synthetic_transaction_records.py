"""Persist reproducible synthetic transaction fixtures used by predictions."""
from alembic import op
import sqlalchemy as sa


revision = "0003_synthetic_transaction_records"
down_revision = "0002_prediction_model_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "transaction_records" not in inspector.get_table_names():
        op.create_table(
            "transaction_records",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("case_id", sa.String(), nullable=False),
            sa.Column("from_account", sa.String(), nullable=False),
            sa.Column("to_account", sa.String(), nullable=False),
            sa.Column("amount", sa.Float(), nullable=False),
            sa.Column("atm_id", sa.String(), nullable=True),
            sa.Column("location", sa.String(), nullable=True),
            sa.Column("occurred_at", sa.DateTime(), nullable=False),
            sa.Column("source", sa.String(), nullable=False, server_default="synthetic-fixture"),
            sa.ForeignKeyConstraint(["case_id"], ["cases.case_id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_transaction_records_case_id", "transaction_records", ["case_id"])
        op.create_index("ix_transaction_records_atm_id", "transaction_records", ["atm_id"])


def downgrade() -> None:
    op.drop_index("ix_transaction_records_atm_id", table_name="transaction_records")
    op.drop_index("ix_transaction_records_case_id", table_name="transaction_records")
    op.drop_table("transaction_records")
