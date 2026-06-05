"""platform_ops

Revision ID: 0003_platform_ops
Revises: 0002
Create Date: 2026-06-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_platform_ops"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_last_login", "users", ["last_login_at"])

    op.create_table(
        "impersonation_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("superadmin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_impersonation_logs_superadmin",
        "impersonation_logs",
        ["superadmin_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_impersonation_logs_superadmin", table_name="impersonation_logs")
    op.drop_table("impersonation_logs")
    op.drop_index("ix_users_last_login", table_name="users")
    op.drop_column("users", "last_login_at")
