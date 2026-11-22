"""Tests for public Doctor and Hospital directory endpoints."""

from fastapi.testclient import TestClient
import pytest

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_get_hospitals_directory(client):
    """Verify GET /api/hospitals returns all partner hospitals with expected schema."""
    resp = client.get("/api/hospitals")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 4

    hosp_ids = [h["hospitalId"] for h in data]
    assert "HOSP-001" in hosp_ids
    assert "HOSP-002" in hosp_ids
    assert "HOSP-003" in hosp_ids
    assert "HOSP-004" in hosp_ids

    # Validate first hospital schema
    first = data[0]
    for key in ("hospitalId", "name", "location", "address", "phone"):
        assert key in first and len(first[key]) > 0


def test_get_doctors_directory_all(client):
    """Verify GET /api/doctors returns all doctors with nested hospital records."""
    resp = client.get("/api/doctors")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 6

    # Verify nested hospital field
    for doc in data:
        assert "doctorId" in doc
        assert "name" in doc
        assert "specialization" in doc
        assert "yearsExperience" in doc
        assert "consultationTypes" in doc
        assert "timeSlots" in doc
        assert "hospital" in doc
        assert doc["hospital"] is not None
        assert doc["hospital"]["hospitalId"] == doc["hospitalId"]


def test_get_doctors_directory_filter_location(client):
    """Verify GET /api/doctors?location=Bangalore filters correctly."""
    resp = client.get("/api/doctors?location=Bangalore")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    for doc in data:
        assert "Bangalore" in doc["hospital"]["location"] or "Bangalore" in doc["hospital"]["address"]


def test_get_doctors_directory_filter_specialization(client):
    """Verify GET /api/doctors?specialization=Psychiatry filters correctly."""
    resp = client.get("/api/doctors?specialization=Psychiatry")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    for doc in data:
        matches = "psychiatry" in doc["specialization"].lower() or any(
            "psychiatry" in sub.lower() for sub in doc.get("subspecialties", [])
        )
        assert matches


def test_get_doctors_directory_no_match(client):
    """Verify GET /api/doctors with non-matching filter returns empty list."""
    resp = client.get("/api/doctors?location=NonExistentCity12345")
    assert resp.status_code == 200
    data = resp.json()
    assert data == []
