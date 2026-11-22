"""FastAPI Router for the AANCHAL Hospital Portal and Appointment Management.

Exposes:
- POST /api/hospital/login: Authenticate hospital staff and issue JWT
- GET  /api/hospital/dashboard: Aggregate metrics for the hospital
- GET  /api/hospital/appointments: List appointment requests for the authenticated hospital
- GET  /api/hospital/appointments/{appointment_id}: Appointment request detail
- PUT  /api/hospital/appointments/{appointment_id}/status: Accept, reject, or propose new time
- PUT  /api/hospital/appointments/{appointment_id}/assign: Assign an available doctor
- GET  /api/hospital/doctors: List doctors associated with the hospital
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.care_plan import CarePlan
from backend.models.consultation_report import ConsultationReport
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.consultation_report import (
    HospitalReportDetail,
    HospitalReportListItem,
)
from backend.schemas.hospital import (
    HospitalAppointmentItem,
    HospitalAssignDoctorRequest,
    HospitalDashboardMetrics,
    HospitalDoctorInfo,
    HospitalLoginRequest,
    HospitalLoginResponse,
    HospitalStatusUpdateRequest,
    HospitalUserResponse,
)
from backend.services.auth_service import (
    HOSPITAL_USER_MAPPING,
    create_access_token,
    get_user_hospital_profile,
    require_hospital,
    verify_password,
)

logger = logging.getLogger("ppd.routers.hospital")

router = APIRouter(prefix="/api/hospital", tags=["Hospital Portal"])

# Static lookup of sample doctors associated with hospitals (matches sampleDoctors.js)
HOSPITAL_ASSOCIATED_DOCTORS = {
    "HOSP-001": [
        {
            "doctor_id": "DR-001",
            "name": "Dr. Sunita Rao",
            "specialization": "Perinatal Psychiatrist",
            "years_experience": 14,
            "availability": "Mon, Wed, Fri · 10:00 AM – 2:00 PM",
            "consultation_types": ["In-person", "Telehealth"],
        },
        {
            "doctor_id": "DR-002",
            "name": "Dr. Ananya Sharma",
            "specialization": "Obstetrician & Gynecologist",
            "years_experience": 11,
            "availability": "Tue, Thu, Sat · 9:00 AM – 1:00 PM",
            "consultation_types": ["In-person"],
        },
        {
            "doctor_id": "DR-005",
            "name": "Dr. Elena Rostova",
            "specialization": "Perinatal Psychiatry Lead",
            "years_experience": 12,
            "availability": "Mon – Fri · 9:00 AM – 5:00 PM",
            "consultation_types": ["Telehealth", "In-person"],
        },
    ],
    "HOSP-002": [
        {
            "doctor_id": "DR-003",
            "name": "Dr. Meera Nambiar",
            "specialization": "Clinical Psychologist",
            "years_experience": 8,
            "availability": "Mon, Tue, Thu · 2:00 PM – 6:00 PM",
            "consultation_types": ["Telehealth", "Audio Consult"],
        },
    ],
    "HOSP-003": [
        {
            "doctor_id": "DR-004",
            "name": "Dr. Priya Deshmukh",
            "specialization": "Maternal-Fetal Medicine Specialist",
            "years_experience": 16,
            "availability": "Wed, Fri · 11:00 AM – 4:00 PM",
            "consultation_types": ["In-person"],
        },
    ],
}


def _parse_care_plan_meta(cp: CarePlan) -> Dict[str, Any]:
    """Safely parse JSON metadata stored in care_plan.notes."""
    if cp.notes and cp.notes.strip().startswith("{"):
        try:
            return json.loads(cp.notes)
        except Exception:
            pass
    return {}


def _to_appointment_item(cp: CarePlan, mother: Optional[Mother] = None) -> HospitalAppointmentItem:
    """Format a CarePlan row into a HospitalAppointmentItem."""
    meta = _parse_care_plan_meta(cp)
    patient_name = meta.get("patient_name") or (mother.name if mother else "Patient")
    patient_phone = meta.get("patient_phone") or (mother.phone if mother else None)
    
    created_at_str = cp.created_at.isoformat() if hasattr(cp, "created_at") and cp.created_at else datetime.now(timezone.utc).isoformat()
    req_date = meta.get("requested_date") or (cp.scheduled_followup_date.strftime("%d %b %Y") if cp.scheduled_followup_date else "Flexible")
    req_time = meta.get("requested_time") or "11:00 AM"

    return HospitalAppointmentItem(
        id=str(cp.id),
        mother_id=str(cp.mother_id),
        patient_name=patient_name,
        patient_phone=patient_phone,
        requested_doctor_id=meta.get("doctor_id"),
        requested_doctor_name=meta.get("doctor_name") or cp.assigned_clinician_id or "Assigned Clinician",
        assigned_doctor_id=meta.get("assigned_doctor_id"),
        assigned_doctor_name=meta.get("assigned_doctor_name") or cp.assigned_clinician_id,
        hospital_id=meta.get("hospital_id") or "HOSP-001",
        hospital_name=meta.get("hospital_name") or cp.referral_destination or "AANCHAL Partner Hospital",
        requested_date=req_date,
        requested_time=req_time,
        confirmed_date=meta.get("confirmed_date"),
        confirmed_time=meta.get("confirmed_time"),
        proposed_date=meta.get("proposed_date"),
        proposed_time=meta.get("proposed_time"),
        status=meta.get("status") or cp.status or "pending",
        type=meta.get("consultation_type") or cp.intervention_type or "In-person",
        reason=meta.get("reason"),
        hospital_notes=meta.get("hospital_notes"),
        created_at=created_at_str,
    )


@router.post(
    "/login",
    response_model=HospitalLoginResponse,
    summary="Authenticate hospital staff account",
)
def hospital_login(
    payload: HospitalLoginRequest,
    db: Session = Depends(get_db),
) -> HospitalLoginResponse:
    """Authenticate hospital staff via email or Hospital ID (e.g. 'HOSP-001')."""
    raw_id = payload.email_or_id.strip()

    # Map hospital ID shortcut to registered email if provided
    id_to_email = {
        "HOSP-001": "apollo@hospital.miora.health",
        "HOSP-002": "cloudnine@hospital.miora.health",
        "HOSP-003": "fortis@hospital.miora.health",
    }
    clean_email = id_to_email.get(raw_id.upper(), raw_id.lower())

    # 1. Lookup user
    user = db.scalar(select(User).where(User.email == clean_email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Hospital ID / Email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Verify password
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Hospital ID / Email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Verify hospital role
    if user.role not in ("hospital", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Account '{user.email}' is registered with role '{user.role}', not 'hospital'.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This hospital account has been deactivated. Please contact AANCHAL network support.",
        )

    # 4. Resolve hospital profile
    hosp_prof = get_user_hospital_profile(user)

    # 5. Issue JWT token
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "hospital_id": hosp_prof["hospital_id"],
        "name": user.full_name,
    })

    return HospitalLoginResponse(
        access_token=token,
        token_type="bearer",
        hospital=HospitalUserResponse(
            user_id=str(user.id),
            hospital_id=hosp_prof["hospital_id"],
            hospital_name=hosp_prof["hospital_name"],
            hospital_location=hosp_prof["hospital_location"],
            email=user.email,
            role=user.role,
        ),
    )


@router.get(
    "/dashboard",
    response_model=HospitalDashboardMetrics,
    summary="Get hospital appointment request metrics",
)
def get_hospital_dashboard(
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> HospitalDashboardMetrics:
    """Retrieve aggregate appointment request counts strictly for the authenticated hospital."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    # Query all CarePlans
    all_plans = db.scalars(select(CarePlan).order_by(desc(CarePlan.created_at))).all()

    total = 0
    pending = 0
    confirmed = 0
    completed = 0
    cancelled = 0

    for cp in all_plans:
        meta = _parse_care_plan_meta(cp)
        h_id = meta.get("hospital_id")
        if not h_id and cp.referral_destination and target_hid in cp.referral_destination:
            h_id = target_hid
        if h_id != target_hid:
            continue

        total += 1
        st = (meta.get("status") or cp.status or "pending").lower()
        if st in ("pending", "requested"):
            pending += 1
        elif st == "confirmed":
            confirmed += 1
        elif st == "completed":
            completed += 1
        elif st in ("cancelled", "rejected"):
            cancelled += 1
        elif st == "rescheduled":
            pending += 1  # awaiting patient / hospital finalization

    return HospitalDashboardMetrics(
        total_requests=total,
        pending_requests=pending,
        confirmed_appointments=confirmed,
        completed_appointments=completed,
        cancelled_requests=cancelled,
    )


