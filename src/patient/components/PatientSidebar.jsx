import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandWordmark } from '../../dashboard/components/BrandWordmark.jsx';
import { DashboardIcon } from '../../dashboard/components/DashboardIcon.jsx';
import { PatientIcon } from './PatientIcons.jsx';
import { usePatient } from '../context/PatientContext.jsx';
import { getCurrentUser } from '../../auth/authService.js';

export const PATIENT_SIDEBAR_ITEMS = [
  {
    to: '/patient/dashboard',
    matchPaths: ['/patient/dashboard', '/patient/home', '/patient'],
    label: 'Home',
    icon: 'home',
  },
  {
    to: '/patient/screening',
    matchPaths: [
      '/patient/screening',
      '/screening',
      '/ai-screening',
      '/patient-screening',
      '/patient/ai-screening',
      '/screening-results',
      '/patient/screening/results',
      '/patient/medical-history',
      '/medical-history',
    ],
    label: 'Screening',
    icon: 'clipboard-check',
  },
  {
    to: '/patient/reports',
    matchPaths: ['/patient/reports', '/reports', '/patient/my-reports', '/my-reports'],
    label: 'Reports',
    icon: 'reports',
  },
  {
    to: '/patient/care-suggestions',
    matchPaths: ['/patient/care-suggestions', '/care-suggestions', '/patient/suggestions'],
    label: 'Insights & Care',
    icon: 'insights',
  },
  {
    to: '/patient/ai-assistant',
    matchPaths: ['/patient/ai-assistant', '/ai-assistant', '/assistant', '/voice-assistant'],
    label: 'AI Assistant',
    icon: 'sparkle',
  },
  {
    to: '/patient/support-space',
    matchPaths: [
      '/patient/support-space',
      '/support-space',
      '/patient/community',
      '/community',
      '/mothers-circle',
      '/patient/mothers-circle',
    ],
    label: 'Support Space',
    icon: 'heart',
  },
  {
    to: '/patient/profile',
    matchPaths: ['/patient/profile', '/profile', '/patient/settings', '/settings'],
    label: 'Profile',
    icon: 'user',
  },
];

export function PatientSidebar({
  mobileOpen = false,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}) {
  const location = useLocation();
  const { patient } = usePatient();
  const authUser = getCurrentUser();

  const patientName = patient?.fullName || patient?.name || authUser?.fullName || authUser?.name || 'Patient';
  const patientInitials = patient?.avatarInitials || (patientName ? patientName[0]?.toUpperCase() : 'P');
  const postpartumWeek = patient?.postpartumWeek || 1;

  return (
    <>
      {mobileOpen && (
        <div
          className="dash-sidebar-backdrop patient-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`dash-sidebar patient-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`} aria-label="Main patient navigation">
        <div className="dash-sidebar-head">
          <Link
            to="/"
            className="dash-brand-link"
            aria-label="AANCHAL Home"
            onClick={onCloseMobile}
          >
            <BrandWordmark />
          </Link>
          <span className="dash-sidebar-portal-tag patient-portal-tag">Patient</span>
          {onToggleCollapse && !mobileOpen && (
            <button
              type="button"
              className="dash-sidebar-collapse-btn"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapse}
            >
              <DashboardIcon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15} />
            </button>
          )}
          {mobileOpen && (
            <button
              type="button"
              className="dash-sidebar-close-btn"
              aria-label="Close patient navigation"
              onClick={onCloseMobile}
            >
              <DashboardIcon name="close" size={18} />
            </button>
          )}
        </div>

        <nav className="dash-sidebar-nav patient-sidebar-nav" aria-label="Patient Portal Navigation">
          <div className="dash-sidebar-section-label">PATIENT NAVIGATION</div>
          <ul className="dash-sidebar-list">
            {PATIENT_SIDEBAR_ITEMS.map((item) => {
              const extraActive = item.matchPaths?.some((p) =>
                location.pathname.startsWith(p)
              );
              return (
                <li key={item.to} className="dash-sidebar-item">
                  <NavLink
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `dash-sidebar-link ${isActive || extraActive ? 'is-active' : ''}`
                    }
                    onClick={onCloseMobile}
                  >
                    <span className="dash-sidebar-icon" aria-hidden="true">
                      {item.icon === 'home' && <PatientIcon name="home" size={18} />}
                      {item.icon === 'clipboard-check' && <PatientIcon name="clipboard-check" size={18} />}
                      {item.icon === 'sparkle' && <DashboardIcon name="messageCircle" size={18} />}
                      {item.icon === 'heart' && <DashboardIcon name="heart" size={18} />}
                      {item.icon === 'user' && <PatientIcon name="user" size={18} />}
                    </span>
                    <span className="dash-sidebar-label">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-sidebar-user-card">
            <span className="dash-sidebar-avatar patient-sidebar-avatar" aria-hidden="true">
              {patientInitials}
            </span>
            <div className="dash-sidebar-user-meta">
              <strong className="dash-sidebar-user-name">{patientName}</strong>
              <span className="dash-sidebar-user-role">Week {postpartumWeek} Postpartum</span>
            </div>
            <span className="dash-sidebar-status-dot" title="Active Account" aria-label="Active" />
          </div>
        </div>
      </aside>
    </>
  );
}
