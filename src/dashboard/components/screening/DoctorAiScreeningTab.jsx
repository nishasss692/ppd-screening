import React, { useState, useMemo } from 'react';
import { useClinicalData } from '../../context/ClinicalContext.jsx';
import { DashboardIcon } from '../DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from '../Badges.jsx';

export function DoctorAiScreeningTab({ defaultMotherId }) {
  const { mothers, screenings } = useClinicalData();

  const [selectedMotherId, setSelectedMotherId] = useState(
    defaultMotherId || (mothers.find((m) => m.id === 'M-108') ? 'M-108' : mothers[0]?.id || 'M-104')
  );

  const activeMother = useMemo(
    () => mothers.find((m) => m.id === selectedMotherId) || mothers[0] || null,
    [mothers, selectedMotherId]
  );

  const activeScreening = useMemo(
    () => screenings.find((s) => s.motherId === selectedMotherId) || null,
    [screenings, selectedMotherId]
  );

  return (
    <div className="doctor-ai-screening-shell" aria-label="Clinician AI Screening Overview">
      {/* Patient Screening Directory Table */}
      <section className="dash-card doc-screening-table-card" aria-label="Authorized Patients AI Screening Directory">
        <div className="doc-table-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#2b1b22', fontWeight: 600 }}>
              Authorized Patient Screening Cohort
            </h2>
          </div>
        </div>

        <div className="doc-table-container">
          <table className="doc-cohort-table">
            <thead>
              <tr>
                <th>Patient ID &amp; Name</th>
                <th>Postpartum Week</th>
                <th>Screening Date</th>
                <th>Session Status</th>
                <th>Recording Status</th>
                <th>Text Model</th>
                <th>Audio Model</th>
                <th>Video Model</th>
                <th>Clinical Model</th>
                <th>Multimodal Fusion</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {mothers.map((m) => {
                const isSelected = m.id === selectedMotherId;
                const hasRecording = m.id === 'M-104' || m.id === 'M-108';
                return (
                  <tr
                    key={m.id}
                    className={`doc-cohort-row ${isSelected ? 'is-active-row' : ''}`}
                    onClick={() => setSelectedMotherId(m.id)}
                  >
                    <td>
                      <strong>{m.name}</strong>
                      <span className="doc-pat-id">({m.id})</span>
                    </td>
                    <td>Week {m.postpartumWeek}</td>
                    <td>{m.lastScreeningDate}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>
                      {hasRecording ? (
                        <span className="doc-rec-badge is-recorded">Completed</span>
                      ) : (
                        <span className="doc-rec-badge is-pending">Pending</span>
                      )}
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Pending <span className="sr-only">Awaiting model integration</span></span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Pending <span className="sr-only">Awaiting model integration</span></span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Pending <span className="sr-only">Awaiting model integration</span></span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Pending <span className="sr-only">Awaiting model integration</span></span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Awaiting integration</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="doc-inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMotherId(m.id);
                        }}
                      >
                        {isSelected ? 'Inspecting' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Patient AI Screening Inspector */}
      {activeMother && (
        <section className="dash-card doc-detail-inspector-card" aria-label={`AI Screening Details for ${activeMother.name}`}>
          <div className="doc-detail-header">
            <div className="doc-detail-patient-meta">
              <div className="dash-avatar-circle" style={{ width: 44, height: 44, fontSize: 16 }}>
                {activeMother.avatarInitials || 'P'}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#2b1b22', fontWeight: 600 }}>
                  {activeMother.name} <span style={{ fontSize: 14, color: '#8d737e', fontWeight: 400 }}>({activeMother.id})</span>
                </h2>
                <div style={{ fontSize: 12.5, color: '#66535c', marginTop: 2 }}>
                  Week {activeMother.postpartumWeek} Postpartum &bull; Screening Date: {activeMother.lastScreeningDate} ({activeMother.lastScreeningTime})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={activeMother.status} />
            </div>
          </div>

          {/* Deterministic Crisis Alert Banner */}
          {Boolean(
            activeScreening?.q10SafetyAlert?.triggered ||
              activeScreening?.q10_safety_alert?.triggered
          ) && (
            <div
              className="ai-crisis-alert-banner"
              role="alert"
              style={{
                background: '#fff1f2',
                border: '2px solid #e11d48',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '16px',
                color: '#9f1239',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <DashboardIcon name="alertTriangle" size={22} style={{ color: '#e11d48', flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '14px', color: '#881337', display: 'block' }}>
                    EPDS Question 10 Safety Flag: Immediate Clinical Assessment Required
                  </strong>
                  <p style={{ margin: '3px 0 0', fontSize: '12.5px', lineHeight: 1.4 }}>
                    Thoughts of self-harm indicated. Deterministic safety protocol active: refer to Tele-MANAS
                    at <strong>14416 / 1800-891-4416</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4 Modality Panels */}
          <div className="doc-modality-panels-grid">
            {/* Panel 1: Audio Analysis */}
            <div className="doc-modality-panel">
              <div className="doc-panel-head">
                <div className="doc-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                  <DashboardIcon name="wave" size={17} />
                </div>
                <div>
                  <h3>Audio Analysis</h3>
                  <small>Acoustic vocal markers &amp; prosody</small>
                </div>
              </div>
              <div className="doc-panel-body">
                {activeScreening?.modalities?.voice?.status === 'completed' &&
                typeof activeScreening?.modalities?.voice?.score === 'number' ? (
                  <div
                    className="ai-status-pill is-completed"
                    style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                  >
                    <span className="ai-status-dot" style={{ background: '#10b981' }} />
                    <span>Completed (Score: {activeScreening.modalities.voice.score.toFixed(2)})</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                    <span className="ai-status-dot" />
                    <span>Awaiting model integration</span>
                  </div>
                )}
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>
                      {activeScreening?.modalities?.voice?.status === 'completed' &&
                      typeof activeScreening?.modalities?.voice?.score === 'number'
                        ? `Acoustic Probability ${activeScreening.modalities.voice.score.toFixed(2)}`
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Model Architecture:</span>
                    <em>7-Feature Acoustic Logistic Regression</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Pitch Variability (F0 SD):</span>
                    <em>{activeScreening?.modalities?.voice?.status === 'completed' ? 'Extracted' : 'Awaiting model integration'}</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Vocal Biomarker Provenance:</span>
                    <em>Acoustic DSP Feature Extraction</em>
                  </div>
                </div>
                {activeMother.voiceCueSummary && (
                  <div className="doc-clinical-note-box">
                    <strong>Clinician Observation:</strong> {activeMother.voiceCueSummary}
                  </div>
                )}
              </div>
            </div>

            {/* Panel 2: Video Analysis */}
            <div className="doc-modality-panel">
              <div className="doc-panel-head">
                <div className="doc-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                  <DashboardIcon name="video" size={17} />
                </div>
                <div>
                  <h3>Video Analysis</h3>
                  <small>Facial Action Units &amp; visual engagement</small>
                </div>
              </div>
              <div className="doc-panel-body">
                {activeScreening?.modalities?.video?.status === 'completed' &&
                typeof activeScreening?.modalities?.video?.score === 'number' ? (
                  <div
                    className="ai-status-pill is-completed"
                    style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                  >
                    <span className="ai-status-dot" style={{ background: '#10b981' }} />
                    <span>Completed (Score: {activeScreening.modalities.video.score.toFixed(2)})</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                    <span className="ai-status-dot" />
                    <span>Awaiting model integration</span>
                  </div>
                )}
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>
                      {activeScreening?.modalities?.video?.status === 'completed' &&
                      typeof activeScreening?.modalities?.video?.score === 'number'
                        ? `Visual Probability ${activeScreening.modalities.video.score.toFixed(2)}`
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Model Architecture:</span>
                    <em>220-Feature Summary Dynamics Classifier</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Visual Dynamics Provenance:</span>
                    <em>Facial Action Units &amp; Gaze Statistics</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Benchmark Environment:</span>
                    <em>Offline Research Benchmark</em>
                  </div>
                </div>
                <div className="doc-clinical-note-box">
                  <strong>Video Capture:</strong> Recorded under informed maternal consent for clinician review.
                </div>
              </div>
            </div>

            {/* Panel 3: Text Analysis */}
            <div className="doc-modality-panel">
              <div className="doc-panel-head">
                <div className="doc-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                  <DashboardIcon name="sparkle" size={17} />
                </div>
                <div>
                  <h3>Text Analysis</h3>
                  <small>Acoustic-linguistic sentiment</small>
                </div>
              </div>
              <div className="doc-panel-body">
                {activeScreening?.modalities?.text?.status === 'completed' &&
                typeof activeScreening?.modalities?.text?.score === 'number' ? (
                  <div
                    className="ai-status-pill is-completed"
                    style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                  >
                    <span className="ai-status-dot" style={{ background: '#10b981' }} />
                    <span>Completed (Score: {activeScreening.modalities.text.score.toFixed(2)})</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                    <span className="ai-status-dot" />
                    <span>Awaiting model integration</span>
                  </div>
                )}
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>
                      {activeScreening?.modalities?.text?.status === 'completed' &&
                      typeof activeScreening?.modalities?.text?.score === 'number'
                        ? `Text Risk Probability ${activeScreening.modalities.text.score.toFixed(2)}`
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Model Architecture:</span>
                    <em>TF-IDF + Calibrated Logistic Regression</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Dataset Provenance:</span>
                    <em>Synthetic Narrative Self-Reports</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Linguistic Distress Markers:</span>
                    <em>{activeScreening?.modalities?.text?.status === 'completed' ? 'Analyzed' : 'Awaiting model integration'}</em>
                  </div>
                </div>
                {activeMother.textCueSummary && (
                  <div className="doc-clinical-note-box">
                    <strong>Transcript Summary:</strong> {activeMother.textCueSummary}
                  </div>
                )}
              </div>
            </div>

            {/* Panel 4: Clinical Analysis */}
            <div className="doc-modality-panel">
              <div className="doc-panel-head">
                <div className="doc-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                  <DashboardIcon name="document" size={17} />
                </div>
                <div>
                  <h3>Clinical Analysis</h3>
                  <small>46 obstetric &amp; psychosocial predictors</small>
                </div>
              </div>
              <div className="doc-panel-body">
                {activeScreening?.modalities?.clinical?.status === 'completed' &&
                typeof activeScreening?.modalities?.clinical?.score === 'number' ? (
                  <div
                    className="ai-status-pill is-completed"
                    style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                  >
                    <span className="ai-status-dot" style={{ background: '#10b981' }} />
                    <span>Completed (Score: {activeScreening.modalities.clinical.score.toFixed(2)})</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                    <span className="ai-status-dot" />
                    <span>Awaiting model integration</span>
                  </div>
                )}
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>
                      {activeScreening?.modalities?.clinical?.status === 'completed' &&
                      typeof activeScreening?.modalities?.clinical?.score === 'number'
                        ? `Clinical Probability ${activeScreening.modalities.clinical.score.toFixed(2)}`
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Model Architecture:</span>
                    <em>Random Forest Classifier</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Predictor Dimensionality:</span>
                    <em>46 Survey Covariates (Zero Target Leakage)</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Data Provenance:</span>
                    <em>Validated Clinical Survey Dataset</em>
                  </div>
                </div>
                <div className="doc-clinical-note-box">
                  <strong>Clinical Profile:</strong> Standardized survey covariates evaluated against trained Random Forest baseline.
                </div>
              </div>
            </div>

            {/* Panel 5: Four-Modality Late Fusion Screening Assessment */}
            <div className="doc-modality-panel is-multimodal">
              <div className="doc-panel-head">
                <div className="doc-panel-icon" style={{ background: '#ba1e53', color: '#ffffff' }}>
                  <DashboardIcon name="activity" size={17} />
                </div>
                <div>
                  <h3>Four-Modality Late Fusion</h3>
                  <small>Clinical–acoustic–linguistic–visual stacking</small>
                </div>
              </div>
              <div className="doc-panel-body">
                {typeof activeScreening?.combinedScore === 'number' ? (
                  <div
                    className="ai-status-pill is-completed"
                    style={{ marginBottom: 10, background: '#fdf2f8', color: '#831843' }}
                  >
                    <span className="ai-status-dot" style={{ background: '#db2777' }} />
                    <span>Combined Score: {activeScreening.combinedScore.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                    <span className="ai-status-dot" />
                    <span>Awaiting model integration</span>
                  </div>
                )}
                <p style={{ fontSize: 13, color: '#66535c', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                  Late fusion meta-classifier synthesizes predictions across all four pipelines (Clinical Numerical, Audio Prosody, Video Dynamics, Narrative Text) via learned logistic stacking.
                </p>
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Combined Classification:</span>
                    <em>
                      {typeof activeScreening?.combinedScore === 'number'
                        ? activeScreening.risk || 'Calculated'
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Confidence Score:</span>
                    <em>
                      {typeof activeScreening?.combinedScore === 'number'
                        ? `${(activeScreening.combinedScore * 100).toFixed(0)}%`
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Cross-Modal Concordance:</span>
                    <em>
                      {activeScreening?.discordanceDetected !== undefined
                        ? activeScreening.discordanceDetected
                          ? 'Divergence Detected (|Δ| ≥ 0.25)'
                          : 'High Cross-Modal Concordance'
                        : 'Awaiting model integration'}
                    </em>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
export default DoctorAiScreeningTab;