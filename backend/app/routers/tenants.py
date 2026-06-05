import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.audit_logger import log_action
from app.core.security import get_current_user, hash_password, require_roles
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime

router = APIRouter(prefix="/api/tenants", tags=["Tenants"])


def _not_deleted_filter():
    return or_(Tenant.subscription_status.is_(None), Tenant.subscription_status != "deleted")

class TenantCreate(BaseModel):
    name: str
    slug: str
    custom_domain: str | None = None
    subscription_plan: str = "Free Trial"
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str | None = None

    @field_validator("name", "slug", "subscription_plan", "admin_password")
    @classmethod
    def required_strings_must_not_be_blank(cls, value: str):
        if not value or not value.strip():
            raise ValueError("Field must not be empty")
        return value.strip()

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str):
        slug = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError("Slug must use lowercase letters, numbers, and single hyphens")
        return slug

    @field_validator("custom_domain", "admin_full_name")
    @classmethod
    def optional_strings_to_clean_values(cls, value: str | None):
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("admin_password")
    @classmethod
    def validate_admin_password(cls, value: str):
        if len(value) < 8:
            raise ValueError("Temporary password must be at least 8 characters")
        return value


class TenantCredentialReset(BaseModel):
    new_password: str
    admin_email: EmailStr | None = None

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str):
        if not value or not value.strip():
            raise ValueError("Temporary password must not be empty")
        if len(value) < 8:
            raise ValueError("Temporary password must be at least 8 characters")
        return value


class TenantOut(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str | None
    primary_color: str | None
    secondary_color: str | None
    custom_domain: str | None
    subscription_plan: str
    subscription_status: str
    storage_limit_mb: float
    storage_used_mb: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[TenantOut])
def get_all_tenants(
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("platform_super_admin"))
):
    return (
        db.query(Tenant)
        .filter(_not_deleted_filter())
        .order_by(Tenant.created_at.desc())
        .all()
    )

@router.post("/", response_model=TenantOut)
def create_tenant(
    payload: TenantCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("platform_super_admin"))
):
    existing = db.query(Tenant).filter(Tenant.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tenant slug already exists")

    existing_user = db.query(User).filter(User.email == payload.admin_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Admin email is already registered")

    tenant = Tenant(
        name=payload.name,
        slug=payload.slug,
        custom_domain=payload.custom_domain,
        subscription_plan=payload.subscription_plan
    )
    try:
        db.add(tenant)
        db.flush()

        tenant_admin = User(
            tenant_id=tenant.id,
            email=payload.admin_email,
            hashed_password=hash_password(payload.admin_password),
            full_name=payload.admin_full_name or f"{payload.name} Admin",
            role=UserRole.admin,
            is_active=True,
            must_change_password=True,
            created_by=current_user.id,
        )
        db.add(tenant_admin)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(tenant)
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action="tenant_created",
        module_name="tenants",
        record_type="tenant",
        record_id=tenant.id,
        new_values={"name": tenant.name, "slug": tenant.slug, "admin_email": tenant_admin.email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return tenant

@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "platform_super_admin" and getattr(current_user, "active_tenant_id", None) != tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this tenant")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return tenant

@router.patch("/{tenant_id}")
def update_tenant(
    tenant_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "platform_super_admin" and getattr(current_user, "active_tenant_id", None) != tenant_id:
         raise HTTPException(status_code=403, detail="Not authorized")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for key, value in payload.items():
        if hasattr(tenant, key):
            setattr(tenant, key, value)

    db.commit()
    return {"message": "Tenant updated successfully"}


@router.patch("/{tenant_id}/status", response_model=TenantOut)
def set_tenant_status(
    tenant_id: int,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("platform_super_admin"))
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        _not_deleted_filter()
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    is_active = payload.get("is_active")
    if not isinstance(is_active, bool):
        raise HTTPException(status_code=400, detail="is_active must be true or false")

    tenant.is_active = is_active
    tenant.subscription_status = "active" if is_active else "inactive"

    db.commit()
    db.refresh(tenant)
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action="tenant_status_changed",
        module_name="tenants",
        record_type="tenant",
        record_id=tenant.id,
        new_values={"is_active": tenant.is_active, "subscription_status": tenant.subscription_status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return tenant


@router.post("/{tenant_id}/reset-credentials")
def reset_tenant_credentials(
    tenant_id: int,
    payload: TenantCredentialReset,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("platform_super_admin"))
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        _not_deleted_filter()
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    query = db.query(User).filter(
        User.tenant_id == tenant.id,
        User.role == UserRole.admin,
    )
    if payload.admin_email:
        query = query.filter(User.email == payload.admin_email)

    admin_user = query.order_by(User.created_at.asc()).first()
    if not admin_user:
        if not payload.admin_email:
            raise HTTPException(
                status_code=400,
                detail="Tenant has no admin user. Provide an admin email to create one."
            )
        if db.query(User).filter(User.email == payload.admin_email).first():
            raise HTTPException(status_code=400, detail="Admin email is already registered")
        admin_user = User(
            tenant_id=tenant.id,
            email=payload.admin_email,
            hashed_password=hash_password(payload.new_password),
            full_name=f"{tenant.name} Admin",
            role=UserRole.admin,
            is_active=True,
            must_change_password=True,
            created_by=current_user.id,
        )
        db.add(admin_user)
        db.commit()
        log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=tenant.id,
            action="tenant_credentials_reset",
            module_name="tenants",
            record_type="tenant",
            record_id=tenant.id,
            new_values={"admin_email": admin_user.email, "created_admin": True},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        return {
            "message": "Tenant admin credentials created successfully",
            "admin_email": admin_user.email,
            "must_change_password": True,
        }

    admin_user.hashed_password = hash_password(payload.new_password)
    admin_user.must_change_password = True
    admin_user.is_active = True

    db.commit()
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action="tenant_credentials_reset",
        module_name="tenants",
        record_type="tenant",
        record_id=tenant.id,
        new_values={"admin_email": admin_user.email, "created_admin": False},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "message": "Tenant credentials reset successfully",
        "admin_email": admin_user.email,
        "must_change_password": True,
    }


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("platform_super_admin"))
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        _not_deleted_filter()
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.is_active = False
    tenant.subscription_status = "deleted"
    db.query(User).filter(User.tenant_id == tenant.id).update(
        {"is_active": False},
        synchronize_session=False,
    )

    db.commit()
    log_action(
        db=db,
        user_id=current_user.id,
        tenant_id=tenant.id,
        action="tenant_deleted",
        module_name="tenants",
        record_type="tenant",
        record_id=tenant.id,
        old_values={"name": tenant.name, "slug": tenant.slug},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return None
