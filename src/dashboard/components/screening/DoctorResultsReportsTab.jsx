import React, { useState, useMemo } from 'react';
import { useClinicalData } from '../../context/ClinicalContext.jsx';
import { DashboardIcon } from '../DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from '../Badges.jsx';
import { ExportReportModal } from '../ResultsModals.jsx';

export function DoctorResultsReportsTab({ defaultMotherId }) {
  const { mothers, screenings } = useClinicalData();

  const [selectedMotherId, setSelectedMotherId] = useState(
    defaultMotherId || (mothers.find((m) => m.id === 'M-108') ? 'M-108' : mothers[0]?.id || 'M-104')
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const activeMother = useMemo(
    () => mothers.find((m) => m.id === selectedMotherId) || mothers[0] || null,
    [mothers, selectedMotherId]
  );

  const activeScreening = useMemo(
    () => screenings.find((s) => s.motherId === selectedMotherId) || null,
    [screenings, selectedMotherId]
  );

  const handleExport = () => {
    setExportOpen(true);
  };

  return (
    <div className="doctor-results-reports-shell" aria-label="Clinician Results & Reports Overview">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="patient-notice-banner is-success" role="status" style={{ marginBottom: 16 }}>
          {toastMessage}
        </div>
      )}

      {/* Cohort Selector & Assessment Summary Table */}
      <section className="dash-card doc-screening-table-card" aria-label="Patient Assessment History Table">
        <div className="doc-table-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#2b1b22', fontWeight: 600 }}>
              Authorized Patient Assessment History
            </h2>
          </div>
        </div>

        <div className="doc-table-container">
          <table className="doc-cohort-table">
            <thead>
              <tr>
                <th>Patient ID &amp; Name</th>
                <th>Postpartum Week</th>
                <th>Assessment Date</th>
                <th>EPDS Score</th>
                <th>Multimodal Fusion Status</th>
                <th>Overall Assessment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mothers.map((m) => {
                const isSelected = m.id === selectedMotherId;
                const score = m.epdsScore ?? 11;
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
                      <span className="doc-epds-score-pill">
                        <strong>{score}</strong> / 30
                      </span>
                    </td>
                    <td>
                      <span className="ai-status-pill is-pending">
                        <span className="ai-status-dot" />
                        <span>Awaiting model integration</span>
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
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
                        {isSelected ? 'Selected' : 'Open Portfolio'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Selected Patient Portfolio View */}
      {activeMother && (
        <section className="dash-card doc-portfolio-detail-card" aria-label={`Portfolio for ${activeMother.name}`}>
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
                  Assessment Portfolio &bull; Last Assessed: {activeMother.lastScreeningDate} &bull; Week {activeMother.postpartumWeek} Postpartum
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="patient-btn-primary"
                onClick={handleExport}
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                <DashboardIcon name="download" size={15} />
                <span>Export Clinical Report</span>
              </button>
            </div>
          </div>

          {/* Two-Column Assessment Breakdown */}
          <div className="doc-portfolio-grid">
            {/* Column 1: AI Multimodal Screening Signals */}
            <div className="doc-portfolio-box">
              <h3 className="doc-box-title">
                <DashboardIcon name="activity" size={16} />
                <span>AI Screening Modalities</span>
              </h3>
              <div className="doc-box-rows">
                <div className="doc-box-row">
                  <span>Audio Analysis:</span>
                  <span className="ai-status-pill is-pending">Awaiting model integration</span>
                </div>
                <div className="doc-box-row">
                  <span>Video Analysis:</span>
                  <span className="ai-status-pill is-pending">Awaiting model integration</span>
                </div>
                <div className="doc-box-row">
                  <span>Text Analysis:</span>
                  <span className="ai-status-pill is-pending">Awaiting model integration</span>
                </div>
                <div className="doc-box-row">
                  <span>Clinical Analysis:</span>
                  <span className="ai-status-pill is-pending">Awaiting model integration</span>
                </div>
                <div className="doc-box-row">
                  <span>Four-Modality Stacking Fusion:</span>
                  <span className="ai-status-pill is-pending">Awaiting model integration</span>
                </div>
              </div>
              <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#8d737e' }}>
                All clinical, audio, video, and text feature extractors will populate here upon backend endpoint deployment.
              </p>
            </div>

            {/* Column 2: EPDS Assessment Breakdown */}
            <div className="doc-portfolio-box">
              <h3 className="doc-box-title">
                <DashboardIcon name="document" size={16} />
                <span>EPDS Self-Report Score</span>
              </h3>
              <div className="doc-epds-summary-badge-wrap">
                <div className="doc-epds-big-score-wrap">
                  <span className="big-num">{activeMother.epdsScore ?? 11}</span>
                  <span className="denom">/ 30</span>
                </div>
                <div className="doc-epds-summary-copy">
                  <strong>
                    {(activeMother.epdsScore ?? 11) >= 13
                      ? 'Elevated Depressive Symptoms (≥13)'
                      : (activeMother.epdsScore ?? 11) >= 10
                        ? 'Mild Distress Category (10–12)'
                        : 'Low Risk Category (0–9)'}
                  </strong>
                  <small>Assessment date: {activeMother.lastScreeningDate}</small>
                </div>
              </div>
              {activeMother.carePlan && (
                <div className="doc-clinical-note-box" style={{ marginTop: 12 }}>
                  <strong>Recommended Care Plan:</strong> {activeMother.carePlan}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Export Report Modal */}
      {exportOpen && activeScreening && (
        <ExportReportModal
          screening={activeScreening}
          mother={activeMother}
          onClose={() => setExportOpen(false)}
          onSuccess={(note) => {
            setExportOpen(false);
            setToastMessage(note);
            setTimeout(() => setToastMessage(''), 4000);
          }}
        />
      )}
    </div>
  );
}
export default DoctorResultsReportsTab;