"""FastAPI router for Patient Portal endpoints with persistent PostgreSQL storage.

Exposes:
- Authentication & Profile:
  - POST /api/patients/register
  - GET  /api/patients/me
  - PUT  /api/patients/me
- Medical History:
  - GET  /api/patients/me/medical-history
  - PUT  /api/patients/me/medical-history
- Screenings & Multimodal Recordings:
  - POST /api/patients/me/screenings
  - GET  /api/patients/me/screenings
  - GET  /api/patients/me/screenings/{screening_id}
  - POST /api/patients/me/screenings/{screening_id}/video
  - GET  /api/patients/me/screenings/{screening_id}/video
- Clinical Reports & Transcripts (PDF/TXT):
  - GET  /api/patients/me/reports
  - GET  /api/patients/me/screenings/{screening_id}/report.pdf
  - GET  /api/patients/me/screenings/{screening_id}/transcript.txt
  - GET  /api/patients/me/reports/latest/pdf
  - GET  /api/patients/me/reports/latest/transcript
- Appointments & Doctor Consultations:
  - GET  /api/patients/me/appointments
  - POST /api/patients/me/appointments
- Notifications:
  - GET  /api/patients/me/notifications
  - PUT  /api/patients/me/notifications/{notification_id}/read
  - PUT  /api/patients/me/notifications/read-all
- Care Plan & Restorative Tasks:
  - GET  /api/patients/me/care-plan
  - PUT  /api/patients/me/care-plan/tasks/{task_id}
- Settings & Device Preferences:
  - GET  /api/patients/me/settings
  - PUT  /api/patients/me/settings
  - GET  /api/patients/me/preferences
  - PUT  /api/patients/me/preferences
- AI Assistant Conversation & Mood Persistence:
  - GET  /api/patients/me/ai-conversations
  - POST /api/patients/me/ai-conversations
"""

from datetime import date, datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.care_plan import CarePlan
from backend.models.consultation_report import ConsultationReport
from backend.models.mother import Mother
from backend.models.screening import Screening
from backend.models.user import User
from backend.schemas.consultation_report import PatientConsultationReportResponse
from backend.schemas.questionnaire import AnswerSubmissionItem, EPDSSubmissionRequest
from backend.schemas.patient_portal import (
    AiConversationMessageItem,
    AiConversationSaveRequest,
    AppointmentBookRequest,
    AppointmentResponse,
    AuthTokenResponse,
    MedicalHistoryResponse,
    MedicalHistoryUpdateRequest,
    NotificationItemResponse,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    PatientRegisterRequest,
    PatientReportsOverviewResponse,
    PatientScreeningSummaryResponse,
    PatientSettingsRequest,
    PatientSettingsResponse,
    ScreeningSubmissionSaveRequest,
)
from backend.services.auth_service import (
    create_access_token,
    hash_password,
    require_patient,
)
from backend.services.patient_report_pdf import generate_patient_screening_pdf
from backend.services.questionnaire_service import questionnaire_service
from backend.services.clinical_adapter import assemble_clinical_features
from backend.schemas.clinical_numerical import ClinicalFeatures
from backend.services.clinical_service import clinical_service

logger = logging.getLogger("ppd.patients")

RECORDINGS_DIR = Path("data/raw/recordings")

router = APIRouter(prefix="/api/patients", tags=["Patient Portal"])

DEFAULT_CARE_TASKS = [
    {"id": "task-1", "title": "Breathing exercise", "completed": false if False else False},
    {"id": "task-2", "title": "Mood check-in", "completed": False},
    {"id": "task-3", "title": "Sleep routine", "completed": False},
    {"id": "task-4", "title": "Journaling", "completed": False},
    {"id": "task-5", "title": "Light activity", "completed": False},
    {"id": "task-6", "title": "Self-care time", "completed": False},
    {"id": "task-7", "title": "Reflection", "completed": False},
]


def _get_mother_portal_meta(mother: Mother) -> Dict[str, Any]:
    """Parse JSON metadata dictionary safely from mother.notes."""
    if not mother.notes:
        return {}
    try:
        parsed = json.loads(mother.notes)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {"legacy_notes": mother.notes}


def _save_mother_portal_meta(mother: Mother, meta: Dict[str, Any], db: Session) -> None:
    """Persist JSON metadata dictionary into mother.notes in PostgreSQL."""
    mother.notes = json.dumps(meta)
    db.commit()
    db.refresh(mother)


