from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    module_name = Column(String(100), nullable=False)
    record_type = Column(String(100), nullable=False)
    record_id = Column(Integer, nullable=True)
    old_values_json = Column(JSON, nullable=True)
    new_values_json = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ImpersonationLog(Base):
    __tablename__ = "impersonation_logs"

    id = Column(Integer, primary_key=True, index=True)
    superadmin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    action = Column(String(50), nullable=False)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
