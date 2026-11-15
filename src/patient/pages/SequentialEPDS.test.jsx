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

function triggerStartScreening() {
  const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
  const sendBtn = screen.getByRole('button', { name: /Send message/i });
  fireEvent.change(input, { target: { value: 'take screening' } });
  fireEvent.click(sendBtn);
}

describe('Sequential EPDS Questionnaire Flow (Phase 4)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }

    // Mock window.speechSynthesis
    window.speechSynthesis = {
      speak: vi.fn((u) => u?.onstart?.()),
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieves canonical questions from API and presents 7-day intro and Question 1', async () => {
    const fetchSpy = vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValueOnce(canonicalQuestionsJson);

    renderAssistant();

    // Start screening via conversational intent
    triggerStartScreening();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Intro message explains feelings over the past 7 days
    await waitFor(() => {
      expect(screen.getByText(/Edinburgh Postnatal Depression Scale \(EPDS\) screening/i)).toBeInTheDocument();
      expect(screen.getByText(/how you have felt in the past 7 days/i)).toBeInTheDocument();
    });

    // Active screening container rendered with Question 1 and 4 canonical options
    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();
    expect(within(activeBox).getByText(/"I have been able to laugh and see the funny side of things"/i)).toBeInTheDocument();

    expect(within(activeBox).getByTestId('epds-option-0')).toHaveTextContent(/As much as I always could/i);
    expect(within(activeBox).getByTestId('epds-option-1')).toHaveTextContent(/Not quite so much now/i);
    expect(within(activeBox).getByTestId('epds-option-2')).toHaveTextContent(/Definitely not so much now/i);
    expect(within(activeBox).getByTestId('epds-option-3')).toHaveTextContent(/Not at all/i);
  });

  it('progresses strictly one question at a time and rejects invalid answers without advancing', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderAssistant();

    triggerStartScreening();

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Type an invalid answer that doesn't match any option
    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'blue cheese watermelon' } });
    fireEvent.click(sendBtn);

    // Bot rejects invalid option and re-prompts for Question 1 without advancing
    await waitFor(() => {
      expect(screen.getByText(/I want to make sure your screening is scored accurately/i)).toBeInTheDocument();
    });

    // Active box remains on Question 1
    expect(within(screen.getByTestId('active-screening-box')).getByText(/Question 1 of 10/i)).toBeInTheDocument();
    expect(screen.queryByText(/Question 2 of 10/i)).not.toBeInTheDocument();

    // Now answer Question 1 validly by clicking option 0 ("As much as I always could")
    const opt0 = screen.getByTestId('epds-option-0');
    fireEvent.click(opt0);

    // Advances to Question 2 of 10
    await waitFor(() => {
      expect(within(screen.getByTestId('active-screening-box')).getByText(/Question 2 of 10/i)).toBeInTheDocument();
      expect(within(screen.getByTestId('active-screening-box')).getByText(/"I have looked forward with enjoyment to things"/i)).toBeInTheDocument();
    });
  });

  it('handles question repetition and clarification without advancing the question index', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderAssistant();

    triggerStartScreening();

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Ask to repeat the question
    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'Could you repeat that question again?' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Certainly! Here is Question 1 of 10 again:/i)).toBeInTheDocument();
    });

    // Still on Question 1
    expect(within(screen.getByTestId('active-screening-box')).getByText(/Question 1 of 10/i)).toBeInTheDocument();
  });

  it('accepts spoken or typed option numbers and text labels', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderAssistant();

    triggerStartScreening();

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ask me anything about your maternal well-being/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    // Type "Option 1" (maps to index 0: "As much as I always could")
    fireEvent.change(input, { target: { value: 'Option 1' } });
    fireEvent.click(sendBtn);

    // Advances to Question 2
    await waitFor(() => {
      expect(within(screen.getByTestId('active-screening-box')).getByText(/Question 2 of 10/i)).toBeInTheDocument();
    });

    // For Question 2 ("I have looked forward with enjoyment to things"):
    // Option 3 label is "Hardly at all"
    fireEvent.change(input, { target: { value: 'hardly at all' } });
    fireEvent.click(sendBtn);

    // Advances to Question 3
    await waitFor(() => {
      expect(within(screen.getByTestId('active-screening-box')).getByText(/Question 3 of 10/i)).toBeInTheDocument();
    });
  });

  it('triggers immediate Question 10 safety escalation with Tele-MANAS hotline when positive', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);
    vi.spyOn(voiceService, 'submitEPDSQuestionnaire').mockResolvedValue({
      total_score: 18,
      maximum_score: 30,
      classification: 'Probable depression',
      clinical_significance: 'Strongly suggests depressive illness of varying clinical severity requiring formal evaluation.',
      recommended_action: 'Conduct immediate comprehensive diagnostic assessment; initiate specialized psychiatric referral.',
      is_diagnostic: false,
      screening_disclaimer: 'The Edinburgh Postnatal Depression Scale (EPDS) is a screening support instrument, NOT a medical or psychiatric diagnosis.',
      item_scores: [],
      safety_alert: {
        triggered: true,
        question_id: 'EPDS_Q10',
        question_10_score: 2,
        severity: 'URGENT_SAFETY_ASSESSMENT',
        message: 'CRITICAL SAFETY ALERT: Patient endorsed thoughts of self-harm on EPDS Item 10.',
        override_protection: 'A positive Question 10 response must NEVER be overridden by a low total score or ML prediction.',
        escalation_protocol: [
          '1. Immediately notify the attending clinician or designated mental health professional.',
          '2. Conduct structured crisis suicide risk assessment.',
        ],
      },
    });

    renderAssistant();

    triggerStartScreening();

    await screen.findByTestId('active-screening-box');

    // Answer questions 1 through 9 rapidly using option index 3
    for (let q = 1; q <= 9; q++) {
      await waitFor(() => {
        expect(within(screen.getByTestId('active-screening-box')).getByText(new RegExp(`Question ${q} of 10`, 'i'))).toBeInTheDocument();
      });
      const optBtn = screen.getByTestId('epds-option-3');
      fireEvent.click(optBtn);
    }

    // Now on Question 10 of 10 ("The thought of harming myself has occurred to me")
    await waitFor(() => {
      const box = screen.getByTestId('active-screening-box');
      expect(within(box).getByText(/Question 10 of 10/i)).toBeInTheDocument();
      expect(within(box).getByText(/"The thought of harming myself has occurred to me"/i)).toBeInTheDocument();
    });

    // Mother selects Option 2 ("Sometimes", score 2, index 1) indicating self-harm thoughts
    const q10OptionSometimes = screen.getByTestId('epds-option-1');
    expect(q10OptionSometimes).toHaveTextContent(/Sometimes/i);
    fireEvent.click(q10OptionSometimes);

    // MUST immediately trigger critical safety escalation notice with Tele-MANAS hotline
    await waitFor(() => {
      expect(screen.getByText(/CRITICAL SAFETY ESCALATION NOTICE/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Tele-MANAS/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/14416/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/1800-891-4416/i).length).toBeGreaterThan(0);
    });

    // Sticky Crisis Banner is visible
    expect(screen.getByRole('alert', { name: /Crisis Safety Helpline/i })).toBeInTheDocument();

    // Final result card rendered with classification and disclaimer
    await waitFor(() => {
      const resultCard = screen.getByTestId('epds-result-card');
      expect(resultCard).toBeInTheDocument();
      expect(within(resultCard).getByText(/Score: 18 \/ 30/i)).toBeInTheDocument();
      expect(within(resultCard).getByText(/Probable depression/i)).toBeInTheDocument();
      expect(within(resultCard).getByText(/screening support instrument, NOT a medical or psychiatric diagnosis/i)).toBeInTheDocument();
    });
  });

  it('completes full 10-item flow for negative Q10, calculates score, and submits to backend', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);
    const submitSpy = vi.spyOn(voiceService, 'submitEPDSQuestionnaire').mockResolvedValue({
      total_score: 4,
      maximum_score: 30,
      classification: 'Low likelihood of depressive illness',
      clinical_significance: 'Symptoms of emotional distress are within standard postnatal limits.',
      recommended_action: 'Provide routine postpartum support and guidance.',
      is_diagnostic: false,
      screening_disclaimer: 'The Edinburgh Postnatal Depression Scale (EPDS) is a screening support instrument, NOT a medical or psychiatric diagnosis.',
      item_scores: [],
      safety_alert: {
        triggered: false,
        question_id: 'EPDS_Q10',
        question_10_score: 0,
        severity: 'NONE',
        message: 'No positive response on Question 10.',
        override_protection: 'Standard rule',
        escalation_protocol: [],
      },
    });

    renderAssistant();

    triggerStartScreening();

    await screen.findByTestId('active-screening-box');

    // Answer questions 1 through 9
    for (let q = 1; q <= 9; q++) {
      await waitFor(() => {
        expect(within(screen.getByTestId('active-screening-box')).getByText(new RegExp(`Question ${q} of 10`, 'i'))).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('epds-option-0'));
    }

    // Question 10: select "Never" (index 3, score 0)
    await waitFor(() => {
      expect(within(screen.getByTestId('active-screening-box')).getByText(/Question 10 of 10/i)).toBeInTheDocument();
    });
    const neverOpt = screen.getByTestId('epds-option-3');
    expect(neverOpt).toHaveTextContent(/Never/i);
    fireEvent.click(neverOpt);

    // Verify submission to backend with exactly 10 answers
    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });

    const submittedAnswers = submitSpy.mock.calls[0][0];
    expect(submittedAnswers).toHaveLength(10);
    expect(submittedAnswers[0]).toEqual({ question_id: 'EPDS_Q01', selected_index: 0 });
    expect(submittedAnswers[9]).toEqual({ question_id: 'EPDS_Q10', selected_index: 3 });

    // Result card appears with Low likelihood
    await waitFor(() => {
      const resultCard = screen.getByTestId('epds-result-card');
      expect(resultCard).toBeInTheDocument();
      expect(within(resultCard).getByText(/Score: 4 \/ 30/i)).toBeInTheDocument();
      expect(within(resultCard).getByText(/Low likelihood of depressive illness/i)).toBeInTheDocument();
    });

    // No crisis alert banner triggered
    expect(screen.queryByRole('alert', { name: /Crisis Safety Helpline/i })).not.toBeInTheDocument();
  });

  it('allows user to pause/cancel screening gracefully', async () => {
    vi.spyOn(voiceService, 'fetchEPDSQuestionnaire').mockResolvedValue(canonicalQuestionsJson);

    renderAssistant();

    triggerStartScreening();

    const activeBox = await screen.findByTestId('active-screening-box');
    expect(within(activeBox).getByText(/Question 1 of 10/i)).toBeInTheDocument();

    // Click pause screening
    const cancelBtn = screen.getByRole('button', { name: /Pause screening/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByText(/Screening paused/i)).toBeInTheDocument();
    });

    // Active screening container dismissed
    expect(screen.queryByTestId('active-screening-box')).not.toBeInTheDocument();
  });
});
