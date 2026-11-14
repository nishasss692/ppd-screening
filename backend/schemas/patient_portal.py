"""Pydantic schemas for Patient Portal, Authentication, and Persistence."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PatientRegisterRequest(BaseModel):
    """Registration request payload for a new postpartum mother / patient."""

    name: str = Field(..., min_length=2, max_length=200, description="Full name of the mother")
    email: str = Field(..., min_length=5, max_length=128, description="Email address for authentication")
    password: str = Field(..., min_length=6, max_length=128, description="Account password")
    age: Optional[int] = Field(None, ge=14, le=65, description="Mother's age in years")
    phone: Optional[str] = Field(None, max_length=32, description="Contact phone number")
    delivery_date: Optional[date] = Field(None, description="Recent delivery date")
    pregnancy_type: Optional[str] = Field(None, max_length=64, description="Singleton, twins, etc.")
    postpartum_week: Optional[int] = Field(4, ge=0, le=104, description="Postpartum weeks elapsed")


class AuthLoginRequest(BaseModel):
    """Credentials login request."""

    email: str = Field(..., description="Email address")
    password: str = Field(..., description="Password")
    selected_role: Optional[str] = Field(None, description="Selected portal role: 'patient' or 'doctor'")


class AuthTokenResponse(BaseModel):
    """Authentication token response with user profile and redirect."""

    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    redirect_url: str


class PatientProfileUpdateRequest(BaseModel):
    """Payload to update patient profile."""

    name: Optional[str] = Field(None, min_length=2, max_length=200)
    age: Optional[int] = Field(None, ge=14, le=65)
    phone: Optional[str] = Field(None, max_length=32)
    delivery_date: Optional[date] = None
    pregnancy_type: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = None


class PatientProfileResponse(BaseModel):
    """Comprehensive patient profile response."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Mother entity ID (UUID)")
    user_id: str = Field(..., description="User account ID (UUID)")
    name: str
    full_name: str
    email: str
    age: Optional[int] = None
    phone: Optional[str] = None
    delivery_date: Optional[date] = None
    pregnancy_type: Optional[str] = None
    medical_history: Optional[str] = None
    notes: Optional[str] = None
    postpartum_week: Optional[int] = 4
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MedicalHistoryUpdateRequest(BaseModel):
    """Medical history update payload."""

    prior_ppd_diagnosis: Optional[str] = Field(None, description="'yes' | 'no' | 'not-sure'")
    medical_history: Optional[str] = Field(None, description="Detailed medical / psychiatric history text")
    uploaded_files: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Metadata of uploaded reports")


class MedicalHistoryResponse(BaseModel):
    """Medical history retrieval response."""

    prior_ppd_diagnosis: Optional[str] = "not-sure"
    medical_history: Optional[str] = None
    uploaded_files: List[Dict[str, Any]] = Field(default_factory=list)
    saved_at: Optional[datetime] = None


class ScreeningSessionAnswer(BaseModel):
    """Individual item answer for EPDS submission."""

    question_id: str
    selected_index: int = Field(..., ge=0, le=3)
    raw_response: Optional[str] = None


class ScreeningSubmissionSaveRequest(BaseModel):
    """Submission payload to persist an EPDS screening."""

    answers: List[ScreeningSessionAnswer] = Field(..., min_length=10, max_length=10)
    notes: Optional[str] = None
    video_metadata: Optional[Dict[str, Any]] = None
    question_timestamps: Optional[List[Dict[str, Any]]] = None


class PatientScreeningSummaryResponse(BaseModel):
    """Screening session record for patient history."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    mother_id: str
    screening_date: datetime
    instrument: str = "EPDS"
    total_score: int
    maximum_score: int = 30
    risk_classification: str
    q10_safety_alert: bool
    screening_status: str
    item_scores: Dict[str, int]
    submitted_answers: Dict[str, Any]
    model_metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class PatientReportsOverviewResponse(BaseModel):
    """Synthesized clinical reports overview for patient portal."""

    patient: Dict[str, Any]
    latest_screening: Optional[Dict[str, Any]] = None
    screenings_count: int = 0
    screenings: List[Dict[str, Any]] = Field(default_factory=list)
    care_plan: Optional[Dict[str, Any]] = None

