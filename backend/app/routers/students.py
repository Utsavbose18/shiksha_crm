"""
Student management — listing, profile, pre/post-application sections.

New in this version:
  - Extended personal info fields (addresses, passport, background, emergency contact)
  - Academic qualification hierarchy enforcement
  - Dynamic multi-entry work experience
  - TestScore linked to admin-defined TestType templates
  - Custom profile field value upsert
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.core.database import get_db
from app.core.security import hash_password, require_roles, get_current_user
from app.models.user import (
    User, Student, UserRole,
    AcademicQualification, AcademicLevel,
    WorkExperience,
    TestScore, TestType,StudentNote,
    CustomProfileField, StudentCustomFieldValue,DocumentField, DocumentFile,
)
from app.schemas.schemas import (
    StudentCreate, StudentPersonalInfoUpdate,
    StudentListOut, StudentProfileOut,
    AcademicQualificationCreate, AcademicQualificationOut, LEVEL_ORDER,
    WorkExperienceCreate, WorkExperienceOut,
    TestScoreCreate, TestScoreOut,
    CustomFieldValueBulkUpsert, CustomFieldValueOut,
    StudentPreAppSummary,
    PasswordResetByAdmin,
)

router = APIRouter(prefix="/api/students", tags=["Students"])

staff_roles = require_roles(UserRole.admin, UserRole.counsellor)
admin_only = require_roles(UserRole.admin)
student_roles = require_roles(UserRole.admin, UserRole.counsellor, UserRole.student)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_student_or_404(db: Session, student_id: int) -> Student:
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return s


def _assert_access(current_user, student: Student):
    """Admins can access any student. Counsellors only their own. Students only themselves."""
    tenant_id = getattr(current_user, "active_tenant_id", None)

    if student.tenant_id != tenant_id and getattr(current_user, "role", None) != "platform_super_admin":
        raise HTTPException(status_code=403, detail="Student belongs to a different tenant")

    if hasattr(current_user, "role"):
        if current_user.role in [UserRole.admin, "platform_super_admin"]:
            return
        if current_user.role == UserRole.counsellor:
            if student.counsellor_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not your student")
            return

    if isinstance(current_user, Student):

        if current_user.id != student.id:
            raise HTTPException(status_code=403, detail="Access denied")
        return

    raise HTTPException(status_code=403, detail="Access denied")


def _is_student_role(current_user) -> bool:
    return isinstance(current_user, Student)


def _is_admin_or_counsellor(current_user) -> bool:
    return hasattr(current_user, "role") and current_user.role in (
        UserRole.admin, UserRole.counsellor
    )


# ─── Create / List Students ───────────────────────────────────────────────────

@router.post("/", response_model=StudentListOut, status_code=201)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    if db.query(Student).filter(Student.email == payload.email, Student.tenant_id == tenant_id).first():
        raise HTTPException(status_code=400, detail="Email already exists in this tenant")
    student = Student(
        tenant_id=tenant_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        letzstudy_email=payload.letzstudy_email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        counsellor_id=payload.counsellor_id or (
            current_user.id if current_user.role == UserRole.counsellor else None
        ),
        created_by=current_user.id,
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


from app.models.user import Application  # add to imports if not already there

@router.get("/", response_model=List[StudentListOut])
def list_students(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    lead_status: Optional[str] = None,
):
    q = db.query(Student)
    if current_user.role == UserRole.counsellor:
        q = q.filter(Student.counsellor_id == current_user.id)
    if search:
        q = q.filter(
            Student.first_name.ilike(f"%{search}%")
            | Student.last_name.ilike(f"%{search}%")
            | Student.email.ilike(f"%{search}%")
        )
    if lead_status:
        q = q.filter(Student.lead_status == lead_status)

    students = q.offset(skip).limit(limit).all()

    # Build counsellor name map
    counsellor_ids = {s.counsellor_id for s in students if s.counsellor_id}
    counsellor_map = {}
    if counsellor_ids:
        counsellors = db.query(User).filter(User.id.in_(counsellor_ids)).all()
        counsellor_map = {u.id: u.full_name for u in counsellors}

    # Build latest application status map
    from sqlalchemy import func
    latest_ts_subq = (
        db.query(
            Application.student_id,
            func.max(Application.updated_at).label("max_updated_at"),
        )
        .group_by(Application.student_id)
        .subquery()
    )
    latest_apps = (
        db.query(Application.student_id, Application.application_status)
        .join(
            latest_ts_subq,
            (Application.student_id == latest_ts_subq.c.student_id)
            & (Application.updated_at == latest_ts_subq.c.max_updated_at),
        )
        .all()
    )
    app_status_map = {row.student_id: row.application_status for row in latest_apps}

    result = []
    for s in students:
        result.append({
            "id": s.id,
            "email": s.email,
            "letzstudy_email": s.letzstudy_email,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "phone": s.phone,
            "lead_status": s.lead_status,
            "application_status": app_status_map.get(s.id),
            "counsellor_id": s.counsellor_id,
            "counsellor_name": counsellor_map.get(s.counsellor_id) if s.counsellor_id else None,
            "created_at": s.created_at,
        })

    return result


@router.get("/{student_id}", response_model=StudentProfileOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    return student


@router.patch("/{student_id}", response_model=StudentProfileOut)
def update_student(
    student_id: int,
    payload: StudentPersonalInfoUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    data = payload.model_dump(exclude_unset=True)

    # Students cannot update staff-only fields
    if _is_student_role(current_user):
        data.pop("lead_status", None)
        data.pop("counsellor_id", None)

    for field, val in data.items():
        setattr(student, field, val)
    db.commit()
    db.refresh(student)
    return student

@router.delete("/{student_id}/delete")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    student = db.query(Student).filter(Student.id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        # Deepest dependencies first

        db.query(DocumentFile).filter(
            DocumentFile.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(DocumentField).filter(
            DocumentField.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(StudentNote).filter(
            StudentNote.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(AcademicQualification).filter(
            AcademicQualification.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(WorkExperience).filter(
            WorkExperience.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(TestScore).filter(
            TestScore.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(StudentCustomFieldValue).filter(
            StudentCustomFieldValue.student_id == student_id
        ).delete(synchronize_session=False)

        db.delete(student)

        db.commit()

        return {
            "message": "Student deleted successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    

@router.post("/{student_id}/activate")
def activate_student(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    student = _get_student_or_404(db, student_id)
    student.is_active = True
    db.commit()
    return {"message": "Student activated"}


@router.post("/{student_id}/deactivate")
def deactivate_student(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    student = _get_student_or_404(db, student_id)
    student.is_active = False
    db.commit()
    return {"message": "Student deactivated"}


@router.post("/{student_id}/reset-password")
def reset_student_password(
    student_id: int,
    payload: PasswordResetByAdmin,
    db: Session = Depends(get_db),
    _=Depends(admin_only),
):
    student = _get_student_or_404(db, student_id)
    student.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password reset"}


# ─── Pre-Application Summary ──────────────────────────────────────────────────

@router.get("/{student_id}/pre-application", response_model=StudentPreAppSummary)
def pre_application_summary(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    has_personal = bool(student.first_name and student.date_of_birth and student.nationality)

    highest_level = None
    if student.academic_qualifications:
        highest_entry = max(
            student.academic_qualifications,
            key=lambda a: LEVEL_ORDER.get(a.level, -1),
        )
        highest_level = highest_entry.level

    total_custom = db.query(CustomProfileField).filter(
        CustomProfileField.student_id == student_id,
        CustomProfileField.is_active == True,
    ).count()
    filled_custom = len(student.custom_field_values)

    return StudentPreAppSummary(
        has_personal_info=has_personal,
        academic_count=len(student.academic_qualifications),
        highest_academic_level=highest_level,
        work_exp_count=len(student.work_experiences),
        test_scores=[TestScoreOut.model_validate(t) for t in student.test_scores],
        documents_count=len(student.documents),
        custom_fields_filled=filled_custom,
        custom_fields_total=total_custom,
    )


# ─── Academic Qualifications ──────────────────────────────────────────────────

def _check_academic_prerequisites(
    db: Session, student_id: int, new_highest: AcademicLevel
) -> List[str]:
    """Returns advisory warning strings for missing prerequisite levels."""
    existing_levels = {
        a.level for a in db.query(AcademicQualification)
        .filter(AcademicQualification.student_id == student_id).all()
    }
    warnings = []

    if new_highest == AcademicLevel.pg:
        if AcademicLevel.ug not in existing_levels:
            warnings.append("UG qualification is required before PG")
        if AcademicLevel.twelfth not in existing_levels and AcademicLevel.diploma not in existing_levels:
            warnings.append("12th or Diploma qualification is required")
        if AcademicLevel.tenth not in existing_levels:
            warnings.append("10th qualification is required")

    elif new_highest == AcademicLevel.ug:
        if AcademicLevel.twelfth not in existing_levels and AcademicLevel.diploma not in existing_levels:
            warnings.append("12th or Diploma qualification is required before UG")
        if AcademicLevel.tenth not in existing_levels:
            warnings.append("10th qualification is required")

    elif new_highest in (AcademicLevel.twelfth, AcademicLevel.diploma):
        if AcademicLevel.tenth not in existing_levels:
            warnings.append("10th qualification is required")

    return warnings


@router.post("/{student_id}/academic", status_code=201)
def add_academic(
    student_id: int,
    payload: AcademicQualificationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    # Prevent duplicate levels
    existing = db.query(AcademicQualification).filter(
        AcademicQualification.student_id == student_id,
        AcademicQualification.level == payload.level,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A '{payload.level}' qualification already exists. Use PATCH to update it.",
        )

    warnings = []
    if payload.is_highest:
        # Clear previous highest flag
        db.query(AcademicQualification).filter(
            AcademicQualification.student_id == student_id,
            AcademicQualification.is_highest == True,
        ).update({"is_highest": False})
        warnings = _check_academic_prerequisites(db, student_id, payload.level)

    entry = AcademicQualification(student_id=student_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)

    response = AcademicQualificationOut.model_validate(entry)
    if warnings:
        return {"data": response.model_dump(), "warnings": warnings}
    return entry


@router.get("/{student_id}/academic", response_model=List[AcademicQualificationOut])
def list_academic(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    return sorted(
        student.academic_qualifications,
        key=lambda a: LEVEL_ORDER.get(a.level, -1),
    )


@router.patch("/{student_id}/academic/{entry_id}", response_model=AcademicQualificationOut)
def update_academic(
    student_id: int,
    entry_id: int,
    payload: AcademicQualificationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = db.query(AcademicQualification).filter(
        AcademicQualification.id == entry_id,
        AcademicQualification.student_id == student_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Record not found")
    _assert_access(current_user, _get_student_or_404(db, student_id))

    if payload.is_highest and not entry.is_highest:
        db.query(AcademicQualification).filter(
            AcademicQualification.student_id == student_id,
            AcademicQualification.is_highest == True,
        ).update({"is_highest": False})

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{student_id}/academic/{entry_id}", status_code=204)
def delete_academic(
    student_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    entry = db.query(AcademicQualification).filter(
        AcademicQualification.id == entry_id,
        AcademicQualification.student_id == student_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Record not found")
    if entry.is_highest:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the highest qualification. Set another level as highest first.",
        )
    db.delete(entry)
    db.commit()


# ─── Work Experience ──────────────────────────────────────────────────────────

@router.post("/{student_id}/work", response_model=WorkExperienceOut, status_code=201)
def add_work(
    student_id: int,
    payload: WorkExperienceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    entry = WorkExperience(student_id=student_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{student_id}/work", response_model=List[WorkExperienceOut])
def list_work(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    return sorted(
        student.work_experiences,
        key=lambda w: w.start_date or date.min,
        reverse=True,
    )


@router.patch("/{student_id}/work/{entry_id}", response_model=WorkExperienceOut)
def update_work(
    student_id: int,
    entry_id: int,
    payload: WorkExperienceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = db.query(WorkExperience).filter(
        WorkExperience.id == entry_id,
        WorkExperience.student_id == student_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_access(current_user, _get_student_or_404(db, student_id))
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{student_id}/work/{entry_id}", status_code=204)
def delete_work(
    student_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    entry = db.query(WorkExperience).filter(
        WorkExperience.id == entry_id,
        WorkExperience.student_id == student_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


# ─── Test Scores ──────────────────────────────────────────────────────────────

@router.post("/{student_id}/tests", response_model=TestScoreOut, status_code=201)
def add_test(
    student_id: int,
    payload: TestScoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    test_type = db.query(TestType).filter(
        TestType.id == payload.test_type_id,
        TestType.is_active == True,
    ).first()
    if not test_type:
        raise HTTPException(status_code=404, detail="Test type not found or inactive")

    if payload.section_scores and test_type.sections:
        valid_keys = {s["key"] for s in test_type.sections}
        invalid = set(payload.section_scores.keys()) - valid_keys
        if invalid:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid section keys for {test_type.name}: {invalid}. "
                       f"Valid keys: {valid_keys}",
            )

    entry = TestScore(student_id=student_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{student_id}/tests", response_model=List[TestScoreOut])
def list_tests(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    return student.test_scores


@router.patch("/{student_id}/tests/{entry_id}", response_model=TestScoreOut)
def update_test(
    student_id: int,
    entry_id: int,
    payload: TestScoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = db.query(TestScore).filter(
        TestScore.id == entry_id,
        TestScore.student_id == student_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_access(current_user, _get_student_or_404(db, student_id))

    if payload.section_scores:
        test_type = db.query(TestType).filter(TestType.id == entry.test_type_id).first()
        if test_type and test_type.sections:
            valid_keys = {s["key"] for s in test_type.sections}
            invalid = set(payload.section_scores.keys()) - valid_keys
            if invalid:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid section keys: {invalid}",
                )

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{student_id}/tests/{entry_id}", status_code=204)
def delete_test(
    student_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _=Depends(staff_roles),
):
    entry = db.query(TestScore).filter(
        TestScore.id == entry_id,
        TestScore.student_id == student_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


# ─── Custom Field Values ──────────────────────────────────────────────────────
#
# Three endpoints required by the frontend:
#
#   GET  /{id}/custom-field-values
#        → StudentProfileModal useEffect (both admin and student paths)
#        → Returns [{field_id, value_text}]
#
#   PUT  /{id}/custom-fields
#        → ApplicationsTab.saveCustomFields()
#        → Payload: {"values": [{"field_id": 1, "value": "text"}, ...]}
#        → Students may only write post_application fields
#
#   GET  /{id}/post-application-fields
#        → StudentProfileModal useEffect (student / non-admin path only)
#        → Returns active post_application CustomProfileField definitions


@router.get("/{student_id}/custom-field-values")
def get_custom_field_values(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns all saved custom field values for the student.
    Shape: [{field_id, value_text}]

    Accessible by: admin, counsellor, and the student themselves.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    values = db.query(StudentCustomFieldValue).filter(
        StudentCustomFieldValue.student_id == student_id
    ).all()

    return [
        {"field_id": v.field_id, "value_text": v.value_text or ""}
        for v in values
    ]


@router.put("/{student_id}/custom-fields")
def upsert_custom_field_values(
    student_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Bulk upsert custom field values for a student.
    Payload: {"values": [{"field_id": 1, "value": "text"}, ...]}

    - Admin / counsellor: can write any field (pre or post application).
    - Student: can only write their own post_application fields.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    items = payload.get("values", [])
    updated_count = 0

    for item in items:
        field_id = item.get("field_id")
        raw_value = item.get("value")
        value_text = str(raw_value) if raw_value is not None else ""

        # Verify the field exists and belongs to this student
        field = db.query(CustomProfileField).filter(
            CustomProfileField.id == field_id,
            CustomProfileField.student_id == student_id,
            CustomProfileField.is_active == True,
        ).first()

        if not field:
            # Skip unknown / inactive fields silently
            continue

        # Students can only write post_application fields
        if _is_student_role(current_user) and field.section_key != "post_application":
            continue

        # Validate dropdown value
        if field.field_type.value == "dropdown" and raw_value is not None:
            if str(raw_value) not in (field.dropdown_options or []):
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid value '{raw_value}' for dropdown field "
                           f"'{field.field_name}'. Allowed: {field.dropdown_options}",
                )

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
        updated_count += 1

    db.commit()
    return {"status": "ok", "updated": updated_count}


@router.get("/{student_id}/post-application-fields")
def get_post_application_fields(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns active post_application field definitions for the student.
    Used by the student-role path in StudentProfileModal:
      apiFetch(`/api/students/${studentId}/post-application-fields`)

    Students can never see pre_application fields.
    Returns the same shape as CustomProfileFieldOut so the frontend
    can use the same customFieldDefs array regardless of caller role.
    """
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    fields = db.query(CustomProfileField).filter(
        CustomProfileField.student_id == student_id,
        CustomProfileField.section_key == "post_application",
        CustomProfileField.is_active == True,
    ).order_by(CustomProfileField.sort_order, CustomProfileField.id).all()

    return [
        {
            "id": f.id,
            "field_name": f.field_name,
            "field_type": f.field_type.value,
            "section_key": f.section_key,
            "student_id": f.student_id,
            "placeholder": f.placeholder,
            "is_required": f.is_required,
            "is_active": f.is_active,
            "sort_order": f.sort_order,
            "dropdown_options": f.dropdown_options,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in fields
    ]