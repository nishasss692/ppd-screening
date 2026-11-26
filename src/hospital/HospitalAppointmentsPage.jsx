import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  assignDoctorToAppointment,
  fetchHospitalAppointments,
  fetchHospitalDoctors,
  updateAppointmentStatus,
} from './hospitalService.js';

export function HospitalAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Propose time modal state
  const [proposeModalAppt, setProposeModalAppt] = useState(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [proposeNotes, setProposeNotes] = useState('');
  const [isSubmittingPropose, setIsSubmittingPropose] = useState(false);

  const loadAppointments = async (tab = activeTab) => {
    setIsLoading(true);
    setError('');
    try {
      const [apptData, docData] = await Promise.all([
        fetchHospitalAppointments(tab),
        fetchHospitalDoctors().catch(() => []),
      ]);
      setAppointments(apptData);
      setDoctors(docData);
    } catch (err) {
      setError(err.message || 'Failed to load appointments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments(activeTab);
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActionSuccess('');
  };

  const handleQuickConfirm = async (apptId) => {
    try {
      await updateAppointmentStatus(apptId, { action: 'confirm' });
      setActionSuccess('Appointment confirmed successfully.');
      loadAppointments(activeTab);
    } catch (err) {
      setError(err.message || 'Failed to confirm appointment.');
    }
  };

  const handleQuickAssignDoctor = async (apptId, doctorId, doctorName) => {
    if (!doctorId) return;
    try {
      await assignDoctorToAppointment(apptId, doctorId, doctorName);
      setActionSuccess(`Doctor ${doctorName} assigned successfully.`);
      loadAppointments(activeTab);
    } catch (err) {
      setError(err.message || 'Failed to assign doctor.');
    }
  };

  const handleOpenProposeModal = (appt) => {
    setProposeModalAppt(appt);
    setProposedDate(appt.requested_date || '');
    setProposedTime(appt.requested_time || '11:00 AM');
    setProposeNotes('');
  };

  const handleProposeSubmit = async (e) => {
    e.preventDefault();
    if (!proposedDate || !proposedTime) return;
    setIsSubmittingPropose(true);
    try {
      await updateAppointmentStatus(proposeModalAppt.id, {
        action: 'propose_time',
        proposedDate,
        proposedTime,
        notes: proposeNotes,
      });
      setProposeModalAppt(null);
      setActionSuccess('Alternative consultation time proposed to patient.');
      loadAppointments(activeTab);
    } catch (err) {
      setError(err.message || 'Failed to propose alternative time.');
    } finally {
      setIsSubmittingPropose(false);
    }
  };

  return (
    <div className="hosp-command-frame">
      {/* Breadcrumb Bar */}
      <div className="hosp-breadcrumb-bar">
        <span className="hosp-breadcrumb-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
            <path d="M9.5 21v-7h5v7" />
          </svg>
          <span>Home</span>
        </span>
        <span className="hosp-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="hosp-breadcrumb-current">Appointments</span>
      </div>

      {/* Hero Header Card */}
      <div className="hosp-hero-card">
        <div>
          <div className="hosp-eyebrow">
            <span>APPOINTMENT COORDINATION</span>
            <span className="hosp-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="hosp-hero-title">
            Consultation Requests &amp; <em>Appointments</em>
          </h1>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ padding: '12px 18px', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 8, color: '#065f46', marginBottom: 20 }}>
          {actionSuccess}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 18px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div className="hosp-card">
        {/* Filter Tabs */}
        <div className="hosp-filter-tabs">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending Review' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'rescheduled', label: 'Time Proposed' },
            { id: 'cancelled', label: 'Declined' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`hosp-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Requests Table */}
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--hosp-text-muted)' }}>
            Loading consultation requests…
          </div>
        ) : appointments.length === 0 ? (
          <div className="hosp-empty-state">
            <h3>No requests found in this view</h3>
            <p>Select another filter tab or wait for new patient appointment submissions.</p>
          </div>
        ) : (
          <div className="hosp-table-wrap">
            <table className="hosp-table">
              <thead>
                <tr>
                  <th>Patient Info</th>
                  <th>Requested Details</th>
                  <th>Assigned Doctor</th>
                  <th>Status</th>
                  <th>Quick Actions</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const statusKey = (appt.status || 'pending').toLowerCase();
                  return (
                    <tr key={appt.id}>
                      <td>
                        <strong>{appt.patient_name}</strong>
                        <div style={{ fontSize: 12.5, color: 'var(--hosp-text-muted)', marginTop: 2 }}>
                          {appt.patient_phone || 'Contact on file'}
                        </div>
                      </td>
                      <td>
                        <div><strong>{appt.confirmed_date || appt.requested_date}</strong></div>
                        <div style={{ fontSize: 12.5, color: 'var(--hosp-text-muted)' }}>
                          {appt.confirmed_time || appt.requested_time} · {appt.type}
                        </div>
                        {appt.reason && (
                          <div style={{ fontSize: 12, color: 'var(--hosp-text-muted)', marginTop: 4, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Reason: "{appt.reason}"
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          className="hosp-input"
                          style={{ padding: '6px 8px', fontSize: 12.5, maxWidth: 190 }}
                          value={appt.assigned_doctor_id || appt.requested_doctor_id || ''}
                          onChange={(e) => {
                            const selectedDoc = doctors.find((d) => d.doctor_id === e.target.value);
                            if (selectedDoc) {
                              handleQuickAssignDoctor(appt.id, selectedDoc.doctor_id, selectedDoc.name);
                            }
                          }}
                        >
                          <option value="">-- Assign Doctor --</option>
                          {doctors.map((d) => (
                            <option key={d.doctor_id} value={d.doctor_id}>
                              {d.name} ({d.specialization.split(' ')[0]})
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: 11, color: 'var(--hosp-text-muted)', marginTop: 2 }}>
                          Requested: {appt.requested_doctor_name}
                        </div>
                      </td>
                      <td>
                        <span className={`hosp-badge hosp-badge-${statusKey}`}>
                          {statusKey === 'rescheduled' ? 'Time Proposed' : appt.status}
                        </span>
                        {appt.proposed_date && statusKey === 'rescheduled' && (
                          <div style={{ fontSize: 11, color: '#3730a3', marginTop: 3 }}>
                            Proposed: {appt.proposed_date}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {statusKey === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="hosp-btn-primary"
                                style={{ padding: '5px 10px', fontSize: 12 }}
                                onClick={() => handleQuickConfirm(appt.id)}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="hosp-btn-secondary"
                                style={{ padding: '5px 10px', fontSize: 12 }}
                                onClick={() => handleOpenProposeModal(appt)}
                              >
                                Propose Time
                              </button>
                            </>
                          )}
                          {statusKey === 'confirmed' && (
                            <button
                              type="button"
                              className="hosp-btn-secondary"
                              style={{ padding: '5px 10px', fontSize: 12 }}
                              onClick={() => handleOpenProposeModal(appt)}
                            >
                              Reschedule
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <NavLink
                          to={`/hospital/appointments/${appt.id}`}
                          className="hosp-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 12.5 }}
                        >
                          Manage
                        </NavLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Propose Time Modal */}
      {proposeModalAppt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 61, 62, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setProposeModalAppt(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              padding: 28,
              width: '100%',
              maxWidth: 460,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--hosp-primary)', fontSize: 18, fontWeight: 700 }}>
              Propose Alternative Consultation Time
            </h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--hosp-text-muted)', fontSize: 13.5 }}>
              Patient: <strong>{proposeModalAppt.patient_name}</strong> (Requested {proposeModalAppt.requested_date} at {proposeModalAppt.requested_time})
            </p>

            <form onSubmit={handleProposeSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Proposed Date *
                </label>
                <input
                  type="date"
                  className="hosp-input"
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Proposed Time Slot *
                </label>
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

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Note to Patient (Optional)
                </label>
                <textarea
                  className="hosp-input"
                  rows={2}
                  placeholder="e.g. Doctor is in surgery during morning slot. Proposing afternoon session."
                  value={proposeNotes}
                  onChange={(e) => setProposeNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="hosp-btn-secondary"
                  onClick={() => setProposeModalAppt(null)}
                  disabled={isSubmittingPropose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hosp-btn-primary"
                  disabled={isSubmittingPropose}
                >
                  {isSubmittingPropose ? 'Sending…' : 'Send Proposed Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
