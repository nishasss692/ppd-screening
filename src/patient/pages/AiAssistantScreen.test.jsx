import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatientProvider } from '../context/PatientContext.jsx';
import { ClinicalProvider } from '../../dashboard/context/ClinicalContext.jsx';
import { AiAssistantScreen } from './AiAssistantScreen.jsx';
import * as voiceService from '../services/voiceAssistantService.js';

function renderAssistant() {
  return render(
    <ClinicalProvider>
      <PatientProvider>
        <MemoryRouter>
          <AiAssistantScreen />
        </MemoryRouter>
      </PatientProvider>
    </ClinicalProvider>
  );
}

describe('AiAssistantScreen — Voice Assistant Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }

    // Mock window.speechSynthesis
    window.speechSynthesis = {
      speak: vi.fn((utterance) => {
        if (utterance.onstart) utterance.onstart();
      }),
      cancel: vi.fn(),
      paused: false,
      speaking: false,
    };

    // Mock window.SpeechSynthesisUtterance
    window.SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
      text,
      lang: 'en-IN',
      rate: 0.95,
      pitch: 1.0,
      onstart: null,
      onend: null,
      onerror: null,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the header, language selector, mood row, prompt chips, and initial conversation', async () => {
    renderAssistant();

    // Verify Title & Tag
    expect(screen.getByRole('heading', { level: 1, name: /Your AI Companion/i })).toBeInTheDocument();
    expect(screen.getByText(/Miora AI/i)).toBeInTheDocument();
    expect(screen.getByText('AI ASSISTANT')).toBeInTheDocument();

    // Verify Language Selector exists with 8 languages and Auto
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    expect(langSelect).toBeInTheDocument();
    expect(screen.getByText(/Auto Language/i)).toBeInTheDocument();
    expect(screen.getByText(/हिन्दी \(Hindi\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ಕನ್ನಡ \(Kannada\)/i)).toBeInTheDocument();

    // Verify Full-Screen Holographic AI Assistant Stage & Greeting
    expect(screen.getByLabelText(/Miora AI Assistant Hologram/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Miora AI Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/How can I help support you today\?/i)).toBeInTheDocument();
    expect(screen.getByText('SMART')).toBeInTheDocument();
    expect(screen.getByText('ADAPTIVE')).toBeInTheDocument();
    expect(screen.getByText('SECURE')).toBeInTheDocument();
    expect(screen.queryByText('Your Mood Today')).not.toBeInTheDocument();
    expect(screen.queryByText('How I Can Help')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick Resources')).not.toBeInTheDocument();
  });

  it('sends user message to backend Gemini API and renders returned response with model tag', async () => {
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'You are doing great. It is completely normal to feel exhausted in the first few weeks.',
      message: 'You are doing great. It is completely normal to feel exhausted in the first few weeks.',
      language: 'en',
      language_name: 'English',
      voice_locale: 'en-IN',
      is_emergency: false,
      safety_status: 'safe',
      emergency_category: null,
      is_fallback: false,
      source: 'gemini',
      model: 'gemini-2.5-flash',
    });

    renderAssistant();

    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'How can I cope with sleep deprivation?' } });
    expect(input.value).toBe('How can I cope with sleep deprivation?');

    fireEvent.click(sendBtn);

    // User message immediately renders in UI
    expect(screen.getByText('How can I cope with sleep deprivation?')).toBeInTheDocument();

    // Backend service called with payload and conversation history
    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.message).toBe('How can I cope with sleep deprivation?');
    expect(Array.isArray(callArgs.history)).toBe(true);
    expect(callArgs.history.length).toBeGreaterThanOrEqual(3);

    // Assistant response renders
    await waitFor(() => {
      expect(screen.getByText(/It is completely normal to feel exhausted in the first few weeks/i)).toBeInTheDocument();
    });

    // Model tag displays
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument();
  });

  it('renders deterministic emergency crisis escalation when backend detects acute crisis', async () => {
    vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'Please connect with immediate crisis support. In India: Call Tele-MANAS toll-free at 14416 or call 112.',
      message: 'Please connect with immediate crisis support. In India: Call Tele-MANAS toll-free at 14416 or call 112.',
      language: 'en',
      language_name: 'English',
      voice_locale: 'en-IN',
      is_emergency: true,
      safety_status: 'emergency_escalated',
      emergency_category: 'self_harm',
      is_fallback: false,
      source: 'safety_guard',
      model: null,
    });

    renderAssistant();

    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    fireEvent.change(input, { target: { value: 'I want to kill myself, I cannot handle this.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    // Emergency response renders with crisis banner and hotline
    await waitFor(() => {
      expect(screen.getByText(/Urgent Crisis Support Helpline/i)).toBeInTheDocument();
      expect(screen.getByText(/Tele-MANAS toll-free at 14416/i)).toBeInTheDocument();
      expect(screen.getByText('Safety Guard')).toBeInTheDocument();
    });
  });

  it('honestly displays fallback response when backend operates in offline fallback mode', async () => {
    vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValueOnce({
      status: 'fallback',
      text: 'I am having a brief connection issue right now, but please know you are not alone and you are doing a wonderful job.',
      message: 'I am having a brief connection issue right now, but please know you are not alone and you are doing a wonderful job.',
      language: 'en',
      language_name: 'English',
      voice_locale: 'en-IN',
      is_emergency: false,
      safety_status: 'safe',
      is_fallback: true,
      source: 'fallback',
      model: null,
    });

    renderAssistant();

    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    fireEvent.change(input, { target: { value: 'Can you hear me?' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/I am having a brief connection issue right now/i)).toBeInTheDocument();
      expect(screen.getByText('Support Notice')).toBeInTheDocument();
    });
  });

  it('forwards selected language to backend API and updates speech recognition locale', async () => {
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'ನಮಸ್ಕಾರ, ನೀವು ಅದ್ಭುತವಾಗಿ ತಾಯ್ತನ ನಿಭಾಯಿಸುತ್ತಿದ್ದೀರಿ.',
      message: 'ನಮಸ್ಕಾರ, ನೀವು ಅದ್ಭುತವಾಗಿ ತಾಯ್ತನ ನಿಭಾಯಿಸುತ್ತಿದ್ದೀರಿ.',
      language: 'kn',
      language_name: 'Kannada',
      voice_locale: 'kn-IN',
      is_emergency: false,
      safety_status: 'safe',
      is_fallback: false,
      source: 'gemini',
      model: 'gemini-2.5-flash',
    });

    renderAssistant();

    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'kn' } });
    expect(langSelect.value).toBe('kn');

    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    fireEvent.change(input, { target: { value: 'ನನಗೆ ಸಹಾಯ ಬೇಕು' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'ನನಗೆ ಸಹಾಯ ಬೇಕು',
          language: 'kn',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/ನಮಸ್ಕಾರ, ನೀವು ಅದ್ಭುತವಾಗಿ ತಾಯ್ತನ ನಿಭಾಯಿಸುತ್ತಿದ್ದೀರಿ/i)).toBeInTheDocument();
    });
  });

  it('triggers speech synthesis when clicking Listen button and uses voice locale', async () => {
    renderAssistant();

    const listenButtons = screen.getAllByRole('button', { name: /Read response aloud/i });
    expect(listenButtons.length).toBeGreaterThan(0);

    fireEvent.click(listenButtons[0]);

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    const utteranceArg = window.speechSynthesis.speak.mock.calls[0][0];
    expect(utteranceArg.text).toContain('Miora');
  });

  it('handles network failure gracefully with compassionate fallback message', async () => {
    vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockRejectedValueOnce(
      new Error('Failed to fetch')
    );

    renderAssistant();

    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    fireEvent.change(input, { target: { value: 'Hello network failure test' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/I am having a brief connection issue right now/i)).toBeInTheDocument();
      expect(screen.getByText('Support Notice')).toBeInTheDocument();
    });
  });

  it('triggers message send upon clicking suggested prompt chips', async () => {
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'Here are 3 grounding coping strategies.',
      message: 'Here are 3 grounding coping strategies.',
      language: 'en',
      language_name: 'English',
      voice_locale: 'en-IN',
      is_emergency: false,
      safety_status: 'safe',
      is_fallback: false,
      source: 'gemini',
      model: 'gemini-2.5-flash',
    });

    renderAssistant();

    const copingChip = screen.getByRole('button', { name: /Coping Strategies/i });
    fireEvent.click(copingChip);

    expect(screen.getByText(/Could you share some simple coping strategies\?/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could you share some simple coping strategies?',
        })
      );
    });
  });
});
