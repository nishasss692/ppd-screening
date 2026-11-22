"""FastAPI router for Doctor-to-Hospital Consultation Reports.

Handles:
- POST /api/consultation-reports: Create or draft a consultation report
- GET  /api/consultation-reports: List consultation reports (for doctor / clinical view)
- GET  /api/consultation-reports/{report_id}: Get consultation report detail
- PUT  /api/consultation-reports/{report_id}: Update or finalize consultation report
"""

from datetime import datetime, timezone
import json
import logging
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.consultation_report import ConsultationReport
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.consultation_report import (
    ConsultationReportCreate,
    ConsultationReportUpdate,
    HospitalReportDetail,
    HospitalReportListItem,
)
from backend.services.auth_service import get_current_user

logger = logging.getLogger("ppd.routers.consultation_reports")

router = APIRouter(prefix="/api/consultation-reports", tags=["Consultation Reports"])


def _generate_report_code(db: Session) -> str:
    """Generate next incremental report code like REP-2026-001."""
    count = db.scalar(select(ConsultationReport.id))
    all_reports = db.scalars(select(ConsultationReport)).all()
    next_num = len(all_reports) + 1
    return f"REP-2026-{next_num:03d}"


def _generate_patient_friendly_version(create_payload: ConsultationReportCreate) -> dict:
    """Generate or refine patient-friendly text from the doctor's clinical consultation notes."""
    complaints = (create_payload.presenting_complaints or "").strip()
    observations = (create_payload.clinical_observations or "").strip()
    assessment = (create_payload.clinical_assessment or "").strip()
    treatment = (create_payload.treatment_plan or "").strip()
    recs = (create_payload.recommendations or "").strip()
    followup = (create_payload.followup_instructions or "").strip()

    # If the doctor provided a custom patient summary, use it; otherwise craft a clear, everyday version
    summary = create_payload.patient_friendly_summary
    if not summary:
        summary = (
            f"During your consultation on {create_payload.consultation_date}, {create_payload.doctor_name or 'your doctor'} "
            f"reviewed your emotional wellbeing and current feelings. We discussed {complaints.lower() if len(complaints) < 120 else 'your current feelings and emotional symptoms'}. "
            f"Your doctor noted your symptoms and discussed a supportive care plan designed to help you regain balance and rest."
        )

    med_text = create_payload.patient_friendly_medications
    if not med_text and create_payload.medications:
        med_text = (
            f"Medication instructions: {create_payload.medications}. "
            f"Please take exactly as directed and reach out if you have any side effects."
        )

    patient_recs = create_payload.patient_friendly_recommendations
    if not patient_recs:
        patient_recs = (
            f"Recommended care activities: {recs}. "
            f"Ensure you are receiving support from family and taking time for restorative rest each day."
        )

    patient_followup = create_payload.patient_friendly_followup
    if not patient_followup:
        next_date = create_payload.next_followup_date or "in 2-4 weeks"
        patient_followup = (
            f"Your next check-in is planned for {next_date}. {followup} "
            f"If you feel an increase in distress or need urgent support before then, please contact our clinic or call the 24/7 helpline."
        )

    return {
        "summary": summary,
        "medications": med_text,
        "recommendations": patient_recs,
        "followup": patient_followup,
    }


def _to_hospital_report_detail(report: ConsultationReport) -> HospitalReportDetail:
    return HospitalReportDetail(
        id=str(report.id),
        report_code=report.report_code,
        patient_name=report.patient_name,
        patient_identifier=report.patient_identifier,
        appointment_id=report.appointment_id,
        doctor_name=report.doctor_name,
        doctor_specialization=report.doctor_specialization,
        hospital_id=report.hospital_id,
        hospital_name=report.hospital_name,
        department=report.department,
        consultation_date=report.consultation_date,
        presenting_complaints=report.presenting_complaints,
        clinical_observations=report.clinical_observations,
        clinical_assessment=report.clinical_assessment,
        treatment_plan=report.treatment_plan,
        medications=report.medications,
        recommendations=report.recommendations,
        followup_instructions=report.followup_instructions,
        next_followup_date=report.next_followup_date,
        additional_notes=report.additional_notes,
        ai_screening_summary=report.ai_screening_summary,
        epds_summary=report.epds_summary,
        status=report.status,
        patient_approved=report.patient_approved,
        submitted_at=report.submitted_at.isoformat() if report.submitted_at else None,
        created_at=report.created_at.isoformat() if report.created_at else datetime.now(timezone.utc).isoformat(),
        updated_at=report.updated_at.isoformat() if report.updated_at else datetime.now(timezone.utc).isoformat(),
    )


