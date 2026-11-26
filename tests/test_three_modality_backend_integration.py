"""Isolated test suite for Stage 1 Three-Modality Backend Inference Integration.

Verifies:
1. Text model loading and inference via text_pipeline.joblib.
2. Audio model loading and inference via scaler.joblib + logistic_regression.joblib.
3. Video model loading and inference via 220-feature statistical baseline.
4. Three-modality late fusion meta-classifier inference.
5. Strict feature ordering and dimensionality validation.
6. Missing-modality handling (verified 2-modality fallbacks and insufficient data handling).
7. Invalid input rejection (malformed arrays, NaNs, character limits).
8. Model loading failure resilience (graceful degradation without crashes).
9. Authentication & authorization enforcement on POST /api/screenings/multimodal/analyze.
10. Complete exclusion of EPDS answers, EPDS totals, and clinical numerical features.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List
import uuid
from fastapi.testclient import TestClient
import numpy as np
import pytest

from backend.main import app
from backend.models.mother import Mother
from backend.models.user import User
from backend.schemas.screening import ThreeModalityAnalyzeResponse
from backend.services.auth_service import create_access_token
from backend.services.three_modality_service import (
    DISAGREEMENT_THRESHOLD,
    EXPECTED_AUDIO_FEATURES,
    EXPECTED_VIDEO_FEATURE_COUNT,
    ThreeModalityInferenceService,
    three_modality_service,
)


@pytest.fixture(scope="module")
def sample_audio_features() -> Dict[str, float]:
    """Return realistic 7 acoustic feature dictionary."""
    return {
        "f0_mean_hz": 210.5,
        "f0_std_hz": 32.1,
        "jitter_local_percent": 1.25,
        "shimmer_local_percent": 3.42,
        "hnr_db": 18.5,
        "speech_rate_syllables_per_sec": 4.2,
        "pause_ratio": 0.25,
    }


@pytest.fixture(scope="module")
def sample_video_features() -> List[float]:
    """Return realistic 220-feature summary statistics array."""
    # 55 signals * 4 statistical moments (mean, std, min, max) = 220
    np.random.seed(42)
    return list(np.random.normal(loc=0.0, scale=1.0, size=220).round(4))


@pytest.fixture(scope="module")
def test_client() -> TestClient:
    """Return TestClient for FastAPI app."""
    return TestClient(app)


# -----------------------------------------------------------------------------
# 1. Individual Modality & Fusion Service Tests
# -----------------------------------------------------------------------------

def test_service_startup_and_loading():
    """Verify service loads all checkpoints once and reports is_loaded=True."""
    svc = ThreeModalityInferenceService()
    assert not svc.is_loaded
    svc.startup()
    assert svc.is_loaded
    # Second call should be a no-op
    svc.startup()
    assert svc.is_loaded


def test_text_model_inference():
    """Verify text pipeline produces valid risk score between 0.0 and 1.0."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    narrative = "I have been feeling deeply overwhelmed, exhausted, and sad since the delivery."
    res = svc.predict_text(narrative)
    assert res.status == "completed"
    assert res.score is not None
    assert 0.0 <= res.score <= 1.0
    assert res.predicted_class in (0, 1)
    assert res.model_version == "text_sgd_logistic_v1"
    assert res.details.get("character_count") == len(narrative)


def test_audio_model_inference_dict_and_list(sample_audio_features):
    """Verify audio model executes on both feature dict and ordered list with identical score."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    # Predict from dict
    res_dict = svc.predict_audio(sample_audio_features)
    assert res_dict.status == "completed"
    assert res_dict.score is not None
    assert 0.0 <= res_dict.score <= 1.0

    # Predict from ordered list matching EXPECTED_AUDIO_FEATURES
    ordered_list = [sample_audio_features[k] for k in EXPECTED_AUDIO_FEATURES]
    res_list = svc.predict_audio(ordered_list)
    assert res_list.status == "completed"
    assert res_list.score == res_dict.score


def test_audio_model_feature_ordering_and_dimensions():
    """Verify audio model rejects missing keys or incorrect feature counts."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    # Missing keys in dict
    bad_dict = {"f0_mean_hz": 200.0}
    res_bad_dict = svc.predict_audio(bad_dict)
    assert res_bad_dict.status == "failed"
    assert "missing required keys" in res_bad_dict.error.lower()

    # Wrong length in list (6 instead of 7)
    res_short = svc.predict_audio([200.0, 30.0, 1.0, 3.0, 15.0, 4.0])
    assert res_short.status == "failed"
    assert "expected exactly 7" in res_short.error.lower()


