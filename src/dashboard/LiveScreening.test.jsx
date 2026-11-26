import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClinicalProvider } from './context/ClinicalContext.jsx';
import { PatientProvider } from '../patient/context/PatientContext.jsx';
import { DashboardLayout } from './DashboardLayout.jsx';
import { LiveScreeningPage } from './pages/LiveScreeningPage.jsx';
import * as doctorApiService from './services/doctorApiService.js';

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

  it('provides a search bar with placeholder "Search mother by name" and searches patient records across database', async () => {
    const mockSearchResults = [
      {
        id: 'M-104',
        patient_id: 'M-104',
        rawUuid: '11111111-2222-3333-4444-555555555555',
        name: 'Amara K.',
        postpartumWeek: 6,
        screeningDate: '2025-01-15',
        sessionStatus: 'completed',
        modalityStatus: 'ready',
        fusionStatus: 'completed',
        hasRecording: true,
        screening: {
          id: 's-104',
          motherId: 'M-104',
          riskTier: 'Elevated Risk',
          epdsEquivalent: 14,
          fusionStatus: 'completed',
          combinedScore: 0.72,
          modalities: {
            text: { status: 'completed', score: 0.75 },
            voice: { status: 'completed', score: 0.70 },
            video: { status: 'completed', score: 0.68 },
          },
          clinicalModelPrediction: { status: 'completed', predicted_label: 'Elevated Risk' },
        },
      },
    ];

    const searchSpy = vi.spyOn(doctorApiService, 'searchMothersByName').mockResolvedValue(mockSearchResults);

    renderLiveScreening();

    const searchInput = screen.getByPlaceholderText('Search mother by name');
    expect(searchInput).toBeInTheDocument();

    // Type partial name case-insensitively
    fireEvent.change(searchInput, { target: { value: 'amar' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('amar');
    });

    // Verify matching mother is displayed in cohort table with Patient ID
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.some((r) => r.textContent.includes('Amara K.') && r.textContent.includes('(M-104)'))).toBe(true);
    });

    // Clear search restores cohort
    const clearBtn = screen.getByRole('button', { name: /Clear search text/i });
    fireEvent.click(clearBtn);

    expect(searchInput.value).toBe('');
  });

  it('supports disambiguating multiple mothers with similar names and clicking opens her details', async () => {
    const multipleMatches = [
      {
        id: 'M-104',
        name: 'Amara K.',
        postpartumWeek: 6,
        screeningDate: '2025-01-15',
        sessionStatus: 'completed',
        modalityStatus: 'ready',
        fusionStatus: 'completed',
        hasRecording: true,
      },
      {
        id: 'M-119',
        name: 'Sana K.',
        postpartumWeek: 4,
        screeningDate: '2025-01-20',
        sessionStatus: 'completed',
        modalityStatus: 'ready',
        fusionStatus: 'completed',
        hasRecording: true,
      },
      {
        id: 'M-125',
        name: 'Kavya S.',
        postpartumWeek: 8,
        screeningDate: '2025-01-22',
        sessionStatus: 'completed',
        modalityStatus: 'ready',
        fusionStatus: 'completed',
        hasRecording: true,
      },
    ];

    const searchSpy = vi.spyOn(doctorApiService, 'searchMothersByName').mockResolvedValue(multipleMatches);

    renderLiveScreening();

    const searchInput = screen.getByPlaceholderText('Search mother by name');
    fireEvent.change(searchInput, { target: { value: 'k' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('k');
    });

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.some((r) => r.textContent.includes('Amara K.') && r.textContent.includes('(M-104)'))).toBe(true);
      expect(rows.some((r) => r.textContent.includes('Sana K.') && r.textContent.includes('(M-119)'))).toBe(true);
      expect(rows.some((r) => r.textContent.includes('Kavya S.') && r.textContent.includes('(M-125)'))).toBe(true);
    });

    // Click on Sana K. row to open her details
    const rows = screen.getAllByRole('row');
    const sanaRow = rows.find((r) => r.textContent.includes('Sana K.'));
    expect(sanaRow).toBeDefined();
    fireEvent.click(sanaRow);

    await waitFor(() => {
      // Inspector heading should display Sana K.
      expect(screen.getByRole('heading', { level: 2, name: /Sana K\./i })).toBeInTheDocument();
    });
  });

  it('displays "No mothers found" and provides a Restore Cohort button when no matches exist', async () => {
    const searchSpy = vi.spyOn(doctorApiService, 'searchMothersByName').mockResolvedValue([]);

    renderLiveScreening();

    const searchInput = screen.getByPlaceholderText('Search mother by name');
    fireEvent.change(searchInput, { target: { value: 'NonexistentMother' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('NonexistentMother');
    });

    await waitFor(() => {
      expect(screen.getByText('No mothers found')).toBeInTheDocument();
      expect(screen.getByText(/No registered patients matching/i)).toBeInTheDocument();
    });

    // Click restore cohort button
    const restoreBtn = screen.getByRole('button', { name: /Restore Patient Cohort/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(screen.queryByText('No mothers found')).not.toBeInTheDocument();
      expect(searchInput.value).toBe('');
    });
  });
});
