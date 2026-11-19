"""Authentication endpoints for MIORA.

Exposes:
- POST /api/auth/login: Authenticates users (doctor, patient, or patient's family) and returns signed JWT access token
- POST /api/auth/register: Registers new user accounts with role-based linkage and returns signed JWT access token
- POST /api/auth/verify: Validates JWT session token
- GET  /api/auth/me: Returns current authenticated user profile
"""

import json
import logging
from typing import Any, Dict
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.patient_portal import (
    AuthLoginRequest,
    AuthTokenResponse,
    UserRegisterRequest,
)
from backend.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    normalize_role,
    verify_password,
)

logger = logging.getLogger("ppd.auth_router")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Authenticate user (doctor, patient, family) and issue JWT access token",
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

    # 3. Role enforcement across the 3 roles: doctor, patient, family
    if payload.selected_role:
        normalized_selected = normalize_role(payload.selected_role)
        normalized_user_role = normalize_role(user.role)

        if normalized_selected != normalized_user_role:
            role_labels = {
                "doctor": "Healthcare Professional (Doctor)",
                "patient": "Patient (Mother)",
                "family": "Patient's Family",
            }
            user_role_label = role_labels.get(normalized_user_role, user.role.title())
            selected_role_label = role_labels.get(normalized_selected, payload.selected_role.title())

            if normalized_selected == "doctor":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: This account is registered as a {user_role_label}. You cannot access the Doctor portal.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: This account is registered as a {user_role_label}. Please select {selected_role_label} to sign in.",
                )

    # 4. Issue JWT access token
    mother_id_str = str(user.mother_id) if user.mother_id else None
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "mother_id": mother_id_str,
        "name": user.full_name,
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


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user (patient, doctor, or family) and issue JWT token",
)
def register_user(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    """Register a new user account with role-based linkage and return JWT token."""
    clean_email = payload.email.strip().lower()
    full_name = (payload.name or payload.full_name or "").strip()
    role = normalize_role(payload.role)

    # 1. Check if user already exists
    existing = db.scalar(select(User).where(User.email == clean_email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    mother_id = None

    if role == "patient":
        # Check or create Mother entity
        mother = db.scalar(select(Mother).where(Mother.email == clean_email))
        if not mother:
            mother = Mother(
                name=full_name,
                email=clean_email,
                phone=payload.phone.strip() if payload.phone else None,
                age=payload.age,
                delivery_date=payload.delivery_date,
                pregnancy_type=payload.pregnancy_type or "singleton",
                medical_history=json.dumps({"prior_ppd_diagnosis": "not-sure", "uploaded_files": []}),
                notes=json.dumps({
                    "postpartum_week": payload.postpartum_week or 4,
                    "emergency_contact": None,
                }),
            )
            db.add(mother)
            db.flush()
        mother_id = mother.id

    elif role == "family":
        # Link to mother if patient_email provided or fallback to existing mother
        if payload.patient_email:
            linked_mother = db.scalar(
                select(Mother).where(Mother.email == payload.patient_email.strip().lower())
            )
            if linked_mother:
                mother_id = linked_mother.id
        if not mother_id:
            # Fallback to demo mother or first mother in database
            default_mother = db.scalar(select(Mother).order_by(Mother.created_at.asc()))
            if default_mother:
                mother_id = default_mother.id

    # Create User account with bcrypt hash
    new_user = User(
        email=clean_email,
        hashed_password=hash_password(payload.password),
        full_name=full_name,
        role=role,
        mother_id=mother_id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT
    mother_id_str = str(mother_id) if mother_id else None
    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "mother_id": mother_id_str,
        "name": new_user.full_name,
    })

    parts = full_name.split()
    first_name = parts[0] if parts else full_name

    user_dict = {
        "id": f"P-{mother_id_str[:8].upper()}" if mother_id_str else str(new_user.id),
        "mother_id": mother_id_str,
        "user_id": str(new_user.id),
        "name": first_name,
        "fullName": full_name,
        "email": clean_email,
        "role": role,
        "avatarInitials": first_name[0].upper() if first_name else "U",
        "postpartumWeek": payload.postpartum_week or 4,
    }

    redirect_url = "/dashboard" if role == "doctor" else "/patient/dashboard"
    logger.info("User registered successfully: email=%s, role=%s", clean_email, role)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=user_dict,
        redirect_url=redirect_url,
    )


@router.post(
    "/verify",
    summary="Verify JWT token and return session validity",
)
def verify_token(
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Verify that current JWT Bearer token is valid and active."""
    return {
        "valid": True,
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
    }


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
