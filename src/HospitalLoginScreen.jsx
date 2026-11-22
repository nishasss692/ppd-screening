import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginHospital } from './hospital/hospitalService.js';
import './styles/hospitalLogin.css';

/* ── SVG icon helpers (stroke-only, matching Miora style) ─────────────────── */
const HospIcon = {
  building: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <rect x="9" y="9" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="13" y="9" width="2" height="2" fill="currentColor" stroke="none" />
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
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  arrowLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  cross: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

export function HospitalLoginScreen() {
  const navigate = useNavigate();

  const [orgId, setOrgId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /* Forgot password — informational only, no real reset flow yet */
  const handleForgotPassword = () => {
    if (!orgId) {
      setErrorMessage('Please enter your hospital email or organisation ID first.');
      return;
    }
    setErrorMessage('');
    setSuccessMessage(
      `Password reset instructions have been sent to ${orgId}. (Demo — no real email is dispatched.)`
    );
  };

  /* Login — honest placeholder until hospital auth is implemented */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedId = orgId.trim();
    const trimmedPw = password.trim();

    if (!trimmedId) {
      setErrorMessage('Please enter your hospital email or organisation ID.');
      return;
    }
    if (!trimmedPw || trimmedPw.length < 6) {
      setErrorMessage('Please enter a valid password (minimum 6 characters).');
      return;
    }

    setIsLoading(true);
    try {
      await loginHospital(trimmedId, trimmedPw);
      navigate('/hospital/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Hospital sign-in failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hosp-login-root">
      {/* Background decorative teal waves */}
      <div className="hosp-login-bg-decor" aria-hidden="true">
        <svg
          className="hosp-login-bg-svg"
          viewBox="0 0 1024 768"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 0 0 L 1024 0 L 1024 160 C 940 190, 780 120, 640 100 C 460 75, 340 150, 180 125 C 90 110, 30 70, 0 85 Z"
            fill="url(#hospTopWave)"
            opacity="0.75"
          />
          <path
            d="M 0 135 C 160 170, 310 80, 520 60 C 740 40, 890 130, 1024 95 L 1024 0 L 0 0 Z"
            fill="url(#hospTopWash)"
            opacity="0.45"
          />
          <path
            d="M 940 0 C 980 140, 920 280, 980 430 C 1010 500, 1015 620, 1024 768 L 1024 0 Z"
            fill="url(#hospRightWave)"
            opacity="0.5"
          />
          <path
            d="M 0 650 C 60 700, 180 680, 300 720 C 420 760, 520 740, 620 768 L 0 768 Z"
            fill="url(#hospBottomWave)"
            opacity="0.4"
          />
          <defs>
            <linearGradient id="hospTopWave" x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#c7e8f3" />
              <stop offset="50%" stopColor="#b6def0" />
              <stop offset="100%" stopColor="#d4eff7" />
            </linearGradient>
            <linearGradient id="hospTopWash" x1="0" y1="0" x2="0.9" y2="1">
              <stop offset="0%" stopColor="#a8d8ea" />
              <stop offset="100%" stopColor="#c7e8f3" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hospRightWave" x1="0.8" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b6def0" />
              <stop offset="100%" stopColor="#c7e8f3" />
            </linearGradient>
            <linearGradient id="hospBottomWave" x1="0" y1="1" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#a8d8ea" />
              <stop offset="100%" stopColor="#c7e8f3" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="hosp-login-container">
        {/* ============================================================
            Left — Branding
            ============================================================ */}
        <section className="hosp-login-left-col" aria-label="AANCHAL Hospital Portal branding">
          <div className="hosp-login-left-top">
            <div className="hosp-login-branding">
              {/* Logo */}
              <Link to="/" className="hosp-login-logo-link" aria-label="AANCHAL home">
                <div className="hosp-login-brand-icon" aria-hidden="true">
                  {HospIcon.building}
                </div>
                <span className="hosp-login-brand-name">AANCHAL</span>
              </Link>

              {/* Portal label pill */}
              <div className="hosp-login-portal-label">
                <span className="hosp-login-portal-dot" aria-hidden="true" />
                Hospital Portal
              </div>

              <div className="hosp-login-brand-divider" aria-hidden="true" />
            </div>

            <h1 className="hosp-login-heading">
              Coordinated Care<br />
              for <em>Maternal Health</em>
            </h1>

            <p className="hosp-login-subtext">
              The AANCHAL Hospital Portal provides registered healthcare organisations
              with secure access to appointment management, referral coordination,
              and aggregated (anonymised) screening insights.
            </p>

            {/* Feature list */}
            <div className="hosp-login-features" aria-label="Portal features">
              {[
                'Appointment management &amp; referral tracking',
                'Anonymised population-level insights',
                'Secure clinical team collaboration',
                'Integration with AANCHAL screening data',
              ].map((feat, i) => (
                <div key={i} className="hosp-login-feature-item">
                  <div className="hosp-login-feature-icon" aria-hidden="true">
                    {HospIcon.check}
                  </div>
                  <span dangerouslySetInnerHTML={{ __html: feat }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            Right — Auth Card
            ============================================================ */}
        <section className="hosp-login-right-col" aria-label="Hospital portal sign-in">
          <div className="hosp-login-auth-card">
            {/* Eyebrow */}
            <div className="hosp-login-card-eyebrow">
              <span>Hospital Access</span>
              <span className="hosp-login-card-eyebrow-line" aria-hidden="true" />
            </div>

            <h2 className="hosp-login-card-title">Sign In to Hospital Portal</h2>
            <p className="hosp-login-card-subtext">
              Use your registered hospital email or organisation ID to access.
            </p>

            {/* Alerts */}
            {errorMessage && (
              <div className="hosp-login-alert hosp-login-alert-error" role="alert">
                <span style={{ flexShrink: 0, marginTop: 1 }}>{HospIcon.cross}</span>
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="hosp-login-alert hosp-login-alert-success" role="status">
                <span style={{ flexShrink: 0, marginTop: 1 }}>{HospIcon.check}</span>
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Hospital email / org ID */}
              <div className="hosp-login-form-group">
                <label className="hosp-login-field-label" htmlFor="hosp-org-id">
                  Hospital Email or Organisation ID
                </label>
                <div className="hosp-login-input-wrap">
                  <span className="hosp-login-input-icon">{HospIcon.mail}</span>
                  <input
                    id="hosp-org-id"
                    type="text"
                    className="hosp-login-text-input"
                    placeholder="admin@yourhospital.org  or  HOSP-12345"
                    value={orgId}
                    onChange={(e) => { setOrgId(e.target.value); setErrorMessage(''); }}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="hosp-login-form-group">
                <label className="hosp-login-field-label" htmlFor="hosp-password">
                  Password
                </label>
                <div className="hosp-login-input-wrap">
                  <span className="hosp-login-input-icon">{HospIcon.lock}</span>
                  <input
                    id="hosp-password"
                    type={showPassword ? 'text' : 'password'}
                    className="hosp-login-text-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMessage(''); }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="hosp-login-visibility-btn"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? HospIcon.eyeOff : HospIcon.eye}
                  </button>
                </div>
              </div>

              {/* Forgot */}
              <div className="hosp-login-forgot-row">
                <button
                  type="button"
                  className="hosp-login-forgot-btn"
                  onClick={handleForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="hosp-login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="hosp-login-spinner" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    {HospIcon.arrowRight}
                  </>
                )}
              </button>
            </form>

            {/* Demo / placeholder notice */}
            <div className="hosp-login-demo-notice" role="note">
              <span style={{ flexShrink: 0, marginTop: 1 }}>{HospIcon.warning}</span>
              <div>
                <strong>Backend integration required</strong>
                Hospital portal accounts must be provisioned by the AANCHAL system
                administrator before sign-in is available. This entry point is a
                frontend placeholder only.
              </div>
            </div>

            {/* Back to patient login */}
            <div className="hosp-login-back-row">
              {HospIcon.arrowLeft}
              <span>Looking for patient access?&nbsp;</span>
              <Link to="/login" className="hosp-login-back-link">
                Patient Login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HospitalLoginScreen;
