"""Pydantic v2 schemas for the Voice Assistant chat endpoint.

Ensures strict validation of maternal chat requests and structured,
privacy-safe voice assistant responses with complete language and safety metadata.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class VoiceAssistantChatTurn(BaseModel):
    """A single previous turn in a multi-turn conversation."""

    model_config = ConfigDict(extra="ignore")

    role: str = Field(
        ...,
        description="Speaker role: 'user', 'model', or 'assistant'",
    )
    content: str = Field(
        ...,
        min_length=1,
        description="Text content of the message turn",
    )


class VoiceAssistantChatRequest(BaseModel):
    """Request payload for maternal AI voice assistant conversation."""

    model_config = ConfigDict(extra="ignore")

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Maternal user query or message (from text or speech recognition transcript)",
    )
    history: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Optional conversation history turns [{'role': 'user'|'model', 'content': '...'}]",
    )
    language: Optional[str] = Field(
        default=None,
        description="Optional ISO 639-1 language code (e.g. 'en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr')",
    )

    @field_validator("message")
    @classmethod
    def validate_message_not_blank(cls, v: str) -> str:
        """Validate that message contains non-whitespace text."""
        clean = v.strip()
        if not clean:
            raise ValueError("message cannot be empty or whitespace.")
        return clean

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        """Normalize common alternative field names for caller flexibility."""
        if isinstance(data, dict):
            # Support user_message as alias for message
            if "message" not in data and "user_message" in data:
                data["message"] = data["user_message"]
            # Support conversation_history as alias for history
            if "history" not in data and "conversation_history" in data:
                data["history"] = data["conversation_history"]
        return data


class VoiceAssistantChatResponse(BaseModel):
    """Structured response contract from the Voice Assistant."""

    model_config = ConfigDict(extra="ignore")

    status: str = Field(
        default="success",
        description="Response execution status ('success' or 'fallback')",
    )
    text: str = Field(
        ...,
        description="Empathetic assistant response or immediate crisis helpline guidance",
    )
    message: str = Field(
        ...,
        description="Response text (alias for text field for frontend client convenience)",
    )
    language: str = Field(
        ...,
        description="Detected or resolved ISO 639-1 language code (e.g. 'en', 'hi', 'kn')",
    )
    language_name: str = Field(
        ...,
        description="Display name of the resolved language (e.g. 'English', 'Hindi')",
    )
    voice_locale: str = Field(
        ...,
        description="BCP-47 speech recognition / TTS voice locale (e.g. 'en-IN', 'hi-IN')",
    )
    is_emergency: bool = Field(
        default=False,
        description="Whether deterministic safety guard triggered acute emergency escalation",
    )
    safety_status: str = Field(
        ...,
        description="Standardized safety flag: 'safe' or 'emergency_escalated'",
    )
    emergency_category: Optional[str] = Field(
        default=None,
        description="Emergency crisis category if escalated (e.g. 'self_harm', 'infant_harm')",
    )
    is_fallback: bool = Field(
        default=False,
        description="Whether response is a graceful compassionate fallback due to connectivity or credentials",
    )
    source: str = Field(
        ...,
        description="Generation origin: 'gemini', 'safety_guard', or 'fallback'",
    )
    model: Optional[str] = Field(
        default=None,
        description="Underlying Gemini LLM model identifier if LLM was invoked",
    )


__all__ = [
    "VoiceAssistantChatTurn",
    "VoiceAssistantChatRequest",
    "VoiceAssistantChatResponse",
]

