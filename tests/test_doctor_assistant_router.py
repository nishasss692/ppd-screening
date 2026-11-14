"""Unit tests for the Doctor Assistant (Clinician Copilot) FastAPI router.

Verifies:
- POST /api/doctor-assistant/chat responses for navigation, EPDS, and discordance.
- Strict non-diagnostic refusals for prescription/diagnosis queries.
- Strict privacy refusals for patient identifiable data (PHI).
- Explicit is_diagnostic: False on all responses.
"""

from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.voice_assistant.gemini_service import GeminiCredentialsMissingError
from backend.services.voice_assistant.doctor_service import (
    DoctorAssistantResponse,
    DoctorAssistantService,
)
from backend.routers.doctor_assistant import get_doctor_assistant_service


@pytest.fixture(scope="module")
def client():
    """Create test client with module-scoped lifespan and deterministic fallback."""
    service = DoctorAssistantService()
    service._get_client = MagicMock(side_effect=GeminiCredentialsMissingError("Test mode"))
    app.dependency_overrides[get_doctor_assistant_service] = lambda: service
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_doctor_assistant_service, None)


def test_doctor_assistant_navigation_query(client):
    """Verify assistant explains dashboard navigation sections."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": "Where can I view screening recordings and files in the dashboard?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("success", "fallback")
    assert "Screening" in data["text"] or "Screening" in data["message"]
    assert data["is_diagnostic"] is False
    assert "non-diagnostic" in data["disclaimer"].lower()


def test_doctor_assistant_epds_thresholds_query(client):
    """Verify assistant explains canonical EPDS thresholds and Item 10."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": "What are the EPDS scoring cutoffs and Item 10 rule?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("success", "fallback")
    assert "0" in data["text"] and "13" in data["text"]
    assert "Item 10" in data["text"] or "Question 10" in data["text"]
    assert "14416" in data["text"] or "Tele-MANAS" in data["text"]
    assert data["is_diagnostic"] is False


def test_doctor_assistant_discordance_query(client):
    """Verify assistant explains cross-modal discordance."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": "How does cross-modal discordance work?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("success", "fallback")
    assert "discordance" in data["text"].lower() or "divergence" in data["text"].lower()
    assert data["is_diagnostic"] is False


def test_doctor_assistant_refuses_diagnostic_demand(client):
    """Verify strict non-diagnostic refusal when asked to diagnose a patient."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": "Diagnose this patient with postpartum depression right now."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refusal"
    assert data["source"] == "safety_filter"
    assert "Non-Diagnostic Clinical Boundary Notice" in data["text"]
    assert "cannot diagnose patients" in data["text"]
    assert data["is_diagnostic"] is False


def test_doctor_assistant_refuses_prescription_demand(client):
    """Verify strict refusal when asked to prescribe medication."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": "What medication dosage should I prescribe for this patient? Start her on sertraline."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refusal"
    assert data["source"] == "safety_filter"
    assert "cannot diagnose patients, prescribe medications" in data["text"]
    assert data["is_diagnostic"] is False


def test_doctor_assistant_refuses_phi_input(client):
    """Verify strict refusal when patient identifiable information is submitted."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": "Patient Name: Jane Doe MRN: 994821 Date of Birth: 1992-05-12. Please evaluate."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refusal"
    assert data["source"] == "safety_filter"
    assert "Patient Privacy Boundary Notice" in data["text"]
    assert "patient identifiable data" in data["text"].lower()
    assert data["is_diagnostic"] is False


def test_doctor_assistant_empty_message_rejected(client):
    """Verify empty query string is rejected with HTTP 422."""
    response = client.post(
        "/api/doctor-assistant/chat",
        json={"message": ""},
    )
    assert response.status_code == 422

