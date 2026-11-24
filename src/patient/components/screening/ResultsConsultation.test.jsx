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
    it('displays consultation card and "Find a Doctor" button for pending/initial screening', () => {
      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      // Verify pending status is displayed without blocking consultation
      expect(screen.getAllByText(/Pending/i).length).toBeGreaterThan(0);

      // Verify consultation section is rendered
      const consultCard = screen.getByTestId('results-consultation-card');
      expect(consultCard).toBeInTheDocument();
      expect(screen.getByText('Professional Consultation Recommended')).toBeInTheDocument();
      expect(screen.getByText(/Speaking with a healthcare professional can help you understand how you are feeling/i)).toBeInTheDocument();

      // Verify action button navigates to /patient/find-doctor
      const button = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Professional Consultation section and "Find a Doctor" button for EPDS score < 10', () => {
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
      expect(screen.getByText('Professional Consultation Recommended')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Speaking with a healthcare professional can help you understand how you are feeling and explore the support available to you/i
        )
      ).toBeInTheDocument();

      const consultBtn = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(consultBtn).toBeInTheDocument();
      fireEvent.click(consultBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Professional Consultation section and "Find a Doctor" button for EPDS score 10-12', () => {
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
          /Speaking with a healthcare professional can help you understand how you are feeling and explore the support available to you/i
        )
      ).toBeInTheDocument();

      const findBtn = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(findBtn).toBeInTheDocument();
      fireEvent.click(findBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('displays Professional Consultation section and "Find a Doctor" button for EPDS score >= 13', () => {
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
          /Speaking with a healthcare professional can help you understand how you are feeling and explore the support available to you/i
        )
      ).toBeInTheDocument();

      const findBtn = screen.getByRole('button', { name: /Find a Doctor/i });
      expect(findBtn).toBeInTheDocument();
      fireEvent.click(findBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/patient/find-doctor');
    });

    it('renders simplified patient outcomes, disclaimers, and omits technical ML terms for lower risk', () => {
      localStorage.setItem(
        'aanchal_submitted_epds_assessment',
        JSON.stringify({ totalScore: 7, submittedAt: '2026-11-22T10:00:00Z', answers: {} })
      );

      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      // Verify human-first outcome
      expect(
        screen.getByText(/Your screening suggests a lower level of emotional distress based on your answers today/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/This is encouraging, but it does not mean that you cannot be experiencing emotional difficulties/i)
      ).toBeInTheDocument();

      // Verify common disclaimer AND lower-risk warning
      expect(
        screen.getByText(/AANCHAL is a screening tool, not a medical diagnosis/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/A lower-risk result does not rule out postpartum depression or other emotional health concerns/i)
      ).toBeInTheDocument();

      // Verify technical ML terminology is absent from patient view
      expect(screen.queryByText(/Random Forest/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Zero EPDS Leakage/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Learned Stacking Fusion/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Awaiting model integration/i)).not.toBeInTheDocument();
    });

    it('renders simplified patient outcomes and bottom emergency support for higher risk', () => {
      localStorage.setItem(
        'aanchal_submitted_epds_assessment',
        JSON.stringify({
          totalScore: 17,
          q10Alert: true,
          submittedAt: '2026-11-22T10:00:00Z',
          answers: { q10: 2 },
        })
      );

      render(
        <MemoryRouter>
          <PatientProvider>
            <ResultsReportsTab onTakeAiScreening={vi.fn()} onTakeEpds={vi.fn()} />
          </PatientProvider>
        </MemoryRouter>
      );

      // Verify higher risk outcome heading and body
      expect(
        screen.getByText(/Your screening suggests that you may be experiencing a higher level of emotional distress/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/It may be helpful to speak with a qualified healthcare professional for further assessment and support/i)
      ).toBeInTheDocument();

      // Verify common disclaimer is present, but lower-risk warning is NOT present
      expect(
        screen.getByText(/AANCHAL is a screening tool, not a medical diagnosis/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/A lower-risk result does not rule out postpartum depression/i)
      ).not.toBeInTheDocument();

      // Verify bottom emergency support section with Tele-MANAS (14416) and no US 988
      expect(screen.getByText(/Support Is Available Immediately/i)).toBeInTheDocument();
      expect(screen.getByText(/14416/i)).toBeInTheDocument();
      expect(screen.queryByText(/988/i)).not.toBeInTheDocument();
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
