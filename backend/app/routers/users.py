"""
User management – Admin only (create counsellors, activate/deactivate).
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.audit_logger import log_action
from app.core.plan_limits import check_limit
from app.core.security import hash_password, require_roles
from app.models.tenant import Tenant
from app.models.user import User, UserRole, Payment, DocumentFile,  DocumentField, TestType,CustomProfileField,Note,StudentNote,EnquiryStudent,EnquiryNote,Student
from app.schemas.schemas import UserCreate, UserUpdate, UserOut, PasswordResetByAdmin

router = APIRouter(prefix="/api/users", tags=["Users"])

admin_only = require_roles(UserRole.platform_super_admin, UserRole.admin)


def _assert_user_visible(user: User, current_user: User) -> None:
    if current_user.role == "platform_super_admin":
        return
    tenant_id = getattr(current_user, "active_tenant_id", None)
    if not tenant_id or user.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="User not found")


@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Admin creates a new user (counsellor or another admin)."""
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant_id = None
    if current_user.role != "platform_super_admin":
        tenant_id = getattr(current_user, "active_tenant_id", None)
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No active tenant context")
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        current_user_count = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True,
        ).count()
        check_limit(current_user_count, tenant.subscription_plan, "max_users", "staff users")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
        tenant_id=tenant_id,
        is_active=True,
        must_change_password=True,   # ✅ FORCE PASSWORD CHANGE
        created_by=current_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=user.tenant_id,
        action="user_created",
        module_name="users",
        record_type="user",
        record_id=user.id,
        new_values={"email": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return user


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
    role: UserRole = None,
    skip: int = 0,
    limit: int = 100,
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    q = db.query(User)

    if current_user.role != "platform_super_admin":
        q = q.filter(User.tenant_id == tenant_id)

    if role:
        q = q.filter(User.role == role)
    return q.offset(skip).limit(limit).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_visible(user, current_user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_visible(user, current_user)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, val)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/activate")
def activate_user(user_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_visible(user, current_user)
    user.is_active = True
    db.commit()
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=user.tenant_id,
        action="user_activated",
        module_name="users",
        record_type="user",
        record_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "User activated"}


@router.post("/{user_id}/deactivate")
def deactivate_user(user_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_visible(user, current_user)
    user.is_active = False
    db.commit()
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=user.tenant_id,
        action="user_deactivated",
        module_name="users",
        record_type="user",
        record_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "User deactivated"}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordResetByAdmin,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_visible(user, current_user)

    user.hashed_password = hash_password(payload.new_password)

    # ✅ FORCE USER TO CHANGE PASSWORD
    user.must_change_password = True

    db.commit()
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=user.tenant_id,
        action="password_reset_by_admin",
        module_name="users",
        record_type="user",
        record_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"message": "Password reset successfully"}

from datetime import datetime

@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_visible(user, current_user)
    target_tenant_id = user.tenant_id
    target_email = user.email

    try:
        # NULLIFY references (safer than delete)
        db.query(DocumentFile).filter_by(uploaded_by=user_id).update({"uploaded_by": None})
        db.query(DocumentField).filter_by(created_by=user_id).update({"created_by": None})
        db.query(TestType).filter_by(created_by=user_id).update({"created_by": None})
        db.query(CustomProfileField).filter_by(created_by=user_id).update({"created_by": None})
        db.query(Payment).filter_by(created_by=user_id).update({"created_by": None})
        db.query(Note).filter_by(created_by=user_id).update({"created_by": None})
        db.query(StudentNote).filter_by(created_by=user_id).update({"created_by": None})
        db.query(EnquiryStudent).filter_by(created_by=user_id).update({"created_by": None})
        db.query(EnquiryNote).filter_by(created_by=user_id).update({"created_by": None})

        # students relationships
        db.query(Student).filter_by(created_by=user_id).update({"created_by": None})
        db.query(Student).filter_by(counsellor_id=user_id).update({"counsellor_id": None})

        # finally delete user
        db.delete(user)

        db.commit()
        log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=target_tenant_id,
            action="user_deleted",
            module_name="users",
            record_type="user",
            record_id=user_id,
            old_values={"email": target_email},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="User deletion failed due to dependencies")
