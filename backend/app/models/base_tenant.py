from sqlalchemy import Column, Integer, ForeignKey
from app.core.database import Base

class TenantAwareModel:
    """Mixin for models that belong to a tenant."""
    # We will manually add tenant_id = Column(Integer, ForeignKey("tenants.id")) to each model 
    # for explicit clarity and Alembic auto-generation reliability.
    pass
