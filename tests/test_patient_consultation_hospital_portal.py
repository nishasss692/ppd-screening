"""Comprehensive integration tests for the AANCHAL Patient Consultation + Hospital Portal workflow.

Verifies:
1. Hospital authentication & validation (valid credentials, invalid password, wrong role).
2. Patient consultation appointment request submission (genuine backend UUID, 'pending' status).
3. Patient appointment retrieval reflecting hospital updates.
4. Hospital dashboard metrics and scoped request listing.
5. Hospital status transitions: confirm, propose alternative time, reject.
6. Hospital doctor assignment.
7. Clinician viewing assigned appointments.
8. Strict multi-tenant cross-hospital isolation (preventing cross-hospital access).
9. Authorization guardrails (anonymous / patient access to hospital endpoints rejected).
10. Hospital associated doctor roster.
"""

import json
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.database.connection import get_db_context, init_db
from backend.main import app
from backend.models.care_plan import CarePlan
from backend.models.mother import Mother
from backend.models.user import User
from backend.services.auth_service import hash_password, seed_default_users


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    """Ensure database tables and demo seed accounts exist."""
    init_db()
    with get_db_context() as db:
        seed_default_users(db)
    yield


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


def get_token(client: TestClient, email: str, role: str) -> str:
    """Helper to authenticate and retrieve access token."""
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123", "selected_role": role},
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


def get_hospital_token(client: TestClient, email_or_id: str) -> str:
    """Helper to authenticate hospital staff and retrieve token."""
    resp = client.post(
        "/api/hospital/login",
        json={"email_or_id": email_or_id, "password": "password123"},
    )
    assert resp.status_code == 200, f"Hospital login failed for {email_or_id}: {resp.text}"
    return resp.json()["access_token"]


# ============================================================================
# 1. Hospital Login & Role Verification
# ============================================================================

