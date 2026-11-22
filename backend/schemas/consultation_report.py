"""Pydantic schemas for Doctor Consultation Reports (Hospital Detailed & Patient Simplified)."""

from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class MedicationItem(BaseModel):
    """Structured representation of a prescribed medication."""
    name: str = Field(..., description="Medication commercial or generic name")
    dosage: str = Field(..., description="Prescribed dose (e.g. '25mg', '50mg')")
    frequency: str = Field(..., description="Dosing schedule (e.g. 'Once daily in the morning')")
    duration: str = Field(..., description="Duration of therapy (e.g. '4 weeks', '14 days')")
    instructions: Optional[str] = Field(None, description="Patient administration instructions")


class ConsultationReportCreate(BaseModel):
    """Payload submitted by clinician to create/draft a consultation report."""
    patient_identifier: str = Field(..., description="Case identifier (e.g. 'M-108')")
    patient_name: str = Field(..., description="Full patient name")
    appointment_id: Optional[str] = Field(None, description="Associated CarePlan / appointment UUID")
    doctor_id: Optional[str] = Field(None, description="Doctor identifier (e.g. 'DR-005')")
    doctor_name: Optional[str] = Field(None, description="Doctor name and credentials")
    doctor_specialization: Optional[str] = Field("Perinatal Psychiatrist", description="Doctor clinical specialty")
    hospital_id: Optional[str] = Field("HOSP-001", description="Associated hospital ID")
    hospital_name: Optional[str] = Field("Apollo Women's Hospital", description="Associated hospital name")
    department: Optional[str] = Field("Perinatal Mental Health", description="Clinical department")
    consultation_date: str = Field(..., description="Date of consultation")

    presenting_complaints: Optional[str] = Field(None, description="Presenting symptoms and patient concerns")
    clinical_observations: Optional[str] = Field(None, description="Mental state examination observations")
    clinical_assessment: Optional[str] = Field(None, description="Doctor's clinical assessment and diagnosis")
    treatment_plan: Optional[str] = Field(None, description="Comprehensive clinical treatment plan")
    medications: Optional[str] = Field(None, description="Medications prescribed or schedule")
    recommendations: Optional[str] = Field(None, description="Clinical and psychosocial recommendations")
    followup_instructions: Optional[str] = Field(None, description="Detailed clinical follow-up instructions")
    next_followup_date: Optional[str] = Field(None, description="Target next appointment date")
    additional_notes: Optional[str] = Field(None, description="Internal clinician/hospital confidential notes")

    ai_screening_summary: Optional[str] = Field(None, description="Authorized AI screening summary")
    epds_summary: Optional[str] = Field(None, description="Authorized EPDS score and review")

    status: str = Field("draft", description="'draft' or 'final'")
    patient_friendly_summary: Optional[str] = Field(None, description="Simplified everyday-language summary")
    patient_friendly_medications: Optional[str] = Field(None, description="Patient-friendly medication instructions")
    patient_friendly_recommendations: Optional[str] = Field(None, description="Clear self-care recommendations")
    patient_friendly_followup: Optional[str] = Field(None, description="Clear follow-up guidance")
    approve_patient_version: bool = Field(True, description="True if doctor approves publishing patient version")


class ConsultationReportUpdate(BaseModel):
    """Payload to update an existing draft or finalize it."""
    presenting_complaints: Optional[str] = None
    clinical_observations: Optional[str] = None
    clinical_assessment: Optional[str] = None
    treatment_plan: Optional[str] = None
    medications: Optional[str] = None
    recommendations: Optional[str] = None
    followup_instructions: Optional[str] = None
    next_followup_date: Optional[str] = None
    additional_notes: Optional[str] = None
    ai_screening_summary: Optional[str] = None
    epds_summary: Optional[str] = None
    status: Optional[str] = None
    patient_friendly_summary: Optional[str] = None
    patient_friendly_medications: Optional[str] = None
    patient_friendly_recommendations: Optional[str] = None
    patient_friendly_followup: Optional[str] = None
    approve_patient_version: Optional[bool] = None


class HospitalReportListItem(BaseModel):
    """Summary item displayed in the Hospital Reports listing table."""
    id: str
    report_code: str
    patient_name: str
    patient_identifier: str
    doctor_name: str
    doctor_specialization: str
    hospital_name: str
    department: str
    appointment_date: str
    submission_date: Optional[str]
    status: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class HospitalReportDetail(BaseModel):
    """Complete detailed clinical report for hospital staff."""
    id: str
    report_code: str
    patient_name: str
    patient_identifier: str
    appointment_id: Optional[str] = None
    doctor_name: str
    doctor_specialization: str
    hospital_id: str
    hospital_name: str
    department: str
    consultation_date: str
    presenting_complaints: str
    clinical_observations: str
    clinical_assessment: str
    treatment_plan: str
    medications: Optional[str] = None
    recommendations: str
    followup_instructions: str
    next_followup_date: Optional[str] = None
    additional_notes: Optional[str] = None
    ai_screening_summary: Optional[str] = None
    epds_summary: Optional[str] = None
    status: str
    patient_approved: bool
    submitted_at: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class PatientConsultationReportResponse(BaseModel):
    """Patient-friendly simplified report version. Internal hospital notes are EXCLUDED."""
    id: str
    report_code: str
    doctor_name: str
    doctor_specialization: str
    hospital_name: str
    consultation_date: str
    summary: str
    medications_instructions: Optional[str] = None
    recommendations: Optional[str] = None
    followup_instructions: Optional[str] = None
    next_followup_date: Optional[str] = None
    submitted_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
