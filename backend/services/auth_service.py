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
from backend.models.consultation_report import ConsultationReport

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


def normalize_role(role: Optional[str]) -> str:
    """Normalize role string to 'doctor', 'patient', 'family', or 'hospital'."""
    if not role:
        return "patient"
    r = role.strip().lower()
    if r in ("hospital", "hospital_staff", "hospital_admin", "clinic"):
        return "hospital"
    if r in ("doctor", "clinician", "physician", "admin"):
        return "doctor"
    if r in ("family", "patients_family", "patient_family", "partner", "caregiver", "relative"):
        return "family"
    return "patient"


def require_patient(user: User = Depends(get_current_user)) -> User:
    """Authorize patients or linked family members."""
    if user.role not in ("patient", "family"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient or family account required.",
        )
    return user


def require_family(user: User = Depends(get_current_user)) -> User:
    """Authorize only patient's family accounts."""
    if user.role != "family":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient's family authorization required.",
        )
    return user


def require_patient_or_family(user: User = Depends(get_current_user)) -> User:
    """Authorize patient or family member."""
    if user.role not in ("patient", "family"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient or family account required.",
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


def require_hospital(user: User = Depends(get_current_user)) -> User:
    """Authorize only verified hospital staff accounts."""
    if user.role not in ("hospital", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Hospital staff authorization required.",
        )
    return user


HOSPITAL_USER_MAPPING = {
    "apollo@hospital.miora.health": {
        "hospital_id": "HOSP-001",
        "hospital_name": "Apollo Women's Hospital",
        "hospital_location": "Bangalore, Karnataka",
    },
    "cloudnine@hospital.miora.health": {
        "hospital_id": "HOSP-002",
        "hospital_name": "Cloudnine Hospitals",
        "hospital_location": "Hyderabad, Telangana",
    },
    "fortis@hospital.miora.health": {
        "hospital_id": "HOSP-003",
        "hospital_name": "Fortis La Femme",
        "hospital_location": "New Delhi, NCR",
    },
}


def get_user_hospital_profile(user: User) -> Dict[str, str]:
    """Resolve hospital profile details for authenticated hospital staff user."""
    profile = HOSPITAL_USER_MAPPING.get(user.email.lower().strip())
    if profile:
        return profile
    return {
        "hospital_id": "HOSP-001",
        "hospital_name": user.full_name or "Apollo Women's Hospital",
        "hospital_location": "Bangalore, Karnataka",
    }


def seed_default_users(db: Session) -> None:
    """Seed demo accounts (doctor, patient, and patient's family) if they do not already exist."""
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

    if not existing_patient:
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

    # 3. Seed demo patient's family member linked to the same Mother
    family_email = "family@miora.health"
    stmt = select(User).where(User.email == family_email)
    existing_family = db.scalar(stmt)
    if not existing_family:
        family_user = User(
            email=family_email,
            hashed_password=hash_password("password123"),
            full_name="Raj K.",
            role="family",
            mother_id=existing_mother.id,
            is_active=True,
        )
        db.add(family_user)
        logger.info("Seeded default patient's family account: %s (Linked Mother ID: %s)", family_email, existing_mother.id)

    # 4. Seed demo hospital staff accounts
    demo_hospitals = [
        ("apollo@hospital.miora.health", "Apollo Women's Hospital Staff", "HOSP-001"),
        ("cloudnine@hospital.miora.health", "Cloudnine Hospital Staff", "HOSP-002"),
    ]
    for h_email, h_name, h_id in demo_hospitals:
        stmt = select(User).where(User.email == h_email)
        existing_hosp = db.scalar(stmt)
        if not existing_hosp:
            hosp_user = User(
                email=h_email,
                hashed_password=hash_password("password123"),
                full_name=h_name,
                role="hospital",
                is_active=True,
            )
            db.add(hosp_user)
            logger.info("Seeded default hospital account: %s (%s)", h_email, h_id)

    # 4. Seed sample consultation report for Apollo Hospital and Amara
    existing_rep = db.scalar(select(ConsultationReport).limit(1))
    if not existing_rep:
        demo_patient = db.scalar(select(User).where(User.email == patient_email))
        mother_id = demo_patient.mother_id if demo_patient and demo_patient.mother_id else None
        if not mother_id:
            m = db.scalar(select(Mother).limit(1))
            mother_id = m.id if m else None

        if mother_id:
            sample_report = ConsultationReport(
                report_code="REP-2026-001",
                mother_id=mother_id,
                patient_name="Amara",
                patient_identifier="M-108",
                appointment_id=None,
                doctor_id="DR-005",
                doctor_name="Dr. Elena Rostova",
                doctor_specialization="Perinatal Psychiatry Lead",
                hospital_id="HOSP-001",
                hospital_name="Apollo Women's Hospital",
                department="Perinatal Mental Health",
                consultation_date="20 Nov 2026",
                presenting_complaints="Patient reported persistent low mood, fragmented sleep under 4 continuous hours, and crying spells especially during evening hours over the past 3 weeks.",
                clinical_observations="Patient was cooperative, affect was constricted and mildly dysphoric. Thought processes coherent, denied active suicidal ideation (EPDS Question 10 score 0). Insight preserved.",
                clinical_assessment="Postpartum depression with mild-to-moderate emotional exhaustion and sleep fragmentation (ICD-10 F53.0).",
                treatment_plan="Initiate supportive cognitive-behavioral perinatal therapy (6 sessions). Coordinate sleep restoration with family support. Psychoeducation on emotional recovery.",
                medications="No pharmacotherapy indicated at this stage. Recommended continuation of prenatal vitamins and magnesium glycinate (200mg nightly) for sleep hygiene.",
                recommendations="Daily 4-7-8 grounding breathing exercises. Partner to manage 1-2 nighttime feeds to ensure 5+ hours unbroken maternal sleep.",
                followup_instructions="Schedule follow-up appointment in 3 weeks. Contact clinic or Tele-MANAS immediately if acute distress increases.",
                next_followup_date="11 Dec 2026 at 11:00 AM",
                additional_notes="Patient is receptive to non-pharmacological interventions. Husband Raj is engaged and supportive.",
                ai_screening_summary="AI multimodal acoustic analysis indicated mild prosodic flatness; EPDS equivalent score was 14/30.",
                epds_summary="EPDS Total Score: 14/30 (Moderate distress). Item 10: 0 (No self-harm).",
                status="final",
                patient_friendly_summary="During your consultation on 20 Nov 2026, Dr. Elena Rostova reviewed your emotional wellbeing and discussed your sleep challenges and low mood. We agreed on a gentle, supportive plan focused on getting more continuous rest and daily relaxation.",
                patient_friendly_medications="Continue your regular daily vitamins. Magnesium glycinate (200mg) before bed can help relax your body for sleep.",
                patient_friendly_recommendations="Practice your 4-7-8 breathing exercises daily. Ask your partner or family to help take over one nighttime feed so you can get at least 5 hours of unbroken sleep.",
                patient_friendly_followup="Your next check-in is scheduled for 11 Dec 2026 at 11:00 AM. If you feel overwhelmed before then, please message us or reach out anytime.",
                patient_approved=True,
                submitted_at=datetime.now(timezone.utc),
            )
            db.add(sample_report)
            logger.info("Seeded initial consultation report REP-2026-001")

    db.commit()

