import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BrandWordmark } from '../../dashboard/components/BrandWordmark.jsx';
import { DashboardIcon } from '../../dashboard/components/DashboardIcon.jsx';
import { usePatient } from '../context/PatientContext.jsx';
import { signOutUser } from '../../auth/authService.js';
import { PatientIcon } from './PatientIcons.jsx';
import '../styles/patientTopNav.css';

export const PATIENT_NAV_ITEMS = [
  {
    to: '/patient/dashboard',
    matchPaths: ['/patient/dashboard', '/patient/home', '/patient'],
    label: 'Dashboard',
    icon: 'home',
  },
  {
    to: '/patient/medical-history',
    matchPaths: ['/patient/medical-history', '/medical-history'],
    label: 'Medical History',
    icon: 'medical-history',
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
    ],
    label: 'Screening',
    icon: 'ai-screening',
  },
  {
    to: '/patient/ai-assistant',
    matchPaths: ['/patient/ai-assistant', '/ai-assistant', '/assistant', '/voice-assistant'],
    label: 'AI Assistant',
    icon: 'ai-assistant',
  },
  {
    to: '/patient/connect-doctor',
    matchPaths: ['/patient/connect-doctor', '/connect-doctor'],
    label: 'Connect to a Doctor',
    icon: 'connect-doctor',
  },
  {
    to: '/patient/reports',
    matchPaths: ['/patient/reports', '/patient/my-reports', '/reports', '/my-reports'],
    label: 'My Reports',
    icon: 'reports',
  },
  {
    to: '/patient/community',
    matchPaths: ['/patient/community', '/community', '/mothers-circle'],
    label: "Mother's Circle",
    icon: 'community',
  },
  {
    to: '/patient/care-suggestions',
    matchPaths: ['/patient/care-suggestions', '/care-suggestions', '/patient/suggestions'],
    label: 'Care Suggestions',
    icon: 'care-suggestions',
  },
];

