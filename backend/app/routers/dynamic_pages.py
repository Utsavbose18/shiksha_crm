from datetime import date
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.custom_field import CustomField, CustomFieldValue
from app.models.form import Form, FormField
from app.models.user import UserRole
from app.routers.students import _assert_access, _get_student_or_404


router = APIRouter(prefix="/api/student-dynamic-pages", tags=["Student Dynamic Pages"])

MODULE_NAME = "student_dynamic_page"
RECORD_TYPE = "student_dynamic_page"
SUPPORTED_FIELD_TYPES = {
    "text",
    "long_text",
    "integer",
    "float",
    "number",
    "date",
    "yes_no",
    "dropdown",
    "email",
    "url",
}


class DynamicPageCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @model_validator(mode="after")
    def clean(self):
        self.name = self.name.strip()
        if not self.name:
            raise ValueError("name is required")
        self.description = self.description.strip() if self.description else None
        return self


class DynamicPageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def clean(self):
        if self.name is not None:
            self.name = self.name.strip()
            if not self.name:
                raise ValueError("name cannot be empty")
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class DynamicFieldCreate(BaseModel):
    section_name: str
    field_label: str
    field_type: str = "text"
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    is_required: bool = False
    options_json: Optional[List[str]] = None
    sort_order: int = 0

    @model_validator(mode="after")
    def clean(self):
        self.section_name = self.section_name.strip()
        self.field_label = self.field_label.strip()
        self.field_type = self.field_type.strip().lower()
        if not self.section_name:
            raise ValueError("section_name is required")
        if not self.field_label:
            raise ValueError("field_label is required")
        if self.field_type not in SUPPORTED_FIELD_TYPES:
            raise ValueError(f"Unsupported field_type: {self.field_type}")
        if self.field_type == "dropdown":
            options = [str(item).strip() for item in (self.options_json or []) if str(item).strip()]
            if len(options) < 2:
                raise ValueError("Dropdown fields require at least 2 options")
            self.options_json = options
        else:
            self.options_json = None
        self.placeholder = self.placeholder.strip() if self.placeholder else None
        self.help_text = self.help_text.strip() if self.help_text else None
        return self


class DynamicFieldOut(BaseModel):
    form_field_id: int
    id: int
    field_label: str
    field_key: str
    field_type: str
    is_required: bool
    options_json: Optional[List[str]] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    section_name: str
    sort_order: int
    is_active: bool


class DynamicPageOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    fields: List[DynamicFieldOut] = []


class DynamicFieldValueIn(BaseModel):
    field_id: int
    value: Optional[object] = None


class DynamicFieldValueBulkIn(BaseModel):
    values: List[DynamicFieldValueIn]


def _tenant_id_or_403(current_user):
    tenant_id = getattr(current_user, "active_tenant_id", None) or getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant context required")
    return tenant_id


def _require_tenant_admin(current_user):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Tenant admin required")
    return _tenant_id_or_403(current_user)


def _slugify(value: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return key or "field"


def _unique_field_key(db: Session, tenant_id: int, page_id: int, field_label: str) -> str:
    base_key = f"page_{page_id}_{_slugify(field_label)}"
    field_key = base_key
    suffix = 2
    while db.query(CustomField.id).filter(
        CustomField.tenant_id == tenant_id,
        CustomField.module_name == MODULE_NAME,
        CustomField.field_key == field_key,
    ).first():
        field_key = f"{base_key}_{suffix}"
        suffix += 1
    return field_key


def _get_page(db: Session, tenant_id: int, page_id: int, active_only: bool = True) -> Form:
    q = db.query(Form).filter(
        Form.id == page_id,
        Form.tenant_id == tenant_id,
        Form.module_name == MODULE_NAME,
    )
    if active_only:
        q = q.filter(Form.is_active == True)
    page = q.first()
    if not page:
        raise HTTPException(status_code=404, detail="Dynamic page not found")
    return page


def _serialize_page(page: Form) -> DynamicPageOut:
    fields = []
    for form_field in sorted(page.fields or [], key=lambda item: (item.sort_order or 0, item.id or 0)):
        field = form_field.field
        if not form_field.is_visible or not field or not field.is_active:
            continue
        fields.append(DynamicFieldOut(
            form_field_id=form_field.id,
            id=field.id,
            field_label=field.field_label,
            field_key=field.field_key,
            field_type=field.field_type,
            is_required=form_field.is_required_override if form_field.is_required_override is not None else bool(field.is_required),
            options_json=field.options_json,
            placeholder=field.placeholder,
            help_text=field.help_text,
            section_name=form_field.section_name or field.section_name or "Additional Information",
            sort_order=form_field.sort_order or field.sort_order or 0,
            is_active=field.is_active,
        ))

    return DynamicPageOut(
        id=page.id,
        name=page.name,
        description=page.description,
        is_active=page.is_active,
        fields=fields,
    )


def _normalize_value(field: CustomField, raw_value) -> str:
    value = "" if raw_value is None else str(raw_value).strip()
    if value == "":
        return ""

    label = field.field_label
    field_type = field.field_type
    if field_type == "dropdown":
        if value not in (field.options_json or []):
            raise HTTPException(status_code=422, detail=f"Invalid value for {label}")
    elif field_type == "yes_no":
        if value not in {"yes", "no"}:
            raise HTTPException(status_code=422, detail=f"{label} must be Yes or No")
    elif field_type == "integer":
        try:
            int(value)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"{label} must be an integer")
    elif field_type in {"float", "number"}:
        try:
            float(value)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"{label} must be a number")
    elif field_type == "date":
        try:
            date.fromisoformat(value)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"{label} must be a valid date")
    elif field_type == "email":
        if "@" not in value:
            raise HTTPException(status_code=422, detail=f"{label} must be a valid email")
    elif field_type == "url":
        if not value.startswith(("http://", "https://")):
            raise HTTPException(status_code=422, detail=f"{label} must start with http:// or https://")
    return value


