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
        {/* Page Header (Clinician Review Mode — No Live Recording Controls or Session Timers) */}
        <section className="miora-dash-header" aria-labelledby="live-screening-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>PATIENT SCREENING REVIEW</span>
            </div>
            <h1 id="live-screening-heading" className="miora-dash-title">
              Maternal Screening Review
            </h1>
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
