"""FastAPI router for Central Multimodal Screening Orchestration.

Exposes:
- POST /api/screenings/analyze: Multipart/form-data endpoint orchestrating clinical numerical,
  biomedical text NER, and acoustic/visual screening inputs without fabricating predictions.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Union
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

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
        "Coordinates validated 46-feature clinical numerical ML screening, biomedical "
        "text entity extraction (Text NER), and safely reports unavailable statuses for "
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
    text_content: Optional[str] = Form(
        None,
        description="Alternative direct narrative text string for text NER",
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
        eligibility_confirmed=effective_eligibility,
    )


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
    current_user: User = Depends(get_current_user),
    service: ThreeModalityInferenceService = Depends(lambda: three_modality_service),
) -> ThreeModalityAnalyzeResponse:
    """Execute authenticated Stage 1 Three-Modality inference and return research results."""
    # 1. Resolve participant ID & enforce Authorization
    requested_id = motherId if motherId is not None else mother_id

    if current_user.role == "patient":
        if not current_user.mother_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patient account is not linked to an enrolled mother profile.",
            )
        patient_mother_id = str(current_user.mother_id)
        if requested_id and requested_id.strip() != patient_mother_id:
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

    # Check for empty request
    has_any_input = (
        resolved_text is not None
        or resolved_audio is not None
        or resolved_video is not None
        or files_voice is not None
        or files_video is not None
    )
    if not has_any_input:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one screening modality (text, audio, or video) must be provided for analysis.",
        )

    # 4. Execute Service Inference
    inference_result = service.analyze(
        text=resolved_text,
        audio_features=resolved_audio,
        video_features=resolved_video,
    )

    # If raw recordings were uploaded without pre-extracted feature vectors, annotate details
    if files_voice is not None and resolved_audio is None:
        mod_audio = inference_result["modalities"].get("audio", {})
        mod_audio["status"] = "unavailable"
        mod_audio["details"] = {
            "raw_recording_received": True,
            "filename": files_voice.filename,
            "notice": (
                "Raw audio waveform acoustic DSP feature extraction pipeline is offline in this "
                "environment. Audio inference requires pre-extracted 7-feature physiological acoustic profile."
            ),
        }
        inference_result["modality_status"]["audio"] = "unavailable"

    if files_video is not None and resolved_video is None:
        mod_video = inference_result["modalities"].get("video", {})
        mod_video["status"] = "unavailable"
        mod_video["details"] = {
            "raw_recording_received": True,
            "filename": files_video.filename,
            "notice": (
                "Raw video landmark and action unit temporal feature extraction pipeline is offline in "
                "this environment. Video inference requires pre-extracted 220-feature summary statistics."
            ),
        }
        inference_result["modality_status"]["video"] = "unavailable"

    # 5. Formulate Response (Transient screening ID; zero fake database persistence)
    transient_screening_id = str(uuid.uuid4())
    processed_timestamp = datetime.now(timezone.utc).isoformat()

    return ThreeModalityAnalyzeResponse(
        screening_id=transient_screening_id,
        mother_id=effective_mother_id,
        status=inference_result["status"],
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
        processed_at=processed_timestamp,
    )

