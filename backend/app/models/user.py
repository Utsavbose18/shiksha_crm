"""
All SQLAlchemy ORM models for the portal.
Updated with:
  - Extended Student personal info (marital status, passport details, background info, etc.)
  - Academic qualification hierarchy with conditional logic handled at API layer
  - Multiple work experiences (already dynamic via relationship - no model change needed)
  - TestType admin-configurable templates with JSON section schema
  - Custom profile field definitions (admin) + values (student)
  - DocumentField: admin/counsellor-configurable document slots per student
  - DocumentFile: one-to-many files per document field (multi-file upload support)
  - DocumentType expanded with all standard document categories
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    Float, ForeignKey, Enum, JSON, LargeBinary, UniqueConstraint
)
 
from sqlalchemy.orm import relationship
from app.models.tenant import Tenant
from app.models.branch import Branch
import enum

from app.core.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, LargeBinary
from app.core.database import Base
from sqlalchemy import Column, LargeBinary
from sqlalchemy import Column, Date


invoice_pdf = Column(LargeBinary, nullable=True)

# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    platform_super_admin = "platform_super_admin"
    platform_support = "platform_support"
    admin = "admin"
    counsellor = "counsellor"
    student = "student"


class LeadStatus(str, enum.Enum):
    lead = "lead"
    hot = "hot"
    warm = "warm"
    cold = "cold"
    converted = "converted"
    lost = "lost"


class ApplicationStatus(str, enum.Enum):
    pending_from_student = "pending_from_student"
    initiated = "initiated"
    pending_from_LS = "pending_from_LS"
    conditional_offer = "conditional_offer"
    unconditional_offer = "unconditional_offer"
    case_closed="case_closed"
    application_on_hold = "application_on_hold"
    funds_approved="funds_approved"
    offer_accepted = "offer_accepted"
    rejected = "rejected"
    waitlisted = "waitlisted"
    withdrawn = "withdrawn"
    deferral = "deferral"
    fee_paid  = "fee_paid"
    tuition_payment_not_done = "tuition_payment_not_done"
    visa_applied = "visa_applied"
    visa_approved = "visa_approved"
    visa_rejected = "visa_rejected"


class VisaStatus(str, enum.Enum):
    not_applied = "not_applied"
    visa_applied = "visa_applied"
    visa_approved = "visa_approved"
    visa_rejected = "visa_rejected"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    done = "done"
    partial = "partial"


# ─── DocumentType ──────────────────────────────────────────────────────────────
#
# Covers all standard document types across academic, financial, visa, and
# supporting categories. The "other" / "custom" values are used for dynamic
# fields created by admin/counsellor via DocumentField.

class DocumentType(str, enum.Enum):
    # ── Academic proof ──
    marksheet_10            = "marksheet_10"           # 10th mark sheet
    marksheet_12            = "marksheet_12"           # 12th mark sheet
    diploma_cert            = "diploma_cert" 
    diploma_transcripts     = "diploma_transcripts"  
    ug_degree_cert          = "ug_degree_cert"    
    ug_degree_transcripts   = "ug_degree_transcripts"
    ug_provisional_cert     = "ug_provisional_cert"       # Provisional certificate
    transfer_cert           = "transfer_cert"          # Transfer certificate (TC)
    moi_cert                = "moi_cert"               # Medium of instruction certificate
    backlog_cert            = "backlog_cert" 
    masters_cert            = "masters_cert"
    masters_transcript      = "masters_transcript"
    phd_cert                =  "phd_cert"

    # ── Language & entrance scores ──
    ielts                   = "ielts"
    toefl                   = "toefl"
    pte                     = "pte"
    duolingo                = "duolingo"
    gre                     = "gre"
    gmat                    = "gmat"
    sat                     = "sat"
    act                     = "act"

    # ── Financial documents ──
    bank_statements         = "bank_statements"        # Bank statements (6-12 months)
    bank_balance_cert       = "bank_balance_cert"      # Bank balance certificate
    fd_certs                = "fd_certs"               # Fixed deposit certificates
    education_loan          = "education_loan"         # Education loan sanction letter
    itr                     = "itr"                    # Income tax returns (2-3 years)
    salary_slips            = "salary_slips"           # Salary slips (3-6 months)
    employment_letter       = "employment_letter"      # Employment letter (sponsor)
    gst_cert                = "gst_cert"               # GST certificate (self-employed)
    business_reg            = "business_reg"           # Business registration proof
    property_valuation      = "property_valuation"     # Property valuation document
    affidavit_support       = "affidavit_support"      # Affidavit of support / sponsor letter

    # ── Visa documents ──
    passport                = "passport"               # Valid passport
    offer_letter            = "offer_letter"           # Offer / admission letter
    cas_i20_coe             = "cas_i20_coe"            # CAS (UK) / I-20 (USA) / COE (AU)
    visa_form               = "visa_form"              # Visa application form
    visa_fee_receipt        = "visa_fee_receipt"       # Visa fee payment receipt
    sevis_receipt           = "sevis_receipt"          # SEVIS fee receipt (USA)
    gta_sop                 = "gta_sop"                # GTE / SOP for visa
    biometrics_confirmation = "biometrics_confirmation"# Biometrics appointment confirmation
    medical_report          = "medical_report"         # Medical test report
    pcc                     = "pcc"                    # Police clearance certificate
    travel_insurance        = "travel_insurance"       # Travel insurance

    # ── Supporting documents ──
    sop                     = "sop"                    # Statement of purpose (admission)
    lor                     = "lor"                    # Letters of recommendation
    cv                      = "cv"                     # Resume / CV
    portfolio               = "portfolio"              # Portfolio (design / architecture)
    work_exp_letter         = "work_exp_letter"        # Work experience letter
    internship_cert         = "internship_cert"        # Internship certificate
    extracurricular_cert    = "extracurricular_cert"   # Extracurricular certificate
    passport_photo          = "passport_photo"         # Passport-size photographs

    # ── Catch-all ──
    other                   = "other"                  # Miscellaneous / custom


# ─── DocumentCategory ─────────────────────────────────────────────────────────
#
# Used on DocumentField to group fields into logical sections in the UI.

class DocumentCategory(str, enum.Enum):
    academic    = "academic"
    language    = "language"
    financial   = "financial"
    visa        = "visa"
    supporting  = "supporting"
    other       = "other"


class ServiceType(str, enum.Enum):
    test_prep = "test_prep"
    accommodation = "accommodation"
    flywire = "flywire"
    loan = "loan"
    forex = "forex"
    visa_assistance = "visa_assistance"


# Academic level hierarchy — order matters for conditional logic
class AcademicLevel(str, enum.Enum):
    tenth = "10th"
    twelfth = "12th"
    diploma = "diploma"
    ug = "ug"          # Bachelor's / Under-Graduate
    pg = "pg"          # Master's / Post-Graduate


# Custom field input types (admin-defined)
class CustomFieldType(str, enum.Enum):
    text = "text"
    integer = "integer"
    float_ = "float"        # stored as "float" in DB
    yes_no = "yes_no"
    long_text = "long_text"
    dropdown = "dropdown"


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True, index=True)
    must_change_password = Column(Boolean, default=True)

    students_counselled = relationship("Student", back_populates="assigned_counsellor",
                                       foreign_keys="Student.counsellor_id")
    created_students = relationship("Student", back_populates="created_by_user",
                                    foreign_keys="Student.created_by")

class HighestEducation(str, enum.Enum):
    below_10th = "below_10th"
    tenth      = "10th"
    twelfth    = "12th"
    diploma    = "diploma"
    bachelor   = "bachelor"
    master     = "master"
    phd        = "phd"
# ─── Student ──────────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)

    # ── Identity ──
    email = Column(String(255), index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    highest_education = Column(
        Enum(HighestEducation, name="highesteducation"),
        nullable=True,
        default=None,
        comment="Student's highest completed education level; drives document checklist filter",)
    
    # ── Meta ──
    lead_status = Column(Enum(LeadStatus), default=LeadStatus.lead)
    counsellor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Personal Info ──
    first_name = Column(String(100))
    middle_name = Column(String(100))
    last_name = Column(String(100))
    date_of_birth = Column(Date)
    gender = Column(String(20))
    marital_status = Column(String(30))
    nationality = Column(String(100))
    citizenship = Column(String(100))
    dual_citizenship = Column(Boolean, default=False)
    phone = Column(String(20))

    # ── Mailing Address ──
    mailing_address1 = Column(String(255))
    mailing_address2 = Column(String(255))
    mailing_city = Column(String(100))
    mailing_state = Column(String(100))
    mailing_country = Column(String(100))
    mailing_pincode = Column(String(20))

    # ── Permanent Address ──
    same_as_mailing = Column(Boolean, default=False)
    permanent_address1 = Column(String(255))
    permanent_address2 = Column(String(255))
    permanent_city = Column(String(100))
    permanent_state = Column(String(100))
    permanent_country = Column(String(100))
    permanent_pincode = Column(String(20))

    # ── Passport / Travel ──
    passport_number = Column(String(50))
    passport_issue_country = Column(String(100))
    passport_issue_date = Column(Date)
    passport_expiry = Column(Date)
    city_of_birth = Column(String(100))
    country_of_birth = Column(String(100))

    # ── Living / Study Abroad ──
    living_in_other_country = Column(Boolean, default=False)
    living_country = Column(String(100))

    # ── Background Info ──
    applied_for_immigration = Column(Boolean, default=False)
    serious_medical_condition = Column(Boolean, default=False)
    medical_condition_details = Column(Text)
    visa_refusal = Column(Boolean, default=False)
    visa_refusal_details = Column(Text)
    visa_refusal_countries = Column(JSON)
    criminal_conviction = Column(Boolean, default=False)
    criminal_conviction_details = Column(Text)

    # ── Emergency Contact ──
    emergency_contact_name = Column(String(255))
    emergency_contact_email = Column(String(255))
    emergency_contact_phone = Column(String(20))
    emergency_contact_relation = Column(String(50))

    # ── Relationships ──
    assigned_counsellor = relationship("User", back_populates="students_counselled",
                                       foreign_keys=[counsellor_id])
    created_by_user = relationship("User", back_populates="created_students",
                                   foreign_keys=[created_by])
    academic_qualifications = relationship("AcademicQualification", back_populates="student",
                                           cascade="all, delete-orphan")
    work_experiences = relationship("WorkExperience", back_populates="student",
                                    cascade="all, delete-orphan")
    test_scores = relationship("TestScore", back_populates="student",
                               cascade="all, delete-orphan")
    document_fields = relationship("DocumentField", back_populates="student",
                                   cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="student",
                                cascade="all, delete-orphan")
    services = relationship("StudentService", back_populates="student",
                            cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="student",
                            cascade="all, delete-orphan")
    custom_field_values = relationship("StudentCustomFieldValue", back_populates="student",
                                       cascade="all, delete-orphan")


# ─── Academic Qualification ───────────────────────────────────────────────────

class AcademicQualification(Base):
    __tablename__ = "academic_qualifications"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    level = Column(Enum(AcademicLevel), nullable=False)
    is_highest = Column(Boolean, default=False)
    institution = Column(String(255))
    board_university = Column(String(255))
    field_of_study = Column(String(255))
    start_year = Column(Integer)
    end_year = Column(Integer)
    percentage_cgpa = Column(Float)
    grading_scale = Column(String(50))
    backlogs = Column(Integer, default=0)
    country = Column(String(100))
    degree_name = Column(String(255))
    specialization = Column(String(255))
    stream = Column(String(100))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="academic_qualifications")




# ─── Work Experience ──────────────────────────────────────────────────────────

class WorkExperience(Base):
    __tablename__ = "work_experiences"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    company_name = Column(String(255))
    job_title = Column(String(255))
    employment_type = Column(String(50))
    start_date = Column(Date)
    end_date = Column(Date, nullable=True)
    is_current = Column(Boolean, default=False)
    description = Column(Text)
    country = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="work_experiences")


# ─── Test Type Template  (Admin-configurable) ─────────────────────────────────

class TestType(Base):
    __tablename__ = "test_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    has_overall_score = Column(Boolean, default=True)
    overall_score_label = Column(String(100), default="Overall Score")
    overall_score_min = Column(Float, nullable=True)
    overall_score_max = Column(Float, nullable=True)
    overall_score_step = Column(Float, default=1.0)

    sections = Column(JSON, nullable=True)

    has_expiry = Column(Boolean, default=True)
    validity_years = Column(Integer, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    test_scores = relationship("TestScore", back_populates="test_type_ref")


# ─── Test Score ───────────────────────────────────────────────────────────────

class TestScore(Base):
    __tablename__ = "test_scores"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    test_type_id = Column(Integer, ForeignKey("test_types.id"), nullable=False)

    test_date = Column(Date)
    expiry_date = Column(Date, nullable=True)
    overall_score = Column(Float, nullable=True)
    section_scores = Column(JSON, nullable=True)
    status = Column(String(50), default="pending")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="test_scores")
    test_type_ref = relationship("TestType", back_populates="test_scores")


# ─── Custom Profile Field Definition  (Admin-created, per-student) ────────────

class CustomProfileField(Base):
    __tablename__ = "custom_profile_fields"

    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(255), nullable=False)
    field_type = Column(Enum(CustomFieldType), nullable=False)

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    section_key = Column(String(50), nullable=False, default="pre_application")

    placeholder = Column(String(255), nullable=True)
    is_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    dropdown_options = Column(JSON, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    values = relationship(
        "StudentCustomFieldValue",
        back_populates="field",
        cascade="all, delete-orphan",
    )


# ─── Custom Field Value (per-student) ────────────────────────────────────────

class StudentCustomFieldValue(Base):
    __tablename__ = "student_custom_field_values"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    field_id = Column(Integer, ForeignKey("custom_profile_fields.id"), nullable=False)
    value_text = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("student_id", "field_id", name="uq_student_field_value"),
    )

    field = relationship("CustomProfileField", back_populates="values")
    student = relationship("Student", back_populates="custom_field_values")


# ─── DocumentField ────────────────────────────────────────────────────────────
#
# DESIGN:
#   Admin / counsellor creates DocumentField entries per student.
#   Each entry defines a named document slot (e.g. "Bank Statement").
#   Built-in slots are seeded from the standard DocumentType enum values.
#   Custom slots use doc_type = DocumentType.other and carry a custom label.
#
#   category groups fields for display (academic / financial / visa / etc.)
#   is_required flags mandatory fields.
#   is_active supports soft-delete without losing uploaded files.
#   sort_order controls display order within a category.
#
#   Files actually uploaded live in DocumentFile (child table).

class DocumentField(Base):
    __tablename__ = "document_fields"

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    # Maps to the DocumentType enum. Use DocumentType.other for custom fields.
    doc_type = Column(Enum(DocumentType), nullable=False, default=DocumentType.other)

    # Human-readable label. For standard types this can mirror the enum label;
    # for custom types this is the admin-supplied name.
    label = Column(String(255), nullable=False)

    # Logical grouping for display purposes.
    category = Column(Enum(DocumentCategory), nullable=False, default=DocumentCategory.other)

    is_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    # Optional notes / instructions shown to the student.
    instructions = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="document_fields")
    files = relationship(
        "DocumentFile",
        back_populates="field",
        cascade="all, delete-orphan",
        order_by="DocumentFile.created_at",
    )


# ─── DocumentFile ─────────────────────────────────────────────────────────────
#
# Each DocumentField can have multiple uploaded files.
# stored_name follows the convention: {username}_{doc_type}.{ext}
# (with a counter suffix if multiple files: {username}_{doc_type}_2.{ext} etc.)
# original_name preserves the original filename for reference.
# file_data stores raw bytes in the DB (same pattern as original Document model).
# extracted_data holds OCR results when available.

class DocumentFile(Base):
    __tablename__ = "document_files"

    id = Column(Integer, primary_key=True, index=True)

    field_id = Column(Integer, ForeignKey("document_fields.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    # Name as it should be presented / saved: {username}_{doc_type}[_N].{ext}
    stored_name = Column(String(500), nullable=False)

    # Original filename from the upload
    original_name = Column(String(500), nullable=False)

    file_data = Column(LargeBinary, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)

    # OCR / extraction results (optional)
    extracted_data = Column(JSON, nullable=True)

    is_verified = Column(Boolean, default=False)

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    field = relationship("DocumentField", back_populates="files")


# ─── University ───────────────────────────────────────────────────────────────

# class University(Base):
#     __tablename__ = "universities"

#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String(255), nullable=False)
#     country = Column(String(100))
#     city = Column(String(100))
#     website = Column(String(255))
#     ranking = Column(Integer, nullable=True)
#     created_at = Column(DateTime, default=datetime.utcnow)

#     applications = relationship("Application", back_populates="university")


class University(Base):
    __tablename__ = "universities"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)

    # country is REQUIRED
    country = Column(String(100), nullable=False)

    # city is OPTIONAL
    city = Column(String(100), nullable=True)

    # required category: global / superior / kings
    category = Column(String(50), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    applications = relationship("Application", back_populates="university")

class Notification(Base):
    __tablename__ = "notification"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    student_id = Column(Integer)
    application_id = Column(Integer)  # ✅ ADD THIS
    message = Column(Text)
    type = Column(String(50))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
# ─── Application ─────────────────────────────────────────────────────────────

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False)
    course_name = Column(String(255))
    intake_month = Column(String(50))
    representative = Column(String(255), nullable=True)   # 👈 ADD THIS
    intake_year = Column(Integer)
    application_deadline = Column(Date, nullable=True)
    specialization = Column(String(255)) 
    course_start_date = Column(Date, nullable=True)
    course_end_date = Column(Date, nullable=True) 
    course_duration_months= Column(Integer)
    tuition_fee = Column(Float, nullable=True)
    currency = Column(String(10), default="USD")
    scholarship_amount=Column(Float, nullable=True)
    campus_location= Column(String(255)) 
    delivery_mode= Column(String(255)) 
    student_id_on_letter= Column(String(255))
    application_fee = Column(Float, nullable=True)
    payment_mode = Column(String(100))
    application_status = Column(Enum(ApplicationStatus), default=ApplicationStatus.initiated)
    visa_status = Column(Enum(VisaStatus), default=VisaStatus.not_applied)
    visa_applied_date = Column(Date, nullable=True)
    visa_decision_date = Column(Date, nullable=True)
    offer_letter_path = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status_reason = Column(String(255), nullable=True)
    priority = Column(String(20), nullable=True)
    student = relationship("Student", back_populates="applications")
    university = relationship("University", back_populates="applications")
    messages = relationship("ApplicationMessage", back_populates="application",
                            cascade="all, delete-orphan")


# ─── Application Chat ─────────────────────────────────────────────────────────

class ApplicationMessage(Base):
    __tablename__ = "application_messages"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    sender_type = Column(String(20))
    sender_id = Column(Integer)
    message = Column(Text, nullable=False)
    attachment_data = Column(LargeBinary)
    attachment_name = Column(String(255), nullable=True)
    attachment_type = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="messages")
# ─── Services ─────────────────────────────────────────────────────────────────

class StudentService(Base):
    __tablename__ = "student_services"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    service_type = Column(Enum(ServiceType), nullable=False)
    provider = Column(String(255), nullable=True)
    status = Column(String(50), default="active")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="services")


# ─── Payment ──────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"
 
    id = Column(Integer, primary_key=True, index=True)
 
    # Registered student — nullable so walk-in / manual entries are allowed
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
 
    # Walk-in / non-registered client name (used when student_id is None)
    manual_student_name = Column(String(255), nullable=True)
 
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    payment_type = Column(String(100))
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    payment_date = Column(Date, nullable=True)
    reference = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    payment_mode = Column(String(100))
    paid_amount = Column(Float, nullable=True)
    invoice_pdf = Column(LargeBinary, nullable=True)
    due_date = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    student = relationship("Student", back_populates="payments")
 
    student = relationship("Student", back_populates="payments")
# ─── Note ─────────────────────────────────────────────────────────────────────

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False, default="Untitled")
    content = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("notes.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent = relationship("Note", remote_side=[id], backref="children")
    files = relationship("NoteFile", back_populates="note", cascade="all, delete-orphan")


class NoteFile(Base):
    __tablename__ = "note_files"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_data = Column(LargeBinary, nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    note = relationship("Note", back_populates="files")
    
    
class StudentNote(Base):
    __tablename__ = "student_notes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    title = Column(String(255), default="Untitled")
    content = Column(Text)
    parent_id = Column(Integer, ForeignKey("student_notes.id"), nullable=True)
    category = Column(String(50))
    priority = Column(String(20), default="medium")
    tags = Column(JSON, default=[])
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class EnquiryStudent(Base):
    __tablename__ = "enquiry_students"
 
    id          = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name        = Column(String(255), nullable=False, index=True)
    intake_month= Column(String(50), nullable=True, index=True)
    intake_year = Column(Integer, nullable=False, index=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active   = Column(Boolean, default=True)
 
    # one enquiry student → many notes
    notes = relationship(
        "EnquiryNote",
        back_populates="enquiry_student",
        cascade="all, delete-orphan",
    )
 

class EnquiryNote(Base):
    __tablename__ = "enquiry_notes"
 
    id           = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    enquiry_id   = Column(Integer, ForeignKey("enquiry_students.id"), nullable=False, index=True)
    parent_id    = Column(Integer, ForeignKey("enquiry_notes.id"), nullable=True)
    title        = Column(String(255), nullable=False, default="Untitled")
    content      = Column(Text, nullable=True)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active    = Column(Boolean, default=True)
 
    # self-referential parent/child  (mirrors Note)
    parent = relationship("EnquiryNote", remote_side=[id], backref="children")

    # back to the enquiry student
    enquiry_student = relationship("EnquiryStudent", back_populates="notes")


# ─── CountryDocTemplate ───────────────────────────────────────────────────────
# Reusable document checklist keyed by country (e.g. "Germany").
# Counsellor saves the current student's selected docs as a template, then
# applies it on any future student to seed matching DocumentField rows.

class CountryDocTemplate(Base):
    __tablename__ = "country_doc_templates"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    country = Column(String(100), unique=True, nullable=False, index=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    fields = relationship(
        "CountryDocTemplateField",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="CountryDocTemplateField.sort_order",
    )


class CountryDocTemplateField(Base):
    __tablename__ = "country_doc_template_fields"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("country_doc_templates.id"), nullable=False, index=True)

    doc_type = Column(Enum(DocumentType), nullable=False, default=DocumentType.other)
    label = Column(String(255), nullable=False)
    category = Column(Enum(DocumentCategory), nullable=False, default=DocumentCategory.other)
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    instructions = Column(Text, nullable=True)

    template = relationship("CountryDocTemplate", back_populates="fields")
# ─── WhatsApp Contact ─────────────────────────────────────────────────────────
#
# Maps an incoming WhatsApp phone number to a Student (optional link).
# A contact can exist without a student link (unknown caller).

class WhatsAppContact(Base):
    __tablename__ = "whatsapp_contacts"

    id              = Column(Integer, primary_key=True, index=True)
    phone_number    = Column(String(25), unique=True, nullable=False, index=True)
    wa_id           = Column(String(100), nullable=True)          # WhatsApp's own ID
    display_name    = Column(String(255), nullable=True)          # name from WA profile
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    assigned_to     = Column(Integer, ForeignKey("users.id"),    nullable=True)  # counsellor
    is_opted_in     = Column(Boolean, default=True)
    last_seen       = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student  = relationship("Student",  foreign_keys=[student_id])
    assignee = relationship("User",     foreign_keys=[assigned_to])
    messages = relationship(
        "WhatsAppMessage",
        back_populates="contact",
        cascade="all, delete-orphan",
        order_by="WhatsAppMessage.created_at",
    )


# ─── WhatsApp Message ─────────────────────────────────────────────────────────
#
# Stores every inbound and outbound WhatsApp message.
# direction: 'inbound'  = student → CRM
#            'outbound' = CRM → student

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id              = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    contact_id      = Column(Integer, ForeignKey("whatsapp_contacts.id"), nullable=False, index=True)
    wa_message_id   = Column(String(255), unique=True, nullable=True, index=True)  # Meta's wamid
    direction       = Column(String(10),  nullable=False)          # 'inbound' | 'outbound'
    message_type    = Column(String(20),  default="text")          # text | image | document | audio
    content         = Column(Text,        nullable=True)
    media_url       = Column(String(500), nullable=True)
    media_mime_type = Column(String(100), nullable=True)
    media_data      = Column(LargeBinary, nullable=True)           # downloaded media bytes
    status          = Column(String(20),  default="received")      # received | delivered | read | failed | sent
    sender_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)  # outbound only
    error_message   = Column(Text, nullable=True)
    raw_payload     = Column(JSON, nullable=True)                  # full Meta webhook payload
    created_at      = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contact = relationship("WhatsAppContact", back_populates="messages")
    sender  = relationship("User", foreign_keys=[sender_user_id])
