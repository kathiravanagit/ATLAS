"""Track the model artifact used for each persisted prediction."""
from alembic import op
import sqlalchemy as sa


revision = "0002_prediction_model_version"
down_revision = "0001_production_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "predictions" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("predictions")}
    if "model_version" not in columns:
        op.add_column("predictions", sa.Column("model_version", sa.String(), nullable=True))
        op.create_index("ix_predictions_model_version", "predictions", ["model_version"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "predictions" not in inspector.get_table_names():
        return
    op.drop_index("ix_predictions_model_version", table_name="predictions")
    op.drop_column("predictions", "model_version")
