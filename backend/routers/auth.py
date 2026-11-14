"""Authentication endpoints for MIORA.

Exposes:
- POST /api/auth/login: Authenticates users and returns signed JWT access token
- GET  /api/auth/me: Returns current authenticated user profile
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.patient_portal import (
    AuthLoginRequest,
    AuthTokenResponse,
)
from backend.services.auth_service import (
    create_access_token,
    get_current_user,
    verify_password,
)

logger = logging.getLogger("ppd.auth_router")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Authenticate user and issue JWT access token",
)
def login_user(
    payload: AuthLoginRequest,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    """Validate credentials against PostgreSQL users table and return JWT token."""
    clean_email = payload.email.strip().lower()

    # 1. Lookup user in PostgreSQL
    stmt = select(User).where(User.email == clean_email)
    user = db.scalar(stmt)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Verify hashed password
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact clinic support.",
        )

    # 3. Role enforcement
    if payload.selected_role and payload.selected_role != user.role:
        if payload.selected_role == "doctor" and user.role == "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This account is registered as a Patient. You cannot access the Doctor portal.",
            )
        if payload.selected_role == "patient" and user.role == "doctor":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This account is registered as a Healthcare Professional (Doctor). Please select Doctor to sign in.",
            )

    # 4. Issue JWT access token
    mother_id_str = str(user.mother_id) if user.mother_id else None
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "mother_id": mother_id_str,
    }
    token = create_access_token(token_payload)

    parts = user.full_name.split()
    first_name = parts[0] if parts else user.full_name

    user_dict: Dict[str, Any] = {
        "id": f"P-{mother_id_str[:8].upper()}" if mother_id_str else str(user.id),
        "user_id": str(user.id),
        "mother_id": mother_id_str,
        "name": first_name,
        "fullName": user.full_name,
        "email": user.email,
        "role": user.role,
        "avatarInitials": first_name[0].upper() if first_name else "U",
        "postpartumWeek": 4,
    }

    redirect_url = "/dashboard" if user.role == "doctor" else "/patient/dashboard"
    logger.info("User authenticated successfully: email=%s, role=%s", user.email, user.role)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=user_dict,
        redirect_url=redirect_url,
    )


@router.get(
    "/me",
    summary="Get current authenticated user identity",
)
def get_auth_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return user info for the currently authenticated session."""
    mother_id_str = str(user.mother_id) if user.mother_id else None
    parts = user.full_name.split()
    first_name = parts[0] if parts else user.full_name

    return {
        "id": f"P-{mother_id_str[:8].upper()}" if mother_id_str else str(user.id),
        "user_id": str(user.id),
        "mother_id": mother_id_str,
        "name": first_name,
        "fullName": user.full_name,
        "email": user.email,
        "role": user.role,
        "avatarInitials": first_name[0].upper() if first_name else "U",
    }

