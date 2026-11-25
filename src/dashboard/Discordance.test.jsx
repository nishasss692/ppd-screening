import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClinicalProvider } from './context/ClinicalContext.jsx';
import { DashboardLayout } from './DashboardLayout.jsx';
import { DiscordancePage } from './pages/DiscordancePage.jsx';

function renderDiscordance(initialEntry = '/discordance') {
  return render(
    <ClinicalProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/discordance" element={<DiscordancePage />} />
            <Route path="/discordance/:motherId" element={<DiscordancePage />} />
            <Route path="/results" element={<DiscordancePage />} />
            <Route path="/results/:motherId" element={<DiscordancePage />} />
            <Route path="/clinical-review" element={<DiscordancePage />} />
            <Route path="/mothers/:motherId" element={<div>Mother Record View</div>} />
            <Route path="/insights" element={<div>Insights &amp; Care View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ClinicalProvider>
  );
}

describe('Miora Screen 06: Cross-Modal Discordance', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders header, patient strip, Modality Comparison, Risk by Modality, Discordance Result, Key Observations, and Clinical Interpretation', () => {
    renderDiscordance();

    expect(screen.getByRole('link', { name: 'Discordance' })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Screening' })).toBeInTheDocument();
    expect(screen.getByText('DISCORDANCE ANALYSIS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Cross-Modal Discordance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Note/i })).toBeInTheDocument();

    // Patient Strip defaults to M-108
    expect(screen.getByLabelText('Select mother for discordance analysis')).toHaveValue('M-108');
    expect(screen.getByText('N. R.')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Multimodal (Text · Voice · Video)')).toBeInTheDocument();
    expect(screen.getByText('Apr 16, 2026 · 10:24 AM')).toBeInTheDocument();
    expect(screen.queryByText('Analysis Completed')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Record/i })).toHaveAttribute(
      'href',
      '/mothers/M-108'
    );

    // Row 1A: Modality Comparison table
    const comparisonTable = screen.getByRole('table');
    expect(within(comparisonTable).getByText('Text')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('0.58')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('Voice')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('0.66')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('Video')).toBeInTheDocument();
    expect(within(comparisonTable).getByText('0.60')).toBeInTheDocument();

    // Row 1B: Risk by Modality chart + hover tooltip interaction
    expect(screen.getByRole('heading', { name: 'Risk by Modality' })).toBeInTheDocument();
    const voiceBarCol = screen.getByLabelText(/Voice \(Acoustic\): 0\.66/i);
    fireEvent.mouseEnter(voiceBarCol);
    expect(screen.getByRole('status')).toHaveTextContent('Voice: 0.66 (Moderate)');

    // Row 1C: Discordance Result focused on discordance
    expect(screen.getByRole('heading', { name: 'Discordance Result' })).toBeInTheDocument();
    expect(screen.getByText('0.81')).toBeInTheDocument();
    expect(screen.getByText('Notable Difference')).toBeInTheDocument();

    // Row 2A: Key Observations
    expect(screen.getByRole('heading', { name: 'Key Observations' })).toBeInTheDocument();
    expect(screen.getAllByText('Elevated negative sentiment in text')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Higher vocal strain and lower energy')[0]).toBeInTheDocument();

    // Row 2B: Clinical Interpretation (no deception / underreporting wording)
    expect(screen.getByRole('heading', { name: 'Clinical Interpretation' })).toBeInTheDocument();
    expect(document.body.textContent.toLowerCase()).not.toContain('underreporting');
    expect(document.body.textContent.toLowerCase()).not.toContain('concealing');
  });

  it('withholds pairwise & discordance calculations when required modalities are missing', () => {
    renderDiscordance('/discordance/M-112');

    expect(screen.getByLabelText('Select mother for discordance analysis')).toHaveValue('M-112');
    expect(screen.queryByText('Analysis Pending')).not.toBeInTheDocument();
    expect(screen.getByText('Insufficient Modalities')).toBeInTheDocument();

    renderDiscordance('/discordance/M-999');
    expect(screen.getByText('Discordance Record Not Found')).toBeInTheDocument();
  });

  it('supports Add Note and patient switching', () => {
    renderDiscordance();

    // Switch patient via dropdown to M-104
    fireEvent.change(screen.getByLabelText('Select mother for discordance analysis'), {
      target: { value: 'M-104' },
    });
    expect(screen.getByText('A. S.')).toBeInTheDocument();
    expect(screen.getByText('0.74')).toBeInTheDocument();

    // Add Contextual Note (validates empty state then saves)
    fireEvent.click(screen.getByRole('button', { name: /Add Note/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Please enter a contextual clinical observation/i
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Document sleep context, psychosocial factors/i),
      { target: { value: 'Mother reported disrupted nighttime sleep during intake.' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Contextual note saved for M-104/i);
    expect(
      screen.getByText('Mother reported disrupted nighttime sleep during intake.')
    ).toBeInTheDocument();
  });
});