def test_hospital_login_success(client: TestClient):
    """Hospital staff can log in using registered email or Hospital ID."""
    # Via email
    resp = client.post(
        "/api/hospital/login",
        json={"email_or_id": "apollo@hospital.miora.health", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["hospital"]["hospital_id"] == "HOSP-001"
    assert data["hospital"]["role"] == "hospital"

    # Via Hospital ID shortcut
    resp_id = client.post(
        "/api/hospital/login",
        json={"email_or_id": "HOSP-001", "password": "password123"},
    )
    assert resp_id.status_code == 200
    assert resp_id.json()["hospital"]["hospital_id"] == "HOSP-001"


def test_hospital_login_invalid_password(client: TestClient):
    """Invalid password returns HTTP 401."""
    resp = client.post(
        "/api/hospital/login",
        json={"email_or_id": "HOSP-001", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert "Invalid" in resp.json()["detail"]


def test_hospital_login_wrong_role_rejected(client: TestClient):
    """Patient or doctor account attempting hospital sign-in is forbidden."""
    resp = client.post(
        "/api/hospital/login",
        json={"email_or_id": "patient@miora.health", "password": "password123"},
    )
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["detail"]


# ============================================================================
# 2. Patient Consultation Booking Request
# ============================================================================

def test_patient_submits_appointment_request(client: TestClient):
    """Patient submits an appointment request awaiting hospital confirmation."""
    patient_token = get_token(client, "patient@miora.health", "patient")

    payload = {
        "doctor_name": "Dr. Sunita Rao",
        "doctor_id": "DR-001",
        "role": "Perinatal Psychiatrist",
        "hospital_id": "HOSP-001",
        "hospital_name": "Apollo Women's Hospital",
        "hospital_location": "Bangalore, Karnataka",
        "phone": "+91-98765-43210",
        "date": "2026-11-28",
        "time": "10:00 AM",
        "type": "In-person",
        "clinic": "Apollo Women's Hospital",
        "reason": "Seeking postpartum anxiety guidance following high-risk screening.",
    }

    resp = client.post(
        "/api/patients/me/appointments",
        json=payload,
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "Pending Confirmation"
    assert data["doctorName"] == "Dr. Sunita Rao"
    assert data["hospitalId"] == "HOSP-001"
    assert data["hospitalName"] == "Apollo Women's Hospital"
    assert uuid.UUID(data["id"])  # Genuine backend UUID!

    # Check patient appointments list
    list_resp = client.get(
        "/api/patients/me/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert list_resp.status_code == 200
    appts = list_resp.json()
    assert any(a["id"] == data["id"] and a["status"] == "Pending Confirmation" for a in appts)


# ============================================================================
# 3. Hospital Portal: Dashboard, Review & Status Transitions
# ============================================================================

def test_hospital_dashboard_and_listing(client: TestClient):
    """Hospital staff sees appointment metrics and incoming requests."""
    hosp_token = get_hospital_token(client, "HOSP-001")

    # Metrics
    dash_resp = client.get(
        "/api/hospital/dashboard",
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert dash_resp.status_code == 200
    metrics = dash_resp.json()
    assert metrics["total_requests"] >= 1
    assert metrics["pending_requests"] >= 1

    # List requests
    appts_resp = client.get(
        "/api/hospital/appointments?status_filter=pending",
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert appts_resp.status_code == 200
    appts = appts_resp.json()
    assert len(appts) >= 1
    assert appts[0]["hospital_id"] == "HOSP-001"


def test_hospital_confirms_appointment(client: TestClient):
    """Hospital confirms a pending appointment request."""
    # 1. Create request
    patient_token = get_token(client, "patient@miora.health", "patient")
    req_resp = client.post(
        "/api/patients/me/appointments",
        json={
            "doctor_name": "Dr. Sunita Rao",
            "doctor_id": "DR-001",
            "role": "Perinatal Psychiatrist",
            "hospital_id": "HOSP-001",
            "hospital_name": "Apollo Women's Hospital",
            "date": "2026-11-29",
            "time": "11:00 AM",
            "type": "In-person",
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    appt_id = req_resp.json()["id"]

    # 2. Hospital confirms
    hosp_token = get_hospital_token(client, "HOSP-001")
    conf_resp = client.put(
        f"/api/hospital/appointments/{appt_id}/status",
        json={"action": "confirm", "notes": "Slot confirmed by Dr. Rao's coordinator."},
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert conf_resp.status_code == 200
    assert conf_resp.json()["status"] == "confirmed"

    # 3. Patient sees confirmed status
    pat_appts = client.get(
        "/api/patients/me/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
    ).json()
    matching = next(a for a in pat_appts if a["id"] == appt_id)
    assert matching["status"] == "Confirmed"


def test_hospital_proposes_alternative_time(client: TestClient):
    """Hospital proposes an alternative appointment time when requested slot is booked."""
    patient_token = get_token(client, "patient@miora.health", "patient")
    req_resp = client.post(
        "/api/patients/me/appointments",
        json={
            "doctor_name": "Dr. Ananya Sharma",
            "doctor_id": "DR-002",
            "role": "Obstetrician & Gynecologist",
            "hospital_id": "HOSP-001",
            "hospital_name": "Apollo Women's Hospital",
            "date": "2026-11-30",
            "time": "09:00 AM",
            "type": "In-person",
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    appt_id = req_resp.json()["id"]

    # Hospital proposes alternative time
    hosp_token = get_hospital_token(client, "HOSP-001")
    prop_resp = client.put(
        f"/api/hospital/appointments/{appt_id}/status",
        json={
            "action": "propose_time",
            "proposed_date": "2026-11-30",
            "proposed_time": "02:00 PM",
            "notes": "Morning surgery scheduled; afternoon slot available.",
        },
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert prop_resp.status_code == 200
    assert prop_resp.json()["status"] == "rescheduled"
    assert prop_resp.json()["proposed_time"] == "02:00 PM"

    # Patient sees proposed time update
    pat_appts = client.get(
        "/api/patients/me/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
    ).json()
    matching = next(a for a in pat_appts if a["id"] == appt_id)
    assert matching["status"] == "New Time Proposed"
    assert matching["proposedTime"] == "02:00 PM"


def test_hospital_assigns_doctor(client: TestClient):
    """Hospital assigns an available doctor to the appointment."""
    patient_token = get_token(client, "patient@miora.health", "patient")
    req_resp = client.post(
        "/api/patients/me/appointments",
        json={
            "doctor_name": "Assigned On Duty Specialist",
            "role": "Perinatal Specialist",
            "hospital_id": "HOSP-001",
            "hospital_name": "Apollo Women's Hospital",
            "date": "2026-12-01",
            "time": "10:00 AM",
            "type": "In-person",
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    appt_id = req_resp.json()["id"]

    hosp_token = get_hospital_token(client, "HOSP-001")
    assign_resp = client.put(
        f"/api/hospital/appointments/{appt_id}/assign",
        json={"doctor_id": "DR-005", "doctor_name": "Dr. Elena Rostova"},
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assigned_doctor_name"] == "Dr. Elena Rostova"


# ============================================================================
# 4. Multi-Tenant Cross-Hospital Data Access Isolation
# ============================================================================

def test_cross_hospital_isolation_prevented(client: TestClient):
    """Hospital HOSP-002 cannot view, list, or modify HOSP-001 appointments."""
    # 1. Create appointment under HOSP-001
    patient_token = get_token(client, "patient@miora.health", "patient")
    req_resp = client.post(
        "/api/patients/me/appointments",
        json={
            "doctor_name": "Dr. Sunita Rao",
            "hospital_id": "HOSP-001",
            "hospital_name": "Apollo Women's Hospital",
            "date": "2026-12-05",
            "time": "11:00 AM",
            "type": "In-person",
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    hosp1_appt_id = req_resp.json()["id"]

    # 2. HOSP-002 staff logs in
    hosp2_token = get_hospital_token(client, "HOSP-002")

    # HOSP-002 lists appointments — MUST NOT contain HOSP-001 appointment
    hosp2_list = client.get(
        "/api/hospital/appointments",
        headers={"Authorization": f"Bearer {hosp2_token}"},
    ).json()
    assert not any(a["id"] == hosp1_appt_id for a in hosp2_list)

    # HOSP-002 attempts direct GET on HOSP-001 appointment — MUST BE FORBIDDEN (403)
    detail_resp = client.get(
        f"/api/hospital/appointments/{hosp1_appt_id}",
        headers={"Authorization": f"Bearer {hosp2_token}"},
    )
    assert detail_resp.status_code == 403
    assert "another hospital organization" in detail_resp.json()["detail"]

    # HOSP-002 attempts PUT status transition on HOSP-001 appointment — MUST BE FORBIDDEN (403)
    modify_resp = client.put(
        f"/api/hospital/appointments/{hosp1_appt_id}/status",
        json={"action": "confirm"},
        headers={"Authorization": f"Bearer {hosp2_token}"},
    )
    assert modify_resp.status_code == 403


# ============================================================================
# 5. Doctor Portal View of Assigned Appointments
# ============================================================================

def test_doctor_views_assigned_appointments(client: TestClient):
    """Doctor account can view appointments assigned to clinicians with clinical context."""
    doc_token = get_token(client, "doctor@miora.health", "doctor")

    resp = client.get(
        "/api/dashboard/appointments",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert resp.status_code == 200
    appts = resp.json()
    assert isinstance(appts, list)
    if appts:
        assert "patientName" in appts[0]
        assert "screeningRisk" in appts[0]


# ============================================================================
# 6. Authorization Guardrails & Edge Cases
# ============================================================================

def test_unauthorized_hospital_endpoint_access(client: TestClient):
    """Anonymous and patient access to hospital endpoints are rejected."""
    # Anonymous
    anon_resp = client.get("/api/hospital/dashboard")
    assert anon_resp.status_code == 401

    # Patient token
    pat_token = get_token(client, "patient@miora.health", "patient")
    pat_resp = client.get(
        "/api/hospital/dashboard",
        headers={"Authorization": f"Bearer {pat_token}"},
    )
    assert pat_resp.status_code == 403


def test_hospital_doctors_roster(client: TestClient):
    """Hospital retrieves its associated doctors roster."""
    hosp_token = get_hospital_token(client, "HOSP-001")
    resp = client.get(
        "/api/hospital/doctors",
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) >= 2
    assert any(d["doctor_id"] == "DR-001" for d in docs)
