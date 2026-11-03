"""Give users a jurisdiction so access control can be scoped by district.

Cases and alerts have carried a district since `0005_case_district`, and reads
are scoped by department. But a user had no district, so there was no district
predicate to enforce: every district officer could read and act on every
district's shared pool. This adds the missing half of `role x district` RBAC.

Empty stays the default. It means a national account (the admin, or a
headquarters analyst), which is exactly the behaviour every existing user had
before this revision, so no account silently loses access. District assignment
is a data task in this prototype; there is no self-service field for it.
"""
from alembic import op
import sqlalchemy as sa


revision = "0008_user_district"
down_revision = "0007_drop_expected_window"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "users" not in set(inspector.get_table_names()):
        return
    if _has_column(inspector, "users", "district"):
        return
    op.add_column("users", sa.Column("district", sa.String(), server_default=""))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "users" not in set(inspector.get_table_names()):
        return
    if not _has_column(inspector, "users", "district"):
        return
    with op.batch_alter_table("users") as batch:
        batch.drop_column("district")
