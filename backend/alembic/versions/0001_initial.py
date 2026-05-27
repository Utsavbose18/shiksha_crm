"""Initial schema — pre-0002 baseline

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

Creates the original tables that 0002_updated_schema then evolves:

  users, students, academic_qualifications, work_experiences,
  test_scores (with legacy string test_type), documents (legacy,
  dropped by 0002), universities (with website/ranking),
  applications, application_messages (with attachment_path),
  student_services, payments

Reconstructed by reverse-engineering 0002_updated_schema.py — the
columns added/dropped/altered there tell us what the pre-0002 shape
must have been. The previous repo copy of 0001_initial.py had been
overwritten with a duplicate of 0002, leaving the migration chain
broken. This file restores the true baseline.

Existing production databases were built via ``Base.metadata.create_all``
in ``app/main.py``, not via alembic, so this file's contents only matter
when bootstrapping a fresh DB from scratch via ``alembic upgrade head``.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Enum value sets ──────────────────────────────────────────────────────────
_user_role_values         = ["admin", "counsellor", "student"]
_lead_status_initial      = ["lead", "converted"]          # extended in 0002
_service_type_values      = ["test_prep", "accommodation", "flywire", "loan", "forex", "visa_assistance"]
_visa_status_values       = ["not_applied", "visa_applied", "visa_approved", "visa_rejected"]
_payment_status_values    = ["pending", "done", "partial"]
_application_status_values = [
    "pending_from_student", "initiated", "pending_from_LS",
    "conditional_offer", "unconditional_offer", "case_closed",
    "application_on_hold", "funds_approved", "offer_accepted",
    "rejected", "waitlisted", "withdrawn", "deferral",
    "fee_paid", "tuition_payment_not_done",
    "visa_applied", "visa_approved", "visa_rejected",
]


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("role", sa.Enum(*_user_role_values, name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── students ─────────────────────────────────────────────────────────────
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        # ── Auth ──
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        # ── Meta ──
        sa.Column(
            "lead_status",
            sa.Enum(*_lead_status_initial, name="leadstatus"),
            nullable=False,
            server_default="lead",
        ),
        sa.Column("counsellor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        # ── Personal Info (basic only — 0002 adds the rest) ──
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        # ── Passport ──
        sa.Column("passport_number", sa.String(50), nullable=True),
        # ── Emergency contact ──
        sa.Column("emergency_contact_name", sa.String(255), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(20), nullable=True),
        sa.Column("emergency_contact_relation", sa.String(50), nullable=True),
        sa.UniqueConstraint("email", name="uq_students_email"),
    )
    op.create_index("ix_students_email", "students", ["email"])

    # ── academic_qualifications (level is non-nullable enum pre-0002) ────────
    op.create_table(
        "academic_qualifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "level",
            sa.Enum("10th", "12th", "diploma", "ug", "pg", name="academiclevel"),
            nullable=False,
        ),
        sa.Column("institution", sa.String(255), nullable=True),
        sa.Column("board_university", sa.String(255), nullable=True),
        sa.Column("field_of_study", sa.String(255), nullable=True),
        sa.Column("start_year", sa.Integer(), nullable=True),
        sa.Column("end_year", sa.Integer(), nullable=True),
        sa.Column("percentage_cgpa", sa.Float(), nullable=True),
        sa.Column("grading_scale", sa.String(50), nullable=True),
        sa.Column("backlogs", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── work_experiences ─────────────────────────────────────────────────────
    op.create_table(
        "work_experiences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("job_title", sa.String(255), nullable=True),
        sa.Column("employment_type", sa.String(50), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── test_scores (legacy: test_type as string, has status column) ─────────
    op.create_table(
        "test_scores",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("test_type", sa.String(50), nullable=False),
        sa.Column("test_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("section_scores", mysql.JSON(), nullable=True),
        sa.Column("status", sa.String(50), nullable=True, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── documents (legacy — dropped by 0002) ─────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("doc_type", sa.String(100), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("file_data", sa.LargeBinary(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("extracted_data", mysql.JSON(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── universities (pre-0002: had website/ranking, country nullable) ───────
    op.create_table(
        "universities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("ranking", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── applications (basic columns — 0002 adds many more) ──────────────────
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "university_id",
            sa.Integer(),
            sa.ForeignKey("universities.id"),
            nullable=False,
        ),
        sa.Column("course_name", sa.String(255), nullable=True),
        sa.Column("intake_month", sa.String(50), nullable=True),
        sa.Column("intake_year", sa.Integer(), nullable=True),
        sa.Column("application_deadline", sa.Date(), nullable=True),
        sa.Column("tuition_fee", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(10), nullable=True, server_default="USD"),
        sa.Column("application_fee", sa.Float(), nullable=True),
        sa.Column("payment_mode", sa.String(100), nullable=True),
        sa.Column("representative", sa.String(255), nullable=True),
        sa.Column(
            "application_status",
            sa.Enum(*_application_status_values, name="applicationstatus"),
            nullable=False,
            server_default="initiated",
        ),
        sa.Column(
            "visa_status",
            sa.Enum(*_visa_status_values, name="visastatus"),
            nullable=False,
            server_default="not_applied",
        ),
        sa.Column("visa_applied_date", sa.Date(), nullable=True),
        sa.Column("visa_decision_date", sa.Date(), nullable=True),
        sa.Column("offer_letter_path", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status_reason", sa.String(255), nullable=True),
        sa.Column("priority", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── application_messages (pre-0002 had attachment_path, no _data) ───────
    op.create_table(
        "application_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "application_id",
            sa.Integer(),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sender_type", sa.String(20), nullable=True),
        sa.Column("sender_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("attachment_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── student_services ────────────────────────────────────────────────────
    op.create_table(
        "student_services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "service_type",
            sa.Enum(*_service_type_values, name="servicetype"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=True, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── payments (basic — 0002 adds payment_mode/paid_amount/invoice/etc.) ──
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=True),
        sa.Column(
            "application_id",
            sa.Integer(),
            sa.ForeignKey("applications.id"),
            nullable=True,
        ),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=True, server_default="INR"),
        sa.Column("payment_type", sa.String(100), nullable=True),
        sa.Column(
            "status",
            sa.Enum(*_payment_status_values, name="paymentstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("reference", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("payments")
    op.drop_table("student_services")
    op.drop_table("application_messages")
    op.drop_table("applications")
    op.drop_table("universities")
    op.drop_table("documents")
    op.drop_table("test_scores")
    op.drop_table("work_experiences")
    op.drop_table("academic_qualifications")
    op.drop_index("ix_students_email", table_name="students")
    op.drop_table("students")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    # Drop named enum types (Postgres compatibility; MySQL no-ops these)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for enum_name in (
            "paymentstatus", "servicetype", "visastatus",
            "applicationstatus", "academiclevel", "leadstatus", "userrole",
        ):
            op.execute(f"DROP TYPE IF EXISTS {enum_name}")
