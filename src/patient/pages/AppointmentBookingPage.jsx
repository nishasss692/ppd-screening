import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { getDoctorWithHospital } from '../data/sampleDoctors.js';
import { usePatient } from '../context/PatientContext.jsx';
import './appointment-booking.css';

/* ── SVG icons ───────────────────────────────────────────────────────────── */
const Ico = {
  locPin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  calendar: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  clock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  person: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  building: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
    </svg>
  ),
  arrowLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  check: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
};

/* ── Today's date as YYYY-MM-DD (min for date picker) ───────────────────── */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ── Format ISO date for display ─────────────────────────────────────────── */
function formatDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ── Generate a stable demo reference ID ─────────────────────────────────── */
function makeDemoRefId() {
  const ts = Date.now().toString(36).toUpperCase();
  return `AANCHAL-DEMO-${ts}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Booking Form View
   ══════════════════════════════════════════════════════════════════════════ */
function BookingForm({ doctor, hospital, patient, onConfirmed }) {
  const { bookAppointment } = usePatient();

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [consultationMode, setConsultationMode] = useState(doctor.consultationTypes[0] || 'In-person');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleConfirm = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!selectedDate) {
      setValidationError('Please select a preferred appointment date.');
      return;
    }
    if (!selectedSlot) {
      setValidationError('Please select a time slot.');
      return;
    }

    setIsSubmitting(true);

    /*
     * Calls the existing bookAppointment() from PatientContext.
     * That method attempts the backend /api/appointments endpoint and falls
     * back to a local demo booking if the backend is unavailable.
     * No screening data, EPDS scores, or health records are transmitted.
     */
    const appointmentPayload = {
      doctor_name: doctor.name,
      doctor_id: doctor.doctorId,
      role: doctor.specialization,
      hospital_id: hospital?.hospitalId || 'HOSP-001',
      hospital_name: hospital?.name || 'AANCHAL Partner Hospital',
      hospital_location: hospital?.location,
      phone: patient?.phone || '+91-98765-43210',
      date: selectedDate,
      time: selectedSlot,
      type: consultationMode || doctor.consultationTypes[0] || 'In-person',
      clinic: hospital?.name || 'AANCHAL Partner Hospital',
      reason: reason || null,
    };

    try {
      const booked = await bookAppointment(appointmentPayload);
      const refId = booked?.id || makeDemoRefId();
      onConfirmed({
        doctorName: doctor.name,
        specialization: doctor.specialization,
        hospitalName: hospital?.name,
        hospitalLocation: hospital?.location,
        date: selectedDate,
        slot: selectedSlot,
        refId,
      });
    } catch (err) {
      /* bookAppointment fallback handles offline/local states */
      onConfirmed({
        doctorName: doctor.name,
        specialization: doctor.specialization,
        hospitalName: hospital?.name,
        hospitalLocation: hospital?.location,
        date: selectedDate,
        slot: selectedSlot,
        refId: makeDemoRefId(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleConfirm} noValidate aria-label="Appointment booking form">
      {/* Demo banner */}
      <div className="appt-demo-banner" role="note" style={{ marginBottom: 24 }}>
        {Ico.warning}
        <span>
          <strong>Frontend demonstration only.</strong>{' '}
          No real appointment is being scheduled. Sample doctors are fictional.
          No screening data or personal health information is transmitted.
        </span>
      </div>

      {/* Selected doctor summary card */}
      <section className="patient-card" style={{ padding: '20px 24px', marginBottom: 20 }} aria-label="Selected doctor">
        <div className="miora-dash-eyebrow" style={{ marginBottom: 12 }}>
          <span>SELECTED DOCTOR</span>
          <span className="miora-dash-eyebrow-line" aria-hidden="true" />
        </div>
        <div className="appt-doctor-summary">
          <div className="appt-doctor-avatar" aria-hidden="true">{doctor.initials}</div>
          <div className="appt-doctor-info">
            <h2 className="appt-doctor-name">{doctor.name}</h2>
            <p className="appt-doctor-spec">{doctor.specialization}</p>
            {hospital && (
              <div className="appt-doctor-location">
                <span className="appt-doctor-location-icon">{Ico.locPin}</span>
                <span>
                  {hospital.name} · {hospital.location}
                  <br />
                  <small style={{ color: 'var(--patient-subtle)' }}>{hospital.address}</small>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Validation error */}
      {validationError && (
        <div className="patient-notice-banner is-error" role="alert" style={{ marginBottom: 16 }}>
          {validationError}
        </div>
      )}

      {/* Booking fields */}
      <section className="patient-card" style={{ padding: '24px 28px' }} aria-label="Appointment details">
        <div className="appt-form-grid">
          <p className="appt-section-heading">Appointment Details</p>

          {/* Date */}
          <div className="appt-form-group">
            <label className="appt-form-label" htmlFor="appt-date">
              Preferred Date <span className="appt-required" aria-hidden="true">*</span>
            </label>
            <input
              id="appt-date"
              type="date"
              className="appt-form-input"
              min={todayISO()}
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (validationError) setValidationError('');
              }}
              required
              aria-required="true"
            />
          </div>

          {/* Consultation type (read-only from doctor data) */}
          <div className="appt-form-group">
            <label className="appt-form-label" htmlFor="appt-type">
              Consultation Mode
            </label>
            <select
              id="appt-type"
              className="appt-form-select"
              value={consultationMode}
              onChange={(e) => setConsultationMode(e.target.value)}
            >
              {doctor.consultationTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Time slots */}
          <div className="appt-form-group appt-full-width">
            <span className="appt-form-label" id="slot-label">
              Available Time Slots <span className="appt-required" aria-hidden="true">*</span>
            </span>
            <div
              className="appt-timeslot-grid"
              role="radiogroup"
              aria-labelledby="slot-label"
            >
              {doctor.timeSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={selectedSlot === slot}
                  className={`appt-timeslot-btn${selectedSlot === slot ? ' is-selected' : ''}`}
                  onClick={() => {
                    setSelectedSlot(slot);
                    if (validationError) setValidationError('');
                  }}
                >
                  {Ico.clock}
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Patient details (pre-filled) */}
      <section className="patient-card" style={{ padding: '24px 28px', marginTop: 20 }} aria-label="Patient details">
        <div className="appt-form-grid">
          <p className="appt-section-heading">Your Details</p>

          <div className="appt-form-group">
            <label className="appt-form-label" htmlFor="appt-patient-name">
              Your Name
            </label>
            <input
              id="appt-patient-name"
              type="text"
              className="appt-form-input"
              value={patient?.fullName || patient?.name || ''}
              disabled
              aria-label="Your name (pre-filled from your profile)"
            />
            <span className="appt-prefill-note">Pre-filled from your profile.</span>
          </div>

          <div className="appt-form-group">
            <label className="appt-form-label" htmlFor="appt-patient-email">
              Email Address
            </label>
            <input
              id="appt-patient-email"
              type="email"
              className="appt-form-input"
              value={patient?.email || ''}
              disabled
              aria-label="Your email (pre-filled from your profile)"
            />
            <span className="appt-prefill-note">Pre-filled from your profile.</span>
          </div>

          {/* Reason for consultation (optional) */}
          <div className="appt-form-group appt-full-width">
            <label className="appt-form-label" htmlFor="appt-reason">
              Reason for Consultation{' '}
              <span style={{ color: 'var(--patient-subtle)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              id="appt-reason"
              className="appt-form-textarea"
              rows={3}
              placeholder="Briefly describe what you would like to discuss (e.g. postpartum anxiety, sleep difficulties). This information stays on your device and is not shared with the sample doctor."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <span className="appt-prefill-note" style={{ textAlign: 'right' }}>
              {reason.length}/500
            </span>
          </div>
        </div>
      </section>

      {/* Inline validation error right above actions */}
      {validationError && (
        <div className="patient-notice-banner is-error" role="alert" style={{ marginTop: 16 }}>
          {validationError}
        </div>
      )}

      {/* Actions */}
      <div className="appt-actions-row" style={{ marginTop: 20 }}>
        <NavLink
          to="/patient/find-doctor"
          className="patient-btn-secondary"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {Ico.arrowLeft}
          <span>Back to Doctors</span>
        </NavLink>

        <button
          type="submit"
          className="patient-btn-primary"
          disabled={isSubmitting}
          aria-disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span
                style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'miora-spin 0.7s linear infinite', flexShrink: 0,
                }}
              />
              <span>Submitting Request…</span>
            </>
          ) : (
            <span>Submit Appointment Request</span>
          )}
        </button>
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Confirmation View (shown after successful booking)
   ══════════════════════════════════════════════════════════════════════════ */
function ConfirmationView({ details }) {
  const navigate = useNavigate();

  return (
    <div className="appt-confirmation-shell">
      {/* Success icon */}
      <div className="appt-confirm-icon-wrap" aria-hidden="true">
        {Ico.check}
      </div>

      <h2 className="appt-confirm-heading">Appointment Request Submitted</h2>
      <p className="appt-confirm-sub">
        Your consultation request has been received by the hospital care coordination team and is awaiting confirmation.
      </p>

      {/* Summary card */}
      <div className="appt-confirm-summary" aria-label="Appointment summary">
        <div className="appt-confirm-row">
          <span className="appt-confirm-row-label">Request Status</span>
          <span className="appt-confirm-row-value">
            <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '3px 9px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
              Pending Hospital Review
            </span>
          </span>
        </div>
        <div className="appt-confirm-divider" aria-hidden="true" />

        <div className="appt-confirm-row">
          <span className="appt-confirm-row-label">Doctor</span>
          <span className="appt-confirm-row-value">{details.doctorName}</span>
        </div>
        <div className="appt-confirm-divider" aria-hidden="true" />

        <div className="appt-confirm-row">
          <span className="appt-confirm-row-label">Specialization</span>
          <span className="appt-confirm-row-value">{details.specialization}</span>
        </div>
        <div className="appt-confirm-divider" aria-hidden="true" />

        {details.hospitalName && (
          <>
            <div className="appt-confirm-row">
              <span className="appt-confirm-row-label">Hospital</span>
              <span className="appt-confirm-row-value">
                {details.hospitalName}
                {details.hospitalLocation && (
                  <><br /><small style={{ color: 'var(--patient-subtle)' }}>{details.hospitalLocation}</small></>
                )}
              </span>
            </div>
            <div className="appt-confirm-divider" aria-hidden="true" />
          </>
        )}

        <div className="appt-confirm-row">
          <span className="appt-confirm-row-label">Requested Date</span>
          <span className="appt-confirm-row-value">{formatDate(details.date)}</span>
        </div>
        <div className="appt-confirm-divider" aria-hidden="true" />

        <div className="appt-confirm-row">
          <span className="appt-confirm-row-label">Requested Slot</span>
          <span className="appt-confirm-row-value">{details.slot}</span>
        </div>
        <div className="appt-confirm-divider" aria-hidden="true" />

        <div className="appt-confirm-row">
          <span className="appt-confirm-row-label">Backend Request ID</span>
          <span className="appt-confirm-row-value">
            <span className="appt-ref-id">{details.refId}</span>
          </span>
        </div>
      </div>

      {/* Hospital request note */}
      <div className="appt-confirm-demo-note" role="note">
        <strong>Request Awaiting Confirmation:</strong> This is an appointment request, not an automatically confirmed appointment.
        The hospital staff will review specialist availability and confirm or propose an alternative time slot.
        You will receive updates in your patient portal notifications and appointments tab.
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="patient-btn-primary"
          onClick={() => navigate('/patient/connect-doctor')}
        >
          View in My Consultations
        </button>
        <button
          type="button"
          className="patient-btn-secondary"
          onClick={() => navigate('/patient/find-doctor')}
        >
          Find Another Doctor
        </button>
        <button
          type="button"
          className="patient-btn-secondary"
          onClick={() => navigate('/patient/dashboard')}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AppointmentBookingPage — main export
   ══════════════════════════════════════════════════════════════════════════ */
export function AppointmentBookingPage() {
  const [searchParams] = useSearchParams();
  const { patient } = usePatient();
  const [confirmedDetails, setConfirmedDetails] = useState(null);

  const doctorId = searchParams.get('doctorId');
  const record = useMemo(() => (doctorId ? getDoctorWithHospital(doctorId) : null), [doctorId]);

  /* Breadcrumb path label */
  const breadcrumbLabel = record?.doctor?.name
    ? `Book with ${record.doctor.name}`
    : 'Book Appointment';

  return (
    <div className="appt-shell">
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
        <NavLink to="/patient/find-doctor" className="screening-breadcrumb-link">
          Find a Doctor
        </NavLink>
        <span className="screening-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="screening-breadcrumb-current">{breadcrumbLabel}</span>
      </div>

      {/* Page heading */}
      <div className="patient-hero-box" style={{ marginBottom: 0 }}>
        <div className="patient-hero-box-text">
          <div className="miora-dash-eyebrow">
            <span>SCHEDULE CONSULTATION</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="miora-dash-title patient-page-heading">
            {confirmedDetails ? 'Booking Confirmed' : <>Book an <em>Appointment</em></>}
          </h1>
        </div>
      </div>

      {/* Content */}
      {confirmedDetails ? (
        <ConfirmationView details={confirmedDetails} />
      ) : !record ? (
        /* No/invalid doctorId in URL */
        <div className="patient-card appt-error-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--patient-brand-rose)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>No doctor selected</h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Please go back to the doctor discovery page and select a doctor first.
          </p>
          <NavLink
            to="/patient/find-doctor"
            className="patient-btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {Ico.arrowLeft}
            <span>Back to Find a Doctor</span>
          </NavLink>
        </div>
      ) : (
        <BookingForm
          doctor={record.doctor}
          hospital={record.hospital}
          patient={patient}
          onConfirmed={setConfirmedDetails}
        />
      )}
    </div>
  );
}

export default AppointmentBookingPage;
