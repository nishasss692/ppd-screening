"""FastAPI router for Patient Portal endpoints with persistent PostgreSQL storage.

Exposes:
- POST /api/patients/register
- GET  /api/patients/me
- PUT  /api/patients/me
- GET  /api/patients/me/medical-history
- PUT  /api/patients/me/medical-history
- POST /api/patients/me/screenings
- GET  /api/patients/me/screenings
- GET  /api/patients/me/screenings/{screening_id}
- GET  /api/patients/me/reports
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.mother import Mother
from backend.models.screening import Screening
from backend.models.user import User
from backend.schemas.questionnaire import AnswerSubmissionItem, EPDSSubmissionRequest
from backend.schemas.patient_portal import (
    AuthTokenResponse,
    MedicalHistoryResponse,
    MedicalHistoryUpdateRequest,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    PatientRegisterRequest,
    PatientReportsOverviewResponse,
    PatientScreeningSummaryResponse,
    ScreeningSubmissionSaveRequest,
)
from backend.services.auth_service import (
    create_access_token,
    hash_password,
    require_patient,
)
from backend.services.questionnaire_service import questionnaire_service

logger = logging.getLogger("ppd.patients")

RECORDINGS_DIR = Path("data/raw/recordings")

router = APIRouter(prefix="/api/patients", tags=["Patient Portal"])


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Patient and link to Mother entity",
)
def register_patient(
    payload: PatientRegisterRequest,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    """Register a new mother/patient account, creating both Mother and User entities."""
    clean_email = payload.email.strip().lower()

    # 1. Check if user already exists
    existing_user = db.scalar(select(User).where(User.email == clean_email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # 2. Check or create Mother entity
    mother = db.scalar(select(Mother).where(Mother.email == clean_email))
    if not mother:
        mother = Mother(
            name=payload.name.strip(),
            email=clean_email,
            phone=payload.phone.strip() if payload.phone else None,
            age=payload.age,
            delivery_date=payload.delivery_date,
            pregnancy_type=payload.pregnancy_type,
            medical_history=json.dumps({"prior_ppd_diagnosis": "not-sure", "uploaded_files": []}),
            notes="Registered via Patient Portal.",
        )
        db.add(mother)
        db.flush()

    # 3. Create User account with hashed password
    hashed_pw = hash_password(payload.password)
    new_user = User(
        email=clean_email,
        hashed_password=hashed_pw,
        full_name=payload.name.strip(),
        role="patient",
        mother_id=mother.id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.refresh(mother)

    # 4. Generate JWT token
    token = create_access_token(
        {
            "sub": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role,
            "mother_id": str(mother.id),
        }
    )

    parts = mother.name.split()
    first_name = parts[0] if parts else mother.name

    user_dict = {
        "id": f"P-{str(mother.id)[:8].upper()}",
        "mother_id": str(mother.id),
        "user_id": str(new_user.id),
        "name": first_name,
        "fullName": mother.name,
        "email": new_user.email,
        "role": new_user.role,
        "avatarInitials": first_name[0].upper() if first_name else "A",
        "postpartumWeek": payload.postpartum_week or 4,
    }

    logger.info("Registered new patient: email=%s, mother_id=%s", clean_email, mother.id)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=user_dict,
        redirect_url="/patient/dashboard",
    )


@router.get(
    "/me",
    response_model=PatientProfileResponse,
    summary="Get authenticated patient profile",
)
def get_patient_profile(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientProfileResponse:
    """Retrieve the current authenticated patient's profile from PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile record not linked to an enrolled Mother entity.",
        )

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mother record not found.",
        )

    parts = mother.name.split()
    first_name = parts[0] if parts else mother.name

    return PatientProfileResponse(
        id=str(mother.id),
        user_id=str(user.id),
        name=first_name,
        full_name=mother.name,
        email=mother.email or user.email,
        age=mother.age,
        phone=mother.phone,
        delivery_date=mother.delivery_date,
        pregnancy_type=mother.pregnancy_type,
        medical_history=mother.medical_history,
        notes=mother.notes,
        created_at=mother.created_at,
        updated_at=mother.updated_at,
    )


