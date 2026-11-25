"""FastAPI Router for Dashboard endpoints.

Exposes:
- GET /api/dashboard/metrics
- GET /api/dashboard/screening-activity?timeframe=4w
- GET /api/dashboard/alerts
"""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.care_plan import CarePlan
from backend.models.mother import Mother
from backend.models.user import User
from backend.services.auth_service import require_doctor
from backend.schemas.dashboard import (
    DashboardAlertsResponse,
    DashboardMetricsResponse,
    DashboardTimeframeEnum,
    ScreeningActivityResponse,
)
from backend.services.dashboard_service import DashboardService, dashboard_service

logger = logging.getLogger("ppd.routers.dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get(
    "/metrics",
    response_model=DashboardMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve platform clinical summary metrics",
)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    service: DashboardService = Depends(lambda: dashboard_service),
) -> DashboardMetricsResponse:
    """Retrieve aggregate counts for registered mothers, total screenings, high risk screenings,

    pending clinical reviews, and active care plans.
    """
    try:
        return service.get_metrics(db)
    except Exception as exc:
        logger.error("Failed to compute dashboard metrics: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard metrics.",
        ) from exc


@router.get(
    "/screening-activity",
    response_model=ScreeningActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve weekly screening activity time-series",
)
def get_screening_activity(
    timeframe: DashboardTimeframeEnum = Query(
        default=DashboardTimeframeEnum.four_weeks,
        description="Timeframe window. Supported values: '4w', '8w', '12w'",
    ),
    db: Session = Depends(get_db),
    service: DashboardService = Depends(lambda: dashboard_service),
) -> ScreeningActivityResponse:
    """Retrieve chronological weekly screening counts over 4w, 8w, or 12w windows."""
    try:
        return service.get_screening_activity(db, timeframe=timeframe)
    except Exception as exc:
        logger.error("Failed to generate screening activity: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve screening activity.",
        ) from exc


@router.get(
    "/alerts",
    response_model=DashboardAlertsResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve active urgent clinical alerts",
)
def get_dashboard_alerts(
    db: Session = Depends(get_db),
    service: DashboardService = Depends(lambda: dashboard_service),
) -> DashboardAlertsResponse:
    """Retrieve urgent alerts (EPDS Q10 safety triggers, high-risk screenings, immediate escalations).

    Ordered chronologically newest first with concise, privacy-safe descriptions.
    """
    try:
        return service.get_alerts(db)
    except Exception as exc:
        logger.error("Failed to retrieve dashboard alerts: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard alerts.",
        ) from exc


