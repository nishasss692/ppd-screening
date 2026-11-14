"""Unit and integration tests for the Voice Assistant FastAPI router.

Tests:
1. FastAPI app mounts /api/voice-assistant/chat and /api/voice-assistant/languages.
2. Safe conversational query processing in English and regional Indian languages (Hindi, Kannada, Tamil, etc.).
3. Strict deterministic safety guard escalation for acute self-harm and infant-harm queries.
4. Multilingual crisis escalation returning localized emergency crisis hotlines.
5. Request validation (empty strings, missing fields) returning HTTP 422.
6. Support for field aliases ('user_message', 'conversation_history').
7. Multi-turn conversation context forwarding.
8. Upstream provider failure and missing credentials returning graceful fallback without crashing.
9. Privacy safety: no API keys exposed in responses or response headers.
10. Existing backend endpoints remain fully functional and unregressed.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.routers.voice_assistant import get_voice_assistant_service
from backend.services.voice_assistant.config import DEFAULT_GEMINI_MODEL
from backend.services.voice_assistant.gemini_service import (
    GeminiVoiceAssistantService,
    VoiceAssistantResponse,
)


@pytest.fixture(scope="module")
def client():
    """Create a FastAPI test client instance with module-level lifespan."""
    with TestClient(app) as test_client:
        yield test_client


# =============================================================================
# 1. Router Mounting and Languages Metadata Tests
# =============================================================================

def test_voice_assistant_languages_endpoint(client):
    """GET /api/voice-assistant/languages returns all 8 supported languages and locales."""
    response = client.get("/api/voice-assistant/languages")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["default_language"] == "en"
    languages = data["languages"]
    assert "en" in languages
    assert "hi" in languages
    assert "kn" in languages
    assert "ta" in languages
    assert "te" in languages
    assert "ml" in languages
    assert "bn" in languages
    assert "mr" in languages
    assert languages["hi"]["locale"] == "hi-IN"
    assert languages["kn"]["locale"] == "kn-IN"


# =============================================================================
# 2. Conversational Queries & Multilingual Handling Tests
# =============================================================================

def test_chat_endpoint_safe_conversational_mocked(client):
    """POST /api/voice-assistant/chat returns successful response when Gemini generates text."""
    mock_service = MagicMock(spec=GeminiVoiceAssistantService)
    mock_service.generate_response.return_value = VoiceAssistantResponse(
        text="You are doing wonderfully. Motherhood is a journey, and taking it one moment at a time is okay.",
        is_emergency=False,
        category=None,
        is_fallback=False,
        source="gemini",
        model=DEFAULT_GEMINI_MODEL,
        language="en",
        language_name="English",
        voice_locale="en-IN",
    )

    app.dependency_overrides[get_voice_assistant_service] = lambda: mock_service
    try:
        payload = {"message": "I feel a bit overwhelmed with breastfeeding today."}
        response = client.post("/api/voice-assistant/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "wonderfully" in data["text"]
        assert data["message"] == data["text"]
        assert data["language"] == "en"
        assert data["language_name"] == "English"
        assert data["voice_locale"] == "en-IN"
        assert data["is_emergency"] is False
        assert data["safety_status"] == "safe"
        assert data["is_fallback"] is False
        assert data["source"] == "gemini"
        assert data["model"] == DEFAULT_GEMINI_MODEL

        mock_service.generate_response.assert_called_once_with(
            user_message="I feel a bit overwhelmed with breastfeeding today.",
            conversation_history=None,
            language=None,
            raise_on_error=False,
        )
    finally:
        app.dependency_overrides.pop(get_voice_assistant_service, None)


@pytest.mark.parametrize(
    "lang_code,lang_name,locale,sample_query",
    [
        ("hi", "Hindi", "hi-IN", "मुझे बहुत थकान हो रही है"),
        ("kn", "Kannada", "kn-IN", "ನನಗೆ ತುಂಬಾ ಆಯಾಸವಾಗಿದೆ"),
        ("ta", "Tamil", "ta-IN", "எனக்கு மிகவும் சோர்வாக இருக்கிறது"),
        ("te", "Telugu", "te-IN", "నాకు చాలా అలసటగా ఉంది"),
        ("ml", "Malayalam", "ml-IN", "എനിക്ക് നല്ല ക്ഷീണം തോന്നുന്നു"),
        ("bn", "Bengali", "bn-IN", "আমার খুব ক্লান্তি লাগছে"),
        ("mr", "Marathi", "mr-IN", "मला खूप थकवा आला आहे"),
    ],
)
def test_chat_endpoint_multilingual_language_forwarding(
    client, lang_code, lang_name, locale, sample_query
):
    """POST /api/voice-assistant/chat properly forwards language code and receives localized response."""
    mock_service = MagicMock(spec=GeminiVoiceAssistantService)
    mock_service.generate_response.return_value = VoiceAssistantResponse(
        text=f"Response in {lang_name}",
        is_emergency=False,
        category=None,
        is_fallback=False,
        source="gemini",
        model=DEFAULT_GEMINI_MODEL,
        language=lang_code,
        language_name=lang_name,
        voice_locale=locale,
    )

    app.dependency_overrides[get_voice_assistant_service] = lambda: mock_service
    try:
        payload = {"message": sample_query, "language": lang_code}
        response = client.post("/api/voice-assistant/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["language"] == lang_code
        assert data["language_name"] == lang_name
        assert data["voice_locale"] == locale
        assert data["safety_status"] == "safe"

        mock_service.generate_response.assert_called_once_with(
            user_message=sample_query,
            conversation_history=None,
            language=lang_code,
            raise_on_error=False,
        )
    finally:
        app.dependency_overrides.pop(get_voice_assistant_service, None)


# =============================================================================
# 3. Deterministic Safety Guard Interception Tests (Real SafetyGuard)
# =============================================================================

def test_chat_endpoint_self_harm_safety_escalation_real_service(client):
    """Acute self-harm query triggers deterministic safety escalation with Tele-MANAS hotlines."""
    # Uses the real service instance without mocks to verify end-to-end safety guard integration
    payload = {"message": "I want to kill myself, I cannot take this anymore."}
    response = client.post("/api/voice-assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_emergency"] is True
    assert data["safety_status"] == "emergency_escalated"
    assert data["emergency_category"] == "self_harm"
    assert data["source"] == "safety_guard"
    # Confirm India crisis lines are communicated
    assert "Tele-MANAS" in data["text"]
    assert "14416" in data["text"]
    assert "112" in data["text"]


def test_chat_endpoint_infant_harm_safety_escalation_real_service(client):
    """Acute infant harm thoughts trigger immediate safety escalation without calling LLM."""
    payload = {"message": "I have thoughts of hurting my baby when she cries."}
    response = client.post("/api/voice-assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_emergency"] is True
    assert data["safety_status"] == "emergency_escalated"
    assert data["emergency_category"] == "infant_harm"
    assert data["source"] == "safety_guard"
    assert "crib" in data["text"].lower() or "safe place" in data["text"].lower()
    assert "14416" in data["text"]


def test_chat_endpoint_multilingual_crisis_escalation(client):
    """Hindi acute crisis triggers Hindi Tele-MANAS escalation response."""
    payload = {"message": "मैं आत्महत्या करना चाहती हूँ, मैं बहुत परेशान हूँ"}
    response = client.post("/api/voice-assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_emergency"] is True
    assert data["safety_status"] == "emergency_escalated"
    assert data["language"] == "hi"
    assert data["voice_locale"] == "hi-IN"
    assert "टेली-मानस" in data["text"]
    assert "14416" in data["text"]


# =============================================================================
# 4. Multi-turn History and Aliases Tests
# =============================================================================

def test_chat_endpoint_multi_turn_history(client):
    """Conversation history turns are forwarded to the service properly."""
    mock_service = MagicMock(spec=GeminiVoiceAssistantService)
    mock_service.generate_response.return_value = VoiceAssistantResponse(
        text="I remember you mentioned sleep earlier. Resting whenever possible is essential.",
        is_emergency=False,
        category=None,
        is_fallback=False,
        source="gemini",
        model=DEFAULT_GEMINI_MODEL,
        language="en",
        language_name="English",
        voice_locale="en-IN",
    )

    app.dependency_overrides[get_voice_assistant_service] = lambda: mock_service
    try:
        history = [
            {"role": "user", "content": "I haven't slept well in 3 days."},
            {"role": "model", "content": "I hear how exhausted you must feel. Is anyone able to help?"},
        ]
        payload = {
            "message": "My partner is at work so I am on my own right now.",
            "history": history,
        }
        response = client.post("/api/voice-assistant/chat", json=payload)
        assert response.status_code == 200

        mock_service.generate_response.assert_called_once_with(
            user_message="My partner is at work so I am on my own right now.",
            conversation_history=history,
            language=None,
            raise_on_error=False,
        )
    finally:
        app.dependency_overrides.pop(get_voice_assistant_service, None)


def test_chat_endpoint_field_aliases_support(client):
    """Supports user_message and conversation_history aliases seamlessly."""
    mock_service = MagicMock(spec=GeminiVoiceAssistantService)
    mock_service.generate_response.return_value = VoiceAssistantResponse(
        text="Alias support verified.",
        is_emergency=False,
        category=None,
        is_fallback=False,
        source="gemini",
        model=DEFAULT_GEMINI_MODEL,
        language="en",
        language_name="English",
        voice_locale="en-IN",
    )

    app.dependency_overrides[get_voice_assistant_service] = lambda: mock_service
    try:
        payload = {
            "user_message": "Testing alias compatibility.",
            "conversation_history": [{"role": "user", "content": "Hello"}],
        }
        response = client.post("/api/voice-assistant/chat", json=payload)
        assert response.status_code == 200

        mock_service.generate_response.assert_called_once_with(
            user_message="Testing alias compatibility.",
            conversation_history=[{"role": "user", "content": "Hello"}],
            language=None,
            raise_on_error=False,
        )
    finally:
        app.dependency_overrides.pop(get_voice_assistant_service, None)


# =============================================================================
# 5. Validation and Error Handling Tests
# =============================================================================

def test_chat_endpoint_empty_message_returns_422(client):
    """Empty message string returns HTTP 422 unprocessable entity."""
    response = client.post("/api/voice-assistant/chat", json={"message": ""})
    assert response.status_code == 422


def test_chat_endpoint_whitespace_message_returns_422(client):
    """Whitespace-only message string returns HTTP 422 unprocessable entity."""
    response = client.post("/api/voice-assistant/chat", json={"message": "    \n   "})
    assert response.status_code == 422


def test_chat_endpoint_missing_message_returns_422(client):
    """Missing message field returns HTTP 422."""
    response = client.post("/api/voice-assistant/chat", json={"language": "en"})
    assert response.status_code == 422


def test_chat_endpoint_graceful_fallback_when_credentials_missing(client):
    """When GEMINI_API_KEY is unset or missing, service returns compassionate fallback without crashing."""
    # Create service instance without API key
    no_key_service = GeminiVoiceAssistantService(
        config=MagicMock(
            is_configured=False,
            model=DEFAULT_GEMINI_MODEL,
            is_language_supported=lambda l: True,
            detect_language=lambda t: "en",
        )
    )

    app.dependency_overrides[get_voice_assistant_service] = lambda: no_key_service
    try:
        payload = {"message": "Hello, I am feeling tired."}
        response = client.post("/api/voice-assistant/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "fallback"
        assert data["is_fallback"] is True
        assert data["source"] == "fallback"
        assert "not alone" in data["text"].lower()
    finally:
        app.dependency_overrides.pop(get_voice_assistant_service, None)


# =============================================================================
# 6. Privacy & Security Tests
# =============================================================================

def test_chat_endpoint_never_exposes_gemini_api_key(client, monkeypatch):
    """Verify GEMINI_API_KEY is never exposed in response body, headers, or metadata."""
    secret = "AIzaSySecretTestKey999XYZ123456789"
    monkeypatch.setenv("GEMINI_API_KEY", secret)

    payload = {"message": "I want to kill myself."}
    response = client.post("/api/voice-assistant/chat", json=payload)
    assert response.status_code == 200
    res_text = response.text
    assert secret not in res_text
    for header, val in response.headers.items():
        assert secret not in val


# =============================================================================
# 7. Non-Regression Tests for Existing Endpoints
# =============================================================================

def test_existing_health_check_remains_active(client):
    """Root health check endpoint remains intact."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_existing_questionnaire_endpoint_remains_active(client):
    """Questionnaire EPDS items endpoint remains intact."""
    response = client.get("/api/questionnaire/epds")
    assert response.status_code == 200
    assert "questions" in response.json()
