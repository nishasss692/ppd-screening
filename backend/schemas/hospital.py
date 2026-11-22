"""Pydantic schemas for the AANCHAL Hospital Portal and Appointment Management."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HospitalLoginRequest(BaseModel):
    """Hospital credentials payload."""
    email_or_id: str = Field(..., description="Hospital ID (e.g. 'HOSP-001') or registered hospital staff email")
    password: str = Field(..., description="Hospital account password")


class HospitalUserResponse(BaseModel):
    """Authenticated hospital profile representation."""
    user_id: str
    hospital_id: str
    hospital_name: str
    hospital_location: str
    email: str
    role: str = "hospital"


class HospitalLoginResponse(BaseModel):
    """Successful hospital login response."""
    access_token: str
    token_type: str = "bearer"
    hospital: HospitalUserResponse


class HospitalDashboardMetrics(BaseModel):
    """Aggregate statistics for the hospital dashboard."""
    total_requests: int = 0
    pending_requests: int = 0
    confirmed_appointments: int = 0
    completed_appointments: int = 0
    cancelled_requests: int = 0


class HospitalDoctorInfo(BaseModel):
    """Doctor associated with the hospital."""
    doctor_id: str
    name: str
    specialization: str
    years_experience: int
    availability: str
    consultation_types: List[str]


class HospitalAppointmentItem(BaseModel):
    """Individual appointment request record for hospital management."""
    id: str
    mother_id: str
    patient_name: str
    patient_phone: Optional[str] = None
    requested_doctor_id: Optional[str] = None
    requested_doctor_name: str
    assigned_doctor_id: Optional[str] = None
    assigned_doctor_name: Optional[str] = None
    hospital_id: str
    hospital_name: str
    requested_date: str
    requested_time: str
    confirmed_date: Optional[str] = None
    confirmed_time: Optional[str] = None
    proposed_date: Optional[str] = None
    proposed_time: Optional[str] = None
    status: str = Field("pending", description="'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed'")
    type: str = "In-person"
    reason: Optional[str] = None
    hospital_notes: Optional[str] = None
    created_at: str


class HospitalStatusUpdateRequest(BaseModel):
    """Payload to transition appointment request status."""
    action: str = Field(..., description="'confirm', 'reject', or 'propose_time'")
    proposed_date: Optional[str] = None
    proposed_time: Optional[str] = None
    notes: Optional[str] = None


class HospitalAssignDoctorRequest(BaseModel):
    """Payload to assign an associated doctor to an appointment."""
    doctor_id: str
    doctor_name: str
