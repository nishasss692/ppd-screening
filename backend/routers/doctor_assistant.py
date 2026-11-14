"""FastAPI router for the Doctor AI Assistant (Clinician Copilot).

Exposes:
- POST /api/doctor-assistant/chat: Non-diagnostic dashboard navigation and clinical
  workflow assistance for physicians and healthcare teams.

Strict Safety & Privacy:
- Never diagnoses conditions, recommends treatments, or calculates prescriptions.
- Never accepts, processes, or logs patient identifiable information (PHI/PII).
- Reuses existing Gemini infrastructure and configuration.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.doctor_assistant import (
    DoctorAssistantChatRequest,
    DoctorAssistantChatResponse,
)
from backend.services.voice_assistant.doctor_service import (
    DoctorAssistantResponse,
    DoctorAssistantService,
)

logger = logging.getLogger("ppd.doctor_assistant")

router = APIRouter(
    prefix="/api/doctor-assistant",
    tags=["Doctor Assistant"],
)

_doctor_assistant_service: Optional[DoctorAssistantService] = None


def get_doctor_assistant_service() -> DoctorAssistantService:
    """Dependency provider returning singleton DoctorAssistantService instance."""
    global _doctor_assistant_service
    if _doctor_assistant_service is None:
        _doctor_assistant_service = DoctorAssistantService()
    return _doctor_assistant_service


@router.post(
    "/chat",
    response_model=DoctorAssistantChatResponse,
    summary="Clinician Copilot for dashboard navigation & clinical workflow reference",
    description=(
        "Processes clinician queries regarding dashboard features, cross-modal discordance, "
        "and standard EPDS clinical scoring thresholds. Strictly non-diagnostic; refuses "
        "any requests to diagnose patients, prescribe drugs, or process patient identifiable records."
    ),
)
def chat_with_doctor_assistant(
    payload: DoctorAssistantChatRequest,
    service: DoctorAssistantService = Depends(get_doctor_assistant_service),
) -> DoctorAssistantChatResponse:
    """Process a clinician query and return non-diagnostic workflow assistance."""
    logger.info(
        "Doctor assistant query received: input_chars=%d, history_turns=%d",
        len(payload.message),
        len(payload.history) if payload.history else 0,
    )

    try:
        response: DoctorAssistantResponse = service.generate_response(
            user_message=payload.message,
            conversation_history=payload.history,
            raise_on_error=False,
        )

        return DoctorAssistantChatResponse(
            status=response.status,
            text=response.text,
            message=response.text,
            source=response.source,
            model=response.model,
            is_diagnostic=False,
            disclaimer=response.disclaimer,
        )
    except Exception as exc:
        logger.error("Unexpected error in doctor assistant endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the clinician assistant request.",
        ) from exc

