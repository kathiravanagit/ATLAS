"""Production-hardening tables + case ownership columns.

- evidence_blocks / blockchain_blocks: transactional home for the evidence
  chain and PoW ledger (replaces local JSON files when CHAIN_BACKEND=db).
- idempotency_keys: safe retries for transaction ingestion / alert creation.
- notification_jobs: durable SMS/email dispatch with retry + dead-letter.
- cases.assigned_to / cases.department: ownership scoping for investigators.
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_production_hardening"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent: Base.metadata.create_all() at app startup may already have
    # created these tables — only create what is missing, then ALTER cases.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "evidence_blocks" not in existing_tables:
        op.create_table(
            "evidence_blocks",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("block_id", sa.Integer(), nullable=False),
            sa.Column("case_id", sa.String(), nullable=False),
            sa.Column("block_hash", sa.String(), nullable=False),
            sa.Column("prev_hash", sa.String(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("block_id"),
        )
        op.create_index("ix_evidence_blocks_block_id", "evidence_blocks", ["block_id"])
        op.create_index("ix_evidence_blocks_case_id", "evidence_blocks", ["case_id"])

    if "blockchain_blocks" not in existing_tables:
        op.create_table(
            "blockchain_blocks",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("chain_name", sa.String(), nullable=False),
            sa.Column("block_index", sa.Integer(), nullable=False),
            sa.Column("block_hash", sa.String(), nullable=False),
            sa.Column("prev_hash", sa.String(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("chain_name", "block_index", name="uq_chain_height"),
        )
        op.create_index("ix_blockchain_blocks_chain_name", "blockchain_blocks", ["chain_name"])

    if "idempotency_keys" not in existing_tables:
        op.create_table(
            "idempotency_keys",
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("method", sa.String(), nullable=False),
            sa.Column("path", sa.String(), nullable=False),
            sa.Column("status_code", sa.Integer(), nullable=False),
            sa.Column("response_body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("key"),
        )

    if "notification_jobs" not in existing_tables:
        op.create_table(
            "notification_jobs",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("attempts", sa.Integer(), nullable=True),
            sa.Column("max_attempts", sa.Integer(), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_notification_jobs_status", "notification_jobs", ["status"])

    # Ownership scoping on existing cases table (nullable/additive only).
    # Guarded: on a fresh database the base tables are created by
    # Base.metadata.create_all() at app startup (which already includes the
    # new columns via models_db), so ALTER only runs where cases exists.
    if "cases" in existing_tables:
        existing = {c["name"] for c in inspector.get_columns("cases")}
        if "assigned_to" not in existing:
            op.add_column("cases", sa.Column("assigned_to", sa.String(), nullable=True))
        if "department" not in existing:
            op.add_column("cases", sa.Column("department", sa.String(), nullable=True, server_default=""))


def downgrade() -> None:
    op.drop_column("cases", "department")
    op.drop_column("cases", "assigned_to")
    op.drop_index("ix_notification_jobs_status", table_name="notification_jobs")
    op.drop_table("notification_jobs")
    op.drop_table("idempotency_keys")
    op.drop_index("ix_blockchain_blocks_chain_name", table_name="blockchain_blocks")
    op.drop_table("blockchain_blocks")
    op.drop_index("ix_evidence_blocks_case_id", table_name="evidence_blocks")
    op.drop_index("ix_evidence_blocks_block_id", table_name="evidence_blocks")
    op.drop_table("evidence_blocks")
