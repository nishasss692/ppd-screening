import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginScreen } from './LoginScreen.jsx';
import { CreateAccountScreen } from './CreateAccountScreen.jsx';
import { DEMO_ACCOUNTS } from './auth/authService.js';

describe('Separate Authentication Screens (Login & Create Account)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const renderComponent = (initialEntries = ['/login']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/create-account" element={<CreateAccountScreen />} />
          <Route path="/dashboard" element={<div>Doctor Dashboard</div>} />
          <Route path="/mothers" element={<div>Doctor Mothers &amp; Cases</div>} />
          <Route path="/patient/dashboard" element={<div>Patient Dashboard</div>} />
          <Route path="/hospital/dashboard" element={<div>Hospital Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders Sign In screen at /login without the large illustration', () => {
    renderComponent(['/login']);

    // Left branding
    expect(screen.getByLabelText(/AANCHAL brand presentation/i)).toBeInTheDocument();
    expect(screen.getByText(/Maternal Emotional/i)).toBeInTheDocument();
    expect(screen.getByText(/Intelligence/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Compassionate/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Postpartum Journey/i);

    // Large illustration has been removed
    expect(screen.queryByAltText(/Caring mother holding her newborn baby/i)).not.toBeInTheDocument();

    // Tabs
    const signInTab = screen.getByRole('tab', { name: 'Sign In' });
    const createTab = screen.getByRole('tab', { name: 'Create Account' });
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
    expect(signInTab).toHaveClass('is-active');

    // Header text for Sign In
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome Back');
    expect(screen.getByText('Sign in to continue your AANCHAL journey.')).toBeInTheDocument();

    // Role selection & Demo buttons (Doctor, Patient, Patient's Family, Hospital)
    const patientRadio = screen.getByRole('radio', { name: 'Patient' });
    const doctorRadio = screen.getByRole('radio', { name: 'Doctor' });
    const familyRadio = screen.getByRole('radio', { name: "Patient's Family" });
    const hospitalRadio = screen.getByRole('radio', { name: 'Hospital' });
    expect(patientRadio).toHaveAttribute('aria-checked', 'true');
    expect(doctorRadio).toHaveAttribute('aria-checked', 'false');
    expect(familyRadio).toHaveAttribute('aria-checked', 'false');
    expect(hospitalRadio).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Try Demo:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Patient \(Amara\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Doctor \(Dr. Elena\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Patient's Family \(Raj\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hospital \(Apollo\)/i })).toBeInTheDocument();

    // Fields
    expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Confirm Password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forgot Password\?/i })).toBeInTheDocument();

    // Action buttons
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
    expect(submitBtn).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
  });

  it('navigates from Sign In to Create Account route upon clicking Create Account tab', async () => {
    renderComponent(['/login']);

    const createTab = screen.getByRole('tab', { name: 'Create Account' });
    fireEvent.click(createTab);

    // Navigates to /create-account
    expect(await screen.findByRole('heading', { level: 2, name: /Create (an|Your) Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Choose your role and get started with (Miora|AANCHAL)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm Password/i)).toBeInTheDocument();

    // Navigating back to Sign In
    const signInTab = screen.getByRole('tab', { name: 'Sign In' });
    fireEvent.click(signInTab);

    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome Back' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Full Name/i)).not.toBeInTheDocument();
  });

  it('renders Create Account screen by default when navigating to /create-account', () => {
    renderComponent(['/create-account']);

    const createTab = screen.getByRole('tab', { name: 'Create Account' });
    expect(createTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Create (an|Your) Account/i);
    expect(screen.getByText(/Choose your role and get started with (Miora|AANCHAL)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm Password/i)).toBeInTheDocument();
  });

  it('populates demo credentials and supports role switching on Login screen', () => {
    renderComponent(['/login']);

    const doctorDemoBtn = screen.getByRole('button', { name: /Doctor \(Dr. Elena\)/i });
    fireEvent.click(doctorDemoBtn);

    const doctorRadio = screen.getByRole('radio', { name: 'Doctor' });
    expect(doctorRadio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/^Email Address/i)).toHaveValue(DEMO_ACCOUNTS.doctor.email);
    expect(screen.getByLabelText(/^Password/i)).toHaveValue(DEMO_ACCOUNTS.doctor.password);

    const patientDemoBtn = screen.getByRole('button', { name: /Patient \(Amara\)/i });
    fireEvent.click(patientDemoBtn);

    const patientRadio = screen.getByRole('radio', { name: 'Patient' });
    expect(patientRadio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/^Email Address/i)).toHaveValue(DEMO_ACCOUNTS.patient.email);
    expect(screen.getByLabelText(/^Password/i)).toHaveValue(DEMO_ACCOUNTS.patient.password);

    const familyDemoBtn = screen.getByRole('button', { name: /Patient's Family \(Raj\)/i });
    fireEvent.click(familyDemoBtn);

    const familyRadio = screen.getByRole('radio', { name: "Patient's Family" });
    expect(familyRadio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/^Email Address/i)).toHaveValue(DEMO_ACCOUNTS.family.email);
    expect(screen.getByLabelText(/^Password/i)).toHaveValue(DEMO_ACCOUNTS.family.password);
  });

  it('validates required fields and password matching in Create Account mode', async () => {
    renderComponent(['/create-account']);

    const submitBtn = screen.getByRole('button', { name: /^Create Account$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Please create a password.')).toBeInTheDocument();
    expect(screen.getByText('Please re-enter your password.')).toBeInTheDocument();

    // Mismatched passwords
    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), { target: { value: 'different123' } });

    fireEvent.click(submitBtn);

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('successfully creates patient account and redirects to patient dashboard', async () => {
    renderComponent(['/create-account']);

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Sarah Connor' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), { target: { value: 'sarah@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /^Create Account$/i }));

    expect(await screen.findByText(/Account created successfully/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText('Patient Dashboard')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('successfully creates doctor account and redirects to doctor dashboard', async () => {
    renderComponent(['/create-account']);

    // Select doctor role
    fireEvent.click(screen.getByRole('radio', { name: /Doctor/i }));

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Dr. Gregory House' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), { target: { value: 'house@mioraclinical.org' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /^Create Account$/i }));

    expect(await screen.findByText(/Doctor credentials verified/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText(/Doctor (Mothers & Cases|Dashboard)/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('successfully signs in demo patient and redirects to patient dashboard', async () => {
    renderComponent(['/login']);

    fireEvent.click(screen.getByRole('button', { name: /Patient \(Amara\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Patient Dashboard')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('successfully signs in demo doctor and redirects to clinician dashboard', async () => {
    renderComponent(['/login']);

    fireEvent.click(screen.getByRole('button', { name: /Doctor \(Dr. Elena\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/Doctor (Mothers & Cases|Dashboard)/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("successfully signs in demo patient's family and redirects to patient dashboard", async () => {
    renderComponent(['/login']);

    fireEvent.click(screen.getByRole('button', { name: /Patient's Family \(Raj\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Patient Dashboard')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("successfully creates patient's family account and redirects to patient dashboard", async () => {
    renderComponent(['/create-account']);

    // Select family role
    fireEvent.click(screen.getByRole('radio', { name: /Patient's Family/i }));

    fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Karan Sharma' } });
    fireEvent.change(screen.getByLabelText(/^Email Address/i), { target: { value: 'karan@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /^Create Account$/i }));

    expect(await screen.findByText(/Account created successfully/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText('Patient Dashboard')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('toggles password and confirm password visibility', () => {
    renderComponent(['/create-account']);

    const passwordInput = screen.getByLabelText(/^Password/i);
    const confirmPasswordInput = screen.getByLabelText(/^Confirm Password/i);
    const togglePasswordBtn = screen.getByRole('button', { name: 'Show password' });
    const toggleConfirmBtn = screen.getByRole('button', { name: 'Show confirm password' });

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    fireEvent.click(togglePasswordBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleConfirmBtn);
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
  });

  it('switches between screens via the bottom links', async () => {
    renderComponent(['/login']);

    // Bottom link in Sign In mode
    const createAccountBottomLink = screen.getByRole('link', { name: /Create Account/i });
    fireEvent.click(createAccountBottomLink);

    expect(await screen.findByRole('heading', { level: 2, name: /Create (an|Your) Account/i })).toBeInTheDocument();

    // Bottom link in Create Account mode
    const signInBottomLink = screen.getByRole('link', { name: /Sign In/i });
    fireEvent.click(signInBottomLink);

    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome Back' })).toBeInTheDocument();
  });

  it('renders Hospital card as 4th role option and shows hospital portal UI when selected', () => {
    renderComponent(['/login']);

    // All 4 role cards exist
    const hospitalRadio = screen.getByRole('radio', { name: 'Hospital' });
    expect(hospitalRadio).toBeInTheDocument();
    expect(hospitalRadio).toHaveAttribute('aria-checked', 'false');

    // Click Hospital card
    fireEvent.click(hospitalRadio);

    // Hospital card becomes checked
    expect(hospitalRadio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Patient' })).toHaveAttribute('aria-checked', 'false');

    // Hospital-specific UI
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Hospital Portal Sign In');
    expect(screen.getByText(/Sign in with your registered hospital email or organisation ID/i)).toBeInTheDocument();

    // Email field accepts text (org ID) not just email
    const emailInput = screen.getByLabelText(/Hospital Email or Organisation ID/i);
    expect(emailInput).toHaveAttribute('type', 'text');

    // Google sign-in and Create Account link are hidden
    expect(screen.queryByRole('button', { name: /Continue with Google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create Account/i })).not.toBeInTheDocument();

    // Tabs bar is hidden
    expect(screen.queryByRole('tab', { name: 'Sign In' })).not.toBeInTheDocument();

    // Back button is shown
    expect(screen.getByRole('button', { name: /Back to portal selection/i })).toBeInTheDocument();

    // Hospital demo auto-fill
    fireEvent.click(screen.getByRole('button', { name: /Hospital \(Apollo\)/i }));
    expect(screen.getByLabelText(/Hospital Email or Organisation ID/i)).toHaveValue('apollo@hospital.miora.health');
  });

  it('back button returns from hospital panel to patient role selection', () => {
    renderComponent(['/login']);

    // Select hospital
    fireEvent.click(screen.getByRole('radio', { name: 'Hospital' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Hospital Portal Sign In');

    // Click back
    fireEvent.click(screen.getByRole('button', { name: /Back to portal selection/i }));

    // Returns to patient welcome
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Welcome Back');
    expect(screen.getByRole('tab', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Patient' })).toHaveAttribute('aria-checked', 'true');
  });

  it('successfully signs in demo hospital and redirects to hospital dashboard', async () => {
    renderComponent(['/login']);

    fireEvent.click(screen.getByRole('button', { name: /Hospital \(Apollo\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Hospital Portal/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Hospital Dashboard')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});
