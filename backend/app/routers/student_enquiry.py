from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import (
    User,
    UserRole,
    EnquiryStudent,
    EnquiryNote,
)
from app.schemas.schemas import (
    EnquiryStudentCreate,
    EnquiryStudentUpdate,
    EnquiryStudentOut,
    EnquiryNoteCreate,
    EnquiryNoteUpdate,
    EnquiryNoteOut,
)

router = APIRouter(prefix="/api/enquiry-notes", tags=["Enquiry Notes"])


# ─────────────────────────────────────────────────────────────────────────────
# Auth guard
# ─────────────────────────────────────────────────────────────────────────────

def _require_access(current_user: User) -> User:
    """Allow admin and counsellor only."""
    if current_user.role not in (UserRole.admin, UserRole.counsellor):
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user


# ═════════════════════════════════════════════════════════════════════════════
# ENQUIRY STUDENT endpoints
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/students", response_model=List[EnquiryStudentOut])
def list_enquiry_students(
    name: Optional[str] = Query(None, description="Partial name filter (case-insensitive)"),
    intake_year: Optional[int] = Query(None, description="Exact intake year filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all active enquiry students.
    Optionally filter by name (partial, case-insensitive) and/or intake_year.
    """
    _require_access(current_user)

    q = db.query(EnquiryStudent).filter(EnquiryStudent.is_active == True)

    if name:
        q = q.filter(EnquiryStudent.name.ilike(f"%{name.strip()}%"))

    if intake_year:
        q = q.filter(EnquiryStudent.intake_year == intake_year)

    return q.order_by(EnquiryStudent.name.asc()).all()


@router.post("/students", response_model=EnquiryStudentOut, status_code=201)
def create_enquiry_student(
    payload: EnquiryStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new enquiry student record."""
    _require_access(current_user)

    student = EnquiryStudent(
        name=payload.name,
        intake_year=payload.intake_year,
        intake_month=payload.intake_month,
        created_by=current_user.id,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/students/{student_id}", response_model=EnquiryStudentOut)
def get_enquiry_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single enquiry student by id."""
    _require_access(current_user)

    student = db.query(EnquiryStudent).filter(
        EnquiryStudent.id == student_id,
        EnquiryStudent.is_active == True,
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Enquiry student not found")

    return student


@router.put("/students/{student_id}", response_model=EnquiryStudentOut)
def update_enquiry_student(
    student_id: int,
    payload: EnquiryStudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update name and/or intake_year of an enquiry student."""
    _require_access(current_user)

    student = db.query(EnquiryStudent).filter(
        EnquiryStudent.id == student_id,
        EnquiryStudent.is_active == True,
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Enquiry student not found")

    if payload.name is not None:
        student.name = payload.name
    if payload.intake_year is not None:
        student.intake_year = payload.intake_year
    if payload.intake_month is not None:          # ← ADD THIS BLOCK
        student.intake_month = payload.intake_month

    db.commit()
    db.refresh(student)
    return student


@router.delete("/students/{student_id}")
def delete_enquiry_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft-delete an enquiry student.
    All their notes are also soft-deleted to keep foreign key integrity.
    """
    _require_access(current_user)

    student = db.query(EnquiryStudent).filter(
        EnquiryStudent.id == student_id,
        EnquiryStudent.is_active == True,
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Enquiry student not found")

    # soft-delete all notes belonging to this student
    db.query(EnquiryNote).filter(
        EnquiryNote.enquiry_id == student_id,
    ).update({"is_active": False})

    db.delete(student)
    db.commit()

    return {"message": "Enquiry student deleted successfully"}


# ═════════════════════════════════════════════════════════════════════════════
# ENQUIRY NOTE endpoints
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=List[EnquiryNoteOut])
def list_enquiry_notes(
    enquiry_id: Optional[int] = Query(None, description="Filter notes by enquiry student id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all active enquiry notes.
    Pass enquiry_id to get notes for a specific student only.
    """
    _require_access(current_user)

    q = db.query(EnquiryNote).filter(EnquiryNote.is_active == True)

    if enquiry_id:
        q = q.filter(EnquiryNote.enquiry_id == enquiry_id)

    return q.order_by(EnquiryNote.created_at.asc()).all()


@router.post("/", response_model=EnquiryNoteOut, status_code=201)
def create_enquiry_note(
    payload: EnquiryNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new note for an enquiry student."""
    _require_access(current_user)

    # verify the enquiry student exists and is active
    student = db.query(EnquiryStudent).filter(
        EnquiryStudent.id == payload.enquiry_id,
        EnquiryStudent.is_active == True,
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Enquiry student not found")

    # if a parent is given, verify it belongs to the same student and is active
    if payload.parent_id is not None:
        parent = db.query(EnquiryNote).filter(
            EnquiryNote.id == payload.parent_id,
            EnquiryNote.enquiry_id == payload.enquiry_id,
            EnquiryNote.is_active == True,
        ).first()

        if not parent:
            raise HTTPException(
                status_code=404,
                detail="Parent note not found or does not belong to this enquiry student",
            )

    note = EnquiryNote(
        enquiry_id=payload.enquiry_id,
        parent_id=payload.parent_id,
        title=payload.title or "Untitled",
        content=payload.content or "",
        created_by=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}", response_model=EnquiryNoteOut)
def get_enquiry_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single enquiry note by id."""
    _require_access(current_user)

    note = db.query(EnquiryNote).filter(
        EnquiryNote.id == note_id,
        EnquiryNote.is_active == True,
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note


@router.put("/{note_id}", response_model=EnquiryNoteOut)
def update_enquiry_note(
    note_id: int,
    payload: EnquiryNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update title, content, or parent_id of an enquiry note."""
    _require_access(current_user)

    note = db.query(EnquiryNote).filter(
        EnquiryNote.id == note_id,
        EnquiryNote.is_active == True,
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if payload.title is not None:
        note.title = payload.title

    if payload.content is not None:
        note.content = payload.content

    if payload.parent_id is not None:
        # make sure the new parent belongs to the same student and is active
        parent = db.query(EnquiryNote).filter(
            EnquiryNote.id == payload.parent_id,
            EnquiryNote.enquiry_id == note.enquiry_id,
            EnquiryNote.is_active == True,
        ).first()

        if not parent:
            raise HTTPException(
                status_code=404,
                detail="Parent note not found or does not belong to this enquiry student",
            )

        note.parent_id = payload.parent_id

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_enquiry_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft-delete a note and all its direct children (recursive via the
    parent_id self-reference).  Mirrors the cascade behaviour in the
    frontend deleteNote() function.
    """
    _require_access(current_user)

    note = db.query(EnquiryNote).filter(
        EnquiryNote.id == note_id,
        EnquiryNote.is_active == True,
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # collect all descendant ids iteratively (avoids recursion depth issues)
    ids_to_delete = []
    queue = [note_id]

    while queue:
        current_id = queue.pop()
        ids_to_delete.append(current_id)
        children = db.query(EnquiryNote.id).filter(
            EnquiryNote.parent_id == current_id,
            EnquiryNote.is_active == True,
        ).all()
        queue.extend(child.id for child in children)

    db.query(EnquiryNote).filter(
        EnquiryNote.id.in_(ids_to_delete),
    ).update({"is_active": False}, synchronize_session=False)

    db.commit()

    return {"message": "Note deleted successfully"}