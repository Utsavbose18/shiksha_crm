"""Country document templates — reusable per-country checklists

Revision ID: 0003_country_doc_templates
Revises: 0002_updated_schema
Create Date: 2026-05-12 00:00:00.000000

Adds two tables that back the "save a document checklist per country and
apply it to any student with one click" feature:

  - country_doc_templates        (id, country, created_by, timestamps)
  - country_doc_template_fields  (id, template_id, doc_type, label,
                                  category, is_required, sort_order,
                                  instructions)

The doc_type and category enums already exist in the database (created by
0002 for document_fields). MySQL stores enums inline per column rather than
as a shared type, so re-declaring them here just produces matching CHECK-
style constraints on the new columns — no clash with the existing tables.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_country_doc_templates"
down_revision: Union[str, None] = "0002_updated_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Keep these in sync with app.models.user.DocumentType / DocumentCategory
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


def upgrade() -> None:
    # ── country_doc_templates ────────────────────────────────────────────────
    op.create_table(
        "country_doc_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("country", name="uq_country_doc_templates_country"),
    )
    op.create_index(
        "ix_country_doc_templates_country",
        "country_doc_templates",
        ["country"],
    )

    # ── country_doc_template_fields ──────────────────────────────────────────
    op.create_table(
        "country_doc_template_fields",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("country_doc_templates.id", ondelete="CASCADE"),
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
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("instructions", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_country_doc_template_fields_template_id",
        "country_doc_template_fields",
        ["template_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_country_doc_template_fields_template_id",
        table_name="country_doc_template_fields",
    )
    op.drop_table("country_doc_template_fields")

    op.drop_index(
        "ix_country_doc_templates_country",
        table_name="country_doc_templates",
    )
    op.drop_table("country_doc_templates")
