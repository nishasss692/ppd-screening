"""Pydantic schemas for public Doctor and Hospital directories."""

from typing import List, Optional
from pydantic import BaseModel, Field


class HospitalDirectoryItem(BaseModel):
    """Hospital facility record for discovery and appointment routing."""
    hospitalId: str = Field(..., description="Stable unique hospital identifier (e.g. HOSP-001)")
    name: str = Field(..., description="Display hospital name")
    location: str = Field(..., description="City, State")
    address: str = Field(..., description="Full street address")
    phone: str = Field(..., description="Main telephone switchboard number")


class DoctorDirectoryItem(BaseModel):
    """Clinician directory profile for maternal mental health consultation discovery."""
    doctorId: str = Field(..., description="Stable unique doctor identifier (e.g. DR-001)")
    hospitalId: str = Field(..., description="Associated hospital identifier")
    name: str = Field(..., description="Full doctor name with credentials")
    initials: str = Field(..., description="Initials for avatar rendering")
    specialization: str = Field(..., description="Primary clinical specialty")
    subspecialties: List[str] = Field(default_factory=list, description="Clinical focus areas and subspecialties")
    yearsExperience: int = Field(..., description="Years of clinical practice")
    availability: str = Field(..., description="Human-readable schedule string")
    consultationTypes: List[str] = Field(default_factory=list, description="Supported modes: In-person, Telehealth, Audio Consult")
    timeSlots: List[str] = Field(default_factory=list, description="Available consultation time slots")
    demoFlag: bool = Field(True, description="Always true for demonstration and research purposes")
    hospital: Optional[HospitalDirectoryItem] = Field(None, description="Detailed associated hospital profile")
