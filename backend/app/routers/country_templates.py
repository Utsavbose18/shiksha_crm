"""
Country Document Templates

Reusable per-country document checklists. Lets counsellors save the current
document selection on one student as a template keyed by country, then apply
that template on any future student with one click so they don't have to
recreate / hide custom fields each time.

Endpoints
─────────
  GET    /api/country-templates/
      List all templates (id, country, field_count, updated_at).

  GET    /api/country-templates/{template_id}
      Get one template with all its fields.

  POST   /api/country-templates/
      Upsert by country: create new, or replace the fields of the existing
      template with the same country. Payload: { country, fields: [...] }

  DELETE /api/country-templates/{template_id}
      Delete a template (and its fields).

  POST   /api/country-templates/save-from-student/{student_id}
      Snapshot the current document selection for a student into a country
      template. Payload: { country, field_ids: [int, ...] }

  POST   /api/country-templates/{template_id}/apply-to-student/{student_id}
      Materialise the template as DocumentField rows on the student. Skips
      fields that already exist (matched on doc_type + label).
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import (
    CountryDocTemplate, CountryDocTemplateField,
    DocumentField, UserRole,
)
from app.routers.students import _assert_access, _get_student_or_404
from app.schemas.schemas import (
    CountryTemplateCreate, CountryTemplateOut, CountryTemplateSummary,
    DocumentFieldOut, SaveTemplateFromStudentRequest,
)

router = APIRouter(prefix="/api/country-templates", tags=["Country Document Templates"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _assert_staff(current_user) -> None:
    if current_user.role not in (UserRole.admin, UserRole.counsellor):
        raise HTTPException(status_code=403, detail="Staff access required")


def _get_template_or_404(db: Session, template_id: int) -> CountryDocTemplate:
    tpl = db.query(CountryDocTemplate).filter(CountryDocTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Country template not found")
    return tpl


def _replace_template_fields(db: Session, tpl: CountryDocTemplate, fields: list) -> None:
    """Drop existing fields and recreate from payload."""
    db.query(CountryDocTemplateField).filter(
        CountryDocTemplateField.template_id == tpl.id
    ).delete(synchronize_session=False)

    for idx, spec in enumerate(fields):
        db.add(CountryDocTemplateField(
            template_id=tpl.id,
            doc_type=spec.doc_type,
            label=spec.label,
            category=spec.category,
            is_required=spec.is_required,
            sort_order=spec.sort_order if spec.sort_order else idx,
            instructions=spec.instructions,
        ))


# ─── List / Get ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CountryTemplateSummary])
def list_templates(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """All authenticated users can read templates; staff can mutate them."""
    rows = (
        db.query(
            CountryDocTemplate.id,
            CountryDocTemplate.country,
            CountryDocTemplate.updated_at,
            func.count(CountryDocTemplateField.id).label("field_count"),
        )
        .outerjoin(CountryDocTemplateField, CountryDocTemplateField.template_id == CountryDocTemplate.id)
        .group_by(CountryDocTemplate.id)
        .order_by(CountryDocTemplate.country)
        .all()
    )
    return [
        CountryTemplateSummary(
            id=r.id, country=r.country, updated_at=r.updated_at, field_count=r.field_count or 0,
        )
        for r in rows
    ]


@router.get("/{template_id}", response_model=CountryTemplateOut)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _get_template_or_404(db, template_id)


# ─── Create / Upsert ─────────────────────────────────────────────────────────

@router.post("/", response_model=CountryTemplateOut, status_code=201)
def upsert_template(
    payload: CountryTemplateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a template for a country, or replace fields on the existing one."""
    _assert_staff(current_user)

    tpl = db.query(CountryDocTemplate).filter(
        func.lower(CountryDocTemplate.country) == payload.country.lower()
    ).first()

    if tpl is None:
        tpl = CountryDocTemplate(country=payload.country, created_by=current_user.id)
        db.add(tpl)
        db.flush()

    _replace_template_fields(db, tpl, payload.fields)
    db.commit()
    db.refresh(tpl)
    return tpl


# ─── Delete ──────────────────────────────────────────────────────────────────

@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _assert_staff(current_user)
    tpl = _get_template_or_404(db, template_id)
    db.delete(tpl)
    db.commit()


# ─── Save from student ───────────────────────────────────────────────────────

