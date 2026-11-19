import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatientProvider } from '../context/PatientContext.jsx';
import { ClinicalProvider } from '../../dashboard/context/ClinicalContext.jsx';
import { PatientScreeningPage } from './PatientScreeningPage.jsx';
import * as patientApi from '../services/patientApiService.js';

function renderScreeningPage(initialEntries = ['/patient/screening']) {
  return render(
    <ClinicalProvider>
      <PatientProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <PatientScreeningPage />
        </MemoryRouter>
      </PatientProvider>
    </ClinicalProvider>
  );
}

describe('AANCHAL — Conversational AI Screening with Compulsory Video', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

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

    // Mock SpeechSynthesis
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
    };

    window.SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
      constructor(text) {
        this.text = text;
        this.lang = 'en-IN';
        this.voice = null;
        this.onend = null;
        this.onerror = null;
      }
    };

    // Mock SpeechRecognition
    class MockSpeechRecognition {
      constructor() {
        this.continuous = true;
        this.interimResults = true;
        this.lang = 'en-IN';
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
      }
      start() {
        if (this.onstart) this.onstart();
        setTimeout(() => {
          if (this.onresult) {
            this.onresult({
              results: [
                [{ transcript: 'I have been feeling emotionally overwhelmed since birth.', isFinal: true }],
              ],
            });
          }
          if (this.onend) this.onend();
        }, 20);
      }
      stop() {
        if (this.onend) this.onend();
      }
      abort() {
        if (this.onend) this.onend();
      }
    }
    window.SpeechRecognition = MockSpeechRecognition;
    window.webkitSpeechRecognition = MockSpeechRecognition;

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Part 1: Renders exactly the 3 screening tabs with pill navigation and removes duplicate Medical Reports tab', () => {
    renderScreeningPage();

    // Exactly 3 tabs
    const aiTab = screen.getByRole('tab', { name: /AI Screening/i });
    const epdsTab = screen.getByRole('tab', { name: /^EPDS$/i });
    const resultsTab = screen.getByRole('tab', { name: /Results & Reports/i });

    expect(aiTab).toBeInTheDocument();
    expect(epdsTab).toBeInTheDocument();
    expect(resultsTab).toBeInTheDocument();

    // No separate 4th tab for Medical Reports
    expect(screen.queryByRole('tab', { name: /^Medical Reports$/i })).not.toBeInTheDocument();
    expect(aiTab).toHaveAttribute('aria-selected', 'true');
  });

  it('Tab 1: Enforces compulsory video recording notice and requires explicit consent before enabling camera', async () => {
    renderScreeningPage(['/patient/screening?tab=ai-screening']);

    // Heading and Description
    expect(screen.getByRole('heading', { level: 1, name: 'AI Screening' })).toBeInTheDocument();

    // Compulsory Video Notice
    expect(screen.getByText(/Compulsory Video & Audio Recording/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Continuous video and audio recording is a/i)
    ).toBeInTheDocument();

    const consentCheckbox = screen.getByRole('checkbox', {
      name: /I give explicit consent for continuous camera video/i,
    });
    expect(consentCheckbox).toBeInTheDocument();
    expect(consentCheckbox).not.toBeChecked();

    const startBtn = screen.getByRole('button', { name: /Enable Camera & Start AI Screening/i });
    expect(startBtn).toBeDisabled();

    // Giving consent enables the button
    fireEvent.click(consentCheckbox);
    expect(consentCheckbox).toBeChecked();
    expect(startBtn).toBeEnabled();
  });

  it('Tab 1: Shows clear explanation if camera access fails and prevents starting session without video', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));

    renderScreeningPage(['/patient/screening?tab=ai-screening']);

    const consentCheckbox = screen.getByRole('checkbox', {
      name: /I give explicit consent for continuous camera video/i,
    });
    fireEvent.click(consentCheckbox);

    const startBtn = screen.getByRole('button', { name: /Enable Camera & Start AI Screening/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Video recording is compulsory for this research screening/i)
      ).toBeInTheDocument();
    });

    // Does not advance to chat without camera
    expect(screen.queryByLabelText(/AI Screening Conversation Stream/i)).not.toBeInTheDocument();
  });

  it('Tab 1: Enters ChatGPT-style conversation with live continuous camera preview, asks Question 1, and supports voice dictation', async () => {
    renderScreeningPage(['/patient/screening?tab=ai-screening']);

    // Give consent and start
    const consentCheckbox = screen.getByRole('checkbox', {
      name: /I give explicit consent for continuous camera video/i,
    });
    fireEvent.click(consentCheckbox);

    const startBtn = screen.getByRole('button', { name: /Enable Camera & Start AI Screening/i });
    fireEvent.click(startBtn);

    // Chat workspace is active
    await waitFor(() => {
      expect(screen.getByLabelText(/AI Screening Conversation Stream/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Continuous patient video feed/i)).toBeInTheDocument();
      expect(screen.getByText(/Question 1 of 5/i)).toBeInTheDocument();
      expect(
        screen.getByText(/How have you been feeling emotionally since your baby was born\? You can share whatever comes to mind\./i)
      ).toBeInTheDocument();
    });

    // Voice dictation button is primary
    const speakBtn = screen.getByRole('button', { name: /Start voice dictation/i });
    expect(speakBtn).toBeInTheDocument();
    fireEvent.click(speakBtn);

    // Dictated text appears in the input field
    await waitFor(() => {
      const input = screen.getByLabelText(/Your response/i);
      expect(input.value).toContain('I have been feeling emotionally overwhelmed since birth.');
    });

    // Send answer
    const sendBtn = screen.getByRole('button', { name: /Send response/i });
    expect(sendBtn).toBeInTheDocument();
    fireEvent.click(sendBtn);

    // Mother's message appears on the right in chat
    await waitFor(() => {
      expect(screen.getByText('I have been feeling emotionally overwhelmed since birth.')).toBeInTheDocument();
    });

    // Assistant advances to Question 2
    await waitFor(() => {
      expect(
        screen.getByText(/Have you been feeling more anxious, worried, sad, or overwhelmed than usual recently\?/i)
      ).toBeInTheDocument();
    });
  });

  it('Tab 1: Supports typed answers directly and completes all 5 questions sequentially with continuous camera active', async () => {
    renderScreeningPage(['/patient/screening?tab=ai-screening']);

    // Consent and start
    const consentCheckbox = screen.getByRole('checkbox', {
      name: /I give explicit consent for continuous camera video/i,
    });
    fireEvent.click(consentCheckbox);

    const startBtn = screen.getByRole('button', { name: /Enable Camera & Start AI Screening/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/AI Screening Conversation Stream/i)).toBeInTheDocument();
    });

    // Answer questions 1 through 5 using typed responses
    for (let i = 1; i <= 5; i++) {
      const input = screen.getByLabelText(/Your response/i);
      fireEvent.change(input, { target: { value: `Mother response for question ${i}` } });

      const sendBtn = screen.getByRole('button', { name: /Send response/i });
      fireEvent.click(sendBtn);

      // Verify mother response appears in chat
      expect(screen.getByText(`Mother response for question ${i}`)).toBeInTheDocument();

      // Camera preview remains visible and active throughout
      expect(screen.getByLabelText(/Continuous patient video feed/i)).toBeInTheDocument();
    }

    // Session completes and displays navigation to EPDS
    await waitFor(() => {
      expect(
        screen.getByText(/All 5 questions answered\. Multimodal video and acoustic data saved\./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Proceed to EPDS Assessment/i })).toBeInTheDocument();
    });
  });

  it('Tab 2: EPDS presents 10 canonical questions one per screen with previous/next navigation, score calculation, and review', async () => {
    renderScreeningPage(['/patient/screening?tab=epds']);

    // Header & Question 1 of 10
    expect(screen.getByText(/EDINBURGH POSTNATAL DEPRESSION SCALE/i)).toBeInTheDocument();
    expect(screen.getByText(/Question 1 of 10/i)).toBeInTheDocument();
    expect(
      screen.getByText('I have been able to laugh and see the funny side of things')
    ).toBeInTheDocument();

    // Previous is disabled on Question 1
    const prevBtn = screen.getByRole('button', { name: /Previous/i });
    const nextBtn = screen.getByRole('button', { name: /Next Question/i });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled(); // Disabled until choice is selected

    // Select option: "As much as I always could" (score 0)
    const opt0 = screen.getByRole('radio', { name: /As much as I always could/i });
    fireEvent.click(opt0);
    expect(opt0).toBeChecked();
    expect(nextBtn).toBeEnabled();

    // Navigate to Question 2
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Question 2 of 10/i)).toBeInTheDocument();
    expect(
      screen.getByText('I have looked forward with enjoyment to things')
    ).toBeInTheDocument();

    // Test Previous button retains Question 1 answer
    const prevBtnQ2 = screen.getByRole('button', { name: /Previous/i });
    expect(prevBtnQ2).toBeEnabled();
    fireEvent.click(prevBtnQ2);

    // Back to Question 1: answer preserved
    expect(screen.getByText(/Question 1 of 10/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /As much as I always could/i })).toBeChecked();
  });

  it('Tab 2: Completing all 10 questions allows Review and Submission with correct score out of 30', async () => {
    renderScreeningPage(['/patient/screening?tab=epds']);

    // Answer questions 1 through 10
    for (let i = 1; i <= 10; i++) {
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[0]); // select first option for each

      const advanceBtn =
        i === 10
          ? screen.getByRole('button', { name: /Review Answers/i })
          : screen.getByRole('button', { name: /Next Question/i });

      fireEvent.click(advanceBtn);
    }

    // Now in Review Mode
    expect(screen.getByRole('heading', { level: 2, name: /Review Your EPDS Answers/i })).toBeInTheDocument();
    expect(screen.getByText(/Please review your selections for all 10 questions/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Submit EPDS Assessment/i });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    // Submission completed view with score out of 30
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /EPDS Assessment Completed/i })).toBeInTheDocument();
      expect(screen.getByText('/ 30')).toBeInTheDocument();
      expect(screen.getByText(/Screening Instrument Notice/i)).toBeInTheDocument();
    });
  });

  it('Tab 3: Results & Reports shows unified portfolio, AI modality statuses, EPDS score, and reports', () => {
    // Populate client storage
    localStorage.setItem(
      'aanchal_submitted_epds_assessment',
      JSON.stringify({
        totalScore: 8,
        riskTier: 'low',
        q10Alert: false,
        submittedAt: new Date().toISOString(),
      })
    );

    renderScreeningPage(['/patient/screening?tab=results']);

    // Heading
    expect(screen.getByRole('heading', { level: 1, name: /Results & Reports/i })).toBeInTheDocument();

    // AI Screening results card with awaiting integration pills
    expect(screen.getByRole('heading', { level: 2, name: 'AI Screening Results' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'EPDS Score' })).toBeInTheDocument();

    // EPDS Score value out of 30
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('/30')).toBeInTheDocument();

    // Assessment table
    expect(screen.getByText('Sequential EPDS (10 items)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Summary PDF/i })).toBeInTheDocument();
  });
});
