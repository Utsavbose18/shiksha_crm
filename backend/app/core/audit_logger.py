from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from typing import Dict, Any

def log_action(
    db: Session,
    user_id: int,
    tenant_id: int,
    action: str,
    module_name: str,
    record_type: str,
    record_id: int = None,
    old_values: Dict[str, Any] = None,
    new_values: Dict[str, Any] = None,
    ip_address: str = None,
    user_agent: str = None
):
    """
    Utility function to create an audit log entry.
    """
    log_entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        module_name=module_name,
        record_type=record_type,
        record_id=record_id,
        old_values_json=old_values,
        new_values_json=new_values,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(log_entry)
    db.commit()
    return log_entry
