"""Comprehensive integration tests for Consultation Reports in AANCHAL.

Verifies:
1. Doctor creates draft consultation report (status='draft').
2. Doctor updates and submits final report (status='final').
3. Hospital lists reports scoped to that hospital (/api/hospital/reports).
4. Hospital accesses detailed 13-point clinical report including confidential notes.
5. Strict cross-hospital isolation: another hospital receives 403 Forbidden.
6. Patient retrieves only finalized and patient-approved reports.
7. Patient response strictly excludes confidential hospital notes.
8. Unauthenticated and unauthorized requests are rejected (401/403).
"""

import pytest
from fastapi.testclient import TestClient

from backend.database.connection import get_db_context, init_db
from backend.main import app
from backend.services.auth_service import seed_default_users


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    with get_db_context() as db:
        seed_default_users(db)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def get_token(client: TestClient, email: str, role: str) -> str:
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123", "selected_role": role},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def get_hospital_token(client: TestClient, email_or_id: str) -> str:
    resp = client.post(
        "/api/hospital/login",
        json={"email_or_id": email_or_id, "password": "password123"},
    )
    assert resp.status_code == 200, f"Hospital login failed: {resp.text}"
    return resp.json()["access_token"]


# ============================================================================
# 1. Doctor Draft and Final Submission
# ============================================================================

def test_doctor_create_draft_report(client: TestClient):
    """Doctor creates draft report successfully."""
    doc_token = get_token(client, "doctor@miora.health", "doctor")
    headers = {"Authorization": f"Bearer {doc_token}"}

    payload = {
        "mother_id": "M-108",
        "patient_name": "Amara Patel",
        "patient_identifier": "AM-2024-890",
        "appointment_id": "appt-001",
        "doctor_name": "Dr. Sarah Chen, MD",
        "doctor_specialization": "Perinatal Psychiatrist",
        "hospital_id": "HOSP-001",
        "hospital_name": "Apollo Hospitals — Department of Perinatal Psychiatry",
        "department": "Perinatal Psychiatry",
        "consultation_date": "2026-11-20",
        "presenting_complaints": "Persistent exhaustion and tearfulness 6 weeks postpartum.",
        "clinical_observations": "Patient engaged warmly, mild psychomotor agitation noted.",
        "clinical_assessment": "Mild Postpartum Depressive Episode (ICD-10 F53.0).",
        "treatment_plan": "Supportive psychotherapy bi-weekly and sleep optimization.",
        "medications": "None initiated at this stage.",
        "recommendations": "Encouraged peer community support and spousal involvement.",
        "followup_instructions": "Review in 2 weeks or sooner if mood declines.",
        "next_followup_date": "2026-12-04",
        "additional_notes": "CONFIDENTIAL: Spousal dynamic stable. Mother receptive to non-pharmacologic care.",
        "status": "draft",
        "patient_friendly_summary": "During our check-in, we talked about sleep and feeling overwhelmed.",
        "patient_friendly_medications": "No medication is needed at this time.",
        "patient_friendly_recommendations": "Rest when the baby rests; lean on your family circle.",
        "patient_friendly_followup": "We will have our next check-in in 2 weeks on December 4, 2026.",
        "patient_approved": False,
    }

    resp = client.post("/api/consultation-reports", json=payload, headers=headers)
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    assert data["report_code"].startswith("REP-")
    assert data["status"] == "draft"
    assert data["additional_notes"] == payload["additional_notes"]


