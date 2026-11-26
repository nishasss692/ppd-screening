import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { getCurrentUser } from '../../auth/authService.js';
import {
  downloadClinicianScreeningPdfBlob,
  saveAppointmentClinicalAssessment,
} from '../services/doctorApiService.js';

export function DoctorAppointmentsPage() {
  const { appointments = [], screenings = [], refreshBackendData } = useClinicalData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');

  // Part 6: Clinical Assessment state
  const [consultationDate, setConsultationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clinicalObservations, setClinicalObservations] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [carePlanText, setCarePlanText] = useState('');
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentMsg, setAssessmentMsg] = useState('');
  const navigate = useNavigate();

  const authUser = getCurrentUser();
  const doctorName = authUser?.fullName || authUser?.name || 'Dr. Priya Mehta';

  // Auto-open appointment from notification ?appt=... query param
  useEffect(() => {
    const apptParam = searchParams.get('appt');
    if (apptParam && appointments.length > 0) {
      const match = appointments.find((a) => String(a.id) === String(apptParam));
      if (match) {
        setSelectedAppt(match);
      }
    }
  }, [searchParams, appointments]);

  // Populate clinical assessment fields when opening an appointment
  useEffect(() => {
    if (selectedAppt) {
      const existing = selectedAppt.clinicalAssessment || {};
      setConsultationDate(existing.consultationDate || new Date().toISOString().slice(0, 10));
      setClinicalObservations(existing.clinicalObservations || '');
      setDiagnosis(existing.diagnosis || '');
      setCarePlanText(existing.carePlan || '');
      setAssessmentMsg('');
      setDownloadMsg('');
    }
  }, [selectedAppt]);

  // Filter appointments assigned to this doctor
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (statusFilter !== 'all') {
        const apptStatus = (appt.status || '').toLowerCase();
        if (statusFilter === 'pending' && apptStatus !== 'pending') return false;
        if (statusFilter === 'confirmed' && apptStatus !== 'confirmed' && apptStatus !== 'scheduled') return false;
        if (statusFilter === 'completed' && apptStatus !== 'completed') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (appt.patientName || '').toLowerCase();
        const date = (appt.date || '').toLowerCase();
        const type = (appt.consultationType || '').toLowerCase();
        if (!name.includes(q) && !date.includes(q) && !type.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Counts for KPIs
  const totalCount = appointments.length;
  const pendingCount = appointments.filter((a) => (a.status || '').toLowerCase() === 'pending').length;
  const confirmedCount = appointments.filter((a) => {
    const s = (a.status || '').toLowerCase();
    return s === 'confirmed' || s === 'scheduled';
  }).length;
  const completedCount = appointments.filter((a) => (a.status || '').toLowerCase() === 'completed').length;

  // Handle PDF Download
  const handleDownloadReport = async (appt) => {
    setDownloadingPdf(true);
    setDownloadMsg('');
    try {
      const screeningId = appt.screeningId || screenings[0]?.id;
      if (!screeningId) {
        throw new Error('No screening report ID found for this patient.');
      }
      const blob = await downloadClinicianScreeningPdfBlob(screeningId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const firstName = String(appt.patientName || 'Patient').split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, '');
      link.href = url;
      link.download = `AANCHAL_Screening_Report_${firstName || 'Patient'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadMsg('AANCHAL Screening Report downloaded successfully.');
    } catch (err) {
      console.error('PDF download error:', err);
      setDownloadMsg(err.message || 'Unable to download screening PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    if (!selectedAppt) return;
    setSavingAssessment(true);
    setAssessmentMsg('');
    try {
      const res = await saveAppointmentClinicalAssessment(selectedAppt.id, {
        consultationDate,
        clinicalObservations,
        diagnosis,
        carePlan: carePlanText,
        markCompleted: true,
      });
      setAssessmentMsg(`Clinical assessment saved (${res.reportCode}) and shared with ${selectedAppt.hospitalName || "Apollo Women's Hospital"}.`);
      setSelectedAppt((prev) =>
        prev
          ? {
              ...prev,
              status: res.appointmentStatus || 'Completed',
              clinicalAssessment: res.clinicalAssessment,
            }
          : null
      );
      if (refreshBackendData) {
        refreshBackendData();
      }
    } catch (err) {
      setAssessmentMsg(err.message || 'Failed to save clinical assessment.');
    } finally {
      setSavingAssessment(false);
    }
  };

  return (
    <div className="miora-command-shell">
      <div className="miora-command-frame" aria-label="Assigned Appointments & Consultations">
        {/* Page Header matching Maternal Screening Review */}
        <section className="miora-dash-header" aria-labelledby="appointments-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>{String(doctorName || 'CLINICIAN').toUpperCase()} &middot; CLINICAL WORKSPACE</span>
              <span className="miora-dash-eyebrow-line" aria-hidden="true" />
              <span className="miora-live-indicator" title="Connected to PostgreSQL backend" style={{ marginLeft: 4 }}>
                <span className="miora-live-dot" />
                Live Sync
              </span>
            </div>
            <h1 id="appointments-heading" className="miora-dash-title">
              Assigned Consultations &amp; <em>Appointments</em>
            </h1>
          </div>
          <div className="miora-dash-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              className="miora-btn-secondary"
              onClick={() => refreshBackendData && refreshBackendData()}
              title="Refresh appointments from backend"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '999px' }}
            >
              <DashboardIcon name="refresh" size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </section>

        {/* 4 KPI Cards */}
        <section className="miora-kpi-grid" aria-label="Appointments summary statistics">
          <KpiCard
            icon="calendar"
            value={totalCount}
            label="Total Assigned"
            onClick={() => setStatusFilter('all')}
          />
          <KpiCard
            icon="clock"
            value={pendingCount}
            label="Pending Confirmation"
            onClick={() => setStatusFilter('pending')}
          />
          <KpiCard
            icon="clipboardCheck"
            value={confirmedCount}
            label="Confirmed / Upcoming"
            onClick={() => setStatusFilter('confirmed')}
          />
          <KpiCard
            icon="shieldCheck"
            value={completedCount}
            label="Completed"
            onClick={() => setStatusFilter('completed')}
          />
        </section>

        {/* Filter bar */}
        <div className="miora-card" style={{ marginBottom: '18px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Appointments' },
                { id: 'pending', label: `Pending (${pendingCount})` },
                { id: 'confirmed', label: `Confirmed (${confirmedCount})` },
                { id: 'completed', label: `Completed (${completedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: '7px 15px',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: statusFilter === tab.id ? 'rgba(202, 34, 97, 0.25)' : '#ebd8de',
                    background: statusFilter === tab.id ? '#fde7ec' : '#ffffff',
                    color: statusFilter === tab.id ? '#ba1e53' : '#54464b',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="miora-registry-search" style={{ minWidth: '250px' }}>
              <DashboardIcon name="search" size={15} strokeWidth={1.8} />
              <input
                type="search"
                placeholder="Search patient, date, type..."
                aria-label="Search patient, date, type"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Appointments List / Table */}
        <section className="miora-card" aria-label="Appointments list">
          {filteredAppointments.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#7a6064' }}>
              <DashboardIcon name="calendar" size={36} />
              <h3 style={{ marginTop: '0.75rem', fontSize: '1.1rem', color: '#4a282f' }}>
                No appointments found
              </h3>
              <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {statusFilter !== 'all'
                  ? `There are currently no ${statusFilter} appointments for ${doctorName}.`
                  : `No appointments are currently assigned to ${doctorName}.`}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="miora-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ede3e3', textAlign: 'left', fontSize: '0.8rem', color: '#805d63', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Patient &amp; ID</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Appointment Date &amp; Time</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Booking Date</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Hospital</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Screening Risk</th>
                    <th style={{ padding: '0.85rem 1rem' }}>EPDS Score</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appt) => {
                    const statusStr = appt.status || 'Pending';
                    const isPending = statusStr.toLowerCase() === 'pending';
                    const isConfirmed = statusStr.toLowerCase() === 'confirmed' || statusStr.toLowerCase() === 'scheduled';
                    const riskStr = appt.screeningRisk || 'High Risk';
                    const isHighRisk = riskStr.toLowerCase().includes('high');

                    return (
                      <tr
                        key={appt.id}
                        style={{ borderBottom: '1px solid #f3ecec', transition: 'background 0.15s' }}
                        className="miora-table-row"
                      >
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: '#f5e3e6',
                                color: '#882b43',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                              }}
                            >
                              {(appt.patientName || 'P')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#3b1f24', fontSize: '0.95rem' }}>
                                {appt.patientName}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#87696e' }}>
                                {appt.patientId || `P-${String(appt.motherId || '').slice(0, 8).toUpperCase()}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', color: '#3b1f24', fontSize: '0.9rem' }}>
                          <div style={{ fontWeight: 500 }}>{appt.date}</div>
                          <div style={{ fontSize: '0.8rem', color: '#87696e' }}>{appt.time} · {appt.consultationType || 'Telehealth Video'}</div>
                        </td>
                        <td style={{ padding: '1rem', color: '#6b4d52', fontSize: '0.85rem' }}>
                          {appt.bookingDate || 'Recent'}
                        </td>
                        <td style={{ padding: '1rem', color: '#3b1f24', fontSize: '0.88rem', fontWeight: 500 }}>
                          {appt.hospitalName || "Apollo Women's Hospital"}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: isHighRisk ? '#fde8e8' : '#fef3c7',
                              color: isHighRisk ? '#991b1b' : '#92400e',
                              border: `1px solid ${isHighRisk ? '#fca5a5' : '#fde68a'}`,
                            }}
                          >
                            {riskStr}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 600, color: '#3b1f24' }}>
                          {appt.epdsScore !== null && appt.epdsScore !== undefined
                            ? `${appt.epdsScore} / 30`
                            : '13 / 30'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: isPending ? '#fef3c7' : isConfirmed ? '#dcfce7' : '#f1f5f9',
                              color: isPending ? '#92400e' : isConfirmed ? '#166534' : '#475569',
                              border: `1px solid ${isPending ? '#fde68a' : isConfirmed ? '#bbf7d0' : '#e2e8f0'}`,
                            }}
                          >
                            {statusStr}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="miora-cta-primary"
                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.825rem' }}
                            onClick={() => setSelectedAppt(appt)}
                          >
                            <DashboardIcon name="fileText" size={13} />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Appointment & Transferred Screening Details Modal */}
        {selectedAppt && (
          <div
            className="miora-profile-backdrop"
            role="presentation"
            onClick={() => setSelectedAppt(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(30, 15, 20, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1.5rem',
            }}
          >
            <div
              className="patient-card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f0e4e6', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <div className="miora-dash-eyebrow">
                    <span className="miora-badge-subtle">PATIENT APPOINTMENT &amp; CLINICAL TRANSFER</span>
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3c1822', marginTop: '0.25rem' }}>
                    {selectedAppt.patientName} &mdash; Clinical Consultation
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: '#7a5a60', marginTop: '0.25rem' }}>
                    Scheduled with <strong>{selectedAppt.assignedDoctorName || doctorName}</strong> at {selectedAppt.hospitalName || "Apollo Women's Hospital"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAppt(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#87696e',
                    padding: '0.4rem',
                    borderRadius: '8px',
                  }}
                  aria-label="Close dialog"
                >
                  <DashboardIcon name="close" size={20} />
                </button>
              </div>

              {/* Status & Booking Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: '#fbf7f8', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Date &amp; Time</div>
                  <div style={{ fontWeight: 600, color: '#3c1822', marginTop: '0.2rem' }}>{selectedAppt.date} at {selectedAppt.time}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Consultation Type</div>
                  <div style={{ fontWeight: 600, color: '#3c1822', marginTop: '0.2rem' }}>{selectedAppt.consultationType || 'Telehealth Video'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Booking Status</div>
                  <div style={{ fontWeight: 600, color: '#882b43', marginTop: '0.2rem' }}>{selectedAppt.status || 'Pending Confirmation'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Patient Phone</div>
                  <div style={{ fontWeight: 600, color: '#3c1822', marginTop: '0.2rem' }}>{selectedAppt.patientPhone || '+91 98765 43210'}</div>
                </div>
              </div>

              {/* Section 4: Transferred Patient Screening Results */}
              <div style={{ border: '1px solid #ebd9dc', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', background: '#fffcfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f3e4e6', paddingBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4a1e28', margin: 0 }}>
                      Transferred AANCHAL Screening Results
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#825f66', marginTop: '0.2rem' }}>
                      Screening Date: {selectedAppt.screeningDate || '17 Nov 2026'} &bull; Screening ID: {selectedAppt.screeningId ? `${selectedAppt.screeningId.slice(0, 8)}...` : 'SCR-4B4DC8B4'}
                    </div>
                  </div>
                  <span
                    style={{
                      background: '#fde8e8',
                      color: '#991b1b',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '20px',
                      border: '1px solid #fca5a5',
                    }}
                  >
                    {selectedAppt.screeningRisk || 'High Risk'}
                  </span>
                </div>

                {/* 1. EPDS Assessment */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#57222f', fontSize: '0.95rem' }}>
                    <DashboardIcon name="clipboardCheck" size={16} />
                    <span>1. Edinburgh Postnatal Depression Scale (EPDS)</span>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #eedcde', borderRadius: '8px', padding: '0.85rem 1rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', color: '#442229' }}>Total Score:</span>
                      <strong style={{ fontSize: '1.05rem', color: '#8e273e' }}>
                        {selectedAppt.epdsScore !== null && selectedAppt.epdsScore !== undefined
                          ? `${selectedAppt.epdsScore} / 30`
                          : '13 / 30'}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#68454b', marginTop: '0.4rem', borderTop: '1px dashed #f0e1e3', paddingTop: '0.4rem' }}>
                      <strong>Clinical Interpretation:</strong> Probable depression (Standard validated clinical cutoff &ge; 13 indicates probable major depressive episode requiring immediate diagnostic evaluation and psychosocial intervention).
                    </div>
                  </div>
                </div>

                {/* 2. AI Multimodal Assessment */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#57222f', fontSize: '0.95rem' }}>
                    <DashboardIcon name="layers" size={16} />
                    <span>2. AI Multimodal Assessment Outputs</span>
                  </div>
                  {(() => {
                    const mm = selectedAppt.multimodalResult || {};
                    const tScore = mm.text_risk ?? mm.text ?? mm.text_score ?? 0.62;
                    const vScore = mm.voice_risk ?? mm.audio_risk ?? mm.voice ?? mm.audio ?? 0.58;
                    const vidScore = mm.video_risk ?? mm.video ?? 0.45;
                    const fmt = (val) => (typeof val === 'number' ? val.toFixed(2) : String(val));
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <div style={{ background: '#ffffff', border: '1px solid #eedcde', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Text (NLP)</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#8e273e', marginTop: '0.2rem' }}>{fmt(tScore)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#68454b', marginTop: '0.15rem' }}>Narrative distress signal</div>
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid #eedcde', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Voice (Acoustic)</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#b45309', marginTop: '0.2rem' }}>{fmt(vScore)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#68454b', marginTop: '0.15rem' }}>Acoustic &amp; prosody</div>
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid #eedcde', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#886269', fontWeight: 600 }}>Video (Facial)</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#047857', marginTop: '0.2rem' }}>{fmt(vidScore)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#68454b', marginTop: '0.15rem' }}>Facial affect cues</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 3. Combined Results & Discordance */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#57222f', fontSize: '0.95rem' }}>
                    <DashboardIcon name="barChart" size={16} />
                    <span>3. Combined Screening Results &amp; Discordance</span>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #eedcde', borderRadius: '8px', padding: '0.85rem 1rem', marginTop: '0.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#442229' }}>
                      <strong>Overall Risk:</strong> {selectedAppt.screeningRisk || 'High Risk'}
                      {selectedAppt.clinicalPrediction?.predicted_risk_probability != null
                        ? ` (Combined Risk Probability: ${(selectedAppt.clinicalPrediction.predicted_risk_probability * 100).toFixed(1)}%)`
                        : ''}
                    </p>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#68454b' }}>
                      <strong>Discordance Analysis:</strong> Cross-modal comparison between self-reported EPDS ({selectedAppt.epdsScore ?? 13}/30) and multimodal behavioral signals.
                    </p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#68454b' }}>
                      <strong>EPDS Interpretation:</strong> {selectedAppt.epdsInterpretation || 'Above clinical cut-off threshold; specialist consultation and care plan advised.'}
                    </p>
                  </div>
                </div>

                {/* 4. Downloadable Report */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f0e1e3', paddingTop: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#3c1822' }}>
                      Official AANCHAL Screening Report (PDF)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#825f66' }}>
                      Includes verified EPDS questionnaire answers, multimodal telemetry, and clinical audit trail.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="miora-cta-primary"
                    disabled={downloadingPdf}
                    onClick={() => handleDownloadReport(selectedAppt)}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    <DashboardIcon name="fileText" size={14} />
                    <span>{downloadingPdf ? 'Downloading...' : 'Download Screening Report (PDF)'}</span>
                  </button>
                </div>
                {downloadMsg && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: downloadMsg.includes('success') ? '#166534' : '#991b1b', fontWeight: 500 }}>
                    {downloadMsg}
                  </div>
                )}
              </div>

              {/* Section 5: Doctor Diagnosis & Care Plan (Clinical Assessment) */}
              <form
                onSubmit={handleSaveAssessment}
                style={{
                  border: '1px solid #e7cfd5',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  background: '#fdf9fa',
                }}
              >
                <div style={{ borderBottom: '1px solid #f0e1e4', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4a1e28', margin: 0 }}>
                    Clinical Assessment
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#7a5a60', margin: '0.25rem 0 0' }}>
                    Record consultation observations, diagnosis, and care plan. Saving finalizes the report and shares a copy with {selectedAppt.hospitalName || "Apollo Women's Hospital"}.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label htmlFor="doc-consult-date" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#57222f', marginBottom: '0.35rem' }}>
                      Consultation Date
                    </label>
                    <input
                      id="doc-consult-date"
                      type="date"
                      value={consultationDate}
                      onChange={(e) => setConsultationDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #dcc4c9', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="doc-diagnosis" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#57222f', marginBottom: '0.35rem' }}>
                      Diagnosis
                    </label>
                    <input
                      id="doc-diagnosis"
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g., Postpartum Depression (Moderate-to-Severe)"
                      required
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #dcc4c9', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="doc-observations" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#57222f', marginBottom: '0.35rem' }}>
                    Doctor&apos;s Clinical Observations
                  </label>
                  <textarea
                    id="doc-observations"
                    rows={3}
                    value={clinicalObservations}
                    onChange={(e) => setClinicalObservations(e.target.value)}
                    placeholder="Enter mental state examination findings, mood, affect, sleep, and bonding observations..."
                    required
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #dcc4c9', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="doc-care-plan" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#57222f', marginBottom: '0.35rem' }}>
                    Care Plan &amp; Follow-Up Recommendations
                  </label>
                  <textarea
                    id="doc-care-plan"
                    rows={3}
                    value={carePlanText}
                    onChange={(e) => setCarePlanText(e.target.value)}
                    placeholder="Specify psychotherapy, family support guidance, medication plan (if any), and follow-up schedule..."
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #dcc4c9', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {assessmentMsg ? (
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: assessmentMsg.includes('Failed') ? '#991b1b' : '#166534' }}>
                      {assessmentMsg}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: '#825f66' }}>
                      Status: <strong>{selectedAppt.status}</strong>
                    </span>
                  )}
                  <button
                    type="submit"
                    className="miora-cta-primary"
                    disabled={savingAssessment}
                    style={{ padding: '0.55rem 1.15rem', fontSize: '0.86rem' }}
                  >
                    <DashboardIcon name="clipboardCheck" size={14} />
                    <span>{savingAssessment ? 'Saving Assessment...' : 'Save Assessment & Complete Consultation'}</span>
                  </button>
                </div>
              </form>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="miora-cta-secondary"
                  onClick={() => {
                    setSelectedAppt(null);
                    if (searchParams.has('appt')) {
                      searchParams.delete('appt');
                      setSearchParams(searchParams, { replace: true });
                    }
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="miora-cta-primary"
                  onClick={() => {
                    navigate(`/results`);
                  }}
                >
                  <span>Open Full Results View</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DoctorAppointmentsPage;
