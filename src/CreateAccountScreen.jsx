import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BrandWordmark } from './dashboard/components/BrandWordmark.jsx';
import { registerAccount, DEMO_ACCOUNTS } from './auth/authService.js';
import './styles/login.css';

// SVG Icons matching Miora's clean stroke style and reference screenshot
const Icons = {
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  stethoscope: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3" />
      <path d="M9 12.5v4a3.5 3.5 0 0 0 7 0v-2.5" />
      <circle cx="16" cy="14" r="2.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M3 3h3M12 3h3" />
    </svg>
  ),
  mail: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  lock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="11" width="15" height="10" rx="2.5" />
      <path d="M7.5 11V7a4.5 4.5 0 0 1 9 0v4" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ),
  arrowRight: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  family: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  check: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6.5 4.8 9.2 10 3" />
    </svg>
  ),
};

export function CreateAccountScreen() {
  const navigate = useNavigate();

  // Selected role: 'patient' (default) | 'doctor'
  const [selectedRole, setSelectedRole] = useState('patient');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility states (hidden by default)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Interaction feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Validation function
  const validateForm = () => {
    const errors = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errors.fullName = 'Please enter your full name.';
    } else if (trimmedName.length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Please create a password.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please re-enter your password.';
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Role-based registration behavior
      if (selectedRole === 'doctor') {
        const trimmedEmail = email.trim().toLowerCase();
        await registerAccount({
          name: fullName.trim(),
          email: trimmedEmail,
          password,
          role: 'doctor',
        });

        setSuccessMessage('Doctor credentials verified. Routing to clinical dashboard...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 600);
      } else if (selectedRole === 'family') {
        // Patient's Family registration
        await registerAccount({
          name: fullName.trim(),
          email: email.trim(),
          password,
          role: 'family',
          patientEmail: patientEmail.trim() || undefined,
        });

        setSuccessMessage("Account created successfully! Welcome to Patient's Family Support. Redirecting...");
        setTimeout(() => {
          navigate('/patient/dashboard');
        }, 600);
      } else {
        // Patient registration
        await registerAccount({
          name: fullName.trim(),
          email: email.trim(),
          password,
          role: 'patient',
        });

        setSuccessMessage('Account created successfully! Welcome to your AANCHAL dashboard. Redirecting...');
        setTimeout(() => {
          navigate('/patient/dashboard');
        }, 600);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-root create-account-root">
      {/* Background Flowing Wave Shapes matching exact reference curves */}
      <div className="login-bg-decor" aria-hidden="true">
        <svg
          className="login-bg-svg"
          viewBox="0 0 1024 768"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top sweeping curve flowing from center to top right */}
          <path
            d="M 320 0 C 420 70, 560 90, 720 50 C 850 15, 950 65, 1024 130 L 1024 0 Z"
            fill="url(#topWaveGrad)"
            opacity="0.85"
          />
          {/* Far-right layered curve */}
          <path
            d="M 1024 120 C 930 200, 920 380, 965 520 C 990 600, 1010 650, 1024 680 L 1024 120 Z"
            fill="url(#rightWaveGrad)"
            opacity="0.5"
          />
          {/* Bottom sweeping curves behind mother and under registration card */}
          <path
            d="M 0 768 L 0 710 C 180 670, 340 730, 520 715 C 720 700, 860 745, 1024 700 L 1024 768 Z"
            fill="url(#bottomWaveGrad)"
            opacity="0.75"
          />
          <path
            d="M 0 768 L 0 735 C 220 700, 420 750, 680 735 C 880 720, 960 755, 1024 735 L 1024 768 Z"
            fill="url(#bottomWaveGrad2)"
            opacity="0.85"
          />

          <defs>
            <linearGradient id="topWaveGrad" x1="0.3" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#fdebf0" />
              <stop offset="50%" stopColor="#f8d6e0" />
              <stop offset="100%" stopColor="#fae4ec" />
            </linearGradient>
            <linearGradient id="rightWaveGrad" x1="0.5" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fae1ea" />
              <stop offset="100%" stopColor="#f7d0dc" />
            </linearGradient>
            <linearGradient id="bottomWaveGrad" x1="0" y1="0" x2="1" y2="0.6">
              <stop offset="0%" stopColor="#fcebf0" />
              <stop offset="50%" stopColor="#f8d6e1" />
              <stop offset="100%" stopColor="#fae3ec" />
            </linearGradient>
            <linearGradient id="bottomWaveGrad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbe3eb" />
              <stop offset="100%" stopColor="#f8cede" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="login-container create-account-container">
        {/* ================================================================
            Left Section – Branding and Introduction
            ================================================================ */}
        <section className="login-left-col create-account-left-col" aria-label="AANCHAL registration overview">
          <div className="login-left-top">
            {/* Upper-left branding */}
            <div className="login-branding create-account-branding">
              <Link to="/" className="login-logo-link" aria-label="AANCHAL Home">
                <BrandWordmark height={46} />
              </Link>

              {/* Exact Tagline */}
              <p className="login-tagline create-account-tagline">
                Maternal Emotional<br />
                Intelligence
              </p>

              {/* Thin, subtle raspberry-pink divider */}
              <div className="login-brand-divider create-account-divider" aria-hidden="true" />
            </div>

            {/* Main Editorial Heading */}
            <h1 className="login-heading create-account-heading">
              Create Your<br />
              <em className="create-account-italic">AANCHAL Account</em>
            </h1>

            {/* Supporting Copy */}
            <p className="login-subtext create-account-subtext">
              Join AANCHAL to screen, understand and get personalised support for your postpartum wellbeing.
            </p>
          </div>

          {/* Mother and Baby Illustration in normal flex flow (never overlaps text) */}
          
        </section>

        {/* ================================================================
            Right Section – Registration Card
            ================================================================ */}
        <section className="login-right-col" aria-label="Create account form">
          <div className="login-auth-card create-account-card">
            {/* Tabs: Sign In / Create Account */}
            <div className="login-tabs-bar" role="tablist" aria-label="Authentication modes">
              <button
                type="button"
                role="tab"
                id="tab-signin"
                aria-selected={false}
                className="login-tab-btn"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                id="tab-create"
                aria-selected={true}
                className="login-tab-btn is-active create-account-active-tab"
              >
                Create Account
              </button>
            </div>

            {/* Heading & Subtitle */}
            <header className="login-card-header create-account-card-header">
              <h2 className="login-card-title">Create an Account</h2>
              <p className="login-card-subtext">Choose your role and get started with AANCHAL.</p>
            </header>

            {/* Top Alert Messages */}
            {errorMessage && (
              <div className="login-alert login-alert-error" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="login-alert login-alert-success" role="status">
                <span>{successMessage}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Role Selection */}
              <div className="login-role-section">
                <label className="login-role-label" id="role-select-label">
                  I am a<span className="login-required-star">*</span>
                </label>
                <div
                  className="login-role-grid"
                  role="radiogroup"
                  aria-labelledby="role-select-label"
                >
                  {/* Patient Card (Selected by default) */}
                  <button
                    type="button"
                    id="role-patient"
                    role="radio"
                    aria-label="Patient"
                    aria-checked={selectedRole === 'patient'}
                    tabIndex={0}
                    className={`login-role-card ${selectedRole === 'patient' ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedRole('patient');
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setSelectedRole('patient');
                      }
                    }}
                  >
                    <span className="login-role-icon">{Icons.user}</span>
                    <span className="login-role-content">
                      <strong className="login-role-title">Patient</strong>
                      <span className="login-role-desc">For new mothers and postpartum care</span>
                    </span>
                    <span className="login-role-indicator">
                      {selectedRole === 'patient' ? (
                        <span className="login-indicator-checked">{Icons.check}</span>
                      ) : (
                        <span className="login-indicator-empty" />
                      )}
                    </span>
                  </button>

                  {/* Doctor Card */}
                  <button
                    type="button"
                    id="role-doctor"
                    role="radio"
                    aria-label="Doctor"
                    aria-checked={selectedRole === 'doctor'}
                    tabIndex={0}
                    className={`login-role-card ${selectedRole === 'doctor' ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedRole('doctor');
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setSelectedRole('doctor');
                      }
                    }}
                  >
                    <span className="login-role-icon">{Icons.stethoscope}</span>
                    <span className="login-role-content">
                      <strong className="login-role-title">Doctor</strong>
                      <span className="login-role-desc">For healthcare professionals</span>
                    </span>
                    <span className="login-role-indicator">
                      {selectedRole === 'doctor' ? (
                        <span className="login-indicator-checked">{Icons.check}</span>
                      ) : (
                        <span className="login-indicator-empty" />
                      )}
                    </span>
                  </button>

                  {/* Patient's Family Card */}
                  <button
                    type="button"
                    id="role-family"
                    role="radio"
                    aria-label="Patient's Family"
                    aria-checked={selectedRole === 'family'}
                    tabIndex={0}
                    className={`login-role-card ${selectedRole === 'family' ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedRole('family');
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setSelectedRole('family');
                      }
                    }}
                  >
                    <span className="login-role-icon">{Icons.family}</span>
                    <span className="login-role-content">
                      <strong className="login-role-title">Patient's Family</strong>
                      <span className="login-role-desc">For partners, family & caregivers</span>
                    </span>
                    <span className="login-role-indicator">
                      {selectedRole === 'family' ? (
                        <span className="login-indicator-checked">{Icons.check}</span>
                      ) : (
                        <span className="login-indicator-empty" />
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Optional Linked Mother Email when registering as Family */}
              {selectedRole === 'family' && (
                <div className="login-form-group">
                  <label className="login-field-label" htmlFor="reg-patient-email">
                    Linked Mother's Email <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>(optional)</span>
                  </label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">{Icons.mail}</span>
                    <input
                      id="reg-patient-email"
                      type="email"
                      className="login-input-field"
                      placeholder="e.g. patient@miora.health"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Full Name Field */}
              <div className="login-form-group">
                <label className="login-field-label" htmlFor="reg-fullname">
                  Full Name<span className="login-required-star">*</span>
                </label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">{Icons.user}</span>
                  <input
                    id="reg-fullname"
                    type="text"
                    className={`login-text-input ${fieldErrors.fullName ? 'has-error' : ''}`}
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                      }
                    }}
                    autoComplete="name"
                    required
                  />
                </div>
                {fieldErrors.fullName && (
                  <span className="login-field-error-text">{fieldErrors.fullName}</span>
                )}
              </div>

              {/* Email Address Field */}
              <div className="login-form-group">
                <label className="login-field-label" htmlFor="reg-email">
                  Email Address<span className="login-required-star">*</span>
                </label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">{Icons.mail}</span>
                  <input
                    id="reg-email"
                    type="email"
                    className={`login-text-input ${fieldErrors.email ? 'has-error' : ''}`}
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: '' }));
                      }
                    }}
                    autoComplete="email"
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <span className="login-field-error-text">{fieldErrors.email}</span>
                )}
              </div>

              {/* Password Field */}
              <div className="login-form-group">
                <label className="login-field-label" htmlFor="reg-password">
                  Password<span className="login-required-star">*</span>
                </label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">{Icons.lock}</span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`login-text-input ${fieldErrors.password ? 'has-error' : ''}`}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: '' }));
                      }
                    }}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    id="toggle-password"
                    className="login-visibility-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? Icons.eye : Icons.eyeOff}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span className="login-field-error-text">{fieldErrors.password}</span>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="login-form-group">
                <label className="login-field-label" htmlFor="reg-confirm-password">
                  Confirm Password<span className="login-required-star">*</span>
                </label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">{Icons.lock}</span>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`login-text-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    id="toggle-confirm-password"
                    className="login-visibility-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? Icons.eye : Icons.eyeOff}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="login-field-error-text">{fieldErrors.confirmPassword}</span>
                )}
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                className="login-submit-btn create-account-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="login-spinner" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <span>{Icons.arrowRight}</span>
                  </>
                )}
              </button>

              {/* Bottom Navigation Link */}
              <div className="create-account-bottom-link">
                <span>Already have an account? </span>
                <Link to="/login" className="create-account-signin-link">
                  Sign In
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CreateAccountScreen;
