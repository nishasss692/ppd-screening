"""Clinician Dashboard Copilot Service powered by Gemini.

Provides strictly non-diagnostic dashboard navigation, workflow guidance,
and EPDS clinical reference information for licensed clinicians.

Strict Security & Non-Diagnostic Controls:
- Never diagnoses patients or suggests patient-specific medical treatments.
- Never accepts, processes, or persists patient identifiable information (PHI/PII).
- Reuses existing Gemini credentials and config without creating secondary providers.
- Fully non-diagnostic with mandatory clinical disclaimers.
"""

from dataclasses import dataclass
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from backend.services.voice_assistant.config import (
    DEFAULT_GEMINI_MODEL,
    VoiceAssistantConfig,
    get_voice_assistant_config,
)
from backend.services.voice_assistant.gemini_service import (
    GeminiCredentialsMissingError,
    GeminiProviderError,
    GeminiServiceError,
)

logger = logging.getLogger("ppd.doctor_assistant")

DOCTOR_SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent / "doctor_system_prompt.txt"

FALLBACK_DOCTOR_RESPONSES = {
    "discordance": (
        "Cross-modal discordance in Miora analyzes divergence between a mother's subjective self-report "
        "(EPDS score) and objective nonverbal acoustic and facial affective signals. When a mother reports "
        "low distress but displays flat affect, psychomotor retardation, or reduced vocal dynamics, the system "
        "flags a potential masked depression pattern for clinician review. This is an exploratory screening signal, "
        "not a clinical diagnosis."
    ),
    "epds": (
        "The Edinburgh Postnatal Depression Scale (EPDS) is a 10-item self-report screening instrument evaluating "
        "feelings over the prior 7 days. Standard validated cutoffs are:\n"
        "• 0–9: Low likelihood of depressive illness (routine postpartum follow-up).\n"
        "• 10–12: Possible depression (repeat screening in 2 weeks with focused clinical review).\n"
        "• 13–30: Probable depression (immediate comprehensive diagnostic evaluation and referral).\n"
        "• Item 10 (Self-Harm): Any non-zero score (1, 2, or 3) triggers an immediate human clinical safety evaluation "
        "regardless of the total score. National helpline: Tele-MANAS (14416 / 1800-891-4416)."
    ),
    "review": (
        "The Clinical Review screen (/clinical-review) enables the attending clinician to evaluate AI multimodal "
        "findings against clinical judgment. Clinicians can enter diagnostic impressions, document disagreement "
        "rationales when diverging from AI risk estimates, select individualized care plan components, and sign "
        "off on the formal clinical note."
    ),
    "navigation": (
        "Miora Clinician Dashboard Navigation:\n"
        "• Dashboard (/dashboard): KPI summary, high-priority cases, recent screenings.\n"
        "• Mothers & Cases (/mothers): Searchable patient directory with risk filters.\n"
        "• Screening (/live-screening, /upload-analyze): Multimodal live capture & file uploads.\n"
        "• Results (/results): Modality breakdown (text, audio, video, EPDS).\n"
        "• Discordance (/discordance): Cross-modal divergence assessment.\n"
        "• Insights & Care (/insights): Care planning milestones and follow-ups.\n"
        "• Clinical Review (/clinical-review): Final clinical sign-off and note export."
    ),
    "general": (
        "Miora Clinician Copilot provides guidance on dashboard navigation, multimodal feature workflows, "
        "and EPDS instrument interpretation. Please ask about specific dashboard sections (e.g., Discordance, "
        "Results, Clinical Review) or standard EPDS scoring thresholds. Note that this assistant is strictly "
        "non-diagnostic and does not process patient identifiable data or make treatment decisions."
    ),
}


