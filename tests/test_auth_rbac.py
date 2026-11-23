"""Unit tests for MIORA 3-Role Authentication, Database Linkage, and JWT RBAC.

Covers:
- Bcrypt password hashing and verification
- JWT token issuance, claims (sub, email, role, mother_id), and decoding
- Default user seeding in database (Doctor, Patient, Patient's Family)
- Role normalization (doctor, patient, family, patients_family)
- Strict role enforcement and cross-role mismatch rejection (403 Forbidden)
- Credential validation and rejection of invalid passwords (401 Unauthorized)
- User registration lifecycle for all 3 roles
- RBAC dependencies (require_doctor, require_patient, require_family)
"""

from datetime import timedelta
import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database.base import Base
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.patient_portal import AuthLoginRequest, UserRegisterRequest
from backend.routers.auth import login_user, register_user, get_auth_me
from backend.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    normalize_role,
    require_doctor,
    require_family,
    require_patient,
    require_patient_or_family,
    seed_default_users,
    verify_password,
)


@pytest.fixture
def test_db():
    """In-memory SQLite session with schema initialized."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def test_password_hashing():
    """Verify that bcrypt hashes properly and verifies matching passwords."""
    raw = "SecureClinical2026!"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False


def test_jwt_issuance_and_decoding():
    """Verify JWT access token encoding and claim resolution."""
    user_id = str(uuid.uuid4())
    mother_id = str(uuid.uuid4())
    payload = {
        "sub": user_id,
        "email": "test@miora.health",
        "role": "family",
        "mother_id": mother_id,
        "name": "Raj K.",
    }
    token = create_access_token(payload)
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = decode_access_token(token)
    assert decoded["sub"] == user_id
    assert decoded["email"] == "test@miora.health"
    assert decoded["role"] == "family"
    assert decoded["mother_id"] == mother_id
    assert decoded["name"] == "Raj K."


def test_jwt_expiration():
    """Verify that expired JWT access tokens raise 401 Unauthorized."""
    payload = {"sub": str(uuid.uuid4()), "role": "patient"}
    expired_token = create_access_token(payload, expires_delta=timedelta(seconds=-10))

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(expired_token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_role_normalization():
    """Verify normalization of role aliases to doctor, patient, family."""
    assert normalize_role("doctor") == "doctor"
    assert normalize_role("Doctor") == "doctor"
    assert normalize_role("clinician") == "doctor"
    assert normalize_role("admin") == "doctor"

    assert normalize_role("patient") == "patient"
    assert normalize_role("Patient") == "patient"
    assert normalize_role("") == "patient"
    assert normalize_role(None) == "patient"

    assert normalize_role("family") == "family"
    assert normalize_role("patients_family") == "family"
    assert normalize_role("patient_family") == "family"
    assert normalize_role("partner") == "family"
    assert normalize_role("caregiver") == "family"


def test_seed_default_users_creates_all_three_roles(test_db):
    """Verify that seed_default_users populates Doctor, Patient, and Patient's Family."""
    seed_default_users(test_db)

    users = test_db.query(User).all()
    user_map = {u.email: u for u in users}

    # 1. Doctor
    assert "doctor@miora.health" in user_map
    doc = user_map["doctor@miora.health"]
    assert doc.role == "doctor"
    assert doc.full_name == "Dr. Elena Rostova"
    assert verify_password("password123", doc.hashed_password) is True

    # 2. Patient
    assert "patient@miora.health" in user_map
    patient = user_map["patient@miora.health"]
    assert patient.role == "patient"
    assert patient.full_name == "Amara K."
    assert patient.mother_id is not None
    assert verify_password("password123", patient.hashed_password) is True

    # 3. Patient's Family
    assert "family@miora.health" in user_map
    fam = user_map["family@miora.health"]
    assert fam.role == "family"
    assert fam.full_name == "Raj K."
    assert fam.mother_id == patient.mother_id  # Linked to the same mother!
    assert verify_password("password123", fam.hashed_password) is True


def test_login_successful_all_three_roles(test_db):
    """Verify login for Doctor, Patient, and Patient's Family."""
    seed_default_users(test_db)

    # 1. Doctor login
    doc_res = login_user(
        AuthLoginRequest(email="doctor@miora.health", password="password123", selected_role="doctor"),
        test_db,
    )
    assert doc_res.user["role"] == "doctor"
    assert doc_res.redirect_url in ("/mothers", "/dashboard")
    assert bool(doc_res.access_token) is True

    # 2. Patient login
    pat_res = login_user(
        AuthLoginRequest(email="patient@miora.health", password="password123", selected_role="patient"),
        test_db,
    )
    assert pat_res.user["role"] == "patient"
    assert pat_res.redirect_url == "/patient/dashboard"
    assert pat_res.user["mother_id"] is not None
    assert bool(pat_res.access_token) is True

    # 3. Patient's Family login
    fam_res = login_user(
        AuthLoginRequest(email="family@miora.health", password="password123", selected_role="family"),
        test_db,
    )
    assert fam_res.user["role"] == "family"
    assert fam_res.redirect_url == "/patient/dashboard"
    assert fam_res.user["mother_id"] == pat_res.user["mother_id"]
    assert bool(fam_res.access_token) is True


