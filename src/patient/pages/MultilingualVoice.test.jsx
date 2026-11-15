import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatientProvider } from '../context/PatientContext.jsx';
import { ClinicalProvider } from '../../dashboard/context/ClinicalContext.jsx';
import { AiAssistantScreen } from './AiAssistantScreen.jsx';
import * as voiceService from '../services/voiceAssistantService.js';
import canonicalQuestionsJson from '../../../data/questions.json';

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

describe('MIORA Phase 6 — Multilingual Voice Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }

    // Default mock for window.speechSynthesis
    window.speechSynthesis = {
      speak: vi.fn((u) => u?.onstart?.()),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [
        { lang: 'en-IN', name: 'English India', default: true },
        { lang: 'hi-IN', name: 'Hindi India', default: false },
      ]),
      paused: false,
      speaking: false,
    };

    window.SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
      text,
      lang: 'en-IN',
      rate: 0.95,
      pitch: 1.0,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies support for strictly the 8 authorized languages and no unsupported languages like Gujarati', () => {
    const supportedKeys = Object.keys(voiceService.SUPPORTED_LANGUAGES_MAP);

    // Must be exactly 8 languages
    expect(supportedKeys).toHaveLength(8);
    expect(supportedKeys).toEqual(
      expect.arrayContaining(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr'])
    );

    // Strictly ensure Gujarati or any unimplemented language is NOT supported
    expect(supportedKeys).not.toContain('gu');
    expect(voiceService.SUPPORTED_LANGUAGES_MAP['gu']).toBeUndefined();

    renderAssistant();
    const select = screen.getByRole('combobox', { name: /Select conversation language/i });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

    expect(options.some((txt) => /Gujarati/i.test(txt))).toBe(false);
    expect(options.some((txt) => /Hindi/i.test(txt))).toBe(true);
    expect(options.some((txt) => /Kannada/i.test(txt))).toBe(true);
    expect(options.some((txt) => /Tamil/i.test(txt))).toBe(true);
    expect(options.some((txt) => /Telugu/i.test(txt))).toBe(true);
    expect(options.some((txt) => /Malayalam/i.test(txt))).toBe(true);
    expect(options.some((txt) => /Bengali/i.test(txt))).toBe(true);
    expect(options.some((txt) => /Marathi/i.test(txt))).toBe(true);
  });

  it('synchronizes language selection to speech recognition, TTS locale, and assistant chat requests', async () => {
    const chatSpy = vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'ನಮಸ್ಕಾರ, ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
      message: 'ನಮಸ್ಕಾರ, ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
      language: 'kn',
      language_name: 'Kannada',
      voice_locale: 'kn-IN',
      is_emergency: false,
      safety_status: 'safe',
      emergency_category: null,
      is_fallback: false,
      source: 'gemini',
      model: 'gemini-2.5-flash',
    });

    renderAssistant();

    // 1. Select Kannada ('kn')
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'kn' } });

    expect(langSelect.value).toBe('kn');
    expect(voiceService.getVoiceLocale('kn')).toBe('kn-IN');

    // 2. Mock browser SpeechRecognition to verify locale sync
    let capturedRecognitionLang = null;
    window.SpeechRecognition = vi.fn().mockImplementation(function () {
      this.lang = '';
      this.start = vi.fn(() => {
        capturedRecognitionLang = this.lang;
        this.onstart?.();
      });
      this.stop = vi.fn(() => this.onend?.());
    });

    const micBtn = screen.getByRole('button', { name: /Start voice dictation/i });
    fireEvent.click(micBtn);

    // Verify SpeechRecognition.lang was updated to Kannada locale 'kn-IN'
    expect(capturedRecognitionLang).toBe('kn-IN');

    // 3. Send message in Kannada and verify request payload carries language: 'kn'
    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'ನನಗೆ ತುಂಬಾ ದಣಿವಾಗುತ್ತಿದೆ' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(chatSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'ನನಗೆ ತುಂಬಾ ದಣಿವಾಗುತ್ತಿದೆ',
          language: 'kn',
        })
      );
    });

    // Assistant response displayed
    await waitFor(() => {
      expect(screen.getByText('ನಮಸ್ಕಾರ, ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?')).toBeInTheDocument();
    });
  });

  it('preserves multi-turn conversation context when switching languages', async () => {
    const chatSpy = vi.spyOn(voiceService, 'sendVoiceAssistantChat').mockResolvedValue({
      status: 'success',
      text: 'मैं समझती हूँ। आप बिल्कुल अकेली नहीं हैं।',
      message: 'मैं समझती हूँ। आप बिल्कुल अकेली नहीं हैं।',
      language: 'hi',
      language_name: 'Hindi',
      voice_locale: 'hi-IN',
      is_emergency: false,
      safety_status: 'safe',
      emergency_category: null,
      is_fallback: false,
      source: 'gemini',
      model: 'gemini-2.5-flash',
    });

    renderAssistant();

    // Initial messages exist in English
    expect(screen.getByText(/I've been feeling a bit anxious and overwhelmed lately/i)).toBeInTheDocument();

    // Switch language to Hindi ('hi')
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'hi' } });

    // Verify existing English message is still present in the UI
    expect(screen.getByText(/I've been feeling a bit anxious and overwhelmed lately/i)).toBeInTheDocument();

    // Send a new query in Hindi
    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'मुझे बहुत चिंता हो रही है' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(chatSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'मुझे बहुत चिंता हो रही है',
          language: 'hi',
          history: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining('anxious and overwhelmed') }),
          ]),
        })
      );
    });

    // Both previous and new responses visible in chat
    expect(screen.getByText(/I've been feeling a bit anxious and overwhelmed lately/i)).toBeInTheDocument();
    expect(await screen.findByText('मैं समझती हूँ। आप बिल्कुल अकेली नहीं हैं।')).toBeInTheDocument();
  });

  it('accurately maps Indic numerals and localized words to EPDS response options', () => {
    const sampleOptions = canonicalQuestionsJson.questions[0].response_options;
    // Canonical options for Q1:
    // 0: As much as I always could
    // 1: Not quite so much now
    // 2: Definitely not so much now
    // 3: Not at all

    // 1. Indic numerals across verified scripts
    // Devanagari (Hindi/Marathi)
    expect(voiceService.matchOptionIndex('१', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('२', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('३', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('४', sampleOptions)).toBe(3);

    // Kannada
    expect(voiceService.matchOptionIndex('೧', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('೨', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('೩', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('೪', sampleOptions)).toBe(3);

    // Bengali
    expect(voiceService.matchOptionIndex('১', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('২', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('৩', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('৪', sampleOptions)).toBe(3);

    // Tamil
    expect(voiceService.matchOptionIndex('௧', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('௨', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('௩', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('௪', sampleOptions)).toBe(3);

    // Telugu
    expect(voiceService.matchOptionIndex('౧', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('౨', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('౩', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('౪', sampleOptions)).toBe(3);

    // Malayalam
    expect(voiceService.matchOptionIndex('൧', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('൨', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('൩', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('൪', sampleOptions)).toBe(3);

    // 2. Spoken localized option words
    expect(voiceService.matchOptionIndex('पहला विकल्प', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('दूसरा', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('तीसरा', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('चौथा विकल्प', sampleOptions)).toBe(3);

    expect(voiceService.matchOptionIndex('ಮೊದಲನೆಯದು', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('ಎರಡನೆಯದು', sampleOptions)).toBe(1);
    expect(voiceService.matchOptionIndex('ಮೂರನೆಯದು', sampleOptions)).toBe(2);
    expect(voiceService.matchOptionIndex('ನಾಲ್ಕನೆಯದು', sampleOptions)).toBe(3);

    expect(voiceService.matchOptionIndex('முதல் தேர்வு', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('இரண்டாவது', sampleOptions)).toBe(1);

    expect(voiceService.matchOptionIndex('మొదటిది', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('రెండవది', sampleOptions)).toBe(1);

    expect(voiceService.matchOptionIndex('ഒന്നാമത്', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('രണ്ടാമത്', sampleOptions)).toBe(1);

    expect(voiceService.matchOptionIndex('প্রথম বিকল্প', sampleOptions)).toBe(0);
    expect(voiceService.matchOptionIndex('দ্বিতীয়', sampleOptions)).toBe(1);

    // 3. Semantic keyword matches
    // "Not at all" / "Never" -> index 3 for Q1
    expect(voiceService.matchOptionIndex('कभी नहीं', sampleOptions)).toBe(3);
    expect(voiceService.matchOptionIndex('ಎಂದಿಗೂ ಇಲ್ಲ', sampleOptions)).toBe(3);
    expect(voiceService.matchOptionIndex('எப்போதும் இல்லை', sampleOptions)).toBe(3);
    expect(voiceService.matchOptionIndex('ഒരിക്കലുമില്ല', sampleOptions)).toBe(3);
    expect(voiceService.matchOptionIndex('কখনোই না', sampleOptions)).toBe(3);
    expect(voiceService.matchOptionIndex('कधीच नाही', sampleOptions)).toBe(3);
  });

  it('detects clarification and repetition requests across verified Indic languages without advancing', () => {
    // English
    expect(voiceService.isClarificationOrRepeatRequest('Can you repeat that please?')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('Explain what this means')).toBe(true);

    // Hindi
    expect(voiceService.isClarificationOrRepeatRequest('फिर से बताओ')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('दोबारा कहो')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('समझ नहीं आया')).toBe(true);

    // Kannada
    expect(voiceService.isClarificationOrRepeatRequest('ಮತ್ತೆ ಹೇಳಿ')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('ಅರ್ಥವಾಗಲಿಲ್ಲ')).toBe(true);

    // Tamil
    expect(voiceService.isClarificationOrRepeatRequest('மீண்டும் சொல்லுங்கள்')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('புரியவில்லை')).toBe(true);

    // Telugu
    expect(voiceService.isClarificationOrRepeatRequest('మళ్ళీ చెప్పండి')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('అర్థం కాలేదు')).toBe(true);

    // Malayalam
    expect(voiceService.isClarificationOrRepeatRequest('വീണ്ടും പറയൂ')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('മനസ്സിലായില്ല')).toBe(true);

    // Bengali
    expect(voiceService.isClarificationOrRepeatRequest('আবার বলুন')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('বুঝতে পারছি না')).toBe(true);

    // Marathi
    expect(voiceService.isClarificationOrRepeatRequest('पुन्हा सांगा')).toBe(true);
    expect(voiceService.isClarificationOrRepeatRequest('समजले नाही')).toBe(true);

    // Non-clarification input should be false
    expect(voiceService.isClarificationOrRepeatRequest('I felt happy yesterday')).toBe(false);
  });

  it('handles spoken Indic EPDS answers in screening and keeps question index when speech is unclear', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderAssistant();

    // Select Hindi
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'hi' } });

    // Start screening via conversational intent
    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    fireEvent.change(input, { target: { value: 'take screening' } });
    fireEvent.click(sendBtn);

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Provenance notice confirms canonical English instrument with Hindi conversational assistance
    const provenanceNotice = within(activeBox).getByTestId('translation-provenance-notice');
    expect(provenanceNotice).toBeInTheDocument();
    expect(provenanceNotice).toHaveTextContent(/Conversational assistance in Hindi/i);

    // Mother says unclear statement that does not match any option
    fireEvent.change(input, { target: { value: 'मुझे मौसम अच्छा लग रहा है' } });
    fireEvent.click(sendBtn);

    // Re-prompt in Hindi without advancing the question index
    await waitFor(() => {
      expect(
        screen.getByText(/आपकी स्क्रीनिंग का सही मूल्यांकन सुनिश्चित करने के लिए/i)
      ).toBeInTheDocument();
    });

    // Question index remains strictly on Question 1
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Now mother speaks a valid Devanagari answer '२' (Option 2 -> index 1)
    fireEvent.change(input, { target: { value: '२' } });
    fireEvent.click(sendBtn);

    // Question advances strictly by 1 to Question 2 of 10
    await waitFor(() => {
      expect(within(activeBox).getByText(/Question 2 of 10/i)).toBeInTheDocument();
    });
  });

  it('preserves Question 10 emergency safety escalation with Tele-MANAS hotline across regional languages', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderAssistant();

    // Select Tamil ('ta')
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'ta' } });

    // Start screening via conversational intent
    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    fireEvent.change(input, { target: { value: 'take screening' } });
    fireEvent.click(sendBtn);

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Fast-forward questions 1-9 by clicking Option 0
    for (let q = 1; q <= 9; q++) {
      const opt0 = within(activeBox).getByTestId('epds-option-0');
      fireEvent.click(opt0);
      if (q < 9) {
        await waitFor(() => {
          expect(within(activeBox).getByText(new RegExp(`Question ${q + 1} of 10`, 'i'))).toBeInTheDocument();
        });
      }
    }

    // Now on Question 10
    await waitFor(() => {
      expect(within(activeBox).getByText(/Question 10 of 10/i)).toBeInTheDocument();
    });

    // Mother answers Question 10 positively ("Yes, quite often" -> index 0)
    const opt0Q10 = within(activeBox).getByTestId('epds-option-0');
    fireEvent.click(opt0Q10);

    // Verify critical emergency safety escalation is triggered
    await waitFor(() => {
      // Emergency alert banner rendered
      expect(screen.getByRole('alert', { name: /Crisis Safety Helpline/i })).toBeInTheDocument();
      // Tele-MANAS 24/7 hotline 14416 is present
      expect(screen.getAllByText(/14416/i).length).toBeGreaterThanOrEqual(1);
      // Emergency response message in Tamil is rendered
      expect(screen.getByText(/அவசர பாதுகாப்பு அறிவிப்பு/i)).toBeInTheDocument();
    });
  });

  it('transparently notifies user when browser speech synthesis voice is unavailable for a language', async () => {
    // Mock browser voices containing only English, missing Malayalam
    window.speechSynthesis.getVoices = vi.fn(() => [
      { lang: 'en-US', name: 'English US' },
      { lang: 'en-IN', name: 'English India' },
    ]);

    renderAssistant();

    // Select Malayalam ('ml')
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'ml' } });

    // Verify non-intrusive voice notice banner appears
    await waitFor(() => {
      expect(
        screen.getByText(/Browser speech voice for Malayalam is not installed on this system/i)
      ).toBeInTheDocument();
    });

    // Dismiss notice button works
    const dismissBtn = screen.getByRole('button', { name: /Dismiss voice notice/i });
    fireEvent.click(dismissBtn);

    expect(
      screen.queryByText(/Browser speech voice for Malayalam is not installed on this system/i)
    ).not.toBeInTheDocument();
  });
});
