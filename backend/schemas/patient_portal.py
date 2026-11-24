"""Pydantic schemas for Patient Portal, Authentication, and Persistence."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class PatientRegisterRequest(BaseModel):
    """Registration request payload for a new postpartum mother / patient."""

    name: Optional[str] = Field(None, min_length=2, max_length=200, description="Full name of the mother")
    full_name: Optional[str] = Field(None, min_length=2, max_length=200, description="Alias for name")
    email: str = Field(..., min_length=5, max_length=128, description="Email address for authentication")
    password: str = Field(..., min_length=6, max_length=128, description="Account password")
    age: Optional[int] = Field(None, ge=14, le=65, description="Mother's age in years")
    phone: Optional[str] = Field(None, max_length=32, description="Contact phone number")
    delivery_date: Optional[date] = Field(None, description="Recent delivery date")
    pregnancy_type: Optional[str] = Field(None, max_length=64, description="Singleton, twins, etc.")
    postpartum_week: Optional[int] = Field(4, ge=0, le=104, description="Postpartum weeks elapsed")

    @model_validator(mode="after")
    def resolve_name(self) -> "PatientRegisterRequest":
        if not self.name and self.full_name:
            self.name = self.full_name
        if not self.name:
            raise ValueError("Full name is required.")
        return self


class AuthLoginRequest(BaseModel):
    """Credentials login request."""

    email: str = Field(..., description="Email address")
    password: str = Field(..., description="Password")
    selected_role: Optional[str] = Field(None, description="Selected portal role: 'patient', 'doctor', or 'family'")


class UserRegisterRequest(BaseModel):
    """Universal registration request supporting patient, doctor, and patient's family."""

    name: Optional[str] = Field(None, min_length=2, max_length=200, description="Full name")
    full_name: Optional[str] = Field(None, min_length=2, max_length=200, description="Full name alias")
    email: str = Field(..., min_length=5, max_length=128, description="Email address for authentication")
    password: str = Field(..., min_length=6, max_length=128, description="Account password")
    role: Optional[str] = Field("patient", description="Portal role: 'patient', 'doctor', or 'family'")
    patient_email: Optional[str] = Field(None, description="Linked mother email (for family accounts)")
    age: Optional[int] = Field(None, ge=14, le=65, description="Age in years")
    phone: Optional[str] = Field(None, max_length=32, description="Contact phone number")
    delivery_date: Optional[date] = Field(None, description="Recent delivery date")
    pregnancy_type: Optional[str] = Field(None, max_length=64, description="Singleton, twins, etc.")
    postpartum_week: Optional[int] = Field(4, ge=0, le=104, description="Postpartum weeks elapsed")

    @model_validator(mode="after")
    def resolve_name(self) -> "UserRegisterRequest":
        if not self.name and self.full_name:
            self.name = self.full_name
        if not self.name:
            raise ValueError("Full name is required.")
        return self


class AuthTokenResponse(BaseModel):
    """Authentication token response with user profile and redirect."""

    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    redirect_url: str


class PatientProfileUpdateRequest(BaseModel):
    """Payload to update patient profile."""

    name: Optional[str] = Field(None, min_length=2, max_length=200)
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    age: Optional[int] = Field(None, ge=14, le=65)
    phone: Optional[str] = Field(None, max_length=32)
    delivery_date: Optional[date] = None
    pregnancy_type: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = None
    postpartum_week: Optional[int] = Field(None, ge=0, le=104)
    emergency_contact: Optional[Dict[str, Any]] = None
    clinical_profile: Optional[Dict[str, Any]] = None
    profile_completed: Optional[bool] = None

    @model_validator(mode="after")
    def resolve_name(self) -> "PatientProfileUpdateRequest":
        if not self.name and self.full_name:
            self.name = self.full_name
        return self


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
    emergency_contact: Optional[Dict[str, Any]] = None
    clinical_profile: Optional[Dict[str, Any]] = None
    profile_completed: Optional[bool] = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MedicalHistoryUpdateRequest(BaseModel):
    """Medical history update payload."""

    prior_ppd_diagnosis: Optional[str] = Field(None, description="'yes' | 'no' | 'not-sure'")
    medical_history: Optional[Union[str, Dict[str, Any]]] = Field(None, description="Detailed medical / psychiatric history text or data")
    uploaded_files: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Metadata of uploaded reports")


class MedicalHistoryResponse(BaseModel):
    """Medical history retrieval response."""

    prior_ppd_diagnosis: Optional[str] = "not-sure"
    medical_history: Optional[str] = None
    uploaded_files: List[Dict[str, Any]] = Field(default_factory=list)
    saved_at: Optional[datetime] = None