def test_login_invalid_password(test_db):
    """Verify that an incorrect password returns 401 Unauthorized."""
    seed_default_users(test_db)

    with pytest.raises(HTTPException) as exc_info:
        login_user(
            AuthLoginRequest(email="doctor@miora.health", password="wrongpassword", selected_role="doctor"),
            test_db,
        )
    assert exc_info.value.status_code == 401
    assert "invalid email or password" in exc_info.value.detail.lower()


def test_login_unknown_user(test_db):
    """Verify that a non-existent email returns 401 Unauthorized."""
    with pytest.raises(HTTPException) as exc_info:
        login_user(
            AuthLoginRequest(email="nonexistent@miora.health", password="password123", selected_role="patient"),
            test_db,
        )
    assert exc_info.value.status_code == 401


def test_role_mismatch_rejection(test_db):
    """Verify that attempting to access a different role portal is rejected with 403."""
    seed_default_users(test_db)

    # Patient trying to login with Doctor selected
    with pytest.raises(HTTPException) as exc_info:
        login_user(
            AuthLoginRequest(email="patient@miora.health", password="password123", selected_role="doctor"),
            test_db,
        )
    assert exc_info.value.status_code == 403
    assert "cannot access the doctor portal" in exc_info.value.detail.lower()

    # Family trying to login with Doctor selected
    with pytest.raises(HTTPException) as exc_info:
        login_user(
            AuthLoginRequest(email="family@miora.health", password="password123", selected_role="doctor"),
            test_db,
        )
    assert exc_info.value.status_code == 403
    assert "cannot access the doctor portal" in exc_info.value.detail.lower()

    # Doctor trying to login with Patient selected
    with pytest.raises(HTTPException) as exc_info:
        login_user(
            AuthLoginRequest(email="doctor@miora.health", password="password123", selected_role="patient"),
            test_db,
        )
    assert exc_info.value.status_code == 403
    assert "registered as a healthcare professional" in exc_info.value.detail.lower()


def test_register_user_all_three_roles(test_db):
    """Verify user registration for patient, doctor, and patient's family."""
    seed_default_users(test_db)

    # 1. Register new patient
    pat_reg = register_user(
        UserRegisterRequest(
            name="Deepa Rao",
            email="deepa@example.com",
            password="StrongPassword123",
            role="patient",
            age=27,
            pregnancy_type="singleton",
        ),
        test_db,
    )
    assert pat_reg.user["role"] == "patient"
    assert pat_reg.redirect_url == "/patient/dashboard"
    assert bool(pat_reg.access_token) is True

    # 2. Register family member linked to Deepa
    fam_reg = register_user(
        UserRegisterRequest(
            name="Vikram Rao",
            email="vikram@example.com",
            password="StrongPassword123",
            role="family",
            patient_email="deepa@example.com",
        ),
        test_db,
    )
    assert fam_reg.user["role"] == "family"
    assert fam_reg.redirect_url == "/patient/dashboard"
    assert fam_reg.user["mother_id"] == pat_reg.user["mother_id"]

    # 3. Register new doctor
    doc_reg = register_user(
        UserRegisterRequest(
            name="Dr. Sanjay Gupta",
            email="gupta@example.com",
            password="StrongPassword123",
            role="doctor",
        ),
        test_db,
    )
    assert doc_reg.user["role"] == "doctor"
    assert doc_reg.redirect_url in ("/mothers", "/dashboard")


def test_register_duplicate_email_rejected(test_db):
    """Verify that registering with an existing email returns 400 Bad Request."""
    seed_default_users(test_db)

    with pytest.raises(HTTPException) as exc_info:
        register_user(
            UserRegisterRequest(
                name="Imposter",
                email="doctor@miora.health",
                password="password123",
                role="doctor",
            ),
            test_db,
        )
    assert exc_info.value.status_code == 400
    assert "already exists" in exc_info.value.detail.lower()


def test_rbac_dependencies(test_db):
    """Verify role checks on User objects via RBAC dependency helpers."""
    doc_user = User(id=uuid.uuid4(), email="doc@test.com", hashed_password="x", full_name="Doc", role="doctor")
    pat_user = User(id=uuid.uuid4(), email="pat@test.com", hashed_password="x", full_name="Pat", role="patient")
    fam_user = User(id=uuid.uuid4(), email="fam@test.com", hashed_password="x", full_name="Fam", role="family")

    # require_doctor
    assert require_doctor(doc_user) == doc_user
    with pytest.raises(HTTPException):
        require_doctor(pat_user)
    with pytest.raises(HTTPException):
        require_doctor(fam_user)

    # require_patient (allows patient and family)
    assert require_patient(pat_user) == pat_user
    assert require_patient(fam_user) == fam_user
    with pytest.raises(HTTPException):
        require_patient(doc_user)

    # require_family (strictly family)
    assert require_family(fam_user) == fam_user
    with pytest.raises(HTTPException):
        require_family(pat_user)
    with pytest.raises(HTTPException):
        require_family(doc_user)