@router.post("/save-from-student/{student_id}", response_model=CountryTemplateOut)
def save_from_student(
    student_id: int,
    payload: SaveTemplateFromStudentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Copy the shape (doc_type/label/category/etc.) of selected DocumentField rows
    from a student into a country template. Uploaded files are NOT copied.
    """
    _assert_staff(current_user)
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    if not payload.field_ids:
        raise HTTPException(status_code=400, detail="Select at least one document to save")

    src_fields = db.query(DocumentField).filter(
        DocumentField.student_id == student_id,
        DocumentField.id.in_(payload.field_ids),
        DocumentField.is_active == True,
    ).order_by(DocumentField.sort_order, DocumentField.id).all()

    if not src_fields:
        raise HTTPException(status_code=404, detail="No matching document fields on this student")

    tpl = db.query(CountryDocTemplate).filter(
        func.lower(CountryDocTemplate.country) == payload.country.lower()
    ).first()

    if tpl is None:
        tpl = CountryDocTemplate(country=payload.country, created_by=current_user.id)
        db.add(tpl)
        db.flush()

    # Drop existing fields and rebuild from the student's selection
    db.query(CountryDocTemplateField).filter(
        CountryDocTemplateField.template_id == tpl.id
    ).delete(synchronize_session=False)

    for idx, f in enumerate(src_fields):
        db.add(CountryDocTemplateField(
            template_id=tpl.id,
            doc_type=f.doc_type,
            label=f.label,
            category=f.category,
            is_required=f.is_required,
            sort_order=idx,
            instructions=f.instructions,
        ))

    db.commit()
    db.refresh(tpl)
    return tpl


# ─── Apply to student ────────────────────────────────────────────────────────

@router.post(
    "/{template_id}/apply-to-student/{student_id}",
    response_model=List[DocumentFieldOut],
)
def apply_to_student(
    template_id: int,
    student_id: int,
    mode: str = "merge",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Apply a country template to a student.

    mode = "merge"   → add fields from the template that don't already exist
                       (matched on doc_type + label). Nothing is removed.
    mode = "replace" → make the student match the template exactly. Removes
                       any existing field that (a) isn't in the template and
                       (b) has no uploaded files. Fields with files are kept
                       for safety.

    Returns the full set of *currently active* fields after the operation.
    """
    if mode not in ("merge", "replace"):
        raise HTTPException(status_code=400, detail="mode must be 'merge' or 'replace'")

    _assert_staff(current_user)
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    tpl = _get_template_or_404(db, template_id)

    template_keys = {(str(spec.doc_type), spec.label) for spec in tpl.fields}

    # Index existing fields by key. Take only active ones — soft-deleted rows
    # are treated as gone (apply may resurrect by creating a new row).
    existing_rows = db.query(DocumentField).filter(
        DocumentField.student_id == student_id,
        DocumentField.is_active == True,
    ).all()
    existing_by_key = {(str(r.doc_type), r.label): r for r in existing_rows}

    if mode == "replace":
        # Wipe fields that aren't in the template AND have no uploaded files.
        for key, row in existing_by_key.items():
            if key in template_keys:
                continue
            if row.files:
                continue  # safety: never delete a field that has uploaded files
            db.delete(row)
        db.flush()

    # Add the template's fields that the student doesn't already have
    for spec in tpl.fields:
        key = (str(spec.doc_type), spec.label)
        if key in existing_by_key:
            continue
        field = DocumentField(
            student_id=student_id,
            doc_type=spec.doc_type,
            label=spec.label,
            category=spec.category,
            is_required=spec.is_required,
            sort_order=spec.sort_order,
            instructions=spec.instructions,
            created_by=current_user.id,
        )
        db.add(field)

    db.commit()

    return db.query(DocumentField).filter(
        DocumentField.student_id == student_id,
        DocumentField.is_active == True,
    ).order_by(DocumentField.category, DocumentField.sort_order).all()


# ─── Edit endpoints (rename + remove single field) ───────────────────────────

@router.patch("/{template_id}", response_model=CountryTemplateOut)
def rename_template(
    template_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Rename a template's country. Payload: { "country": "..." }"""
    _assert_staff(current_user)
    tpl = _get_template_or_404(db, template_id)

    new_country = (payload.get("country") or "").strip()
    if not new_country:
        raise HTTPException(status_code=400, detail="country must not be empty")

    clash = db.query(CountryDocTemplate).filter(
        func.lower(CountryDocTemplate.country) == new_country.lower(),
        CountryDocTemplate.id != template_id,
    ).first()
    if clash:
        raise HTTPException(status_code=400, detail=f"A template for '{new_country}' already exists")

    tpl.country = new_country
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}/fields/{field_id}", status_code=204)
def delete_template_field(
    template_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove one field from a template (does not affect already-applied students)."""
    _assert_staff(current_user)
    _get_template_or_404(db, template_id)

    row = db.query(CountryDocTemplateField).filter(
        CountryDocTemplateField.id == field_id,
        CountryDocTemplateField.template_id == template_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template field not found")

    db.delete(row)
    db.commit()
