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

describe('Clinic & Doctor Screening Workspace (LiveScreeningPage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders In-Clinic Patient Screening by default with the exact 4 patient screening tabs', () => {
    renderLiveScreening();

    expect(screen.getByText('IN-CLINIC PATIENT SCREENING')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Maternal Screening Session/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Select patient for in-clinic screening')).toBeInTheDocument();

    const tabList = screen.getByRole('tablist', { name: 'Screening sections' });
    expect(tabList).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0]).toHaveTextContent('AI Screening');
    expect(tabs[1]).toHaveTextContent('Wellbeing & Support');
    expect(tabs[2]).toHaveTextContent('EPDS');
    expect(tabs[3]).toHaveTextContent('Results & Reports');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('allows switching between In-Clinic Screening and Cohort Review modes', () => {
    renderLiveScreening();

    // Switch to Cohort Review
    fireEvent.click(screen.getByRole('button', { name: 'Cohort Review' }));
    expect(screen.getByText('PATIENT SCREENING REVIEW')).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0]).toHaveTextContent('AI Screening');
    expect(tabs[1]).toHaveTextContent('EPDS');
    expect(tabs[2]).toHaveTextContent('Results & Reports');

    expect(screen.getByLabelText('Clinician AI Screening Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient Screening Cohort')).toBeInTheDocument();
  });

  it('allows switching to EPDS and Results & Reports in Cohort Review mode', () => {
    renderLiveScreening('/live-screening?mode=review');

    fireEvent.click(screen.getByRole('tab', { name: /EPDS/i }));
    expect(screen.getByLabelText('Clinician EPDS Overview')).toBeInTheDocument();
    expect(screen.getByText('Authorized Patient EPDS Cohort')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Results & Reports/i }));
    expect(screen.getByLabelText('Clinician Results & Reports Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Clinical Report/i })).toBeInTheDocument();
  });
});
