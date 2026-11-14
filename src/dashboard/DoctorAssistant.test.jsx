import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClinicalProvider } from './context/ClinicalContext.jsx';
import { TopNav } from './components/TopNav.jsx';
import * as docService from './services/doctorAssistantService.js';

function renderTopNav() {
  return render(
    <ClinicalProvider>
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>
    </ClinicalProvider>
  );
}

describe('Doctor Dashboard AI Assistant (Phase 5 Clinician Copilot)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Clinician AI Assistant button in TopNav and toggles the popover', async () => {
    renderTopNav();

    const assistantBtn = screen.getByRole('button', { name: /Clinician AI Assistant/i });
    expect(assistantBtn).toBeInTheDocument();

    // Click to open popover
    fireEvent.click(assistantBtn);

    const popover = await screen.findByTestId('doctor-assistant-popover');
    expect(popover).toBeInTheDocument();
    expect(screen.getByText('Miora Clinical Copilot')).toBeInTheDocument();
    expect(screen.getByText('Non-Diagnostic')).toBeInTheDocument();
    expect(
      screen.getByText(/Strictly non-diagnostic workflow assistance/i)
    ).toBeInTheDocument();

    // Close button dismisses popover
    const closeBtn = screen.getByRole('button', { name: /Close assistant/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('doctor-assistant-popover')).not.toBeInTheDocument();
  });

  it('sends clinician workflow question to API and displays returned answer', async () => {
    const sendSpy = vi.spyOn(docService, 'sendDoctorAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'Cross-modal discordance evaluates divergence between EPDS self-report and acoustic/facial signals.',
      message: 'Cross-modal discordance evaluates divergence between EPDS self-report and acoustic/facial signals.',
      source: 'gemini',
      model: 'gemini-2.5-flash',
      is_diagnostic: false,
      disclaimer: 'Strictly non-diagnostic.',
    });

    renderTopNav();

    fireEvent.click(screen.getByRole('button', { name: /Clinician AI Assistant/i }));
    await screen.findByTestId('doctor-assistant-popover');

    const input = screen.getByPlaceholderText(/Ask about dashboard navigation or EPDS/i);
    const sendBtn = screen.getByRole('button', { name: /Send query/i });

    fireEvent.change(input, { target: { value: 'How does cross-modal discordance work?' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Cross-modal discordance evaluates divergence/i)
      ).toBeInTheDocument();
      expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument();
    });
  });

  it('clicking a preset query chip sends the query automatically', async () => {
    const sendSpy = vi.spyOn(docService, 'sendDoctorAssistantChat').mockResolvedValueOnce({
      status: 'success',
      text: 'EPDS standard cutoffs are: 0-9 low likelihood, 10-12 possible, 13-30 probable. Item 10 triggers safety assessment.',
      message: 'EPDS standard cutoffs are: 0-9 low likelihood, 10-12 possible, 13-30 probable. Item 10 triggers safety assessment.',
      source: 'gemini',
      model: 'gemini-2.5-flash',
      is_diagnostic: false,
    });

    renderTopNav();

    fireEvent.click(screen.getByRole('button', { name: /Clinician AI Assistant/i }));
    await screen.findByTestId('doctor-assistant-popover');

    const presetChip = screen.getByRole('button', { name: /Explain EPDS cutoffs and Item 10 rule/i });
    expect(presetChip).toBeInTheDocument();
    fireEvent.click(presetChip);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][0].message).toBe('Explain EPDS cutoffs and Item 10 rule');
    });

    await waitFor(() => {
      expect(screen.getByText(/EPDS standard cutoffs are: 0-9 low likelihood/i)).toBeInTheDocument();
    });
  });

  it('displays non-diagnostic boundary refusal when query attempts diagnosis or prescription', async () => {
    vi.spyOn(docService, 'sendDoctorAssistantChat').mockResolvedValueOnce({
      status: 'refusal',
      text: 'Non-Diagnostic Clinical Boundary Notice: The Miora Clinician Copilot cannot diagnose patients or prescribe medications.',
      message: 'Non-Diagnostic Clinical Boundary Notice: The Miora Clinician Copilot cannot diagnose patients or prescribe medications.',
      source: 'safety_filter',
      model: null,
      is_diagnostic: false,
    });

    renderTopNav();

    fireEvent.click(screen.getByRole('button', { name: /Clinician AI Assistant/i }));
    await screen.findByTestId('doctor-assistant-popover');

    const input = screen.getByPlaceholderText(/Ask about dashboard navigation or EPDS/i);
    const sendBtn = screen.getByRole('button', { name: /Send query/i });

    fireEvent.change(input, { target: { value: 'Diagnose this patient and prescribe sertraline.' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Non-Diagnostic Clinical Boundary Notice/i)).toBeInTheDocument();
      expect(screen.getByText('Boundary Filter')).toBeInTheDocument();
    });
  });
});

