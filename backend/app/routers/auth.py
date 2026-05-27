"""
Authentication endpoints for all roles.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
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
) -> TokenResponse:
    data = {"sub": str(user_id), "role": role}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        role=role,
        user_id=user_id,
        full_name=full_name,
        must_change_password=bool(must_change_password),  # 🔥 force boolean
    )


# ──────────────────────────────────────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form_data.username
    password = form_data.password

    # 1️⃣ Student login
    student = db.query(Student).filter(Student.email == email).first()
    if student:
        if not verify_password(password, student.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not student.is_active:
            raise HTTPException(status_code=403, detail="Account is inactive")

        full_name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.email

        return _make_tokens(
            student.id,
            UserRole.student,
            full_name,
            getattr(student, "must_change_password", False),
        )

    # 2️⃣ Admin / Counsellor / Staff login
    user = db.query(User).filter(User.email == email).first()
    if user:
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account not activated")

        return _make_tokens(
            user.id,
            user.role,
            user.full_name,
            getattr(user, "must_change_password", False),
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

    if role == UserRole.student or role == "student":
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
        must_change_password,   # 🔥 IMPORTANT
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

    # 🔥 Fetch correct table explicitly
    if role == UserRole.student or role == "student":
        user = db.query(Student).filter(Student.id == user_id).first()
    else:
        user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # ✅ update password
    user.hashed_password = hash_password(payload.new_password)

    # 🔥 FORCE RESET FLAG (VERY IMPORTANT)
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
    # 🔥 Handle both User and Student safely
    role = getattr(current_user, "role", UserRole.student)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": role,
        "full_name": getattr(current_user, "full_name", None)
            or f"{getattr(current_user, 'first_name', '') or ''} {getattr(current_user, 'last_name', '') or ''}".strip(),
        "is_active": current_user.is_active,
        "must_change_password": getattr(current_user, "must_change_password", False),
    }