# ============================================================================
# 1. Authentication & Registration
# ============================================================================


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
    full_name = (payload.name or payload.full_name or "").strip()

    # 1. Check if user already exists
    existing_user = db.scalar(select(User).where(User.email == clean_email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # 2. Check or create Mother entity
    mother = db.scalar(select(Mother).where(Mother.email == clean_email))
    initial_meta = {
        "postpartum_week": payload.postpartum_week or 4,
        "emergency_contact": None,
        "preferences": {
            "language": "en",
            "voice_locale": "en-IN",
            "camera_permission": "prompt",
            "mic_permission": "prompt",
            "email_notifs": True,
            "consultation_alerts": True,
            "confidential_mode": True,
        },
        "notifications": [
            {
                "id": f"n-{uuid.uuid4().hex[:6]}",
                "title": "Welcome to MIORA",
                "message": f"Welcome, {full_name.split()[0]}! Your secure maternal wellness account is ready.",
                "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
                "read": False,
            }
        ],
        "care_tasks": DEFAULT_CARE_TASKS,
        "ai_conversations": [],
    }

    if not mother:
        mother = Mother(
            name=full_name,
            email=clean_email,
            phone=payload.phone.strip() if payload.phone else None,
            age=payload.age,
            delivery_date=payload.delivery_date,
            pregnancy_type=payload.pregnancy_type,
            medical_history=json.dumps({"prior_ppd_diagnosis": "not-sure", "uploaded_files": []}),
            notes=json.dumps(initial_meta),
        )
        db.add(mother)
        db.flush()

    # 3. Create User account with hashed password
    hashed_pw = hash_password(payload.password)
    new_user = User(
        email=clean_email,
        hashed_password=hashed_pw,
        full_name=full_name,
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


# ============================================================================
# 2. Patient Profile
# ============================================================================


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

    meta = _get_mother_portal_meta(mother)
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
        postpartum_week=meta.get("postpartum_week", 4),
        emergency_contact=meta.get("emergency_contact"),
        clinical_profile=mother.clinical_profile or {},
        profile_completed=bool(mother.profile_completed),
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
    """Update profile fields for the authenticated patient and persist to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    target_name = payload.name or payload.full_name
    if target_name is not None and target_name.strip():
        clean_name = target_name.strip()
        mother.name = clean_name
        user.full_name = clean_name
    if payload.age is not None:
        mother.age = payload.age
    if payload.phone is not None:
        mother.phone = payload.phone.strip()
    if payload.delivery_date is not None:
        mother.delivery_date = payload.delivery_date
    if payload.pregnancy_type is not None:
        mother.pregnancy_type = payload.pregnancy_type
    if payload.clinical_profile is not None:
        # Merge or replace clinical profile dictionary
        current_prof = dict(mother.clinical_profile or {})
        current_prof.update(payload.clinical_profile)
        mother.clinical_profile = current_prof
    if payload.profile_completed is not None:
        mother.profile_completed = payload.profile_completed

    meta = _get_mother_portal_meta(mother)
    if payload.postpartum_week is not None:
        meta["postpartum_week"] = payload.postpartum_week
    if payload.emergency_contact is not None:
        meta["emergency_contact"] = payload.emergency_contact
    if payload.notes is not None:
        meta["clinical_notes"] = payload.notes

    mother.notes = json.dumps(meta)

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
        postpartum_week=meta.get("postpartum_week", 4),
        emergency_contact=meta.get("emergency_contact"),
        clinical_profile=mother.clinical_profile or {},
        profile_completed=bool(mother.profile_completed),
        created_at=mother.created_at,
        updated_at=mother.updated_at,
    )


@router.get(
    "/me/clinical-profile",
    summary="Retrieve mother's Stage 1 clinical profile",
)
def get_clinical_profile(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve the Stage 1 clinical profile and completeness status."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not linked.")
    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    profile = dict(mother.clinical_profile or {})
    # Default age from mother entity if not explicitly in profile
    if "Age" not in profile and mother.age is not None:
        profile["Age"] = mother.age

    return {
        "mother_id": str(mother.id),
        "clinical_profile": profile,
        "profile_completed": bool(mother.profile_completed),
        "updated_at": mother.updated_at.isoformat() if mother.updated_at else None,
    }


@router.put(
    "/me/clinical-profile",
    summary="Save or update mother's Stage 1 clinical profile",
)
def update_clinical_profile(
    payload: Dict[str, Any],
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Save or update Stage 1 clinical profile fields."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not linked.")
    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not found.")

    new_profile = payload.get("clinical_profile", payload)
    completed_flag = payload.get("profile_completed", True)

    current_prof = dict(mother.clinical_profile or {})
    current_prof.update(new_profile)

    mother.clinical_profile = current_prof
    mother.profile_completed = bool(completed_flag)

    # Sync age if passed
    if "Age" in new_profile:
        try:
            mother.age = int(float(new_profile["Age"]))
        except (ValueError, TypeError):
            pass

    db.commit()
    db.refresh(mother)

    return {
        "status": "success",
        "mother_id": str(mother.id),
        "clinical_profile": mother.clinical_profile,
        "profile_completed": mother.profile_completed,
    }


# ============================================================================
# 3. Medical History
# ============================================================================


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
    med_text = ""

    if mother.medical_history:
        try:
            parsed = json.loads(mother.medical_history)
            if isinstance(parsed, dict):
                prior_ppd = parsed.get("prior_ppd_diagnosis", "not-sure")
                uploaded = parsed.get("uploaded_files", [])
                med_text = parsed.get("notes") or parsed.get("medical_history") or ""
            else:
                med_text = str(parsed)
        except Exception:
            med_text = mother.medical_history

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

    # Flatten medical_history text
    med_text = ""
    if isinstance(payload.medical_history, str):
        med_text = payload.medical_history
    elif isinstance(payload.medical_history, dict):
        med_text = json.dumps(payload.medical_history)

    history_data = {
        "prior_ppd_diagnosis": payload.prior_ppd_diagnosis or "not-sure",
        "medical_history": med_text,
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


# ============================================================================
# 4. EPDS Screenings
# ============================================================================


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

    return persist_epds_screening_for_mother(db=db, mother=mother, payload=payload)


def persist_epds_screening_for_mother(
    db: Session,
    mother: Mother,
    payload: ScreeningSubmissionSaveRequest,
) -> PatientScreeningSummaryResponse:
    """Shared persistence pipeline for patient-portal and in-clinic EPDS + multimodal screenings."""

    def _normalize_qid(qid: str) -> str:
        s = str(qid).strip().upper()
        if s.startswith("EPDS_Q"):
            num = s[6:]
            if num.isdigit():
                return f"EPDS_Q{int(num):02d}"
            return s
        if s.startswith("EPDS_"):
            num = s[5:]
            if num.isdigit():
                return f"EPDS_Q{int(num):02d}"
        if s.startswith("Q"):
            num = s[1:]
            if num.isdigit():
                return f"EPDS_Q{int(num):02d}"
        if s.isdigit():
            return f"EPDS_Q{int(s):02d}"
        return s

    # Calculate score using canonical questionnaire_service
    submission_req = EPDSSubmissionRequest(
        answers=[
            AnswerSubmissionItem(question_id=_normalize_qid(a.question_id), selected_index=a.selected_index)
            for a in payload.answers
        ]
    )
    scored = questionnaire_service.calculate_score(submission_req)

    # Check for duplicate submission within last 5 seconds
    recent_stmt = (
        select(Screening)
        .where(Screening.mother_id == mother.id)
        .order_by(desc(Screening.created_at))
        .limit(1)
    )
    latest = db.scalar(recent_stmt)
    if latest and latest.created_at:
        created_dt = latest.created_at if latest.created_at.tzinfo else latest.created_at.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - created_dt
        if delta.total_seconds() < 5 and latest.total_score == scored.total_score and latest.instrument != "MULTIMODAL":
            logger.info("Debouncing repeated submission for mother_id=%s", mother.id)
            return PatientScreeningSummaryResponse.model_validate(latest)

    raw_responses_map = {
        _normalize_qid(a.question_id): a.raw_response
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

    # -------------------------------------------------------------------------
    # 2-Stage Clinical Model Integration (Random Forest Model)
    # -------------------------------------------------------------------------
    features_snapshot: Optional[Dict[str, Any]] = None
    clinical_pred_dict: Optional[Dict[str, Any]] = None

    if payload.psychosocial_answers or mother.clinical_profile:
        assembled_feats, is_suitable, diags = assemble_clinical_features(
            clinical_profile=mother.clinical_profile,
            psychosocial_answers=payload.psychosocial_answers,
            fallback_age=mother.age,
        )
        if is_suitable and assembled_feats is not None:
            try:
                cf = ClinicalFeatures.model_validate(assembled_feats)
                feature_dict = cf.to_feature_dict()
                pred_resp = clinical_service.predict(mother_id=str(mother.id), features=feature_dict)
                clinical_pred_dict = pred_resp.get("prediction", {})
                clinical_pred_dict["status"] = "completed"
                clinical_pred_dict["model_utilized"] = pred_resp.get("model_utilized", "random_forest")
                clinical_pred_dict["predicted_label"] = clinical_pred_dict.get("risk_category", "LOW_RISK")
                features_snapshot = feature_dict
            except Exception as exc:
                logger.warning("Clinical prediction failed during screening: %s", exc)
                clinical_pred_dict = {
                    "status": "unavailable",
                    "reason": f"Clinical model execution error: {exc}",
                }
        else:
            clinical_pred_dict = {
                "status": "unavailable",
                "reason": "insufficient_inputs",
                "diagnostics": diags,
            }

    multimodal_dict = {
        "epds_score": scored.total_score,
        "epds_classification": scored.classification,
    }
    if clinical_pred_dict is not None:
        multimodal_dict["clinical_prediction"] = clinical_pred_dict

    mm_res = payload.multimodal_result or {}
    existing_mm_screening: Optional[Screening] = None

    # Check if a MULTIMODAL screening row was already persisted in this session
    if isinstance(mm_res, dict) and mm_res.get("screening_id"):
        try:
            cand = db.get(Screening, uuid.UUID(str(mm_res["screening_id"])))
            if cand and cand.mother_id == mother.id and cand.instrument == "MULTIMODAL":
                existing_mm_screening = cand
        except Exception:
            pass

    if not existing_mm_screening and not mm_res:
        # Check for a recent MULTIMODAL-only screening for this mother to merge
        recent_mm = db.scalar(
            select(Screening)
            .where(Screening.mother_id == mother.id, Screening.instrument == "MULTIMODAL")
            .order_by(desc(Screening.screening_date))
            .limit(1)
        )
        if recent_mm and recent_mm.multimodal_scores:
            mm_res = dict(recent_mm.multimodal_scores)
            existing_mm_screening = recent_mm

    if isinstance(mm_res, dict) and mm_res:
        for k in (
            "audio_score",
            "video_score",
            "text_score",
            "clinical_score",
            "fusion_score",
            "fusion_method",
            "disagreement_flag",
            "disagreement_details",
            "modalities",
            "processed_at",
        ):
            if k in mm_res and mm_res[k] is not None:
                multimodal_dict[k] = mm_res[k]
        if isinstance(mm_res.get("modality_status"), dict):
            for mk, mv in mm_res["modality_status"].items():
                mod_status[mk] = mv

    computed_fusion_status = (
        "completed"
        if (isinstance(mm_res, dict) and mm_res.get("fusion_score") is not None) or payload.video_metadata
        else "not_available"
    )

    if existing_mm_screening is not None:
        existing_mm_screening.instrument = "EPDS+MULTIMODAL"
        existing_mm_screening.total_score = scored.total_score
        existing_mm_screening.risk_classification = risk_class
        existing_mm_screening.q10_safety_alert = scored.safety_alert.triggered
        existing_mm_screening.submitted_answers = submitted_answers_map
        existing_mm_screening.item_scores = item_scores_map
        existing_mm_screening.screening_status = "completed"
        existing_mm_screening.fusion_status = computed_fusion_status
        existing_mm_screening.modality_status = {**(existing_mm_screening.modality_status or {}), **mod_status}
        existing_mm_screening.model_metadata = {**(existing_mm_screening.model_metadata or {}), **model_meta}
        existing_mm_screening.multimodal_scores = {**(existing_mm_screening.multimodal_scores or {}), **multimodal_dict}
        existing_mm_screening.psychosocial_answers = payload.psychosocial_answers
        if features_snapshot:
            existing_mm_screening.clinical_features_snapshot = features_snapshot
        if clinical_pred_dict:
            existing_mm_screening.clinical_model_prediction = clinical_pred_dict
        existing_mm_screening.notes = payload.notes or f"Completed AI Multimodal + EPDS Screening. EPDS Score: {scored.total_score}/30"
        new_screening = existing_mm_screening
    else:
        new_screening = Screening(
            mother_id=mother.id,
            instrument="EPDS",
            total_score=scored.total_score,
            risk_classification=risk_class,
            q10_safety_alert=scored.safety_alert.triggered,
            submitted_answers=submitted_answers_map,
            item_scores=item_scores_map,
            screening_status="completed",
            fusion_status=computed_fusion_status,
            modality_status=mod_status,
            model_metadata=model_meta,
            multimodal_scores=multimodal_dict,
            psychosocial_answers=payload.psychosocial_answers,
            clinical_features_snapshot=features_snapshot,
            clinical_model_prediction=clinical_pred_dict,
            notes=payload.notes or f"Completed EPDS via Patient Assistant. Score: {scored.total_score}/30",
        )
        db.add(new_screening)

    # Generate persistent in-app notification for the newly generated report
    meta = _get_mother_portal_meta(mother)
    notifs = meta.get("notifications", [])
    notifs.insert(
        0,
        {
            "id": f"n-scr-{uuid.uuid4().hex[:6]}",
            "title": "Screening Report Ready",
            "message": f"Your EPDS screening ({risk_class.title()} Risk, {scored.total_score}/30) has been processed and is ready for review.",
            "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
            "read": False,
        },
    )
    meta["notifications"] = notifs[:15]
    mother.notes = json.dumps(meta)

    db.commit()
    db.refresh(new_screening)
    db.refresh(mother)

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
        psychosocial_answers=new_screening.psychosocial_answers,
        clinical_features_snapshot=new_screening.clinical_features_snapshot,
        clinical_model_prediction=new_screening.clinical_model_prediction,
        created_at=new_screening.created_at,
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
            psychosocial_answers=s.psychosocial_answers,
            clinical_features_snapshot=s.clinical_features_snapshot,
            clinical_model_prediction=s.clinical_model_prediction,
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
        psychosocial_answers=screening.psychosocial_answers,
        clinical_features_snapshot=screening.clinical_features_snapshot,
        clinical_model_prediction=screening.clinical_model_prediction,
        created_at=screening.created_at,
    )


# ============================================================================
# 5. Video Recordings
# ============================================================================


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


# ============================================================================
# 6. Reports Overview & Real Report Downloads (PDF & TXT)
# ============================================================================


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
    meta = _get_mother_portal_meta(mother)

    patient_dict = {
        "id": f"P-{str(mother.id)[:8].upper()}",
        "name": first_name,
        "fullName": mother.name,
        "email": mother.email or user.email,
        "avatarInitials": first_name[0].upper() if first_name else "A",
        "postpartumWeek": meta.get("postpartum_week", 4),
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


@router.get(
    "/me/screenings/{screening_id}/report.pdf",
    summary="Generate and download actual clinical PDF report for a screening session",
)
def download_screening_report_pdf(
    screening_id: uuid.UUID,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Generate a clean, professional clinical PDF report using ReportLab and PostgreSQL data."""
    screening = db.get(Screening, screening_id)
    if not screening or screening.mother_id != user.mother_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screening record not found or access denied.",
        )

    mother = db.get(Mother, user.mother_id)
    patient_name = mother.name if mother else user.full_name
    patient_id_label = f"P-{str(user.mother_id)[:8].upper()}"

    q_resp = questionnaire_service.get_questionnaire()
    questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in q_resp.questions]

    from backend.models.care_plan import CarePlan
    from backend.models.clinical_review import ClinicalReview

    latest_review = db.scalar(
        select(ClinicalReview)
        .where(ClinicalReview.mother_id == user.mother_id)
        .order_by(desc(ClinicalReview.reviewed_at), desc(ClinicalReview.created_at))
        .limit(1)
    )
    latest_care_plan = None
    for cp in db.scalars(
        select(CarePlan)
        .where(CarePlan.mother_id == user.mother_id)
        .order_by(desc(CarePlan.updated_at), desc(CarePlan.created_at))
    ):
        if cp.notes and "patient_appointment_request" in cp.notes:
            continue
        latest_care_plan = cp
        break

    multimodal_summary = {
        "clinical_score": screening.clinical_score,
        "text_score": screening.text_score,
        "audio_score": screening.audio_score,
        "video_score": screening.video_score,
        "fusion_score": screening.fusion_score,
        "fusion_status": screening.fusion_status,
        "fusion_method": screening.fusion_method,
        "modality_status": screening.modality_status or {},
        "disagreement_flag": screening.disagreement_flag,
    }
    clinical_review_dict = (
        {
            "clinician_name": latest_review.clinician_name,
            "final_risk_classification": latest_review.final_risk_classification,
            "review_status": latest_review.review_status,
            "clinical_notes": latest_review.clinical_notes,
        }
        if latest_review
        else None
    )
    care_plan_dict = (
        {
            "intervention_type": latest_care_plan.intervention_type,
            "priority": latest_care_plan.priority,
            "scheduled_followup_date": str(latest_care_plan.scheduled_followup_date) if latest_care_plan.scheduled_followup_date else None,
            "notes": latest_care_plan.notes,
        }
        if latest_care_plan
        else None
    )

    pdf_bytes = generate_patient_screening_pdf(
        patient_name=patient_name,
        patient_id=patient_id_label,
        screening_date=screening.screening_date,
        total_score=screening.total_score,
        risk_classification=screening.risk_classification,
        q10_safety_alert=screening.q10_safety_alert,
        submitted_answers=screening.submitted_answers or {},
        item_scores=screening.item_scores or {},
        questions=questions,
        notes=screening.notes,
        multimodal_scores=screening.multimodal_scores,
        clinical_prediction=screening.clinical_model_prediction,
        discordance_flag=bool(getattr(screening, "discordance_flag", False)),
    )

    safe_first = (patient_name.split()[0] if patient_name else "Patient").strip(".,")
    filename = f"AANCHAL_Screening_Report_{safe_first}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/me/screenings/{screening_id}/transcript.txt",
    summary="Generate and download conversation transcript for a screening session",
)
def download_screening_transcript_txt(
    screening_id: uuid.UUID,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Generate structured conversation transcript text from actual PostgreSQL screening responses."""
    screening = db.get(Screening, screening_id)
    if not screening or screening.mother_id != user.mother_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screening record not found or access denied.",
        )

    mother = db.get(Mother, user.mother_id)
    patient_name = mother.name if mother else user.full_name
    formatted_date = screening.screening_date.strftime("%d %B %Y at %I:%M %p UTC")

    lines = [
        "==================================================================",
        "AANCHAL MATERNAL SCREENING SESSION TRANSCRIPT",
        "==================================================================",
        f"Patient Name:    {patient_name}",
        f"Patient ID:      P-{str(user.mother_id)[:8].upper()}",
        f"Session Date:    {formatted_date}",
        f"EPDS Score:      {screening.total_score} / 30 ({screening.risk_classification.upper()} RISK)",
        f"Q10 Safety Flag: {'TRIGGERED (Self-harm ideation reported)' if screening.q10_safety_alert else 'Negative'}",
        "==================================================================",
        "",
        "[AI Screening Companion]: Hello, welcome to AANCHAL. Let's begin your 10-item emotional wellbeing assessment.",
        "",
    ]

    submitted = screening.submitted_answers or {}
    item_sc = screening.item_scores or {}

    q_resp = questionnaire_service.get_questionnaire()
    questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in q_resp.questions]
    q_dict = {q["id"]: q["question"] for q in questions}

    for i in range(1, 11):
        qid_canonical = f"EPDS_Q{i:02d}"
        qid_legacy = f"epds_{i}"
        q_text = q_dict.get(qid_canonical, f"EPDS Question {i}")
        ans_item = submitted.get(qid_canonical) or submitted.get(qid_legacy) or {}
        raw_val = ans_item.get("raw_response") if isinstance(ans_item, dict) else str(ans_item)
        sc = item_sc.get(qid_canonical, item_sc.get(qid_legacy, 0))

        lines.append(f"[Question {i}/10]: {q_text}")
        lines.append(f"[{patient_name}]: {raw_val or f'Selected option (score: {sc})'}")
        lines.append(f"[Score Assigned]: {sc} point(s)")
        lines.append("")

    lines.append("[AI Screening Companion]: Thank you for sharing your responses with me today.")
    lines.append(f"[Assessment Result]: EPDS total score is {screening.total_score}/30. Status: {screening.risk_classification.title()} Risk.")
    lines.append("")
    lines.append("--- End of Confidential Screening Transcript ---")

    transcript_content = "\n".join(lines).encode("utf-8")
    filename = f"AANCHAL_Conversation_Transcript_{screening.screening_date.strftime('%d%b%Y')}.txt"

    return Response(
        content=transcript_content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/me/reports/latest/pdf",
    summary="Download PDF report for authenticated patient's most recent screening",
)
def download_latest_screening_pdf(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Retrieve the patient's latest screening and generate its PDF report."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No enrolled patient record found.")

    latest = db.scalar(
        select(Screening)
        .where(Screening.mother_id == user.mother_id)
        .order_by(desc(Screening.screening_date))
        .limit(1)
    )
    if not latest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No screening sessions completed yet.")

    return download_screening_report_pdf(latest.id, user, db)


@router.get(
    "/me/reports/latest/transcript",
    summary="Download text transcript for authenticated patient's most recent screening",
)
def download_latest_screening_transcript(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Retrieve the patient's latest screening and generate its transcript."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No enrolled patient record found.")

    latest = db.scalar(
        select(Screening)
        .where(Screening.mother_id == user.mother_id)
        .order_by(desc(Screening.screening_date))
        .limit(1)
    )
    if not latest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No screening sessions completed yet.")

    return download_screening_transcript_txt(latest.id, user, db)


# ============================================================================
# 7. Appointments & Doctor Information
# ============================================================================


@router.get(
    "/me/appointments",
    response_model=List[AppointmentResponse],
    summary="Get patient appointments and consultations",
)
def get_patient_appointments(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> List[AppointmentResponse]:
    """Retrieve appointments from PostgreSQL care_plans table and patient portal state."""
    if not user.mother_id:
        return []

    mother = db.get(Mother, user.mother_id)
    if not mother:
        return []

    results: List[AppointmentResponse] = []

    # 1. Query care_plans table in PostgreSQL
    stmt = (
        select(CarePlan)
        .where(CarePlan.mother_id == user.mother_id)
        .order_by(desc(CarePlan.created_at))
    )
    plans = db.scalars(stmt).all()
    for cp in plans:
        date_str = cp.scheduled_followup_date.strftime("%d %b %Y") if cp.scheduled_followup_date else cp.created_at.strftime("%d %b %Y")
        
        # Parse rich JSON metadata if present
        meta_dict: Dict[str, Any] = {}
        if cp.notes and cp.notes.strip().startswith("{"):
            try:
                meta_dict = json.loads(cp.notes)
            except Exception:
                meta_dict = {}

        raw_status = (meta_dict.get("status") or cp.status or "pending").lower()
        if raw_status in ("pending", "requested"):
            display_status = "Pending Confirmation"
        elif raw_status == "confirmed":
            display_status = "Confirmed"
        elif raw_status == "rescheduled":
            display_status = "New Time Proposed"
        elif raw_status in ("cancelled", "rejected"):
            display_status = "Declined"
        elif raw_status == "completed":
            display_status = "Completed"
        else:
            display_status = raw_status.title()

        results.append(
            AppointmentResponse(
                id=str(cp.id),
                doctorName=meta_dict.get("assigned_doctor_name") or meta_dict.get("doctor_name") or cp.assigned_clinician_id or "Assigned Specialist",
                role=meta_dict.get("doctor_role") or "Perinatal Psychiatry Lead",
                date=meta_dict.get("confirmed_date") or meta_dict.get("requested_date") or date_str,
                time=meta_dict.get("confirmed_time") or meta_dict.get("requested_time") or "11:00 AM",
                status=display_status,
                type=meta_dict.get("consultation_type") or ("Telehealth Video" if "video" in (cp.intervention_type or "").lower() else (cp.intervention_type or "Telehealth Video")),
                clinic=meta_dict.get("hospital_name") or cp.referral_destination or "Miora Maternal Care Unit",
                summary=meta_dict.get("reason") or (cp.notes if not meta_dict else None),
                hospitalId=meta_dict.get("hospital_id"),
                hospitalName=meta_dict.get("hospital_name"),
                hospitalLocation=meta_dict.get("hospital_location"),
                proposedDate=meta_dict.get("proposed_date"),
                proposedTime=meta_dict.get("proposed_time"),
                assignedDoctorId=meta_dict.get("assigned_doctor_id"),
                assignedDoctorName=meta_dict.get("assigned_doctor_name"),
                responseNote=meta_dict.get("hospital_notes"),
            )
        )

    # 2. Check metadata appointments list
    meta = _get_mother_portal_meta(mother)
    meta_appts = meta.get("appointments", [])
    for a in meta_appts:
        if not any(r.id == a.get("id") for r in results):
            results.append(
                AppointmentResponse(
                    id=a.get("id", f"c-{uuid.uuid4().hex[:6]}"),
                    doctorName=a.get("doctorName", "Assigned Specialist"),
                    role=a.get("role", "Perinatal Psychiatry Lead"),
                    date=a.get("date", "25 Nov 2026"),
                    time=a.get("time", "11:00 AM"),
                    status=a.get("status", "Pending Confirmation"),
                    type=a.get("type", "Telehealth Video"),
                    clinic=a.get("clinic", "Miora Maternal Care Unit"),
                    summary=a.get("summary"),
                    hospitalId=a.get("hospitalId"),
                    hospitalName=a.get("hospitalName"),
                    hospitalLocation=a.get("hospitalLocation"),
                )
            )

    # If new account with no appointments yet, provide the initial baseline consultation
    if not results:
        results = [
            AppointmentResponse(
                id="c-initial-101",
                doctorName="Dr. Priya Mehta",
                role="Perinatal Psychiatry",
                date="20 Nov 2026",
                time="11:00 AM",
                status="Confirmed",
                type="Telehealth Video",
                clinic="Apollo Women's Hospital",
                summary="Initial post-registration baseline assessment with perinatal mental health specialist.",
                hospitalId="HOSP-001",
                hospitalName="Apollo Women's Hospital",
            )
        ]

    return results


@router.post(
    "/me/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new doctor consultation request",
)
def book_patient_appointment(
    payload: AppointmentBookRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    """Submit a consultation request awaiting hospital confirmation, persisted in care_plans table."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    # Parse date
    appt_date: Optional[date] = None
    try:
        appt_date = date.fromisoformat(payload.date.strip())
    except Exception:
        appt_date = date.today()

    target_hospital = payload.hospital_name or payload.clinic or "AANCHAL Partner Hospital"
    target_hospital_id = payload.hospital_id or "HOSP-001"

    # Build rich appointment request metadata
    notes_payload = {
        "request_type": "patient_appointment_request",
        "hospital_id": target_hospital_id,
        "hospital_name": target_hospital,
        "hospital_location": payload.hospital_location or "Bangalore, Karnataka",
        "doctor_id": payload.doctor_id or "DR-001",
        "doctor_name": payload.doctor_name,
        "doctor_role": payload.role,
        "requested_date": payload.date,
        "requested_time": payload.time,
        "consultation_type": payload.type,
        "patient_name": mother.name,
        "patient_phone": payload.phone or mother.phone or "+91-98765-43210",
        "reason": payload.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # 1. Create row in PostgreSQL care_plans table
    new_care_plan = CarePlan(
        mother_id=mother.id,
        priority="routine",
        intervention_type=payload.type,
        referral_destination=f"{target_hospital} [{target_hospital_id}]",
        scheduled_followup_date=appt_date,
        assigned_clinician_id=payload.doctor_name,
        status="pending",
        notes=json.dumps(notes_payload),
    )
    db.add(new_care_plan)
    db.flush()

    # 1b. Create persistent notifications for Doctor and Hospital (deduplicated)
    from backend.services.notification_service import create_notification_dedup
    formatted_date = appt_date.strftime("%d %b %Y") if appt_date else payload.date
    target_doctor_id = payload.doctor_id or "DR-001"

    create_notification_dedup(
        db,
        recipient_id=target_doctor_id,
        recipient_role="doctor",
        notification_type="consultation_booked",
        title="New Consultation Booked",
        message=f"New consultation booked. {mother.name} has scheduled an appointment with you.",
        related_appointment_id=str(new_care_plan.id),
        metadata={
            "patientName": mother.name,
            "patientId": f"P-{str(mother.id)[:8].upper()}",
            "date": formatted_date,
            "time": payload.time,
            "hospitalName": target_hospital,
            "appointmentId": str(new_care_plan.id),
        },
    )
    create_notification_dedup(
        db,
        recipient_id=target_hospital_id,
        recipient_role="hospital",
        notification_type="consultation_booked",
        title="New Patient Consultation",
        message=f"New patient consultation booked with {payload.doctor_name}. Patient: {mother.name}.",
        related_appointment_id=str(new_care_plan.id),
        metadata={
            "patientName": mother.name,
            "doctorName": payload.doctor_name,
            "date": formatted_date,
            "time": payload.time,
            "status": "Pending Confirmation",
            "appointmentId": str(new_care_plan.id),
        },
    )

    # 2. Add notification for consultation booking
    meta = _get_mother_portal_meta(mother)
    notifs = meta.get("notifications", [])
    notifs.insert(
        0,
        {
            "id": f"n-appt-{uuid.uuid4().hex[:6]}",
            "title": "Appointment Request Sent",
            "message": f"Your appointment request with {payload.doctor_name} at {target_hospital} has been submitted and is awaiting hospital confirmation.",
            "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
            "read": False,
        },
    )
    meta["notifications"] = notifs[:15]

    # 3. Add to metadata appointments list
    meta_appts = meta.get("appointments", [])
    formatted_date = appt_date.strftime("%d %b %Y") if appt_date else payload.date
    new_appt_dict = {
        "id": str(new_care_plan.id),
        "doctorName": payload.doctor_name,
        "role": payload.role,
        "date": formatted_date,
        "time": payload.time,
        "status": "Pending Confirmation",
        "type": payload.type,
        "clinic": target_hospital,
        "summary": payload.reason,
        "hospitalId": target_hospital_id,
        "hospitalName": target_hospital,
        "hospitalLocation": payload.hospital_location,
    }
    meta_appts.insert(0, new_appt_dict)
    meta["appointments"] = meta_appts

    mother.notes = json.dumps(meta)

    db.commit()
    db.refresh(new_care_plan)
    db.refresh(mother)

    logger.info("Created consultation request in database: id=%s for mother_id=%s, hospital=%s", new_care_plan.id, mother.id, target_hospital_id)

    return AppointmentResponse(
        id=str(new_care_plan.id),
        doctorName=payload.doctor_name,
        role=payload.role,
        date=formatted_date,
        time=payload.time,
        status="Pending Confirmation",
        type=payload.type,
        clinic=target_hospital,
        summary=payload.reason,
        hospitalId=target_hospital_id,
        hospitalName=target_hospital,
        hospitalLocation=payload.hospital_location,
    )


# ============================================================================
# 8. Notifications
# ============================================================================


@router.get(
    "/me/notifications",
    response_model=List[NotificationItemResponse],
    summary="Get patient notifications",
)
def get_patient_notifications(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> List[NotificationItemResponse]:
    """Retrieve persisted notifications from PostgreSQL."""
    if not user.mother_id:
        return []

    mother = db.get(Mother, user.mother_id)
    if not mother:
        return []

    meta = _get_mother_portal_meta(mother)
    notifs = meta.get("notifications", [])
    if not notifs:
        notifs = [
            {
                "id": "n-welcome",
                "title": "Welcome to MIORA",
                "message": "Your maternal emotional wellness dashboard is active. You can start screening or speak to the AI assistant.",
                "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
                "read": False,
            }
        ]
        meta["notifications"] = notifs
        mother.notes = json.dumps(meta)
        db.commit()

    return [
        NotificationItemResponse(
            id=n.get("id", f"n-{i}"),
            title=n.get("title", "Notification"),
            message=n.get("message", ""),
            date=n.get("date", ""),
            read=bool(n.get("read", False)),
        )
        for i, n in enumerate(notifs)
    ]


@router.put(
    "/me/notifications/{notification_id}/read",
    response_model=Dict[str, bool],
    summary="Mark specific notification as read",
)
def mark_notification_as_read(
    notification_id: str,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, bool]:
    """Mark a notification read and persist to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    meta = _get_mother_portal_meta(mother)
    notifs = meta.get("notifications", [])
    updated = False
    for n in notifs:
        if n.get("id") == notification_id:
            n["read"] = True
            updated = True
            break

    if updated:
        _save_mother_portal_meta(mother, meta, db)

    return {"success": True}


@router.put(
    "/me/notifications/read-all",
    response_model=Dict[str, bool],
    summary="Mark all notifications as read",
)
def mark_all_notifications_as_read(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, bool]:
    """Mark all notifications read and persist to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    meta = _get_mother_portal_meta(mother)
    notifs = meta.get("notifications", [])
    for n in notifs:
        n["read"] = True

    _save_mother_portal_meta(mother, meta, db)
    return {"success": True}


# ============================================================================
# 9. Care Plan & Restorative Tasks
# ============================================================================


@router.get(
    "/me/care-plan",
    summary="Get patient care plan and restorative tasks",
)
def get_patient_care_plan(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve care plan structure and persistent restorative task completion from PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    meta = _get_mother_portal_meta(mother)
    tasks = meta.get("care_tasks")
    if not tasks:
        tasks = DEFAULT_CARE_TASKS
        meta["care_tasks"] = tasks
        _save_mother_portal_meta(mother, meta, db)

    from backend.models.care_plan import CarePlan
    from backend.models.clinical_review import ClinicalReview

    latest_plan = None
    for cp in db.scalars(
        select(CarePlan)
        .where(CarePlan.mother_id == user.mother_id)
        .order_by(desc(CarePlan.updated_at), desc(CarePlan.created_at))
    ):
        if cp.notes and "patient_appointment_request" in cp.notes:
            continue
        latest_plan = cp
        break

    latest_review = db.scalars(
        select(ClinicalReview)
        .where(ClinicalReview.mother_id == user.mother_id)
        .order_by(desc(ClinicalReview.reviewed_at), desc(ClinicalReview.created_at))
    ).first()

    clinician_plan = (
        {
            "id": str(latest_plan.id),
            "priority": latest_plan.priority,
            "intervention_type": latest_plan.intervention_type,
            "referral_destination": latest_plan.referral_destination,
            "scheduled_followup_date": (
                latest_plan.scheduled_followup_date.isoformat()
                if latest_plan.scheduled_followup_date
                else None
            ),
            "status": latest_plan.status,
            "notes": latest_plan.notes,
            "updated_at": latest_plan.updated_at.isoformat() if latest_plan.updated_at else None,
        }
        if latest_plan
        else None
    )

    clinician_review = (
        {
            "id": str(latest_review.id),
            "clinician_name": latest_review.clinician_name,
            "review_status": latest_review.review_status,
            "final_risk_classification": latest_review.final_risk_classification,
            "clinical_notes": latest_review.clinical_notes,
            "required_immediate_escalation": latest_review.required_immediate_escalation,
            "reviewed_at": latest_review.reviewed_at.isoformat() if latest_review.reviewed_at else None,
        }
        if latest_review
        else None
    )

    return {
        "duration": "2 Weeks",
        "totalDays": 14,
        "currentDay": 1,
        "focusAreas": ["Mood", "Sleep", "Stress", "Support"],
        "tasks": tasks,
        "clinicianPlan": clinician_plan,
        "clinicianReview": clinician_review,
    }


@router.put(
    "/me/care-plan/tasks/{task_id}",
    summary="Toggle care task completion status and persist to PostgreSQL",
)
def toggle_care_plan_task(
    task_id: str,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Toggle completion flag for a restorative care task and persist to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    meta = _get_mother_portal_meta(mother)
    tasks = meta.get("care_tasks") or list(DEFAULT_CARE_TASKS)
    found = False

    for t in tasks:
        if t.get("id") == task_id:
            t["completed"] = not bool(t.get("completed", False))
            found = True
            break

    if not found:
        tasks.append({"id": task_id, "title": task_id.replace("-", " ").title(), "completed": True})

    meta["care_tasks"] = tasks
    _save_mother_portal_meta(mother, meta, db)

    return {
        "success": True,
        "task_id": task_id,
        "tasks": tasks,
    }


# ============================================================================
# 10. Settings & Preferences
# ============================================================================


@router.get(
    "/me/settings",
    response_model=PatientSettingsResponse,
    summary="Get patient settings & device preferences",
)
@router.get(
    "/me/preferences",
    response_model=PatientSettingsResponse,
    summary="Get patient settings & device preferences",
)
def get_patient_settings(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientSettingsResponse:
    """Retrieve persisted account preferences and permissions from PostgreSQL."""
    if not user.mother_id:
        return PatientSettingsResponse()

    mother = db.get(Mother, user.mother_id)
    if not mother:
        return PatientSettingsResponse()

    meta = _get_mother_portal_meta(mother)
    prefs = meta.get("preferences", {})

    return PatientSettingsResponse(
        camera_permission=prefs.get("camera_permission", "prompt"),
        mic_permission=prefs.get("mic_permission", "prompt"),
        email_notifs=prefs.get("email_notifs", True),
        consultation_alerts=prefs.get("consultation_alerts", True),
        confidential_mode=prefs.get("confidential_mode", True),
        language=prefs.get("language", "en"),
        voice_locale=prefs.get("voice_locale", "en-IN"),
    )


@router.put(
    "/me/settings",
    response_model=PatientSettingsResponse,
    summary="Update patient settings & device preferences",
)
@router.put(
    "/me/preferences",
    response_model=PatientSettingsResponse,
    summary="Update patient settings & device preferences",
)
def update_patient_settings(
    payload: PatientSettingsRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientSettingsResponse:
    """Persist updated device permissions, notification flags, and language to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    meta = _get_mother_portal_meta(mother)
    prefs = meta.get("preferences", {})

    if payload.camera_permission is not None:
        prefs["camera_permission"] = payload.camera_permission
    if payload.mic_permission is not None:
        prefs["mic_permission"] = payload.mic_permission
    if payload.email_notifs is not None:
        prefs["email_notifs"] = payload.email_notifs
    if payload.consultation_alerts is not None:
        prefs["consultation_alerts"] = payload.consultation_alerts
    if payload.confidential_mode is not None:
        prefs["confidential_mode"] = payload.confidential_mode
    if payload.language is not None:
        prefs["language"] = payload.language
    if payload.voice_locale is not None:
        prefs["voice_locale"] = payload.voice_locale

    meta["preferences"] = prefs
    _save_mother_portal_meta(mother, meta, db)

    return PatientSettingsResponse(
        camera_permission=prefs.get("camera_permission", "prompt"),
        mic_permission=prefs.get("mic_permission", "prompt"),
        email_notifs=prefs.get("email_notifs", True),
        consultation_alerts=prefs.get("consultation_alerts", True),
        confidential_mode=prefs.get("confidential_mode", True),
        language=prefs.get("language", "en"),
        voice_locale=prefs.get("voice_locale", "en-IN"),
    )


# ============================================================================
# 11. AI Assistant Conversation & Mood Persistence
# ============================================================================


@router.get(
    "/me/ai-conversations",
    summary="Get saved AI assistant conversation turns and mood history",
)
def get_patient_ai_conversations(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve persisted AI conversational chat turns and last recorded mood from PostgreSQL."""
    if not user.mother_id:
        return {"messages": [], "current_mood": None}

    mother = db.get(Mother, user.mother_id)
    if not mother:
        return {"messages": [], "current_mood": None}

    meta = _get_mother_portal_meta(mother)
    return {
        "messages": meta.get("ai_conversations", []),
        "current_mood": meta.get("current_mood"),
    }


@router.post(
    "/me/ai-conversations",
    summary="Save AI assistant conversation turns and mood to PostgreSQL",
)
def save_patient_ai_conversations(
    payload: AiConversationSaveRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Persist conversation messages and mood state to PostgreSQL."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not linked.")

    mother = db.get(Mother, user.mother_id)
    if not mother:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother entity not found.")

    meta = _get_mother_portal_meta(mother)
    # Store up to last 50 conversational messages
    meta["ai_conversations"] = [m.model_dump() for m in payload.messages[-50:]]
    if payload.current_mood:
        meta["current_mood"] = payload.current_mood

    _save_mother_portal_meta(mother, meta, db)

    return {
        "success": True,
        "message_count": len(meta["ai_conversations"]),
        "current_mood": meta.get("current_mood"),
    }


@router.get(
    "/me/consultation-reports",
    response_model=List[PatientConsultationReportResponse],
    summary="Get patient-friendly simplified consultation reports",
)
def get_patient_consultation_reports(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> List[PatientConsultationReportResponse]:
    """Retrieve simplified, patient-friendly reports approved by the treating doctor.

    STRICT PRIVACY: Internal hospital administrative notes and unapproved drafts
    are strictly excluded from the patient portal response.
    """
    if not user.mother_id:
        return []

    # Query reports for this patient that are final and approved
    reports = db.scalars(
        select(ConsultationReport)
        .where(
            ConsultationReport.mother_id == user.mother_id,
            ConsultationReport.status == "final",
            ConsultationReport.patient_approved == True,
        )
        .order_by(desc(ConsultationReport.created_at))
    ).all()

    results: List[PatientConsultationReportResponse] = []
    for r in reports:
        results.append(
            PatientConsultationReportResponse(
                id=str(r.id),
                report_code=r.report_code,
                doctor_name=r.doctor_name,
                doctor_specialization=r.doctor_specialization,
                hospital_name=r.hospital_name,
                consultation_date=r.consultation_date,
                summary=r.patient_friendly_summary or r.clinical_assessment,
                medications_instructions=r.patient_friendly_medications or r.medications,
                recommendations=r.patient_friendly_recommendations or r.recommendations,
                followup_instructions=r.patient_friendly_followup or r.followup_instructions,
                next_followup_date=r.next_followup_date,
                submitted_at=r.submitted_at.strftime("%d %b %Y") if r.submitted_at else None,
            )
        )
    return results


@router.get(
    "/me/consultation-reports/{report_id}",
    response_model=PatientConsultationReportResponse,
    summary="Get single patient-friendly consultation report",
)
def get_patient_consultation_report_detail(
    report_id: str,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientConsultationReportResponse:
    """Retrieve a single simplified consultation report."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not linked.")

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

    # Privacy enforcement: must belong to the patient and be approved
    if report.mother_id != user.mother_id or report.status != "final" or not report.patient_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are only authorized to view your own approved consultation reports.",
        )

    return PatientConsultationReportResponse(
        id=str(report.id),
        report_code=report.report_code,
        doctor_name=report.doctor_name,
        doctor_specialization=report.doctor_specialization,
        hospital_name=report.hospital_name,
        consultation_date=report.consultation_date,
        summary=report.patient_friendly_summary or report.clinical_assessment,
        medications_instructions=report.patient_friendly_medications or report.medications,
        recommendations=report.patient_friendly_recommendations or report.recommendations,
        followup_instructions=report.patient_friendly_followup or report.followup_instructions,
        next_followup_date=report.next_followup_date,
        submitted_at=report.submitted_at.strftime("%d %b %Y") if report.submitted_at else None,
    )


@router.get(
    "/me/consultation-reports/{report_id}/download",
    summary="Download patient-friendly consultation report",
)
def download_patient_consultation_report(
    report_id: str,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Stream a downloadable summary of an approved doctor consultation report."""
    if not user.mother_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mother record not linked.")

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

    if report.mother_id != user.mother_id or report.status != "final" or not report.patient_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are only authorized to download your own approved consultation reports.",
        )

    lines = [
        "==================================================================",
        "AANCHAL — DOCTOR CONSULTATION REPORT (PATIENT SUMMARY)",
        "==================================================================",
        f"Report Code:     {report.report_code}",
        f"Patient Name:    {report.patient_name}",
        f"Doctor:          {report.doctor_name} ({report.doctor_specialization or 'Specialist'})",
        f"Hospital:        {report.hospital_name}",
        f"Consult Date:    {report.consultation_date}",
        "==================================================================",
        "",
        "CONSULTATION SUMMARY:",
        report.patient_friendly_summary or report.clinical_assessment or "N/A",
        "",
        "MEDICATIONS & CARE INSTRUCTIONS:",
        report.patient_friendly_medications or report.medications or "No medications prescribed.",
        "",
        "RECOMMENDATIONS:",
        report.patient_friendly_recommendations or report.recommendations or "N/A",
        "",
        "FOLLOW-UP PLAN:",
        report.patient_friendly_followup or report.followup_instructions or "N/A",
        f"Next Follow-up Date: {report.next_followup_date or 'As scheduled'}",
        "",
        "--- End of Confidential Consultation Summary ---",
    ]
    content = "\n".join(lines).encode("utf-8")
    filename = f"AANCHAL_Consultation_{report.report_code}.txt"
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

