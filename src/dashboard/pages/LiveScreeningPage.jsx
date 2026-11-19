import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import { DoctorAiScreeningTab } from '../components/screening/DoctorAiScreeningTab.jsx';
import { DoctorEpdsTab } from '../components/screening/DoctorEpdsTab.jsx';
import { DoctorResultsReportsTab } from '../components/screening/DoctorResultsReportsTab.jsx';
import '../components/screening/doctorScreeningStyles.css';

/**
 * Clinician Screening Oversight & Review
 * Displays submitted patient AI Screening, EPDS, and Clinical Reports directly.
 * Clinician does not conduct or start live screenings; all screenings are completed by patients.
 */
export function LiveScreeningPage() {
  const { mothers } = useClinicalData();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultMotherId = useMemo(() => {
    const paramId = searchParams.get('mother');
    if (paramId && mothers.some((m) => m.id === paramId)) return paramId;
    if (mothers.some((m) => m.id === 'M-108')) return 'M-108';
    return mothers[0]?.id || 'M-104';
  }, [mothers, searchParams]);

  const [motherId] = useState(defaultMotherId);
  const activeMother = useMemo(
    () => mothers.find((m) => m.id === motherId) || mothers[0],
    [mothers, motherId]
  );

  const rawTab = searchParams.get('tab');
  const screeningTab =
    rawTab === 'epds'
      ? 'epds'
      : rawTab === 'results' || rawTab === 'reports' || rawTab === 'results-reports'
      ? 'results'
      : 'ai-screening';

  const handleTabChange = (nextTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams);
  };

  return (
    <div className="miora-command-shell">
      <div className="miora-command-frame">
        {/* Subtle Flowing Blush Header Waves */}
        <svg
          className="miora-header-ribbon miora-mothers-ribbon"
          viewBox="0 0 640 160"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="liveWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbdbe2" stopOpacity="0" />
              <stop offset="50%" stopColor="#f8c9d5" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#fce8ec" stopOpacity="0.16" />
            </linearGradient>
          </defs>
          <path
            d="M0 135 C 150 128, 225 42, 395 48 C 515 52, 565 88, 640 24 L 640 160 L 0 160 Z"
            fill="url(#liveWaveGrad)"
          />
        </svg>

        {/* Page Header (Clinician Review Mode — No Live Recording Controls or Session Timers) */}
        <section className="miora-dash-header" aria-labelledby="live-screening-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>PATIENT SCREENING REVIEW</span>
              <span className="miora-dash-eyebrow-line" aria-hidden="true" />
            </div>
            <h1 id="live-screening-heading" className="miora-dash-title">
              Maternal Screening <em>Review</em>
            </h1>
            <p className="miora-dash-subtitle">
              Review completed patient AI Multimodal Screenings, Edinburgh Postnatal Depression Scale (EPDS) assessments, and clinical reports.
            </p>
          </div>
        </section>

        {/* Exactly 3 Common Screening Tabs */}
        <div className="screening-tab-nav" role="tablist" aria-label="Screening sections" style={{ marginBottom: 20 }}>
          <button
            type="button"
            role="tab"
            id="tab-doc-ai-screening"
            aria-selected={screeningTab === 'ai-screening'}
            className={`screening-tab-nav-btn ${screeningTab === 'ai-screening' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('ai-screening')}
          >
            <DashboardIcon name="video" size={16} />
            <span>AI Screening</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-doc-epds"
            aria-selected={screeningTab === 'epds'}
            className={`screening-tab-nav-btn ${screeningTab === 'epds' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('epds')}
          >
            <DashboardIcon name="document" size={16} />
            <span>EPDS</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-doc-results"
            aria-selected={screeningTab === 'results'}
            className={`screening-tab-nav-btn ${screeningTab === 'results' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('results')}
          >
            <DashboardIcon name="sparkle" size={16} />
            <span>Results &amp; Reports</span>
          </button>
        </div>

        {/* Directly render patient screening results */}
        {screeningTab === 'ai-screening' && (
          <DoctorAiScreeningTab defaultMotherId={activeMother?.id} />
        )}

        {screeningTab === 'epds' && (
          <DoctorEpdsTab defaultMotherId={activeMother?.id} />
        )}

        {screeningTab === 'results' && (
          <DoctorResultsReportsTab defaultMotherId={activeMother?.id} />
        )}
      </div>
    </div>
  );
}

export default LiveScreeningPage;
