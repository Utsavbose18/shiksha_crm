"""
Authentication endpoints for all roles.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import oauth2_scheme
from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
)
from app.models.user import User, Student, UserRole
from app.schemas.schemas import (
    TokenResponse,
    RefreshRequest,
    PasswordChangeRequest,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_tokens(
    user_id: int,
    role: str,
    full_name: str,
    must_change_password: bool = False,
    tenant_id: int = None
) -> TokenResponse:
    data = {"sub": str(user_id), "role": role, "tenant_id": tenant_id}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        role=role,
        user_id=user_id,
        full_name=full_name,
        must_change_password=bool(must_change_password),
        tenant_id=tenant_id
    )


# ──────────────────────────────────────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    email = form_data.username
    password = form_data.password

    # Determine user and tenant
    tenant_id_to_use = None
    if form_data.client_id:
        from app.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.slug == form_data.client_id).first()
        if not tenant:
            raise HTTPException(status_code=400, detail="Invalid tenant")
        tenant_id_to_use = tenant.id

    # 1️⃣ Student login (requires tenant)
    if tenant_id_to_use:
        student = db.query(Student).filter(
            Student.email == email,
            Student.tenant_id == tenant_id_to_use
        ).first()
        if student:
            if not verify_password(password, student.hashed_password):
                raise HTTPException(status_code=401, detail="Invalid credentials")
            if not student.is_active:
                raise HTTPException(status_code=403, detail="Account is inactive")

            full_name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.email

            return _make_tokens(
                student.id,
                "student",
                full_name,
                getattr(student, "must_change_password", False),
                tenant_id_to_use
            )

    # 2️⃣ Admin / Counsellor / Staff login
    query = db.query(User).filter(User.email == email)
    if tenant_id_to_use:
        query = query.filter(User.tenant_id == tenant_id_to_use)

    user = query.first()

    if user:
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account not activated")

        # Keep the application role stable for the frontend and route guards.
        # RBAC permissions are checked separately via UserRoleMapping.
        role = user.role.value if hasattr(user.role, "value") else user.role

        return _make_tokens(
            user.id,
            role,
            user.full_name,
            getattr(user, "must_change_password", False),
            tenant_id_to_use or user.tenant_id # fallback to user's primary tenant
        )

    raise HTTPException(status_code=401, detail="Invalid credentials")


# ──────────────────────────────────────────────────────────────────────────────
# Refresh Token
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = int(decoded["sub"])
    role = decoded["role"]
    tenant_id = decoded.get("tenant_id")

    if role == "student":
        user = db.query(Student).filter(
            Student.id == user_id,
            Student.is_active == True
        ).first()
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() if user else ""
        must_change_password = getattr(user, "must_change_password", False) if user else False
    else:
        user = db.query(User).filter(
            User.id == user_id,
            User.is_active == True
        ).first()
        full_name = user.full_name if user else ""
        must_change_password = getattr(user, "must_change_password", False) if user else False

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return _make_tokens(
        user_id,
        role,
        full_name,
        must_change_password,
        tenant_id
    )


# ──────────────────────────────────────────────────────────────────────────────
# Change Password
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload_token = decode_token(token)

    user_id = int(payload_token.get("sub"))
    role = payload_token.get("role")

    if role == "student":
        user = db.query(Student).filter(Student.id == user_id).first()
    else:
        user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = False

    db.commit()
    db.refresh(user)

    return {
        "message": "Password changed successfully",
        "must_change_password": False,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Current User
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    role = getattr(current_user, "role", "student")

    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": role,
        "full_name": getattr(current_user, "full_name", None)
            or f"{getattr(current_user, 'first_name', '') or ''} {getattr(current_user, 'last_name', '') or ''}".strip(),
        "is_active": current_user.is_active,
        "must_change_password": getattr(current_user, "must_change_password", False),
        "tenant_id": getattr(current_user, "active_tenant_id", None)
    }
