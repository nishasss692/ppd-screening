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
      {/* Clinician Overview Banner */}
      <section className="dash-card doc-screening-intro-card">
        <div className="doc-screening-intro-copy">
          <div className="miora-dash-eyebrow">
            <span>CLINICAL SCREENING OVERSIGHT</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h2 className="miora-dash-title" style={{ margin: '4px 0 8px 0', fontSize: '20px' }}>
            AI Multimodal Screening — Clinician Oversight
          </h2>
          <p className="miora-dash-subtitle" style={{ margin: 0, fontSize: '13.5px' }}>
            Review acoustic, linguistic, and facial video dynamics captured during patient screening sessions.
            Model outputs reflect true backend pipeline status with zero fabricated predictions.
          </p>
        </div>
      </section>

      {/* Patient Screening Directory Table */}
      <section className="dash-card doc-screening-table-card" aria-label="Authorized Patients AI Screening Directory">
        <div className="doc-table-header">
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#2b1b22', fontWeight: 600 }}>
              Authorized Patient Screening Cohort
            </h2>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#66535c' }}>
              Select a mother to inspect detailed audio, video, text, and multimodal fusion indicators.
            </p>
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
                <th>Audio Model</th>
                <th>Video Model</th>
                <th>Text Model</th>
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
                        <span className="doc-rec-badge is-recorded">✓ Captured</span>
                      ) : (
                        <span className="doc-rec-badge is-pending">Pending</span>
                      )}
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Awaiting integration</span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Awaiting integration</span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">Awaiting integration</span>
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
              <RiskBadge risk={activeMother.risk} />
              <StatusBadge status={activeMother.status} />
            </div>
          </div>

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
                <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                  <span className="ai-status-dot" />
                  <span>Awaiting model integration</span>
                </div>
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Pitch Variability (F0 SD):</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Pause Ratio / Hesitation:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Vocal Energy Dynamics:</span>
                    <em>Awaiting model integration</em>
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
                <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                  <span className="ai-status-dot" />
                  <span>Awaiting model integration</span>
                </div>
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Facial Action Units (AU1, AU4, AU12):</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Gaze Engagement / Eye Contact:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Micro-expression Dynamics:</span>
                    <em>Awaiting model integration</em>
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
                <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                  <span className="ai-status-dot" />
                  <span>Awaiting model integration</span>
                </div>
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Model Output:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Sentiment Valence:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Linguistic Distress Markers:</span>
                    <em>Awaiting model integration</em>
                  </div>
                </div>
                {activeMother.textCueSummary && (
                  <div className="doc-clinical-note-box">
                    <strong>Transcript Summary:</strong> {activeMother.textCueSummary}
                  </div>
                )}
              </div>
            </div>

            {/* Panel 4: Multimodal Screening Assessment */}
            <div className="doc-modality-panel is-multimodal">
              <div className="doc-panel-head">
                <div className="doc-panel-icon" style={{ background: '#ba1e53', color: '#ffffff' }}>
                  <DashboardIcon name="activity" size={17} />
                </div>
                <div>
                  <h3>Multimodal Screening</h3>
                  <small>Acoustic–linguistic–visual fusion</small>
                </div>
              </div>
              <div className="doc-panel-body">
                <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                  <span className="ai-status-dot" />
                  <span>Awaiting model integration</span>
                </div>
                <p style={{ fontSize: 13, color: '#66535c', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                  Cross-modal predictive fusion will synthesize acoustic prosody, facial dynamics, and linguistic features once the backend ML inference server is deployed.
                </p>
                <div className="doc-feature-list">
                  <div className="doc-feature-item">
                    <span>Combined Classification:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Confidence Score:</span>
                    <em>Awaiting model integration</em>
                  </div>
                  <div className="doc-feature-item">
                    <span>Cross-Modal Concordance:</span>
                    <em>Awaiting model integration</em>
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