"""FastAPI router for the Gemini-powered Multilingual Voice Assistant.

Exposes:
- POST /api/voice-assistant/chat: Empathetic conversational AI with deterministic
  crisis safety guard, multilingual detection, and voice playback metadata.
- GET /api/voice-assistant/languages: Metadata for all supported maternal languages.

Privacy and Safety:
- Never exposes GEMINI_API_KEY to callers or clients.
- Never logs raw patient narratives, prompts, or conversation history.
- Emergency self-harm / infant-harm triggers immediately bypass LLM inference
  and return validated 24/7 crisis hotlines.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.voice_assistant import (
    VoiceAssistantChatRequest,
    VoiceAssistantChatResponse,
)
from backend.services.voice_assistant.config import (
    DEFAULT_GEMINI_MODEL,
    SUPPORTED_LANGUAGES,
    VoiceAssistantConfig,
    get_voice_assistant_config,
)
from backend.services.voice_assistant.gemini_service import (
    GeminiCredentialsMissingError,
    GeminiProviderError,
    GeminiServiceError,
    GeminiVoiceAssistantService,
    VoiceAssistantResponse,
)

logger = logging.getLogger("ppd.voice_assistant")

router = APIRouter(
    prefix="/api/voice-assistant",
    tags=["Voice Assistant"],
)

# Singleton service instance with lazy client initialization
_voice_assistant_service: Optional[GeminiVoiceAssistantService] = None


def get_voice_assistant_service() -> GeminiVoiceAssistantService:
    """Dependency provider for GeminiVoiceAssistantService."""
    global _voice_assistant_service
    if _voice_assistant_service is None:
        _voice_assistant_service = GeminiVoiceAssistantService()
    return _voice_assistant_service


@router.post(
    "/chat",
    response_model=VoiceAssistantChatResponse,
    summary="Generate empathetic voice assistant response",
    description=(
        "Processes maternal chat messages and voice transcripts across 8 supported Indian "
        "and global languages (en, hi, kn, ta, te, ml, bn, mr). Incorporates multi-turn "
        "conversation context, automatic language detection, and strict deterministic crisis "
        "safety interception for acute self-harm or infant-harm ideation."
    ),
)
def chat_with_voice_assistant(
    payload: VoiceAssistantChatRequest,
    service: GeminiVoiceAssistantService = Depends(get_voice_assistant_service),
) -> VoiceAssistantChatResponse:
    """Process a maternal user message and return an empathetic or emergency response."""
    # Privacy-safe logging: log only character length, language code, and turn count
    history_turns = len(payload.history) if payload.history else 0
    logger.info(
        "Voice assistant chat request: input_chars=%d, history_turns=%d, requested_lang=%s",
        len(payload.message),
        history_turns,
        payload.language,
    )

    try:
        # Call the existing GeminiVoiceAssistantService
        # raise_on_error=False ensures provider failures return localized compassionate fallbacks
        service_response: VoiceAssistantResponse = service.generate_response(
            user_message=payload.message,
            conversation_history=payload.history,
            language=payload.language,
            raise_on_error=False,
        )

        safety_status = "emergency_escalated" if service_response.is_emergency else "safe"
        exec_status = "fallback" if service_response.is_fallback else "success"

        return VoiceAssistantChatResponse(
            status=exec_status,
            text=service_response.text,
            message=service_response.text,
            language=service_response.language,
            language_name=service_response.language_name,
            voice_locale=service_response.voice_locale,
            is_emergency=service_response.is_emergency,
            safety_status=safety_status,
            emergency_category=service_response.category,
            is_fallback=service_response.is_fallback,
            source=service_response.source,
            model=service_response.model,
        )

    except ValueError as exc:
        logger.warning("Voice assistant validation error: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        # Privacy-safe logging: log only exception type, never patient prompt
        logger.error(
            "Voice assistant unexpected failure: error_type=%s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The voice assistant service encountered an unexpected error.",
        ) from exc


@router.get(
    "/languages",
    summary="List supported maternal languages and voice locales",
    description="Returns metadata for all 8 supported Indian and global languages with BCP-47 voice locales.",
)
def get_supported_languages() -> Dict[str, Any]:
    """Return dictionary of supported languages and voice synthesis locales."""
    return {
        "status": "success",
        "default_language": "en",
        "languages": SUPPORTED_LANGUAGES,
    }

