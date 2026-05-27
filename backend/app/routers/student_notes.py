from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Student, UserRole, StudentNote
from app.schemas.schemas import StudentNoteCreate, StudentNoteUpdate, StudentNoteOut

router = APIRouter(prefix="/api/student-notes", tags=["Student Notes"])


# ─────────────────────────────────────────────────────────────
# Access helper
# ─────────────────────────────────────────────────────────────
def require_notes_access(current_user):
    role = getattr(current_user, "role", UserRole.student)
    if role not in [UserRole.admin, UserRole.counsellor, "admin", "counsellor"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return role


# ─────────────────────────────────────────────────────────────
# Create student note
# ─────────────────────────────────────────────────────────────
@router.post("/", response_model=StudentNoteOut)
def create_student_note(
    payload: StudentNoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    note = StudentNote(
        student_id=payload.student_id,
        title=payload.title or "Untitled",
        content=payload.content or "",
        parent_id=payload.parent_id,
        category=payload.category,
        priority=payload.priority or "medium",
        tags=payload.tags or [],
        created_by=current_user.id
    )

    db.add(note)
    db.commit()
    db.refresh(note)

    return note


# ─────────────────────────────────────────────────────────────
# Get all notes for one student
# ─────────────────────────────────────────────────────────────
@router.get("/student/{student_id}", response_model=List[StudentNoteOut])
def get_student_notes(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return db.query(StudentNote).filter(
        StudentNote.student_id == student_id,
        StudentNote.is_active == True
    ).order_by(StudentNote.created_at.desc()).all()


# ─────────────────────────────────────────────────────────────
# Get single student note
# ─────────────────────────────────────────────────────────────
@router.get("/{note_id}", response_model=StudentNoteOut)
def get_student_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(StudentNote).filter(
        StudentNote.id == note_id,
        StudentNote.is_active == True
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Student note not found")

    return note


# ─────────────────────────────────────────────────────────────
# Update student note
# ─────────────────────────────────────────────────────────────
@router.put("/{note_id}", response_model=StudentNoteOut)
def update_student_note(
    note_id: int,
    payload: StudentNoteUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(StudentNote).filter(
        StudentNote.id == note_id,
        StudentNote.is_active == True
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Student note not found")

    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.parent_id is not None:
        note.parent_id = payload.parent_id
    if payload.category is not None:
        note.category = payload.category
    if payload.priority is not None:
        note.priority = payload.priority
    if payload.tags is not None:
        note.tags = payload.tags

    db.commit()
    db.refresh(note)

    return note


# ─────────────────────────────────────────────────────────────
# Delete student note (soft delete)
# ─────────────────────────────────────────────────────────────
@router.delete("/{note_id}")
def delete_student_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(StudentNote).filter(
        StudentNote.id == note_id,
        StudentNote.is_active == True
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Student note not found")

    note.is_active = False
    db.commit()

    return {"message": "Student note deleted successfully"}


# ─────────────────────────────────────────────────────────────
# Previous notes of same student
# ─────────────────────────────────────────────────────────────
@router.get("/student/{student_id}/previous", response_model=List[StudentNoteOut])
def get_previous_notes(
    student_id: int,
    current_note_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    q = db.query(StudentNote).filter(
        StudentNote.student_id == student_id,
        StudentNote.is_active == True
    )

    if current_note_id:
        q = q.filter(StudentNote.id != current_note_id)

    return q.order_by(StudentNote.created_at.desc()).all()



