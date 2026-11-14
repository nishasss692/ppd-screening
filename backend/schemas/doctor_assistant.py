"""Pydantic v2 schemas for the Doctor Assistant (Clinician Copilot) endpoint.

Enforces strictly non-diagnostic contracts and zero patient-identifiable data persistence.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class DoctorAssistantChatRequest(BaseModel):
    """Request payload for the Doctor Assistant endpoint."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Clinician query regarding dashboard navigation, workflow, or EPDS clinical references.",
    )
    history: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Optional prior conversational turns formatted as [{'role': 'user'|'model', 'content': '...'}]",
    )


class DoctorAssistantChatResponse(BaseModel):
    """Response payload from the Doctor Assistant endpoint."""

    status: str = Field(
        ...,
        description="'success' if answered via Gemini, 'fallback' if offline/unconfigured, 'refusal' if query breached non-diagnostic boundaries.",
    )
    text: str = Field(..., description="Assistant response text.")
    message: str = Field(..., description="Alias of text field for convenience.")
    source: str = Field(
        ...,
        description="'gemini' | 'safety_filter' | 'fallback'",
    )
    model: Optional[str] = Field(default=None, description="Model identifier if answered via Gemini.")
    is_diagnostic: bool = Field(
        default=False,
        description="Strictly False. The clinician copilot is an informational and navigation aid, not a diagnostic engine.",
    )
    disclaimer: str = Field(
        default=(
            "Miora Clinician Copilot provides workflow and instrument navigation only. Strictly non-diagnostic. "
            "Does not make clinical decisions, diagnose patients, or prescribe treatments."
        ),
        description="Mandatory non-diagnostic legal and clinical boundary declaration.",
    )

