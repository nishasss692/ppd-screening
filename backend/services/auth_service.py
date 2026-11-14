"""Authentication and authorization service for MIORA.

Provides:
- Bcrypt password hashing and verification
- PyJWT token generation and verification
- Role-based access control (RBAC) dependencies
- Patient identity linkage to Mother entity
"""

from datetime import datetime, timedelta, timezone
import logging
import os
from typing import Any, Dict, Optional
import uuid

import bcrypt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.mother import Mother
from backend.models.user import User

logger = logging.getLogger("ppd.auth")

# Configuration (read from environment or secure defaults)
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "miora_clinical_screening_secret_key_2026_super_secure_32_chars_long",
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash plaintext password with bcrypt."""
    pw_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    try:
        pw_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=JWT_EXPIRATION_HOURS)

    to_encode.update({"iat": now, "exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate signed JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Resolve and authenticate current User from Bearer token."""
    if not auth_credentials or not auth_credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_credentials.credentials
    payload = decode_access_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_uuid)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_optional_current_user(
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Resolve current user if Bearer token present, else return None without raising."""
    if not auth_credentials or not auth_credentials.credentials:
        return None
    try:
        token = auth_credentials.credentials
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_uuid = uuid.UUID(user_id_str)
        return db.get(User, user_uuid)
    except Exception:
        return None


def require_patient(user: User = Depends(get_current_user)) -> User:
    """Authorize only patients."""
    if user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient account required.",
        )
    return user


def require_doctor(user: User = Depends(get_current_user)) -> User:
    """Authorize only healthcare professionals (doctors / clinicians)."""
    if user.role not in ("doctor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Healthcare professional (Doctor) authorization required.",
        )
    return user


def seed_default_users(db: Session) -> None:
    """Seed demo accounts (patient and doctor) if they do not already exist."""
    # 1. Seed demo doctor
    doctor_email = "doctor@miora.health"
    stmt = select(User).where(User.email == doctor_email)
    existing_doc = db.scalar(stmt)
    if not existing_doc:
        doc_user = User(
            email=doctor_email,
            hashed_password=hash_password("password123"),
            full_name="Dr. Elena Rostova",
            role="doctor",
            is_active=True,
        )
        db.add(doc_user)
        logger.info("Seeded default doctor account: %s", doctor_email)

    # 2. Seed demo patient & linked Mother
    patient_email = "patient@miora.health"
    stmt = select(User).where(User.email == patient_email)
    existing_patient = db.scalar(stmt)
    if not existing_patient:
        # Check or create Mother record for Amara
        mother_stmt = select(Mother).where(Mother.email == patient_email)
        existing_mother = db.scalar(mother_stmt)
        if not existing_mother:
            existing_mother = Mother(
                name="Amara K.",
                email=patient_email,
                phone="+91-98765-43210",
                age=28,
                pregnancy_type="singleton",
                medical_history='{"prior_ppd_diagnosis": "yes", "notes": "Baseline postpartum checkup", "uploaded_files": [{"id": "default-ppd-report", "name": "PPD_Diagnosis_Report.pdf", "size": "1.2 MB", "type": "application/pdf"}]}',
                notes="Primary demo patient record.",
            )
            db.add(existing_mother)
            db.flush()

        patient_user = User(
            email=patient_email,
            hashed_password=hash_password("password123"),
            full_name="Amara K.",
            role="patient",
            mother_id=existing_mother.id,
            is_active=True,
        )
        db.add(patient_user)
        logger.info("Seeded default patient account: %s (Mother ID: %s)", patient_email, existing_mother.id)

    db.commit()