class ScreeningSessionAnswer(BaseModel):
    """Individual item answer for EPDS submission."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    question_id: str
    selected_index: Optional[int] = Field(default=None, ge=0, le=3)
    selected_option: Optional[int] = Field(default=None, ge=0, le=3)
    score: Optional[int] = Field(default=None, ge=0, le=3)
    raw_response: Optional[str] = None
    response_text: Optional[str] = None

    @model_validator(mode="after")
    def resolve_selected_index(self) -> "ScreeningSessionAnswer":
        if self.selected_index is None:
            if self.selected_option is not None:
                self.selected_index = self.selected_option
            elif self.score is not None:
                self.selected_index = self.score
            else:
                self.selected_index = 0
        if not self.raw_response and self.response_text:
            self.raw_response = self.response_text
        return self


class ScreeningSubmissionSaveRequest(BaseModel):
    """Submission payload to persist an EPDS screening."""

    answers: List[ScreeningSessionAnswer] = Field(..., min_length=10, max_length=10)
    notes: Optional[str] = None
    video_metadata: Optional[Dict[str, Any]] = None
    question_timestamps: Optional[List[Dict[str, Any]]] = None
    psychosocial_answers: Optional[Dict[str, Any]] = None
    time_spent_seconds: Optional[int] = None


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
    psychosocial_answers: Optional[Dict[str, Any]] = None
    clinical_features_snapshot: Optional[Dict[str, Any]] = None
    clinical_model_prediction: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class PatientReportsOverviewResponse(BaseModel):
    """Synthesized clinical reports overview for patient portal."""

    patient: Dict[str, Any]
    latest_screening: Optional[Dict[str, Any]] = None
    screenings_count: int = 0
    screenings: List[Dict[str, Any]] = Field(default_factory=list)
    care_plan: Optional[Dict[str, Any]] = None


class AppointmentBookRequest(BaseModel):
    """Appointment booking payload from Connect to a Doctor."""

    doctor_name: str = Field("Dr. Elena Rostova", description="Doctor name")
    doctor_id: Optional[str] = Field(None, description="Selected Doctor ID (e.g. 'DR-001')")
    role: str = Field("Perinatal Psychiatry Lead", description="Clinician designation")
    hospital_id: Optional[str] = Field(None, description="Target Hospital ID (e.g. 'HOSP-001')")
    hospital_name: Optional[str] = Field(None, description="Target Hospital display name")
    hospital_location: Optional[str] = Field(None, description="Target Hospital address/city")
    phone: Optional[str] = Field(None, description="Patient contact telephone number")
    date: str = Field(..., description="Target appointment date (e.g. '2026-11-25' or '25 Nov 2026')")
    time: str = Field("11:00 AM", description="Target appointment time")
    type: str = Field("Telehealth Video", description="Consultation format")
    clinic: str = Field("Miora Maternal Care Unit", description="Clinic location / department")
    reason: Optional[str] = Field(None, description="Reason for consult")


class AppointmentResponse(BaseModel):
    """Appointment item for patient consultations."""

    id: str
    doctorName: str
    role: str
    date: str
    time: str
    status: str = "Scheduled"
    type: str
    clinic: str
    summary: Optional[str] = None
    hospitalId: Optional[str] = None
    hospitalName: Optional[str] = None
    hospitalLocation: Optional[str] = None
    proposedDate: Optional[str] = None
    proposedTime: Optional[str] = None
    assignedDoctorId: Optional[str] = None
    assignedDoctorName: Optional[str] = None
    responseNote: Optional[str] = None


class NotificationItemResponse(BaseModel):
    """Notification item for patient header & alerts."""

    id: str
    title: str
    message: str
    date: str
    read: bool = False


class PatientSettingsRequest(BaseModel):
    """Patient settings update payload."""

    camera_permission: Optional[str] = None
    mic_permission: Optional[str] = None
    email_notifs: Optional[bool] = None
    consultation_alerts: Optional[bool] = None
    confidential_mode: Optional[bool] = None
    language: Optional[str] = None
    voice_locale: Optional[str] = None


class PatientSettingsResponse(BaseModel):
    """Patient settings retrieval response."""

    camera_permission: str = "prompt"
    mic_permission: str = "prompt"
    email_notifs: bool = True
    consultation_alerts: bool = True
    confidential_mode: bool = True
    language: str = "en"
    voice_locale: str = "en-IN"


class AiConversationMessageItem(BaseModel):
    """Single message in AI assistant conversation history."""

    id: str
    sender: str  # 'user' | 'bot'
    text: str
    timestamp: Optional[str] = None
    isEmergency: Optional[bool] = False
    isFallback: Optional[bool] = False
    mood: Optional[str] = None


class AiConversationSaveRequest(BaseModel):
    """Payload to save an AI conversation turn or update."""

    messages: List[AiConversationMessageItem]
    current_mood: Optional[str] = None
