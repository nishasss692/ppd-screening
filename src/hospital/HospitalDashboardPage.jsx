import React, { useEffect, useState } from 'react';
import { NavLink, useOutletContext } from 'react-router-dom';
import { fetchHospitalAppointments, fetchHospitalDashboard } from './hospitalService.js';

export function HospitalDashboardPage() {
  const { hospitalUser } = useOutletContext();
  const [metrics, setMetrics] = useState({
    total_requests: 0,
    pending_requests: 0,
    confirmed_appointments: 0,
    completed_appointments: 0,
    cancelled_requests: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError('');
      try {
        const [metricData, apptData] = await Promise.all([
          fetchHospitalDashboard(),
          fetchHospitalAppointments('all'),
        ]);
        if (isMounted) {
          setMetrics(metricData);
          setRecentAppointments(apptData.slice(0, 8));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load hospital dashboard data.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--hosp-primary)', margin: '0 0 6px 0' }}>
          Hospital Care Portal
        </h2>
        <p style={{ color: 'var(--hosp-text-muted)', fontSize: 14.5, margin: 0 }}>
          Manage incoming maternal consultation requests, confirm appointments, and assign available specialists.
        </p>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* 5 Metrics Cards */}
      <section className="hosp-metrics-grid" aria-label="Appointment Request Summary">
        <div className="hosp-metric-card">
          <div className="hosp-metric-header">
            <span className="hosp-metric-label">Total Requests</span>
            <div className="hosp-metric-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          </div>
          <p className="hosp-metric-val">{isLoading ? '—' : metrics.total_requests}</p>
          <span className="hosp-metric-sub">All patient submissions</span>
        </div>

        <div className="hosp-metric-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="hosp-metric-header">
            <span className="hosp-metric-label">Pending Requests</span>
            <div className="hosp-metric-icon" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <p className="hosp-metric-val" style={{ color: '#b45309' }}>{isLoading ? '—' : metrics.pending_requests}</p>
          <span className="hosp-metric-sub">Awaiting hospital action</span>
        </div>

        <div className="hosp-metric-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="hosp-metric-header">
            <span className="hosp-metric-label">Confirmed</span>
            <div className="hosp-metric-icon" style={{ backgroundColor: '#d1fae5', color: '#047857' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <p className="hosp-metric-val" style={{ color: '#047857' }}>{isLoading ? '—' : metrics.confirmed_appointments}</p>
          <span className="hosp-metric-sub">Scheduled consultations</span>
        </div>

        <div className="hosp-metric-card">
          <div className="hosp-metric-header">
            <span className="hosp-metric-label">Completed</span>
            <div className="hosp-metric-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <p className="hosp-metric-val">{isLoading ? '—' : metrics.completed_appointments}</p>
          <span className="hosp-metric-sub">Conducted appointments</span>
        </div>

        <div className="hosp-metric-card">
          <div className="hosp-metric-header">
            <span className="hosp-metric-label">Cancelled</span>
            <div className="hosp-metric-icon" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </div>
          <p className="hosp-metric-val">{isLoading ? '—' : metrics.cancelled_requests}</p>
          <span className="hosp-metric-sub">Declined / cancelled</span>
        </div>
      </section>

      {/* Recent Requests Section */}
      <section className="hosp-card" aria-labelledby="recent-requests-title">
        <div className="hosp-card-header">
          <h3 id="recent-requests-title" className="hosp-card-title">Recent Appointment Requests</h3>
          <NavLink to="/hospital/appointments" className="hosp-btn-secondary">
            <span>View All Requests</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </NavLink>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--hosp-text-muted)' }}>
            Loading requests…
          </div>
        ) : recentAppointments.length === 0 ? (
          <div className="hosp-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h3>No appointment requests yet</h3>
            <p>New consultation requests submitted by patients will appear here in real time.</p>
          </div>
        ) : (
          <div className="hosp-table-wrap">
            <table className="hosp-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Contact</th>
                  <th>Requested Doctor</th>
                  <th>Date &amp; Time</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentAppointments.map((appt) => {
                  const statusKey = (appt.status || 'pending').toLowerCase();
                  return (
                    <tr key={appt.id}>
                      <td>
                        <strong>{appt.patient_name}</strong>
                      </td>
                      <td style={{ color: 'var(--hosp-text-muted)', fontSize: 13 }}>
                        {appt.patient_phone || '—'}
                      </td>
                      <td>
                        <span>{appt.assigned_doctor_name || appt.requested_doctor_name}</span>
                        {appt.assigned_doctor_name && appt.assigned_doctor_name !== appt.requested_doctor_name && (
                          <div style={{ fontSize: 11, color: 'var(--hosp-teal-dark)' }}>Assigned by hospital</div>
                        )}
                      </td>
                      <td>
                        <span>{appt.confirmed_date || appt.requested_date}</span>
                        <div style={{ fontSize: 12, color: 'var(--hosp-text-muted)' }}>
                          {appt.confirmed_time || appt.requested_time}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--hosp-primary)' }}>{appt.type}</span>
                      </td>
                      <td>
                        <span className={`hosp-badge hosp-badge-${statusKey}`}>
                          {statusKey === 'rescheduled' ? 'Time Proposed' : appt.status}
                        </span>
                      </td>
                      <td>
                        <NavLink to={`/hospital/appointments/${appt.id}`} className="hosp-btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }}>
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
      </section>
    </div>
  );
}