@dataclass
class DoctorAssistantResponse:
    """Structured response from the Doctor Assistant."""

    text: str
    status: str = "success"  # "success" | "fallback" | "refusal"
    source: str = "gemini"   # "gemini" | "safety_filter" | "fallback"
    model: Optional[str] = None
    is_diagnostic: bool = False
    disclaimer: str = (
        "Miora Clinician Copilot provides workflow and instrument navigation only. Strictly non-diagnostic. "
        "Does not make clinical decisions, diagnose patients, or prescribe treatments."
    )


class DoctorAssistantService:
    """Service providing non-diagnostic workflow assistance for clinicians."""

    def __init__(
        self,
        config: Optional[VoiceAssistantConfig] = None,
        client: Optional[Any] = None,
        system_prompt_path: Optional[Path] = None,
    ) -> None:
        self.config: VoiceAssistantConfig = config or get_voice_assistant_config()
        self._client: Optional[Any] = client
        self.system_prompt_path: Path = system_prompt_path or DOCTOR_SYSTEM_PROMPT_PATH
        self._cached_prompt: Optional[str] = None

    def get_system_prompt(self) -> str:
        """Load and cache the clinician copilot system prompt."""
        if self._cached_prompt is None:
            if not self.system_prompt_path.exists():
                raise FileNotFoundError(
                    f"Doctor assistant system prompt file not found at: {self.system_prompt_path}"
                )
            self._cached_prompt = self.system_prompt_path.read_text(encoding="utf-8").strip()
        return self._cached_prompt

    def _get_client(self) -> Any:
        """Lazily initialize the google-genai Client."""
        if self._client is not None:
            return self._client

        if not self.config.is_configured:
            raise GeminiCredentialsMissingError(
                "Gemini API key is missing. Set GEMINI_API_KEY in the environment or configuration."
            )

        self._client = genai.Client(api_key=self.config.api_key)
        return self._client

    def evaluate_boundaries(self, query: str) -> Optional[DoctorAssistantResponse]:
        """Verify that the clinician query adheres strictly to non-diagnostic & privacy boundaries.

        Returns:
            DoctorAssistantResponse with status='refusal' if query violates boundaries, else None.
        """
        clean = query.strip().lower()

        # 1. Check for Diagnostic or Prescriptive Demands
        diagnostic_patterns = [
            r"\b(diagnose|confirm diagnosis of|does (she|this patient) have (depression|ppd|psychosis))\b",
            r"\b(prescribe|medication dosage|which drug|start her on (sertraline|ssri|antidepressant|fluoxetine|zoloft))\b",
            r"\b(what dose|treatment plan for this specific patient|prescriptive order)\b",
        ]
        for pattern in diagnostic_patterns:
            if re.search(pattern, clean):
                return DoctorAssistantResponse(
                    text=(
                        "Non-Diagnostic Clinical Boundary Notice: The Miora Clinician Copilot is strictly an informational "
                        "and navigation tool. It cannot diagnose patients, prescribe medications, or recommend patient-specific "
                        "treatment plans. All clinical diagnoses and pharmacological decisions are the sole responsibility of the "
                        "licensed attending clinician in accordance with standard medical practice."
                    ),
                    status="refusal",
                    source="safety_filter",
                    is_diagnostic=False,
                )

        # 2. Check for Patient Identifiable Information (PHI/PII)
        phi_patterns = [
            r"\b(mrn|patient name|ssn|aadhaar|dob|date of birth)\s*[:=]\s*\w+",
            r"\bpatient\s+(?:named|is)\s+[A-Z][a-z]+",
            r"\b\d{3}-\d{2}-\d{4}\b",  # SSN-like
            r"\b\d{10,12}\b",          # Phone or ID-like numbers
        ]
        for pattern in phi_patterns:
            if re.search(pattern, clean):
                return DoctorAssistantResponse(
                    text=(
                        "Patient Privacy Boundary Notice: To ensure compliance with HIPAA, patient privacy regulations, and "
                        "clinical data governance, patient identifiable data (such as patient names, identifiers, or MRNs) "
                        "must never be submitted to the AI assistant. Please phrase queries generically regarding workflow, "
                        "features, or screening guidelines."
                    ),
                    status="refusal",
                    source="safety_filter",
                    is_diagnostic=False,
                )

        return None

    def generate_response(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        raise_on_error: bool = False,
    ) -> DoctorAssistantResponse:
        """Generate a clinician workflow/navigation response or enforce non-diagnostic boundaries.

        Args:
            user_message: Query from the clinician.
            conversation_history: Optional prior conversation turns.
            raise_on_error: If True, raises exceptions on Gemini failures.

        Returns:
            DoctorAssistantResponse with response text, status, and disclaimer.
        """
        if not user_message or not user_message.strip():
            raise ValueError("user_message cannot be empty or whitespace.")

        clean_message = user_message.strip()
        history = conversation_history or []

        # 1. Enforce strict non-diagnostic and privacy boundaries
        boundary_violation = self.evaluate_boundaries(clean_message)
        if boundary_violation is not None:
            logger.warning("Doctor assistant query breached clinical or privacy boundaries.")
            return boundary_violation

        # 2. Select appropriate localized fallback
        clean_lower = clean_message.lower()
        if "discordance" in clean_lower or "cross-modal" in clean_lower:
            fallback_text = FALLBACK_DOCTOR_RESPONSES["discordance"]
        elif "epds" in clean_lower or "cutoff" in clean_lower or "score" in clean_lower or "item 10" in clean_lower:
            fallback_text = FALLBACK_DOCTOR_RESPONSES["epds"]
        elif "review" in clean_lower or "sign-off" in clean_lower or "clinical note" in clean_lower:
            fallback_text = FALLBACK_DOCTOR_RESPONSES["review"]
        elif "navigate" in clean_lower or "where" in clean_lower or "screen" in clean_lower or "dashboard" in clean_lower:
            fallback_text = FALLBACK_DOCTOR_RESPONSES["navigation"]
        else:
            fallback_text = FALLBACK_DOCTOR_RESPONSES["general"]

        # 3. Check client credentials
        try:
            client = self._get_client()
        except GeminiCredentialsMissingError:
            logger.info("Doctor assistant running in verified fallback mode (no Gemini API key).")
            if raise_on_error:
                raise
            return DoctorAssistantResponse(
                text=fallback_text,
                status="fallback",
                source="fallback",
                model=self.config.model,
                is_diagnostic=False,
            )

        # 4. Format conversation history into google-genai Content structures
        contents: List[types.Content] = []
        for turn in history:
            role_raw = turn.get("role", "user").lower()
            role = "model" if role_raw in ("assistant", "model") else "user"
            turn_content = turn.get("content", "").strip()
            if turn_content:
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=turn_content)],
                    )
                )

        # Append current clinician query
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=clean_message)],
            )
        )

        generate_config = types.GenerateContentConfig(
            system_instruction=self.get_system_prompt(),
            temperature=0.4,  # Lower temperature for objective, precise clinical explanations
            max_output_tokens=400,
        )

        try:
            response = client.models.generate_content(
                model=self.config.model,
                contents=contents,
                config=generate_config,
            )

            response_text = ""
            if hasattr(response, "text") and response.text:
                response_text = response.text.strip()
            elif hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "content") and candidate.content:
                    parts = candidate.content.parts or []
                    response_text = "".join(
                        p.text for p in parts if hasattr(p, "text") and p.text
                    ).strip()

            if not response_text:
                response_text = fallback_text

            return DoctorAssistantResponse(
                text=response_text,
                status="success",
                source="gemini",
                model=self.config.model,
                is_diagnostic=False,
            )
        except Exception as exc:
            logger.warning("Gemini invocation failed in doctor assistant, using fallback: %s", exc)
            if raise_on_error:
                raise GeminiProviderError(str(exc)) from exc
            return DoctorAssistantResponse(
                text=fallback_text,
                status="fallback",
                source="fallback",
                model=self.config.model,
                is_diagnostic=False,
            )

