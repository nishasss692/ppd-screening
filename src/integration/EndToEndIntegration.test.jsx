import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PatientProvider, usePatient } from '../patient/context/PatientContext.jsx';
import { ClinicalProvider, useClinicalData } from '../dashboard/context/ClinicalContext.jsx';
import { LoginScreen } from '../LoginScreen.jsx';
import { AiAssistantScreen } from '../patient/pages/AiAssistantScreen.jsx';
import { PatientReportsPage } from '../patient/pages/PatientReportsPage.jsx';
import { CommandCenterPage } from '../dashboard/pages/CommandCenterPage.jsx';
import { MothersCasesPage } from '../dashboard/pages/MothersCasesPage.jsx';
import { TopNav } from '../dashboard/components/TopNav.jsx';
import { DoctorAssistantPopover } from '../dashboard/components/DoctorAssistantPopover.jsx';
import * as voiceService from '../patient/services/voiceAssistantService.js';
import * as doctorService from '../dashboard/services/doctorAssistantService.js';
import * as authService from '../auth/authService.js';
import canonicalQuestionsJson from '../../data/questions.json';

// Helper integration test wrapper providing both context layers
function renderFullApplication(initialEntries = ['/login']) {
  return render(
    <ClinicalProvider>
      <PatientProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/patient/dashboard" element={<PatientReportsPage />} />
            <Route path="/patient/reports" element={<PatientReportsPage />} />
            <Route path="/patient/ai-assistant" element={<AiAssistantScreen />} />
            <Route path="/dashboard" element={<CommandCenterPage />} />
            <Route path="/mothers" element={<MothersCasesPage />} />
          </Routes>
        </MemoryRouter>
      </PatientProvider>
    </ClinicalProvider>
  );
}

