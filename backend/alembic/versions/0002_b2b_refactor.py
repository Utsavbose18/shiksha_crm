"""b2b_refactor

Revision ID: 0002
Revises: 92104dee2801
Create Date: 2026-06-01 07:44:00.347592

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0002'
down_revision: Union[str, None] = '92104dee2801'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Remove auth fields from students
    with op.batch_alter_table('students') as batch_op:
        batch_op.drop_index('ix_students_letzstudy_email')
        batch_op.drop_column('hashed_password')
        batch_op.drop_column('letzstudy_email')
        batch_op.drop_column('must_change_password')

    # 2. Change students.email uniqueness from global to per-tenant
    with op.batch_alter_table('students') as batch_op:
        batch_op.drop_index('ix_students_email')
        batch_op.create_unique_constraint('uq_student_email_tenant', ['email', 'tenant_id'])

    # 3. Add user_id (recipient) to notifications
    with op.batch_alter_table('notification') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', name='fk_notification_user_id'), nullable=True))
        batch_op.create_index('ix_notifications_user_read', ['user_id', 'is_read'])

    # 4. Add setup_completed_at to tenants
    op.add_column('tenants', sa.Column('setup_completed_at', sa.DateTime(), nullable=True))

    # 5. Add platform_support to userrole enum
    # SQLite doesn't support ALTER TABLE MODIFY COLUMN. In production with MySQL/Postgres you would run it.
    # For SQLite, it just ignores the enum constraints on insert anyway.
    # op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('platform_super_admin','admin','counsellor','platform_support')")

    # 6. Add indexes for performance
    op.create_index('ix_audit_logs_record', 'audit_logs', ['record_type', 'record_id'])
    op.create_index('ix_applications_status_tenant', 'applications', ['application_status', 'tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_applications_status_tenant', 'applications')
    op.drop_index('ix_audit_logs_record', 'audit_logs')
    # op.execute("ALTER TABLE users MODIFY COLUMN role ENUM('platform_super_admin','admin','counsellor')")
    op.drop_column('tenants', 'setup_completed_at')
    with op.batch_alter_table('notification') as batch_op:
        batch_op.drop_index('ix_notifications_user_read')
        batch_op.drop_constraint('fk_notification_user_id', type_='foreignkey')
        batch_op.drop_column('user_id')
    with op.batch_alter_table('students') as batch_op:
        batch_op.drop_constraint('uq_student_email_tenant', type_='unique')
        batch_op.create_index('ix_students_email', ['email'], unique=True)
        batch_op.add_column(sa.Column('must_change_password', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('letzstudy_email', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('hashed_password', sa.String(length=255), nullable=True))
