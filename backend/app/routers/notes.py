"""
Notes management — Admin / Counsellor only
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import mimetypes

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Student, UserRole, Note, NoteFile
from app.schemas.schemas import NoteCreate, NoteUpdate, NoteOut, NoteFileOut

router = APIRouter(prefix="/api/notes", tags=["Notes"])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def require_notes_access(current_user):
    role = getattr(current_user, "role", UserRole.student)
    if role not in [UserRole.admin, UserRole.counsellor, "admin", "counsellor"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return role


# ──────────────────────────────────────────────────────────────────────────────
# Get all notes
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[NoteOut])
def get_notes(
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    q = db.query(Note).filter(Note.is_active == True)

    if student_id:
        q = q.filter(Note.student_id == student_id)

    notes = q.order_by(Note.created_at.asc()).all()
    return notes


# ──────────────────────────────────────────────────────────────────────────────
# Create note
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=NoteOut)
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    if payload.student_id:
        student = db.query(Student).filter(Student.id == payload.student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

    if payload.parent_id:
        parent = db.query(Note).filter(Note.id == payload.parent_id, Note.is_active == True).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent note not found")

    note = Note(
        title=payload.title or "Untitled",
        content=payload.content or "",
        parent_id=payload.parent_id,
        student_id=payload.student_id,
        created_by=current_user.id,
    )

    db.add(note)
    db.commit()
    db.refresh(note)
    return note


# ──────────────────────────────────────────────────────────────────────────────
# Update note
# ──────────────────────────────────────────────────────────────────────────────

@router.put("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.parent_id is not None:
        note.parent_id = payload.parent_id
    if payload.student_id is not None:
        note.student_id = payload.student_id

    db.commit()
    db.refresh(note)
    return note


# ──────────────────────────────────────────────────────────────────────────────
# Delete note (soft delete)
# ──────────────────────────────────────────────────────────────────────────────

@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.is_active = False
    db.commit()

    return {"message": "Note deleted successfully"}


# ──────────────────────────────────────────────────────────────────────────────
# Upload note file
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{note_id}/upload", response_model=NoteFileOut)
def upload_note_file(
    note_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    data = file.file.read()

    note_file = NoteFile(
        note_id=note.id,
        file_name=file.filename,
        mime_type=file.content_type or mimetypes.guess_type(file.filename)[0],
        file_data=data,
        file_size=len(data),
    )

    db.add(note_file)
    db.commit()
    db.refresh(note_file)

    return note_file


# ──────────────────────────────────────────────────────────────────────────────
# Get note files list
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{note_id}/files", response_model=List[NoteFileOut])
def get_note_files(
    note_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return db.query(NoteFile).filter(NoteFile.note_id == note_id).all()


# ──────────────────────────────────────────────────────────────────────────────
# Download / View file
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/file/{file_id}")
def get_note_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    file = db.query(NoteFile).filter(NoteFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    return Response(
        content=file.file_data,
        media_type=file.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{file.file_name}"'}
    )
    
    
# ──────────────────────────────────────────────────────────────────────────────
# Delete note file
# ──────────────────────────────────────────────────────────────────────────────

@router.delete("/file/{file_id}")
def delete_note_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_notes_access(current_user)

    note_file = db.query(NoteFile).filter(NoteFile.id == file_id).first()
    if not note_file:
        raise HTTPException(status_code=404, detail="File not found")

    db.delete(note_file)
    db.commit()

    return {"message": "File deleted successfully"}    