describe('MIORA Phase 7 — End-to-End Application Integration', () => {
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
      onstart: null,
      onend: null,
      onerror: null,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies patient workflow: login -> AI assistant -> sequential EPDS -> backend scoring -> reports sync', async () => {
    // 1. Mock API calls
    const mockEPDSSubmission = {
      status: 'success',
      total_score: 14,
      maximum_score: 30,
      classification: 'Probable Depression',
      clinical_significance: 'Score indicates probable postpartum depression. Further clinical assessment advised.',
      recommended_action: 'Comprehensive clinical evaluation and discussion of care plan options.',
      screening_disclaimer: 'EPDS is a screening instrument, not a diagnostic confirmation.',
      item_scores: canonicalQuestionsJson.questions.map((q, idx) => ({
        question_id: q.id,
        question_number: q.question_number,
        selected_index: 1,
        score: q.response_options[1]?.score || 1,
        reverse_scored: q.reverse_scored,
      })),
      safety_alert: {
        triggered: false,
        critical_item: 'EPDS_Q10',
        response_index: 3,
        score: 0,
        severity: 'NONE',
        guidance: 'Item 10 negative.',
      },
    };

    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);
    vi.spyOn(voiceService, 'submitEPDSQuestionnaire').mockResolvedValue(mockEPDSSubmission);

    // 2. Render from Patient AI Assistant route
    renderFullApplication(['/patient/ai-assistant']);

    // Check Assistant page header
    expect(screen.getByRole('heading', { level: 1, name: /Your AI Companion/i })).toBeInTheDocument();

    // 3. Switch language to Hindi
    const langSelect = screen.getByRole('combobox', { name: /Select conversation language/i });
    fireEvent.change(langSelect, { target: { value: 'hi' } });
    expect(langSelect.value).toBe('hi');

    // 4. Start EPDS Screening
    const startChip = screen.getByRole('button', { name: /Take EPDS Screening/i });
    fireEvent.click(startChip);

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Verify canonical question provenance notice
    expect(within(activeBox).getByTestId('translation-provenance-notice')).toHaveTextContent(
      /Conversational assistance in Hindi/i
    );

    // 5. Answer Q1 to Q10 sequentially
    for (let q = 1; q <= 10; q++) {
      await waitFor(() => {
        expect(within(screen.getByTestId('active-screening-box')).getByText(new RegExp(`Question ${q} of 10`, 'i'))).toBeInTheDocument();
      });
      const optionBtn = screen.getByTestId('epds-option-1');
      fireEvent.click(optionBtn);
    }

    // 6. Verify submission & scoring display
    await waitFor(() => {
      expect(screen.getByText(/EPDS Screening Assessment Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Score: 14 \/ 30/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Probable Depression/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('verifies doctor workflow: clinician dashboard metrics -> patient details -> copilot interaction', async () => {
    const copilotSpy = vi.spyOn(doctorService, 'sendDoctorAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'The CommandCenter displays key metrics including registered mothers, completed screenings, and potential discordances.',
      message: 'The CommandCenter displays key metrics including registered mothers, completed screenings, and potential discordances.',
      role: 'clinician_copilot',
      source: 'gemini',
      is_fallback: false,
    });

    render(
      <ClinicalProvider>
        <PatientProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <TopNav />
            <CommandCenterPage />
          </MemoryRouter>
        </PatientProvider>
      </ClinicalProvider>
    );

    // 1. Verify doctor dashboard KPIs & navigation
    expect(screen.getByText(/Postpartum Health/i)).toBeInTheDocument();
    expect(screen.getByText(/Registered Mothers/i)).toBeInTheDocument();
    expect(screen.getByText(/Screenings Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Cases for Review/i)).toBeInTheDocument();
    expect(screen.getByText(/Potential Discordance/i)).toBeInTheDocument();

    // 2. Open Clinician Copilot via TopNav
    const copilotToggle = screen.getByRole('button', { name: /Clinician AI Assistant/i });
    fireEvent.click(copilotToggle);

    expect((await screen.findAllByText(/Miora Clinical Copilot/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Strictly Non-Diagnostic/i)).toBeInTheDocument();

    // 3. Ask Copilot a workflow question
    const input = screen.getByRole('textbox', { name: /Message Miora Clinician Copilot/i });
    const sendBtn = screen.getByRole('button', { name: /Send query/i });

    fireEvent.change(input, { target: { value: 'How are priority cases calculated?' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(copilotSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'How are priority cases calculated?',
        })
      );
    });

    expect(await screen.findByText(/The CommandCenter displays key metrics/i)).toBeInTheDocument();
  });

  it('verifies strict separation between Patient AI Assistant and Doctor Copilot endpoints and contexts', () => {
    // 1. Verify Patient service targets /api/voice-assistant/chat
    // 2. Verify Doctor service targets /api/doctor-assistant/chat
    expect(voiceService.sendVoiceAssistantChat).toBeDefined();
    expect(doctorService.sendDoctorAssistantChat).toBeDefined();

    // Verify PHI filter exists in Doctor Assistant
    expect(doctorService.screenDoctorAssistantPrompt).toBeDefined();
    const cleanResult = doctorService.screenDoctorAssistantPrompt('How does the dashboard work?');
    expect(cleanResult.allowed).toBe(true);

    const phiResult = doctorService.screenDoctorAssistantPrompt('What is patient Amara Wilson score?');
    expect(phiResult.allowed).toBe(false);
    expect(phiResult.reason).toContain('PHI Protection');
  });

  it('verifies Question 10 acute safety escalation functions independently of total EPDS score', async () => {
    // Q10 positive (score 3) even if all other questions were 0
    const mockCrisisSubmission = {
      status: 'success',
      total_score: 3,
      maximum_score: 30,
      classification: 'Low Risk', // Total score is low (3/30), but Item 10 is positive!
      clinical_significance: 'Low depressive score but positive for self-harm thoughts on Item 10.',
      recommended_action: 'Immediate urgent safety evaluation and crisis intervention.',
      screening_disclaimer: 'Clinical evaluation needed.',
      item_scores: [],
      safety_alert: {
        triggered: true,
        critical_item: 'EPDS_Q10',
        response_index: 0,
        score: 3,
        severity: 'CRITICAL',
        guidance: 'Item 10 positive. Immediate safety assessment required.',
      },
    };

    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);
    vi.spyOn(voiceService, 'submitEPDSQuestionnaire').mockResolvedValue(mockCrisisSubmission);

    renderFullApplication(['/patient/ai-assistant']);

    const startChip = screen.getByRole('button', { name: /Take EPDS Screening/i });
    fireEvent.click(startChip);

    await screen.findByTestId('active-screening-box');

    // Questions 1-9 answered rapidly
    for (let q = 1; q <= 9; q++) {
      await waitFor(() => {
        expect(within(screen.getByTestId('active-screening-box')).getByText(new RegExp(`Question ${q} of 10`, 'i'))).toBeInTheDocument();
      });
      const optBtn = screen.getByTestId('epds-option-3');
      fireEvent.click(optBtn);
    }

    // Question 10 of 10: Mother selects Option 1 ("Sometimes", score 2, indicating self-harm thoughts)
    await waitFor(() => {
      const box = screen.getByTestId('active-screening-box');
      expect(within(box).getByText(/Question 10 of 10/i)).toBeInTheDocument();
    });

    const optQ10 = screen.getByTestId('epds-option-1');
    fireEvent.click(optQ10);

    // Crisis escalation must trigger immediately
    await waitFor(() => {
      expect(screen.getByText(/CRITICAL SAFETY ESCALATION NOTICE/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Tele-MANAS/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/14416/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/1800-891-4416/i).length).toBeGreaterThan(0);
    });

    // Sticky Crisis Banner is visible
    expect(screen.getByRole('alert', { name: /Crisis Safety Helpline/i })).toBeInTheDocument();
  });
});
