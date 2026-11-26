import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import { RiskBadge } from '../components/Badges.jsx';
import {
  ModalityAnalysisCard,
  OverallRiskCard,
  RiskTrendCard,
} from '../components/ResultsChartsAndVisuals.jsx';
import {
  ExportReportModal,
  ShareCaseModal,
} from '../components/ResultsModals.jsx';

export function ResultsPage() {
  const {
    mothers,
    screenings,
    shareCaseHandoff,
  } = useClinicalData();
  const { motherId } = useParams();
  const navigate = useNavigate();

  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  const activeScreening = useMemo(() => {
    if (motherId) {
      const match = screenings.find(
        (s) =>
          (s.motherId && s.motherId.toLowerCase() === motherId.toLowerCase()) ||
          (s.rawMotherUuid && s.rawMotherUuid.toLowerCase() === motherId.toLowerCase()) ||
          (s.motherName && s.motherName.toLowerCase() === motherId.toLowerCase())
      );
      if (match) return match;
    }
    return screenings.find((s) => s.motherId === 'M-108') || screenings[0] || null;
  }, [screenings, motherId]);

  const activeMother = useMemo(() => {
    if (motherId) {
      const directMatch = mothers.find(
        (m) =>
          (m.id && m.id.toLowerCase() === motherId.toLowerCase()) ||
          (m.rawUuid && m.rawUuid.toLowerCase() === motherId.toLowerCase()) ||
          (m.name && m.name.toLowerCase() === motherId.toLowerCase())
      );
      if (directMatch) return directMatch;
    }
    if (!activeScreening) return null;
    return (
      mothers.find(
        (m) =>
          m.id === activeScreening.motherId ||
          (m.rawUuid && activeScreening.rawMotherUuid && m.rawUuid === activeScreening.rawMotherUuid)
      ) || null
    );
  }, [mothers, activeScreening, motherId]);

  const handleSelectSession = (nextMotherId) => {
    setActionFeedback('');
    navigate(`/results/${nextMotherId}`);
  };

  if (motherId && !activeScreening) {
    return (
      <div className="miora-command-shell">
        <div className="miora-command-frame">
          <section className="miora-card miora-results-empty-state">
            <h2>Screening Record Not Found</h2>
            <p className="sr-only">Discordance Record Not Found</p>
            <p>
              No completed or pending screening record was found for Mother ID{' '}
              <strong>{motherId}</strong>.
            </p>
            <div className="miora-modal-actions">
              <button
                type="button"
                className="miora-btn-secondary"
                onClick={() => navigate('/mothers')}
              >
                Open Mothers &amp; Cases
              </button>
              <button
                type="button"
                className="miora-cta-primary"
                onClick={() => navigate('/results')}
              >
                View Latest Results
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const isCompleted = activeScreening?.status === 'Completed';

  return (
    <div className="miora-command-shell">
      <div className="miora-command-frame">
        {/* Page Header */}
        <section className="miora-dash-header" aria-labelledby="results-page-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>SCREENING RESULTS</span>
              <span className="miora-dash-eyebrow-line" aria-hidden="true" />
            </div>
            <h1 id="results-page-heading" className="miora-dash-title">
              Maternal Screening <em>Results</em>
            </h1>
          </div>

          <div className="miora-results-header-actions">
            <button
              type="button"
              className="miora-btn-secondary"
              onClick={() => setExportOpen(true)}
            >
              <DashboardIcon name="download" size={15} />
              <span>Export Report</span>
            </button>
            <button
              type="button"
              className="miora-btn-secondary"
              onClick={() => setShareOpen(true)}
            >
              <DashboardIcon name="share" size={15} />
              <span>Share Case</span>
            </button>
          </div>
        </section>

        {/* Empty State when no screening is available */}
        {!activeScreening && (
          <section className="miora-card" style={{ padding: '48px 24px', textAlign: 'center', marginTop: '16px' }}>
            <DashboardIcon name="layers" size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>No Screening Results Available</h3>
            <p style={{ margin: 0, color: 'var(--miora-muted)', fontSize: '14px' }}>
              Complete a screening session in Live Screening or Upload &amp; Analyze to review detailed multimodal clinical results.
            </p>
          </section>
        )}

        {/* Patient Information Strip */}
        {activeScreening && (
          <section className="miora-card miora-patient-strip" aria-label="Screening session summary">
            <div className="miora-patient-item">
              <span className="miora-patient-icon" aria-hidden="true">
                <DashboardIcon name="user" size={18} />
              </span>
              <div className="miora-patient-meta">
                <div className="miora-patient-select-row">
                  <label htmlFor="results-session-select" className="sr-only">
                    Select screening session
                  </label>
                  <label htmlFor="results-session-select" className="sr-only">
                    Select mother for discordance analysis
                  </label>
                  <select
                    id="results-session-select"
                    className="miora-patient-id-select"
                    value={activeScreening.motherId}
                    onChange={(e) => handleSelectSession(e.target.value)}
                  >
                    {screenings.map((s) => (
                      <option key={s.id} value={s.motherId}>
                        {s.motherId}
                      </option>
                    ))}
                  </select>
                  <Link
                    to={`/mothers/${activeScreening.motherId}`}
                    className="miora-disc-record-link"
                    title={`Open Mother Record ${activeScreening.motherId}`}
                  >
                    <span>Record</span>
                    <DashboardIcon name="externalLink" size={12} />
                  </Link>
                </div>
                <span className="miora-patient-sub">
                  {activeScreening.motherInitials || activeMother?.initials || '—'}
                </span>
              </div>
            </div>

            <span className="miora-patient-divider" aria-hidden="true" />

            <div className="miora-patient-item">
              <span className="miora-patient-icon is-plain" aria-hidden="true">
                <DashboardIcon name="calendar" size={18} />
              </span>
              <div className="miora-patient-meta">
                <span className="miora-patient-label">Postpartum Week</span>
                <strong>Week {activeScreening.postpartumWeek}</strong>
              </div>
            </div>

            <span className="miora-patient-divider" aria-hidden="true" />

            <div className="miora-patient-item">
              <span className="miora-patient-icon is-plain" aria-hidden="true">
                <DashboardIcon name="layers" size={18} />
              </span>
              <div className="miora-patient-meta">
                <span className="miora-patient-label">Screening Type</span>
                <strong>{activeScreening.modality}</strong>
              </div>
            </div>

            <span className="miora-patient-divider" aria-hidden="true" />

            <div className="miora-patient-item">
              <span className="miora-patient-icon is-plain" aria-hidden="true">
                <DashboardIcon name="clock" size={18} />
              </span>
              <div className="miora-patient-meta">
                <span className="miora-patient-label">Screening Date</span>
                <strong>{activeScreening.screeningDateTime || activeScreening.completedAgo}</strong>
              </div>
            </div>
          </section>
        )}

        {/* Row 1: Overall Risk Assessment | Modality-wise Analysis */}
        {/* EPDS Question 10 Deterministic Crisis Alert Banner */}
        {Boolean(
          activeScreening?.q10SafetyAlert?.triggered ||
          activeScreening?.q10_safety_alert?.triggered
        ) && (
            <div
              className="miora-card miora-crisis-alert-banner"
              role="alert"
              style={{
                background: '#fff1f2',
                border: '2px solid #e11d48',
                borderRadius: '12px',
                padding: '16px 20px',
                marginTop: '16px',
                marginBottom: '16px',
                color: '#9f1239',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <DashboardIcon
                  name="alertTriangle"
                  size={24}
                  style={{ color: '#e11d48', flexShrink: 0 }}
                />
                <div>
                  <strong
                    style={{
                      fontSize: '15px',
                      color: '#881337',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    URGENT CRISIS ALERT: EPDS Question 10 Positive (Thoughts of Self-Harm)
                  </strong>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45 }}>
                    Deterministic safety rule: Crisis alerts can never be overridden by AI predictions.
                    Initiate immediate clinical safety assessment and connect with Tele-MANAS at
                    <strong> 14416 </strong> or <strong> 1800-891-4416</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* Row 1: Overall Risk Assessment | Modality-wise Analysis | Multimodal Summary */}
        {activeScreening && (
          <div className="miora-results-row-2">
            <OverallRiskCard screening={activeScreening} />
            <ModalityAnalysisCard modalities={activeScreening.modalities} />
          </div>
        )}

        {/* Row 2: Risk Trend | Key Contributing Factors | Interpretation */}
        {activeScreening && (
          <div className="miora-results-row-3">
            <RiskTrendCard history={activeScreening.riskHistory} />

            {/* Key Contributing Factors */}
            <section
              className="miora-card miora-results-card"
              aria-labelledby="contributing-factors-title"
            >
              <div className="miora-card-header">
                <div className="miora-card-title-group">
                  <span className="miora-card-icon" aria-hidden="true">
                    <DashboardIcon name="leaf" size={20} strokeWidth={1.65} />
                  </span>
                  <h2 id="contributing-factors-title" className="miora-card-title">
                    Key Contributing Factors
                  </h2>
                </div>
              </div>

              {activeScreening.contributingFactors?.length > 0 ? (
                <ul className="miora-factors-list">
                  {activeScreening.contributingFactors.map((factor) => (
                    <li key={factor.id} className="miora-factor-row">
                      <span className="miora-factor-icon" aria-hidden="true">
                        <DashboardIcon name={factor.icon || 'alertTriangle'} size={16} />
                      </span>
                      <span className="miora-factor-text">{factor.text}</span>
                      <RiskBadge risk={factor.severity} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="miora-trend-empty">
                  <p>No contributing factor outputs were generated for this session.</p>
                </div>
              )}
            </section>

            {/* Interpretation */}
            <section
              className="miora-card miora-results-card"
              aria-labelledby="interpretation-title"
            >
              <div className="miora-card-header">
                <div className="miora-card-title-group">
                  <span className="miora-card-icon" aria-hidden="true">
                    <DashboardIcon name="fileText" size={19} strokeWidth={1.65} />
                  </span>
                  <h2 id="interpretation-title" className="miora-card-title">
                    Interpretation
                  </h2>
                </div>
              </div>

              <ul className="miora-interpretation-list">
                {(activeScreening.interpretation || [activeScreening.summary]).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {actionFeedback && (
          <div className="miora-live-feedback-row miora-results-feedback" style={{ marginTop: '16px' }}>
            <div className="miora-draft-pill" role="status">
              <DashboardIcon name="check" size={14} />
              <span>{actionFeedback}</span>
            </div>
          </div>
        )}
      </div>

      <ExportReportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        screening={activeScreening}
        mother={activeMother}
      />

      <ShareCaseModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        screening={activeScreening}
        onShare={shareCaseHandoff}
      />
    </div>
  );
}