def test_video_model_inference(sample_video_features):
    """Verify video model executes on 220 pooled summary statistics."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    res = svc.predict_video(sample_video_features)
    assert res.status == "completed"
    assert res.score is not None
    assert 0.0 <= res.score <= 1.0
    assert res.model_version == "video_statistical_baseline_v1"


def test_video_model_dimension_validation():
    """Verify video model rejects arrays that do not equal 220 dimensions."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    res_short = svc.predict_video([0.1] * 219)
    assert res_short.status == "failed"
    assert "expected exactly 220" in res_short.error.lower()

    res_long = svc.predict_video([0.1] * 221)
    assert res_long.status == "failed"
    assert "expected exactly 220" in res_long.error.lower()


def test_three_modality_fusion_inference(sample_audio_features, sample_video_features):
    """Verify 3-modality meta-classifier evaluates cleanly when all 3 modalities are present."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    text_res = svc.predict_text("I feel fine and supported.")
    audio_res = svc.predict_audio(sample_audio_features)
    video_res = svc.predict_video(sample_video_features)

    fusion = svc.predict_fusion(text_res, audio_res, video_res)
    assert fusion["fusion_status"] == "completed"
    assert fusion["fusion_method"] == "learned_stacking_three_modality"
    assert fusion["fusion_score"] is not None
    assert 0.0 <= fusion["fusion_score"] <= 1.0
    assert "text" in fusion["fusion_weights"]
    assert "audio" in fusion["fusion_weights"]
    assert "video" in fusion["fusion_weights"]


# -----------------------------------------------------------------------------
# 2. Missing-Modality & Fallback Mechanics
# -----------------------------------------------------------------------------

def test_missing_modality_fallbacks(sample_audio_features, sample_video_features):
    """Verify independently trained 2-modality fallbacks execute when 1 modality is missing."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    t_res = svc.predict_text("Overwhelmed and fatigued.")
    a_res = svc.predict_audio(sample_audio_features)
    v_res = svc.predict_video(sample_video_features)
    missing_res = svc.predict_text(None)  # not_requested

    # Fallback 1: Text + Audio (Video missing)
    f_ta = svc.predict_fusion(t_res, a_res, missing_res)
    assert f_ta["fusion_status"] == "completed"
    assert f_ta["fusion_method"] == "learned_stacking_text_audio"
    assert f_ta["fusion_score"] is not None

    # Fallback 2: Text + Video (Audio missing)
    f_tv = svc.predict_fusion(t_res, missing_res, v_res)
    assert f_tv["fusion_status"] == "completed"
    assert f_tv["fusion_method"] == "learned_stacking_text_video"
    assert f_tv["fusion_score"] is not None

    # Fallback 3: Audio + Video (Text missing)
    f_av = svc.predict_fusion(missing_res, a_res, v_res)
    assert f_av["fusion_status"] == "completed"
    assert f_av["fusion_method"] == "learned_stacking_audio_video"
    assert f_av["fusion_score"] is not None


def test_single_modality_insufficient_for_fusion():
    """Verify late fusion is refused when only a single modality is completed."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    t_res = svc.predict_text("Normal mood.")
    none_res = svc.predict_text(None)

    # Only text available
    f_single = svc.predict_fusion(t_res, none_res, none_res)
    assert f_single["fusion_status"] == "insufficient_data"
    assert f_single["fusion_score"] is None
    assert f_single["fusion_method"] == "none"
    assert f_single["disagreement_flag"] is False


def test_cross_modal_algorithmic_disagreement_calculation():
    """Verify algorithmic divergence flag triggers when modality delta >= 0.35."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    from backend.services.three_modality_service import ModalityScoreResult
    # Simulated high divergence: Text=0.20, Audio=0.80 (Delta = 0.60 > 0.35)
    t_low = ModalityScoreResult(status="completed", score=0.20)
    a_high = ModalityScoreResult(status="completed", score=0.80)
    v_none = ModalityScoreResult(status="not_requested")

    fuse = svc.predict_fusion(t_low, a_high, v_none)
    assert fuse["disagreement_flag"] is True
    assert fuse["disagreement_details"]["max_divergence"] == 0.60
    assert fuse["disagreement_details"]["disagreement_detected"] is True


# -----------------------------------------------------------------------------
# 3. Invalid Input Handling & Error Resilience
# -----------------------------------------------------------------------------