@router.post(
    "",
    response_model=HospitalReportDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create or draft a doctor consultation report",
)
def create_consultation_report(
    payload: ConsultationReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HospitalReportDetail:
    """Doctor creates a structured consultation report for a patient.

    Can be saved as 'draft' or submitted as 'final'.
    """
    if user.role not in ("doctor", "clinician", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized doctors or clinicians can create consultation reports.",
        )

    # 1. Resolve mother / patient record
    mother = None
    # Lookup by case identifier (e.g. M-108) or UUID
    try:
        m_uuid = uuid.UUID(payload.patient_identifier)
        mother = db.get(Mother, m_uuid)
    except ValueError:
        mother = db.scalar(select(Mother).where(Mother.name.ilike(f"%{payload.patient_name}%")))
        if not mother:
            # Fallback to first matching mother or create a record for demo
            mother = db.scalar(select(Mother).limit(1))

    if not mother:
        # Create minimal mother entry so foreign key constraint succeeds
        mother = Mother(
            name=payload.patient_name,
            phone="+91 98765 43210",
            notes=json.dumps({"caseId": payload.patient_identifier}),
        )
        db.add(mother)
        db.flush()

    report_code = _generate_report_code(db)
    is_final = payload.status.lower() == "final"
    now_dt = datetime.now(timezone.utc)

    pf = _generate_patient_friendly_version(payload)

    doctor_name = payload.doctor_name or user.full_name or "Dr. Elena Rostova"
    doctor_id = payload.doctor_id or f"DR-{str(user.id)[:6]}"

    report = ConsultationReport(
        report_code=report_code,
        mother_id=mother.id,
        patient_name=payload.patient_name,
        patient_identifier=payload.patient_identifier,
        appointment_id=payload.appointment_id,
        doctor_id=doctor_id,
        doctor_name=doctor_name,
        doctor_specialization=payload.doctor_specialization or "Perinatal Psychiatrist",
        hospital_id=payload.hospital_id or "HOSP-001",
        hospital_name=payload.hospital_name or "Apollo Women's Hospital",
        department=payload.department or "Perinatal Mental Health",
        consultation_date=payload.consultation_date,
        presenting_complaints=payload.presenting_complaints or "",
        clinical_observations=payload.clinical_observations or "",
        clinical_assessment=payload.clinical_assessment or "",
        treatment_plan=payload.treatment_plan or "",
        medications=payload.medications,
        recommendations=payload.recommendations or "",
        followup_instructions=payload.followup_instructions or "",
        next_followup_date=payload.next_followup_date,
        additional_notes=payload.additional_notes,
        ai_screening_summary=payload.ai_screening_summary,
        epds_summary=payload.epds_summary,
        status="final" if is_final else "draft",
        patient_friendly_summary=pf["summary"],
        patient_friendly_medications=pf["medications"],
        patient_friendly_recommendations=pf["recommendations"],
        patient_friendly_followup=pf["followup"],
        patient_approved=is_final and payload.approve_patient_version,
        submitted_at=now_dt if is_final else None,
    )

    db.add(report)

    # If associated with an appointment, update appointment status to completed
    if payload.appointment_id and is_final:
        try:
            from backend.models.care_plan import CarePlan
            cp_uuid = uuid.UUID(payload.appointment_id)
            cp = db.get(CarePlan, cp_uuid)
            if cp:
                cp.status = "completed"
                if cp.notes and cp.notes.startswith("{"):
                    meta = json.loads(cp.notes)
                    meta["status"] = "completed"
                    meta["report_id"] = str(report.id)
                    meta["report_code"] = report_code
                    cp.notes = json.dumps(meta)
        except Exception:
            pass

    db.commit()
    db.refresh(report)
    logger.info("Created consultation report %s (%s) by doctor %s", report.id, report_code, doctor_name)
    return _to_hospital_report_detail(report)


@router.get(
    "",
    response_model=List[HospitalReportListItem],
    summary="List consultation reports (clinical / doctor view)",
)
def list_consultation_reports(
    mother_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[HospitalReportListItem]:
    """Retrieve list of consultation reports."""
    query = select(ConsultationReport).order_by(desc(ConsultationReport.created_at))
    if mother_id:
        try:
            m_uuid = uuid.UUID(mother_id)
            query = query.where(ConsultationReport.mother_id == m_uuid)
        except ValueError:
            query = query.where(ConsultationReport.patient_identifier == mother_id)
    if doctor_id:
        query = query.where(ConsultationReport.doctor_id == doctor_id)

    reports = db.scalars(query).all()
    results = []
    for r in reports:
        results.append(
            HospitalReportListItem(
                id=str(r.id),
                report_code=r.report_code,
                patient_name=r.patient_name,
                patient_identifier=r.patient_identifier,
                doctor_name=r.doctor_name,
                doctor_specialization=r.doctor_specialization,
                hospital_name=r.hospital_name,
                department=r.department,
                appointment_date=r.consultation_date,
                submission_date=r.submitted_at.strftime("%d %b %Y") if r.submitted_at else None,
                status=r.status,
                created_at=r.created_at.strftime("%d %b %Y") if r.created_at else "",
            )
        )
    return results


@router.get(
    "/{report_id}",
    response_model=HospitalReportDetail,
    summary="Get consultation report details",
)
def get_consultation_report(
    report_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HospitalReportDetail:
    """Retrieve complete consultation report by ID or report_code."""
    report = None
    try:
        r_uuid = uuid.UUID(report_id)
        report = db.get(ConsultationReport, r_uuid)
    except ValueError:
        report = db.scalar(select(ConsultationReport).where(ConsultationReport.report_code == report_id))

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consultation report '{report_id}' not found.",
        )
    return _to_hospital_report_detail(report)


@router.put(
    "/{report_id}",
    response_model=HospitalReportDetail,
    summary="Update or finalize a consultation report",
)
def update_consultation_report(
    report_id: str,
    payload: ConsultationReportUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HospitalReportDetail:
    """Update draft or finalize consultation report."""
    if user.role not in ("doctor", "clinician", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized clinicians can update consultation reports.",
        )

    try:
        r_uuid = uuid.UUID(report_id)
        report = db.get(ConsultationReport, r_uuid)
    except ValueError:
        report = db.scalar(select(ConsultationReport).where(ConsultationReport.report_code == report_id))

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Consultation report '{report_id}' not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("status") == "final" and report.status != "final":
        report.submitted_at = datetime.now(timezone.utc)
        report.status = "final"
        report.patient_approved = update_data.get("approve_patient_version", True)

    for field, val in update_data.items():
        if val is not None and hasattr(report, field):
            setattr(report, field, val)

    db.commit()
    db.refresh(report)
    return _to_hospital_report_detail(report)
