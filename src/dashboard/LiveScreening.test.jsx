import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClinicalProvider } from './context/ClinicalContext.jsx';
import { PatientProvider } from '../patient/context/PatientContext.jsx';
import { DashboardLayout } from './DashboardLayout.jsx';
import { LiveScreeningPage } from './pages/LiveScreeningPage.jsx';

function renderLiveScreening(initialEntry = '/live-screening') {
  return render(
    <PatientProvider>
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
    </PatientProvider>
  );
}

describe('Doctor Dashboard Screening Review Workspace (LiveScreeningPage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the 3 read-only clinician tabs: AI Screening, EPDS, and Results & Reports', () => {
    renderLiveScreening();

    const tabList = screen.getByRole('tablist', { name: 'Screening sections' });
    expect(tabList).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0]).toHaveTextContent('AI Screening');
    expect(tabs[1]).toHaveTextContent('EPDS');
    expect(tabs[2]).toHaveTextContent('Results & Reports');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    expect(screen.getByLabelText('Clinician AI Screening Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient Screening Cohort')).toBeInTheDocument();
  });

  it('switches to EPDS and Results & Reports tabs', () => {
    renderLiveScreening();

    fireEvent.click(screen.getByRole('tab', { name: /EPDS/i }));
    expect(screen.getByLabelText('Clinician EPDS Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient EPDS Cohort')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Results & Reports/i }));
    expect(screen.getByLabelText('Clinician Results & Reports Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Clinical Report/i })).toBeInTheDocument();
  });
});