def test_invalid_input_handling():
    """Verify service handles extreme, malformed, or NaN inputs safely."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    # Text exceeding max characters
    huge_text = "a" * (10000 + 5)
    res_text = svc.predict_text(huge_text)
    assert res_text.status == "failed"
    assert "exceeds safe maximum limit" in res_text.error

    # Audio with NaNs
    res_nan = svc.predict_audio([210.0, float("nan"), 1.0, 3.0, 18.0, 4.0, 0.2])
    assert res_nan.status == "failed"
    assert "nan or infinite" in res_nan.error.lower()

    # Audio with non-numeric string
    res_str = svc.predict_audio(["bad", 32.0, 1.0, 3.0, 18.0, 4.0, 0.2])
    assert res_str.status == "failed"


def test_service_resilience_to_model_missing(monkeypatch, tmp_path):
    """Verify service gracefully reports status='unavailable' when model paths do not exist."""
    svc = ThreeModalityInferenceService()
    # Point to empty non-existent directory
    fake_path = tmp_path / "missing_model.joblib"
    monkeypatch.setattr("backend.services.three_modality_service.TEXT_PIPELINE_PATH", fake_path)

    svc.startup()
    res = svc.predict_text("Testing missing model.")
    assert res.status == "unavailable"
    assert "not found" in res.error.lower() or "unavailable" in res.error.lower()


# -----------------------------------------------------------------------------
# 4. Strict Isolation from Clinical and EPDS Features
# -----------------------------------------------------------------------------

def test_exclusion_of_epds_and_clinical_features(sample_audio_features, sample_video_features):
    """Confirm three-modality service signature and combiner exclude clinical & EPDS inputs."""
    import inspect
    svc = ThreeModalityInferenceService()

    # Inspect analyze method parameters
    sig = inspect.signature(svc.analyze)
    param_names = list(sig.parameters.keys())
    assert "text" in param_names
    assert "audio_features" in param_names
    assert "video_features" in param_names
    assert "epds" not in param_names
    assert "epds_answers" not in param_names
    assert "clinical_features" not in param_names
    assert "survey_features" not in param_names

    # Run inference and verify weights dictionary excludes clinical components
    res = svc.analyze(
        text="Feeling tired.",
        audio_features=sample_audio_features,
        video_features=sample_video_features,
    )
    # Weights must only contain text, audio, video, intercept
    weights = svc._fusion_3mod.coef_[0]
    assert len(weights) == 3


# -----------------------------------------------------------------------------
# 5. FastAPI Endpoint Tests: POST /api/screenings/multimodal/analyze
# -----------------------------------------------------------------------------

def test_endpoint_unauthenticated_rejected(test_client):
    """Verify endpoint rejects unauthenticated requests with HTTP 401."""
    res = test_client.post("/api/screenings/multimodal/analyze", data={"text_content": "Hello"})
    assert res.status_code == 401


def test_endpoint_patient_authorization_enforced(test_client):
    """Verify patient can only submit for their own linked mother profile."""
    own_mother_id = uuid.uuid4()
    other_mother_id = uuid.uuid4()
    patient_user_id = uuid.uuid4()

    token = create_access_token({"sub": str(patient_user_id), "role": "patient"})

    # Mock user retrieval in dependency override
    fake_user = User(
        id=patient_user_id,
        email="patient@test.com",
        full_name="Test Patient",
        role="patient",
        mother_id=own_mother_id,
        is_active=True,
    )

    from backend.services.auth_service import get_current_user
    app.dependency_overrides[get_current_user] = lambda: fake_user

    try:
        # 1. Attempting to submit for another mother ID -> HTTP 403
        res_forbidden = test_client.post(
            "/api/screenings/multimodal/analyze",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "mother_id": str(other_mother_id),
                "consent_confirmed": "true",
                "text_content": "Feeling okay today.",
            },
        )
        assert res_forbidden.status_code == 403
        assert "Patients may only submit screenings for their own profile" in res_forbidden.json()["detail"]

        # 2. Submitting with own mother ID -> HTTP 200
        res_ok = test_client.post(
            "/api/screenings/multimodal/analyze",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "mother_id": str(own_mother_id),
                "consent_confirmed": "true",
                "text_content": "Feeling okay today.",
            },
        )
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["status"] in ("completed", "partially_completed")
        assert data["text_score"] is not None
        assert data["mother_id"] == str(own_mother_id)
        assert "Research prototype score only" in data["disclaimer"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_endpoint_missing_consent_rejected(test_client):
    """Verify endpoint rejects request if maternal consent is not confirmed."""
    fake_doctor = User(
        id=uuid.uuid4(),
        email="doctor@test.com",
        full_name="Dr. Test",
        role="doctor",
        is_active=True,
    )
    from backend.services.auth_service import get_current_user
    app.dependency_overrides[get_current_user] = lambda: fake_doctor

    try:
        res = test_client.post(
            "/api/screenings/multimodal/analyze",
            headers={"Authorization": "Bearer fake_token"},
            data={
                "mother_id": str(uuid.uuid4()),
                "consent_confirmed": "false",
                "text_content": "Some text",
            },
        )
        assert res.status_code == 400
        assert "Maternal consent must be confirmed" in res.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_endpoint_empty_modalities_rejected(test_client):
    """Verify endpoint rejects request if no text, audio, or video inputs are supplied."""
    fake_doctor = User(
        id=uuid.uuid4(),
        email="doctor@test.com",
        full_name="Dr. Test",
        role="doctor",
        is_active=True,
    )
    from backend.services.auth_service import get_current_user
    app.dependency_overrides[get_current_user] = lambda: fake_doctor

    try:
        res = test_client.post(
            "/api/screenings/multimodal/analyze",
            headers={"Authorization": "Bearer fake_token"},
            data={
                "mother_id": str(uuid.uuid4()),
                "consent_confirmed": "true",
            },
        )
        assert res.status_code == 422
        assert "At least one screening modality" in res.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_endpoint_full_multimodal_analysis(test_client, sample_audio_features, sample_video_features):
    """Verify complete 3-modality execution on POST /api/screenings/multimodal/analyze."""
    fake_doctor = User(
        id=uuid.uuid4(),
        email="doctor@test.com",
        full_name="Dr. Test",
        role="doctor",
        is_active=True,
    )
    from backend.services.auth_service import get_current_user
    app.dependency_overrides[get_current_user] = lambda: fake_doctor

    try:
        res = test_client.post(
            "/api/screenings/multimodal/analyze",
            headers={"Authorization": "Bearer fake_token"},
            data={
                "mother_id": str(uuid.uuid4()),
                "consent_confirmed": "true",
                "text_content": "I feel exhausted, irritable, and cannot sleep well.",
                "audio_features": json.dumps(sample_audio_features),
                "video_features": json.dumps(sample_video_features),
            },
        )
        assert res.status_code == 200
        resp = res.json()
        assert resp["status"] == "completed"
        assert resp["text_score"] is not None
        assert resp["audio_score"] is not None
        assert resp["video_score"] is not None
        assert resp["fusion_score"] is not None
        assert resp["fusion_status"] == "completed"
        assert resp["fusion_method"] == "learned_stacking_three_modality"
        assert resp["modality_status"] == {"text": "completed", "audio": "completed", "video": "completed"}
        assert "screening_id" in resp
        assert "disclaimer" in resp
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_four_modality_service_fusion(sample_audio_features, sample_video_features):
    """Verify learned 4-modality meta-classifier evaluates cleanly when clinical data is combined."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    clinical_data = {
        "Age": 28,
        "Number of the latest pregnancy": 1,
        "Residence": "Urban",
        "Education Level": "Graduate",
        "Marital status": "Married",
        "Relationship with husband": "Good",
        "Relationship with the newborn": "Good",
        "Feeling about motherhood": "Positive",
        "Recieved Support": "Yes",
        "Need for Support": "Low",
    }

    t_res = svc.predict_text("I feel overwhelmed and fatigued after childbirth.")
    a_res = svc.predict_audio(sample_audio_features)
    v_res = svc.predict_video(sample_video_features)
    c_res = svc.predict_clinical(clinical_data, mother_id="test-mother-001")

    assert c_res.status == "completed"
    assert c_res.score is not None
    assert 0.0 <= c_res.score <= 1.0
    assert c_res.model_version == "clinical_random_forest_v1"

    fusion = svc.predict_fusion(t_res, a_res, v_res, c_res)
    assert fusion["fusion_status"] == "completed"
    assert fusion["fusion_method"] == "learned_stacking_four_modality"
    assert fusion["fusion_score"] is not None
    assert 0.0 <= fusion["fusion_score"] <= 1.0
    assert "clinical" in fusion["fusion_weights"]
    assert "audio" in fusion["fusion_weights"]
    assert "text" in fusion["fusion_weights"]
    assert "video" in fusion["fusion_weights"]
    assert "intercept" in fusion["fusion_weights"]