@router.get(
    "/appointments",
    response_model=List[HospitalAppointmentItem],
    summary="List appointment requests for the authenticated hospital",
)
def list_hospital_appointments(
    status_filter: Optional[str] = None,
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> List[HospitalAppointmentItem]:
    """Retrieve appointment requests strictly scoped to the caller's hospital."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    all_plans = db.scalars(select(CarePlan).order_by(desc(CarePlan.created_at))).all()
    results: List[HospitalAppointmentItem] = []

    for cp in all_plans:
        meta = _parse_care_plan_meta(cp)
        h_id = meta.get("hospital_id")
        if not h_id and cp.referral_destination and target_hid in cp.referral_destination:
            h_id = target_hid

        # STRICT MULTI-TENANT ISOLATION: Skip any record belonging to another hospital
        if h_id != target_hid:
            continue

        st = (meta.get("status") or cp.status or "pending").lower()
        if status_filter and status_filter.lower() != "all":
            if status_filter.lower() == "pending" and st not in ("pending", "requested", "rescheduled"):
                continue
            if status_filter.lower() != "pending" and st != status_filter.lower():
                continue

        mother = db.get(Mother, cp.mother_id)
        results.append(_to_appointment_item(cp, mother))

    return results


@router.get(
    "/appointments/{appointment_id}",
    response_model=HospitalAppointmentItem,
    summary="Get single appointment details",
)
def get_hospital_appointment_detail(
    appointment_id: uuid.UUID,
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> HospitalAppointmentItem:
    """Retrieve details of a single appointment with strict cross-hospital boundary enforcement."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    cp = db.get(CarePlan, appointment_id)
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment request '{appointment_id}' not found.",
        )

    meta = _parse_care_plan_meta(cp)
    h_id = meta.get("hospital_id")
    if not h_id and cp.referral_destination and target_hid in cp.referral_destination:
        h_id = target_hid

    # PREVENT CROSS-HOSPITAL DATA ACCESS
    if h_id != target_hid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view appointments belonging to another hospital organization.",
        )

    mother = db.get(Mother, cp.mother_id)
    return _to_appointment_item(cp, mother)


