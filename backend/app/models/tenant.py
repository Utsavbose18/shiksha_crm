from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(50), nullable=True)
    secondary_color = Column(String(50), nullable=True)
    custom_domain = Column(String(255), nullable=True)
    subscription_plan = Column(String(100), default="Free Trial")
    subscription_status = Column(String(50), default="active")
    storage_limit_mb = Column(Float, default=100.0)
    storage_used_mb = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships to be linked in other models
    # branches = relationship("Branch", back_populates="tenant", cascade="all, delete-orphan")
    # roles = relationship("Role", back_populates="tenant", cascade="all, delete-orphan")
    # workflows = relationship("Workflow", back_populates="tenant", cascade="all, delete-orphan")
    # users = relationship("User", back_populates="tenant")