def test_endpoint_four_modality_analysis(test_client, sample_audio_features, sample_video_features):
    """Verify complete 4-modality pipeline execution on POST /api/screenings/multimodal/analyze."""
    fake_doctor = User(
        id=uuid.uuid4(),
        email="doctor@test.com",
        full_name="Dr. Test",
        role="doctor",
        is_active=True,
    )
    from backend.services.auth_service import get_current_user
    app.dependency_overrides[get_current_user] = lambda: fake_doctor

    clinical_data = {
        "Age": 29,
        "Number of the latest pregnancy": 2,
        "Residence": "Urban",
        "Education Level": "Postgraduate",
        "Marital status": "Married",
        "Monthly income before latest pregnancy": "High",
        "Current monthly income": "High",
        "Relationship with husband": "Good",
        "Relationship with the newborn": "Good",
        "Feeling about motherhood": "Positive",
        "Recieved Support": "Yes",
        "Need for Support": "Low",
        "Depression before pregnancy (PHQ2)": "No",
        "Depression during pregnancy (PHQ2)": "No",
    }

    try:
        res = test_client.post(
            "/api/screenings/multimodal/analyze",
            headers={"Authorization": "Bearer fake_token"},
            data={
                "mother_id": str(uuid.uuid4()),
                "consent_confirmed": "true",
                "text_content": "I feel exhausted, irritable, and cannot sleep well.",
                "audio_features": json.dumps(sample_audio_features),
                "video_features": json.dumps(sample_video_features),
                "clinical_features": json.dumps(clinical_data),
            },
        )
        assert res.status_code == 200
        resp = res.json()
        assert resp["status"] == "completed"
        assert resp["clinical_score"] is not None
        assert 0.0 <= resp["clinical_score"] <= 1.0
        assert resp["text_score"] is not None
        assert resp["audio_score"] is not None
        assert resp["video_score"] is not None
        assert resp["fusion_score"] is not None
        assert resp["fusion_status"] == "completed"
        assert resp["fusion_method"] == "learned_stacking_four_modality"
        assert resp["modality_status"] == {
            "text": "completed",
            "audio": "completed",
            "video": "completed",
            "clinical": "completed",
        }
        assert "clinical" in resp["modalities"]
        assert resp["model_version"] == "stage1_four_modality_v1"
        assert "screening_id" in resp
        assert "disclaimer" in resp
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_typed_only_with_clinical_and_video_retains_clinical_in_fusion(sample_video_features):
    """Verify clinical is included in fusion when audio is absent (typed-only screening)."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    clinical_data = {
        "Age": 29,
        "Number of the latest pregnancy": 2,
        "Residence": "Urban",
        "Education Level": "Postgraduate",
        "Marital status": "Married",
        "Monthly income before latest pregnancy": "High",
        "Current monthly income": "High",
        "Relationship with husband": "Good",
        "Relationship with the newborn": "Good",
        "Feeling about motherhood": "Positive",
        "Recieved Support": "Yes",
        "Need for Support": "Low",
        "Depression before pregnancy (PHQ2)": "No",
        "Depression during pregnancy (PHQ2)": "No",
    }

    res_tv = svc.analyze(
        text="I feel overwhelmed and exhausted.",
        video_features=sample_video_features,
        clinical_features=clinical_data,
    )
    assert res_tv["modality_status"]["audio"] == "not_requested"
    assert res_tv["modality_status"]["clinical"] == "completed"
    assert res_tv["fusion_status"] == "completed"
    assert res_tv["fusion_method"] == "weighted_clinical_text_video"
    assert res_tv["fusion_score"] is not None

    res_t = svc.analyze(
        text="I feel overwhelmed and exhausted.",
        clinical_features=clinical_data,
    )
    assert res_t["modality_status"]["audio"] == "not_requested"
    assert res_t["modality_status"]["video"] == "not_requested"
    assert res_t["fusion_status"] == "completed"
    assert res_t["fusion_method"] == "weighted_clinical_text"
    assert res_t["fusion_score"] is not None


def test_text_model_rejects_gibberish():
    """Verify gibberish or zero-vocabulary text produces no prediction score."""
    svc = ThreeModalityInferenceService()
    svc.startup()

    res_gib = svc.predict_text("Q1: asdfgh Q2: zxcvb Q3: qwerty Q4: hjkl Q5: mnbv")
    assert res_gib.status == "failed"
    assert res_gib.score is None
    assert "no recognizable" in (res_gib.error or "").lower()

    res_nums = svc.predict_text("123456 7890 !!!")
    assert res_nums.status == "failed"
    assert res_nums.score is None
