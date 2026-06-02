from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    module_name = Column(String(100), nullable=False) # e.g., "students", "applications"
    field_label = Column(String(255), nullable=False)
    field_key = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False) # text, number, date, dropdown
    is_required = Column(Boolean, default=False)
    options_json = Column(JSON, nullable=True)
    validation_json = Column(JSON, nullable=True)
    placeholder = Column(String(255), nullable=True)
    help_text = Column(String(500), nullable=True)
    section_name = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    field_id = Column(Integer, ForeignKey("custom_fields.id"), nullable=False, index=True)
    record_id = Column(Integer, nullable=False, index=True)
    record_type = Column(String(100), nullable=False) # "student", "application"
    value = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    field = relationship("CustomField")
