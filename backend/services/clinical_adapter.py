"""Two-Stage Clinical Data Adapter for AANCHAL.

Assembles the exact 46-feature input vector required by the trained
Random Forest clinical screening model (models/clinical_numerical/random_forest.joblib)
by uniting:
  - Stage 1: Persistent Clinical Profile (37 stable demographic, obstetric & medical features)
  - Stage 2: Session Psychosocial Assessment (9 dynamic maternal wellbeing features)

SCIENTIFIC & CLINICAL INTEGRITY SAFEGUARDS:
1. EPDS questionnaire items and total scores are STRICTLY EXCLUDED (Target Leakage Prevention).
2. Exact feature naming, capitalization, and trailing whitespace are strictly preserved
   (notably 'Relax/sleep when newborn is tended ').
3. 'Prefer not to answer' or omitted optional answers map cleanly to 'Missing' or None,
   relying on the trained ClinicalPreprocessor's SimpleImputer.
4. If required dynamic psychosocial inputs are absent or insufficient, clinical prediction
   is marked 'unavailable' rather than fabricating a misleading default prediction.
"""

from typing import Any, Dict, List, Optional, Tuple
import logging

from pipelines.clinical_numerical.config import (
    CATEGORICAL_FEATURES,
    EXCLUDED_COLUMNS,
    NUMERICAL_FEATURES,
    TOTAL_PREDICTOR_COUNT,
)

logger = logging.getLogger("ppd.clinical_adapter")

# Canonical trailing-space constant
FEATURE_RELAX_SLEEP_TENDED = "Relax/sleep when newborn is tended "
FEATURE_HUSBAND_INCOME = "Husband’s monthly income"  # curly apostrophe in trained model
FEATURE_HUSBAND_EDU = "Husband's education level"    # straight apostrophe in trained model

# Canonical value mappings from human-friendly assessment responses to trained model categories
PSYCHOSOCIAL_VALUE_MAPS: Dict[str, Dict[str, str]] = {
    "Feeling about motherhood": {
        "happy": "Happy",
        "joyful": "Happy",
        "neutral": "Neutral",
        "balanced": "Neutral",
        "mixed": "Neutral",
        "sad": "Sad",
        "overwhelmed": "Sad",
        "prefer_not_to_say": "Missing",
    },
    "Relationship with husband": {
        "friendly": "Friendly",
        "very_good": "Friendly",
        "good": "Good",
        "supportive": "Good",
        "neutral": "Neutral",
        "adequate": "Neutral",
        "poor": "Poor",
        "strained": "Poor",
        "bad": "Bad",
        "hostile": "Bad",
        "prefer_not_to_say": "Missing",
        "not_applicable": "Missing",
    },
    "Relationship with the in-laws": {
        "friendly": "Friendly",
        "very_good": "Friendly",
        "good": "Good",
        "supportive": "Good",
        "neutral": "Neutral",
        "adequate": "Neutral",
        "poor": "Poor",
        "strained": "Poor",
        "bad": "Bad",
        "hostile": "Bad",
        "prefer_not_to_say": "Missing",
        "not_applicable": "Missing",
    },
    "Relax/sleep when the newborn is asleep": {
        "yes": "Yes",
        "able_to_rest": "Yes",
        "no": "No",
        "unable_to_sleep": "No",
        "racing_thoughts": "No",
        "prefer_not_to_say": "Missing",
    },
    FEATURE_RELAX_SLEEP_TENDED: {
        "yes": "Yes",
        "able_to_relax": "Yes",
        "no": "No",
        "unable_to_relax": "No",
        "constant_worry": "No",
        "prefer_not_to_say": "Missing",
        "not_applicable": "Missing",
    },
    "Angry after latest child birth": {
        "yes": "Yes",
        "frequent_anger": "Yes",
        "irritability": "Yes",
        "no": "No",
        "calm": "No",
        "rarely": "No",
        "prefer_not_to_say": "Missing",
    },
    "Recieved Support": {
        "high": "High",
        "ample": "High",
        "medium": "Medium",
        "moderate": "Medium",
        "low": "Low",
        "very_little": "Low",
        "none": "Low",
        "prefer_not_to_say": "Missing",
    },
    "Need for Support": {
        "high": "High",
        "urgent": "High",
        "medium": "Medium",
        "moderate": "Medium",
        "low": "Low",
        "minimal": "Low",
        "prefer_not_to_say": "Missing",
    },
    "Trust and share feelings": {
        "yes": "Yes",
        "have_confidant": "Yes",
        "no": "No",
        "no_one": "No",
        "isolated": "No",
        "prefer_not_to_say": "Missing",
    },
}

# The 9 psychosocial features evaluated in Stage 2
STAGE_2_PSYCHOSOCIAL_KEYS = [
    "Feeling about motherhood",
    "Relationship with husband",
    "Relationship with the in-laws",
    "Relax/sleep when the newborn is asleep",
    FEATURE_RELAX_SLEEP_TENDED,
    "Angry after latest child birth",
    "Recieved Support",
    "Need for Support",
    "Trust and share feelings",
]

# The 37 clinical profile features collected in Stage 1
STAGE_1_PROFILE_KEYS = [
    f for f in (NUMERICAL_FEATURES + CATEGORICAL_FEATURES)
    if f not in STAGE_2_PSYCHOSOCIAL_KEYS
]


