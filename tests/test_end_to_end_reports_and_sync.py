"""End-to-end verification tests for:
1. Patient screening data visibility in Doctor Dashboard (/api/screenings)
2. Clinician PDF and TXT report downloads (/api/screenings/{id}/report.pdf & /transcript.txt)
3. Doctor-written consultation reports visibility & download in Patient Portal
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database.base import Base
from backend.database.connection import get_db
from backend.main import app
from backend.services.auth_service import seed_default_users
from backend.services.clinical_service import clinical_service


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    clinical_service.startup()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestingSessionLocal() as db:
        seed_default_users(db)

    with TestClient(app) as tc:
        yield tc

    app.dependency_overrides.clear()


def _login(tc: TestClient, email: str, password: str = "password123") -> str:
    res = tc.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_patient_screening_visible_to_doctor_and_downloadable(client: TestClient):
    patient_token = _login(client, "patient@miora.health")
    doctor_token = _login(client, "doctor@miora.health")

    # 1. Patient submits EPDS + Stage 2 psychosocial
    answers = [
        {"question_id": f"EPDS_Q{i:02d}", "selected_index": 1, "raw_response": "Sometimes"}
        for i in range(1, 11)
    ]
    psychosocial = {
        "Feeling about motherhood": "Happy",
        "Recieved Support": "High",
        "Need for Support": "Low",
        "Relationship with husband": "Very Good",
        "Relationship with the newborn": "Very Good",
        "Relationship with in-laws": "Good",
        "Family support": "High",
        "Relax/sleep when newborn is tended ": "Yes",
        "Trust and share feelings": "Yes",
    }
    sub_res = client.post(
        "/api/patients/me/screenings",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={"answers": answers, "psychosocial_answers": psychosocial},
    )
    assert sub_res.status_code in (200, 201), sub_res.text
    screening_id = sub_res.json()["id"]

    # 2. Doctor lists screenings and sees clinical_model_prediction, psychosocial_answers, item_scores
    doc_res = client.get(
        "/api/screenings",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert doc_res.status_code == 200, doc_res.text
    screenings = doc_res.json()
    matched = [s for s in screenings if s["id"] == screening_id]
    assert len(matched) == 1
    rec = matched[0]
    assert rec["psychosocial_answers"] is not None
    assert rec["clinical_model_prediction"]["status"] == "completed"
    assert len(rec["item_scores"]) == 10

    # 3. Doctor downloads PDF and TXT for this screening
    pdf_res = client.get(f"/api/screenings/{screening_id}/report.pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF")

    txt_res = client.get(f"/api/screenings/{screening_id}/transcript.txt")
    assert txt_res.status_code == 200
    assert "AANCHAL — MATERNAL CLINICAL SCREENING REPORT" in txt_res.text


def test_doctor_consultation_report_visible_and_downloadable_by_patient(client: TestClient):
    patient_token = _login(client, "patient@miora.health")
    doctor_token = _login(client, "doctor@miora.health")

    # 1. Doctor creates a finalized & patient-approved consultation report for M-104 (Amara K.)
    report_payload = {
        "patient_identifier": "M-104",
        "patient_name": "Amara K.",
        "consultation_date": "25 Nov 2026",
        "presenting_complaints": "Sleep fragmentation and mild fatigue.",
        "clinical_observations": "Cooperative, intact reality testing, Q10 negative.",
        "clinical_assessment": "Mild postpartum exhaustion.",
        "treatment_plan": "Supportive rest plan and follow-up.",
        "recommendations": "Daily 4-7-8 breathing and partner night support.",
        "followup_instructions": "Return in 3 weeks.",
        "status": "final",
        "patient_friendly_summary": "Your doctor reviewed your wellbeing and recommended restorative rest.",
        "approve_patient_version": True,
    }
    create_res = client.post(
        "/api/consultation-reports",
        headers={"Authorization": f"Bearer {doctor_token}"},
        json=report_payload,
    )
    assert create_res.status_code == 201, create_res.text
    report_id = create_res.json()["id"]

    # 2. Patient fetches consultation reports and sees the doctor's report
    pat_list = client.get(
        "/api/patients/me/consultation-reports",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert pat_list.status_code == 200, pat_list.text
    reports = pat_list.json()
    assert any(r["id"] == report_id for r in reports)

    # 3. Patient downloads the consultation report
    dl_res = client.get(
        f"/api/patients/me/consultation-reports/{report_id}/download",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert dl_res.status_code == 200
    assert "AANCHAL — DOCTOR CONSULTATION REPORT" in dl_res.text
    assert "Your doctor reviewed your wellbeing" in dl_res.text
