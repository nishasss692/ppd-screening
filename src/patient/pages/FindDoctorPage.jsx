import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SAMPLE_DOCTORS, getHospitalById } from '../data/sampleDoctors.js';
import './find-doctor.css';

/* ── Inline SVG icons (stroke-only, Miora style) ───────────────────────── */
const Ico = {
  locPin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  locTarget: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="2" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="22" y2="12"/>
    </svg>
  ),
  building: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/>
      <path d="M9 21v-6h6v6"/>
    </svg>
  ),
  phone: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l1.62-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  clock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  arrowRight: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  video: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  person: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mic: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

function consultTypeIcon(type) {
  if (type === 'Telehealth') return Ico.video;
  if (type === 'Audio Consult') return Ico.mic;
  return Ico.person;
}

/* ── Urgent support modal ─────────────────────────────────────────────────── */
function UrgentSupportModal({ onClose }) {
  return (
    <div
      className="urgent-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="urgent-modal-title"
    >
      <div className="urgent-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="urgent-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          {Ico.close}
        </button>

        <h2 id="urgent-modal-title" className="urgent-modal-heading">
          If you need immediate support
        </h2>

        <p className="urgent-modal-text">
          If you are having thoughts of harming yourself or your baby, or are in
          immediate distress, please contact a healthcare professional or crisis
          helpline right away. The numbers below are available to help you.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { name: 'iCall (TISS)', number: '9152987821', note: 'Mon–Sat 8AM–10PM' },
            { name: 'Vandrevala Foundation', number: '1860-2662-345', note: '24/7 Helpline' },
            { name: 'NIMHANS Helpline', number: '080-46110007', note: 'Mental Health' },
          ].map((h) => (
            <div key={h.name} className="urgent-support-helpline-row">
              <span className="urgent-support-helpline-name">{h.name}</span>
              <span className="urgent-support-helpline-num">{h.number}</span>
              <span style={{ fontSize: 11, color: '#a07020' }}>{h.note}</span>
            </div>
          ))}
        </div>

        <div className="urgent-modal-dev-note">
          <strong>Pending Clinical Review — Future Feature</strong><br />
          An in-app urgent support and clinical escalation pathway is planned for a future
          version of AANCHAL. It will require clinician-approved protocols before
          implementation. No automatic risk assessment or diagnosis is performed by
          this application.
        </div>
      </div>
    </div>
  );
}