def normalize_psychosocial_value(feature_name: str, raw_val: Any) -> str:
    """Normalize a raw assessment response to the exact model category."""
    if raw_val is None:
        return "Missing"
    s = str(raw_val).strip()
    if not s:
        return "Missing"
    lower = s.lower().replace("-", "_").replace(" ", "_")
    if "prefer_not_to" in lower or lower in ("not_applicable", "n/a", "missing"):
        return "Missing"
    mapping = PSYCHOSOCIAL_VALUE_MAPS.get(feature_name, {})
    if lower in mapping:
        return mapping[lower]
    # Direct case-insensitive lookup in mapping values
    for target in mapping.values():
        if target.lower() == lower:
            return target
    # If already a valid canonical category
    return s


def assemble_clinical_features(
    clinical_profile: Optional[Dict[str, Any]],
    psychosocial_answers: Optional[Dict[str, Any]],
    fallback_age: Optional[int] = None,
) -> Tuple[Optional[Dict[str, Any]], bool, List[str]]:
    """Assemble the unified 46-feature payload from Stage 1 Profile and Stage 2 Screening.

    Returns:
        Tuple of:
          - features_dict: Exactly 46 key-value pairs ready for ClinicalFeatures schema
          - is_suitable_for_inference: True if inputs have sufficient data for reliable prediction
          - diagnostics: List of warnings, missing reasons, or explanatory notes
    """
    diagnostics: List[str] = []
    profile = dict(clinical_profile or {})
    answers = dict(psychosocial_answers or {})

    # Check Stage 2 Psychosocial completeness
    answered_psychosocial_count = 0
    stage_2_assembled: Dict[str, str] = {}

    for key in STAGE_2_PSYCHOSOCIAL_KEYS:
        # Check direct key or snake_case / friendly alias
        raw_val = answers.get(key)
        if raw_val is None:
            # Try alternate key aliases
            alt_key = key.lower().replace("/", "_").replace(" ", "_").strip()
            raw_val = answers.get(alt_key)
        if raw_val is None and key == FEATURE_RELAX_SLEEP_TENDED:
            raw_val = answers.get("relax_sleep_when_newborn_is_tended") or answers.get("sleep_tended")
        if raw_val is None and key == "Relax/sleep when the newborn is asleep":
            raw_val = answers.get("relax_sleep_when_newborn_is_asleep") or answers.get("sleep_asleep")
        if raw_val is None and key == "Angry after latest child birth":
            raw_val = answers.get("angry_after_childbirth") or answers.get("anger_after_birth")

        norm = normalize_psychosocial_value(key, raw_val)
        stage_2_assembled[key] = norm
        if norm != "Missing":
            answered_psychosocial_count += 1

    # Check Stage 1 Profile presence
    profile_has_data = len(profile) > 0
    if not profile_has_data:
        diagnostics.append("Clinical profile has not been completed by the mother.")

    if answered_psychosocial_count < 5:
        diagnostics.append(
            f"Insufficient psychosocial responses ({answered_psychosocial_count}/9 provided). "
            "Reliable clinical screening inference requires at least 5 answered questions."
        )

    # Assemble all 46 features
    assembled: Dict[str, Any] = {}

    # Numerical: Age
    raw_age = profile.get("Age") or profile.get("age") or fallback_age
    try:
        assembled["Age"] = float(raw_age) if raw_age is not None else None
    except (ValueError, TypeError):
        assembled["Age"] = None

    # Numerical: Number of latest pregnancy
    raw_preg = profile.get("Number of the latest pregnancy") or profile.get("pregnancy_number") or profile.get("number_of_the_latest_pregnancy")
    try:
        assembled["Number of the latest pregnancy"] = float(raw_preg) if raw_preg is not None else 1.0
    except (ValueError, TypeError):
        assembled["Number of the latest pregnancy"] = 1.0

    # Categorical Stage 1 features from profile
    for key in STAGE_1_PROFILE_KEYS:
        if key in ("Age", "Number of the latest pregnancy"):
            continue
        val = profile.get(key)
        if val is None:
            # Try normalized snake_case key
            alt_key = key.lower().replace("'", "").replace("’", "").replace(" ", "_").replace("(", "").replace(")", "")
            val = profile.get(alt_key)
        if val is None:
            assembled[key] = "Missing"
        else:
            val_str = str(val).strip()
            if not val_str or "prefer not to" in val_str.lower() or val_str.lower() in ("not applicable", "n/a"):
                assembled[key] = "Missing"
            else:
                assembled[key] = val_str

    # Categorical Stage 2 features from assessment
    for key, val in stage_2_assembled.items():
        assembled[key] = val

    # Verify zero target leakage
    for excluded in EXCLUDED_COLUMNS:
        if excluded in assembled:
            del assembled[excluded]

    # Verify exactly 46 features assembled
    if len(assembled) != TOTAL_PREDICTOR_COUNT:
        diagnostics.append(
            f"Feature count mismatch: assembled {len(assembled)} features, expected {TOTAL_PREDICTOR_COUNT}."
        )
        return None, False, diagnostics

    is_suitable = profile_has_data and (answered_psychosocial_count >= 5)
    return assembled, is_suitable, diagnostics
