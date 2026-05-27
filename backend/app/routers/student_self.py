"""
Student self-service endpoints (/api/me/...).
Students can only see/edit their own profile and change their password.

Updated with:
  - Full personal info update (all new fields)
  - Custom field value upsert
  - Dynamic work experience list
  - Test scores (referencing admin TestType)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, verify_password
from app.models.user import (
    Student, Application, CustomProfileField, StudentCustomFieldValue
)
from app.schemas.schemas import (
    StudentProfileOut, StudentPersonalInfoUpdate, PasswordChangeRequest,
    ApplicationOut, 
    CustomFieldValueBulkUpsert, CustomFieldValueOut, CustomProfileFieldOut,
)

router = APIRouter(prefix="/api/me", tags=["Student Self-Service"])


def _require_student(current_user=Depends(get_current_user)):
    if not isinstance(current_user, Student):
        raise HTTPException(status_code=403, detail="Only students can access this endpoint")
    return current_user


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=StudentProfileOut)
def my_profile(student: Student = Depends(_require_student)):
    return student


@router.patch("/profile", response_model=StudentProfileOut)
def update_my_profile(
    payload: StudentPersonalInfoUpdate,
    student: Student = Depends(_require_student),
    db: Session = Depends(get_db),
):
    """
    Student updates their own personal information.
    lead_status and counsellor_id are stripped — students cannot change those.
    """
    safe_fields = payload.model_dump(exclude_unset=True)
    safe_fields.pop("lead_status", None)
    safe_fields.pop("counsellor_id", None)

    for field, val in safe_fields.items():
        setattr(student, field, val)
    db.commit()
    db.refresh(student)
    return student


# ─── Password ─────────────────────────────────────────────────────────────────

@router.post("/change-password")
def student_change_password(
    payload: PasswordChangeRequest,
    student: Student = Depends(_require_student),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, student.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    student.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ─── Applications ─────────────────────────────────────────────────────────────

@router.get("/applications")
def my_applications(
    student: Student = Depends(_require_student),
    db: Session = Depends(get_db),
):
    apps = (
        db.query(Application)
        .options(joinedload(Application.university))
        .filter(Application.student_id == student.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [ApplicationOut.model_validate(a) for a in apps]


# ─── Documents ────────────────────────────────────────────────────────────────

@router.get("/documents")
def my_documents(student: Student = Depends(_require_student)):
    return [DocumentOut.model_validate(d) for d in student.documents]


# ─── Custom Profile Fields ────────────────────────────────────────────────────

@router.get("/custom-fields", response_model=List[CustomProfileFieldOut])
def get_all_custom_field_definitions(
    db: Session = Depends(get_db),
    student: Student = Depends(_require_student),
):
    """
    Returns all active custom field DEFINITIONS so the frontend can
    render the dynamic form inputs. Each definition includes type,
    label, placeholder, and dropdown options if applicable.
    """
    return (
        db.query(CustomProfileField)
        .filter(CustomProfileField.is_active == True)
        .order_by(CustomProfileField.sort_order, CustomProfileField.id)
        .all()
    )


@router.get("/custom-fields/values", response_model=List[CustomFieldValueOut])
def get_my_custom_field_values(
    db: Session = Depends(get_db),
    student: Student = Depends(_require_student),
):
    """Returns this student's submitted values for all custom fields."""
    return student.custom_field_values


@router.put("/custom-fields/values", response_model=List[CustomFieldValueOut])
def upsert_my_custom_field_values(
    payload: CustomFieldValueBulkUpsert,
    db: Session = Depends(get_db),
    student: Student = Depends(_require_student),
):
    """
    Student submits/updates their custom field values in bulk.
    Accepts a list of {field_id, value} pairs.

    Example payload:
    {
      "values": [
        {"field_id": 1, "value": "https://linkedin.com/in/johndoe"},
        {"field_id": 2, "value": "Canada"},
        {"field_id": 3, "value": "yes"},
        {"field_id": 4, "value": "3.8"},
        {"field_id": 5, "value": "Took a gap year for family reasons"}
      ]
    }
    """
    results = []
    for item in payload.values:
        field_def = db.query(CustomProfileField).filter(
            CustomProfileField.id == item.field_id,
            CustomProfileField.is_active == True,
        ).first()
        if not field_def:
            raise HTTPException(
                status_code=404, detail=f"Custom field {item.field_id} not found or inactive"
            )

        # Validate dropdown options
        if field_def.field_type.value == "dropdown" and item.value is not None:
            if str(item.value) not in (field_def.dropdown_options or []):
                raise HTTPException(
                    status_code=422,
                    detail=f"'{item.value}' is not a valid option for '{field_def.field_name}'. "
                           f"Valid options: {field_def.dropdown_options}"
                )

        existing = db.query(StudentCustomFieldValue).filter(
            StudentCustomFieldValue.student_id == student.id,
            StudentCustomFieldValue.field_id == item.field_id,
        ).first()

        value_str = str(item.value) if item.value is not None else None

        if existing:
            existing.value_text = value_str
            results.append(existing)
        else:
            new_val = StudentCustomFieldValue(
                student_id=student.id,
                field_id=item.field_id,
                value_text=value_str,
            )
            db.add(new_val)
            results.append(new_val)

    db.commit()
    for r in results:
        db.refresh(r)
    return results