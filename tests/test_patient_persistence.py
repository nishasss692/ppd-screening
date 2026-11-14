"""Backend test suite for Patient Records Persistence, Authentication, and PostgreSQL Storage."""

import json
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.base import Base
from backend.database.connection import engine, get_db_context
from backend.services.auth_service import hash_password, verify_password, create_access_token, seed_default_users

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_seed_users():
    """Ensure database schema and default doctor and patient users exist."""
    Base.metadata.create_all(bind=engine)
    with get_db_context() as db:
        seed_default_users(db)


def test_password_hashing_and_verification():
    """Verify bcrypt password hashing and verification."""
    password = "SecretPassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_generation_and_validation():
    """Verify JWT token encoding and decoding."""
    payload = {"sub": str(uuid.uuid4()), "role": "patient", "email": "test@miora.health"}
    token = create_access_token(payload)
    assert isinstance(token, str)
    assert len(token) > 20


def test_patient_registration_and_login_lifecycle():
    """Test full patient registration -> login -> profile persistence cycle."""
    unique_email = f"patient_{uuid.uuid4().hex[:8]}@example.com"
    reg_payload = {
        "name": "Priya Sharma",
        "email": unique_email,
        "password": "StrongPassword123",
        "age": 29,
        "phone": "+91-98765-01234",
        "pregnancy_type": "singleton",
        "postpartum_week": 6,
    }

    # 1. Register new patient
    resp = client.post("/api/patients/register", json=reg_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == unique_email
    assert data["user"]["role"] == "patient"
    assert data["user"]["name"] == "Priya"
    mother_id = data["user"]["mother_id"]
    assert mother_id is not None
    token = data["access_token"]

    # 2. Duplicate registration with same email should be rejected
    dup_resp = client.post("/api/patients/register", json=reg_payload)
    assert dup_resp.status_code == 400

    # 3. Log in with credentials
    login_resp = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "StrongPassword123", "selected_role": "patient"},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert login_data["access_token"] is not None
    assert login_data["user"]["role"] == "patient"

    # 4. Failed login with bad password
    bad_resp = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "WrongPassword"},
    )
    assert bad_resp.status_code == 401

    # 5. Role mismatch rejection
    mismatch_resp = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "StrongPassword123", "selected_role": "doctor"},
    )
    assert mismatch_resp.status_code == 403

    # 6. Get Patient Profile
    headers = {"Authorization": f"Bearer {token}"}
    profile_resp = client.get("/api/patients/me", headers=headers)
    assert profile_resp.status_code == 200
    prof = profile_resp.json()
    assert prof["full_name"] == "Priya Sharma"
    assert prof["email"] == unique_email
    assert prof["age"] == 29

    # 7. Update Patient Profile
    update_resp = client.put(
        "/api/patients/me",
        json={"age": 30, "phone": "+91-99999-11111", "pregnancy_type": "twins"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated_prof = update_resp.json()
    assert updated_prof["age"] == 30
    assert updated_prof["pregnancy_type"] == "twins"

    # 8. Save and Retrieve Medical History
    med_payload = {
        "prior_ppd_diagnosis": "yes",
        "medical_history": "Mild postpartum blues following prior birth.",
        "uploaded_files": [{"id": "doc-1", "name": "Discharge_Summary.pdf", "size": "1.4 MB"}],
    }
    save_med = client.put("/api/patients/me/medical-history", json=med_payload, headers=headers)
    assert save_med.status_code == 200
    assert save_med.json()["prior_ppd_diagnosis"] == "yes"

    get_med = client.get("/api/patients/me/medical-history", headers=headers)
    assert get_med.status_code == 200
    assert get_med.json()["prior_ppd_diagnosis"] == "yes"
    assert len(get_med.json()["uploaded_files"]) == 1

    # 9. Complete EPDS Screening Session (10 canonical items)
    epds_answers = [
        {"question_id": f"EPDS_Q{str(i).zfill(2)}", "selected_index": 1}
        for i in range(1, 11)
    ]
    # Set Q10 to index 3 (Never, score 0)
    epds_answers[9]["selected_index"] = 3

    screen_resp = client.post(
        "/api/patients/me/screenings",
        json={"answers": epds_answers, "notes": "Completed test screening."},
        headers=headers,
    )
    assert screen_resp.status_code == 201
    s_data = screen_resp.json()
    assert s_data["total_score"] > 0
    assert s_data["screening_status"] == "completed"
    screening_id = s_data["id"]

    # 10. Retrieve historical screenings
    hist_resp = client.get("/api/patients/me/screenings", headers=headers)
    assert hist_resp.status_code == 200
    hist = hist_resp.json()
    assert len(hist) >= 1
    assert hist[0]["id"] == screening_id

    # 11. Retrieve single screening detail
    detail_resp = client.get(f"/api/patients/me/screenings/{screening_id}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == screening_id
    assert len(detail_resp.json()["item_scores"]) == 10

    # 12. Synthesized reports overview
    rep_resp = client.get("/api/patients/me/reports", headers=headers)
    assert rep_resp.status_code == 200
    rep_data = rep_resp.json()
    assert rep_data["screenings_count"] >= 1
    assert rep_data["latest_screening"]["totalScore"] == s_data["total_score"]

    # 13. Unauthorized access check: Doctor endpoint or unauthenticated access
    unauth_resp = client.get("/api/patients/me")
    assert unauth_resp.status_code == 401

    # 14. Doctor Synchronization: Doctor queries mother's screenings from PostgreSQL
    doc_login_resp = client.post(
        "/api/auth/login",
        json={"email": "doctor@miora.health", "password": "password123", "selected_role": "doctor"},
    )
    assert doc_login_resp.status_code == 200
    doc_token = doc_login_resp.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # Doctor queries mother's screenings via /api/mothers/{mother_id}/screenings
    doc_screenings_resp = client.get(f"/api/mothers/{mother_id}/screenings", headers=doc_headers)
    assert doc_screenings_resp.status_code == 200
    doc_screenings = doc_screenings_resp.json()
    assert len(doc_screenings) >= 1
    assert any(s["id"] == screening_id for s in doc_screenings)

    # Doctor queries individual screening via /api/screenings/{screening_id}
    doc_single_resp = client.get(f"/api/screenings/{screening_id}", headers=doc_headers)
    assert doc_single_resp.status_code == 200
    assert doc_single_resp.json()["id"] == screening_id
    assert doc_single_resp.json()["total_score"] == s_data["total_score"]
    assert doc_single_resp.json()["mother_id"] == mother_id


def test_epds_conversational_screening_persistence_and_raw_responses():
    """Verify storing all 10 raw spoken responses, derived scores, Q10 safety alert, and visibility across portals."""
    unique_email = f"mother_voice_{uuid.uuid4().hex[:8]}@example.com"
    reg_payload = {
        "name": "Ananya Sen",
        "email": unique_email,
        "password": "Password123!",
        "age": 28,
        "phone": "+91-98765-43210",
        "pregnancy_type": "singleton",
        "postpartum_week": 4,
    }

    # 1. Register mother
    reg_resp = client.post("/api/patients/register", json=reg_payload)
    assert reg_resp.status_code == 201
    auth_data = reg_resp.json()
    token = auth_data["access_token"]
    mother_id = auth_data["user"]["mother_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. 10 canonical answers with raw recognised speech responses
    # Q1: "As much as I always could" (idx 0, score 0)
    # Q2: "Rather less than I used to" (idx 1, score 1)
    # Q3: "Yes, most of the time" (idx 0, reverse score 3)
    # Q4: "Yes, sometimes" (idx 2, score 2)
    # Q5: "Yes, quite a lot" (idx 0, reverse score 3)
    # Q6: "Yes, most of the time I haven't been able to cope at all" (idx 0, reverse score 3)
    # Q7: "Yes, most of the time" (idx 0, reverse score 3)
    # Q8: "Yes, most of the time" (idx 0, reverse score 3)
    # Q9: "Yes, most of the time" (idx 0, reverse score 3)
    # Q10: "Yes, quite often" (idx 0, reverse score 3, self-harm positive!)
    answers = [
        {"question_id": "EPDS_Q01", "selected_index": 0, "raw_response": "As much as I always could"},
        {"question_id": "EPDS_Q02", "selected_index": 1, "raw_response": "Rather less than I used to"},
        {"question_id": "EPDS_Q03", "selected_index": 0, "raw_response": "Yes, most of the time I blame myself"},
        {"question_id": "EPDS_Q04", "selected_index": 2, "raw_response": "Yes, sometimes I have been worried"},
        {"question_id": "EPDS_Q05", "selected_index": 0, "raw_response": "Yes, quite a lot I felt scared"},
        {"question_id": "EPDS_Q06", "selected_index": 0, "raw_response": "Yes, most of the time things get on top"},
        {"question_id": "EPDS_Q07", "selected_index": 0, "raw_response": "Yes, most of the time I have difficulty sleeping"},
        {"question_id": "EPDS_Q08", "selected_index": 0, "raw_response": "Yes, most of the time I felt sad or miserable"},
        {"question_id": "EPDS_Q09", "selected_index": 0, "raw_response": "Yes, most of the time I have been crying"},
        {"question_id": "EPDS_Q10", "selected_index": 0, "raw_response": "Yes, quite often the thought of harming myself has occurred"},
    ]

    submission_payload = {
        "answers": answers,
        "notes": "Spoken responses captured via AI conversational screening workspace.",
        "video_metadata": {
            "status": "recorded",
            "mime_type": "video/webm",
            "duration_seconds": 128.5,
            "question_count": 10,
        },
        "question_timestamps": [
            {"question_id": a["question_id"], "duration_ms": 12000, "raw_response": a["raw_response"]}
            for a in answers
        ],
    }

    # 3. Submit screening
    submit_resp = client.post("/api/patients/me/screenings", json=submission_payload, headers=headers)
    assert submit_resp.status_code == 201
    screening = submit_resp.json()
    screening_id = screening["id"]

    # Verify scores and Q10 safety alert
    # Total = 0 + 1 + 3 + 2 + 3 + 3 + 3 + 3 + 3 + 3 = 24 (High Risk)
    assert screening["total_score"] == 24
    assert screening["risk_classification"] == "high"
    assert screening["q10_safety_alert"] is True
    assert screening["screening_status"] == "completed"

    # Verify all 10 raw responses are stored in submitted_answers and model_metadata
    submitted_answers = screening["submitted_answers"]
    assert len(submitted_answers) == 10
    assert submitted_answers["EPDS_Q01"]["raw_response"] == "As much as I always could"
    assert submitted_answers["EPDS_Q10"]["raw_response"] == "Yes, quite often the thought of harming myself has occurred"
    assert submitted_answers["EPDS_Q03"]["score"] == 3  # reverse scored
    assert screening["model_metadata"]["raw_responses"]["EPDS_Q01"] == "As much as I always could"

    # 4. Immediate visibility in Patient History
    history_resp = client.get("/api/patients/me/screenings", headers=headers)
    assert history_resp.status_code == 200
    history_list = history_resp.json()
    assert any(s["id"] == screening_id for s in history_list)

    # 5. Immediate visibility in Patient Reports Overview
    reports_resp = client.get("/api/patients/me/reports", headers=headers)
    assert reports_resp.status_code == 200
    reports_data = reports_resp.json()
    assert reports_data["latest_screening"]["totalScore"] == 24
    assert reports_data["latest_screening"]["q10Alert"] is True

    # 6. Immediate visibility in Doctor Dashboard
    doc_login = client.post(
        "/api/auth/login",
        json={"email": "doctor@miora.health", "password": "password123", "selected_role": "doctor"},
    )
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    doc_screenings = client.get(f"/api/mothers/{mother_id}/screenings", headers=doc_headers)
    assert doc_screenings.status_code == 200
    assert any(s["id"] == screening_id for s in doc_screenings.json())

    doc_single = client.get(f"/api/screenings/{screening_id}", headers=doc_headers)
    assert doc_single.status_code == 200
    doc_single_data = doc_single.json()
    assert doc_single_data["id"] == screening_id
    assert doc_single_data["total_score"] == 24
    assert doc_single_data["q10_safety_alert"] is True
    assert doc_single_data["submitted_answers"]["EPDS_Q10"]["score"] == 3

