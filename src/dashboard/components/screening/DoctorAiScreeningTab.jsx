import React, { useEffect, useState, useMemo } from 'react';
import { useClinicalData } from '../../context/ClinicalContext.jsx';
import { DashboardIcon } from '../DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from '../Badges.jsx';
import { downloadClinicianScreeningPdfBlob } from '../../services/doctorApiService.js';
import { MaternalScreeningSearchBar } from './MaternalScreeningSearchBar.jsx';

export function DoctorAiScreeningTab({
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
    defaultMotherId || (mothers.length > 0 ? mothers[0].id : 'M-104')
  );
  const [selectedScreeningId, setSelectedScreeningId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const selectedMotherId = propSelectedMotherId || internalSelectedMotherId;
  const setSelectedMotherId = (id) => {
    setInternalSelectedMotherId(id);
    setSelectedScreeningId(null);
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

  const motherScreenings = useMemo(() => {
    if (!activeMother) return [];
    return screenings.filter(
      (s) =>
        s.motherId === activeMother.id ||
        s.motherId === activeMother.rawUuid ||
        s.rawMotherUuid === activeMother.rawUuid ||
        s.motherId === selectedMotherId
    );
  }, [screenings, activeMother, selectedMotherId]);

  const activeScreening = useMemo(() => {
    if (selectedScreeningId) {
      const match = motherScreenings.find((s) => s.id === selectedScreeningId);
      if (match) return match;
    }
    return motherScreenings[0] || activeMother?.screening || null;
  }, [motherScreenings, selectedScreeningId, activeMother]);

  const handleDownloadPdf = async () => {
    const targetId = activeScreening?.rawUuid || activeScreening?.id;
    if (!targetId) return;
    setDownloadingPdf(true);
    try {
      const blob = await downloadClinicianScreeningPdfBlob(targetId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const firstName = String(activeMother?.name || 'Patient').split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, '');
      link.href = url;
      link.download = `AANCHAL_Screening_Report_${firstName || 'Patient'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download screening PDF failed:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="doctor-ai-screening-shell" aria-label="Clinician AI Screening Overview">
      {/* Patient Screening Directory Table */}
      <section className="dash-card doc-screening-table-card" aria-label="Authorized Patients AI Screening Directory">
        <div className="doc-table-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#2b1b22', fontWeight: 600 }}>
              Authorized Patient Screening Cohort
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
              {isSearching && displayedMothers.length === 0 && (
                <tr>
                  <td colSpan="11" className="doc-search-status-cell">
                    <span className="doc-search-spinner" />
                    <span>Searching patient records for &ldquo;{searchQuery}&rdquo;...</span>
                  </td>
                </tr>
              )}

              {searchError && displayedMothers.length === 0 && (
                <tr>
                  <td colSpan="11" className="doc-search-status-cell is-error">
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
                  <td colSpan="11" className="doc-search-status-cell is-empty">
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
                const hasRecording = Boolean(
                  mScreen?.capturedModalities?.video ||
                  mScreen?.modelMetadata?.video_recording ||
                  mScreen?.modalities?.video?.status === 'completed' ||
                  mScreen?.modalities?.video?.status === 'recorded' ||
                  m.hasRecording
                );
                const textMod = mScreen?.modalities?.text;
                const voiceMod = mScreen?.modalities?.voice || mScreen?.modalities?.audio;
                const videoMod = mScreen?.modalities?.video;
                const clinPred = mScreen?.clinicalModelPrediction || mScreen?.modalities?.clinical;
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
                      <StatusBadge status={m.status || m.sessionStatus || 'Completed'} />
                    </td>
                    <td>
                      {hasRecording ? (
                        <span className="doc-rec-badge is-recorded">Completed</span>
                      ) : (
                        <span className="doc-rec-badge is-pending">Pending</span>
                      )}
                    </td>
                    <td>
                      {textMod?.status === 'completed' ? (
                        <span className="ai-status-pill is-completed">
                          {typeof textMod.score === 'number' ? `${Math.round(textMod.score * 100)}%` : 'Completed'}
                        </span>
                      ) : (
                        <span className="ai-status-pill is-pending">{mScreen ? 'Not run' : 'Pending'}</span>
                      )}
                    </td>
                    <td>
                      {voiceMod?.status === 'completed' ? (
                        <span className="ai-status-pill is-completed">
                          {typeof voiceMod.score === 'number' ? `${Math.round(voiceMod.score * 100)}%` : 'Completed'}
                        </span>
                      ) : (
                        <span className="ai-status-pill is-pending">{mScreen ? 'Not run' : 'Pending'}</span>
                      )}
                    </td>
                    <td>
                      {videoMod?.status === 'completed' || videoMod?.status === 'recorded' ? (
                        <span className="ai-status-pill is-completed">
                          {typeof videoMod.score === 'number' ? `${Math.round(videoMod.score * 100)}%` : 'Recorded'}
                        </span>
                      ) : (
                        <span className="ai-status-pill is-pending">{mScreen ? 'Not run' : 'Pending'}</span>
                      )}
                    </td>
                    <td>
                      {clinPred?.status === 'completed' ? (
                        <span className="ai-status-pill is-completed">
                          {clinPred.predicted_label || 'Evaluated'}
                        </span>
                      ) : (
                        <span className="ai-status-pill is-pending">{mScreen ? 'Not run' : 'Pending'}</span>
                      )}
                    </td>
                    <td>
                      {fusionDone ? (
                        <span className="ai-status-pill is-completed">
                          {typeof mScreen?.combinedScore === 'number' ? `${Math.round(mScreen.combinedScore * 100)}%` : 'Evaluated'}
                        </span>
                      ) : (
                        <span className="ai-status-pill is-pending">{mScreen ? 'Partial / Pending' : 'Pending screening'}</span>
                      )}
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
              {activeScreening && (
                <button
                  type="button"
                  className="miora-cta-secondary"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  style={{ fontSize: '12.5px', padding: '6px 12px' }}
                >
                  <DashboardIcon name="fileText" size={14} />
                  <span>{downloadingPdf ? 'Downloading...' : 'Download Screening Report (PDF)'}</span>
                </button>
              )}
              <StatusBadge status={activeMother.status} />
            </div>
          </div>

          {motherScreenings.length > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#66535c' }}>Screening Sessions:</span>
              {motherScreenings.map((s, idx) => {
                const isCur = (activeScreening?.id === s.id);
                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => setSelectedScreeningId(s.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: 12,
                      border: isCur ? '1.5px solid #ba1e53' : '1px solid #e2cdd5',
                      background: isCur ? '#fdf2f8' : '#ffffff',
                      color: isCur ? '#ba1e53' : '#442229',
                      fontWeight: isCur ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    Session {motherScreenings.length - idx}: {s.screeningDateTime || s.date || 'Completed'} ({s.risk || 'Screened'})
                  </button>
                );
              })}
            </div>
          )}

          {!activeScreening && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#66535c', background: '#fcf9fa', borderRadius: '10px', border: '1px dashed #e2cdd5', marginBottom: '16px' }}>
              Screening has not yet been completed by this patient.
            </div>
          )}

          {/* Deterministic Crisis Alert Banner */}
          {Boolean(
            activeScreening?.q10SafetyAlert?.triggered ||
            activeScreening?.q10_safety_alert?.triggered ||
            activeScreening?.q10SafetyAlert === true ||
            activeScreening?.q10_safety_alert === true
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
          {(() => {
            const voiceMod = activeScreening?.modalities?.voice || activeScreening?.modalities?.audio;
            const videoMod = activeScreening?.modalities?.video;
            const textMod = activeScreening?.modalities?.text;
            const clinMod = activeScreening?.modalities?.clinical || activeScreening?.clinicalModelPrediction;

            return (
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
                    {voiceMod?.status === 'completed' && typeof voiceMod?.score === 'number' ? (
                      <div
                        className="ai-status-pill is-completed"
                        style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                      >
                        <span className="ai-status-dot" style={{ background: '#10b981' }} />
                        <span>Completed (Score: {voiceMod.score.toFixed(2)})</span>
                      </div>
                    ) : (
                      <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                        <span className="ai-status-dot" />
                        <span>
                          {voiceMod?.status === 'unavailable'
                            ? 'Audio received (DSP unavailable)'
                            : activeScreening
                              ? 'Not captured in session'
                              : 'Pending screening'}
                        </span>
                      </div>
                    )}
                    <div className="doc-feature-list">
                      <div className="doc-feature-item">
                        <span>Model Output:</span>
                        <em>
                          {voiceMod?.status === 'completed' && typeof voiceMod?.score === 'number'
                            ? `Acoustic Probability ${voiceMod.score.toFixed(2)}`
                            : activeScreening ? 'Not run (no audio captured)' : 'Pending screening'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Model Architecture:</span>
                        <em>7-Feature Acoustic Logistic Regression</em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Acoustic Features:</span>
                        <em>
                          {voiceMod?.details?.features_processed
                            ? `${voiceMod.details.features_processed} DSP Biomarkers Extracted`
                            : voiceMod?.status === 'completed'
                              ? '7 Physiological Features Extracted'
                              : voiceMod?.error || 'Not run'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Assessment Timestamp:</span>
                        <em>{activeScreening?.processedAt || activeScreening?.screeningDateTime || '—'}</em>
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
                    {videoMod?.status === 'completed' && typeof videoMod?.score === 'number' ? (
                      <div
                        className="ai-status-pill is-completed"
                        style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                      >
                        <span className="ai-status-dot" style={{ background: '#10b981' }} />
                        <span>Completed (Score: {videoMod.score.toFixed(2)})</span>
                      </div>
                    ) : (
                      <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                        <span className="ai-status-dot" />
                        <span>
                          {videoMod?.status === 'recorded'
                            ? 'Video recorded under consent (clinician review)'
                            : activeScreening
                              ? 'Not captured in session'
                              : 'Pending screening'}
                        </span>
                      </div>
                    )}
                    <div className="doc-feature-list">
                      <div className="doc-feature-item">
                        <span>Model Output:</span>
                        <em>
                          {videoMod?.status === 'completed' && typeof videoMod?.score === 'number'
                            ? `Visual Probability ${videoMod.score.toFixed(2)}`
                            : videoMod?.status === 'recorded'
                              ? 'Video recorded (visual review ready)'
                              : activeScreening ? 'Not run (no video captured)' : 'Pending screening'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Model Architecture:</span>
                        <em>220-Feature Summary Dynamics Classifier</em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Visual Dynamics Features:</span>
                        <em>
                          {videoMod?.details?.features_processed
                            ? `${videoMod.details.features_processed} Facial & Gaze Features`
                            : videoMod?.status === 'completed'
                              ? '220 Action Unit Statistics'
                              : videoMod?.error || 'Recorded for review'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Assessment Timestamp:</span>
                        <em>{activeScreening?.processedAt || activeScreening?.screeningDateTime || '—'}</em>
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
                    {textMod?.status === 'completed' && typeof textMod?.score === 'number' ? (
                      <div
                        className="ai-status-pill is-completed"
                        style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                      >
                        <span className="ai-status-dot" style={{ background: '#10b981' }} />
                        <span>Completed (Score: {textMod.score.toFixed(2)})</span>
                      </div>
                    ) : (
                      <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                        <span className="ai-status-dot" />
                        <span>{activeScreening ? 'Not captured in session' : 'Pending screening'}</span>
                      </div>
                    )}
                    <div className="doc-feature-list">
                      <div className="doc-feature-item">
                        <span>Model Output:</span>
                        <em>
                          {textMod?.status === 'completed' && typeof textMod?.score === 'number'
                            ? `Text Risk Probability ${textMod.score.toFixed(2)}`
                            : activeScreening ? 'Not run (no text captured)' : 'Pending screening'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Model Architecture:</span>
                        <em>TF-IDF + Calibrated Logistic Regression</em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Linguistic Features:</span>
                        <em>
                          {textMod?.details?.character_count
                            ? `${textMod.details.character_count} characters analyzed`
                            : textMod?.status === 'completed'
                              ? 'TF-IDF Affective N-grams'
                              : textMod?.error || 'Not run'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Assessment Timestamp:</span>
                        <em>{activeScreening?.processedAt || activeScreening?.screeningDateTime || '—'}</em>
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
                    {clinMod?.status === 'completed' &&
                    (typeof clinMod?.score === 'number' || typeof clinMod?.predicted_risk_probability === 'number') ? (
                      <div
                        className="ai-status-pill is-completed"
                        style={{ marginBottom: 10, background: '#ecfdf5', color: '#065f46' }}
                      >
                        <span className="ai-status-dot" style={{ background: '#10b981' }} />
                        <span>Completed (Score: {((typeof clinMod.score === 'number' ? clinMod.score : clinMod.predicted_risk_probability)).toFixed(2)})</span>
                      </div>
                    ) : (
                      <div className="ai-status-pill is-pending" style={{ marginBottom: 10 }}>
                        <span className="ai-status-dot" />
                        <span>{activeScreening ? 'Not evaluated in session' : 'Pending screening'}</span>
                      </div>
                    )}
                    <div className="doc-feature-list">
                      <div className="doc-feature-item">
                        <span>Model Output:</span>
                        <em>
                          {clinMod?.status === 'completed' &&
                          (typeof clinMod?.score === 'number' || typeof clinMod?.predicted_risk_probability === 'number')
                            ? `Clinical Probability ${(typeof clinMod.score === 'number' ? clinMod.score : clinMod.predicted_risk_probability).toFixed(2)}`
                            : activeScreening ? 'Not run (survey not submitted)' : 'Pending screening'}
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
                      <strong>Clinical Profile:</strong> Evaluates 46 obstetric &amp; psychosocial survey covariates ({clinMod?.predicted_label || clinMod?.label || 'Random Forest'}).
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
                        <span>{activeScreening ? 'Partial modalities only' : 'Pending screening'}</span>
                      </div>
                    )}
                    <p style={{ fontSize: 13, color: '#66535c', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                      Late fusion meta-classifier synthesizes predictions across all four pipelines (Clinical Numerical, Audio Prosody, Video Dynamics, Narrative Text) via learned logistic stacking.
                    </p>
                    <div className="doc-feature-list">
                      <div className="doc-feature-item">
                        <span>Fusion Method:</span>
                        <em>{activeScreening?.fusionMethod || 'Learned Stacking Meta-Classifier'}</em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Overall Risk Tier:</span>
                        <em>
                          {typeof activeScreening?.combinedScore === 'number'
                            ? `${activeScreening.risk || 'Calculated'} (${(activeScreening.combinedScore * 100).toFixed(1)}%)`
                            : 'Awaiting multimodal inference'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Modalities Included:</span>
                        <em>
                          {[
                            textMod?.status === 'completed' ? 'Text' : null,
                            voiceMod?.status === 'completed' ? 'Audio' : null,
                            (videoMod?.status === 'completed' || videoMod?.status === 'recorded') ? 'Video' : null,
                            clinMod?.status === 'completed' ? 'Clinical' : null,
                          ]
                            .filter(Boolean)
                            .join(', ') || 'None yet'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Cross-Modal Concordance:</span>
                        <em>
                          {typeof activeScreening?.discordanceScore === 'number'
                            ? activeScreening.discordanceDetected
                              ? `Divergence Detected (Δ = ${activeScreening.discordanceScore.toFixed(2)})`
                              : `Aligned (Δ = ${activeScreening.discordanceScore.toFixed(2)})`
                            : 'Awaiting multimodal inference'}
                        </em>
                      </div>
                      <div className="doc-feature-item">
                        <span>Assessment Timestamp:</span>
                        <em>{activeScreening?.processedAt || activeScreening?.screeningDateTime || '—'}</em>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
export default DoctorAiScreeningTab;