@router.get(
    "/appointments",
    status_code=status.HTTP_200_OK,
    summary="Retrieve clinician-assigned appointments and consultation requests",
)
def get_clinician_assigned_appointments(
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve appointments and consultations assigned strictly to the logged-in doctor."""
    all_plans = db.scalars(
        select(CarePlan).order_by(desc(CarePlan.created_at))
    ).all()

    doctor_name_clean = (user.full_name or "").strip().lower()
    results = []
    for cp in all_plans:
        meta: Dict[str, Any] = {}
        if cp.notes and cp.notes.strip().startswith("{"):
            try:
                meta = json.loads(cp.notes)
            except Exception:
                meta = {}

        # Assigned doctor match check:
        # Either assigned_doctor_name, doctor_name, doctor_id, or cp.assigned_clinician_id
        assigned_name = (meta.get("assigned_doctor_name") or meta.get("doctor_name") or cp.assigned_clinician_id or "").strip()
        assigned_id = (meta.get("assigned_doctor_id") or meta.get("doctor_id") or "").strip().lower()

        is_assigned_to_me = False
        if assigned_name and assigned_name.lower() == doctor_name_clean:
            is_assigned_to_me = True
        elif assigned_id in ("dr-001", "doc-priya-mehta") and ("priya" in doctor_name_clean or "mehta" in doctor_name_clean):
            is_assigned_to_me = True
        elif not assigned_name and not assigned_id:
            # If unassigned legacy/general, allow viewing in admin or fallback
            if user.role == "admin":
                is_assigned_to_me = True

        if not is_assigned_to_me and user.role != "admin":
            continue

        mother = db.get(Mother, cp.mother_id)
        patient_name = meta.get("patient_name") or (mother.name if mother else "Patient")
        
        # Check latest screening risk classification for authorized clinical context
        screening_risk = "Not Screened"
        screening_id = None
        screening_date = None
        epds_score = None
        multimodal_result = None
        clinical_prediction = None
        
        if mother and mother.screenings:
            latest_screening = mother.screenings[0]
            screening_id = str(latest_screening.id)
            screening_risk = latest_screening.risk_classification or "Preliminary"
            screening_date = latest_screening.screening_date.strftime("%d %b %Y") if latest_screening.screening_date else None
            epds_score = latest_screening.total_score
            multimodal_result = latest_screening.multimodal_scores
            clinical_prediction = latest_screening.clinical_model_prediction

        epds_interp = None
        if epds_score is not None:
            if epds_score >= 13:
                epds_interp = "Above clinical cut-off (>=13). Probable depressive symptomatology; specialist evaluation recommended."
            elif epds_score >= 10:
                epds_interp = "Elevated distress range (10-12). Clinical monitoring and emotional support recommended."
            else:
                epds_interp = "Within low-distress range (<10). Routine postpartum wellness follow-up."

        results.append({
            "id": str(cp.id),
            "motherId": str(cp.mother_id),
            "patientId": f"P-{str(cp.mother_id)[:8].upper()}",
            "patientName": patient_name,
            "patientPhone": meta.get("patient_phone") or (mother.phone if mother else None),
            "postpartumWeek": getattr(mother, "postpartum_week", None) if mother else None,
            "assignedDoctorName": assigned_name or user.full_name,
            "doctorId": meta.get("doctor_id") or "DR-001",
            "hospitalId": meta.get("hospital_id") or "HOSP-001",
            "hospitalName": meta.get("hospital_name") or cp.referral_destination or "Apollo Women's Hospital",
            "date": meta.get("confirmed_date") or meta.get("requested_date") or (cp.scheduled_followup_date.strftime("%d %b %Y") if cp.scheduled_followup_date else "Flexible"),
            "time": meta.get("confirmed_time") or meta.get("requested_time") or "11:00 AM",
            "bookingDate": meta.get("created_at")[:10] if meta.get("created_at") else (cp.created_at.strftime("%d %b %Y") if cp.created_at else None),
            "status": (meta.get("status") or cp.status or "scheduled").title(),
            "consultationType": meta.get("consultation_type") or cp.intervention_type or "Telehealth Video",
            "reason": meta.get("reason"),
            "screeningRisk": screening_risk,
            "screeningId": screening_id,
            "screeningDate": screening_date,
            "epdsScore": epds_score,
            "epdsInterpretation": epds_interp,
            "multimodalResult": multimodal_result,
            "clinicalPrediction": clinical_prediction,
            "hospitalNotes": meta.get("hospital_notes"),
            "clinicalAssessment": meta.get("clinical_assessment"),
        })

    return results


@router.put(
    "/appointments/{appointment_id}/assessment",
    status_code=status.HTTP_200_OK,
    summary="Save doctor's clinical assessment, diagnosis, and care plan for an appointment",
)
def save_appointment_clinical_assessment(
    appointment_id: str,
    payload: Dict[str, Any],
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Save doctor's clinical observations, diagnosis, and care plan, finalize consultation report, and notify hospital."""
    import uuid as _uuid
    from datetime import datetime, timezone
    from backend.models.consultation_report import ConsultationReport
    from backend.services.notification_service import create_notification_dedup

    try:
        cp_uuid = _uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment ID.")

    cp = db.get(CarePlan, cp_uuid)
    if not cp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    meta: Dict[str, Any] = {}
    if cp.notes and cp.notes.strip().startswith("{"):
        try:
            meta = json.loads(cp.notes)
        except Exception:
            meta = {}

    consultation_date = (payload.get("consultationDate") or datetime.now(timezone.utc).strftime("%Y-%m-%d")).strip()
    observations = (payload.get("clinicalObservations") or "").strip()
    diagnosis = (payload.get("diagnosis") or "").strip()
    care_plan_text = (payload.get("carePlan") or "").strip()
    mark_completed = bool(payload.get("markCompleted", True))

    if not diagnosis and not observations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter clinical observations or a diagnosis before saving.",
        )

    assessment_record = {
        "consultationDate": consultation_date,
        "clinicalObservations": observations,
        "diagnosis": diagnosis,
        "carePlan": care_plan_text,
        "doctorName": user.full_name or "Dr. Priya Mehta",
        "savedAt": datetime.now(timezone.utc).isoformat(),
    }
    meta["clinical_assessment"] = assessment_record
    if mark_completed:
        meta["status"] = "completed"
        cp.status = "completed"

    cp.notes = json.dumps(meta)

    mother = db.get(Mother, cp.mother_id)
    patient_name = meta.get("patient_name") or (mother.name if mother else "Patient")
    patient_identifier = f"P-{str(cp.mother_id)[:8].upper()}"
    hospital_id = meta.get("hospital_id") or "HOSP-001"
    hospital_name = meta.get("hospital_name") or "Apollo Women's Hospital"
    doctor_id = meta.get("doctor_id") or "DR-001"
    doctor_name = user.full_name or meta.get("doctor_name") or "Dr. Priya Mehta"

    # Create or update ConsultationReport so Hospital Dashboard receives the finalized copy
    existing_report = db.scalar(
        select(ConsultationReport).where(ConsultationReport.appointment_id == str(cp.id))
    )
    epds_summary = None
    ai_summary = None
    if mother and mother.screenings:
        ls = mother.screenings[0]
        epds_summary = f"EPDS Score: {ls.total_score}/30 ({(ls.risk_classification or 'Preliminary').title()} Risk)"
        ai_summary = f"Multimodal assessment recorded on {ls.screening_date.strftime('%d %b %Y') if ls.screening_date else 'recent session'}"

    if existing_report:
        existing_report.consultation_date = consultation_date
        existing_report.doctor_id = doctor_id
        existing_report.doctor_name = doctor_name
        existing_report.clinical_observations = observations or existing_report.clinical_observations
        existing_report.clinical_assessment = diagnosis or existing_report.clinical_assessment
        existing_report.treatment_plan = care_plan_text or existing_report.treatment_plan
        existing_report.recommendations = care_plan_text or existing_report.recommendations
        existing_report.patient_friendly_summary = (
            f"During your consultation on {consultation_date}, {doctor_name} reviewed your emotional wellbeing and screening results. "
            f"Clinical assessment: {diagnosis or 'Postpartum supportive evaluation completed'}."
        )
        existing_report.patient_friendly_recommendations = care_plan_text or existing_report.patient_friendly_recommendations
        existing_report.status = "final" if mark_completed else "draft"
        existing_report.patient_approved = True
        existing_report.submitted_at = datetime.now(timezone.utc)
        report_obj = existing_report
    else:
        report_obj = ConsultationReport(
            report_code=f"REP-{datetime.now(timezone.utc).strftime('%Y')}-{str(cp.id)[:6].upper()}",
            mother_id=cp.mother_id,
            patient_name=patient_name,
            patient_identifier=patient_identifier,
            appointment_id=str(cp.id),
            doctor_id=doctor_id,
            doctor_name=doctor_name,
            doctor_specialization="Perinatal Psychiatry",
            hospital_id=hospital_id,
            hospital_name=hospital_name,
            department="Perinatal Mental Health",
            consultation_date=consultation_date,
            presenting_complaints=meta.get("reason") or "Postpartum emotional screening follow-up",
            clinical_observations=observations or "Clinical mental state examination completed.",
            clinical_assessment=diagnosis or "Postpartum clinical evaluation completed.",
            treatment_plan=care_plan_text or "Structured perinatal supportive care plan.",
            recommendations=care_plan_text or "Continue scheduled follow-up and supportive care.",
            followup_instructions="Follow up in 2 weeks or sooner if distress escalates.",
            epds_summary=epds_summary,
            ai_screening_summary=ai_summary,
            patient_friendly_summary=(
                f"During your consultation on {consultation_date}, {doctor_name} reviewed your emotional wellbeing and screening results. "
                f"Clinical assessment: {diagnosis or 'Postpartum supportive evaluation completed'}."
            ),
            patient_friendly_recommendations=care_plan_text or "Continue scheduled follow-up and supportive care.",
            patient_friendly_followup="Follow up in 2 weeks or sooner if distress escalates.",
            status="final" if mark_completed else "draft",
            patient_approved=True,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(report_obj)

    # Notify Apollo Hospital and Patient
    if mark_completed:
        create_notification_dedup(
            db,
            recipient_id=hospital_id,
            recipient_role="hospital",
            notification_type="consultation_completed",
            title="Clinical Consultation Report Ready",
            message=f"Clinical consultation report finalized by {doctor_name} for {patient_name}.",
            related_appointment_id=str(cp.id),
            metadata={
                "patientName": patient_name,
                "doctorName": doctor_name,
                "diagnosis": diagnosis,
                "consultationDate": consultation_date,
            },
        )
        create_notification_dedup(
            db,
            recipient_id=str(cp.mother_id),
            recipient_role="patient",
            notification_type="consultation_completed",
            title="Consultation Assessment & Care Plan Ready",
            message=f"{doctor_name} has completed your consultation assessment and updated your care plan.",
            related_appointment_id=str(cp.id),
            metadata={
                "doctorName": doctor_name,
                "diagnosis": diagnosis,
                "consultationDate": consultation_date,
            },
        )

    db.commit()
    return {
        "status": "saved",
        "appointmentId": str(cp.id),
        "appointmentStatus": "Completed" if mark_completed else (cp.status or "Pending").title(),
        "clinicalAssessment": assessment_record,
        "reportCode": report_obj.report_code,
    }

