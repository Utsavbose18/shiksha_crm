from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_permissions
from app.models.tenant import Tenant
from app.models.rbac import Role, Permission, RolePermission
from app.models.custom_field import CustomField
from app.models.form import Form, FormField
from app.models.workflow import Workflow, WorkflowStage
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin/settings", tags=["Admin Settings"])

# --- Roles & Permissions ---

class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    permissions: List[str] = []

@router.post("/roles")
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions("manage_roles"))
):
    tenant_id = current_user.active_tenant_id
    role = Role(
        tenant_id=tenant_id,
        name=payload.name,
        description=payload.description
    )
    db.add(role)
    db.flush()

    for perm_key in payload.permissions:
        perm = db.query(Permission).filter(Permission.key == perm_key).first()
        if perm:
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    db.commit()
    return {"message": "Role created successfully"}

@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    return db.query(Role).filter(Role.tenant_id == tenant_id).all()


# --- Custom Fields ---

class CustomFieldCreate(BaseModel):
    module_name: str
    field_label: str
    field_key: str
    field_type: str
    is_required: bool = False
    options_json: dict | list | None = None

@router.post("/custom-fields")
def create_custom_field(
    payload: CustomFieldCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions("manage_custom_fields"))
):
    tenant_id = current_user.active_tenant_id
    field = CustomField(
        tenant_id=tenant_id,
        module_name=payload.module_name,
        field_label=payload.field_label,
        field_key=payload.field_key,
        field_type=payload.field_type,
        is_required=payload.is_required,
        options_json=payload.options_json
    )
    db.add(field)
    db.commit()
    return field

@router.get("/custom-fields")
def list_custom_fields(
    module_name: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    q = db.query(CustomField).filter(CustomField.tenant_id == tenant_id, CustomField.is_active == True)
    if module_name:
        q = q.filter(CustomField.module_name == module_name)
    return q.all()


# --- Workflows ---

class WorkflowStageCreate(BaseModel):
    name: str
    stage_key: str
    color: str | None = None
    sort_order: int = 0
    is_final: bool = False

class WorkflowCreate(BaseModel):
    name: str
    module_name: str
    stages: List[WorkflowStageCreate]

@router.post("/workflows")
def create_workflow(
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions("manage_workflows"))
):
    tenant_id = current_user.active_tenant_id
    workflow = Workflow(
        tenant_id=tenant_id,
        name=payload.name,
        module_name=payload.module_name
    )
    db.add(workflow)
    db.flush()

    for stage in payload.stages:
        db.add(WorkflowStage(
            tenant_id=tenant_id,
            workflow_id=workflow.id,
            name=stage.name,
            stage_key=stage.stage_key,
            color=stage.color,
            sort_order=stage.sort_order,
            is_final=stage.is_final
        ))

    db.commit()
    return {"message": "Workflow created successfully"}

@router.get("/workflows")
def list_workflows(
    module_name: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    tenant_id = getattr(current_user, "active_tenant_id", None)
    q = db.query(Workflow).filter(Workflow.tenant_id == tenant_id, Workflow.is_active == True)
    if module_name:
        q = q.filter(Workflow.module_name == module_name)
    return q.all()
