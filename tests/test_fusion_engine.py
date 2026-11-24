"""Tests for the Multimodal Fusion Engine and Cross-Modal Discordance Analyzer.

Verifies:
1. Clinical-only output evaluation.
2. Clinical plus Synthetic Text evaluation.
3. Missing modalities handling.
4. Unavailable audio/video handling.
5. Incompatible output types handling.
6. No comparable modality predictions handling.
7. Discordance analysis with insufficient data (exact contract match).
8. Invalid modality status handling.
9. Fusion failure exception handling.
10. Future multi-branch fusion extensibility (when >= 2 predictive modalities are present).
11. Future multi-branch concordant vs discordant analysis.
12. Full end-to-end screening endpoint integration regression.
"""

from typing import Any, Dict, Optional
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.ml.fusion_engine import (
    BaseFusionStrategy,
    DiscordanceAnalyzer,
    FusionStatus,
    LearnedFourModalityStackingStrategy,
    ModalityCandidate,
    MultimodalFusionEngine,
    WeightedAverageFusionStrategy,
    fusion_engine,
)
from backend.schemas.screening import (
    AudioModalityResult,
    ClinicalModalityResult,
    TextModalityResult,
    VideoModalityResult,
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Create TestClient with application lifespan active."""
    with TestClient(app) as test_client:
        yield test_client


def _sample_clinical_completed(prob: float = 0.72) -> ClinicalModalityResult:
    """Create valid completed ClinicalModalityResult fixture."""
    return ClinicalModalityResult(
        status="completed",
        prediction={
            "predicted_risk_probability": prob,
            "predicted_class": 1 if prob >= 0.5 else 0,
            "risk_category": "HIGH_RISK" if prob >= 0.7 else "MODERATE_RISK",
            "decision_threshold": 0.5,
        },
        model_version="random_forest",
    )


def _sample_text_completed(score: Optional[float] = None) -> TextModalityResult:
    """Create valid completed TextModalityResult fixture."""
    return TextModalityResult(
        status="completed",
        processing_type="synthetic_text_risk",
        risk_score=score,
        predicted_class=1 if score is not None and score >= 0.5 else (0 if score is not None else None),
        processed_character_count=50,
        model_version="text_sgd_logistic_v1",
    )


# ---------------------------------------------------------------------------
# 1. Clinical-Only Output
# ---------------------------------------------------------------------------
def test_fusion_clinical_only_output():
    """Verify that a single clinical prediction results in status='not_available' and no fabricated score."""
    engine = MultimodalFusionEngine()
    result = engine.evaluate(clinical=_sample_clinical_completed(0.72))

    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.combined_score is None
    assert result.risk_category is None
    assert result.epds_equivalent is None
    assert result.modality_contributions == {}

    # Discordance requires >= 2 comparable modalities
    assert result.discordance_analysis is not None
    assert result.discordance_analysis["discordance_detected"] is False
    assert result.discordance_analysis["comparison"] == []
    assert result.discordance_analysis["explanation"] == "Insufficient comparable modality predictions."


# ---------------------------------------------------------------------------
# 2. Clinical Plus Synthetic Text Evaluation
# ---------------------------------------------------------------------------
def test_fusion_clinical_plus_text_predictive():
    """Verify synthetic text risk score is evaluated as a predictive modality."""
    strategy = WeightedAverageFusionStrategy(default_weights={"clinical": 0.5, "text": 0.5})
    engine = MultimodalFusionEngine(strategy=strategy)
    clinical = _sample_clinical_completed(0.65)
    text = _sample_text_completed(0.70)

    result = engine.evaluate(clinical=clinical, text=text)

    assert result.status == FusionStatus.COMPLETED.value
    assert result.combined_score is not None
    assert 0.0 <= result.combined_score <= 1.0
    assert result.discordance_analysis is not None


def test_fusion_clinical_plus_text_without_strategy():
    """Verify that without a configured strategy, fusion is not_available but discordance is analyzed."""
    engine = MultimodalFusionEngine()
    clinical = _sample_clinical_completed(0.85)
    text = _sample_text_completed(0.40)

    result = engine.evaluate(clinical=clinical, text=text)

    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.combined_score is None
    assert result.discordance_analysis["discordance_detected"] is True


# ---------------------------------------------------------------------------
# 3. Missing Modalities
# ---------------------------------------------------------------------------
def test_fusion_missing_modalities():
    """Verify that omitting all modalities returns status='not_available'."""
    engine = MultimodalFusionEngine()
    result = engine.evaluate(clinical=None, text=None, audio=None, video=None)

    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.combined_score is None
    assert result.discordance_analysis["discordance_detected"] is False


# ---------------------------------------------------------------------------
# 4. Unavailable Audio & Video
# ---------------------------------------------------------------------------
def test_fusion_unavailable_audio_and_video():
    """Verify that unavailable audio and video models do not enable fusion."""
    engine = MultimodalFusionEngine()
    clinical = _sample_clinical_completed(0.55)
    audio = AudioModalityResult(status="unavailable", message="Unimplemented")
    video = VideoModalityResult(status="unavailable", message="Unimplemented")

    result = engine.evaluate(clinical=clinical, audio=audio, video=video)
    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.combined_score is None
    assert result.discordance_analysis["discordance_detected"] is False


# ---------------------------------------------------------------------------
# 5. Incompatible Output Types
# ---------------------------------------------------------------------------
def test_fusion_incompatible_output_types():
    """Verify that non-predictive formats (e.g. text without score) are recognized as incompatible."""
    engine = MultimodalFusionEngine()
    text = _sample_text_completed(score=None)

    # Candidate extraction check
    candidate = engine.extract_candidate("text", text)
    assert candidate.is_predictive is False
    assert candidate.probability is None

    result = engine.evaluate(text=text)
    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.combined_score is None


# ---------------------------------------------------------------------------
# 6. No Comparable Modality Predictions
# ---------------------------------------------------------------------------
def test_fusion_no_comparable_modality_predictions():
    """Verify that zero predictive modalities cleanly returns insufficient predictions report."""
    engine = MultimodalFusionEngine()
    audio = AudioModalityResult(status="not_requested")
    video = VideoModalityResult(status="not_requested")

    result = engine.evaluate(audio=audio, video=video)
    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.discordance_analysis["discordance_detected"] is False
    assert result.discordance_analysis["comparison"] == []


# ---------------------------------------------------------------------------
# 7. Discordance with Insufficient Data Contract
# ---------------------------------------------------------------------------
def test_discordance_with_insufficient_data():
    """Verify exact contract specification for discordance when < 2 predictive modalities exist."""
    analyzer = DiscordanceAnalyzer(threshold=0.25)

    # Empty candidates
    res_empty = analyzer.analyze([])
    assert res_empty.to_dict() == {
        "discordance_detected": False,
        "comparison": [],
        "explanation": "Insufficient comparable modality predictions.",
    }

    # Single clinical candidate
    clinical_cand = ModalityCandidate(
        modality="clinical",
        status="completed",
        probability=0.81,
        is_predictive=True,
    )
    res_single = analyzer.analyze([clinical_cand])
    assert res_single.to_dict() == {
        "discordance_detected": False,
        "comparison": [],
        "explanation": "Insufficient comparable modality predictions.",
    }


# ---------------------------------------------------------------------------
# 8. Invalid Modality Status Handling
# ---------------------------------------------------------------------------
def test_invalid_modality_status_handling():
    """Verify that invalid modality status strings are rejected and yield status='failed'."""
    engine = MultimodalFusionEngine()
    bad_modality = {"status": "unrecognized_status_code_999"}

    result = engine.evaluate(clinical=bad_modality)  # type: ignore
    assert result.status == FusionStatus.FAILED.value
    assert result.combined_score is None
    assert "validation failed" in result.discordance_analysis["explanation"].lower()


# ---------------------------------------------------------------------------
# 9. Fusion Failure Exception Handling
# ---------------------------------------------------------------------------
def test_fusion_failure_exception_handling():
    """Verify that exceptions thrown inside a fusion strategy are caught and recorded as failed."""
    class CrashingStrategy(BaseFusionStrategy):
        def combine(self, candidates):
            raise RuntimeError("Simulated mathematical singularity or memory fault")

    engine = MultimodalFusionEngine(strategy=CrashingStrategy())

    # Supply 2 mock predictive modalities to trigger strategy combine
    cand_clin = ModalityCandidate(modality="clinical", status="completed", probability=0.8, is_predictive=True)
    cand_audio = ModalityCandidate(modality="audio", status="completed", probability=0.7, is_predictive=True)

    # Mock extract_candidate to return our two candidates
    engine.extract_candidate = lambda mod, data: cand_clin if mod == "clinical" else cand_audio

    result = engine.evaluate(clinical={"status": "completed"}, audio={"status": "completed"})
    assert result.status == FusionStatus.FAILED.value
    assert result.combined_score is None


# ---------------------------------------------------------------------------
# 10. Future Multi-Branch Fusion Extensibility
# ---------------------------------------------------------------------------
def test_future_multi_branch_fusion_execution():
    """Verify that when >= 2 predictive modalities exist and strategy is configured, fusion completes."""
    strategy = WeightedAverageFusionStrategy(default_weights={"clinical": 0.6, "audio": 0.4})
    engine = MultimodalFusionEngine(strategy=strategy)

    cand_clin = ModalityCandidate(modality="clinical", status="completed", probability=0.80, is_predictive=True)
    cand_audio = ModalityCandidate(modality="audio", status="completed", probability=0.40, is_predictive=True)

    engine.extract_candidate = lambda mod, data: (
        cand_clin if mod == "clinical"
        else cand_audio if mod == "audio"
        else ModalityCandidate(modality=mod, status="not_requested")
    )

    result = engine.evaluate(clinical={"status": "completed"}, audio={"status": "completed"})
    assert result.status == FusionStatus.COMPLETED.value
    # 0.80 * 0.6 + 0.40 * 0.4 = 0.48 + 0.16 = 0.64
    assert result.combined_score == 0.64
    assert result.risk_category == "MODERATE_RISK"
    assert result.epds_equivalent == 19
    assert result.modality_contributions == {"clinical": 0.6, "audio": 0.4}

    # Discordance: |0.80 - 0.40| = 0.40 >= 0.25 -> True
    assert result.discordance_analysis["discordance_detected"] is True
    assert len(result.discordance_analysis["comparison"]) == 1


# ---------------------------------------------------------------------------
# 11. Multi-Branch Concordance Check
# ---------------------------------------------------------------------------
def test_future_multi_branch_concordant_analysis():
    """Verify that when probabilities are close (< threshold), discordance_detected is False."""
    strategy = WeightedAverageFusionStrategy()
    engine = MultimodalFusionEngine(strategy=strategy)

    cand_clin = ModalityCandidate(modality="clinical", status="completed", probability=0.75, is_predictive=True)
    cand_audio = ModalityCandidate(modality="audio", status="completed", probability=0.78, is_predictive=True)

    engine.extract_candidate = lambda mod, data: (
        cand_clin if mod == "clinical"
        else cand_audio if mod == "audio"
        else ModalityCandidate(modality=mod, status="not_requested")
    )

    result = engine.evaluate(clinical={"status": "completed"}, audio={"status": "completed"})
    assert result.status == FusionStatus.COMPLETED.value
    # |0.75 - 0.78| = 0.03 < 0.25 -> False
    assert result.discordance_analysis["discordance_detected"] is False


# ---------------------------------------------------------------------------
# 12. Full Screening Endpoint Regression
# ---------------------------------------------------------------------------
def test_screening_endpoint_regression_with_fusion_engine(client: TestClient):
    """Verify live POST /api/screenings/analyze outputs fusion contract via MultimodalFusionEngine."""
    import json
    from tests.test_backend_screening import _get_valid_clinical_features

    payload = {
        "motherId": "M-FUSION-01",
        "modalities": json.dumps({"clinical": True, "text": False}),
        "consentConfirmed": "true",
        "eligibilityConfirmed": "true",
        "clinical_features": json.dumps(_get_valid_clinical_features()),
    }
    response = client.post("/api/screenings/analyze", data=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "completed"
    assert data["clinical"]["status"] == "completed"

    fusion = data["fusion"]
    assert fusion["status"] == "not_available"
    assert fusion["combined_score"] is None
    assert fusion["risk_category"] is None
    assert fusion["epds_equivalent"] is None
    assert fusion["modality_contributions"] == {}
    assert fusion["discordance_analysis"] == {
        "discordance_detected": False,
        "comparison": [],
        "explanation": "Insufficient comparable modality predictions.",
    }


# ---------------------------------------------------------------------------
# 13. Unified Four-Modality Late Fusion Tests
# ---------------------------------------------------------------------------
def test_four_modality_late_fusion_all_modalities():
    """Verify late fusion execution when all four modalities (clinical, text, audio, video) are completed."""
    strategy = WeightedAverageFusionStrategy(
        default_weights={"clinical": 0.40, "text": 0.20, "audio": 0.20, "video": 0.20}
    )
    engine = MultimodalFusionEngine(strategy=strategy)

    clinical = _sample_clinical_completed(0.80)
    text = _sample_text_completed(0.60)
    audio = AudioModalityResult(
        status="completed",
        risk_score=0.50,
        prediction={"predicted_risk_probability": 0.50, "predicted_class": 1},
    )
    video = VideoModalityResult(
        status="completed",
        risk_score=0.40,
        prediction={"predicted_risk_probability": 0.40, "predicted_class": 0},
    )

    result = engine.evaluate(clinical=clinical, text=text, audio=audio, video=video)
    assert result.status == FusionStatus.COMPLETED.value
    # 0.80*0.40 + 0.60*0.20 + 0.50*0.20 + 0.40*0.20 = 0.32 + 0.12 + 0.10 + 0.08 = 0.62
    assert result.combined_score == 0.62
    assert result.risk_category == "MODERATE_RISK"
    assert result.epds_equivalent == 19
    assert result.modality_contributions == {
        "clinical": 0.40,
        "text": 0.20,
        "audio": 0.20,
        "video": 0.20,
    }


def test_four_modality_dynamic_reweighting_partial():
    """Verify dynamic weight re-normalization when some modalities are missing or unrequested."""
    strategy = WeightedAverageFusionStrategy(
        default_weights={"clinical": 0.40, "text": 0.20, "audio": 0.20, "video": 0.20}
    )
    engine = MultimodalFusionEngine(strategy=strategy)

    # Video is not_requested, audio is unavailable
    clinical = _sample_clinical_completed(0.70)
    text = _sample_text_completed(0.50)
    audio = AudioModalityResult(status="unavailable")
    video = VideoModalityResult(status="not_requested")

    result = engine.evaluate(clinical=clinical, text=text, audio=audio, video=video)
    assert result.status == FusionStatus.COMPLETED.value
    # clinical raw 0.40, text raw 0.20 -> sum 0.60 -> normalized: clinical 2/3 (0.6667), text 1/3 (0.3333)
    # score: 0.70 * (2/3) + 0.50 * (1/3) = 0.4667 + 0.1667 = 0.6333
    assert result.combined_score is not None
    assert 0.63 <= result.combined_score <= 0.64
    assert "clinical" in result.modality_contributions
    assert "text" in result.modality_contributions
    assert "audio" not in result.modality_contributions
    assert "video" not in result.modality_contributions


def test_four_modality_insufficient_modalities():
    """Verify that fewer than 2 predictive modalities return status='not_available'."""
    strategy = WeightedAverageFusionStrategy()
    engine = MultimodalFusionEngine(strategy=strategy)

    # Only 1 modality predictive
    clinical = _sample_clinical_completed(0.75)
    text = _sample_text_completed(score=None)  # non-predictive
    audio = AudioModalityResult(status="unavailable")
    video = VideoModalityResult(status="not_requested")

    result = engine.evaluate(clinical=clinical, text=text, audio=audio, video=video)
    assert result.status == FusionStatus.NOT_AVAILABLE.value
    assert result.combined_score is None
    assert result.discordance_analysis["discordance_detected"] is False


def test_four_modality_discordance_across_six_pairs():
    """Verify cross-modal discordance evaluates all 6 pairwise combinations when 4 modalities are active."""
    strategy = WeightedAverageFusionStrategy()
    engine = MultimodalFusionEngine(strategy=strategy)

    clinical = _sample_clinical_completed(0.85)
    text = _sample_text_completed(0.50)
    audio = AudioModalityResult(
        status="completed",
        prediction={"predicted_risk_probability": 0.45},
    )
    video = VideoModalityResult(
        status="completed",
        prediction={"predicted_risk_probability": 0.30},
    )

    result = engine.evaluate(clinical=clinical, text=text, audio=audio, video=video)
    assert result.status == FusionStatus.COMPLETED.value
    discordance = result.discordance_analysis
    assert discordance["discordance_detected"] is True
    # 4 modalities -> 4*3/2 = 6 pairwise comparisons
    assert len(discordance["comparison"]) == 6
    # Max difference between clinical (0.85) and video (0.30) is 0.55 >= 0.25
    assert any(c["modality_a"] == "clinical" and c["modality_b"] == "video" for c in discordance["comparison"])


def test_four_modality_screening_endpoint_with_standalone_q10(client: TestClient):
    """Verify live analyze endpoint handles 4 modalities and standalone EPDS Q10 safety alert."""
    import json
    from tests.test_backend_screening import _get_valid_clinical_features

    q10_answers = [{"question_id": f"EPDS_Q{i:02d}", "selected_index": 0} for i in range(1, 10)]
    q10_answers.append({"question_id": "EPDS_Q10", "selected_index": 2})  # self-harm alert

    valid_audio_dict = {
        "f0_mean_hz": 215.0,
        "f0_std_hz": 26.5,
        "jitter_local_percent": 1.15,
        "shimmer_local_percent": 4.50,
        "hnr_db": 19.2,
        "speech_rate_syllables_per_sec": 3.80,
        "pause_ratio": 0.25,
    }

    payload = {
        "motherId": "M-FOUR-MOD-01",
        "modalities": json.dumps({"clinical": True, "text": True, "audio": True}),
        "consentConfirmed": "true",
        "eligibilityConfirmed": "true",
        "clinical_features": json.dumps(_get_valid_clinical_features()),
        "text_content": "Mother describes persistent sadness and sleeping difficulties.",
        "audio_features": json.dumps(valid_audio_dict),
        "epds_answers": json.dumps(q10_answers),
    }

    resp = client.post("/api/screenings/analyze", data=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "completed"
    assert data["clinical"]["status"] == "completed"
    assert data["text"]["status"] == "completed"
    assert data["audio"]["status"] == "completed"
    assert data["video"]["status"] == "not_requested"

    # Standalone Q10 safety alert is present and triggered
    assert data["q10_safety_alert"] is not None
    assert data["q10_safety_alert"]["triggered"] is True
    assert data["q10_safety_alert"]["question_10_score"] == 2
    assert data["q10_safety_alert"]["severity"] == "URGENT_SAFETY_ASSESSMENT"
    assert "never be overridden" in data["q10_safety_alert"]["override_protection"].lower()

    # Fusion executed across completed modalities
    assert data["fusion"]["status"] == "completed"
    assert data["fusion"]["combined_score"] is not None


