from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.tenant import Tenant
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/tenants", tags=["Tenants"])

class TenantCreate(BaseModel):
    name: str
    slug: str
    custom_domain: str | None = None
    subscription_plan: str = "Free Trial"

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
    return db.query(Tenant).all()

@router.post("/", response_model=TenantOut)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_roles("platform_super_admin"))
):
    existing = db.query(Tenant).filter(Tenant.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tenant slug already exists")

    tenant = Tenant(
        name=payload.name,
        slug=payload.slug,
        custom_domain=payload.custom_domain,
        subscription_plan=payload.subscription_plan
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
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
