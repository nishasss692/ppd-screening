"""Three-Modality Inference Service for Postpartum Depression Screening.

Connects the Stage 1 trained multimodal models to the FastAPI application:
1. Text Modality: TF-IDF + Logistic Regression pipeline (models/text_model/text_pipeline.joblib)
2. Audio Modality: 7-feature StandardScaler + Logistic Regression (models/audio_model/)
3. Video Modality: 220-feature statistical baseline (artifacts/video_experiments/baseline_training_optimized/)
4. Late Fusion Combiner: Stacking Meta-Classifier (artifacts/three_modality_fusion/)

SCIENTIFIC INTEGRITY & METHODOLOGICAL NOTICE:
- Clinical numerical survey covariates and EPDS questionnaire responses are STRICTLY EXCLUDED
  from this primary three-modality screening stage.
- Output scores are uncalibrated multimodal research risk scores (0.0 - 1.0), NOT medical
  diagnoses, clinical findings, or calibrated disease probabilities.
- All trained models are loaded once at startup and reused across requests.
"""

from dataclasses import dataclass
import logging
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional, Tuple, Union
import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger("ppd.three_modality_service")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# Physical Model Artifact Paths
TEXT_PIPELINE_PATH = PROJECT_ROOT / "models" / "text_model" / "text_pipeline.joblib"
AUDIO_SCALER_PATH = PROJECT_ROOT / "models" / "audio_model" / "scaler.joblib"
AUDIO_MODEL_PATH = PROJECT_ROOT / "models" / "audio_model" / "logistic_regression.joblib"
VIDEO_MODEL_PATH = (
    PROJECT_ROOT
    / "artifacts"
    / "video_experiments"
    / "baseline_training_optimized"
    / "fitted_model_logistic_regression_all.joblib"
)

# Fusion Meta-Classifiers
FUSION_3MOD_PATH = (
    PROJECT_ROOT
    / "artifacts"
    / "three_modality_fusion"
    / "meta_classifier_three_modality_learned.joblib"
)
FUSION_TEXT_AUDIO_PATH = (
    PROJECT_ROOT
    / "artifacts"
    / "three_modality_fusion"
    / "meta_classifier_text_audio_learned.joblib"
)
FUSION_TEXT_VIDEO_PATH = (
    PROJECT_ROOT
    / "artifacts"
    / "three_modality_fusion"
    / "meta_classifier_text_video_learned.joblib"
)
FUSION_AUDIO_VIDEO_PATH = (
    PROJECT_ROOT
    / "artifacts"
    / "three_modality_fusion"
    / "meta_classifier_audio_video_learned.joblib"
)

# Specification Constants
EXPECTED_AUDIO_FEATURES: List[str] = [
    "f0_mean_hz",
    "f0_std_hz",
    "jitter_local_percent",
    "shimmer_local_percent",
    "hnr_db",
    "speech_rate_syllables_per_sec",
    "pause_ratio",
]
EXPECTED_VIDEO_FEATURE_COUNT: int = 220
DISAGREEMENT_THRESHOLD: float = 0.35
MAX_TEXT_CHARACTERS: int = 10000

DISCLAIMER_TEXT = (
    "Research prototype score only. Not a medical diagnosis, clinical finding, or "
    "calibrated disease probability. Standard clinical EPDS evaluation and clinician "
    "consultation required."
)


@dataclass
class ModalityScoreResult:
    """Standardized representation of unimodal inference result."""
    status: str
    score: Optional[float] = None
    predicted_class: Optional[int] = None
    model_version: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "score": self.score,
            "predicted_class": self.predicted_class,
            "model_version": self.model_version,
            "details": self.details or {},
            "error": self.error,
        }