@router.put(
    "/appointments/{appointment_id}/status",
    response_model=HospitalAppointmentItem,
    summary="Accept, reject, or propose new appointment time",
)
def update_appointment_status(
    appointment_id: uuid.UUID,
    payload: HospitalStatusUpdateRequest,
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> HospitalAppointmentItem:
    """Transition appointment status (confirm, reject, propose_time) and notify patient."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    cp = db.get(CarePlan, appointment_id)
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment request '{appointment_id}' not found.",
        )

    meta = _parse_care_plan_meta(cp)
    h_id = meta.get("hospital_id")
    if not h_id and cp.referral_destination and target_hid in cp.referral_destination:
        h_id = target_hid

    if h_id != target_hid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot modify appointments belonging to another hospital organization.",
        )

    mother = db.get(Mother, cp.mother_id)
    action = payload.action.strip().lower()

    if action == "confirm":
        new_status = "confirmed"
        meta["status"] = "confirmed"
        meta["confirmed_date"] = payload.proposed_date or meta.get("requested_date")
        meta["confirmed_time"] = payload.proposed_time or meta.get("requested_time")
        if payload.notes:
            meta["hospital_notes"] = payload.notes
        cp.status = "confirmed"

        notif_msg = f"Your consultation with {meta.get('doctor_name')} on {meta['confirmed_date']} at {meta['confirmed_time']} has been confirmed by {hosp_prof['hospital_name']}."

    elif action == "reject":
        new_status = "cancelled"
        meta["status"] = "cancelled"
        if payload.notes:
            meta["hospital_notes"] = payload.notes
        cp.status = "cancelled"

        notif_msg = f"Your appointment request could not be accommodated by {hosp_prof['hospital_name']}. Note: {payload.notes or 'No specific reason provided.'}"

    elif action == "propose_time":
        if not payload.proposed_date or not payload.proposed_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Both proposed_date and proposed_time are required when proposing an alternative appointment time.",
            )
        new_status = "rescheduled"
        meta["status"] = "rescheduled"
        meta["proposed_date"] = payload.proposed_date
        meta["proposed_time"] = payload.proposed_time
        if payload.notes:
            meta["hospital_notes"] = payload.notes
        cp.status = "rescheduled"

        notif_msg = f"{hosp_prof['hospital_name']} has proposed an alternative time for your consultation: {payload.proposed_date} at {payload.proposed_time}."

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown status action '{payload.action}'. Supported: 'confirm', 'reject', 'propose_time'.",
        )

    # Persist updated notes
    cp.notes = json.dumps(meta)

    # Also update Mother's metadata notifications & appointment list
    if mother:
        try:
            m_notes = json.loads(mother.notes) if mother.notes and mother.notes.strip().startswith("{") else {}
        except Exception:
            m_notes = {}

        notifs = m_notes.get("notifications", [])
        notifs.insert(
            0,
            {
                "id": f"n-hosp-{uuid.uuid4().hex[:6]}",
                "title": f"Appointment Status: {new_status.title()}",
                "message": notif_msg,
                "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
                "read": False,
            },
        )
        m_notes["notifications"] = notifs[:15]

        # Update in metadata appointment list if found
        m_appts = m_notes.get("appointments", [])
        for a in m_appts:
            if a.get("id") == str(cp.id):
                a["status"] = new_status.title()
                if action == "confirm":
                    a["date"] = meta.get("confirmed_date", a.get("date"))
                    a["time"] = meta.get("confirmed_time", a.get("time"))
                elif action == "propose_time":
                    a["proposedDate"] = payload.proposed_date
                    a["proposedTime"] = payload.proposed_time
        m_notes["appointments"] = m_appts
        mother.notes = json.dumps(m_notes)

    db.commit()
    db.refresh(cp)
    if mother:
        db.refresh(mother)

    logger.info("Updated appointment status: id=%s -> %s by hospital=%s", cp.id, new_status, target_hid)
    return _to_appointment_item(cp, mother)


@router.put(
    "/appointments/{appointment_id}/assign",
    response_model=HospitalAppointmentItem,
    summary="Assign an available hospital doctor to an appointment",
)
def assign_doctor(
    appointment_id: uuid.UUID,
    payload: HospitalAssignDoctorRequest,
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> HospitalAppointmentItem:
    """Assign an available doctor associated with the hospital to the appointment."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    cp = db.get(CarePlan, appointment_id)
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment request '{appointment_id}' not found.",
        )

    meta = _parse_care_plan_meta(cp)
    h_id = meta.get("hospital_id")
    if not h_id and cp.referral_destination and target_hid in cp.referral_destination:
        h_id = target_hid

    if h_id != target_hid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot assign doctors for appointments belonging to another hospital organization.",
        )

    # Update doctor assignment
    cp.assigned_clinician_id = payload.doctor_name
    meta["assigned_doctor_id"] = payload.doctor_id
    meta["assigned_doctor_name"] = payload.doctor_name
    cp.notes = json.dumps(meta)

    mother = db.get(Mother, cp.mother_id)
    if mother:
        try:
            m_notes = json.loads(mother.notes) if mother.notes and mother.notes.strip().startswith("{") else {}
        except Exception:
            m_notes = {}

        m_appts = m_notes.get("appointments", [])
        for a in m_appts:
            if a.get("id") == str(cp.id):
                a["assignedDoctorId"] = payload.doctor_id
                a["assignedDoctorName"] = payload.doctor_name
                a["doctorName"] = payload.doctor_name
        m_notes["appointments"] = m_appts
        mother.notes = json.dumps(m_notes)

    db.commit()
    db.refresh(cp)
    if mother:
        db.refresh(mother)

    logger.info("Assigned doctor %s to appointment %s by hospital %s", payload.doctor_name, cp.id, target_hid)
    return _to_appointment_item(cp, mother)


