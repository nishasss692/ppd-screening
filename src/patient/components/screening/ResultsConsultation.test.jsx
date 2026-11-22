import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsReportsTab } from './ResultsReportsTab.jsx';
import { ScreeningResultsPage } from '../../pages/ScreeningResultsPage.jsx';
import { PatientProvider } from '../../context/PatientContext.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AANCHAL — Permanent Doctor Consultation on Screening Results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('ResultsReportsTab (Screening Workspace Tab 3)', () => {
    it('displays consultation card when AI models are pending integration and EPDS not yet taken', () => {
      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      // Verify AI models pending status is displayed without blocking consultation
      expect(screen.getAllByText(/Awaiting model integration/i).length).toBeGreaterThan(0);

      // Verify consultation card is rendered
      const consultCard = screen.getByTestId('results-consultation-card');
      expect(consultCard).toBeInTheDocument();
      expect(screen.getByText(/Consult a Healthcare Professional/i)).toBeInTheDocument();
      expect(screen.getByText(/AI multimodal analysis is currently awaiting model integration/i)).toBeInTheDocument();

      // Verify action button navigates to /patient/find-doctor
      const button = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Low Risk consultation card and "Consult a Doctor" button for EPDS score < 10', () => {
      localStorage.setItem(
        'aanchal_submitted_epds_assessment',
        JSON.stringify({ totalScore: 6, submittedAt: '2026-11-20T10:00:00Z', answers: {} })
      );

      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      const consultCard = screen.getByTestId('results-consultation-card');
      expect(consultCard).toBeInTheDocument();
      expect(screen.getByText('Your Current Screening Result')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your current screening session shows low-risk indicators. If you are still concerned about your emotional wellbeing, you can consult a healthcare professional.'
        )
      ).toBeInTheDocument();

      const consultBtn = screen.getByRole('button', { name: /Consult a Doctor/i });
      expect(consultBtn).toBeInTheDocument();
      fireEvent.click(consultBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Moderate Risk consultation card and "Find a Doctor" button for EPDS score 10-12', () => {
      localStorage.setItem(
        'aanchal_submitted_epds_assessment',
        JSON.stringify({ totalScore: 11, submittedAt: '2026-11-20T10:00:00Z', answers: {} })
      );

      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      const consultCard = screen.getByTestId('results-consultation-card');
      expect(consultCard).toBeInTheDocument();
      expect(screen.getByText('Professional Consultation Recommended')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your screening session shows indicators that may benefit from further professional assessment.'
        )
      ).toBeInTheDocument();

      const findBtn = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(findBtn).toBeInTheDocument();
      fireEvent.click(findBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays High Risk consultation card and "Find a Doctor" button for EPDS score >= 13', () => {
      localStorage.setItem(
        'aanchal_submitted_epds_assessment',
        JSON.stringify({ totalScore: 16, submittedAt: '2026-11-20T10:00:00Z', answers: {} })
      );

      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      const consultCard = screen.getByTestId('results-consultation-card');
      expect(consultCard).toBeInTheDocument();
      expect(screen.getByText('Professional Consultation Recommended')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your screening session indicates that professional assessment may be helpful. We recommend consulting a qualified healthcare professional.'
        )
      ).toBeInTheDocument();

      const findBtn = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(findBtn).toBeInTheDocument();
      fireEvent.click(findBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });
  });

  describe('ScreeningResultsPage (/patient/screening/results)', () => {
    it('displays Low Risk consultation card and navigates to /patient/find-doctor', () => {
      render(
        <MemoryRouter initialEntries={['/patient/screening/results?score=20']}>
          <PatientProvider>
            <Routes>
              <Route path="/patient/screening/results" element={<ScreeningResultsPage />} />
            </Routes>
          </PatientProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Your Current Screening Result')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your current screening session shows low-risk indicators. If you are still concerned about your emotional wellbeing, you can consult a healthcare professional.'
        )
      ).toBeInTheDocument();

      const button = screen.getByRole('button', { name: /Consult a Doctor/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Moderate Risk consultation card and navigates to /patient/find-doctor', () => {
      render(
        <MemoryRouter initialEntries={['/patient/screening/results?score=38']}>
          <PatientProvider>
            <Routes>
              <Route path="/patient/screening/results" element={<ScreeningResultsPage />} />
            </Routes>
          </PatientProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Professional Consultation Recommended')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your screening session shows indicators that may benefit from further professional assessment.'
        )
      ).toBeInTheDocument();

      const button = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays High Risk consultation card and navigates to /patient/find-doctor', () => {
      render(
        <MemoryRouter initialEntries={['/patient/screening/results?score=72']}>
          <PatientProvider>
            <Routes>
              <Route path="/patient/screening/results" element={<ScreeningResultsPage />} />
            </Routes>
          </PatientProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Professional Consultation Recommended')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your screening session indicates that professional assessment may be helpful. We recommend consulting a qualified healthcare professional.'
        )
      ).toBeInTheDocument();

      const button = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Pending consultation card when no score has been computed', () => {
      render(
        <MemoryRouter initialEntries={['/patient/screening/results?status=pending']}>
          <PatientProvider>
            <Routes>
              <Route path="/patient/screening/results" element={<ScreeningResultsPage />} />
            </Routes>
          </PatientProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Consult a Healthcare Professional')).toBeInTheDocument();
      expect(
        screen.getByText(
          'AI multimodal analysis is currently awaiting model integration and pending final clinical scoring. You can explore verified specialists, clinics, and hospital care teams at any time without waiting for AI processing.'
        )
      ).toBeInTheDocument();

      const button = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });
  });
});
