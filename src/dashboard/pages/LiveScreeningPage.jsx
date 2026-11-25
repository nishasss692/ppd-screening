import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import { AiScreeningTab } from '../../patient/components/screening/AiScreeningTab.jsx';
import { PsychosocialTab } from '../../patient/components/screening/PsychosocialTab.jsx';
import { EpdsTab } from '../../patient/components/screening/EpdsTab.jsx';
import { ResultsReportsTab } from '../../patient/components/screening/ResultsReportsTab.jsx';
import { DoctorAiScreeningTab } from '../components/screening/DoctorAiScreeningTab.jsx';
import { DoctorEpdsTab } from '../components/screening/DoctorEpdsTab.jsx';
import { DoctorResultsReportsTab } from '../components/screening/DoctorResultsReportsTab.jsx';
import '../../patient/components/screening/screeningStyles.css';
import '../components/screening/doctorScreeningStyles.css';

/**
 * Clinic & Doctor Screening Workspace
 * Supports both:
 * 1. In-Clinic Patient Screening (identical 4-stage workflow to Patient Dashboard so walk-in patients can complete screening at the clinic)
 * 2. Cohort Review (inspect submitted AI Screening, EPDS, and Clinical Results across patients)
 */
export function LiveScreeningPage() {
  const { mothers, refreshBackendData } = useClinicalData();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultMotherId = useMemo(() => {
    const paramId = searchParams.get('mother');
    if (paramId && mothers.some((m) => m.id === paramId)) return paramId;
    if (mothers.some((m) => m.id === 'M-104')) return 'M-104';
    if (mothers.some((m) => m.id === 'M-108')) return 'M-108';
    return mothers[0]?.id || 'M-104';
  }, [mothers, searchParams]);

  const [selectedMotherId, setSelectedMotherId] = useState(defaultMotherId);
  const [viewMode, setViewMode] = useState(() =>
    searchParams.get('mode') === 'review' ? 'review' : 'in-clinic'
  );

  const activeMother = useMemo(
    () => mothers.find((m) => m.id === selectedMotherId) || mothers[0] || null,
    [mothers, selectedMotherId]
  );

  const rawTab = searchParams.get('tab');
  const screeningTab =
    rawTab === 'psychosocial' || rawTab === 'wellbeing'
      ? 'psychosocial'
      : rawTab === 'epds'
        ? 'epds'
        : rawTab === 'results' || rawTab === 'reports' || rawTab === 'results-reports'
          ? 'results'
          : 'ai-screening';

  const handleTabChange = (nextTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams);
  };

  const handleModeChange = (nextMode) => {
    setViewMode(nextMode);
    if (nextMode === 'review' && screeningTab === 'psychosocial') {
      handleTabChange('ai-screening');
    }
  };

  return (
    <div className="miora-command-shell">
      <div className="miora-command-frame">
        {/* Page Header with In-Clinic Screening vs Cohort Review Switcher */}
        <section className="miora-dash-header" aria-labelledby="live-screening-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>{viewMode === 'in-clinic' ? 'IN-CLINIC PATIENT SCREENING' : 'PATIENT SCREENING REVIEW'}</span>
            </div>
            <h1 id="live-screening-heading" className="miora-dash-title">
              Maternal Screening Session
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap', flexShrink: 0 }}>
            {viewMode === 'in-clinic' && mothers.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#5c4750', fontWeight: 600 }}>
                <span>Patient:</span>
                <select
                  aria-label="Select patient for in-clinic screening"
                  value={activeMother?.id || ''}
                  onChange={(e) => setSelectedMotherId(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e7d8de',
                    background: '#fff',
                    color: '#2b1b22',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {mothers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div
              role="group"
              aria-label="Screening workspace mode"
              style={{
                display: 'inline-flex',
                background: '#f7eef1',
                padding: '4px',
                borderRadius: '10px',
                border: '1px solid #ead8df',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => handleModeChange('in-clinic')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: viewMode === 'in-clinic' ? '#ba1e53' : 'transparent',
                  color: viewMode === 'in-clinic' ? '#fff' : '#66535c',
                }}
              >
                In-Clinic Screening
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('review')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: viewMode === 'review' ? '#ba1e53' : 'transparent',
                  color: viewMode === 'review' ? '#fff' : '#66535c',
                }}
              >
                Cohort Review
              </button>
            </div>
          </div>
        </section>

        {viewMode === 'in-clinic' ? (
          <div className="screening-workspace-shell" style={{ padding: 0 }}>
            {/* Exact Same 4-Tab Patient Screening Workflow */}
            <div className="screening-tab-nav" role="tablist" aria-label="Screening sections" style={{ marginBottom: 20 }}>
              <button
                type="button"
                role="tab"
                id="tab-doc-ai-screening"
                aria-selected={screeningTab === 'ai-screening'}
                className={`screening-tab-nav-btn ${screeningTab === 'ai-screening' ? 'is-active' : ''}`}
                onClick={() => handleTabChange('ai-screening')}
              >
                <span>AI Screening</span>
              </button>

              <button
                type="button"
                role="tab"
                id="tab-doc-psychosocial"
                aria-selected={screeningTab === 'psychosocial'}
                className={`screening-tab-nav-btn ${screeningTab === 'psychosocial' ? 'is-active' : ''}`}
                onClick={() => handleTabChange('psychosocial')}
              >
                <span>Wellbeing &amp; Support</span>
              </button>

              <button
                type="button"
                role="tab"
                id="tab-doc-epds"
                aria-selected={screeningTab === 'epds'}
                className={`screening-tab-nav-btn ${screeningTab === 'epds' ? 'is-active' : ''}`}
                onClick={() => handleTabChange('epds')}
              >
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
                <span>Results &amp; Reports</span>
              </button>
            </div>

            {screeningTab === 'ai-screening' && (
              <AiScreeningTab
                inClinicMotherId={activeMother?.rawUuid || activeMother?.id}
                onContinueToEpds={() => handleTabChange('psychosocial')}
              />
            )}

            {screeningTab === 'psychosocial' && (
              <PsychosocialTab onContinueToEpds={() => handleTabChange('epds')} />
            )}

            {screeningTab === 'epds' && (
              <EpdsTab
                inClinicMotherUuid={activeMother?.rawUuid || null}
                onScreeningPersisted={() => {
                  if (refreshBackendData) refreshBackendData();
                }}
                onCompleted={() => {
                  if (refreshBackendData) refreshBackendData();
                  handleTabChange('results');
                }}
              />
            )}

            {screeningTab === 'results' && (
              <ResultsReportsTab
                onTakeAiScreening={() => handleTabChange('ai-screening')}
                onTakeEpds={() => handleTabChange('epds')}
              />
            )}
          </div>
        ) : (
          <>
            {/* Submitted Cohort Review Tabs */}
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

            {screeningTab === 'ai-screening' && (
              <DoctorAiScreeningTab defaultMotherId={activeMother?.id} />
            )}

            {screeningTab === 'epds' && (
              <DoctorEpdsTab defaultMotherId={activeMother?.id} />
            )}

            {screeningTab === 'results' && (
              <DoctorResultsReportsTab defaultMotherId={activeMother?.id} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LiveScreeningPage;
