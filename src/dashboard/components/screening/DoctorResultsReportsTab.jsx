import React, { useState, useMemo, useEffect } from 'react';
import { useClinicalData } from '../../context/ClinicalContext.jsx';
import { DashboardIcon } from '../DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from '../Badges.jsx';
import { ExportReportModal } from '../ResultsModals.jsx';
import { MaternalScreeningSearchBar } from './MaternalScreeningSearchBar.jsx';

export function DoctorResultsReportsTab({
  defaultMotherId,
  selectedMotherId: propSelectedMotherId,
  onSelectMother,
  searchQuery = '',
  onSearchChange = () => {},
  onClearSearch = () => {},
  searchResults = null,
  isSearching = false,
  searchError = null,
  onRetrySearch = () => {},
}) {
  const { mothers, screenings } = useClinicalData();

  const [internalSelectedMotherId, setInternalSelectedMotherId] = useState(
    defaultMotherId || (mothers.find((m) => m.id === 'M-108') ? 'M-108' : mothers[0]?.id || 'M-104')
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const selectedMotherId = propSelectedMotherId || internalSelectedMotherId;
  const setSelectedMotherId = (id) => {
    setInternalSelectedMotherId(id);
    if (onSelectMother) onSelectMother(id);
  };

  useEffect(() => {
    if (defaultMotherId) {
      setInternalSelectedMotherId(defaultMotherId);
    }
  }, [defaultMotherId]);

  const displayedMothers = useMemo(() => {
    return searchResults !== null ? searchResults : mothers;
  }, [searchResults, mothers]);

  const activeMother = useMemo(() => {
    const pool = searchResults !== null ? [...searchResults, ...mothers] : mothers;
    return pool.find((m) => m.id === selectedMotherId || m.rawUuid === selectedMotherId) || pool[0] || null;
  }, [searchResults, mothers, selectedMotherId]);

  const activeScreening = useMemo(() => {
    return (
      activeMother?.screening ||
      screenings.find((s) => s.motherId === selectedMotherId || s.motherId === activeMother?.rawUuid) ||
      null
    );
  }, [screenings, selectedMotherId, activeMother]);

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
            {searchResults !== null && (
              <span style={{ fontSize: 12, color: '#8d737e', marginTop: 2, display: 'inline-block' }}>
                Showing {searchResults.length} matching {searchResults.length === 1 ? 'patient' : 'patients'} for &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>
          <MaternalScreeningSearchBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onClearSearch={onClearSearch}
            isSearching={isSearching}
            hasActiveSearch={searchResults !== null || Boolean(searchQuery)}
            matchingCount={searchResults ? searchResults.length : undefined}
          />
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
              {isSearching && displayedMothers.length === 0 && (
                <tr>
                  <td colSpan="7" className="doc-search-status-cell">
                    <span className="doc-search-spinner" />
                    <span>Searching patient records for &ldquo;{searchQuery}&rdquo;...</span>
                  </td>
                </tr>
              )}

              {searchError && displayedMothers.length === 0 && (
                <tr>
                  <td colSpan="7" className="doc-search-status-cell is-error">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <span>{searchError}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="doc-clear-cohort-btn" onClick={onRetrySearch}>
                          Retry
                        </button>
                        <button type="button" className="doc-clear-cohort-btn" onClick={onClearSearch}>
                          Restore Cohort
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {!isSearching && searchResults !== null && searchResults.length === 0 && !searchError && (
                <tr>
                  <td colSpan="7" className="doc-search-status-cell is-empty">
                    <div className="doc-empty-title">No mothers found</div>
                    <div className="doc-empty-sub">
                      No registered patients matching &ldquo;{searchQuery}&rdquo; were found.
                    </div>
                    <button type="button" className="doc-clear-cohort-btn" onClick={onClearSearch}>
                      Restore Patient Cohort
                    </button>
                  </td>
                </tr>
              )}

              {displayedMothers.map((m) => {
                const isSelected = m.id === selectedMotherId || m.rawUuid === selectedMotherId;
                const mScreen =
                  m.screening ||
                  screenings.find((s) => s.motherId === m.id || s.motherId === m.rawUuid) ||
                  null;
                const score = mScreen?.epdsEquivalent ?? m.epdsScore ?? 11;
                const cmDone = mScreen?.clinicalModelPrediction?.status === 'completed';
                const fusionDone = mScreen?.fusionStatus === 'completed' || m.fusionStatus === 'completed';
                return (
                  <tr
                    key={m.id || m.rawUuid}
                    className={`doc-cohort-row ${isSelected ? 'is-active-row' : ''}`}
                    onClick={() => setSelectedMotherId(m.id)}
                  >
                    <td>
                      <strong>{m.name}</strong>
                      <span className="doc-pat-id">({m.id})</span>
                    </td>
                    <td>Week {m.postpartumWeek || m.postpartum_week || '6'}</td>
                    <td>{mScreen?.screeningDateTime || m.lastScreeningDate || m.screeningDate || 'Recent'}</td>
                    <td>
                      <span className="doc-epds-score-pill">
                        <strong>{score}</strong> / 30
                      </span>
                    </td>
                    <td>
                      {fusionDone ? (
                        <span className="ai-status-pill is-completed">
                          <span className="ai-status-dot" />
                          <span>Fusion: {typeof mScreen?.combinedScore === 'number' ? `${Math.round(mScreen.combinedScore * 100)}%` : 'Completed'}</span>
                        </span>
                      ) : cmDone ? (
                        <span className="ai-status-pill is-completed">
                          <span className="ai-status-dot" />
                          <span>Clinical ML Evaluated</span>
                        </span>
                      ) : (
                        <span className="ai-status-pill is-pending">
                          <span className="ai-status-dot" />
                          <span>Awaiting model integration</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={m.status || m.sessionStatus || 'Completed'} />
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
                  {activeScreening?.modalities?.voice?.status === 'completed' ? (
                    <span className="ai-status-pill is-completed">
                      {typeof activeScreening.modalities.voice.score === 'number'
                        ? `${Math.round(activeScreening.modalities.voice.score * 100)}% (Active)`
                        : 'Completed'}
                    </span>
                  ) : (
                    <span className="ai-status-pill is-pending">Awaiting model integration</span>
                  )}
                </div>
                <div className="doc-box-row">
                  <span>Video Analysis:</span>
                  {activeScreening?.modalities?.video?.status === 'completed' || activeScreening?.modalities?.video?.status === 'recorded' ? (
                    <span className="ai-status-pill is-completed">
                      {typeof activeScreening.modalities.video.score === 'number'
                        ? `${Math.round(activeScreening.modalities.video.score * 100)}% (Active)`
                        : 'Recorded'}
                    </span>
                  ) : (
                    <span className="ai-status-pill is-pending">Awaiting model integration</span>
                  )}
                </div>
                <div className="doc-box-row">
                  <span>Text Analysis:</span>
                  {activeScreening?.modalities?.text?.status === 'completed' ? (
                    <span className="ai-status-pill is-completed">
                      {typeof activeScreening.modalities.text.score === 'number'
                        ? `${Math.round(activeScreening.modalities.text.score * 100)}% (Active)`
                        : 'Completed'}
                    </span>
                  ) : (
                    <span className="ai-status-pill is-pending">Awaiting model integration</span>
                  )}
                </div>
                <div className="doc-box-row">
                  <span>Clinical Analysis:</span>
                  {activeScreening?.clinicalModelPrediction?.status === 'completed' ? (
                    <span className="ai-status-pill is-completed">
                      {activeScreening.clinicalModelPrediction.predicted_label || 'Evaluated'}
                      {typeof activeScreening.clinicalModelPrediction.predicted_risk_probability === 'number'
                        ? ` (${Math.round(activeScreening.clinicalModelPrediction.predicted_risk_probability * 100)}%)`
                        : ''}
                    </span>
                  ) : (
                    <span className="ai-status-pill is-pending">Awaiting model integration</span>
                  )}
                </div>
                <div className="doc-box-row">
                  <span>Four-Modality Stacking Fusion:</span>
                  {activeScreening?.fusionStatus === 'completed' ? (
                    <span className="ai-status-pill is-completed">
                      {typeof activeScreening.combinedScore === 'number'
                        ? `${Math.round(activeScreening.combinedScore * 100)}% (Research Score)`
                        : 'Completed'}
                    </span>
                  ) : (
                    <span className="ai-status-pill is-pending">Awaiting model integration</span>
                  )}
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
            </div>
          </div>
        </section>
      )}

      {/* Export Report Modal */}
      {exportOpen && activeScreening && (
        <ExportReportModal
          isOpen={exportOpen}
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