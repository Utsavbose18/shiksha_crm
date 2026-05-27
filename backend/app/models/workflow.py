from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    module_name = Column(String(100), nullable=False) # e.g., "leads", "applications"
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stages = relationship("WorkflowStage", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowStage.sort_order")


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    stage_key = Column(String(100), nullable=False)
    color = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0)
    is_final = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    workflow = relationship("Workflow", back_populates="stages")


class RecordStageHistory(Base):
    __tablename__ = "record_stage_history"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    record_type = Column(String(100), nullable=False) # "student", "application"
    record_id = Column(Integer, nullable=False, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    old_stage_id = Column(Integer, ForeignKey("workflow_stages.id"), nullable=True)
    new_stage_id = Column(Integer, ForeignKey("workflow_stages.id"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