/* ── Doctor card ──────────────────────────────────────────────────────────── */
function DoctorCard({ doctor }) {
  const navigate = useNavigate();
  const hospital = getHospitalById(doctor.hospitalId);

  const handleSelect = () => {
    navigate(`/patient/book-appointment?doctorId=${doctor.doctorId}`);
  };

  return (
    <article className="doctor-card" aria-label={`Doctor card for ${doctor.name}`}>
      {/* Demo badge */}
      <div className="doctor-card-demo-badge" aria-label="Sample record — not a real practitioner">
        Sample · Not a real practitioner
      </div>

      {/* Avatar + name */}
      <div className="doctor-card-header">
        <div className="doctor-avatar" aria-hidden="true">{doctor.initials}</div>
        <div className="doctor-card-name-block">
          <h3 className="doctor-card-name">{doctor.name}</h3>
          <p className="doctor-card-spec">{doctor.specialization}</p>
          <p className="doctor-card-exp">{doctor.yearsExperience} years experience</p>
        </div>
      </div>

      {/* Subspecialty tags */}
      <div className="doctor-card-tags" aria-label="Areas of focus">
        {doctor.subspecialties.map((s) => (
          <span key={s} className="doctor-tag">{s}</span>
        ))}
      </div>

      {/* Info rows */}
      <div className="doctor-card-info">
        {hospital && (
          <div className="doctor-info-row">
            <span className="doctor-info-row-icon">{Ico.building}</span>
            <span>
              <strong>{hospital.name}</strong>
              <br />
              <span style={{ color: 'var(--patient-subtle)', fontSize: 11.5 }}>
                {hospital.address}
              </span>
            </span>
          </div>
        )}

        {hospital?.phone && (
          <div className="doctor-info-row">
            <span className="doctor-info-row-icon">{Ico.phone}</span>
            <span>{hospital.phone}</span>
          </div>
        )}

        <div className="doctor-info-row">
          <span className="doctor-info-row-icon">{Ico.clock}</span>
          <span>{doctor.availability}</span>
        </div>

        <div className="doctor-consult-types" aria-label="Consultation types available">
          {doctor.consultationTypes.map((t) => (
            <span key={t} className="doctor-consult-pill">
              {consultTypeIcon(t)}
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="doctor-card-footer">
        <span className="doctor-availability-label">
          {hospital?.location}
        </span>
        <button
          type="button"
          className="doctor-select-btn"
          onClick={handleSelect}
          aria-label={`Select ${doctor.name} and proceed to appointment booking`}
        >
          <span>Select Doctor</span>
          {Ico.arrowRight}
        </button>
      </div>
    </article>
  );
}

/* ── Main FindDoctorPage ──────────────────────────────────────────────────── */
export function FindDoctorPage() {
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | loading | granted | denied | manual
  const [locationLabel, setLocationLabel] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [urgentModalOpen, setUrgentModalOpen] = useState(false);

  /* Request browser geolocation */
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      setLocationLabel('Geolocation not supported by this browser.');
      setShowManualInput(true);
      return;
    }
    setLocationStatus('loading');
    setLocationLabel('Requesting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        /*
         * In production, reverse-geocode pos.coords to a city name via an API.
         * For now, show coordinates as a placeholder.
         */
        const lat = pos.coords.latitude.toFixed(3);
        const lng = pos.coords.longitude.toFixed(3);
        setLocationStatus('granted');
        setLocationLabel(`Location detected (${lat}°N, ${lng}°E) — showing all sample doctors`);
        setShowManualInput(false);
      },
      () => {
        setLocationStatus('denied');
        setLocationLabel('Location access denied. Enter your city or PIN code below.');
        setShowManualInput(true);
      },
      { timeout: 8000 }
    );
  }, []);

  /* Handle manual city / PIN submit */
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    setLocationStatus('manual');
    setLocationLabel(`Showing sample doctors for: "${val}"`);
    setShowManualInput(false);
  };

  const locationDotClass =
    locationStatus === 'granted' ? 'is-granted'
    : locationStatus === 'loading' ? 'is-loading'
    : locationStatus === 'denied' ? 'is-denied'
    : locationStatus === 'manual' ? 'is-manual'
    : 'is-denied';

  return (
    <div className="find-doctor-shell">
      {/* Urgent support modal */}
      {urgentModalOpen && (
        <UrgentSupportModal onClose={() => setUrgentModalOpen(false)} />
      )}

      {/* Breadcrumb */}
      <div className="screening-breadcrumb">
        <NavLink to="/patient/dashboard" className="screening-breadcrumb-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z"/>
            <path d="M9.5 21v-7h5v7"/>
          </svg>
          <span>Home</span>
        </NavLink>
        <span className="screening-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="screening-breadcrumb-current">Find a Doctor</span>
      </div>

      {/* Sample data disclaimer */}
      <div className="find-doctor-demo-banner" role="note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>
          <strong>Sample records only — no real clinician data.</strong>{' '}
          All doctor names, hospitals, contact details, and availability shown below are
          fictional and created for frontend demonstration. No patient data, screening
          responses, or EPDS scores are shared with any doctor through this page.
          Replace this module with a verified API when backend integration is ready.
        </span>
      </div>

      {/* Hero box */}
      <div className="patient-card find-doctor-hero">
        <div className="find-doctor-hero-text">
          <div className="miora-dash-eyebrow">
            <span>PROFESSIONAL SUPPORT</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="miora-dash-title patient-page-heading" style={{ fontSize: '22px' }}>
            Find a <em>Doctor</em>
          </h1>
          <p className="miora-dash-subtitle patient-page-subheading">
            Browse healthcare professionals specialising in maternal mental health and
            postpartum wellbeing. Select a doctor to schedule a consultation.
          </p>
        </div>
      </div>

      {/* Location bar */}
      <section className="patient-card" style={{ padding: '20px 24px' }} aria-label="Location settings">
        <div className="find-doctor-location-bar">
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--patient-ink-secondary)' }}>
            Your location
          </p>

          <div className="find-doctor-location-row">
            <div className="find-doctor-location-status" role="status" aria-live="polite">
              <span
                className={`find-doctor-location-dot ${locationDotClass}`}
                aria-hidden="true"
              />
              <span>
                {locationStatus === 'idle'
                  ? 'Location not set — share your location or enter it manually.'
                  : locationLabel}
              </span>
            </div>

            {(locationStatus === 'idle' || locationStatus === 'denied' || locationStatus === 'manual') && (
              <button
                type="button"
                className="find-doctor-location-btn"
                onClick={requestLocation}
                aria-label="Use my current location"
              >
                {Ico.locTarget}
                <span>Use My Location</span>
              </button>
            )}

            {locationStatus === 'loading' && (
              <span style={{ fontSize: 12, color: 'var(--patient-muted)' }}>Detecting…</span>
            )}

            {(locationStatus === 'granted') && (
              <button
                type="button"
                className="find-doctor-location-btn"
                onClick={() => { setShowManualInput(true); setLocationStatus('denied'); setLocationLabel('Enter your city or PIN code below.'); }}
              >
                <span>Change Location</span>
              </button>
            )}
          </div>

          {/* Manual entry */}
          {showManualInput && (
            <form
              className="find-doctor-manual-input-row"
              onSubmit={handleManualSubmit}
              aria-label="Enter location manually"
            >
              <input
                type="text"
                className="find-doctor-manual-input"
                placeholder="Enter city name or PIN code (e.g. Bangalore or 560001)"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                aria-label="City name or PIN code"
              />
              <button type="submit" className="find-doctor-manual-submit">
                {Ico.locPin}
                <span>Search</span>
              </button>
            </form>
          )}

          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--patient-subtle)', lineHeight: 1.5 }}>
            Your location is used only to display relevant results and is not stored or
            shared. No screening data is attached to doctor discovery.
          </p>
        </div>
      </section>

      {/* Doctor grid */}
      <section aria-label="Available doctors">
        <div className="miora-dash-eyebrow" style={{ marginBottom: 16 }}>
          <span>{SAMPLE_DOCTORS.length} SAMPLE DOCTORS</span>
          <span className="miora-dash-eyebrow-line" aria-hidden="true" />
        </div>

        <div className="find-doctor-grid">
          {SAMPLE_DOCTORS.map((doc) => (
            <DoctorCard key={doc.doctorId} doctor={doc} />
          ))}
        </div>
      </section>

      {/* ── Urgent support placeholder ──────────────────────────────────── */}
      <section
        className="urgent-support-section"
        aria-label="Urgent support information"
      >
        <div className="urgent-support-icon-wrap" aria-hidden="true">
          {Ico.warning}
        </div>

        <div className="urgent-support-body">
          <div className="urgent-support-dev-label" aria-label="Pending clinical review — future feature">
            Pending Clinical Review · Future Feature
          </div>

          <h2 className="urgent-support-heading">
            Need immediate emotional support?
          </h2>

          <p className="urgent-support-text">
            If you are experiencing thoughts of harming yourself or your baby, or are
            in immediate distress, please reach out to a healthcare professional or
            crisis helpline straight away. You are not alone, and help is available.
          </p>

          <div className="urgent-support-helplines" aria-label="Crisis helpline numbers">
            {[
              { name: 'iCall (TISS)', number: '9152987821', note: 'Mon–Sat, 8AM–10PM' },
              { name: 'Vandrevala Foundation', number: '1860-2662-345', note: '24 / 7' },
              { name: 'NIMHANS Helpline', number: '080-46110007', note: 'Mental Health' },
            ].map((h) => (
              <div key={h.name} className="urgent-support-helpline-row">
                <span className="urgent-support-helpline-name">{h.name}</span>
                <span className="urgent-support-helpline-num">{h.number}</span>
                <span style={{ fontSize: 11, color: '#a07020' }}>{h.note}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="urgent-support-btn"
            onClick={() => setUrgentModalOpen(true)}
            aria-haspopup="dialog"
          >
            {Ico.warning}
            <span>Get Urgent Support Information</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default FindDoctorPage;
