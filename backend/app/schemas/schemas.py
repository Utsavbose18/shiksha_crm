"""
Pydantic v2 schemas — updated to cover:
  - Extended Student personal info
  - Academic qualifications with level hierarchy
  - Dynamic work experience (multiple entries)
  - Admin-configurable TestType templates
  - TestScore entries referencing TestType
  - Custom profile fields (admin definition + student values)
  - DocumentField: admin-configurable document slot definitions per student
  - DocumentFile: individual uploaded files within a DocumentField (multi-file)
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.models.user import (
    UserRole, LeadStatus, ApplicationStatus, VisaStatus,
    PaymentStatus, DocumentType, DocumentCategory, ServiceType,
    AcademicLevel, CustomFieldType, HighestEducation,
)
from pydantic import field_validator
from typing import Optional, List, Union

# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    must_change_password: bool = False
    tenant_id: Optional[int] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class PasswordResetByAdmin(BaseModel):
    new_password: str


# ─── User (Staff) ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Student Create ───────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    email: EmailStr
    password: str
    letzstudy_email:EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    counsellor_id: Optional[int] = None


# ─── Student Personal Info Update ─────────────────────────────────────────────

class StudentPersonalInfoUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    citizenship: Optional[str] = None
    dual_citizenship: Optional[bool] = None
    phone: Optional[str] = None

    mailing_address1: Optional[str] = None
    mailing_address2: Optional[str] = None
    mailing_city: Optional[str] = None
    mailing_state: Optional[str] = None
    mailing_country: Optional[str] = None
    mailing_pincode: Optional[str] = None

    same_as_mailing: Optional[bool] = None
    permanent_address1: Optional[str] = None
    permanent_address2: Optional[str] = None
    permanent_city: Optional[str] = None
    permanent_state: Optional[str] = None
    permanent_country: Optional[str] = None
    permanent_pincode: Optional[str] = None

    passport_number: Optional[str] = None
    passport_issue_country: Optional[str] = None
    passport_issue_date: Optional[date] = None
    passport_expiry: Optional[date] = None
    city_of_birth: Optional[str] = None
    country_of_birth: Optional[str] = None

    living_in_other_country: Optional[bool] = None
    living_country: Optional[str] = None

    applied_for_immigration: Optional[bool] = None
    serious_medical_condition: Optional[bool] = None
    medical_condition_details: Optional[str] = None
    visa_refusal: Optional[bool] = None
    visa_refusal_details: Optional[str] = None
    visa_refusal_countries: Optional[List[str]] = None
    criminal_conviction: Optional[bool] = None
    criminal_conviction_details: Optional[str] = None

    emergency_contact_name: Optional[str] = None
    emergency_contact_email: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    lead_status: Optional[LeadStatus] = None
    counsellor_id: Optional[int] = None
    highest_education: Optional[HighestEducation] = None


# ─── Student List / Profile Out ───────────────────────────────────────────────

class StudentListOut(BaseModel):
    id: int
    email: str
    letzstudy_email:str
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    application_status: Optional[ApplicationStatus] = None
    counsellor_name: Optional[str] = None   # ← ADD THIS
    lead_status: LeadStatus
    counsellor_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class StudentProfileOut(BaseModel):
    id: int
    email: str
    letzstudy_email:str
    first_name: Optional[str]
    middle_name: Optional[str]
    last_name: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    marital_status: Optional[str]
    nationality: Optional[str]
    citizenship: Optional[str]
    dual_citizenship: Optional[bool]
    phone: Optional[str]

    mailing_address1: Optional[str]
    mailing_address2: Optional[str]
    mailing_city: Optional[str]
    mailing_state: Optional[str]
    mailing_country: Optional[str]
    mailing_pincode: Optional[str]

    same_as_mailing: Optional[bool]
    permanent_address1: Optional[str]
    permanent_address2: Optional[str]
    permanent_city: Optional[str]
    permanent_state: Optional[str]
    permanent_country: Optional[str]
    permanent_pincode: Optional[str]

    passport_number: Optional[str]
    passport_issue_country: Optional[str]
    passport_issue_date: Optional[date]
    passport_expiry: Optional[date]
    city_of_birth: Optional[str]
    country_of_birth: Optional[str]

    living_in_other_country: Optional[bool]
    living_country: Optional[str]

    applied_for_immigration: Optional[bool]
    serious_medical_condition: Optional[bool]
    medical_condition_details: Optional[str]
    visa_refusal: Optional[bool]
    visa_refusal_details: Optional[str]
    visa_refusal_countries: Optional[List[str]]
    criminal_conviction: Optional[bool]
    criminal_conviction_details: Optional[str]

    emergency_contact_name: Optional[str]
    emergency_contact_email: Optional[str]
    emergency_contact_phone: Optional[str]
    emergency_contact_relation: Optional[str]

    highest_education: Optional[HighestEducation] = None
    lead_status: LeadStatus
    is_active: bool
    counsellor_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Academic Qualification ───────────────────────────────────────────────────

LEVEL_ORDER = {
    AcademicLevel.tenth: 0,
    AcademicLevel.twelfth: 1,
    AcademicLevel.diploma: 1,
    AcademicLevel.ug: 2,
    AcademicLevel.pg: 3,
}


class AcademicQualificationCreate(BaseModel):
    level: AcademicLevel
    is_highest: bool = False
    institution: str
    board_university: Optional[str] = None
    degree_name: Optional[str] = None
    field_of_study: Optional[str] = None
    specialization: Optional[str] = None
    stream: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    percentage_cgpa: Optional[float] = None
    grading_scale: Optional[str] = None
    backlogs: Optional[int] = 0
    country: Optional[str] = None

    @model_validator(mode="after")
    def validate_level_fields(self):
        level = self.level
        if level in (AcademicLevel.tenth, AcademicLevel.twelfth, AcademicLevel.diploma):
            if not self.board_university:
                raise ValueError(f"board_university is required for level '{level}'")
        if level in (AcademicLevel.ug, AcademicLevel.pg):
            if not self.degree_name:
                raise ValueError(f"degree_name is required for level '{level}'")
            if not self.field_of_study:
                raise ValueError(f"field_of_study is required for level '{level}'")
        return self


class AcademicQualificationOut(BaseModel):
    id: int
    student_id: int
    level: AcademicLevel
    is_highest: bool
    institution: Optional[str]
    board_university: Optional[str]
    degree_name: Optional[str]
    field_of_study: Optional[str]
    specialization: Optional[str]
    stream: Optional[str]
    start_year: Optional[int]
    end_year: Optional[int]
    percentage_cgpa: Optional[float]
    grading_scale: Optional[str]
    backlogs: Optional[int]
    country: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Work Experience ──────────────────────────────────────────────────────────

class WorkExperienceCreate(BaseModel):
    company_name: str
    job_title: str
    employment_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False
    description: Optional[str] = None
    country: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.is_current and self.end_date:
            raise ValueError("end_date must be empty when is_current is True")
        if not self.is_current and not self.end_date:
            raise ValueError("end_date is required when is_current is False")
        return self


class WorkExperienceOut(BaseModel):
    id: int
    student_id: int
    company_name: Optional[str]
    job_title: Optional[str]
    employment_type: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    is_current: bool
    description: Optional[str]
    country: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Test Type Template (Admin-managed) ───────────────────────────────────────

class SectionDefinition(BaseModel):
    key: str
    label: str
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = 1.0


class TestTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    has_overall_score: bool = True
    overall_score_label: str = "Overall Score"
    overall_score_min: Optional[float] = None
    overall_score_max: Optional[float] = None
    overall_score_step: float = 1.0
    sections: Optional[List[SectionDefinition]] = None
    has_expiry: bool = True
    validity_years: Optional[int] = None


class TestTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    has_overall_score: Optional[bool] = None
    overall_score_label: Optional[str] = None
    overall_score_min: Optional[float] = None
    overall_score_max: Optional[float] = None
    overall_score_step: Optional[float] = None
    sections: Optional[List[SectionDefinition]] = None
    has_expiry: Optional[bool] = None
    validity_years: Optional[int] = None


class TestTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    has_overall_score: bool
    overall_score_label: str
    overall_score_min: Optional[float]
    overall_score_max: Optional[float]
    overall_score_step: float
    sections: Optional[List[SectionDefinition]]
    has_expiry: bool
    validity_years: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Test Score (Student entry) ───────────────────────────────────────────────

class TestScoreCreate(BaseModel):
    test_type_id: int
    test_date: Optional[date] = None
    expiry_date: Optional[date] = None
    overall_score: Optional[float] = None
    section_scores: Optional[Dict[str, float]] = None
    status: str = "pending"


class TestScoreOut(BaseModel):
    id: int
    student_id: int
    test_type_id: int
    test_type_ref: Optional[TestTypeOut]
    test_date: Optional[date]
    expiry_date: Optional[date]
    overall_score: Optional[float]
    section_scores: Optional[Dict[str, float]]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Custom Profile Field (Admin definition) ──────────────────────────────────

class CustomProfileFieldCreate(BaseModel):
    field_name: str
    field_type: CustomFieldType
    section_key: str
    student_id: int
    placeholder: Optional[str] = None
    is_required: bool = False
    sort_order: int = 0
    dropdown_options: Optional[List[str]] = None

    @model_validator(mode="after")
    def validate_dropdown(self):
        if self.field_type == CustomFieldType.dropdown:
            if not self.dropdown_options or len(self.dropdown_options) < 2:
                raise ValueError("dropdown_options must have at least 2 items for dropdown fields")
        return self


class CustomProfileFieldUpdate(BaseModel):
    field_name: Optional[str] = None
    field_type: Optional[CustomFieldType] = None
    placeholder: Optional[str] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    dropdown_options: Optional[List[str]] = None


class CustomProfileFieldOut(BaseModel):
    id: int
    field_name: str
    field_type: CustomFieldType
    section_key: str
    student_id: int
    placeholder: Optional[str]
    is_required: bool
    is_active: bool
    sort_order: int
    dropdown_options: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Custom Field Value (Student) ─────────────────────────────────────────────

class CustomFieldValueUpsert(BaseModel):
    field_id: int
    value: Optional[Any] = None


class CustomFieldValueOut(BaseModel):
    id: int
    student_id: int
    field_id: int
    value_text: Optional[str]

    class Config:
        from_attributes = True


class CustomFieldValueBulkUpsert(BaseModel):
    values: List[CustomFieldValueUpsert]




class DocumentFieldCreate(BaseModel):
    doc_type: DocumentType = DocumentType.other
    label: str
    category: DocumentCategory = DocumentCategory.other
    is_required: bool = False
    sort_order: int = 0
    instructions: Optional[str] = None

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v):
        if not v.strip():
            raise ValueError("label must not be empty")
        return v.strip()


class DocumentFieldUpdate(BaseModel):
    label: Optional[str] = None
    category: Optional[DocumentCategory] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    instructions: Optional[str] = None


class DocumentFileOut(BaseModel):
    """A single uploaded file within a DocumentField."""
    id: int
    field_id: int
    student_id: int
    stored_name: str          # {username}_{doc_type}[_N].{ext}
    original_name: str
    file_size: int
    mime_type: str
    extracted_data: Optional[Dict[str, Any]]
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentFieldOut(BaseModel):
    """A document slot with its uploaded files nested."""
    id: int
    student_id: int
    doc_type: DocumentType
    label: str
    category: DocumentCategory
    is_required: bool
    is_active: bool
    sort_order: int
    instructions: Optional[str]
    created_at: datetime
    updated_at: datetime
    files: List[DocumentFileOut] = []

    class Config:
        from_attributes = True


# ─── Seed payload ─────────────────────────────────────────────────────────────
#
# Admin can POST this to seed all standard document fields for a student at once.

class SeedStandardFieldsRequest(BaseModel):
    """
    Seed all standard DocumentField entries for a student.
    Pass category filter to seed only a subset (optional).
    """
    categories: Optional[List[DocumentCategory]] = None   # None = seed all


# ─── University ───────────────────────────────────────────────────────────────

# class UniversityCreate(BaseModel):
#     name: str
#     country: Optional[str] = None
#     city: Optional[str] = None
#     website: Optional[str] = None
#     ranking: Optional[int] = None


# class UniversityOut(UniversityCreate):
#     id: int

#     class Config:
#         from_attributes = True



from typing import Literal

# ─── University ───────────────────────────────────────────────────────────────

class UniversityCreate(BaseModel):
    name: str
    country: str                  # REQUIRED
    city: Optional[str] = None    # OPTIONAL
    category: Literal["global", "superior", "kings"]


class UniversityUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    category: Optional[Literal["global", "superior", "kings"]] = None


class UniversityOut(BaseModel):
    id: int
    name: str
    country: str
    city: Optional[str] = None
    category: str

    class Config:
        from_attributes = True


# ─── Application ─────────────────────────────────────────────────────────────

class ApplicationCreate(BaseModel):
    university_id: int
    course_name: str
    intake_month: Optional[str] = None
    intake_year: Optional[int] = None
    application_deadline: Optional[date] = None
    tuition_fee: Optional[float] = None
    currency: str = "USD"
    application_fee: Optional[float] = None
    notes: Optional[str] = None
    representative: Optional[str] = None   # ✅ MUST ADD


class ApplicationUpdate(BaseModel):
    course_name: Optional[str] = None
    specialization: Optional[str] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    course_duration_months: Optional[int] = None
    intake_month: Optional[str] = None
    intake_year: Optional[int] = None
    application_deadline: Optional[date] = None
    tuition_fee: Optional[float] = None
    currency: Optional[str] = None
    scholarship_amount: Optional[float] = None
    campus_location: Optional[str] = None
    delivery_mode: Optional[str] = None
    student_id_on_letter: Optional[str] = None
    application_fee: Optional[float] = None
    application_status: Optional[ApplicationStatus] = None
    status_reason:Optional[str] = None
    visa_status: Optional[VisaStatus] = None
    visa_applied_date: Optional[date] = None
    visa_decision_date: Optional[date] = None
    notes: Optional[str] = None
    payment_mode: Optional[str] = None
    priority: Optional[str] = None


class ApplicationOut(BaseModel):
    id: int
    student_id: int
    university_id: int
    university: UniversityOut
    course_name: str
    intake_month: Optional[str]
    intake_year: Optional[int]
    application_deadline: Optional[date]
    specialization: Optional[str] 
    course_start_date: Optional[date] 
    course_end_date: Optional[date] 
    course_duration_months: Optional[int] 
    tuition_fee: Optional[float]
    currency: str
    representative: Optional[str] = None
    scholarship_amount: Optional[float]
    campus_location: Optional[str] 
    delivery_mode: Optional[str] 
    student_id_on_letter: Optional[str]
    status_reason:Optional[str]
    application_fee: Optional[float]
    application_status: ApplicationStatus
    visa_status: VisaStatus
    visa_applied_date: Optional[date]
    payment_mode: Optional[str] = None
    priority: Optional[str] = None
    visa_decision_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Application Message ──────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    message: str


class MessageOut(BaseModel):
    id: int
    application_id: int
    sender_type: str
    sender_id: int
    message: str
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Services ─────────────────────────────────────────────────────────────────

class StudentServiceCreate(BaseModel):
    student_id: int
    service_type: ServiceType
    provider: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None


class StudentServiceOut(StudentServiceCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Payments ─────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    student_id: Optional[int] = None
    manual_student_name: Optional[str] = None   # ← NEW
    application_id: Optional[int] = None
    amount: float
    currency: str = "INR"
    payment_type: str
    payment_mode: Optional[str] = None
    status: PaymentStatus = PaymentStatus.pending
    payment_date: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    paid_amount: Optional[float] = None
    due_date: Optional[date] = None   # ✅ ADD THIS
 
    @model_validator(mode="after")
    def validate_student_source(self):
        has_registered = self.student_id is not None
        has_manual = bool(self.manual_student_name and self.manual_student_name.strip())
        if not has_registered and not has_manual:
            raise ValueError(
                "Either student_id (registered student) or manual_student_name (walk-in) must be provided."
            )
        if has_registered and has_manual:
            raise ValueError(
                "Provide either student_id or manual_student_name, not both."
            )
        return self

class PaymentUpdate(BaseModel):
    status: Optional[PaymentStatus] = None
    payment_date: Optional[date] = None
    reference: Optional[str] = None
    payment_mode: Optional[str] = None
    amount: Optional[float] = None
    paid_amount: Optional[float] = None
    notes: Optional[str] = None  
    due_date: Optional[date] = None   # ✅ ADD THIS



 
class PaymentOut(BaseModel):
    id: int
    student_id: Optional[int]
    manual_student_name: Optional[str]          # ← NEW
    application_id: Optional[int]
    amount: float
    currency: str
    payment_type: str
    payment_mode: Optional[str]
    status: PaymentStatus
    payment_date: Optional[date]
    reference: Optional[str]
    notes: Optional[str]
    paid_amount: Optional[float]
    created_at: datetime
    due_date:Optional[date]
 
    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    items: List[PaymentOut]
    total: int

    class Config:
        from_attributes = True
# ─── Dashboard KPIs ───────────────────────────────────────────────────────────

class StudentKPIs(BaseModel):
    total_students:int
    total_leads: int
    total_converted: int
    total_applications: int
    admits_received: int
    visa_applied: int
    visa_approved: int
    visa_rejected: int
    total_payment_done: float
    payment_pending: float


class ServiceKPIs(BaseModel):
    test_prep: int
    accommodation: int
    flywire: int
    loan: int
    forex: int
    visa_assistance: int


class DashboardResponse(BaseModel):
    student_kpis: StudentKPIs
    service_kpis: ServiceKPIs


# ─── Student Pre/Post Application Summary ─────────────────────────────────────

class StudentPreAppSummary(BaseModel):
    has_personal_info: bool
    academic_count: int
    highest_academic_level: Optional[AcademicLevel]
    work_exp_count: int
    test_scores: List[TestScoreOut]
    documents_count: int
    custom_fields_filled: int
    custom_fields_total: int


class StudentPostAppSummary(BaseModel):
    applications: List[ApplicationOut]


# ─── Notes Schemas ────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    title: Optional[str] = "Untitled"
    content: Optional[str] = ""
    parent_id: Optional[int] = None
    student_id: Optional[int] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[int] = None
    student_id: Optional[int] = None


class NoteOut(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    parent_id: Optional[int] = None
    student_id: Optional[int] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NoteFileOut(BaseModel):
    id: int
    note_id: int
    file_name: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True
        
        
class StudentNoteCreate(BaseModel):
    student_id: int
    title: Optional[str] = "Untitled"
    content: Optional[str] = ""
    parent_id: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = "medium"
    tags: Optional[List[str]] = []


class StudentNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None


class StudentNoteOut(BaseModel):
    id: int
    student_id: int
    title: str
    content: Optional[str] = None
    parent_id: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = []
    created_by: int
    created_at: datetime
    updated_at: datetime

  
    class Config:
        from_attributes = True


class EnquiryStudentCreate(BaseModel):
    name: str
    intake_year: int
    intake_month: Optional[str] = None
 
    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        return v
 
    @field_validator("intake_year")
    @classmethod
    def year_reasonable(cls, v: int) -> int:
        if v < 2000 or v > 2100:
            raise ValueError("intake_year must be between 2000 and 2100")
        return v
 
 
class EnquiryStudentUpdate(BaseModel):
    name: Optional[str] = None
    intake_year: Optional[int] = None
    intake_month: Optional[str] = None
    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("name must not be empty")
        return v
 
    @field_validator("intake_year")
    @classmethod
    def year_reasonable(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 2000 or v > 2100):
            raise ValueError("intake_year must be between 2000 and 2100")
        return v
 
 
class EnquiryStudentOut(BaseModel):
    id: int
    name: str
    intake_year: int
    intake_month: Optional[str] = None 
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
 
    class Config:
        from_attributes = True
 
 
# ─── Enquiry Note ─────────────────────────────────────────────────────────────
 
class EnquiryNoteCreate(BaseModel):
    enquiry_id: int
    title: Optional[str] = "Untitled"
    content: Optional[str] = ""
    parent_id: Optional[int] = None
 
 
class EnquiryNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[int] = None
 
 
class EnquiryNoteOut(BaseModel):
    id: int
    enquiry_id: int
    parent_id: Optional[int] = None
    title: str
    content: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Country Document Templates ───────────────────────────────────────────────

class CountryTemplateFieldIn(BaseModel):
    doc_type: DocumentType = DocumentType.other
    label: str
    category: DocumentCategory = DocumentCategory.other
    is_required: bool = False
    sort_order: int = 0
    instructions: Optional[str] = None

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("label must not be empty")
        return v.strip()


class CountryTemplateFieldOut(BaseModel):
    id: int
    template_id: int
    doc_type: DocumentType
    label: str
    category: DocumentCategory
    is_required: bool
    sort_order: int
    instructions: Optional[str] = None

    class Config:
        from_attributes = True


class CountryTemplateCreate(BaseModel):
    """Create or upsert a country template by name with its fields."""
    country: str
    fields: List[CountryTemplateFieldIn] = []

    @field_validator("country")
    @classmethod
    def country_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("country must not be empty")
        return v.strip()


class CountryTemplateOut(BaseModel):
    id: int
    country: str
    created_at: datetime
    updated_at: datetime
    fields: List[CountryTemplateFieldOut] = []

    class Config:
        from_attributes = True


class CountryTemplateSummary(BaseModel):
    """Lightweight listing — no nested field data."""
    id: int
    country: str
    field_count: int
    updated_at: datetime

    class Config:
        from_attributes = True


class SaveTemplateFromStudentRequest(BaseModel):
    """Copy selected DocumentField rows from a student into a country template."""
    country: str
    field_ids: List[int] = []

    @field_validator("country")
    @classmethod
    def country_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("country must not be empty")
        return v.strip()
