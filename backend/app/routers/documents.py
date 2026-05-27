"""
routers/documents.py

Complete document management system:

  DocumentField CRUD  (admin/counsellor manage slots per student)
  ├── POST   /fields/                  Create a single custom field
  ├── POST   /fields/seed              Seed all standard fields (or by category)
  ├── GET    /fields/                  List all fields (with nested files)
  ├── GET    /fields/{field_id}        Get a single field
  ├── PATCH  /fields/{field_id}        Update field metadata
  └── DELETE /fields/{field_id}        Soft-delete (is_active=False)

  DocumentFile upload / management  (students and staff upload files)
  ├── POST   /fields/{field_id}/upload Upload one or more files to a field
  ├── GET    /files/{file_id}/download Download a single file
  ├── PATCH  /files/{file_id}/verify   Toggle is_verified on a file
  └── DELETE /files/{file_id}          Hard-delete a single file

File naming convention
  stored_name = {username}_{doc_type}[_{counter}].{ext}
  where username is derived from the student's email local-part,
  counter is appended (starting at 2) when a field already has files.
"""

import io
import re
import os
import uuid
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, UploadFile,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import (
    DocumentCategory, DocumentField, DocumentFile, DocumentType,
    Student, UserRole,
)
from app.routers.students import _assert_access, _get_student_or_404
from app.schemas.schemas import (
    DocumentFieldCreate, DocumentFieldOut, DocumentFieldUpdate,
    DocumentFileOut, SeedStandardFieldsRequest,
)
# At the top of routers/documents.py, replace the old imports and _extract_from_file:

from app.services.ocr_service import extract_with_gemini, OCR_ENABLED_TYPES
from app.services.autofill_service import autofill_from_extraction

# DELETE the old _extract_from_file function entirely.
router = APIRouter(
    prefix="/api/students/{student_id}/documents",
    tags=["Documents"],
)

# ─── Constants ────────────────────────────────────────────────────────────────

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/tiff",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_FILE_SIZE = 50 * 1024 * 1024   # 10 MB per file
MAX_FILES_PER_UPLOAD = 20          # safety cap per request


# ─── Standard field catalogue ─────────────────────────────────────────────────
#
# Defines every built-in document slot: its type, human label, category, and
# whether it is mandatory. Admin can seed all of these in one API call.

