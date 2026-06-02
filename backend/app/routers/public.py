from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.tenant import Tenant
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/public", tags=["Public"])

class TenantPublicInfo(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str | None
    primary_color: str | None
    secondary_color: str | None
    custom_domain: str | None

@router.get("/tenants", response_model=List[TenantPublicInfo])
def get_public_tenants(db: Session = Depends(get_db)):
    """Used for populating the login page tenant selector dropdown."""
    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    return tenants

@router.get("/tenants/{slug}", response_model=TenantPublicInfo)
def get_tenant_by_slug(slug: str, db: Session = Depends(get_db)):
    """Used for loading tenant branding on a custom domain / mapped slug login page."""
    tenant = db.query(Tenant).filter(Tenant.slug == slug, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant
