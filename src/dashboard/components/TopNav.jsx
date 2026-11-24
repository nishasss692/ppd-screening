import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { getCurrentUser } from '../../auth/authService.js';
import { CLINICIAN_PROFILE } from '../data/mockClinicalData.js';
import { DashboardIcon } from './DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from './Badges.jsx';
import { DoctorAssistantPopover } from './DoctorAssistantPopover.jsx';

const BREADCRUMB_MAP = {
  '/mothers': 'Mothers & Cases',
  '/live-screening': 'AI & EPDS Screening',
  '/upload-analyze': 'Screening Upload & Analysis',
  '/results': 'Clinical Results',
  '/discordance': 'Discordance Analysis',
  '/insights': 'Insights & Care Analytics',
  '/clinical-review': 'Clinical Review & Finalization',
};

export function TopNav({ onToggleMobileNav }) {
  const { alerts, mothers, screenings, isLiveSynced } = useClinicalData();
  const navigate = useNavigate();
  const location = useLocation();

  const authUser = getCurrentUser();
  const clinicianName = authUser?.fullName || authUser?.name || CLINICIAN_PROFILE.name;
  const clinicianRole = authUser?.role
    ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1)
    : CLINICIAN_PROFILE.role;
  const clinicianClinic = authUser?.clinic || CLINICIAN_PROFILE.clinic;
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

  const [openMenu, setOpenMenu] = useState(null); // 'search' | 'alerts' | 'profile'
  const [searchQuery, setSearchQuery] = useState('');
  const navRef = useRef(null);
  const searchInputRef = useRef(null);

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

  useEffect(() => {
    if (openMenu === 'search') {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [openMenu]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchedMothers = trimmedQuery
    ? mothers
        .filter(
          (m) =>
            m.id.toLowerCase().includes(trimmedQuery) ||
            m.name.toLowerCase().includes(trimmedQuery) ||
            m.reasonForReview?.toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 5)
    : mothers.slice(0, 4);

  const matchedScreenings = trimmedQuery
    ? screenings
        .filter(
          (s) =>
            s.motherId?.toLowerCase().includes(trimmedQuery) ||
            s.id?.toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 3)
    : [];

  const matchedPath = Object.keys(BREADCRUMB_MAP).find((p) =>
    location.pathname.startsWith(p)
  );
  const currentPageTitle = matchedPath ? BREADCRUMB_MAP[matchedPath] : 'Mothers & Cases';

  return (
    <header className="dash-topnav" ref={navRef}>
      <div className="dash-topnav-inner">
        {/* Left: Hamburger (mobile) + Breadcrumbs */}
        <div className="dash-header-left">
          <button
            type="button"
            className="dash-top-hamburger"
            aria-label="Toggle navigation menu"
            onClick={onToggleMobileNav}
          >
            <DashboardIcon name="menu" size={20} />
          </button>

          <nav className="dash-header-breadcrumb" aria-label="Breadcrumb">
            <span className="dash-breadcrumb-root">AANCHAL Clinical</span>
            <span className="dash-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="dash-breadcrumb-current">{currentPageTitle}</span>
          </nav>
        </div>

        {/* Right: Search, Assistant, Notifications, Profile */}
        <div className="dash-nav-utilities">
          <div className="dash-utility-wrap">
            <button
              type="button"
              className={`dash-icon-btn ${openMenu === 'assistant' ? 'is-open' : ''}`}
              aria-label="Clinician AI Assistant"
              aria-expanded={openMenu === 'assistant'}
              onClick={() => setOpenMenu((prev) => (prev === 'assistant' ? null : 'assistant'))}
              title="AANCHAL Clinical Copilot"
            >
              <DashboardIcon name="sparkle" size={17} strokeWidth={1.8} />
            </button>

            {openMenu === 'assistant' && (
              <DoctorAssistantPopover onClose={() => setOpenMenu(null)} />
            )}
          </div>

          <div className="dash-utility-wrap">
            <button
              type="button"
              className={`dash-icon-btn ${openMenu === 'search' ? 'is-open' : ''}`}
              aria-label="Search mothers and screenings"
              aria-expanded={openMenu === 'search'}
              onClick={() => setOpenMenu((prev) => (prev === 'search' ? null : 'search'))}
            >
              <DashboardIcon name="search" size={18} strokeWidth={1.8} />
            </button>

            {openMenu === 'search' && (
              <div className="dash-popover dash-search-popover" role="dialog" aria-label="Quick search">
                <div className="dash-search-input-row">
                  <DashboardIcon name="search" size={16} />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Mother ID (e.g. M-104) or cue..."
                    aria-label="Search Mother ID or clinical cue"
                  />
                </div>
                <div className="dash-popover-section">
                  <div className="dash-popover-label">Mothers &amp; Cases</div>
                  {matchedMothers.length > 0 ? (
                    matchedMothers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="dash-search-result"
                        onClick={() => {
                          setOpenMenu(null);
                          setSearchQuery('');
                          navigate(`/mothers/${m.id}`);
                        }}
                      >
                        <div>
                          <strong>{m.id}</strong> · {m.name} <span>(Week {m.postpartumWeek})</span>
                        </div>
                        <RiskBadge risk={m.risk} />
                      </button>
                    ))
                  ) : (
                    <p className="dash-popover-empty">No matching mothers found.</p>
                  )}
                </div>
                {matchedScreenings.length > 0 && (
                  <div className="dash-popover-section">
                    <div className="dash-popover-label">Recent Screenings</div>
                    {matchedScreenings.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="dash-search-result"
                        onClick={() => {
                          setOpenMenu(null);
                          setSearchQuery('');
                          navigate(`/results/${s.motherId}`);
                        }}
                      >
                        <div>
                          <strong>{s.id}</strong> · {s.motherId} <span>({s.completedAgo})</span>
                        </div>
                        <StatusBadge status={s.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="dash-utility-wrap">
            <button
              type="button"
              className={`dash-icon-btn dash-bell-btn ${openMenu === 'alerts' ? 'is-open' : ''}`}
              aria-label={`Notifications (${alerts.length} clinical alerts)`}
              aria-expanded={openMenu === 'alerts'}
              onClick={() => setOpenMenu((prev) => (prev === 'alerts' ? null : 'alerts'))}
            >
              <DashboardIcon name="bell" size={18} strokeWidth={1.8} />
              {alerts.length > 0 && <span className="dash-bell-dot" aria-hidden="true" />}
            </button>

            {openMenu === 'alerts' && (
              <div className="dash-popover dash-alerts-popover" role="dialog" aria-label="Clinical alerts">
                <div className="dash-popover-header">
                  <span>Clinical Notifications</span>
                  <span className="dash-popover-count">{alerts.length} active</span>
                </div>
                <div className="dash-alerts-list">
                  {alerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      className="dash-alert-item"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate(`/mothers/${alert.motherId}`);
                      }}
                    >
                      <span className={`dash-alert-dot severity-${alert.severity}`} aria-hidden="true" />
                      <div className="dash-alert-copy">
                        <p>{alert.title}</p>
                        <span>{alert.time}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dash-utility-wrap">
            <button
              type="button"
              className="dash-avatar-btn"
              aria-label="Clinician profile menu"
              aria-expanded={openMenu === 'profile'}
              onClick={() => setOpenMenu((prev) => (prev === 'profile' ? null : 'profile'))}
            >
              {clinicianInitials}
            </button>

            {openMenu === 'profile' && (
              <div className="dash-popover dash-profile-popover" role="dialog" aria-label="Clinician profile">
                <div className="dash-profile-meta">
                  <strong>{clinicianName}</strong>
                  <span>{clinicianRole}</span>
                  <small>{clinicianClinic}</small>
                  {isLiveSynced && (
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
                      PostgreSQL Backend Connected
                    </span>
                  )}
                </div>
                <div className="dash-profile-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      navigate('/insights');
                    }}
                  >
                    Care &amp; Practice Insights
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      navigate('/patient/dashboard');
                    }}
                  >
                    Switch to Patient Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      navigate('/');
                    }}
                  >
                    View AANCHAL Landing Page
                  </button>
                  <button
                    type="button"
                    style={{ color: '#c73566', fontWeight: '500' }}
                    onClick={() => {
                      setOpenMenu(null);
                      navigate('/login');
                    }}
                  >
                    Sign Out
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

