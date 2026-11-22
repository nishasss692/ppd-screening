import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  assignDoctorToAppointment,
  fetchHospitalAppointmentDetail,
  fetchHospitalDoctors,
  updateAppointmentStatus,
} from './hospitalService.js';

export function HospitalAppointmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Status transition states
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Propose time form state
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('11:00 AM');
  const [notes, setNotes] = useState('');

  // Decline form state
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const loadDetail = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [appt, docs] = await Promise.all([
        fetchHospitalAppointmentDetail(id),
        fetchHospitalDoctors().catch(() => []),
      ]);
      setAppointment(appt);
      setDoctors(docs);
      setSelectedDoctorId(appt.assigned_doctor_id || appt.requested_doctor_id || '');
      setProposedDate(appt.requested_date || '');
      setProposedTime(appt.requested_time || '11:00 AM');
    } catch (err) {
      setError(err.message || 'Failed to load appointment details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await updateAppointmentStatus(id, { action: 'confirm', notes });
      setAppointment(updated);
      setSuccessMsg('Appointment has been confirmed and the patient has been notified.');
    } catch (err) {
      setError(err.message || 'Failed to confirm appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProposeTime = async (e) => {
    e.preventDefault();
    if (!proposedDate || !proposedTime) return;
    setIsProcessing(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await updateAppointmentStatus(id, {
        action: 'propose_time',
        proposedDate,
        proposedTime,
        notes,
      });
      setAppointment(updated);
      setShowProposeForm(false);
      setSuccessMsg('Alternative appointment time has been proposed to the patient.');
    } catch (err) {
      setError(err.message || 'Failed to propose alternative time.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await updateAppointmentStatus(id, {
        action: 'reject',
        notes: declineReason,
      });
      setAppointment(updated);
      setShowDeclineForm(false);
      setSuccessMsg('Appointment request has been declined.');
    } catch (err) {
      setError(err.message || 'Failed to decline appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignDoctor = async (e) => {
    e.preventDefault();
    const doc = doctors.find((d) => d.doctor_id === selectedDoctorId);
    if (!doc) return;
    setIsProcessing(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await assignDoctorToAppointment(id, doc.doctor_id, doc.name);
      setAppointment(updated);
      setSuccessMsg(`Doctor ${doc.name} assigned to this appointment.`);
    } catch (err) {
      setError(err.message || 'Failed to assign doctor.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--hosp-text-muted)' }}>
        Loading appointment request details…
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div>
        <div style={{ padding: '16px 20px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 20 }}>
          {error}
        </div>
        <NavLink to="/hospital/appointments" className="hosp-btn-secondary">
          ← Back to Appointments
        </NavLink>
      </div>
    );
  }

  const statusKey = (appointment?.status || 'pending').toLowerCase();

  return (
    <div>
      {/* Back button & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <NavLink to="/hospital/appointments" className="hosp-btn-secondary" style={{ padding: '6px 12px' }}>
          ← Back
        </NavLink>
        <span style={{ fontSize: 13, color: 'var(--hosp-text-muted)' }}>
          Request Reference: <strong>{appointment?.id}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--hosp-primary)', margin: '0 0 4px 0' }}>
            Appointment Request · {appointment?.patient_name}
          </h2>
          <span style={{ fontSize: 13.5, color: 'var(--hosp-text-muted)' }}>
            Hospital: {appointment?.hospital_name} ({appointment?.hospital_id})
          </span>
        </div>
        <span className={`hosp-badge hosp-badge-${statusKey}`} style={{ fontSize: 13, padding: '6px 14px' }}>
          Status: {statusKey === 'rescheduled' ? 'Time Proposed' : appointment?.status}
        </span>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 18px', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 8, color: '#065f46', marginBottom: 20 }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 18px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Grid: Left Column Details / Right Column Actions */}
      <div className="hosp-detail-grid">
        <div className="hosp-card">
          <div className="hosp-card-header">
            <h3 className="hosp-card-title">Patient &amp; Consultation Request Details</h3>
          </div>

          <div className="hosp-detail-field-group">
            <div className="hosp-detail-field">
              <span className="hosp-field-label">Patient Full Name</span>
              <span className="hosp-field-val"><strong>{appointment?.patient_name}</strong></span>
            </div>

            <div className="hosp-detail-field">
              <span className="hosp-field-label">Permitted Contact Phone</span>
              <span className="hosp-field-val">{appointment?.patient_phone || 'On file with maternal care team'}</span>
            </div>

            <div className="hosp-detail-field">
              <span className="hosp-field-label">Requested Date</span>
              <span className="hosp-field-val">{appointment?.requested_date}</span>
            </div>

            <div className="hosp-detail-field">
              <span className="hosp-field-label">Requested Time Slot</span>
              <span className="hosp-field-val">{appointment?.requested_time}</span>
            </div>

            {appointment?.confirmed_date && (
              <div className="hosp-detail-field" style={{ backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6 }}>
                <span className="hosp-field-label" style={{ color: '#166534' }}>Confirmed Date &amp; Time</span>
                <span className="hosp-field-val" style={{ color: '#166534' }}>
                  <strong>{appointment.confirmed_date} · {appointment.confirmed_time}</strong>
                </span>
              </div>
            )}

            {appointment?.proposed_date && (
              <div className="hosp-detail-field" style={{ backgroundColor: '#eef2ff', padding: 8, borderRadius: 6 }}>
                <span className="hosp-field-label" style={{ color: '#3730a3' }}>Alternative Time Proposed</span>
                <span className="hosp-field-val" style={{ color: '#3730a3' }}>
                  <strong>{appointment.proposed_date} · {appointment.proposed_time}</strong>
                </span>
              </div>
            )}

            <div className="hosp-detail-field">
              <span className="hosp-field-label">Consultation Mode</span>
              <span className="hosp-field-val">{appointment?.type}</span>
            </div>

            <div className="hosp-detail-field">
              <span className="hosp-field-label">Requested Specialist</span>
              <span className="hosp-field-val">{appointment?.requested_doctor_name}</span>
            </div>

            <div className="hosp-detail-field">
              <span className="hosp-field-label">Assigned Specialist</span>
              <span className="hosp-field-val">
                {appointment?.assigned_doctor_name ? (
                  <strong style={{ color: 'var(--hosp-teal-dark)' }}>{appointment.assigned_doctor_name}</strong>
                ) : (
                  <span style={{ color: 'var(--hosp-text-muted)' }}>Not yet assigned</span>
                )}
              </span>
            </div>
          </div>

          {/* Reason & Hospital Notes */}
          <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span className="hosp-field-label">Reason for Consultation (Optional Patient Note)</span>
              <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--hosp-text)', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                {appointment?.reason || 'No specific clinical notes provided with the booking request.'}
              </p>
            </div>

            {appointment?.hospital_notes && (
              <div>
                <span className="hosp-field-label">Hospital Staff Internal/Response Notes</span>
                <p style={{ margin: '4px 0 0 0', fontSize: 13.5, color: '#334155', backgroundColor: '#f1f5f9', padding: '10px 14px', borderRadius: 6 }}>
                  {appointment.hospital_notes}
                </p>
              </div>
            )}

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <small style={{ color: 'var(--hosp-text-muted)', fontSize: 11.5 }}>
                <strong>Privacy Guard:</strong> Patient screening audio/video files, feature vectors, and individual EPDS questionnaire responses are strictly isolated from the administrative hospital portal.
              </small>
            </div>
          </div>
        </div>

        {/* Right Column: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Doctor Assignment Card */}
          <div className="hosp-card">
            <div className="hosp-card-header">
              <h3 className="hosp-card-title">Assign Hospital Doctor</h3>
            </div>
            <form onSubmit={handleAssignDoctor} className="hosp-action-card">
              <div>
                <label className="hosp-field-label" htmlFor="doctor-assign-select" style={{ marginBottom: 6, display: 'block' }}>
                  Associated Doctor
                </label>
                <select
                  id="doctor-assign-select"
                  className="hosp-input"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  <option value="">-- Choose Specialist --</option>
                  {doctors.map((d) => (
                    <option key={d.doctor_id} value={d.doctor_id}>
                      {d.name} — {d.specialization} ({d.years_experience}y exp)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="hosp-btn-primary"
                disabled={isProcessing || !selectedDoctorId}
                style={{ justifyContent: 'center' }}
              >
                {isProcessing ? 'Updating…' : 'Save Assigned Doctor'}
              </button>
            </form>
          </div>

          {/* Status Decision Card */}
          <div className="hosp-card">
            <div className="hosp-card-header">
              <h3 className="hosp-card-title">Appointment Actions</h3>
            </div>
            <div className="hosp-action-card">
              {statusKey === 'pending' && (
                <>
                  <button
                    type="button"
                    className="hosp-btn-primary"
                    disabled={isProcessing}
                    onClick={handleConfirm}
                    style={{ justifyContent: 'center', padding: '12px' }}
                  >
                    Accept &amp; Confirm Appointment
                  </button>

                  <button
                    type="button"
                    className="hosp-btn-secondary"
                    disabled={isProcessing}
                    onClick={() => { setShowProposeForm(!showProposeForm); setShowDeclineForm(false); }}
                    style={{ justifyContent: 'center' }}
                  >
                    Propose Alternative Time
                  </button>

                  <button
                    type="button"
                    className="hosp-btn-danger"
                    disabled={isProcessing}
                    onClick={() => { setShowDeclineForm(!showDeclineForm); setShowProposeForm(false); }}
                    style={{ justifyContent: 'center' }}
                  >
                    Decline Request
                  </button>
                </>
              )}

              {statusKey === 'confirmed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                    Confirmed for {appointment.confirmed_date || appointment.requested_date}
                  </div>
                  <button
                    type="button"
                    className="hosp-btn-secondary"
                    disabled={isProcessing}
                    onClick={() => setShowProposeForm(!showProposeForm)}
                    style={{ justifyContent: 'center' }}
                  >
                    Reschedule Appointment
                  </button>
                </div>
              )}

              {statusKey === 'rescheduled' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#3730a3', fontWeight: 600 }}>
                    Proposed new time: {appointment.proposed_date} at {appointment.proposed_time}
                  </div>
                  <button
                    type="button"
                    className="hosp-btn-primary"
                    disabled={isProcessing}
                    onClick={handleConfirm}
                    style={{ justifyContent: 'center' }}
                  >
                    Confirm at Proposed Time
                  </button>
                </div>
              )}

              {/* Propose Time Form */}
              {showProposeForm && (
                <form onSubmit={handleProposeTime} style={{ marginTop: 12, borderTop: '1px solid var(--hosp-border)', paddingTop: 14 }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--hosp-primary)' }}>
                    Alternative Consultation Slot
                  </h4>
                  <div style={{ marginBottom: 10 }}>
                    <label className="hosp-field-label">Date</label>
                    <input
                      type="date"
                      className="hosp-input"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label className="hosp-field-label">Time</label>
                    <select
                      className="hosp-input"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                      required
                    >
                      {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label className="hosp-field-label">Note to Patient</label>
                    <textarea
                      className="hosp-input"
                      rows={2}
                      placeholder="Reason for alternative time..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="hosp-btn-primary" disabled={isProcessing} style={{ width: '100%', justifyContent: 'center' }}>
                    Send Alternative Time
                  </button>
                </form>
              )}

              {/* Decline Form */}
              {showDeclineForm && (
                <form onSubmit={handleDecline} style={{ marginTop: 12, borderTop: '1px solid var(--hosp-border)', paddingTop: 14 }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#991b1b' }}>
                    Reason for Declining
                  </h4>
                  <textarea
                    className="hosp-input"
                    rows={2}
                    placeholder="e.g. Department at capacity, refer to sister facility..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  <button type="submit" className="hosp-btn-danger" disabled={isProcessing} style={{ width: '100%', justifyContent: 'center' }}>
                    Confirm Decline
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
