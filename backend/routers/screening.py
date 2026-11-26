"""FastAPI router for Central Multimodal Screening Orchestration.

Exposes:
- POST /api/screenings/analyze: Multipart/form-data endpoint orchestrating clinical numerical,
  narrative text screening, and acoustic/visual screening inputs without fabricating predictions.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Union
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.mother import Mother
from backend.models.screening import Screening
from backend.models.user import User
from backend.schemas.screening import (
    ScreeningAnalysisResponse,
    ThreeModalityAnalyzeResponse,
)
from backend.services.auth_service import get_current_user
from backend.services.screening_service import (
    ScreeningOrchestrationService,
    get_screening_service,
)
from backend.services.three_modality_service import (
    ThreeModalityInferenceService,
    three_modality_service,
)
from backend.services.media_feature_extractor import (
    extract_audio_features_from_bytes,
    extract_video_features_from_bytes,
)

router = APIRouter(
    prefix="/api/screenings",
    tags=["Central Screening Orchestration"],
)


@router.post(
    "/analyze",
    response_model=ScreeningAnalysisResponse,
    summary="Analyze multimodal screening inputs for postpartum depression risk",
    description=(
        "Central multimodal analysis orchestrator accepting multipart/form-data. "
        "Coordinates validated 46-feature clinical numerical ML screening, narrative "
        "text risk classification, and safely reports unavailable statuses for "
        "unimplemented audio and video models. Preserves partial completion states when "
        "individual modalities fail."
    ),
)
async def analyze_screening(
    motherId: Optional[str] = Form(None, description="Registered mother / participant identifier"),
    mother_id: Optional[str] = Form(None, description="Alternative snake_case mother identifier"),
    modalities: str = Form(
        ...,
        description='JSON stringified modalities, e.g. \'{"clinical": true, "text": true}\' or \'["clinical", "text"]\'',
    ),
    consentConfirmed: Optional[str] = Form(
        None,
        description="Boolean string ('true'/'false') confirming maternal consent",
    ),
    consent_confirmed: Optional[str] = Form(
        None,
        description="Alternative snake_case consent flag",
    ),
    eligibilityConfirmed: Optional[str] = Form(
        None,
        description="Boolean string ('true'/'false') confirming self-declared postpartum eligibility",
    ),
    eligibility_confirmed: Optional[str] = Form(
        None,
        description="Alternative snake_case eligibility flag",
    ),
    clinical_features: Optional[str] = Form(
        None,
        description="JSON string containing the complete 46 clinical survey predictors (required if clinical=true)",
    ),
    audio_features: Optional[str] = Form(
        None,
        description="Optional JSON string of 7 acoustic vocal biomarker features for audio screening",
    ),
    files_text: Optional[UploadFile] = File(
        None,
        description="Optional narrative text file (.txt, .json) for biomedical entity extraction",
    ),
    files_voice: Optional[UploadFile] = File(
        None,
        description="Optional acoustic audio file (.wav, .mp3)",
    ),
    files_video: Optional[UploadFile] = File(
        None,
        description="Optional video recording file (.mp4)",
    ),
    video_features: Optional[str] = Form(
        None,
        description="Optional JSON string of 220 facial/gaze dynamics features for video screening",
    ),
    text_content: Optional[str] = Form(
        None,
        description="Alternative direct narrative text string for text screening",
    ),
    epds_answers: Optional[str] = Form(
        None,
        description="Optional JSON string of EPDS answers for standalone Question 10 safety alert check",
    ),
    service: ScreeningOrchestrationService = Depends(get_screening_service),
) -> ScreeningAnalysisResponse:
    """Orchestrate central multimodal screening analysis."""
    effective_mother_id = motherId if motherId is not None else mother_id
    effective_consent = consentConfirmed if consentConfirmed is not None else consent_confirmed
    effective_eligibility = eligibilityConfirmed if eligibilityConfirmed is not None else eligibility_confirmed

    files_text_bytes: Optional[bytes] = None
    if files_text is not None:
        files_text_bytes = await files_text.read()

    files_voice_bytes: Optional[bytes] = None
    if files_voice is not None:
        files_voice_bytes = await files_voice.read()

    files_video_bytes: Optional[bytes] = None
    if files_video is not None:
        files_video_bytes = await files_video.read()

    return await service.orchestrate_screening(
        mother_id=effective_mother_id,
        consent_confirmed=effective_consent or False,
        modalities_raw=modalities,
        clinical_features_raw=clinical_features,
        audio_features_raw=audio_features,
        files_text_bytes=files_text_bytes,
        text_content=text_content,
        files_voice_bytes=files_voice_bytes,
        files_video_bytes=files_video_bytes,
        video_features_raw=video_features,
        epds_answers=epds_answers,
        eligibility_confirmed=effective_eligibility,
    )


@router.get(
    "/multimodal/status",
    summary="Get readiness and operational status of all multimodal model pipelines",
    description="Returns availability, checkpoint provenance, and descriptions for Text, Audio, Video, and Fusion pipelines.",
)
async def get_multimodal_pipeline_status(
    service: ThreeModalityInferenceService = Depends(lambda: three_modality_service),
) -> Dict[str, Any]:
    """Retrieve operational status and readiness of all Stage 1 multimodal models."""
    return service.get_pipeline_status()


@router.post(
    "/multimodal/analyze",
    response_model=ThreeModalityAnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute Stage 1 Three-Modality Multimodal Screening Inference",
    description=(
        "Primary experimental multimodal inference endpoint connecting trained Text, "
        "Audio, and Video models via a stacking meta-classifier. Produces an Uncalibrated "
        "Multimodal Research Risk Score and Cross-Modal Algorithmic Disagreement Flag. "
        "Strictly excludes clinical numerical covariates and EPDS survey responses."
    ),
)
async def analyze_multimodal_screening(
    motherId: Optional[str] = Form(None, description="Registered mother UUID"),
    mother_id: Optional[str] = Form(None, description="Alternative snake_case mother identifier"),
    consentConfirmed: Optional[str] = Form(None, description="Consent confirmation ('true'/'false')"),
    consent_confirmed: Optional[str] = Form(None, description="Alternative snake_case consent flag"),
    text_content: Optional[str] = Form(None, description="Maternal narrative text self-report"),
    files_text: Optional[UploadFile] = File(None, description="Optional text document (.txt, .json)"),
    audio_features: Optional[str] = Form(
        None,
        description="JSON string containing 7 physiological acoustic features: f0_mean_hz, f0_std_hz, "
                    "jitter_local_percent, shimmer_local_percent, hnr_db, speech_rate_syllables_per_sec, pause_ratio",
    ),
    files_voice: Optional[UploadFile] = File(None, description="Optional raw audio recording (.wav, .mp3)"),
    video_features: Optional[str] = Form(
        None,
        description="JSON string containing 220 pooled summary statistics over facial/gaze dynamics",
    ),
    files_video: Optional[UploadFile] = File(None, description="Optional raw video recording (.mp4, .webm)"),
    clinical_features: Optional[str] = Form(
        None,
        description="Optional JSON string containing 46 clinical survey features for four-modality late fusion",
    ),
    epds_answers: Optional[str] = Form(
        None,
        description="Optional JSON string of EPDS answers for standalone Question 10 safety alert check",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ThreeModalityInferenceService = Depends(lambda: three_modality_service),
) -> ThreeModalityAnalyzeResponse:
    """Execute authenticated Stage 1 Three-Modality inference and persist results to PostgreSQL."""
    # 1. Resolve participant ID & enforce Authorization
    requested_id = motherId if motherId is not None else mother_id

    if current_user.role == "patient":
        if not current_user.mother_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patient account is not linked to an enrolled mother profile.",
            )
        patient_mother_id = str(current_user.mother_id)
        expected_p_code = f"P-{patient_mother_id[:8].upper()}"
        if requested_id and requested_id.strip() not in (patient_mother_id, expected_p_code, str(current_user.id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authorization denied: Patients may only submit screenings for their own profile.",
            )
        effective_mother_id = patient_mother_id
    elif current_user.role in ("doctor", "clinician", "admin"):
        effective_mother_id = requested_id or str(uuid.uuid4())
    elif current_user.role == "family":
        effective_mother_id = requested_id or (str(current_user.mother_id) if current_user.mother_id else str(uuid.uuid4()))
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' is not authorized to execute screening inference.",
        )

    # 2. Validate Maternal Consent
    raw_consent = consentConfirmed if consentConfirmed is not None else consent_confirmed
    is_consented = (
        raw_consent is True
        or (isinstance(raw_consent, str) and raw_consent.strip().lower() in ("true", "1", "yes"))
    )
    if not is_consented:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maternal consent must be confirmed before submitting screening inputs for analysis.",
        )

    # 3. Extract and Validate Modality Inputs
    # Text input
    resolved_text: Optional[str] = None
    if files_text is not None:
        try:
            content_bytes = await files_text.read()
            if content_bytes:
                resolved_text = content_bytes.decode("utf-8", errors="replace").strip()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to read narrative text file: {exc}",
            ) from exc
    elif text_content is not None and text_content.strip():
        resolved_text = text_content.strip()

    # Audio input
    resolved_audio: Optional[Union[Dict[str, float], List[float]]] = None
    if audio_features is not None and audio_features.strip():
        try:
            parsed_audio = json.loads(audio_features)
            if not isinstance(parsed_audio, (dict, list)):
                raise ValueError("audio_features must be a JSON object or array")
            resolved_audio = parsed_audio
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid audio_features JSON payload: {exc}",
            ) from exc

    # Video input
    resolved_video: Optional[List[float]] = None
    if video_features is not None and video_features.strip():
        try:
            parsed_video = json.loads(video_features)
            if not isinstance(parsed_video, list):
                raise ValueError("video_features must be a JSON list of 220 numeric features")
            resolved_video = parsed_video
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid video_features JSON payload: {exc}",
            ) from exc

    # Clinical input
    resolved_clinical: Optional[Dict[str, Any]] = None
    if clinical_features is not None and clinical_features.strip():
        try:
            parsed_clinical = json.loads(clinical_features)
            if not isinstance(parsed_clinical, dict):
                raise ValueError("clinical_features must be a JSON object mapping feature names to values")
            resolved_clinical = parsed_clinical
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid clinical_features JSON payload: {exc}",
            ) from exc

    # Check for empty request
    has_any_input = (
        resolved_clinical is not None
        or resolved_text is not None
        or resolved_audio is not None
        or resolved_video is not None
        or files_voice is not None
        or files_video is not None
    )
    if not has_any_input:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one screening modality (clinical, text, audio, or video) must be provided for analysis.",
        )

    # Extract acoustic/visual features from uploaded raw recordings if JSON vectors were not supplied
    if files_voice is not None and resolved_audio is None:
        try:
            voice_bytes = await files_voice.read()
            resolved_audio = extract_audio_features_from_bytes(voice_bytes)
        except Exception:
            resolved_audio = None

    if files_video is not None:
        try:
            video_bytes = await files_video.read()
            if resolved_video is None:
                resolved_video = extract_video_features_from_bytes(
                    video_bytes, files_video.filename or "recording.webm"
                )
            if resolved_audio is None and files_voice is None:
                resolved_audio = extract_audio_features_from_bytes(video_bytes)
        except Exception:
            pass

    # 4. Execute Service Inference
    inference_result = service.analyze(
        text=resolved_text,
        audio_features=resolved_audio,
        video_features=resolved_video,
        clinical_features=resolved_clinical,
        mother_id=effective_mother_id,
    )

    # Annotate if raw recordings were uploaded yet feature extraction failed
    if files_voice is not None and resolved_audio is None:
        mod_audio = inference_result["modalities"].get("audio", {})
        mod_audio["status"] = "unavailable"
        mod_audio["details"] = {
            "raw_recording_received": True,
            "filename": files_voice.filename,
        }
        inference_result["modality_status"]["audio"] = "unavailable"

    if files_video is not None and resolved_video is None:
        mod_video = inference_result["modalities"].get("video", {})
        mod_video["status"] = "unavailable"
        mod_video["details"] = {
            "raw_recording_received": True,
            "filename": files_video.filename,
        }
        inference_result["modality_status"]["video"] = "unavailable"

    # Standalone EPDS Question 10 Safety Check (Deterministic rule outside ML probability fusion)
    q10_safety_alert: Optional[Dict[str, Any]] = None
    if epds_answers is not None and epds_answers.strip():
        try:
            answers_list = json.loads(epds_answers) if isinstance(epds_answers, str) else epds_answers
            if isinstance(answers_list, list):
                q10_val = 0
                for a in answers_list:
                    if isinstance(a, dict) and a.get("question_id") == "EPDS_Q10":
                        q10_val = int(a.get("selected_index", a.get("score", 0)))
                q10_safety_alert = {
                    "triggered": bool(q10_val > 0),
                    "question_10_score": q10_val,
                    "severity": "URGENT_SAFETY_ASSESSMENT" if q10_val > 0 else "NORMAL",
                    "override_protection": "Deterministic safety rule: Crisis alerts can never be overridden by AI predictions.",
                    "helpline": "Tele-MANAS (14416 / 1800-891-4416)",
                }
        except Exception:
            pass

    # 5. Persist multimodal screening results to database when mother exists
    processed_timestamp = datetime.now(timezone.utc).isoformat()
    persisted_screening_id = str(uuid.uuid4())

    try:
        m_uuid = uuid.UUID(effective_mother_id)
        mother_obj = db.get(Mother, m_uuid)
        if mother_obj:
            f_score = inference_result.get("fusion_score")
            if isinstance(f_score, (int, float)):
                f_pct = f_score * 100.0 if f_score <= 1.0 else float(f_score)
                mm_risk = "high" if f_pct >= 43 else "moderate" if f_pct >= 33 else "low"
            else:
                mm_risk = "moderate"

            mm_payload = {
                "audio_score": inference_result.get("audio_score"),
                "video_score": inference_result.get("video_score"),
                "text_score": inference_result.get("text_score"),
                "clinical_score": inference_result.get("clinical_score"),
                "fusion_score": f_score,
                "fusion_method": inference_result.get("fusion_method"),
                "disagreement_flag": inference_result.get("disagreement_flag"),
                "disagreement_details": inference_result.get("disagreement_details"),
                "modalities": inference_result.get("modalities"),
                "modality_status": inference_result.get("modality_status"),
                "processed_at": processed_timestamp,
            }
            clin_mod = inference_result.get("modalities", {}).get("clinical")
            clin_pred_payload = (
                {
                    "predicted_risk_probability": clin_mod.get("score"),
                    "predicted_class": clin_mod.get("predicted_class"),
                    "status": clin_mod.get("status"),
                    "model_utilized": clin_mod.get("model_version") or "random_forest",
                    "predicted_label": (
                        "HIGH_RISK"
                        if (clin_mod.get("score") or 0) >= 0.43
                        else "MODERATE_RISK"
                        if (clin_mod.get("score") or 0) >= 0.33
                        else "LOW_RISK"
                    ),
                }
                if isinstance(clin_mod, dict) and clin_mod.get("status") == "completed"
                else None
            )

            # Merge into a recent (<30 mins) EPDS screening for the same mother if submitted first
            now_utc = datetime.now(timezone.utc)
            recent_epds = db.scalars(
                select(Screening)
                .where(Screening.mother_id == mother_obj.id, Screening.instrument.in_(("EPDS", "EPDS+MULTIMODAL")))
                .order_by(Screening.created_at.desc())
                .limit(1)
            ).first()
            merged_recent = False
            if recent_epds and recent_epds.created_at:
                cand_dt = recent_epds.created_at if recent_epds.created_at.tzinfo else recent_epds.created_at.replace(tzinfo=timezone.utc)
                if (now_utc - cand_dt).total_seconds() < 1800:
                    recent_epds.instrument = "EPDS+MULTIMODAL"
                    recent_epds.screening_date = now_utc
                    recent_epds.fusion_status = inference_result.get("fusion_status") or "completed"
                    recent_epds.modality_status = {**(recent_epds.modality_status or {}), **(inference_result.get("modality_status") or {})}
                    recent_epds.multimodal_scores = {**(recent_epds.multimodal_scores or {}), **mm_payload}
                    if clin_pred_payload:
                        recent_epds.clinical_model_prediction = clin_pred_payload
                    if recent_epds.q10_safety_alert or recent_epds.risk_classification == "high" or mm_risk == "high":
                        recent_epds.risk_classification = "high"
                    elif recent_epds.risk_classification == "moderate" or mm_risk == "moderate":
                        recent_epds.risk_classification = "moderate"
                    db.commit()
                    db.refresh(recent_epds)
                    persisted_screening_id = str(recent_epds.id)
                    merged_recent = True

            if not merged_recent:
                new_mm_screening = Screening(
                    mother_id=mother_obj.id,
                    instrument="MULTIMODAL",
                    total_score=0,
                    risk_classification=mm_risk,
                    q10_safety_alert=bool(q10_safety_alert and q10_safety_alert.get("triggered")),
                    submitted_answers={},
                    item_scores={},
                    screening_status="completed",
                    fusion_status=inference_result.get("fusion_status") or "completed",
                    modality_status=inference_result.get("modality_status") or {},
                    model_metadata={
                        "model_version": inference_result.get("model_version"),
                        "narrative_excerpt": resolved_text[:400] if resolved_text else None,
                        "character_count": len(resolved_text) if resolved_text else 0,
                        "audio_features_count": len(resolved_audio) if resolved_audio else 0,
                        "video_features_count": len(resolved_video) if resolved_video else 0,
                        "processed_at": processed_timestamp,
                    },
                    multimodal_scores=mm_payload,
                    clinical_features_snapshot=resolved_clinical,
                    clinical_model_prediction=clin_pred_payload,
                    notes="AI Multimodal Screening completed via Patient Portal.",
                )
                db.add(new_mm_screening)
                db.commit()
                db.refresh(new_mm_screening)
                persisted_screening_id = str(new_mm_screening.id)
    except Exception:
        db.rollback()

    return ThreeModalityAnalyzeResponse(
        screening_id=persisted_screening_id,
        mother_id=effective_mother_id,
        status=inference_result["status"],
        clinical_score=inference_result.get("clinical_score"),
        text_score=inference_result["text_score"],
        audio_score=inference_result["audio_score"],
        video_score=inference_result["video_score"],
        fusion_score=inference_result["fusion_score"],
        fusion_status=inference_result["fusion_status"],
        fusion_method=inference_result["fusion_method"],
        modality_status=inference_result["modality_status"],
        modalities=inference_result["modalities"],
        disagreement_flag=inference_result["disagreement_flag"],
        disagreement_details=inference_result["disagreement_details"],
        model_version=inference_result["model_version"],
        disclaimer=inference_result["disclaimer"],
        q10_safety_alert=q10_safety_alert,
        processed_at=processed_timestamp,
    )

