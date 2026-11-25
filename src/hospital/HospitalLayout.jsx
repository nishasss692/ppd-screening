import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  clearHospitalSession,
  fetchHospitalNotifications,
  getHospitalToken,
  getHospitalUser,
  markAllHospitalNotificationsRead,
  markHospitalNotificationRead,
} from './hospitalService.js';
import './hospital.css';

export function HospitalLayout() {
  const navigate = useNavigate();
  const [hospitalUser, setHospitalUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const list = await fetchHospitalNotifications();
      if (Array.isArray(list)) setNotifications(list);
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    const token = getHospitalToken();
    const user = getHospitalUser();
    if (!token || !user) {
      navigate('/hospital-login', { replace: true });
    } else {
      setHospitalUser(user);
      loadNotifications();
    }
  }, [navigate, loadNotifications]);

  useEffect(() => {
    if (!hospitalUser) return undefined;
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [hospitalUser, loadNotifications]);

  const handleLogout = () => {
    clearHospitalSession();
    navigate('/hospital-login', { replace: true });
  };

  if (!hospitalUser) {
    return null;
  }

  return (
    <div className="hosp-layout-shell">
      {/* Sidebar */}
      <aside className="hosp-sidebar" aria-label="Hospital Navigation">
        <div className="hosp-sidebar-brand">
          <div className="hosp-sidebar-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </div>
          <div className="hosp-sidebar-title-group">
            <h2>AANCHAL</h2>
            <span className="hosp-sidebar-badge">Hospital Portal</span>
          </div>
        </div>

        <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <ul className="hosp-nav-list">
            <li>
              <NavLink
                to="/hospital/dashboard"
                className={({ isActive }) => `hosp-nav-link${isActive ? ' is-active' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/hospital/appointments"
                className={({ isActive }) => `hosp-nav-link${isActive ? ' is-active' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Appointments</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/hospital/reports"
                className={({ isActive }) => `hosp-nav-link${isActive ? ' is-active' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Reports</span>
              </NavLink>
            </li>
          </ul>

          <div className="hosp-sidebar-footer">
            <div className="hosp-user-info-box">
              <span className="hosp-user-name">{hospitalUser.hospital_name}</span>
              <span className="hosp-user-hospital">{hospitalUser.hospital_id} · {hospitalUser.hospital_location}</span>
            </div>
            <button
              type="button"
              className="hosp-logout-btn"
              onClick={handleLogout}
              aria-label="Log out of hospital portal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content frame */}
      <div className="hosp-main-area">
        <header className="hosp-top-header">
          <h1 className="hosp-top-header-title">Clinical Care Coordination</h1>
          <div className="hosp-top-header-right" style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            {/* Hospital Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Hospital notifications"
                onClick={() => setShowNotifs((p) => !p)}
                style={{
                  position: 'relative',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#0f3d3e',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.filter((n) => !n.isRead).length > 0 && (
                  <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                    {notifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div
                  role="dialog"
                  aria-label="Hospital notifications"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '115%',
                    width: 340,
                    maxHeight: 380,
                    overflowY: 'auto',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
                    zIndex: 50,
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f1f5f9', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13.5, color: '#0f3d3e' }}>Hospital Notifications</strong>
                    {notifications.some((n) => !n.isRead) && (
                      <button
                        type="button"
                        onClick={async () => {
                          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                          await markAllHospitalNotificationsRead();
                        }}
                        style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={async () => {
                          setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
                          await markHospitalNotificationRead(n.id);
                          setShowNotifs(false);
                          if (n.type === 'consultation_completed') {
                            navigate('/hospital/reports');
                          } else if (n.relatedAppointmentId) {
                            navigate(`/hospital/appointments/${n.relatedAppointmentId}`);
                          } else {
                            navigate('/hospital/appointments');
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px',
                          borderRadius: 8,
                          border: 'none',
                          background: !n.isRead ? '#f0fdfa' : 'transparent',
                          cursor: 'pointer',
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: !n.isRead ? 700 : 500, color: '#1e293b' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                          {n.metadata?.date ? `${n.metadata.date} · ${n.metadata.time || ''} · ` : ''}
                          {n.date}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <span className="hosp-org-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" />
              </svg>
              <span>{hospitalUser.hospital_name} ({hospitalUser.hospital_id})</span>
            </span>
          </div>
        </header>

        <main className="hosp-content-body">
          <Outlet context={{ hospitalUser }} />
        </main>
      </div>
    </div>
  );
}