@router.get("", response_model=List[DynamicPageOut])
def list_dynamic_pages(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = _tenant_id_or_403(current_user)
    pages = (
        db.query(Form)
        .filter(Form.tenant_id == tenant_id, Form.module_name == MODULE_NAME, Form.is_active == True)
        .order_by(Form.created_at.asc(), Form.id.asc())
        .all()
    )
    return [_serialize_page(page) for page in pages]


@router.post("", response_model=DynamicPageOut, status_code=201)
def create_dynamic_page(
    payload: DynamicPageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = _require_tenant_admin(current_user)
    existing = db.query(Form.id).filter(
        Form.tenant_id == tenant_id,
        Form.module_name == MODULE_NAME,
        Form.name == payload.name,
        Form.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A page with this name already exists")

    page = Form(
        tenant_id=tenant_id,
        name=payload.name,
        module_name=MODULE_NAME,
        description=payload.description,
        is_active=True,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return _serialize_page(page)


@router.patch("/{page_id}", response_model=DynamicPageOut)
def update_dynamic_page(
    page_id: int,
    payload: DynamicPageUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = _require_tenant_admin(current_user)
    page = _get_page(db, tenant_id, page_id, active_only=False)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, key, value)
    db.commit()
    db.refresh(page)
    return _serialize_page(page)


@router.delete("/{page_id}", status_code=204)
def delete_dynamic_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = _require_tenant_admin(current_user)
    page = _get_page(db, tenant_id, page_id)
    page.is_active = False
    for form_field in page.fields or []:
        form_field.is_visible = False
        if form_field.field:
            form_field.field.is_active = False
    db.commit()


@router.post("/{page_id}/fields", response_model=DynamicPageOut, status_code=201)
def add_dynamic_page_field(
    page_id: int,
    payload: DynamicFieldCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = _require_tenant_admin(current_user)
    page = _get_page(db, tenant_id, page_id)
    field = CustomField(
        tenant_id=tenant_id,
        module_name=MODULE_NAME,
        field_label=payload.field_label,
        field_key=_unique_field_key(db, tenant_id, page_id, payload.field_label),
        field_type=payload.field_type,
        is_required=payload.is_required,
        options_json=payload.options_json,
        placeholder=payload.placeholder,
        help_text=payload.help_text,
        section_name=payload.section_name,
        sort_order=payload.sort_order,
        is_active=True,
    )
    db.add(field)
    db.flush()
    db.add(FormField(
        tenant_id=tenant_id,
        form_id=page.id,
        field_id=field.id,
        section_name=payload.section_name,
        sort_order=payload.sort_order,
        is_visible=True,
        is_required_override=payload.is_required,
    ))
    db.commit()
    return _serialize_page(_get_page(db, tenant_id, page_id))


@router.delete("/{page_id}/fields/{form_field_id}", response_model=DynamicPageOut)
def delete_dynamic_page_field(
    page_id: int,
    form_field_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = _require_tenant_admin(current_user)
    page = _get_page(db, tenant_id, page_id)
    form_field = db.query(FormField).filter(
        FormField.id == form_field_id,
        FormField.tenant_id == tenant_id,
        FormField.form_id == page_id,
    ).first()
    if not form_field:
        raise HTTPException(status_code=404, detail="Field not found")
    form_field.is_visible = False
    if form_field.field:
        form_field.field.is_active = False
    db.commit()
    return _serialize_page(_get_page(db, tenant_id, page_id))


@router.get("/students/{student_id}/values")
def get_dynamic_page_values(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    values = db.query(CustomFieldValue).filter(
        CustomFieldValue.tenant_id == student.tenant_id,
        CustomFieldValue.record_type == RECORD_TYPE,
        CustomFieldValue.record_id == student_id,
    ).all()
    return [{"field_id": item.field_id, "value": item.value or ""} for item in values]


@router.put("/students/{student_id}/values")
def upsert_dynamic_page_values(
    student_id: int,
    payload: DynamicFieldValueBulkIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = _get_student_or_404(db, student_id)
    _assert_access(current_user, student)
    updated_count = 0

    for item in payload.values:
        field = db.query(CustomField).filter(
            CustomField.id == item.field_id,
            CustomField.tenant_id == student.tenant_id,
            CustomField.module_name == MODULE_NAME,
            CustomField.is_active == True,
        ).first()
        if not field:
            continue

        value = _normalize_value(field, item.value)
        existing_values = db.query(CustomFieldValue).filter(
            CustomFieldValue.tenant_id == student.tenant_id,
            CustomFieldValue.field_id == field.id,
            CustomFieldValue.record_type == RECORD_TYPE,
            CustomFieldValue.record_id == student_id,
        ).order_by(CustomFieldValue.id.asc()).all()
        if existing_values:
            existing_values[0].value = value
            for duplicate in existing_values[1:]:
                db.delete(duplicate)
        else:
            db.add(CustomFieldValue(
                tenant_id=student.tenant_id,
                field_id=field.id,
                record_id=student_id,
                record_type=RECORD_TYPE,
                value=value,
            ))
        updated_count += 1

    db.commit()
    return {"status": "ok", "updated": updated_count}
