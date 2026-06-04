from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import Application, Student
from app.schemas.schemas import ApplicationOut, StudentProfileOut, StudentPersonalInfoUpdate

router = APIRouter(prefix="/api/me", tags=["Current Student"])


def _current_student(current_user) -> Student:
    if not isinstance(current_user, Student):
        raise HTTPException(status_code=403, detail="Student account required")
    return current_user


@router.get("/profile", response_model=StudentProfileOut)
def get_my_profile(current_user=Depends(get_current_user)):
    return _current_student(current_user)


@router.patch("/profile", response_model=StudentProfileOut)
def update_my_profile(
    payload: StudentPersonalInfoUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _current_student(current_user)
    data = payload.model_dump(exclude_unset=True)

    # Students cannot update staff-owned workflow fields from self-service.
    data.pop("lead_status", None)
    data.pop("counsellor_id", None)

    db_student = db.query(Student).filter(Student.id == student.id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")

    for field, value in data.items():
        setattr(db_student, field, value)

    db.commit()
    db.refresh(db_student)
    return db_student


@router.get("/applications/", response_model=list[ApplicationOut])
def list_my_applications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _current_student(current_user)
    return (
        db.query(Application)
        .options(joinedload(Application.university))
        .filter(Application.student_id == student.id)
        .order_by(Application.created_at.desc())
        .all()
    )
