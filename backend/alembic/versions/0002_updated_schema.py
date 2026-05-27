"""Updated schema — sync with current ORM models

Revision ID: 0002_updated_schema
Revises: 0001_initial
Create Date: 2025-01-02 00:00:00.000000

Changes vs 0001_initial:
  - users: add must_change_password
  - students: add must_change_password, highest_education, middle_name,
              marital_status, citizenship, dual_citizenship,
              mailing_*/permanent_* address blocks, passport_issue_country,
              passport_issue_date, city_of_birth, country_of_birth,
              living_in_other_country, living_country,
              applied_for_immigration, serious_medical_condition,
              medical_condition_details, visa_refusal, visa_refusal_details,
              visa_refusal_countries, criminal_conviction,
              criminal_conviction_details, emergency_contact_email,
              nationality, passport_expiry, letzstudy_email,
              lead_status extended enum (hot/warm/cold/lost added)
  - academic_qualifications: level becomes enum, add is_highest,
              degree_name, specialization, stream, updated_at
  - work_experiences: add country, updated_at
  - test_scores: replace test_type string with test_type_id FK,
              add updated_at; remove status default column
  - documents table: DROPPED (replaced by document_fields + document_files)
  - NEW: test_types
  - NEW: custom_profile_fields
  - NEW: student_custom_field_values
  - NEW: document_fields
  - NEW: document_files
  - universities: drop website/ranking, add category (required)
  - applications: add specialization, course_start_date, course_end_date,
              course_duration_months, scholarship_amount, campus_location,
              delivery_mode, student_id_on_letter;
              application_messages attachment_data/name/type columns
  - NEW: payments.payment_mode, payments.paid_amount, payments.invoice_pdf,
              payments.due_date, payments.manual_student_name
  - NEW: notifications
  - NEW: notes, note_files
  - NEW: student_notes
  - NEW: enquiry_students (with intake_month), enquiry_notes
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = "0002_updated_schema"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ── users ─────────────────────────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="1"),
    )

    # ── students – enum extensions ────────────────────────────────────────────
    op.execute(
        "ALTER TABLE students MODIFY COLUMN lead_status "
        "ENUM('lead','hot','warm','cold','converted','lost') NOT NULL DEFAULT 'lead'"
    )

    op.execute(
        "ALTER TABLE students ADD COLUMN highest_education "
        "ENUM('below_10th','10th','12th','diploma','bachelor','master','phd') "
        "NULL COMMENT 'Student highest completed education level; drives document checklist filter' "
        "AFTER lead_status"
    )

    # ── students – auth / meta ────────────────────────────────────────────────
    op.add_column(
        "students",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="1"),
    )
    # letzstudy_email: unique, eventually NOT NULL — add nullable first so
    # existing rows don't immediately violate the constraint, then tighten.
    op.add_column(
        "students",
        sa.Column("letzstudy_email", sa.String(255), nullable=True),
    )
    op.create_unique_constraint("uq_students_letzstudy_email", "students", ["letzstudy_email"])

    # ── students – personal info ──────────────────────────────────────────────
    op.add_column("students", sa.Column("middle_name", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("marital_status", sa.String(30), nullable=True))
    op.add_column("students", sa.Column("nationality", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("citizenship", sa.String(100), nullable=True))
    op.add_column(
        "students",
        sa.Column("dual_citizenship", sa.Boolean(), nullable=True, server_default="0"),
    )

    # ── students – mailing address ────────────────────────────────────────────
    op.add_column("students", sa.Column("mailing_address1", sa.String(255), nullable=True))
    op.add_column("students", sa.Column("mailing_address2", sa.String(255), nullable=True))
    op.add_column("students", sa.Column("mailing_city", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("mailing_state", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("mailing_country", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("mailing_pincode", sa.String(20), nullable=True))

    # ── students – permanent address ──────────────────────────────────────────
    op.add_column(
        "students",
        sa.Column("same_as_mailing", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column("students", sa.Column("permanent_address1", sa.String(255), nullable=True))
    op.add_column("students", sa.Column("permanent_address2", sa.String(255), nullable=True))
    op.add_column("students", sa.Column("permanent_city", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("permanent_state", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("permanent_country", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("permanent_pincode", sa.String(20), nullable=True))

    # ── students – passport / travel ──────────────────────────────────────────
    op.add_column("students", sa.Column("passport_issue_country", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("passport_issue_date", sa.Date(), nullable=True))
    op.add_column("students", sa.Column("passport_expiry", sa.Date(), nullable=True))
    op.add_column("students", sa.Column("city_of_birth", sa.String(100), nullable=True))
    op.add_column("students", sa.Column("country_of_birth", sa.String(100), nullable=True))

    # ── students – living abroad ──────────────────────────────────────────────
    op.add_column(
        "students",
        sa.Column("living_in_other_country", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column("students", sa.Column("living_country", sa.String(100), nullable=True))

    # ── students – background info ────────────────────────────────────────────
    op.add_column(
        "students",
        sa.Column("applied_for_immigration", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column(
        "students",
        sa.Column("serious_medical_condition", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column("students", sa.Column("medical_condition_details", sa.Text(), nullable=True))
    op.add_column(
        "students",
        sa.Column("visa_refusal", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column("students", sa.Column("visa_refusal_details", sa.Text(), nullable=True))
    op.add_column("students", sa.Column("visa_refusal_countries", mysql.JSON(), nullable=True))
    op.add_column(
        "students",
        sa.Column("criminal_conviction", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column(
        "students",
        sa.Column("criminal_conviction_details", sa.Text(), nullable=True),
    )

    # ── students – emergency contact ──────────────────────────────────────────
    op.add_column(
        "students",
        sa.Column("emergency_contact_email", sa.String(255), nullable=True),
    )

    # ── academic_qualifications ───────────────────────────────────────────────
    op.execute(
        "ALTER TABLE academic_qualifications MODIFY COLUMN level "
        "ENUM('10th','12th','diploma','ug','pg') NULL"
    )
    op.add_column(
        "academic_qualifications",
        sa.Column("is_highest", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column(
        "academic_qualifications",
        sa.Column("degree_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "academic_qualifications",
        sa.Column("specialization", sa.String(255), nullable=True),
    )
    op.add_column(
        "academic_qualifications",
        sa.Column("stream", sa.String(100), nullable=True),
    )
    op.add_column(
        "academic_qualifications",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── work_experiences ──────────────────────────────────────────────────────
    op.add_column("work_experiences", sa.Column("country", sa.String(100), nullable=True))
    op.add_column(
        "work_experiences",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── test_types (NEW) ──────────────────────────────────────────────────────
    op.create_table(
        "test_types",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("has_overall_score", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column(
            "overall_score_label", sa.String(100), nullable=True, server_default="Overall Score"
        ),
        sa.Column("overall_score_min", sa.Float(), nullable=True),
        sa.Column("overall_score_max", sa.Float(), nullable=True),
        sa.Column("overall_score_step", sa.Float(), nullable=True, server_default="1"),
        sa.Column("sections", mysql.JSON(), nullable=True),
        sa.Column("has_expiry", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("validity_years", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── test_scores – replace string type with FK ─────────────────────────────
    op.add_column(
        "test_scores",
        sa.Column(
            "test_type_id",
            sa.Integer(),
            sa.ForeignKey("test_types.id"),
            nullable=True,  # nullable until data back-fill; tightened below
        ),
    )
    op.add_column(
        "test_scores",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    # Drop old string columns (run data back-fill before this in a live migration)
    op.drop_column("test_scores", "test_type")
    op.drop_column("test_scores", "status")

    # Tighten FK column to NOT NULL after back-fill
    op.alter_column("test_scores", "test_type_id", nullable=False)

    # ── documents table – DROPPED ─────────────────────────────────────────────
    # Superseded by document_fields + document_files. Drop FKs first (MySQL).
    op.drop_table("documents")

    # ── custom_profile_fields (NEW) ───────────────────────────────────────────
    op.create_table(
        "custom_profile_fields",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("field_name", sa.String(255), nullable=False),
        sa.Column(
            "field_type",
            sa.Enum(
                "text", "integer", "float", "yes_no", "long_text", "dropdown",
                name="customfieldtype",
            ),
            nullable=False,
        ),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column(
            "section_key", sa.String(50), nullable=False, server_default="pre_application"
        ),
        sa.Column("placeholder", sa.String(255), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dropdown_options", mysql.JSON(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── student_custom_field_values (NEW) ─────────────────────────────────────
    op.create_table(
        "student_custom_field_values",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
        sa.Column(
            "field_id",
            sa.Integer(),
            sa.ForeignKey("custom_profile_fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("value_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("student_id", "field_id", name="uq_student_field_value"),
    )

    # ── document_fields (NEW) ─────────────────────────────────────────────────
    _doc_type_values = [
        "marksheet_10", "marksheet_12", "diploma_cert", "diploma_transcripts",
        "ug_degree_cert", "ug_degree_transcripts", "ug_provisional_cert",
        "transfer_cert", "moi_cert", "backlog_cert", "masters_cert",
        "masters_transcript", "phd_cert",
        "ielts", "toefl", "pte", "duolingo", "gre", "gmat", "sat", "act",
        "bank_statements", "bank_balance_cert", "fd_certs", "education_loan",
        "itr", "salary_slips", "employment_letter", "gst_cert", "business_reg",
        "property_valuation", "affidavit_support",
        "passport", "offer_letter", "cas_i20_coe", "visa_form", "visa_fee_receipt",
        "sevis_receipt", "gta_sop", "biometrics_confirmation", "medical_report",
        "pcc", "travel_insurance",
        "sop", "lor", "cv", "portfolio", "work_exp_letter", "internship_cert",
        "extracurricular_cert", "passport_photo",
        "other",
    ]
    _doc_category_values = ["academic", "language", "financial", "visa", "supporting", "other"]

    op.create_table(
        "document_fields",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "doc_type",
            sa.Enum(*_doc_type_values, name="documenttype"),
            nullable=False,
            server_default="other",
        ),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column(
            "category",
            sa.Enum(*_doc_category_values, name="documentcategory"),
            nullable=False,
            server_default="other",
        ),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_document_fields_student_id", "document_fields", ["student_id"])

    # ── document_files (NEW) ──────────────────────────────────────────────────
    op.create_table(
        "document_files",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "field_id",
            sa.Integer(),
            sa.ForeignKey("document_fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stored_name", sa.String(500), nullable=False),
        sa.Column("original_name", sa.String(500), nullable=False),
        sa.Column("file_data", mysql.LONGBLOB(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("extracted_data", mysql.JSON(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_document_files_field_id", "document_files", ["field_id"])

    # ── universities ──────────────────────────────────────────────────────────
    op.drop_column("universities", "website")
    op.drop_column("universities", "ranking")
    op.execute("UPDATE universities SET country = '' WHERE country IS NULL")
    op.alter_column("universities", "country", existing_type=sa.String(100), nullable=False)
    op.add_column(
        "universities",
        sa.Column("category", sa.String(50), nullable=False, server_default="global"),
    )

    # ── applications ──────────────────────────────────────────────────────────
    op.add_column("applications", sa.Column("specialization", sa.String(255), nullable=True))
    op.add_column("applications", sa.Column("course_start_date", sa.Date(), nullable=True))
    op.add_column("applications", sa.Column("course_end_date", sa.Date(), nullable=True))
    op.add_column("applications", sa.Column("course_duration_months", sa.Integer(), nullable=True))
    op.add_column("applications", sa.Column("scholarship_amount", sa.Float(), nullable=True))
    op.add_column("applications", sa.Column("campus_location", sa.String(255), nullable=True))
    op.add_column("applications", sa.Column("delivery_mode", sa.String(255), nullable=True))
    op.add_column(
        "applications", sa.Column("student_id_on_letter", sa.String(255), nullable=True)
    )

    # ── application_messages ──────────────────────────────────────────────────
    op.drop_column("application_messages", "attachment_path")
    op.add_column(
        "application_messages",
        sa.Column("attachment_data", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "application_messages",
        sa.Column("attachment_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "application_messages",
        sa.Column("attachment_type", sa.String(100), nullable=True),
    )

    # ── payments ──────────────────────────────────────────────────────────────
    op.add_column("payments", sa.Column("payment_mode", sa.String(100), nullable=True))
    op.add_column("payments", sa.Column("paid_amount", sa.Float(), nullable=True))
    op.add_column("payments", sa.Column("manual_student_name", sa.String(255), nullable=True))
    op.add_column("payments", sa.Column("invoice_pdf", sa.LargeBinary(), nullable=True))
    op.add_column("payments", sa.Column("due_date", sa.Date(), nullable=True))

    # ── notification (NEW) ────────────────────────────────────────────────────
    op.create_table(
        "notification",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("application_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.String(255), nullable=True),
        sa.Column("type", sa.String(50), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── notes (NEW) ───────────────────────────────────────────────────────────
    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "title", sa.String(255), nullable=False, server_default="Untitled"
        ),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("notes.id"), nullable=True),
        sa.Column(
            "created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=True
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── note_files (NEW) ──────────────────────────────────────────────────────
    op.create_table(
        "note_files",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_data", sa.LargeBinary(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── student_notes (NEW) ───────────────────────────────────────────────────
    op.create_table(
        "student_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False
        ),
        sa.Column(
            "title", sa.String(255), nullable=True, server_default="Untitled"
        ),
        sa.Column("content", mysql.LONGTEXT(), nullable=True),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("student_notes.id"),
            nullable=True,
        ),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column(
            "priority", sa.String(20), nullable=True, server_default="medium"
        ),
        sa.Column("tags", mysql.JSON(), nullable=True),
        sa.Column(
            "created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.create_index("ix_student_notes_student_id", "student_notes", ["student_id"])

    # ── enquiry_students (NEW) ────────────────────────────────────────────────
    op.create_table(
        "enquiry_students",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("intake_month", sa.String(50), nullable=True),   # present in ORM model
        sa.Column("intake_year", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.create_index("ix_enquiry_students_name", "enquiry_students", ["name"])
    op.create_index("ix_enquiry_students_intake_year", "enquiry_students", ["intake_year"])
    op.create_index("ix_enquiry_students_intake_month", "enquiry_students", ["intake_month"])

    # ── enquiry_notes (NEW) ───────────────────────────────────────────────────
    op.create_table(
        "enquiry_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "enquiry_id",
            sa.Integer(),
            sa.ForeignKey("enquiry_students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("enquiry_notes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(255), nullable=False, server_default="Untitled"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.create_index("ix_enquiry_notes_enquiry_id", "enquiry_notes", ["enquiry_id"])
    op.create_index("ix_enquiry_notes_parent_id", "enquiry_notes", ["parent_id"])


def downgrade() -> None:

    # ── enquiry_notes ─────────────────────────────────────────────────────────
    op.drop_index("ix_enquiry_notes_parent_id", table_name="enquiry_notes")
    op.drop_index("ix_enquiry_notes_enquiry_id", table_name="enquiry_notes")
    op.drop_table("enquiry_notes")

    # ── enquiry_students ──────────────────────────────────────────────────────
    op.drop_index("ix_enquiry_students_intake_month", table_name="enquiry_students")
    op.drop_index("ix_enquiry_students_intake_year", table_name="enquiry_students")
    op.drop_index("ix_enquiry_students_name", table_name="enquiry_students")
    op.drop_table("enquiry_students")

    # ── student_notes ─────────────────────────────────────────────────────────
    op.drop_index("ix_student_notes_student_id", table_name="student_notes")
    op.drop_table("student_notes")

    # ── note_files ────────────────────────────────────────────────────────────
    op.drop_table("note_files")

    # ── notes ─────────────────────────────────────────────────────────────────
    op.drop_table("notes")

    # ── notification ──────────────────────────────────────────────────────────
    op.drop_table("notification")

    # ── payments ──────────────────────────────────────────────────────────────
    op.drop_column("payments", "due_date")
    op.drop_column("payments", "invoice_pdf")
    op.drop_column("payments", "manual_student_name")
    op.drop_column("payments", "paid_amount")
    op.drop_column("payments", "payment_mode")

    # ── application_messages ──────────────────────────────────────────────────
    op.drop_column("application_messages", "attachment_type")
    op.drop_column("application_messages", "attachment_name")
    op.drop_column("application_messages", "attachment_data")
    op.add_column(
        "application_messages",
        sa.Column("attachment_path", sa.String(500), nullable=True),
    )

    # ── applications ──────────────────────────────────────────────────────────
    op.drop_column("applications", "student_id_on_letter")
    op.drop_column("applications", "delivery_mode")
    op.drop_column("applications", "campus_location")
    op.drop_column("applications", "scholarship_amount")
    op.drop_column("applications", "course_duration_months")
    op.drop_column("applications", "course_end_date")
    op.drop_column("applications", "course_start_date")
    op.drop_column("applications", "specialization")

    # ── universities ──────────────────────────────────────────────────────────
    op.drop_column("universities", "category")
    op.alter_column("universities", "country", existing_type=sa.String(100), nullable=True)
    op.add_column("universities", sa.Column("ranking", sa.Integer(), nullable=True))
    op.add_column("universities", sa.Column("website", sa.String(255), nullable=True))

    # ── document_files ────────────────────────────────────────────────────────
    op.drop_index("ix_document_files_field_id", table_name="document_files")
    op.drop_table("document_files")

    # ── document_fields ───────────────────────────────────────────────────────
    op.drop_index("ix_document_fields_student_id", table_name="document_fields")
    op.drop_table("document_fields")

    # ── student_custom_field_values ───────────────────────────────────────────
    op.drop_table("student_custom_field_values")

    # ── custom_profile_fields ─────────────────────────────────────────────────
    op.drop_table("custom_profile_fields")

    # ── documents table – restore ─────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "doc_type",
            sa.Enum(
                "passport", "transcript", "lor", "sop", "cv",
                "ielts", "toefl", "gre", "gmat", "sat", "act",
                "bank_statement", "other",
                name="documenttype_legacy",
            ),
            nullable=True,
        ),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("extracted_data", mysql.JSON(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), server_default="0"),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── test_scores – restore string columns ──────────────────────────────────
    op.alter_column("test_scores", "test_type_id", nullable=True)
    op.drop_column("test_scores", "updated_at")
    op.drop_column("test_scores", "test_type_id")
    op.add_column("test_scores", sa.Column("test_type", sa.String(50), nullable=True))
    op.add_column(
        "test_scores",
        sa.Column("status", sa.String(50), server_default="pending"),
    )

    # ── test_types ────────────────────────────────────────────────────────────
    op.drop_table("test_types")

    # ── work_experiences ──────────────────────────────────────────────────────
    op.drop_column("work_experiences", "updated_at")
    op.drop_column("work_experiences", "country")

    # ── academic_qualifications ───────────────────────────────────────────────
    op.drop_column("academic_qualifications", "updated_at")
    op.drop_column("academic_qualifications", "stream")
    op.drop_column("academic_qualifications", "specialization")
    op.drop_column("academic_qualifications", "degree_name")
    op.drop_column("academic_qualifications", "is_highest")
    op.execute(
        "ALTER TABLE academic_qualifications MODIFY COLUMN level VARCHAR(100) NULL"
    )

    # ── students ──────────────────────────────────────────────────────────────
    op.drop_column("students", "emergency_contact_email")
    op.drop_column("students", "criminal_conviction_details")
    op.drop_column("students", "criminal_conviction")
    op.drop_column("students", "visa_refusal_countries")
    op.drop_column("students", "visa_refusal_details")
    op.drop_column("students", "visa_refusal")
    op.drop_column("students", "medical_condition_details")
    op.drop_column("students", "serious_medical_condition")
    op.drop_column("students", "applied_for_immigration")
    op.drop_column("students", "living_country")
    op.drop_column("students", "living_in_other_country")
    op.drop_column("students", "country_of_birth")
    op.drop_column("students", "city_of_birth")
    op.drop_column("students", "passport_expiry")
    op.drop_column("students", "passport_issue_date")
    op.drop_column("students", "passport_issue_country")
    op.drop_column("students", "permanent_pincode")
    op.drop_column("students", "permanent_country")
    op.drop_column("students", "permanent_state")
    op.drop_column("students", "permanent_city")
    op.drop_column("students", "permanent_address2")
    op.drop_column("students", "permanent_address1")
    op.drop_column("students", "same_as_mailing")
    op.drop_column("students", "mailing_pincode")
    op.drop_column("students", "mailing_country")
    op.drop_column("students", "mailing_state")
    op.drop_column("students", "mailing_city")
    op.drop_column("students", "mailing_address2")
    op.drop_column("students", "mailing_address1")
    op.drop_column("students", "dual_citizenship")
    op.drop_column("students", "citizenship")
    op.drop_column("students", "nationality")
    op.drop_column("students", "marital_status")
    op.drop_column("students", "middle_name")
    op.drop_constraint("uq_students_letzstudy_email", "students", type_="unique")
    op.drop_column("students", "letzstudy_email")
    op.drop_column("students", "must_change_password")
    op.drop_column("students", "highest_education")
    op.execute(
        "ALTER TABLE students MODIFY COLUMN lead_status "
        "ENUM('lead','converted') NOT NULL DEFAULT 'lead'"
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.drop_column("users", "must_change_password")