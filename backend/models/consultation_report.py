"""Consultation Report entity model representing detailed doctor-patient consultation documentation."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.base import Base, TimestampMixin, utc_now

if TYPE_CHECKING:
    from backend.models.mother import Mother


class ConsultationReport(Base, TimestampMixin):
    """Formal clinical consultation report created by treating doctor after patient visit.

    Maintains two views:
    1. Hospital / Clinical documentation view: Complete medical assessment, observations,
       differential/confirmed diagnoses, full medication schedule, and internal clinical notes.
    2. Patient-facing view: Simplified, non-jargon explanatory summary, clear everyday
       medication instructions, and follow-up guidance. Internal notes are strictly excluded.
    """

    __tablename__ = "consultation_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique consultation report UUID",
    )
    report_code: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=False,
        doc="Human-readable report identifier (e.g. REP-2026-001)",
    )
    mother_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("mothers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Reference to the patient (mother) record",
    )
    patient_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Patient full name at time of consultation",
    )
    patient_identifier: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Patient case ID (e.g. M-108)",
    )
    appointment_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        doc="Associated CarePlan / appointment UUID if booked through portal",
    )
    doctor_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Treating clinician ID (e.g. DR-005)",
    )
    doctor_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Doctor full name and title (e.g. Dr. Elena Rostova)",
    )
    doctor_specialization: Mapped[str] = mapped_column(
        String(128),
        default="Perinatal Psychiatrist",
        nullable=False,
        doc="Doctor clinical specialization",
    )
    hospital_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Hospital organization ID (e.g. HOSP-001)",
    )
    hospital_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Hospital / clinic name",
    )
    department: Mapped[str] = mapped_column(
        String(128),
        default="Perinatal Mental Health",
        nullable=False,
        doc="Hospital department",
    )
    consultation_date: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Date of consultation (e.g. '20 Nov 2026')",
    )

    # Detailed Clinical Documentation (Hospital & Doctor View)
    presenting_complaints: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Patient presenting symptoms and concerns",
    )
    clinical_observations: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Clinician observations during mental state examination",
    )
    clinical_assessment: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Doctor's clinical assessment and formal diagnostic impression",
    )
    treatment_plan: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Clinical treatment plan and therapeutic interventions",
    )
    medications: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Prescribed medication regimen (name, dosage, frequency, duration, instructions)",
    )
    recommendations: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Lifestyle, psychosocial, and restorative recommendations",
    )
    followup_instructions: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Follow-up instructions and clinical escalation triggers",
    )
    next_followup_date: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        doc="Scheduled next follow-up appointment date/time",
    )
    additional_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Private clinician and internal hospital administration notes (STRICTLY CONFIDENTIAL)",
    )

    # Optional Authorized Screening Information
    ai_screening_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Authorized AI screening summary if shared for clinical consultation",
    )
    epds_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Authorized EPDS score and question breakdown if shared",
    )

    # Workflow Status
    status: Mapped[str] = mapped_column(
        String(32),
        default="draft",
        nullable=False,
        index=True,
        doc="Report status: 'draft' or 'final'",
    )

    # Patient-Friendly Simplified View (Doctor-approved)
    patient_friendly_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Everyday-language summary of what was discussed during the visit",
    )
    patient_friendly_medications: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Clear, step-by-step medication instructions for the patient",
    )
    patient_friendly_recommendations: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Practical, supportive self-care and wellbeing recommendations",
    )
    patient_friendly_followup: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Clear follow-up guidance and next appointment info",
    )
    patient_approved: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="True when doctor approves publishing patient-friendly report version",
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp when final report was officially signed and submitted",
    )

    # Relationships
    mother: Mapped["Mother"] = relationship(
        "Mother",
        back_populates="consultation_reports",
    )

    __table_args__ = (
        Index("ix_consultation_reports_hospital", "hospital_id", "status"),
        Index("ix_consultation_reports_doctor", "doctor_id", "status"),
        Index("ix_consultation_reports_mother", "mother_id", "patient_approved"),
    )
