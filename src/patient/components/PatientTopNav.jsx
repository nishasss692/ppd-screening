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
    label: 'Home',
    key: 'nav.home',
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
      '/patient/reports',
      '/reports',
      '/patient/my-reports',
      '/my-reports',
    ],
    label: 'Screening',
    key: 'nav.screening',
    icon: 'ai-screening',
  },
  {
    to: '/patient/ai-assistant',
    matchPaths: ['/patient/ai-assistant', '/ai-assistant', '/assistant', '/voice-assistant'],
    label: 'AI Assistant',
    key: 'nav.aiAssistant',
    icon: 'ai-assistant',
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
    key: 'nav.supportSpace',
    icon: 'community',
  },
  {
    to: '/patient/profile',
    matchPaths: ['/patient/profile', '/profile', '/patient/settings', '/settings'],
    label: 'Profile',
    key: 'nav.profile',
    icon: 'profile',
  },
];

export function PatientTopNav({ onToggleMobile }) {
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

  const unreadNotifs = notifications.filter((n) => !n.read);
  const unreadCount = unreadNotifs.length;

  const patientName = patient?.name || 'Patient';
  const patientInitials =
    patient?.avatarInitials || (patientName ? patientName[0].toUpperCase() : 'P');

  const handleSignOut = async () => {
    setOpenMenu(null);
    try {
      await signOutUser();
    } catch {}
    navigate('/login');
  };

  const getBreadcrumbTitle = () => {
    if (location.pathname.startsWith('/patient/screening')) return 'Screening';
    if (location.pathname.startsWith('/patient/ai-assistant')) return 'AI Assistant';
    if (location.pathname.startsWith('/patient/support-space')) return 'Support Space';
    if (location.pathname.startsWith('/patient/profile')) return 'Profile';
    if (location.pathname.startsWith('/patient/clinical-profile')) return 'Clinical Profile';
    if (location.pathname.startsWith('/patient/settings')) return 'Settings';
    if (location.pathname.startsWith('/patient/reports')) return 'Reports & Records';
    return 'Home';
  };

  return (
    <header className="dash-topnav patient-topnav" ref={navRef} role="banner">
      <div className="dash-topnav-inner patient-topnav-inner">
        {/* Left: Mobile Hamburger Toggle + Breadcrumbs */}
        <div className="dash-header-left patient-header-left">
          <button
            type="button"
            className="dash-top-hamburger patient-top-hamburger"
            aria-label="Toggle navigation menu"
            onClick={onToggleMobile}
          >
            <DashboardIcon name="menu" size={20} />
          </button>

          <nav className="dash-header-breadcrumb patient-header-breadcrumb" aria-label="Breadcrumb">
            <span className="dash-breadcrumb-root">AANCHAL Patient</span>
            <span className="dash-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="dash-breadcrumb-current">{getBreadcrumbTitle()}</span>
          </nav>
        </div>

        {/* Right Utilities: Notifications, Avatar */}
        <div className="dash-nav-utilities patient-nav-utilities">
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
                    <div className="patient-notif-empty">No notifications yet</div>
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
              title={`${patientName} (Profile & Settings)`}
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
                    <div className="patient-profile-popover-role">
                      {patient?.role === 'family' ? "Patient's Family Support" : 'Maternal Emotional Care'}
                    </div>
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
        </div>
      </div>
    </header>
  );
}
