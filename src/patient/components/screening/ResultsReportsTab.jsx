import React, { useState, useEffect } from 'react';
import { PatientIcon } from '../PatientIcons.jsx';
import { usePatient } from '../../context/PatientContext.jsx';

export function ResultsReportsTab({ onTakeAiScreening, onTakeEpds }) {
  const { patient, screening, downloadReport, downloadToast } = usePatient();

  const [storedAiSession, setStoredAiSession] = useState(null);
  const [storedEpds, setStoredEpds] = useState(null);

  useEffect(() => {
    try {
      const rawAi = localStorage.getItem('aanchal_ai_screening_status');
      if (rawAi) setStoredAiSession(JSON.parse(rawAi));
    } catch (e) {}

    try {
      const rawEpds = localStorage.getItem('aanchal_submitted_epds_assessment');
      if (rawEpds) setStoredEpds(JSON.parse(rawEpds));
    } catch (e) {}
  }, []);

  const hasEpds = Boolean(storedEpds || screening?.summary?.totalScore !== undefined);
  const epdsScore = storedEpds ? storedEpds.totalScore : screening?.summary?.totalScore ?? null;
  const epdsSubmittedDate = storedEpds
    ? new Date(storedEpds.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : screening?.summary?.screeningDate || 'Recent';

  const hasAiSession = Boolean(storedAiSession?.hasRecording);

  return (
    <div className="aanchal-results-reports-shell" aria-label="Results and Reports Summary">
      {/* Overview Banner */}
      <section className="patient-card results-overview-card">
        <div className="miora-dash-eyebrow">
          <span>MATERNAL ASSESSMENT PORTFOLIO</span>
          <span className="miora-dash-eyebrow-line" aria-hidden="true" />
        </div>
        <h2 className="patient-page-heading" style={{ fontSize: '20px' }}>Assessment Portfolio Overview</h2>
        <p className="patient-page-subheading">
          Unified overview of your multimodal AI screening, Edinburgh Postnatal Depression Scale (EPDS) score,
          and clinical care summaries.
        </p>
      </section>

      {/* Grid of Assessments */}
      <div className="results-two-col-grid">
        {/* Card 1: AI Screening Results */}
        <section className="patient-card result-panel-card" aria-label="AI Screening Results">
          <div className="result-panel-header">
            <div className="result-panel-title-wrap">
              <div className="result-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                <PatientIcon name="video" size={20} />
              </div>
              <div>
                <h2 className="result-panel-title">AI Screening Results</h2>
                <span className="result-panel-sub">Acoustic, visual, and linguistic modalities</span>
              </div>
            </div>

            <span className={`result-status-badge ${hasAiSession ? 'is-completed' : 'is-pending'}`}>
              {hasAiSession ? 'Session Recorded' : 'Pending Recording'}
            </span>
          </div>

          <div className="result-modality-rows">
            <div className="result-modality-row">
              <div className="modality-row-label">
                <PatientIcon name="mic" size={15} />
                <strong>Audio Analysis</strong>
              </div>
              <span className="ai-status-pill is-pending">
                <span className="ai-status-dot" />
                <span>Awaiting model integration</span>
              </span>
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <PatientIcon name="video" size={15} />
                <strong>Video Analysis</strong>
              </div>
              <span className="ai-status-pill is-pending">
                <span className="ai-status-dot" />
                <span>Awaiting model integration</span>
              </span>
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <PatientIcon name="sparkles" size={15} />
                <strong>Text Analysis</strong>
              </div>
              <span className="ai-status-pill is-pending">
                <span className="ai-status-dot" />
                <span>Awaiting model integration</span>
              </span>
            </div>

            <div className="result-modality-row is-fusion">
              <div className="modality-row-label">
                <PatientIcon name="ai-assistant" size={15} />
                <strong>Multimodal Fusion</strong>
              </div>
              <span className="ai-status-pill is-pending">
                <span className="ai-status-dot" />
                <span>Awaiting model integration</span>
              </span>
            </div>
          </div>

          <div className="result-panel-actions">
            {!hasAiSession ? (
              <button
                type="button"
                className="patient-btn-secondary"
                onClick={onTakeAiScreening}
              >
                <span>Record AI Screening</span>
                <PatientIcon name="arrow-right" size={15} />
              </button>
            ) : (
              <span className="result-note-text">✓ Video response captured for clinical evaluation</span>
            )}
          </div>
        </section>

        {/* Card 2: EPDS Assessment Score */}
        <section className="patient-card result-panel-card" aria-label="EPDS Score">
          <div className="result-panel-header">
            <div className="result-panel-title-wrap">
              <div className="result-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                <PatientIcon name="reports" size={20} />
              </div>
              <div>
                <h2 className="result-panel-title">EPDS Score</h2>
                <span className="result-panel-sub">Validated 10-item clinical questionnaire</span>
              </div>
            </div>

            <span className={`result-status-badge ${hasEpds ? 'is-completed' : 'is-pending'}`}>
              {hasEpds ? 'Completed' : 'Pending Completion'}
            </span>
          </div>

          {hasEpds ? (
            <div className="epds-result-content">
              <div className="epds-result-score-banner">
                <div className="epds-score-circle">
                  <span className="score-val">{epdsScore}</span>
                  <span className="score-max">/30</span>
                </div>
                <div className="epds-score-meta">
                  <h4>
                    {epdsScore < 10 && 'Low Risk Category'}
                    {epdsScore >= 10 && epdsScore < 13 && 'Mild Distress Category'}
                    {epdsScore >= 13 && 'Elevated Symptoms Category'}
                  </h4>
                  <small>Completed on: {epdsSubmittedDate}</small>
                  {storedEpds?.q10Alert && (
                    <span className="epds-alert-pill">⚠️ Question 10 non-zero response flagged</span>
                  )}
                </div>
              </div>

              <p className="epds-result-expl">
                The Edinburgh Postnatal Depression Scale is a clinical screening instrument (Cox et al. 1987)
                designed to detect symptoms of depression. It does not replace a clinical diagnosis.
              </p>
            </div>
          ) : (
            <div className="result-empty-state">
              <p>No EPDS assessment completed yet for this period.</p>
              <button
                type="button"
                className="patient-btn-primary"
                onClick={onTakeEpds}
              >
                <span>Start EPDS Questionnaire</span>
                <PatientIcon name="arrow-right" size={15} />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Previous Assessments & Available Reports */}
      <section className="patient-card results-reports-table-card" aria-label="Assessment History & Reports">
        <div className="results-table-header">
          <div>
            <h2 className="results-table-title">Assessment History &amp; Reports</h2>
            <p className="results-table-sub">
              Historical records of your completed maternal wellbeing check-ins and clinical summaries.
            </p>
          </div>
        </div>

        {downloadToast && (
          <div className="patient-notice-banner is-success" role="status" style={{ marginBottom: 16 }}>
            {downloadToast}
          </div>
        )}

        <div className="results-table-container">
          <table className="results-summary-table">
            <thead>
              <tr>
                <th>Assessment Date</th>
                <th>Type</th>
                <th>EPDS Score</th>
                <th>AI Multimodal Status</th>
                <th>Clinical Action</th>
              </tr>
            </thead>
            <tbody>
              {hasEpds ? (
                <tr>
                  <td>
                    <strong>{epdsSubmittedDate}</strong>
                    <br />
                    <small>Week {patient?.postpartumWeek || 4} Postpartum</small>
                  </td>
                  <td>Sequential EPDS (10 items)</td>
                  <td>
                    <span className="epds-table-score-badge">
                      {epdsScore} / 30
                    </span>
                  </td>
                  <td>
                    <span className="ai-status-pill is-pending">
                      <span className="ai-status-dot" />
                      <span>Awaiting model integration</span>
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="patient-btn-table-action"
                      onClick={() => downloadReport && downloadReport('screening-report-pdf')}
                    >
                      <PatientIcon name="download" size={14} />
                      <span>Download Summary PDF</span>
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#8d737e' }}>
                    No prior assessments recorded. Complete your first AI Screening and EPDS to see your trends here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
export default ResultsReportsTab;