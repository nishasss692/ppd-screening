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
    """Retrieve appointments and consultations assigned to healthcare professionals."""
    all_plans = db.scalars(
        select(CarePlan).order_by(desc(CarePlan.created_at))
    ).all()

    results = []
    for cp in all_plans:
        meta: Dict[str, Any] = {}
        if cp.notes and cp.notes.strip().startswith("{"):
            try:
                meta = json.loads(cp.notes)
            except Exception:
                meta = {}

        mother = db.get(Mother, cp.mother_id)
        patient_name = meta.get("patient_name") or (mother.name if mother else "Patient")
        
        # Check latest screening risk classification for authorized clinical context
        screening_risk = "Not Screened"
        if mother and mother.screenings:
            latest_screening = mother.screenings[0]
            screening_risk = latest_screening.risk_classification or "Preliminary"

        results.append({
            "id": str(cp.id),
            "motherId": str(cp.mother_id),
            "patientName": patient_name,
            "patientPhone": meta.get("patient_phone") or (mother.phone if mother else None),
            "assignedDoctorName": meta.get("assigned_doctor_name") or cp.assigned_clinician_id or user.full_name,
            "hospitalName": meta.get("hospital_name") or cp.referral_destination or "AANCHAL Partner Hospital",
            "date": meta.get("confirmed_date") or meta.get("requested_date") or (cp.scheduled_followup_date.strftime("%d %b %Y") if cp.scheduled_followup_date else "Flexible"),
            "time": meta.get("confirmed_time") or meta.get("requested_time") or "11:00 AM",
            "status": (meta.get("status") or cp.status or "scheduled").title(),
            "consultationType": meta.get("consultation_type") or cp.intervention_type or "Telehealth Video",
            "reason": meta.get("reason"),
            "screeningRisk": screening_risk,
            "hospitalNotes": meta.get("hospital_notes"),
        })

    return results

