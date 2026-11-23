import React from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { PatientIcon } from '../components/PatientIcons.jsx';
import { AiScreeningTab } from '../components/screening/AiScreeningTab.jsx';
import { PsychosocialTab } from '../components/screening/PsychosocialTab.jsx';
import { EpdsTab } from '../components/screening/EpdsTab.jsx';
import { ResultsReportsTab } from '../components/screening/ResultsReportsTab.jsx';
import './screening.css';
import '../components/screening/screeningStyles.css';

export function PatientScreeningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');

  // Normalize tab to exactly one of: 'ai-screening' | 'psychosocial' | 'epds' | 'results'
  const activeTab =
    rawTab === 'psychosocial' || rawTab === 'wellbeing'
      ? 'psychosocial'
      : rawTab === 'epds'
      ? 'epds'
      : rawTab === 'results' || rawTab === 'reports' || rawTab === 'results-reports'
      ? 'results'
      : 'ai-screening';

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  return (
    <div className="screening-workspace-shell" aria-label="AANCHAL Maternal Screening Workspace">
      {/* Breadcrumb Bar */}
      <div className="screening-breadcrumb">
        <NavLink to="/patient/dashboard" className="screening-breadcrumb-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
            <path d="M9.5 21v-7h5v7" />
          </svg>
          <span>Home</span>
        </NavLink>
        <span className="screening-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="screening-breadcrumb-current">AI Screening Session</span>
      </div>

      {/* Hero Header Box with Page Heading & 4-Stage Progress Tracker */}
      <div className="patient-hero-box screening-hero-box" style={{ marginBottom: '20px' }}>
        <div className="patient-hero-box-text">
          <div className="miora-dash-eyebrow">
            <span>AI SCREENING</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          {activeTab === 'results' ? (
            <h1 className="miora-dash-title patient-page-heading screening-page-title">
              Results &amp; <em>Reports</em>
            </h1>
          ) : (
            <h1 className="miora-dash-title patient-page-heading screening-page-title">
              AI Screening <em>Session</em>
            </h1>
          )}
          <p className="miora-dash-subtitle patient-page-subheading screening-page-sub">
            A private, conversational screening to understand your emotional well-being after childbirth.
          </p>
        </div>

        {/* 4-Stage Progress Tracker */}
        <div className="screening-stages-tracker" aria-label="Screening progress stages">
          <NavLink to="/patient/medical-history" className="tracker-stage is-completed">
            <div className="tracker-circle">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
              </svg>
            </div>
            <span className="tracker-label">Patient Details</span>
          </NavLink>

          <div className="tracker-line is-active-line" aria-hidden="true" />

          <div className={`tracker-stage ${activeTab === 'ai-screening' ? 'is-active' : 'is-completed'}`}>
            <div className="tracker-circle">
              <span className="tracker-inner-dot" />
            </div>
            <span className="tracker-label">Screening</span>
          </div>

          <div className="tracker-line" aria-hidden="true" />

          <div className={`tracker-stage ${activeTab === 'epds' ? 'is-active' : activeTab === 'results' ? 'is-completed' : 'is-upcoming'}`}>
            <div className="tracker-circle" />
            <span className="tracker-label">Analysis</span>
          </div>

          <div className="tracker-line" aria-hidden="true" />

          <div className={`tracker-stage ${activeTab === 'results' ? 'is-active' : 'is-upcoming'}`}>
            <div className="tracker-circle" />
            <span className="tracker-label">Results</span>
          </div>
        </div>
      </div>

      {/* Exactly 4 Screening Tabs */}
      <div className="screening-tab-nav" role="tablist" aria-label="Screening sections">
        <button
          type="button"
          role="tab"
          id="tab-ai-screening"
          aria-selected={activeTab === 'ai-screening'}
          className={`screening-tab-nav-btn ${activeTab === 'ai-screening' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('ai-screening')}
        >
          <PatientIcon name="video" size={16} />
          <span>AI Screening</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-psychosocial"
          aria-selected={activeTab === 'psychosocial'}
          className={`screening-tab-nav-btn ${activeTab === 'psychosocial' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('psychosocial')}
        >
          <PatientIcon name="heart" size={16} />
          <span>Wellbeing &amp; Support (Stage 2)</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-epds"
          aria-selected={activeTab === 'epds'}
          className={`screening-tab-nav-btn ${activeTab === 'epds' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('epds')}
        >
          <PatientIcon name="reports" size={16} />
          <span>EPDS</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-results"
          aria-selected={activeTab === 'results'}
          className={`screening-tab-nav-btn ${activeTab === 'results' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('results')}
        >
          <PatientIcon name="sparkles" size={16} />
          <span>Results &amp; Reports</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="screening-tab-content-area" role="tabpanel">
        {activeTab === 'ai-screening' && (
          <AiScreeningTab onContinueToEpds={() => handleTabChange('psychosocial')} />
        )}

        {activeTab === 'psychosocial' && (
          <PsychosocialTab onContinueToEpds={() => handleTabChange('epds')} />
        )}

        {activeTab === 'epds' && (
          <EpdsTab onCompleted={() => handleTabChange('results')} />
        )}

        {activeTab === 'results' && (
          <ResultsReportsTab
            onTakeAiScreening={() => handleTabChange('ai-screening')}
            onTakeEpds={() => handleTabChange('epds')}
          />
        )}
      </div>
    </div>
  );
}

export default PatientScreeningPage;