export function PatientTopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    patient,
    notifications = [],
    markNotificationRead,
    markAllNotificationsRead,
  } = usePatient();

  const [openMenu, setOpenMenu] = useState(null); // 'notifs' | 'profile' | 'mobile' | null
  const navRef = useRef(null);

  // Close menus on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const isItemActive = (item) => {
    return item.matchPaths.some((p) => {
      if (p === '/patient/dashboard' || p === '/patient/home' || p === '/patient') {
        return (
          location.pathname === '/patient/dashboard' ||
          location.pathname === '/patient/home' ||
          location.pathname === '/patient'
        );
      }
      if (p === '/patient/reports' || p === '/reports') {
        return (
          location.pathname === '/patient/reports' ||
          location.pathname === '/patient/my-reports' ||
          location.pathname === '/reports' ||
          location.pathname === '/my-reports'
        );
      }
      return location.pathname.startsWith(p);
    });
  };

  const unreadNotifs = notifications.filter((n) => !n.read);
  const unreadCount = unreadNotifs.length;

  const patientName = patient?.name || 'Amara';
  const patientInitials =
    patient?.avatarInitials || (patientName ? patientName[0].toUpperCase() : 'A');

  const handleSignOut = async () => {
    setOpenMenu(null);
    try {
      await signOutUser();
    } catch {}
    navigate('/login');
  };

  return (
    <header className="dash-topnav patient-topnav" ref={navRef} role="banner">
      <div className="dash-topnav-inner patient-topnav-inner">
        {/* Brand Group */}
        <div className="dash-brand-group patient-brand-group">
          <Link
            to="/"
            className="dash-brand-link patient-brand-link"
            aria-label="Miora Home"
            onClick={() => setOpenMenu(null)}
          >
            <BrandWordmark />
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav
          className="dash-nav-links patient-nav-links"
          role="navigation"
          aria-label="Patient Portal Navigation"
        >
          {PATIENT_NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`dash-nav-link patient-nav-link ${active ? 'is-active' : ''}`}
              >
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right Utilities: Assistant, Notifications, Avatar, Mobile Menu Button */}
        <div className="dash-nav-utilities patient-nav-utilities">
          {/* AI Assistant sparkle button matching Doctor Dashboard Copilot */}
          <div className="dash-utility-wrap patient-utility-wrap">
            <Link
              to="/patient/ai-assistant"
              className="dash-icon-btn patient-icon-btn"
              aria-label="Patient AI Assistant"
              title="Miora AI Assistant"
            >
              <DashboardIcon name="sparkle" size={17} strokeWidth={1.8} />
            </Link>
          </div>

          {/* Notifications Dropdown */}
          <div className="dash-utility-wrap patient-utility-wrap">
            <button
              type="button"
              className={`dash-icon-btn patient-icon-btn ${openMenu === 'notifs' ? 'is-open' : ''}`}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={openMenu === 'notifs'}
              onClick={() => setOpenMenu((prev) => (prev === 'notifs' ? null : 'notifs'))}
              title="Notifications"
            >
              <DashboardIcon name="bell" size={18} strokeWidth={1.8} />
              {unreadCount > 0 && <span className="dash-bell-dot" aria-hidden="true" />}
            </button>

            {openMenu === 'notifs' && (
              <div
                className="patient-popover patient-notif-popover"
                role="dialog"
                aria-label="Notifications list"
              >
                <div className="patient-notif-header">
                  <div className="patient-notif-header-title">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="patient-notif-badge">{unreadCount} new</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="patient-notif-mark-all"
                      onClick={() => markAllNotificationsRead?.()}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="patient-notif-list">
                  {notifications.length === 0 ? (
                    <div className="patient-notif-empty">No notifications at this time</div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className={`patient-notif-item ${!n.read ? 'is-unread' : ''}`}
                        onClick={() => markNotificationRead?.(n.id)}
                      >
                        <div className="patient-notif-item-body">
                          <p className="patient-notif-item-title">{n.title || n.message}</p>
                          <span className="patient-notif-item-time">{n.time || 'Today'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown — Minimal circular avatar button matching Doctor Dashboard */}
          <div className="dash-utility-wrap patient-utility-wrap">
            <button
              type="button"
              className={`dash-avatar-btn ${openMenu === 'profile' ? 'is-open' : ''}`}
              aria-label="Patient profile menu"
              aria-expanded={openMenu === 'profile'}
              onClick={() => setOpenMenu((prev) => (prev === 'profile' ? null : 'profile'))}
              title={`${patientName} (Profile)`}
            >
              {patientInitials}
            </button>

            {openMenu === 'profile' && (
              <div
                className="patient-popover patient-profile-popover"
                role="menu"
                aria-label="Profile options"
              >
                <div className="patient-profile-popover-header">
                  <div className="patient-avatar-circle-lg">{patientInitials}</div>
                  <div>
                    <div className="patient-profile-popover-name">{patientName}</div>
                    <div className="patient-profile-popover-role">Maternal Emotional Care</div>
                  </div>
                </div>

                <div className="patient-profile-popover-menu">
                  <Link
                    to="/patient/profile"
                    className="patient-popover-item"
                    role="menuitem"
                    onClick={() => setOpenMenu(null)}
                  >
                    <PatientIcon name="profile" size={15} />
                    <span>Profile</span>
                  </Link>
                  <Link
                    to="/patient/settings"
                    className="patient-popover-item"
                    role="menuitem"
                    onClick={() => setOpenMenu(null)}
                  >
                    <PatientIcon name="settings" size={15} />
                    <span>Settings</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    className="patient-popover-item"
                    role="menuitem"
                    onClick={() => setOpenMenu(null)}
                  >
                    <PatientIcon name="doctor" size={15} />
                    <span>Switch to Clinician Dashboard</span>
                  </Link>
                  <div className="patient-popover-divider" />
                  <button
                    type="button"
                    className="patient-popover-item is-signout"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            className="patient-mobile-menu-btn"
            aria-label="Toggle navigation menu"
            aria-expanded={openMenu === 'mobile'}
            onClick={() => setOpenMenu((prev) => (prev === 'mobile' ? null : 'mobile'))}
          >
            {openMenu === 'mobile' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {openMenu === 'mobile' && (
        <nav
          className="patient-mobile-drawer"
          role="navigation"
          aria-label="Mobile patient navigation"
        >
          {PATIENT_NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`patient-mobile-link ${active ? 'is-active' : ''}`}
                onClick={() => setOpenMenu(null)}
              >
                <PatientIcon name={item.icon} size={17} className="patient-mobile-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <div className="patient-mobile-divider" />
          <NavLink
            to="/patient/profile"
            className="patient-mobile-link"
            onClick={() => setOpenMenu(null)}
          >
            <PatientIcon name="profile" size={17} className="patient-mobile-icon" />
            <span>Profile</span>
          </NavLink>
          <NavLink
            to="/patient/settings"
            className="patient-mobile-link"
            onClick={() => setOpenMenu(null)}
          >
            <PatientIcon name="settings" size={17} className="patient-mobile-icon" />
            <span>Settings</span>
          </NavLink>
          <button
            type="button"
            className="patient-mobile-link is-signout"
            onClick={handleSignOut}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </nav>
      )}
    </header>
  );
}
