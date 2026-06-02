from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    module_name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    fields = relationship("FormField", back_populates="form", cascade="all, delete-orphan", order_by="FormField.sort_order")


class FormField(Base):
    __tablename__ = "form_fields"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False, index=True)
    field_id = Column(Integer, ForeignKey("custom_fields.id"), nullable=False, index=True)
    sort_order = Column(Integer, default=0)
    section_name = Column(String(255), nullable=True)
    is_visible = Column(Boolean, default=True)
    is_required_override = Column(Boolean, nullable=True)

    form = relationship("Form", back_populates="fields")
    field = relationship("CustomField")
