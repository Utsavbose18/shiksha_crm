"""
Applications (post-application) + isolated per-university chat.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
import uuid
from pathlib import Path
from app.services.email_service import send_email
from app.services.chat_formatter import format_single_message
from app.models.user import Student
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.core.config import settings
from app.models.user import (
    Application, ApplicationMessage, University,
    Student, UserRole, Notification,User
)
from app.schemas.schemas import (
    ApplicationCreate, ApplicationUpdate, ApplicationOut,
    MessageCreate, MessageOut,
    UniversityCreate, UniversityOut, 
)
from app.routers.students import _get_student_or_404, _assert_access
import mimetypes

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import defaultdict

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import University, UserRole
from app.schemas.schemas import UniversityCreate, UniversityUpdate, UniversityOut


router = APIRouter(tags=["Applications"])
staff_roles = require_roles(UserRole.admin, UserRole.counsellor)

uni_router = APIRouter(prefix="/api/universities", tags=["Universities"])
staff_roles = require_roles(UserRole.admin, UserRole.counsellor)


# ─── Create University ─────────────────────────────────────────────

@uni_router.post("/", response_model=UniversityOut, status_code=201)
def create_university(
    payload: UniversityCreate,
    db: Session = Depends(get_db),
    _=Depends(staff_roles),
):
    # optional duplicate check
    existing = db.query(University).filter(
        University.name == payload.name,
        University.country == payload.country,
        University.city == payload.city,
        University.category == payload.category,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="University already exists")

    uni = University(**payload.model_dump())
    db.add(uni)
    db.commit()
    db.refresh(uni)
    return uni


# ─── List Universities ─────────────────────────────────────────────

@uni_router.get("/", response_model=List[UniversityOut])
def list_universities(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    _=Depends(get_current_user),
):
    q = db.query(University)

    if search:
        q = q.filter(University.name.ilike(f"%{search}%"))

    if country:
        q = q.filter(University.country.ilike(f"%{country}%"))

    if city:
        q = q.filter(University.city.ilike(f"%{city}%"))

    if category:
        q = q.filter(University.category == category)

    return q.order_by(University.country.asc(), University.city.asc(), University.name.asc()).all()


# ─── Get Single University ─────────────────────────────────────────

@uni_router.get("/{uni_id}", response_model=UniversityOut)
def get_university(
    uni_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    uni = db.query(University).filter(University.id == uni_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")
    return uni


# ─── Update University ─────────────────────────────────────────────

@uni_router.patch("/{uni_id}", response_model=UniversityOut)
def update_university(
    uni_id: int,
    payload: UniversityUpdate,
    db: Session = Depends(get_db),
    _=Depends(staff_roles),
):
    uni = db.query(University).filter(University.id == uni_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(uni, k, v)

    db.commit()
    db.refresh(uni)
    return uni


# ─── Delete University ─────────────────────────────────────────────

@uni_router.delete("/{uni_id}", status_code=204)
def delete_university(
    uni_id: int,
    db: Session = Depends(get_db),
    _=Depends(staff_roles),
):
    uni = db.query(University).filter(University.id == uni_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    # 🔴 Check if used in applications
    is_used = db.query(Application.id).filter(
        Application.university_id == uni_id
    ).first()

    if is_used:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete university. It is used in applications."
        )

    db.delete(uni)
    db.commit()



@uni_router.get("/structured/grouped")
def get_grouped_universities(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    universities = db.query(University).all()

    result = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for uni in universities:
        category = uni.category
        country = uni.country
        city = uni.city or "Other"

        result[category][country][city].append({
            "id": uni.id,
            "name": uni.name
        })

    return result


# ─── Applications ────────────────────────────────────────────────────────────

app_router = APIRouter(prefix="/api/students/{student_id}/applications")


@app_router.post("/", response_model=ApplicationOut, status_code=201)
def create_application(
    student_id: int,
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)

    uni = db.query(University).filter(University.id == payload.university_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    app = Application(student_id=student_id, **payload.model_dump())  # ✅ THIS LINE DOES EVERYTHING

    db.add(app)
    db.commit()

    app = (
        db.query(Application)
        .options(joinedload(Application.university))
        .filter(Application.id == app.id)
        .first()
    )
    return app

@app_router.get("/", response_model=List[ApplicationOut])
def list_applications(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    return (
        db.query(Application)
        .options(joinedload(Application.university))
        .filter(Application.student_id == student_id)  # ✅ was missing this
        .order_by(Application.created_at.desc())
        .all()
    )


# ─── Add this NEW global endpoint on the main router (not app_router) ────────
@router.get("/api/applications/", response_model=List[ApplicationOut])
def list_all_applications(
    db: Session = Depends(get_db),
    current_user=Depends(staff_roles),
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    return (
        db.query(Application)
        .filter(Application.tenant_id == tenant_id)
        .options(joinedload(Application.university))
        .order_by(Application.created_at.desc())
        .all()
    )


@app_router.get("/{app_id}", response_model=ApplicationOut)
def get_application(
    student_id: int,
    app_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    app = db.query(Application).options(joinedload(Application.university)).filter(
        Application.id == app_id, Application.student_id == student_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _assert_access(current_user, _get_student_or_404(db, student_id))
    return app


@app_router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(
    student_id: int,
    app_id: int,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    app = db.query(Application).filter(
        Application.id == app_id, Application.student_id == student_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _assert_access(current_user, _get_student_or_404(db, student_id))
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(app, k, v)
    db.commit()
    app = (
        db.query(Application)
        .options(joinedload(Application.university))
        .filter(Application.id == app_id)
        .first()
    )
    return app


@app_router.delete("/{app_id}", status_code=204)
def delete_application(
    student_id: int,
    app_id: int,
    db: Session = Depends(get_db),
    _=Depends(staff_roles),
):
    app = db.query(Application).filter(
        Application.id == app_id, Application.student_id == student_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(app)
    db.commit()


# ─── Per-University Isolated Chat ─────────────────────────────────────────────

@app_router.get("/{app_id}/messages", response_model=List[MessageOut])
def get_messages(
    student_id: int,
    app_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get chat messages scoped ONLY to this application."""
    app = db.query(Application).filter(
        Application.id == app_id, Application.student_id == student_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _assert_access(current_user, _get_student_or_404(db, student_id))

    messages = (
        db.query(ApplicationMessage)
        .filter(ApplicationMessage.application_id == app_id)
        .order_by(ApplicationMessage.created_at.asc())
        .all()
    )
    return messages


@app_router.post("/{app_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    student_id: int,
    app_id: int,
    message: str = Form(default=''),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    app = db.query(Application).filter(
        Application.id == app_id, Application.student_id == student_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)



    if isinstance(current_user, User):
        sender_type = "admin"
    else:
        sender_type = "student"

    attachment_data = None
    attachment_name = None
    attachment_type = None

    if file and file.filename:
        content = await file.read()

        attachment_data = content
        attachment_name = file.filename
        attachment_type = file.content_type
    msg = ApplicationMessage(
        application_id=app_id,
        sender_type=sender_type,
        sender_id=current_user.id,
        message=message,
        attachment_data=attachment_data,
        attachment_name=attachment_name,
        attachment_type=attachment_type,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    notif = Notification(
        student_id=student_id,
        application_id=app_id,  # ✅ ADD THIS
        message=msg.message or msg.attachment_name,
        type="attachment" if attachment_name else "message"
    )
    db.add(notif)
    db.commit()

    chat_text = format_single_message(msg)
    subject = f"New message from {sender_type} - Application #{app_id}"
    chat_text += "\n\nLogin to CRM to reply."
    if isinstance(current_user,User):
        chat_text = format_single_message(msg)
        subject = f"New message from Admin - Application #{app_id}"
        chat_text += "\n\nLogin to CRM to reply."

        send_email(
            student.email,
            subject,
            chat_text,
            attachment_data=attachment_data,
            attachment_name=attachment_name,
            attachment_type=attachment_type
        )

    return msg

@app_router.delete("/{app_id}/messages/{msg_id}", status_code=204)
def delete_message(
    student_id: int,
    app_id: int,
    msg_id: int,
    db: Session = Depends(get_db),
    _=Depends(staff_roles),
):
    msg = db.query(ApplicationMessage).filter(
        ApplicationMessage.id == msg_id,
        ApplicationMessage.application_id == app_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()

import mimetypes

# ── Add this download endpoint right after delete_message ──
from fastapi.responses import StreamingResponse
from io import BytesIO

@app_router.get("/{app_id}/messages/{msg_id}/attachment")
def download_message_attachment(
    student_id: int,
    app_id: int,
    msg_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    msg = db.query(ApplicationMessage).filter(
        ApplicationMessage.id == msg_id,
        ApplicationMessage.application_id == app_id,
    ).first()

    if not msg or not msg.attachment_data:
        raise HTTPException(status_code=404, detail="Attachment not found")

    _assert_access(current_user, _get_student_or_404(db, student_id))

    return StreamingResponse(
        BytesIO(msg.attachment_data),
        media_type=msg.attachment_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{msg.attachment_name}"'
        }
    )
# Include both sub-routers in main router
# Add this new router at the top of your routers
notif_router = APIRouter(prefix="/api/notifications")

@notif_router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    notifications = (
        db.query(Notification, Student)
        .join(Student, Notification.student_id == Student.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for notif, student in notifications:
        result.append(
            {
                "id": notif.id,
                "student_id": notif.student_id,
                "application_id": notif.application_id,
                "student_name": f"{student.first_name or ''} {student.last_name or ''}".strip()
                or student.email,
                "university_name": getattr(notif, "university_name", None),
                "type": notif.type,
                "is_read": notif.is_read,
                "created_at": notif.created_at,
            }
        )
    return result
 
 
# ── PATCH /{notif_id}/read ───────────────────────────────────────────────────
@notif_router.patch("/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"ok": True}
 
 
# ── PATCH /read-all ──────────────────────────────────────────────────────────
@notif_router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    db.query(Notification).filter(Notification.is_read == False).update(
        {"is_read": True}
    )
    db.commit()
    return {"ok": True}
 
 
# ── PATCH /read-by-application/{application_id} ─────────────────────────────
# (already referenced in your ApplicationsTab – kept as-is)
@notif_router.patch("/read-by-application/{application_id}")
def mark_notifications_read_by_application(
    application_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.application_id == application_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}
 
 
# ── DELETE /{notif_id} ───────────────────────────────────────────────────────
@notif_router.delete("/{notif_id}")
def delete_notification(
    notif_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"ok": True, "deleted_id": notif_id}
 
 
# ── DELETE / ─────────────────────────────────────────────────────────────────
@notif_router.delete("")
def delete_all_notifications(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    deleted = db.query(Notification).delete()
    db.commit()
    return {"ok": True, "deleted_count": deleted}