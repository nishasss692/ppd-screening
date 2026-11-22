import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearHospitalSession, getHospitalToken, getHospitalUser } from './hospitalService.js';
import './hospital.css';

export function HospitalLayout() {
  const navigate = useNavigate();
  const [hospitalUser, setHospitalUser] = useState(null);

  useEffect(() => {
    const token = getHospitalToken();
    const user = getHospitalUser();
    if (!token || !user) {
      navigate('/hospital-login', { replace: true });
    } else {
      setHospitalUser(user);
    }
  }, [navigate]);

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
          <div className="hosp-top-header-right">
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
