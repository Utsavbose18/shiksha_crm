from datetime import datetime, timedelta, timezone
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, Student
from app.models.tenant import Tenant
from app.models.rbac import UserRoleMapping, RolePermission, Permission

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    role = payload.get("role")
    tenant_id = payload.get("tenant_id") # Can be null for Super Admin on platform view

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    if role == "student":
        user = db.query(Student).filter(
            Student.id == int(user_id),
            Student.is_active == True
        ).first()
    else:
        user = db.query(User).filter(
            User.id == int(user_id),
            User.is_active == True
        ).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Attach token-scoped context to the user object for endpoint checks.
    user.active_tenant_id = tenant_id
    user.impersonated_by = payload.get("impersonated_by")

    return user

def require_roles(*roles):
    def _checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {roles}",
            )
        return current_user
    return _checker

def get_current_tenant_user(current_user=Depends(get_current_user)):
    """Ensures the user has an active tenant_id context."""
    if not hasattr(current_user, "active_tenant_id") or not current_user.active_tenant_id:
        if current_user.role != "platform_super_admin":
            raise HTTPException(status_code=403, detail="Tenant context required")
    return current_user

def require_permissions(*permissions):
    """Dependency to check if user has specific permission in their current tenant."""
    def _checker(current_user=Depends(get_current_tenant_user), db: Session = Depends(get_db)):
        if current_user.role == "platform_super_admin":
            return current_user

        if current_user.role == "student":
            return current_user # Student permissions handled differently usually

        # Get user's role mapping for the active tenant
        mapping = db.query(UserRoleMapping).filter(
            UserRoleMapping.user_id == current_user.id,
            UserRoleMapping.tenant_id == current_user.active_tenant_id
        ).first()

        if not mapping:
             # fallback to basic role if no mapping (for backward compatibility during migration)
             if current_user.role == "admin":
                 return current_user
             raise HTTPException(status_code=403, detail="No role mapped for this tenant")

        # Check permissions
        role_permissions = db.query(Permission.key).join(
            RolePermission, RolePermission.permission_id == Permission.id
        ).filter(
            RolePermission.role_id == mapping.role_id
        ).all()

        user_perm_keys = [p[0] for p in role_permissions]

        # If any of the required permissions are missing
        for perm in permissions:
            if perm not in user_perm_keys:
                raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")

        return current_user
    return _checker