class ThreeModalityInferenceService:
    """Thread-safe singleton service managing the Stage 1 three-modality ML inference lifecycle."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._startup_attempted: bool = False
        self._is_loaded: bool = False

        # Loaded model references
        self._text_pipeline: Optional[Any] = None
        self._audio_scaler: Optional[Any] = None
        self._audio_model: Optional[Any] = None
        self._video_model: Optional[Any] = None

        self._fusion_3mod: Optional[Any] = None
        self._fusion_text_audio: Optional[Any] = None
        self._fusion_text_video: Optional[Any] = None
        self._fusion_audio_video: Optional[Any] = None

        self._load_errors: Dict[str, str] = {}

    @property
    def is_loaded(self) -> bool:
        """Whether at least one modality or fusion model is loaded."""
        return self._is_loaded

    def startup(self) -> None:
        """Load all model checkpoints and preprocessing pipelines into memory once."""
        with self._lock:
            if self._startup_attempted and self._is_loaded:
                return

            self._startup_attempted = True
            self._load_errors.clear()

            # 1. Text Model Pipeline
            if TEXT_PIPELINE_PATH.is_file():
                try:
                    self._text_pipeline = joblib.load(TEXT_PIPELINE_PATH)
                    logger.info("Loaded text classifier pipeline from %s", TEXT_PIPELINE_PATH)
                except Exception as exc:
                    self._text_pipeline = None
                    self._load_errors["text"] = f"Failed to deserialize text pipeline: {exc}"
                    logger.error("Error loading text pipeline: %s", exc)
            else:
                self._load_errors["text"] = f"Text pipeline artifact not found at {TEXT_PIPELINE_PATH}"
                logger.warning("Missing text pipeline at %s", TEXT_PIPELINE_PATH)

            # 2. Audio Scaler and Classifier
            if AUDIO_SCALER_PATH.is_file() and AUDIO_MODEL_PATH.is_file():
                try:
                    self._audio_scaler = joblib.load(AUDIO_SCALER_PATH)
                    self._audio_model = joblib.load(AUDIO_MODEL_PATH)
                    logger.info("Loaded audio scaler and classifier from %s", AUDIO_MODEL_PATH)
                except Exception as exc:
                    self._audio_scaler = None
                    self._audio_model = None
                    self._load_errors["audio"] = f"Failed to deserialize audio model/scaler: {exc}"
                    logger.error("Error loading audio model: %s", exc)
            else:
                self._load_errors["audio"] = "Audio scaler or classifier artifact missing under models/audio_model/"
                logger.warning("Missing audio artifacts: scaler=%s, model=%s", AUDIO_SCALER_PATH, AUDIO_MODEL_PATH)

            # 3. Video Baseline Model
            if VIDEO_MODEL_PATH.is_file():
                try:
                    self._video_model = joblib.load(VIDEO_MODEL_PATH)
                    logger.info("Loaded video baseline model from %s", VIDEO_MODEL_PATH)
                except Exception as exc:
                    self._video_model = None
                    self._load_errors["video"] = f"Failed to deserialize video model: {exc}"
                    logger.error("Error loading video model: %s", exc)
            else:
                self._load_errors["video"] = f"Video model artifact not found at {VIDEO_MODEL_PATH}"
                logger.warning("Missing video model at %s", VIDEO_MODEL_PATH)

            # 4. Late Fusion Meta-Classifiers (3-modality and 2-modality fallbacks)
            self._fusion_3mod = self._safe_load_joblib(FUSION_3MOD_PATH, "fusion_3mod")
            self._fusion_text_audio = self._safe_load_joblib(FUSION_TEXT_AUDIO_PATH, "fusion_text_audio")
            self._fusion_text_video = self._safe_load_joblib(FUSION_TEXT_VIDEO_PATH, "fusion_text_video")
            self._fusion_audio_video = self._safe_load_joblib(FUSION_AUDIO_VIDEO_PATH, "fusion_audio_video")

            self._is_loaded = any([
                self._text_pipeline is not None,
                self._audio_model is not None,
                self._video_model is not None,
                self._fusion_3mod is not None,
            ])
            logger.info("Three-Modality Inference Service initialization complete. Ready=%s", self._is_loaded)

    def shutdown(self) -> None:
        """Release in-memory model references cleanly."""
        with self._lock:
            self._text_pipeline = None
            self._audio_scaler = None
            self._audio_model = None
            self._video_model = None
            self._fusion_3mod = None
            self._fusion_text_audio = None
            self._fusion_text_video = None
            self._fusion_audio_video = None
            self._is_loaded = False
            self._startup_attempted = False
            self._load_errors.clear()
            logger.info("Three-Modality Inference Service shutdown complete.")

    def _safe_load_joblib(self, path: Path, key: str) -> Optional[Any]:
        if path.is_file():
            try:
                model = joblib.load(path)
                logger.info("Loaded %s from %s", key, path)
                return model
            except Exception as exc:
                self._load_errors[key] = f"Deserialization error: {exc}"
                logger.error("Error loading %s: %s", key, exc)
                return None
        self._load_errors[key] = f"Artifact missing at {path}"
        return None

    def get_pipeline_status(self) -> Dict[str, Any]:
        """Return readiness and metadata for all individual modalities and late fusion."""
        if not self._startup_attempted:
            self.startup()
        return {
            "is_loaded": self._is_loaded,
            "text": {
                "status": "ready" if self._text_pipeline is not None else "unavailable",
                "model_name": "TF-IDF + Logistic Regression",
                "model_version": "text_sgd_logistic_v1",
                "features": "Linguistic & Affective N-grams",
                "error": self._load_errors.get("text"),
            },
            "audio": {
                "status": "ready" if (self._audio_scaler is not None and self._audio_model is not None) else "unavailable",
                "model_name": "StandardScaler + Logistic Regression",
                "model_version": "audio_logistic_regression_v1",
                "features": "7 Physiological Acoustic Features (F0, Jitter, Shimmer, HNR, Speech Rate, Pause Ratio)",
                "error": self._load_errors.get("audio"),
            },
            "video": {
                "status": "ready" if self._video_model is not None else "unavailable",
                "model_name": "Facial Affect & Gaze Dynamics Baseline",
                "model_version": "video_baseline_lr_all",
                "features": "220 Temporal Summary Statistics (Action Units & Landmarks)",
                "error": self._load_errors.get("video"),
            },
            "fusion": {
                "status": "ready" if self._fusion_3mod is not None else "unavailable",
                "model_name": "Stacking Meta-Classifier",
                "model_version": "meta_classifier_three_modality_v1",
                "method": "Stacking Meta-Logistic Regression",
                "error": self._load_errors.get("fusion_3mod"),
            },
        }

    # -------------------------------------------------------------------------
    # Modality Predictors
    # -------------------------------------------------------------------------

    def predict_text(self, text: Optional[str]) -> ModalityScoreResult:
        """Execute text narrative classification via fitted TF-IDF + Logistic Regression."""
        if text is None:
            return ModalityScoreResult(status="not_requested")

        raw_str = str(text).strip()
        if not raw_str:
            return ModalityScoreResult(status="not_requested")

        if len(raw_str) > MAX_TEXT_CHARACTERS:
            return ModalityScoreResult(
                status="failed",
                error=f"Text input exceeds safe maximum limit of {MAX_TEXT_CHARACTERS} characters.",
            )

        if not self._startup_attempted:
            self.startup()

        if self._text_pipeline is None:
            return ModalityScoreResult(
                status="unavailable",
                error=self._load_errors.get("text", "Text classifier artifact is unavailable."),
            )

        try:
            probs = self._text_pipeline.predict_proba([raw_str])
            prob_ppd = float(probs[0, 1])
            clamped_prob = round(float(np.clip(prob_ppd, 0.0, 1.0)), 4)
            pred_class = int(clamped_prob >= 0.5)

            return ModalityScoreResult(
                status="completed",
                score=clamped_prob,
                predicted_class=pred_class,
                model_version="text_sgd_logistic_v1",
                details={"character_count": len(raw_str)},
            )
        except Exception as exc:
            logger.error("Text inference error: %s", exc, exc_info=True)
            return ModalityScoreResult(status="failed", error=f"Text model inference failed: {exc}")

    def predict_audio(
        self,
        features: Optional[Union[Dict[str, float], List[float], np.ndarray]],
    ) -> ModalityScoreResult:
        """Execute acoustic feature screening using exact 7-feature schema and trained StandardScaler."""
        if features is None:
            return ModalityScoreResult(status="not_requested")

        # Convert dictionary or list to ordered numpy array
        feature_vals: List[float] = []
        if isinstance(features, dict):
            missing_keys = [k for k in EXPECTED_AUDIO_FEATURES if k not in features]
            if missing_keys:
                return ModalityScoreResult(
                    status="failed",
                    error=f"Audio features payload missing required keys: {missing_keys}",
                )
            try:
                feature_vals = [float(features[k]) for k in EXPECTED_AUDIO_FEATURES]
            except (ValueError, TypeError) as exc:
                return ModalityScoreResult(
                    status="failed",
                    error=f"Invalid numeric value in audio features: {exc}",
                )
        elif isinstance(features, (list, tuple, np.ndarray)):
            flat = list(np.asarray(features).flatten())
            if len(flat) != len(EXPECTED_AUDIO_FEATURES):
                return ModalityScoreResult(
                    status="failed",
                    error=(
                        f"Expected exactly {len(EXPECTED_AUDIO_FEATURES)} audio features "
                        f"({EXPECTED_AUDIO_FEATURES}), got {len(flat)}."
                    ),
                )
            try:
                feature_vals = [float(v) for v in flat]
            except (ValueError, TypeError) as exc:
                return ModalityScoreResult(
                    status="failed",
                    error=f"Invalid numeric value in audio feature list: {exc}",
                )
        else:
            return ModalityScoreResult(
                status="failed",
                error=f"Unsupported audio features type: {type(features).__name__}. Expected dict or list.",
            )

        # Sanity check values for NaNs / infinities
        arr = np.array([feature_vals], dtype=float)
        if np.isnan(arr).any() or np.isinf(arr).any():
            return ModalityScoreResult(
                status="failed",
                error="Audio features contain NaN or infinite values.",
            )

        if not self._startup_attempted:
            self.startup()

        if self._audio_scaler is None or self._audio_model is None:
            return ModalityScoreResult(
                status="unavailable",
                error=self._load_errors.get("audio", "Audio screening artifacts are unavailable."),
            )

        try:
            df_audio = pd.DataFrame([feature_vals], columns=EXPECTED_AUDIO_FEATURES)
            arr_scaled = self._audio_scaler.transform(df_audio)
            probs = self._audio_model.predict_proba(arr_scaled)
            prob_ppd = float(probs[0, 1])
            clamped_prob = round(float(np.clip(prob_ppd, 0.0, 1.0)), 4)
            pred_class = int(clamped_prob >= 0.5)

            return ModalityScoreResult(
                status="completed",
                score=clamped_prob,
                predicted_class=pred_class,
                model_version="audio_logistic_regression_v1",
                details={"features_processed": len(EXPECTED_AUDIO_FEATURES)},
            )
        except Exception as exc:
            logger.error("Audio inference error: %s", exc, exc_info=True)
            return ModalityScoreResult(status="failed", error=f"Audio inference failed: {exc}")

    def predict_video(
        self,
        features: Optional[Union[List[float], np.ndarray]],
    ) -> ModalityScoreResult:
        """Execute video feature screening using 220 pooled summary statistics."""
        if features is None:
            return ModalityScoreResult(status="not_requested")

        if isinstance(features, (list, tuple, np.ndarray)):
            flat = list(np.asarray(features).flatten())
            if len(flat) != EXPECTED_VIDEO_FEATURE_COUNT:
                return ModalityScoreResult(
                    status="failed",
                    error=(
                        f"Expected exactly {EXPECTED_VIDEO_FEATURE_COUNT} summary video features, "
                        f"got {len(flat)}."
                    ),
                )
            try:
                feature_vals = [float(v) for v in flat]
            except (ValueError, TypeError) as exc:
                return ModalityScoreResult(
                    status="failed",
                    error=f"Invalid numeric value in video feature list: {exc}",
                )
        else:
            return ModalityScoreResult(
                status="failed",
                error=f"Unsupported video features type: {type(features).__name__}. Expected list of 220 floats.",
            )

        arr = np.array([feature_vals], dtype=float)
        if np.isinf(arr).any():
            return ModalityScoreResult(
                status="failed",
                error="Video features contain infinite values.",
            )

        if not self._startup_attempted:
            self.startup()

        if self._video_model is None:
            return ModalityScoreResult(
                status="unavailable",
                error=self._load_errors.get("video", "Video baseline model artifact is unavailable."),
            )

        try:
            probs = self._video_model.predict_proba(arr)
            prob_ppd = float(probs[0, 1])
            clamped_prob = round(float(np.clip(prob_ppd, 0.0, 1.0)), 4)
            pred_class = int(clamped_prob >= 0.5)

            return ModalityScoreResult(
                status="completed",
                score=clamped_prob,
                predicted_class=pred_class,
                model_version="video_statistical_baseline_v1",
                details={"features_processed": EXPECTED_VIDEO_FEATURE_COUNT},
            )
        except Exception as exc:
            logger.error("Video inference error: %s", exc, exc_info=True)
            return ModalityScoreResult(status="failed", error=f"Video inference failed: {exc}")

    # -------------------------------------------------------------------------
    # Multimodal Late Fusion Combiner with Verified Fallbacks
    # -------------------------------------------------------------------------

    def predict_fusion(
        self,
        text_res: ModalityScoreResult,
        audio_res: ModalityScoreResult,
        video_res: ModalityScoreResult,
    ) -> Dict[str, Any]:
        """Combine available unimodal scores using trained meta-classifiers.

        Strict Missing-Modality Rules:
        - 3 completed modalities: Invokes meta_classifier_three_modality_learned [text, audio, video]
        - Text + Audio (Video missing): Invokes meta_classifier_text_audio_learned [text, audio]
        - Text + Video (Audio missing): Invokes meta_classifier_text_video_learned [text, video]
        - Audio + Video (Text missing): Invokes meta_classifier_audio_video_learned [audio, video]
        - 1 completed modality: Returns 'insufficient_data' (no late fusion possible)
        - 0 completed modalities: Returns 'not_available'
        - Never fabricates scores or uses arbitrary zero-fills.
        """
        has_text = text_res.status == "completed" and text_res.score is not None
        has_audio = audio_res.status == "completed" and audio_res.score is not None
        has_video = video_res.status == "completed" and video_res.score is not None

        completed_count = sum([has_text, has_audio, has_video])

        if not self._startup_attempted:
            self.startup()

        fusion_score: Optional[float] = None
        fusion_method: str = "none"
        fusion_status: str = "not_available"
        fusion_weights: Dict[str, float] = {}

        if completed_count == 3:
            # 3-Modality Meta-Classifier
            if self._fusion_3mod is not None:
                try:
                    X_input = np.array([[text_res.score, audio_res.score, video_res.score]], dtype=float)
                    p_fuse = float(self._fusion_3mod.predict_proba(X_input)[0, 1])
                    fusion_score = round(float(np.clip(p_fuse, 0.0, 1.0)), 4)
                    fusion_status = "completed"
                    fusion_method = "learned_stacking_three_modality"
                    coefs = self._fusion_3mod.coef_[0]
                    fusion_weights = {
                        "text": float(coefs[0]),
                        "audio": float(coefs[1]),
                        "video": float(coefs[2]),
                        "intercept": float(self._fusion_3mod.intercept_[0]),
                    }
                except Exception as exc:
                    logger.error("3-modality fusion error: %s", exc)
                    fusion_status = "failed"
            else:
                fusion_status = "unavailable"

        elif completed_count == 2:
            # Verified 2-Modality Fallbacks
            if has_text and has_audio:
                if self._fusion_text_audio is not None:
                    try:
                        X_input = np.array([[text_res.score, audio_res.score]], dtype=float)
                        p_fuse = float(self._fusion_text_audio.predict_proba(X_input)[0, 1])
                        fusion_score = round(float(np.clip(p_fuse, 0.0, 1.0)), 4)
                        fusion_status = "completed"
                        fusion_method = "learned_stacking_text_audio"
                        coefs = self._fusion_text_audio.coef_[0]
                        fusion_weights = {
                            "text": float(coefs[0]),
                            "audio": float(coefs[1]),
                            "intercept": float(self._fusion_text_audio.intercept_[0]),
                        }
                    except Exception as exc:
                        logger.error("Text+Audio fusion error: %s", exc)
                        fusion_status = "failed"
                else:
                    fusion_status = "unavailable"

            elif has_text and has_video:
                if self._fusion_text_video is not None:
                    try:
                        X_input = np.array([[text_res.score, video_res.score]], dtype=float)
                        p_fuse = float(self._fusion_text_video.predict_proba(X_input)[0, 1])
                        fusion_score = round(float(np.clip(p_fuse, 0.0, 1.0)), 4)
                        fusion_status = "completed"
                        fusion_method = "learned_stacking_text_video"
                        coefs = self._fusion_text_video.coef_[0]
                        fusion_weights = {
                            "text": float(coefs[0]),
                            "video": float(coefs[1]),
                            "intercept": float(self._fusion_text_video.intercept_[0]),
                        }
                    except Exception as exc:
                        logger.error("Text+Video fusion error: %s", exc)
                        fusion_status = "failed"
                else:
                    fusion_status = "unavailable"

            elif has_audio and has_video:
                if self._fusion_audio_video is not None:
                    try:
                        X_input = np.array([[audio_res.score, video_res.score]], dtype=float)
                        p_fuse = float(self._fusion_audio_video.predict_proba(X_input)[0, 1])
                        fusion_score = round(float(np.clip(p_fuse, 0.0, 1.0)), 4)
                        fusion_status = "completed"
                        fusion_method = "learned_stacking_audio_video"
                        coefs = self._fusion_audio_video.coef_[0]
                        fusion_weights = {
                            "audio": float(coefs[0]),
                            "video": float(coefs[1]),
                            "intercept": float(self._fusion_audio_video.intercept_[0]),
                        }
                    except Exception as exc:
                        logger.error("Audio+Video fusion error: %s", exc)
                        fusion_status = "failed"
                else:
                    fusion_status = "unavailable"

        elif completed_count == 1:
            fusion_status = "insufficient_data"
            fusion_method = "none"

        else:
            fusion_status = "not_available"
            fusion_method = "none"

        # Cross-Modal Algorithmic Disagreement Analysis
        disagreement_flag = False
        disagreement_details: Dict[str, Any] = {"status": "not_applicable"}

        if completed_count >= 2:
            scores_map: Dict[str, float] = {}
            if has_text and text_res.score is not None:
                scores_map["text"] = text_res.score
            if has_audio and audio_res.score is not None:
                scores_map["audio"] = audio_res.score
            if has_video and video_res.score is not None:
                scores_map["video"] = video_res.score

            mod_keys = list(scores_map.keys())
            pairwise_diffs = []
            for i in range(len(mod_keys)):
                for j in range(i + 1, len(mod_keys)):
                    k1, k2 = mod_keys[i], mod_keys[j]
                    delta = round(abs(scores_map[k1] - scores_map[k2]), 4)
                    pairwise_diffs.append({"pair": f"{k1}_{k2}", "delta": delta})

            max_delta = max(p["delta"] for p in pairwise_diffs) if pairwise_diffs else 0.0
            disagreement_flag = bool(max_delta >= DISAGREEMENT_THRESHOLD)

            disagreement_details = {
                "disagreement_detected": disagreement_flag,
                "max_divergence": max_delta,
                "divergence_threshold": DISAGREEMENT_THRESHOLD,
                "pairwise_divergence": pairwise_diffs,
                "note": (
                    "Algorithmic divergence reflects numerical difference across completed unimodal "
                    "models under benchmark conditions. It does NOT imply psychological concealment "
                    "or somatization."
                ),
            }

        return {
            "fusion_status": fusion_status,
            "fusion_score": fusion_score,
            "fusion_method": fusion_method,
            "fusion_weights": fusion_weights,
            "completed_modality_count": completed_count,
            "disagreement_flag": disagreement_flag,
            "disagreement_details": disagreement_details,
        }

    # -------------------------------------------------------------------------
    # Central Orchestrator
    # -------------------------------------------------------------------------

    def analyze(
        self,
        text: Optional[str] = None,
        audio_features: Optional[Union[Dict[str, float], List[float], np.ndarray]] = None,
        video_features: Optional[Union[List[float], np.ndarray]] = None,
    ) -> Dict[str, Any]:
        """Run complete Stage 1 Three-Modality Inference and Late Fusion.

        Excludes clinical numerical features and EPDS survey items.
        """
        text_result = self.predict_text(text)
        audio_result = self.predict_audio(audio_features)
        video_result = self.predict_video(video_features)

        fusion_result = self.predict_fusion(text_result, audio_result, video_result)

        # Modality statuses map
        modality_status = {
            "text": text_result.status,
            "audio": audio_result.status,
            "video": video_result.status,
        }

        # Overall execution status
        completed_count = sum(1 for s in modality_status.values() if s == "completed")
        failed_count = sum(1 for s in modality_status.values() if s == "failed")

        if completed_count > 0 and failed_count == 0:
            overall_status = "completed"
        elif completed_count > 0:
            overall_status = "partially_completed"
        else:
            overall_status = "failed"

        return {
            "status": overall_status,
            "text_score": text_result.score,
            "audio_score": audio_result.score,
            "video_score": video_result.score,
            "fusion_score": fusion_result["fusion_score"],
            "fusion_status": fusion_result["fusion_status"],
            "fusion_method": fusion_result["fusion_method"],
            "modality_status": modality_status,
            "modalities": {
                "text": text_result.to_dict(),
                "audio": audio_result.to_dict(),
                "video": video_result.to_dict(),
            },
            "disagreement_flag": fusion_result["disagreement_flag"],
            "disagreement_details": fusion_result["disagreement_details"],
            "model_version": "stage1_three_modality_v1",
            "disclaimer": DISCLAIMER_TEXT,
        }


# Global singleton instance
three_modality_service = ThreeModalityInferenceService()
