"""
Admin-only endpoints for:
  1. TestType template CRUD  (defines the scoring schema for IELTS, GRE, etc.)
  2. CustomProfileField CRUD (defines extra fields scoped per-student)

Endpoint inventory (cross-referenced against the frontend):

  POST   /api/admin/custom-fields
      → InlineAdminFieldAdder.save()
      → Creates a field scoped to a specific student + section_key

  GET    /api/admin/custom-fields/student/{student_id}?active_only=true
      → StudentProfileModal useEffect (admin path)
      → Returns all active custom field definitions for that student

  DELETE /api/admin/custom-fields/student/{student_id}/{field_id}
      → Admin Config tab "Delete" button
      → Soft- or hard-deletes the field definition

  GET    /api/students/{student_id}/custom-field-values
      → StudentProfileModal useEffect (both admin and student paths)
      → Returns [{field_id, value_text}] for the student

  PUT    /api/students/{student_id}/custom-fields
      → ApplicationsTab.saveCustomFields()
      → Upserts a batch of field values for the student

  GET    /api/students/{student_id}/post-application-fields
      → StudentProfileModal useEffect (student/non-admin path)
      → Returns only post_application fields visible to the student
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import UserRole, TestType, CustomProfileField, StudentCustomFieldValue
from app.schemas.schemas import (
    TestTypeCreate, TestTypeUpdate, TestTypeOut,
    CustomProfileFieldCreate, CustomProfileFieldUpdate, CustomProfileFieldOut,
    CustomFieldValueOut,
)

router = APIRouter(prefix="/api/admin", tags=["Admin Configuration"])

admin_only = require_roles(UserRole.admin)


# ══════════════════════════════════════════════════════════════════════════════
# TEST TYPE TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/test-types", response_model=TestTypeOut, status_code=201)
def create_test_type(
    payload: TestTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """Admin creates a new test type template."""
    if db.query(TestType).filter(TestType.name == payload.name).first():
        raise HTTPException(status_code=400, detail=f"Test type '{payload.name}' already exists")

    sections_data = (
        [s.model_dump() for s in payload.sections] if payload.sections else None
    )

    test_type = TestType(
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
        has_overall_score=payload.has_overall_score,
        overall_score_label=payload.overall_score_label,
        overall_score_min=payload.overall_score_min,
        overall_score_max=payload.overall_score_max,
        overall_score_step=payload.overall_score_step,
        sections=sections_data,
        has_expiry=payload.has_expiry,
        validity_years=payload.validity_years,
        created_by=current_user.id,
    )
    db.add(test_type)
    db.commit()
    db.refresh(test_type)
    return test_type


@router.get("/test-types", response_model=List[TestTypeOut])
def list_test_types(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),   # any authenticated user can read
    include_inactive: bool = False,
    active_only: bool = False,
):
    """List all test type templates."""
    q = db.query(TestType)
    if active_only or not include_inactive:
        q = q.filter(TestType.is_active == True)
    return q.order_by(TestType.name).all()


@router.get("/test-types/{test_type_id}", response_model=TestTypeOut)
def get_test_type(
    test_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tt = db.query(TestType).filter(TestType.id == test_type_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Test type not found")
    return tt


@router.patch("/test-types/{test_type_id}", response_model=TestTypeOut)
def update_test_type(
    test_type_id: int,
    payload: TestTypeUpdate,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    tt = db.query(TestType).filter(TestType.id == test_type_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Test type not found")

    data = payload.model_dump(exclude_unset=True)
    if "sections" in data and data["sections"] is not None:
        data["sections"] = [s.model_dump() for s in payload.sections]

    for k, v in data.items():
        setattr(tt, k, v)
    db.commit()
    db.refresh(tt)
    return tt


@router.delete("/test-types/{test_type_id}", status_code=204)
def delete_test_type(
    test_type_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    from app.models.user import TestScore
    tt = db.query(TestType).filter(TestType.id == test_type_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Test type not found")

    score_count = db.query(TestScore).filter(TestScore.test_type_id == test_type_id).count()
    if score_count > 0:
        tt.is_active = False
        db.commit()
    else:
        db.delete(tt)
        db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM PROFILE FIELD DEFINITIONS
# ══════════════════════════════════════════════════════════════════════════════
#
# Fields are scoped per-student (student_id FK) so adding a field for student A
# has zero effect on student B.
#
# section_key drives visibility:
#   "pre_application"  → admin-only; student cannot see or interact with this
#   "post_application" → admin can set; student can also read and fill in values


@router.post("/custom-fields", response_model=CustomProfileFieldOut, status_code=201)
def create_custom_field(
    payload: CustomProfileFieldCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Admin creates a custom field for a specific student.
    Called by InlineAdminFieldAdder in the frontend.
    """
    field = CustomProfileField(
        field_name=payload.field_name,
        field_type=payload.field_type,
        student_id=payload.student_id,
        section_key=payload.section_key,   # "pre_application" or "post_application"
        placeholder=payload.placeholder,
        is_required=payload.is_required,
        is_active=True,
        sort_order=payload.sort_order,
        dropdown_options=payload.dropdown_options if payload.field_type.value == "dropdown" else None,
        created_by=current_user.id,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.get("/custom-fields/student/{student_id}", response_model=List[CustomProfileFieldOut])
def get_student_custom_fields(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
    active_only: bool = True,
):
    """
    Returns ALL custom field definitions for a given student (both sections).
    Admin-only — used by StudentProfileModal on load and after field creation.
    """
    q = db.query(CustomProfileField).filter(
        CustomProfileField.student_id == student_id
    )
    if active_only:
        q = q.filter(CustomProfileField.is_active == True)
    return q.order_by(CustomProfileField.sort_order, CustomProfileField.id).all()


@router.delete("/custom-fields/student/{student_id}/{field_id}", status_code=204)
def delete_student_custom_field(
    student_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    """
    Soft-delete (is_active=False) if the field has saved values;
    hard-delete otherwise.
    Called from the Admin Config tab "Delete" button.
    Path: /api/admin/custom-fields/student/{studentId}/{fieldId}
    """
    field = db.query(CustomProfileField).filter(
        CustomProfileField.id == field_id,
        CustomProfileField.student_id == student_id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")

    value_count = db.query(StudentCustomFieldValue).filter(
        StudentCustomFieldValue.field_id == field_id
    ).count()

    if value_count > 0:
        field.is_active = False
        db.commit()
    else:
        db.delete(field)
        db.commit()


# ── Legacy global list (admin management page, if needed) ─────────────────────

@router.get("/custom-fields", response_model=List[CustomProfileFieldOut])
def list_all_custom_fields(
    db: Session = Depends(get_db),
    _=Depends(admin_only),
    include_inactive: bool = False,
    active_only: bool = False,
    section_key: Optional[str] = None,
):
    """List all custom profile field definitions across all students (admin only)."""
    q = db.query(CustomProfileField)
    if active_only or not include_inactive:
        q = q.filter(CustomProfileField.is_active == True)
    if section_key:
        q = q.filter(CustomProfileField.section_key == section_key)
    return q.order_by(CustomProfileField.sort_order, CustomProfileField.id).all()


@router.patch("/custom-fields/{field_id}", response_model=CustomProfileFieldOut)
def update_custom_field(
    field_id: int,
    payload: CustomProfileFieldUpdate,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    field = db.query(CustomProfileField).filter(CustomProfileField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(field, k, v)
    db.commit()
    db.refresh(field)
    return field


@router.put("/custom-fields/reorder", response_model=List[CustomProfileFieldOut])
def reorder_custom_fields(
    field_order: List[int],
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    """Admin reorders custom fields by passing a list of IDs in the desired order."""
    for sort_index, field_id in enumerate(field_order):
        db.query(CustomProfileField).filter(
            CustomProfileField.id == field_id
        ).update({"sort_order": sort_index})
    db.commit()
    return db.query(CustomProfileField).order_by(CustomProfileField.sort_order).all()


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM FIELD VALUES — shared routes used by admin, counsellor, and student
# Registered on the admin router but also re-exported via the students router
# ══════════════════════════════════════════════════════════════════════════════
#
# NOTE: The two endpoints below are also needed at:
#   GET  /api/students/{student_id}/custom-field-values
#   PUT  /api/students/{student_id}/custom-fields
#
# Those are registered in the students router (students.py).
# The admin router duplicates them here so admin tooling can also reach them.

@router.get("/students/{student_id}/custom-field-values")
def admin_get_student_field_values(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    """Get all custom field values for a specific student (admin view)."""
    values = db.query(StudentCustomFieldValue).filter(
        StudentCustomFieldValue.student_id == student_id
    ).all()
    return [{"field_id": v.field_id, "value_text": v.value_text} for v in values]


@router.put("/students/{student_id}/custom-fields")
def admin_set_student_field_values(
    student_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    """
    Upsert custom field values for a specific student (admin).
    Payload: {"values": [{"field_id": 1, "value": "some text"}, ...]}
    """
    values = payload.get("values", [])
    for item in values:
        field_id = item.get("field_id")
        value_text = str(item.get("value", "")) if item.get("value") is not None else ""
        existing = db.query(StudentCustomFieldValue).filter(
            StudentCustomFieldValue.student_id == student_id,
            StudentCustomFieldValue.field_id == field_id,
        ).first()
        if existing:
            existing.value_text = value_text
        else:
            db.add(StudentCustomFieldValue(
                student_id=student_id,
                field_id=field_id,
                value_text=value_text,
            ))
    db.commit()
    return {"status": "ok", "updated": len(values)}