import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandWordmark } from './BrandWordmark.jsx';
import { DashboardIcon } from './DashboardIcon.jsx';
import { getCurrentUser } from '../../auth/authService.js';
import { CLINICIAN_PROFILE } from '../data/mockClinicalData.js';

export const NAV_ITEMS = [
  { label: 'Mothers & Cases', to: '/mothers', icon: 'users' },
  { label: 'Screening', to: '/live-screening', matchPaths: ['/live-screening', '/upload-analyze'], icon: 'video' },
  { label: 'Results', to: '/results', icon: 'fileText' },
  { label: 'Discordance', to: '/discordance', icon: 'layers' },
  { label: 'Insights & Care', to: '/insights', icon: 'barChart' },
  { label: 'Clinical Review', to: '/clinical-review', matchPaths: ['/clinical-review', '/create-consultation-report', '/consultation-report'], icon: 'clipboardCheck' },
];

export function DashboardSidebar({ mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const authUser = getCurrentUser();

  const clinicianName = authUser?.fullName || authUser?.name || CLINICIAN_PROFILE.name;
  const clinicianRole = authUser?.role
    ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1)
    : CLINICIAN_PROFILE.role;
  const clinicianInitials =
    authUser?.avatarInitials ||
    (authUser?.name
      ? authUser.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : CLINICIAN_PROFILE.initials);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="dash-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`dash-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`} aria-label="Main sidebar navigation">
        <div className="dash-sidebar-head">
          <Link
            to="/mothers"
            className="dash-brand-link"
            aria-label="AANCHAL Clinician Portal"
            onClick={onCloseMobile}
          >
            <BrandWordmark />
          </Link>
          <span className="dash-sidebar-portal-tag">Clinical</span>
          {mobileOpen && (
            <button
              type="button"
              className="dash-sidebar-close-btn"
              aria-label="Close sidebar navigation"
              onClick={onCloseMobile}
            >
              <DashboardIcon name="close" size={18} />
            </button>
          )}
        </div>

        <nav className="dash-sidebar-nav" aria-label="Clinician workspace navigation">
          <div className="dash-sidebar-section-label">CLINICAL NAVIGATION</div>
          <ul className="dash-sidebar-list">
            {NAV_ITEMS.map((item) => {
              const extraActive = item.matchPaths?.some((p) =>
                location.pathname.startsWith(p)
              );
              return (
                <li key={item.to} className="dash-sidebar-item">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `dash-sidebar-link ${isActive || extraActive ? 'is-active' : ''}`
                    }
                    onClick={onCloseMobile}
                  >
                    <span className="dash-sidebar-icon" aria-hidden="true">
                      <DashboardIcon name={item.icon} size={18} strokeWidth={1.8} />
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
            <span className="dash-sidebar-avatar" aria-hidden="true">
              {clinicianInitials}
            </span>
            <div className="dash-sidebar-user-meta">
              <strong className="dash-sidebar-user-name">{clinicianName}</strong>
              <span className="dash-sidebar-user-role">{clinicianRole}</span>
            </div>
            <span className="dash-sidebar-status-dot" title="Connected to clinical system" aria-label="Connected" />
          </div>
        </div>
      </aside>
    </>
  );
}
