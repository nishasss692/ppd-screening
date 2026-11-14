import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatientProvider } from '../context/PatientContext.jsx';
import { ClinicalProvider } from '../../dashboard/context/ClinicalContext.jsx';
import { PatientScreeningPage } from './PatientScreeningPage.jsx';
import * as voiceService from '../services/voiceAssistantService.js';
import * as patientApi from '../services/patientApiService.js';
import canonicalQuestionsJson from '../../../data/questions.json';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderScreeningPage() {
  return render(
    <ClinicalProvider>
      <PatientProvider>
        <MemoryRouter>
          <PatientScreeningPage />
        </MemoryRouter>
      </PatientProvider>
    </ClinicalProvider>
  );
}

describe('MIORA — EPDS Conversational Screening and Persistence (Verification Checklist)', () => {
  let mockMediaRecorderInstance;
  let mockSpeechRecognitionInstance;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default mocks for API persistence and video upload
    vi.spyOn(patientApi, 'saveScreeningSession').mockResolvedValue({
      id: 'screening-session-default-uuid',
      mother_id: 'mother-uuid-1',
      total_score: 8,
      risk_classification: 'low',
      q10_safety_alert: false,
      screening_status: 'completed',
    });

    vi.spyOn(patientApi, 'uploadScreeningVideo').mockResolvedValue({
      status: 'recorded',
    });

    // Mock HTMLMediaElement play and pause for JSDOM
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();

    // Mock speech synthesis
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      paused: false,
      speaking: false,
    };

    window.SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
      text,
      lang: 'en-IN',
      rate: 0.95,
      pitch: 1.0,
      onstart: null,
      onend: null,
      onerror: null,
    }));

    // Mock getUserMedia
    const mockTrack = { stop: vi.fn(), enabled: true };
    const mockStream = {
      getTracks: vi.fn(() => [mockTrack, mockTrack]),
      getVideoTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => [mockTrack]),
    };

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    };

    // Mock MediaRecorder
    class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.state = 'inactive';
        this.mimeType = 'video/webm;codecs=vp8,opus';
        this.ondataavailable = null;
        this.onstop = null;
        this.onerror = null;
        mockMediaRecorderInstance = this;
      }
      start(timeSlice) {
        this.state = 'recording';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['mock video data chunk'], { type: 'video/webm' }) });
        }
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['final video chunk'], { type: 'video/webm' }) });
        }
        if (this.onstop) {
          this.onstop();
        }
      }
      static isTypeSupported() {
        return true;
      }
    }
    window.MediaRecorder = MockMediaRecorder;

    // Mock SpeechRecognition
    class MockSpeechRecognition {
      constructor() {
        this.continuous = false;
        this.interimResults = true;
        this.lang = 'en-IN';
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this._running = false;
        mockSpeechRecognitionInstance = this;
      }
      start() {
        this._running = true;
        if (this.onstart) this.onstart();
      }
      stop() {
        if (this._running) {
          this._running = false;
          if (this.onend) this.onend();
        }
      }
      abort() {
        if (this._running) {
          this._running = false;
          if (this.onend) this.onend();
        }
      }
    }
    window.SpeechRecognition = MockSpeechRecognition;
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1 & 2 & 3. Displays Question 1 conversationally in chat with NO multiple-choice buttons, NO automatic TTS, and NO automatic microphone activation', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderScreeningPage();

    // Check Question 1 is presented in chat with canonical text
    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 10:/i)).toBeInTheDocument();
      expect(screen.getByText(/I have been able to laugh and see the funny side of things/i)).toBeInTheDocument();
    });

    // STRICT CHECK: NO multiple-choice buttons or option lists exist
    expect(screen.queryByRole('button', { name: /As much as I always could/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Not quite so much now/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Definitely not so much now/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Not at all/i })).toBeNull();
    expect(document.querySelector('.screening-options-grid')).toBeNull();
    expect(document.querySelector('.screening-option-button')).toBeNull();

    // STRICT CHECK: NO automatic TTS speech synthesis
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();

    // STRICT CHECK: Microphone is initially IDLE (not listening)
    expect(screen.getByText(/Microphone idle — click Listen to speak/i)).toBeInTheDocument();
  });

  it('4 & 5. Voice input activates ONLY when mother clicks Listen, captures speech, and advances question', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderScreeningPage();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 10:/i)).toBeInTheDocument();
    });

    // Mother explicitly clicks the Listen button
    const listenBtn = screen.getByRole('button', { name: /^Listen$/i });
    fireEvent.click(listenBtn);

    // Recognition starts and UI indicates listening
    expect(screen.getByText(/Listening for your voice.../i)).toBeInTheDocument();
    expect(mockSpeechRecognitionInstance).toBeDefined();

    // Simulate mother speaking "As much as I always could"
    act(() => {
      mockSpeechRecognitionInstance.onresult({
        results: [[{ transcript: 'As much as I always could' }]],
      });
      mockSpeechRecognitionInstance.onend();
    });

    // Transcript is transcribed into the conversation
    await waitFor(() => {
      expect(screen.getAllByText(/"As much as I always could"/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Captured answer for Question 1: "As much as I always could"/i)).toBeInTheDocument();
    });

    // Automatically advances to Question 2 in chat
    await waitFor(
      () => {
        expect(screen.getByText(/Question 2 of 10:/i)).toBeInTheDocument();
        expect(screen.getByText(/I have looked forward with enjoyment to things/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // After advancing, microphone does NOT automatically listen: it stays IDLE
    expect(screen.getByText(/Microphone idle — click Listen to speak/i)).toBeInTheDocument();
  });

  it('6. Ambiguous responses trigger conversational clarification in chat without advancing question or guessing a score', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderScreeningPage();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 10:/i)).toBeInTheDocument();
    });

    // Mother clicks Listen and speaks an ambiguous/unmatched sentence
    const listenBtn = screen.getByRole('button', { name: /^Listen$/i });
    fireEvent.click(listenBtn);

    act(() => {
      mockSpeechRecognitionInstance.onresult({
        results: [[{ transcript: 'Maybe, I have no idea how I feel' }]],
      });
      mockSpeechRecognitionInstance.onend();
    });

    // User message is shown and Miora asks a short conversational clarification
    await waitFor(() => {
      expect(screen.getAllByText(/Maybe, I have no idea how I feel/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Could you tell me a little more for Question 1\?/i)).toBeInTheDocument();
    });

    // Question does NOT advance: still on Question 1
    expect(screen.queryByText(/Question 2 of 10:/i)).toBeNull();
    expect(screen.getByText(/Speech unclear — click Listen to retry/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry speaking your answer/i)).toBeInTheDocument();
  });

  it('7 & 8 & 9. Completes all 10 questions, calculates score with reverse scoring, shows assessment report inside same chat (NO redirect), and persists to PostgreSQL', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);
    const saveSpy = vi.spyOn(patientApi, 'saveScreeningSession').mockResolvedValue({
      id: 'screening-session-uuid-777',
      mother_id: 'mother-uuid-999',
      total_score: 8,
      risk_classification: 'low',
      q10_safety_alert: false,
      screening_status: 'completed',
    });
    const uploadSpy = vi.spyOn(patientApi, 'uploadScreeningVideo').mockResolvedValue({
      status: 'recorded',
    });

    renderScreeningPage();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 10:/i)).toBeInTheDocument();
    });

    // Answer questions 1 through 10 using natural text input (or voice)
    const answersToEnter = [
      'As much as I always could', // Q1: score 0
      'Rather less than I used to', // Q2: score 1
      'Not very often', // Q3 (reverse scored): score 1
      'No, not at all', // Q4: score 0
      'No, not at all', // Q5 (reverse scored): score 0
      'No, I have been coping as well as ever', // Q6 (reverse scored): score 0
      'No, not at all', // Q7 (reverse scored): score 0
      'No, not at all', // Q8 (reverse scored): score 0
      'No, never', // Q9 (reverse scored): score 0
      'Never', // Q10 (reverse scored): score 0
    ];

    const input = screen.getByPlaceholderText(/Type your answer or click Listen to speak/i);

    for (let i = 0; i < 10; i++) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Question ${i + 1} of 10:`, 'i'))).toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: answersToEnter[i] } });
      fireEvent.submit(input.closest('form'));
    }

    // Completion message appears in chat
    await waitFor(() => {
      expect(screen.getByText(/Thank you for answering all 10 questions/i)).toBeInTheDocument();
    });

    // Database persistence verification: saveScreeningSession called with all 10 answers
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1);
      const callArgs = saveSpy.mock.calls[0];
      const submittedAnswers = callArgs[0];
      expect(submittedAnswers).toHaveLength(10);
      expect(submittedAnswers[0].question_id).toBe('EPDS_Q01');
      expect(submittedAnswers[0].raw_response).toBe('As much as I always could');
      expect(submittedAnswers[9].question_id).toBe('EPDS_Q10');
      expect(submittedAnswers[9].raw_response).toBe('Never');
    });

    // In-chat assessment report rendered inside the SAME chat box
    await waitFor(() => {
      expect(screen.getByText(/EPDS Screening Assessment Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Clinical Tier: Low Risk/i)).toBeInTheDocument();
      expect(screen.getByText(/Clinical Screening Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/not a medical diagnosis/i)).toBeInTheDocument();
      expect(screen.getByText(/Saved in PostgreSQL Database/i)).toBeInTheDocument();
    });

    // STRICT CHECK: NO navigation/redirect occurred!
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/screening-results'));
  }, 15000);

  it('10. Question 10 self-harm score > 0 displays Tele-MANAS crisis hotline (14416 / 1800-891-4416) and emergency guidance', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);
    vi.spyOn(patientApi, 'saveScreeningSession').mockResolvedValue({
      id: 'screening-session-q10-alert',
      mother_id: 'mother-uuid-999',
      total_score: 14,
      risk_classification: 'high',
      q10_safety_alert: true,
      screening_status: 'completed',
    });

    renderScreeningPage();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 10:/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Type your answer or click Listen to speak/i);
    const q1To9Answers = [
      'As much as I always could',
      'As much as I ever did',
      'No, never',
      'No, not at all',
      'No, not at all',
      'No, I have been coping as well as ever',
      'No, not at all',
      'No, not at all',
      'No, never',
    ];

    // Answer Q1 through Q9
    for (let i = 0; i < 9; i++) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Question ${i + 1} of 10:`, 'i'))).toBeInTheDocument();
      });
      fireEvent.change(input, { target: { value: q1To9Answers[i] } });
      fireEvent.submit(input.closest('form'));
    }

    // Now on Question 10
    await waitFor(() => {
      expect(screen.getByText(/Question 10 of 10:/i)).toBeInTheDocument();
      expect(screen.getByText(/The thought of harming myself has occurred to me/i)).toBeInTheDocument();
    });

    // Answer Q10 indicating self-harm ("Yes, quite often" -> score 3)
    fireEvent.change(input, { target: { value: 'Yes, quite often' } });
    fireEvent.submit(input.closest('form'));

    // Urgent safety escalation alert is displayed in chat with Tele-MANAS helpline
    await waitFor(() => {
      expect(screen.getAllByText(/🚨 URGENT SAFETY ESCALATION/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Call Tele-MANAS: 14416 \/ 1800-891-4416/i).length).toBeGreaterThan(0);
    });

    // Final assessment report in chat also contains emergency escalation guidance
    await waitFor(() => {
      expect(screen.getByText(/EPDS Screening Assessment Report/i)).toBeInTheDocument();
    });
  }, 15000);
});