@router.put(
    "/me",
    response_model=PatientProfileResponse,
    summary="Update authenticated patient profile",
)
def update_patient_profile(
    payload: PatientProfileUpdateRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientProfileResponse:
    """Update profile fields for the authenticated patient."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    if payload.name is not None:
        mother.name = payload.name.strip()
        user.full_name = payload.name.strip()
    if payload.age is not None:
        mother.age = payload.age
    if payload.phone is not None:
        mother.phone = payload.phone.strip()
    if payload.delivery_date is not None:
        mother.delivery_date = payload.delivery_date
    if payload.pregnancy_type is not None:
        mother.pregnancy_type = payload.pregnancy_type
    if payload.notes is not None:
        mother.notes = payload.notes

    db.commit()
    db.refresh(mother)
    db.refresh(user)

    parts = mother.name.split()
    first_name = parts[0] if parts else mother.name

    return PatientProfileResponse(
        id=str(mother.id),
        user_id=str(user.id),
        name=first_name,
        full_name=mother.name,
        email=mother.email or user.email,
        age=mother.age,
        phone=mother.phone,
        delivery_date=mother.delivery_date,
        pregnancy_type=mother.pregnancy_type,
        medical_history=mother.medical_history,
        notes=mother.notes,
        created_at=mother.created_at,
        updated_at=mother.updated_at,
    )


@router.get(
    "/me/medical-history",
    response_model=MedicalHistoryResponse,
    summary="Get patient medical history",
)
def get_patient_medical_history(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> MedicalHistoryResponse:
    """Retrieve saved medical history and uploaded documents metadata from Mother entity."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    prior_ppd = "not-sure"
    uploaded = []
    med_text = mother.medical_history or ""

    if mother.medical_history:
        try:
            parsed = json.loads(mother.medical_history)
            if isinstance(parsed, dict):
                prior_ppd = parsed.get("prior_ppd_diagnosis", "not-sure")
                uploaded = parsed.get("uploaded_files", [])
                med_text = parsed.get("notes") or parsed.get("medical_history") or ""
        except Exception:
            pass

    return MedicalHistoryResponse(
        prior_ppd_diagnosis=prior_ppd,
        medical_history=med_text,
        uploaded_files=uploaded,
        saved_at=mother.updated_at,
    )


@router.put(
    "/me/medical-history",
    response_model=MedicalHistoryResponse,
    summary="Update patient medical history",
)
def update_patient_medical_history(
    payload: MedicalHistoryUpdateRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> MedicalHistoryResponse:
    """Persist updated medical history and document attachments to Mother entity."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    history_data = {
        "prior_ppd_diagnosis": payload.prior_ppd_diagnosis or "not-sure",
        "medical_history": payload.medical_history or "",
        "uploaded_files": payload.uploaded_files or [],
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }

    mother.medical_history = json.dumps(history_data)
    db.commit()
    db.refresh(mother)

    return MedicalHistoryResponse(
        prior_ppd_diagnosis=history_data["prior_ppd_diagnosis"],
        medical_history=history_data["medical_history"],
        uploaded_files=history_data["uploaded_files"],
        saved_at=mother.updated_at,
    )


@router.post(
    "/me/screenings",
    response_model=PatientScreeningSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Persist completed EPDS screening session to PostgreSQL",
)
def submit_and_save_screening(
    payload: ScreeningSubmissionSaveRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientScreeningSummaryResponse:
    """Score all 10 EPDS responses and persist the screening record to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    # Calculate score using canonical questionnaire_service
    submission_req = EPDSSubmissionRequest(
        answers=[
            AnswerSubmissionItem(question_id=a.question_id, selected_index=a.selected_index)
            for a in payload.answers
        ]
    )
    scored = questionnaire_service.calculate_score(submission_req)

    # Check for duplicate submission within last 60 seconds
    recent_stmt = (
        select(Screening)
        .where(Screening.mother_id == mother.id)
        .order_by(desc(Screening.created_at))
        .limit(1)
    )
    latest = db.scalar(recent_stmt)
    if latest:
        delta = datetime.now(timezone.utc) - latest.created_at
        if delta.total_seconds() < 5 and latest.total_score == scored.total_score:
            logger.info("Debouncing repeated submission for mother_id=%s", mother.id)
            return PatientScreeningSummaryResponse.model_validate(latest)

    # Map raw responses and item scores dictionary
    raw_responses_map = {
        a.question_id: a.raw_response
        for a in payload.answers
        if a.raw_response
    }
    item_scores_map = {item.question_id: item.score for item in scored.item_scores}
    submitted_answers_map = {
        item.question_id: {
            "selected_index": getattr(item, "selected_option_index", getattr(item, "selected_index", 0)),
            "score": item.score,
            "question_number": item.question_number,
            "raw_response": raw_responses_map.get(item.question_id) or "",
        }
        for item in scored.item_scores
    }

    # Normalize clinical classification for Screening table
    total = scored.total_score
    if total >= 13:
        risk_class = "high"
    elif total >= 10:
        risk_class = "moderate"
    else:
        risk_class = "low"

    model_meta = {
        "scoring_version": "1.0",
        "engine": "canonical_epds",
        "raw_responses": raw_responses_map,
    }
    mod_status = {"epds": "completed"}
    if payload.video_metadata:
        model_meta["video_recording"] = payload.video_metadata
        mod_status["video"] = payload.video_metadata.get("status", "recorded")
    if payload.question_timestamps:
        model_meta["question_timestamps"] = payload.question_timestamps

    new_screening = Screening(
        mother_id=mother.id,
        instrument="EPDS",
        total_score=scored.total_score,
        risk_classification=risk_class,
        q10_safety_alert=scored.safety_alert.triggered,
        submitted_answers=submitted_answers_map,
        item_scores=item_scores_map,
        screening_status="completed",
        fusion_status="completed" if payload.video_metadata else "not_available",
        modality_status=mod_status,
        model_metadata=model_meta,
        multimodal_scores={"epds_score": scored.total_score, "epds_classification": scored.classification},
        notes=payload.notes or f"Completed EPDS via Patient Assistant. Score: {scored.total_score}/30",
    )

    db.add(new_screening)
    db.commit()
    db.refresh(new_screening)

    logger.info(
        "Persisted screening to PostgreSQL: id=%s, mother_id=%s, score=%d, q10_alert=%s",
        new_screening.id,
        mother.id,
        new_screening.total_score,
        new_screening.q10_safety_alert,
    )

    return PatientScreeningSummaryResponse(
        id=str(new_screening.id),
        mother_id=str(new_screening.mother_id),
        screening_date=new_screening.screening_date,
        instrument=new_screening.instrument,
        total_score=new_screening.total_score,
        maximum_score=30,
        risk_classification=new_screening.risk_classification,
        q10_safety_alert=new_screening.q10_safety_alert,
        screening_status=new_screening.screening_status,
        item_scores=new_screening.item_scores,
        submitted_answers=new_screening.submitted_answers,
        model_metadata=new_screening.model_metadata,
        created_at=new_screening.created_at,
    )


@router.post(
    "/me/screenings/{screening_id}/video",
    response_model=PatientScreeningSummaryResponse,
    summary="Upload and associate continuous video recording with an EPDS screening session",
)
async def upload_screening_video(
    screening_id: uuid.UUID,
    video_file: UploadFile = File(...),
    duration_seconds: float = Form(0.0),
    question_timestamps: str = Form("[]"),
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientScreeningSummaryResponse:
    """Upload continuous video recording blob, save to local recordings archive, and associate with screening."""
    screening = db.get(Screening, screening_id)
    if not screening or screening.mother_id != user.mother_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screening record not found or access denied.",
        )

    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(video_file.filename or "recording.webm").suffix or ".webm"
    target_filename = f"{screening.id}{suffix}"
    target_path = RECORDINGS_DIR / target_filename

    content = await video_file.read()
    with open(target_path, "wb") as f:
        f.write(content)

    parsed_timestamps = []
    try:
        parsed_timestamps = json.loads(question_timestamps)
    except Exception:
        pass

    meta = dict(screening.model_metadata or {})
    meta["video_recording"] = {
        "file_path": str(target_path).replace("\\", "/"),
        "filename": target_filename,
        "file_size_bytes": len(content),
        "mime_type": video_file.content_type or "video/webm",
        "duration_seconds": duration_seconds,
        "question_timestamps": parsed_timestamps,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    screening.model_metadata = meta

    mod_stat = dict(screening.modality_status or {})
    mod_stat["video"] = "completed"
    screening.modality_status = mod_stat
    screening.fusion_status = "completed"

    db.commit()
    db.refresh(screening)

    logger.info(
        "Attached video recording to screening: id=%s, size=%d bytes, duration=%.1fs",
        screening.id,
        len(content),
        duration_seconds,
    )

    return PatientScreeningSummaryResponse(
        id=str(screening.id),
        mother_id=str(screening.mother_id),
        screening_date=screening.screening_date,
        instrument=screening.instrument,
        total_score=screening.total_score,
        maximum_score=30,
        risk_classification=screening.risk_classification,
        q10_safety_alert=screening.q10_safety_alert,
        screening_status=screening.screening_status,
        item_scores=screening.item_scores or {},
        submitted_answers=screening.submitted_answers or {},
        model_metadata=screening.model_metadata,
        created_at=screening.created_at,
    )


@router.get(
    "/me/screenings/{screening_id}/video",
    summary="Download or stream continuous video recording for screening session",
)
def get_screening_video_file(
    screening_id: uuid.UUID,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Retrieve the continuous video file associated with a screening."""
    screening = db.get(Screening, screening_id)
    if not screening or screening.mother_id != user.mother_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screening record not found or access denied.",
        )

    meta = screening.model_metadata or {}
    video_rec = meta.get("video_recording")
    if not video_rec or not video_rec.get("file_path"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No video recording found for this screening.",
        )

    file_path = Path(video_rec["file_path"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video recording file does not exist on disk.",
        )

    return FileResponse(
        str(file_path),
        media_type=video_rec.get("mime_type", "video/webm"),
        filename=video_rec.get("filename", f"{screening.id}.webm"),
    )


@router.get(
    "/me/screenings",
    response_model=List[PatientScreeningSummaryResponse],
    summary="Get all historical screenings for authenticated patient",
)
def get_patient_screenings(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> List[PatientScreeningSummaryResponse]:
    """Retrieve all completed screening sessions for this patient from PostgreSQL."""
    if not user.mother_id:
        return []

    stmt = (
        select(Screening)
        .where(Screening.mother_id == user.mother_id)
        .order_by(desc(Screening.screening_date))
    )
    records = db.scalars(stmt).all()

    return [
        PatientScreeningSummaryResponse(
            id=str(s.id),
            mother_id=str(s.mother_id),
            screening_date=s.screening_date,
            instrument=s.instrument,
            total_score=s.total_score,
            maximum_score=30,
            risk_classification=s.risk_classification,
            q10_safety_alert=s.q10_safety_alert,
            screening_status=s.screening_status,
            item_scores=s.item_scores or {},
            submitted_answers=s.submitted_answers or {},
            model_metadata=s.model_metadata,
            created_at=s.created_at,
        )
        for s in records
    ]


@router.get(
    "/me/screenings/{screening_id}",
    response_model=PatientScreeningSummaryResponse,
    summary="Get detailed screening record by ID",
)
def get_screening_detail(
    screening_id: uuid.UUID,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientScreeningSummaryResponse:
    """Retrieve a single screening record, enforcing patient ownership."""
    screening = db.get(Screening, screening_id)
    if not screening or screening.mother_id != user.mother_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screening record not found or access denied.",
        )

    return PatientScreeningSummaryResponse(
        id=str(screening.id),
        mother_id=str(screening.mother_id),
        screening_date=screening.screening_date,
        instrument=screening.instrument,
        total_score=screening.total_score,
        maximum_score=30,
        risk_classification=screening.risk_classification,
        q10_safety_alert=screening.q10_safety_alert,
        screening_status=screening.screening_status,
        item_scores=screening.item_scores or {},
        submitted_answers=screening.submitted_answers or {},
        model_metadata=screening.model_metadata,
        created_at=screening.created_at,
    )


@router.get(
    "/me/reports",
    response_model=PatientReportsOverviewResponse,
    summary="Synthesized patient reports overview",
)
def get_patient_reports_overview(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientReportsOverviewResponse:
    """Retrieve comprehensive report overview synthesizing PostgreSQL records."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    # Retrieve all screenings
    stmt = (
        select(Screening)
        .where(Screening.mother_id == mother.id)
        .order_by(desc(Screening.screening_date))
    )
    screenings = db.scalars(stmt).all()

    latest_dict = None
    if screenings:
        latest = screenings[0]
        risk_pct = int(round((latest.total_score / 30.0) * 100))
        label_map = {
            "high": "Probable Depression (High Risk)",
            "moderate": "Possible Depression (Moderate Risk)",
            "low": "Low Likelihood of Depressive Illness",
        }
        latest_dict = {
            "id": str(latest.id),
            "date": latest.screening_date.strftime("%d %b %Y"),
            "completedDateTime": latest.screening_date.strftime("%d %b %Y · %I:%M %p"),
            "riskScore": risk_pct,
            "riskLabel": label_map.get(latest.risk_classification, latest.risk_classification.title()),
            "totalScore": latest.total_score,
            "maximumScore": 30,
            "q10SafetyAlert": latest.q10_safety_alert,
            "q10Alert": latest.q10_safety_alert,
            "summary": latest.notes or f"EPDS Assessment score: {latest.total_score}/30",
        }

    parts = mother.name.split()
    first_name = parts[0] if parts else mother.name

    patient_dict = {
        "id": f"P-{str(mother.id)[:8].upper()}",
        "name": first_name,
        "fullName": mother.name,
        "email": mother.email or user.email,
        "avatarInitials": first_name[0].upper() if first_name else "A",
        "postpartumWeek": 4,
    }

    screenings_list = [
        {
            "id": str(s.id),
            "date": s.screening_date.strftime("%d %b %Y"),
            "totalScore": s.total_score,
            "riskClassification": s.risk_classification,
            "q10SafetyAlert": s.q10_safety_alert,
        }
        for s in screenings
    ]

    return PatientReportsOverviewResponse(
        patient=patient_dict,
        latest_screening=latest_dict,
        screenings_count=len(screenings),
        screenings=screenings_list,
        care_plan=None,
    )