@router.get(
    "/doctors",
    response_model=List[HospitalDoctorInfo],
    summary="List doctors associated with the authenticated hospital",
)
def list_hospital_doctors(
    user: User = Depends(require_hospital),
) -> List[HospitalDoctorInfo]:
    """Retrieve doctor roster for the authenticated hospital organization."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    raw_doctors = HOSPITAL_ASSOCIATED_DOCTORS.get(target_hid, [])
    return [HospitalDoctorInfo(**d) for d in raw_doctors]


@router.get(
    "/reports",
    response_model=List[HospitalReportListItem],
    summary="List clinical reports for the authenticated hospital organization",
)
def list_hospital_reports(
    search: Optional[str] = None,
    doctor: Optional[str] = None,
    status_filter: Optional[str] = None,
    date_filter: Optional[str] = None,
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> List[HospitalReportListItem]:
    """Retrieve consultation reports strictly scoped to the caller's hospital organization.

    Includes search by patient name or report ID, and filtering by doctor, date, or status.
    """
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

    query = (
        select(ConsultationReport)
        .where(ConsultationReport.hospital_id == target_hid)
        .order_by(desc(ConsultationReport.created_at))
    )

    all_reports = db.scalars(query).all()
    results: List[HospitalReportListItem] = []

    for r in all_reports:
        # Search filter
        if search:
            s_low = search.strip().lower()
            if (
                s_low not in r.patient_name.lower()
                and s_low not in r.patient_identifier.lower()
                and s_low not in r.report_code.lower()
            ):
                continue

        # Doctor filter
        if doctor and doctor.lower() != "all":
            if doctor.lower() not in r.doctor_name.lower() and doctor != r.doctor_id:
                continue

        # Status filter
        if status_filter and status_filter.lower() != "all":
            if r.status.lower() != status_filter.lower():
                continue

        # Date filter
        if date_filter:
            if date_filter.lower() not in r.consultation_date.lower():
                continue

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
    "/reports/{report_id}",
    response_model=HospitalReportDetail,
    summary="Get detailed clinical report for hospital staff",
)
def get_hospital_report_detail(
    report_id: str,
    user: User = Depends(require_hospital),
    db: Session = Depends(get_db),
) -> HospitalReportDetail:
    """Retrieve full clinical consultation report with strict hospital organization scoping."""
    hosp_prof = get_user_hospital_profile(user)
    target_hid = hosp_prof["hospital_id"]

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

    # STRICT CROSS-HOSPITAL DATA ACCESS CHECK
    if report.hospital_id != target_hid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view reports belonging to another hospital organization.",
        )

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