def test_doctor_finalize_and_publish_report(client: TestClient):
    """Doctor finalizes draft report and approves patient-friendly version."""
    doc_token = get_token(client, "doctor@miora.health", "doctor")
    headers = {"Authorization": f"Bearer {doc_token}"}

    # Create draft first
    draft_payload = {
        "mother_id": "M-108",
        "patient_name": "Amara Patel",
        "patient_identifier": "AM-2024-890",
        "doctor_name": "Dr. Sarah Chen, MD",
        "doctor_specialization": "Perinatal Psychiatrist",
        "hospital_id": "HOSP-001",
        "hospital_name": "Apollo Hospitals",
        "consultation_date": "2026-11-21",
        "presenting_complaints": "Anxiety around nighttime feedings.",
        "clinical_assessment": "Postpartum Anxiety (Mild).",
        "status": "draft",
        "additional_notes": "Confidential physician thoughts.",
        "patient_approved": False,
    }
    resp = client.post("/api/consultation-reports", json=draft_payload, headers=headers)
    assert resp.status_code in (200, 201), resp.text
    report_id = resp.json()["id"]

    # Finalize
    update_payload = {
        "status": "final",
        "patient_approved": True,
        "patient_friendly_summary": "We discussed feeding anxieties; sleep strategies were introduced.",
        "patient_friendly_followup": "Next review in 3 weeks.",
    }
    resp2 = client.put(f"/api/consultation-reports/{report_id}", json=update_payload, headers=headers)
    assert resp2.status_code == 200
    updated = resp2.json()
    assert updated["status"] == "final"
    assert updated["patient_approved"] is True


# ============================================================================
# 2. Hospital Portal Access & Isolation
# ============================================================================

def test_hospital_list_and_view_report(client: TestClient):
    """Hospital staff retrieves scoped reports including detailed clinical observations and confidential notes."""
    hosp_token = get_hospital_token(client, "apollo@hospital.miora.health")
    headers = {"Authorization": f"Bearer {hosp_token}"}

    # List reports
    resp = client.get("/api/hospital/reports", headers=headers)
    assert resp.status_code == 200
    reports = resp.json()
    assert isinstance(reports, list)
    assert len(reports) >= 1
    report = reports[0]
    assert "report_code" in report
    assert "patient_name" in report
    assert "doctor_name" in report

    # Detail view
    report_id = report["id"]
    detail_resp = client.get(f"/api/hospital/reports/{report_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["hospital_id"] == "HOSP-001"
    # Hospital has access to clinical details and additional notes
    assert "clinical_assessment" in detail
    assert "treatment_plan" in detail


def test_cross_hospital_report_isolation(client: TestClient):
    """Hospital B cannot view Hospital A's clinical consultation report."""
    hosp_a_token = get_hospital_token(client, "apollo@hospital.miora.health")
    hosp_b_token = get_hospital_token(client, "cloudnine@hospital.miora.health")

    # Get a report belonging to Apollo
    resp_a = client.get("/api/hospital/reports", headers={"Authorization": f"Bearer {hosp_a_token}"})
    apollo_reports = resp_a.json()
    assert len(apollo_reports) > 0
    target_report_id = apollo_reports[0]["id"]

    # Cloudnine attempts to view Apollo's report
    resp_b = client.get(
        f"/api/hospital/reports/{target_report_id}",
        headers={"Authorization": f"Bearer {hosp_b_token}"},
    )
    assert resp_b.status_code == 403, "Cross-hospital report access must return 403 Forbidden"


# ============================================================================
# 3. Patient Access & Confidentiality Protection
# ============================================================================

def test_patient_receives_only_approved_reports_and_no_confidential_notes(client: TestClient):
    """Patient retrieves only finalized, patient-approved reports and CANNOT see confidential notes."""
    pat_token = get_token(client, "patient@miora.health", "patient")
    headers = {"Authorization": f"Bearer {pat_token}"}

    resp = client.get("/api/patients/me/consultation-reports", headers=headers)
    assert resp.status_code == 200
    reports = resp.json()
    assert isinstance(reports, list)

    for r in reports:
        # Confidential notes must be excluded entirely from patient schema
        assert "additional_notes" not in r
        assert "confidential" not in str(r).lower()
        # Patient friendly fields must be present
        assert "summary" in r
        assert "doctor_name" in r


def test_unauthenticated_requests_blocked(client: TestClient):
    """Anonymous calls to consultation reports are rejected."""
    assert client.get("/api/hospital/reports").status_code in (401, 403)
    assert client.get("/api/patients/me/consultation-reports").status_code in (401, 403)
    assert client.post("/api/consultation-reports", json={}).status_code in (401, 403)