STANDARD_FIELDS: List[dict] = [
    # ── Academic ──
    {"doc_type": DocumentType.marksheet_10,        "label": "10th mark sheet",                                    "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.marksheet_12,        "label": "12th mark sheet",                                    "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.diploma_cert,        "label": "Diploma degree certificate",                         "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.diploma_transcripts, "label": "Consolidated diploma mark sheets / transcripts (official)",  "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.ug_provisional_cert,  "label": "UG-Provisional certificate",                            "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.ug_degree_cert,       "label": "UG degree certificate",  "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.ug_degree_transcripts, "label": "Consolidated UG mark sheets / transcripts (official)",  "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.transfer_cert,       "label": "Transfer certificate (TC)",                          "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.moi_cert,            "label": "Medium of instruction (MOI) certificate",            "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.backlog_cert,        "label": "Backlog / arrear certificate",                       "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.masters_cert,         "label": "Masters degree certificate",  "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.masters_transcript,  "label": "Consolidated masters mark sheets / transcripts (official)",  "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.phd_cert,             "label": "Masters degree certificate",  "category": DocumentCategory.academic,   "is_required": False},
    {"doc_type": DocumentType.sop,                 "label": "Statement of purpose (SOP for admission)",           "category": DocumentCategory.academic, "is_required": False},
    {"doc_type": DocumentType.lor,                 "label": "Letters of recommendation (LORs) – 2 or 3",          "category": DocumentCategory.academic, "is_required": False},
    {"doc_type": DocumentType.cv,                  "label": "Resume / CV (updated, professional)",                "category": DocumentCategory.academic, "is_required": False},
    
    # ── Language & entrance scores ──
    {"doc_type": DocumentType.ielts,               "label": "IELTS score report",                                 "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.toefl,               "label": "TOEFL score report",                                 "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.pte,                 "label": "PTE score report",                                   "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.duolingo,            "label": "Duolingo score report",                              "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.gre,                 "label": "GRE score report",                                   "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.gmat,                "label": "GMAT score report",                                  "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.sat,                 "label": "SAT score report",                                   "category": DocumentCategory.language,   "is_required": False},
    {"doc_type": DocumentType.act,                 "label": "ACT score report",                                   "category": DocumentCategory.language,   "is_required": False},


    {"doc_type": DocumentType.bank_statements,     "label": "Bank statements (last 6–12 months)",                 "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.bank_balance_cert,   "label": "Bank balance certificate",                           "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.fd_certs,            "label": "Fixed deposit (FD) certificates",                    "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.education_loan,      "label": "Education loan sanction letter",                     "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.itr,                 "label": "Income tax returns (ITR) – last 2–3 years",          "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.salary_slips,        "label": "Salary slips (last 3–6 months)",                    "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.employment_letter,   "label": "Employment letter (sponsor)",                        "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.gst_cert,            "label": "GST certificate (self-employed sponsor)",            "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.business_reg,        "label": "Business registration proof",                        "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.property_valuation,  "label": "Property valuation",                                 "category": DocumentCategory.financial,  "is_required": False},
    {"doc_type": DocumentType.affidavit_support,   "label": "Affidavit of support (sponsor letter)",              "category": DocumentCategory.financial,  "is_required": False},

    # ── Visa ──
    {"doc_type": DocumentType.passport,            "label": "Valid passport (min 6–12 months validity)",          "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.offer_letter,        "label": "Offer letter / admission letter",                    "category": DocumentCategory.visa,       "is_required": False,          "instructions": "__letzstudy__"},
    {"doc_type": DocumentType.cas_i20_coe,         "label": "CAS (UK) / I-20 (USA) / COE (Australia) or equivalent", "category": DocumentCategory.visa,  "is_required": False},
    {"doc_type": DocumentType.visa_form,           "label": "Visa application form",                              "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.visa_fee_receipt,    "label": "Visa fee payment receipt",                           "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.sevis_receipt,       "label": "SEVIS fee receipt (USA)",                            "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.gta_sop,             "label": "GTE / SOP (statement of purpose for visa)",          "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.biometrics_confirmation, "label": "Biometrics appointment confirmation",            "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.medical_report,      "label": "Medical test report",                                "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.pcc,                 "label": "Police clearance certificate (PCC)",                 "category": DocumentCategory.visa,       "is_required": False},
    {"doc_type": DocumentType.travel_insurance,    "label": "Travel insurance",                                   "category": DocumentCategory.visa,       "is_required": False},


   
    {"doc_type": DocumentType.portfolio,           "label": "Portfolio (for design / architecture courses)",      "category": DocumentCategory.supporting, "is_required": False},
    {"doc_type": DocumentType.work_exp_letter,     "label": "Work experience letters",                            "category": DocumentCategory.supporting, "is_required": False},
    {"doc_type": DocumentType.internship_cert,     "label": "Internship certificates",                            "category": DocumentCategory.supporting, "is_required": False},
    {"doc_type": DocumentType.extracurricular_cert,"label": "Extracurricular certificates",                       "category": DocumentCategory.supporting, "is_required": False},
    {"doc_type": DocumentType.passport_photo,      "label": "Passport-size photographs (as per visa specs)",      "category": DocumentCategory.supporting, "is_required": False},
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_field_or_404(db: Session, field_id: int, student_id: int) -> DocumentField:
    field = (
        db.query(DocumentField)
        .filter(DocumentField.id == field_id, DocumentField.student_id == student_id)
        .first()
    )
    if not field:
        raise HTTPException(status_code=404, detail="Document field not found")
    return field


def _get_file_or_404(db: Session, file_id: int, student_id: int) -> DocumentFile:
    doc_file = (
        db.query(DocumentFile)
        .filter(DocumentFile.id == file_id, DocumentFile.student_id == student_id)
        .first()
    )
    if not doc_file:
        raise HTTPException(status_code=404, detail="Document file not found")
    return doc_file


def _assert_staff(current_user) -> None:
    """Only admin or counsellor may manage field definitions."""
    if current_user.role not in (UserRole.admin, UserRole.counsellor):
        raise HTTPException(status_code=403, detail="Staff access required")


def build_safe_filename(original_name: str) -> str:
    """
    Preserve original filename safely.

    Example:
        My Passport.pdf
        -> My_Passport_a1b2c3.pdf
    """

    base, ext = os.path.splitext(original_name)

    # Remove dangerous characters
    safe_base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)

    # Prevent extremely long filenames
    safe_base = safe_base[:100]

    unique_suffix = uuid.uuid4().hex[:6]

    return f"{safe_base}_{unique_suffix}{ext.lower()}"


def _username_from_email(email: str) -> str:
    """Return the local-part of an email address."""
    return email.split("@")[0]


def _extract_from_file(content: bytes, mime_type: str, doc_type: str) -> dict:
    """Run OCR on the uploaded file and return extracted data."""
    try:
        import pytesseract
        from PIL import Image
        import fitz

        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

        if mime_type == "application/pdf":
            pdf_doc = fitz.open(stream=content, filetype="pdf")
            page = pdf_doc[0]
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        else:
            img = Image.open(io.BytesIO(content))

        raw_text = pytesseract.image_to_string(img)
    except Exception:
        return {"raw_ocr": None, "error": "OCR unavailable"}

    extracted = {"raw_ocr": raw_text}

    # Passport MRZ extraction
    if doc_type == DocumentType.passport:
        mrz = re.findall(r"[A-Z<]{10,}", raw_text)
        if mrz:
            extracted["mrz_lines"] = mrz[:2]

    return extracted


# ─── DocumentField endpoints ──────────────────────────────────────────────────
@router.post("/fields/seed", response_model=List[DocumentFieldOut], status_code=201)
def seed_standard_fields(
    student_id: int,
    payload: SeedStandardFieldsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Seed all standard document fields for a student in one call.
    Already-existing fields (matched by student_id + doc_type + label) are skipped.
    Pass 'categories' list to seed only a subset, e.g. ["academic", "visa"].
    Staff only.
    """
    _get_student_or_404(db, student_id)
    _assert_staff(current_user)

    # Fetch existing (doc_type, label) pairs to avoid duplicates
    existing = db.query(DocumentField.doc_type, DocumentField.label).filter(
        DocumentField.student_id == student_id
    ).all()
    existing_set = {(str(r.doc_type), r.label) for r in existing}

    created: List[DocumentField] = []
    for spec in STANDARD_FIELDS:
        # Category filter
        if payload.categories and spec["category"] not in payload.categories:
            continue

        key = (str(spec["doc_type"]), spec["label"])
        if key in existing_set:
            continue

        field = DocumentField(
            student_id=student_id,
            doc_type=spec["doc_type"],
            label=spec["label"],
            category=spec["category"],
            instructions=spec.get("instructions", ""),
            is_required=spec["is_required"],
            sort_order=STANDARD_FIELDS.index(spec),
            created_by=current_user.id,
        )
        db.add(field)
        created.append(field)

    db.commit()
    for f in created:
        db.refresh(f)

    return created



@router.post("/fields/", response_model=DocumentFieldOut, status_code=201)
def create_document_field(
    student_id: int,
    payload: DocumentFieldCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    _assert_staff(current_user)
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tenant_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    new_field = DocumentField(
        tenant_id=tenant_id,
        student_id=student_id,
        doc_type=payload.doc_type,
        label=payload.label,
        category=payload.category,
        is_required=payload.is_required,
        sort_order=payload.sort_order,
        instructions=payload.instructions,
        created_by=current_user.id,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field




@router.get("/fields/", response_model=List[DocumentFieldOut])
def list_document_fields(
    student_id: int,
    category: Optional[DocumentCategory] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List all document fields for a student, with their uploaded files nested.
    Filter by category or include soft-deleted fields via query params.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    q = db.query(DocumentField).filter(DocumentField.student_id == student_id)
    if not include_inactive:
        q = q.filter(DocumentField.is_active == True)
    if category:
        q = q.filter(DocumentField.category == category)

    return q.order_by(DocumentField.category, DocumentField.sort_order).all()


@router.get("/fields/{field_id}", response_model=DocumentFieldOut)
def get_document_field(
    student_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get a single document field with its files."""
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    return _get_field_or_404(db, field_id, student_id)


@router.patch("/fields/{field_id}", response_model=DocumentFieldOut)
def update_document_field(
    student_id: int,
    field_id: int,
    payload: DocumentFieldUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update a document field's metadata (label, required flag, instructions, etc.).
    Staff only. Does not affect uploaded files.
    """
    _get_student_or_404(db, student_id)
    _assert_staff(current_user)

    field = _get_field_or_404(db, field_id, student_id)

    for attr, value in payload.model_dump(exclude_unset=True).items():
        setattr(field, attr, value)

    db.commit()
    db.refresh(field)
    return field


@router.delete("/fields/{field_id}", status_code=204)
def delete_document_field(
    student_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Soft-delete a document field (sets is_active=False).
    Uploaded files are preserved. Staff only.
    To hard-delete including files, use ?hard=true.
    """
    _get_student_or_404(db, student_id)
    _assert_staff(current_user)

    field = _get_field_or_404(db, field_id, student_id)
    field.is_active = False
    db.commit()


@router.delete("/fields/{field_id}/hard", status_code=204)
def hard_delete_document_field(
    student_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Permanently delete a document field and all its uploaded files.
    Admin only.
    """
    _get_student_or_404(db, student_id)
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    field = _get_field_or_404(db, field_id, student_id)
    db.delete(field)
    db.commit()


# ─── DocumentFile endpoints ───────────────────────────────────────────────────
@router.post("/fields/{field_id}/upload", response_model=List[DocumentFileOut], status_code=201)
async def upload_files_to_field(
    student_id: int,
    field_id: int,
    files: List[UploadFile] = File(...),
    # ── Optional: pass the linked application_id when uploading an offer letter ──
    # Frontend sends this as a query param: ?application_id=12
    application_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Upload one or more files to a document field.
    Accessible by both students and staff.

    Naming convention:
      First file  →  {username}_{doc_type}.{ext}
      Second file →  {username}_{doc_type}_2.{ext}
      ...

    Gemini OCR runs automatically for supported doc types.
    For offer_letter fields, pass ?application_id=<id> so the extracted
    fields are autofilled into the correct Application row.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    field = _get_field_or_404(db, field_id, student_id)

    if not field.is_active:
        raise HTTPException(status_code=400, detail="This document field is no longer active")

    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files in one request (max {MAX_FILES_PER_UPLOAD})",
        )

    username = student.first_name
    doc_type_str = (
    field.label if field.doc_type.value == "other"
    else field.doc_type.value
)

    existing_count = (
        db.query(DocumentFile)
        .filter(DocumentFile.field_id == field_id)
        .count()
    )

    created_files: List[DocumentFile] = []

    for idx, upload in enumerate(files):
        # ── MIME check ────────────────────────────────────────────────────────
        if upload.content_type not in ALLOWED_MIME:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{upload.content_type}' for '{upload.filename}'",
            )

        content = await upload.read()

        if not content:
            raise HTTPException(status_code=400, detail=f"File '{upload.filename}' is empty")

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File '{upload.filename}' exceeds 10 MB limit")

        original_name = upload.filename or "upload"
        ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "bin"

        stored_name = build_safe_filename(original_name)

        # ── OCR + autofill ────────────────────────────────────────────────────
        extracted = {}

        if field.doc_type in OCR_ENABLED_TYPES:
            extracted = extract_with_gemini(content, upload.content_type, field.doc_type)

            # Resolve test_type_id for language/entrance test documents
            test_type_id = None
            TEST_DOC_TYPES = {
                DocumentType.ielts, DocumentType.toefl, DocumentType.pte,
                DocumentType.duolingo, DocumentType.gre, DocumentType.gmat,
                DocumentType.sat, DocumentType.act,
            }
            if field.doc_type in TEST_DOC_TYPES:
                from app.models.user import TestType
                tt = db.query(TestType).filter(
                    TestType.name.ilike(field.doc_type.value)
                ).first()
                if tt:
                    test_type_id = tt.id

            autofill_result = autofill_from_extraction(
                db=db,
                student=student,
                doc_type=field.doc_type,
                extracted=extracted,
                test_type_id=test_type_id,
                # Pass application_id — only used when doc_type == offer_letter
                application_id=application_id,
            )

            extracted["_autofill"] = autofill_result

        # ── Persist ───────────────────────────────────────────────────────────
        doc_file = DocumentFile(
            field_id=field_id,
            student_id=student_id,
            stored_name=stored_name,
            original_name=original_name,
            file_data=content,
            file_size=len(content),
            mime_type=upload.content_type,
            extracted_data=extracted if extracted else None,
            uploaded_by=current_user.id,
        )
        db.add(doc_file)
        created_files.append(doc_file)

    db.commit()
    for f in created_files:
        db.refresh(f)

    return created_files

@router.get("/files/{file_id}/download")
def download_file(
    student_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Download a specific uploaded file by its ID.
    The response Content-Disposition uses the stored_name convention
    ({username}_{doc_type}.{ext}) so the browser saves it with the correct name.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    doc_file = _get_file_or_404(db, file_id, student_id)

    return StreamingResponse(
        io.BytesIO(doc_file.file_data),
        media_type=doc_file.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{doc_file.stored_name}"',
            "Content-Length": str(doc_file.file_size),
        },
    )


@router.patch("/files/{file_id}/verify", response_model=DocumentFileOut)
def verify_file(
    student_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Toggle is_verified on a DocumentFile.
    Staff only. Returns the updated file object.
    """
    _get_student_or_404(db, student_id)
    _assert_staff(current_user)

    doc_file = _get_file_or_404(db, file_id, student_id)
    doc_file.is_verified = not doc_file.is_verified
    db.commit()
    db.refresh(doc_file)
    return doc_file


@router.delete("/files/{file_id}", status_code=204)
def delete_file(
    student_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Permanently delete a single uploaded file.
    Accessible by both staff and the student themselves.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    doc_file = _get_file_or_404(db, file_id, student_id)
    db.delete(doc_file)
    db.commit()


# ─── Convenience: get all files across all fields ─────────────────────────────

@router.get("/files/", response_model=List[DocumentFileOut])
def list_all_files(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List every uploaded DocumentFile for a student across all fields.
    Useful for a flat document checklist view.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    return (
        db.query(DocumentFile)
        .filter(DocumentFile.student_id == student_id)
        .order_by(DocumentFile.created_at.desc())
        .all()
    )