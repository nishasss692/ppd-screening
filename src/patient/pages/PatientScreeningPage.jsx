import React from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { PatientIcon } from '../components/PatientIcons.jsx';
import { AiScreeningTab } from '../components/screening/AiScreeningTab.jsx';
import { EpdsTab } from '../components/screening/EpdsTab.jsx';
import { ResultsReportsTab } from '../components/screening/ResultsReportsTab.jsx';
import '../components/screening/screeningStyles.css';

export function PatientScreeningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');

  // Normalize tab to exactly one of: 'ai-screening' | 'epds' | 'results'
  const activeTab =
    rawTab === 'epds'
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
        <span className="screening-breadcrumb-current">
          {activeTab === 'ai-screening' ? 'AI Screening' : activeTab === 'epds' ? 'EPDS' : 'Results & Reports'}
        </span>
      </div>

      {/* Exactly 3 Unified Screening Tabs */}
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
          <AiScreeningTab onContinueToEpds={() => handleTabChange('epds')} />
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