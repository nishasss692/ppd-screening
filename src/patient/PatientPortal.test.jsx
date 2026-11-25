import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PatientProvider } from './context/PatientContext.jsx';
import { ClinicalProvider } from '../dashboard/context/ClinicalContext.jsx';
import { PatientLayout } from './layout/PatientLayout.jsx';
import { MedicalHistoryScreen } from './pages/MedicalHistoryScreen.jsx';
import { PatientScreeningPage } from './pages/PatientScreeningPage.jsx';
import { AiAssistantScreen } from './pages/AiAssistantScreen.jsx';
import { ConnectDoctorPage } from './pages/ConnectDoctorPage.jsx';
import { PatientHomePage } from './pages/PatientHomePage.jsx';
import { PatientReportsPage } from './pages/PatientReportsPage.jsx';
import { CareSuggestionsPage } from './pages/CareSuggestionsPage.jsx';
import { ScreeningResultsPage } from './pages/ScreeningResultsPage.jsx';

function renderPatientApp(initialRoute = '/patient/reports') {
  return render(
    <ClinicalProvider>
      <PatientProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route element={<PatientLayout />}>
              <Route path="/patient/dashboard" element={<PatientHomePage />} />
              <Route path="/patient/home" element={<PatientHomePage />} />
              <Route path="/patient/reports" element={<PatientReportsPage />} />
              <Route path="/patient/medical-history" element={<MedicalHistoryScreen />} />
              <Route path="/medical-history" element={<MedicalHistoryScreen />} />
              <Route path="/patient/screening" element={<PatientScreeningPage />} />
              <Route path="/screening" element={<PatientScreeningPage />} />
              <Route path="/screening-results" element={<ScreeningResultsPage />} />
              <Route path="/patient/ai-assistant" element={<AiAssistantScreen />} />
              <Route path="/ai-assistant" element={<AiAssistantScreen />} />
              <Route path="/patient/connect-doctor" element={<ConnectDoctorPage />} />
              <Route path="/patient/care-suggestions" element={<CareSuggestionsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </PatientProvider>
    </ClinicalProvider>
  );
}

describe('Miora Patient Portal Visual Refinement & Six Screens', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }
  });

  it('renders the shared patient portal shell with top navbar navigation and profile utilities', () => {
    renderPatientApp('/patient/reports');

    // Top navbar navigation
    const nav = screen.getByRole('navigation', { name: /Patient Portal Navigation/i });
    expect(nav).toBeInTheDocument();

    // Brand logo navigates to landing page
    const brandLink = screen.getByRole('link', { name: /AANCHAL Home|Miora Home/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/');

    // Essential simplified navigation links in top navbar (Home, Screening, Support Space, Profile)
    expect(within(nav).getByRole('link', { name: /^Home$/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Screening$/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Support Space$/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Profile$/i })).toBeInTheDocument();

    // Top Navbar Profile & Status
    expect(screen.getByLabelText(/Patient profile menu/i)).toBeInTheDocument();
  });

  it('Screen 1 — Medical History: renders PPD diagnosis question, radio options, records upload, and Save action', () => {
    renderPatientApp('/patient/medical-history');

    // Heading
    expect(screen.getByRole('heading', { level: 1, name: /Medical History/i })).toBeInTheDocument();

    // Question
    expect(screen.getByText(/Have you ever been diagnosed with Postpartum Depression/i)).toBeInTheDocument();

    // Radio options: Yes, No, Not Sure
    const yesBtn = screen.getByRole('radio', { name: /Yes/i });
    const noBtn = screen.getByRole('radio', { name: /^No$/i });
    const notSureBtn = screen.getByRole('radio', { name: /Not Sure/i });

    expect(yesBtn).toBeInTheDocument();
    expect(noBtn).toBeInTheDocument();
    expect(notSureBtn).toBeInTheDocument();

    // Select 'No' option
    fireEvent.click(noBtn);
    expect(noBtn).toHaveAttribute('aria-checked', 'true');
    expect(yesBtn).toHaveAttribute('aria-checked', 'false');

    // Upload records section
    expect(screen.getByText(/Upload Relevant Records/i)).toBeInTheDocument();
    expect(screen.getByText(/PPD_Diagnosis_Report\.pdf/i)).toBeInTheDocument();

    // Save & Continue button
    const saveBtn = screen.getByRole('button', { name: /Save & Continue/i });
    expect(saveBtn).toBeInTheDocument();
    fireEvent.click(saveBtn);

    // Navigates to AI Screening
    expect(screen.getByRole('heading', { level: 1, name: /AI Screening Session/i })).toBeInTheDocument();
  });

  it('Screen 2 — Screening Workflow: renders unified 3-tab layout (AI Screening, EPDS, Results & Reports) with no mandatory medical reports upload', async () => {
    renderPatientApp('/patient/screening');

    // Progress tracker stages
    expect(screen.getAllByText('Patient Details').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Screening').length).toBeGreaterThan(0);
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();

    // Exactly 3 tabs in screening navigation
    expect(screen.getByRole('tab', { name: /AI Screening/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /EPDS/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Results & Reports/i })).toBeInTheDocument();

    // No obsolete Medical Reports tab or upload requirement
    expect(screen.queryByRole('tab', { name: /Medical Reports/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Please upload at least one report to continue/i)).not.toBeInTheDocument();

    // Tab 1 (AI Screening) is active by default with compulsory video recording pre-check
    expect(screen.getByRole('heading', { level: 1, name: /AI Screening Session/i })).toBeInTheDocument();
    expect(screen.getByText(/Compulsory Video & Audio Recording/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable Camera & Start AI Screening/i })).toBeInTheDocument();

    // Switch to EPDS tab
    const epdsTab = screen.getByRole('tab', { name: /EPDS/i });
    fireEvent.click(epdsTab);

    // Displays EPDS 10-item assessment with first question
    expect(screen.getByText(/EDINBURGH POSTNATAL DEPRESSION SCALE/i)).toBeInTheDocument();
    expect(screen.getByText(/Question 1 of 10/i)).toBeInTheDocument();
    expect(screen.getByText(/I have been able to laugh and see the funny side of things/i)).toBeInTheDocument();

    // Switch to Results & Reports tab
    const resultsTab = screen.getByRole('tab', { name: /Results & Reports/i });
    fireEvent.click(resultsTab);

    // Displays Results & Reports with pending states
    expect(screen.getByRole('heading', { level: 1, name: /Results & Reports/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Pending/i).length).toBeGreaterThan(0);

    // Consultation card is permanently accessible immediately below assessment cards
    const consultCard = screen.getByTestId('results-consultation-card');
    expect(consultCard).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /(Find a Doctor|Consult a Doctor)/i })).toBeInTheDocument();
  });

  it('Screen 3 — AI Assistant: renders hero banner, holographic AI assistant stage, prompt chips, and supports chat interactions', async () => {
    renderPatientApp('/patient/ai-assistant');

    // Heading
    expect(screen.getByRole('heading', { level: 1, name: /Your AI Companion/i })).toBeInTheDocument();

    // Holographic AI Assistant stage (replaces legacy mood/help/resources cards)
    expect(screen.getByLabelText(/(AANCHAL|Miora) AI Assistant Hologram/i)).toBeInTheDocument();
    expect(screen.queryByText('SMART')).not.toBeInTheDocument();
    expect(screen.queryByText('ADAPTIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('SECURE')).not.toBeInTheDocument();
    expect(screen.queryByText('Online • Ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Your Mood Today')).not.toBeInTheDocument();
    expect(screen.queryByText('How I Can Help')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick Resources')).not.toBeInTheDocument();

    // Prompt chips
    const copingChip = screen.getByRole('button', { name: /Coping Strategies/i });
    expect(copingChip).toBeInTheDocument();

    // Click prompt chip
    fireEvent.click(copingChip);
    expect(screen.getByText(/Could you share some simple coping strategies\?/i)).toBeInTheDocument();
  });

  it('Screen 4 — Connect to a Doctor: displays Dr. Elena Rostova profile, notice, records, and supports consultation booking', () => {
    renderPatientApp('/patient/connect-doctor');

    // Heading
    expect(screen.getByRole('heading', { level: 1, name: /Connect to a Doctor/i })).toBeInTheDocument();

    // Telehealth Simulation Notice
    expect(screen.getByText(/Telehealth Simulation Notice/i)).toBeInTheDocument();

    // Doctor profile card
    expect(screen.getByText('Dr. Elena Rostova, MD')).toBeInTheDocument();
    expect(screen.getAllByText(/Perinatal Psychiatry Lead/i).length).toBeGreaterThan(0);

    // Consultations list
    expect(screen.getByText('20 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('Telehealth Video')).toBeInTheDocument();

    // Open booking modal
    const scheduleBtn = screen.getByRole('button', { name: /Schedule Consultation/i });
    fireEvent.click(scheduleBtn);

    expect(screen.getByText('Schedule New Consultation')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Consultation/i });
    fireEvent.click(confirmBtn);

    expect(screen.getByText(/Consultation successfully scheduled with Dr. Elena Rostova!/i)).toBeInTheDocument();
  });

  it('Screen 5 — My Reports: shows only Screening Reports and Clinical Reports tabs gated until doctor finalization', async () => {
    renderPatientApp('/patient/reports');

    // Title
    expect(screen.getByRole('heading', { level: 1, name: /My Reports & Analytics/i })).toBeInTheDocument();

    // Only Screening Reports & Clinical Reports tabs
    const screeningTab = screen.getByRole('tab', { name: /Screening Reports/i });
    const clinicalTab = screen.getByRole('tab', { name: /Clinical Reports/i });
    expect(screeningTab).toBeInTheDocument();
    expect(clinicalTab).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Overview$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Mood Tracking/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /All Reports/i })).not.toBeInTheDocument();

    // Pending clinician finalization state before doctor finalizes
    expect(screen.getByText('Pending Clinician Finalization')).toBeInTheDocument();

    // Switching to Clinical Reports tab
    fireEvent.click(clinicalTab);
    expect(screen.getByRole('heading', { name: 'Clinical Reports' })).toBeInTheDocument();
  });

  it('Screen 6 — Care Suggestions: gates personalized care plan until doctor finalizes', () => {
    renderPatientApp('/patient/care-suggestions');

    // Title
    expect(screen.getByRole('heading', { level: 1, name: /Personalised Care Suggestions/i })).toBeInTheDocument();

    // Pending clinician finalization state when doctor has not finalized
    expect(screen.getByText('Pending Clinician Finalization')).toBeInTheDocument();
    expect(screen.queryByText(/Your 4-Week Postpartum Recovery Plan/i)).not.toBeInTheDocument();
  });

  it('Patient Dashboard default route: renders the simplified 3-section minimal homepage with static 2D sculpture at /patient/dashboard', () => {
    renderPatientApp('/patient/dashboard');

    // Section 1 – Hero: navbar brand logo, headline, description, CTA
    expect(screen.getAllByAltText(/^AANCHAL/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { level: 1, name: /Beyond motherhood,\s*there is you\./i })).toBeInTheDocument();
    expect(screen.getByText(/A gentle space to understand your emotional wellbeing, find support and reconnect with yourself\./i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Begin Your Journey/i }).length).toBe(2);

    // Static 2D Mother & Baby Sculpture exists
    expect(screen.getByLabelText(/AANCHAL Mother & Baby Sculpture/i)).toBeInTheDocument();
    expect(screen.getByAltText(/AANCHAL Mother and Baby Sculpture/i)).toBeInTheDocument();

    // Section 2 – A Gentle Message
    expect(screen.getByRole('heading', { level: 2, name: /Motherhood is a journey\. You deserve care along the way\./i })).toBeInTheDocument();
    expect(screen.getByText(/Take a quiet moment to breathe, reflect, and receive the gentle care you give to others every day\./i)).toBeInTheDocument();

    // Section 3 – Final Call to Action
    expect(screen.getByRole('heading', { level: 2, name: /You are more than a mother\./i })).toBeInTheDocument();
    expect(screen.getByText(/Your feelings matter\. Your wellbeing matters\./i)).toBeInTheDocument();

    // STRICT CHECK: Clutter, cards, circular illustrations, and old sections are removed
    expect(screen.queryByText(/Gentle Care Designed Around You/i)).toBeNull();
    expect(screen.queryByText(/OUR SUPPORTIVE APPROACH/i)).toBeNull();
    expect(screen.queryByText(/Empathetic Check-ins/i)).toBeNull();
    expect(screen.queryByText(/How are you feeling right now\?/i)).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: /^Emotional Screening$/i })).toBeNull();
    expect(document.querySelector('.patient-editorial-img')).toBeNull();
  });
});

