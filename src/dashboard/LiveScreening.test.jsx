import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClinicalProvider } from './context/ClinicalContext.jsx';
import { DashboardLayout } from './DashboardLayout.jsx';
import { LiveScreeningPage } from './pages/LiveScreeningPage.jsx';

function renderLiveScreening(initialEntry = '/live-screening') {
  return render(
    <ClinicalProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/live-screening" element={<LiveScreeningPage />} />
            <Route path="/dashboard" element={<div>Dashboard View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ClinicalProvider>
  );
}

describe('Clinician Screening Oversight & Review (LiveScreeningPage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Maternal Screening Review page header and removes all live recording controls', () => {
    renderLiveScreening();

    // Check header
    expect(screen.getByText('PATIENT SCREENING REVIEW')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Maternal Screening/i })).toBeInTheDocument();

    // Verify clinician-side live recording controls are completely absent
    expect(screen.queryByText(/Live Session Active/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Elapsed session time/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Live Session' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Conversation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Real-time Signals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Session Progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Screening/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Consent & Start Media/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mother response text/i)).not.toBeInTheDocument();
  });

  it('renders exactly the 3 standard screening tabs: AI Screening, EPDS, and Results & Reports', () => {
    renderLiveScreening();

    const tabList = screen.getByRole('tablist', { name: 'Screening sections' });
    expect(tabList).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0]).toHaveTextContent('AI Screening');
    expect(tabs[1]).toHaveTextContent('EPDS');
    expect(tabs[2]).toHaveTextContent('Results & Reports');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('displays patient cohort table and inspects AI Screening modalities awaiting model integration', () => {
    renderLiveScreening();

    // AI Screening tab is active by default
    expect(screen.getByLabelText('Clinician AI Screening Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient Screening Cohort')).toBeInTheDocument();

    // Verify table headers
    expect(screen.getByText('Audio Model')).toBeInTheDocument();
    expect(screen.getByText('Video Model')).toBeInTheDocument();
    expect(screen.getByText('Text Model')).toBeInTheDocument();
    expect(screen.getByText('Multimodal Fusion')).toBeInTheDocument();

    // Verify awaiting integration indicators (no fake predictions)
    const awaitingBadges = screen.getAllByText(/Awaiting (model )?integration/i);
    expect(awaitingBadges.length).toBeGreaterThan(0);
  });

  it('allows switching to EPDS tab to inspect itemized responses and Q10 safety alerts', () => {
    renderLiveScreening();

    const epdsTab = screen.getByRole('tab', { name: /EPDS/i });
    fireEvent.click(epdsTab);

    expect(screen.getByLabelText('Clinician EPDS Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient EPDS Cohort')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Total EPDS Score/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Question 10 Alert/i })).toBeInTheDocument();

    // Verify itemized questions section
    expect(screen.getByText('Itemized Responses (Questions 1 through 10)')).toBeInTheDocument();
  });

  it('allows switching to Results & Reports tab to inspect clinical portfolio and export report', () => {
    renderLiveScreening();

    const resultsTab = screen.getByRole('tab', { name: /Results & Reports/i });
    fireEvent.click(resultsTab);

    expect(screen.getByLabelText('Clinician Results & Reports Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient Assessment History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Clinical Report/i })).toBeInTheDocument();
  });
});
