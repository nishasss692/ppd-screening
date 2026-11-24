import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientIcon } from '../PatientIcons.jsx';
import { usePatient } from '../../context/PatientContext.jsx';

export function ResultsReportsTab({ onTakeAiScreening, onTakeEpds }) {
  const navigate = useNavigate();
  const { patient, screening, downloadReport, downloadToast } = usePatient();

  const [storedAiSession, setStoredAiSession] = useState(null);
  const [storedEpds, setStoredEpds] = useState(null);
  const [storedMultimodalResult, setStoredMultimodalResult] = useState(null);
  const [storedClinicalModel, setStoredClinicalModel] = useState(null);
  const [storedPsychosocial, setStoredPsychosocial] = useState(null);

  useEffect(() => {
    try {
      const rawAi = localStorage.getItem('aanchal_ai_screening_status');
      if (rawAi) setStoredAiSession(JSON.parse(rawAi));
    } catch (e) { }

    try {
      const rawEpds = localStorage.getItem('aanchal_submitted_epds_assessment');
      if (rawEpds) setStoredEpds(JSON.parse(rawEpds));
    } catch (e) { }

    try {
      const rawMm = localStorage.getItem('aanchal_multimodal_screening_result');
      if (rawMm) setStoredMultimodalResult(JSON.parse(rawMm));
    } catch (e) { }

    try {
      const rawCm = localStorage.getItem('aanchal_clinical_model_prediction');
      if (rawCm) setStoredClinicalModel(JSON.parse(rawCm));
    } catch (e) { }

    try {
      const rawPs = localStorage.getItem('aanchal_psychosocial_answers');
      if (rawPs) setStoredPsychosocial(JSON.parse(rawPs));
    } catch (e) { }
  }, []);

  const hasEpds = Boolean(storedEpds || screening?.summary?.totalScore !== undefined);
  const epdsScore = storedEpds ? storedEpds.totalScore : screening?.summary?.totalScore ?? null;
  const epdsSubmittedDate = storedEpds
    ? new Date(storedEpds.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : screening?.summary?.screeningDate || 'Recent';

  const hasAiSession = Boolean(storedAiSession?.hasRecording || storedMultimodalResult);
  const hasMultimodalInference = Boolean(storedMultimodalResult && storedMultimodalResult.fusion_score !== undefined);

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
          Unified overview of your AI screening, questionnaire score, and clinical care summaries.
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

          {hasMultimodalInference ? (
            <div className="result-modality-rows">
              <div className="result-modality-row">
                <div className="modality-row-label">
                  <PatientIcon name="mic" size={15} />
                  <strong>Audio Analysis</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ba1e53' }}>
                    {storedMultimodalResult.audio_score !== null ? `${Math.round(storedMultimodalResult.audio_score * 100)}%` : 'N/A'}
                  </span>
                  <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                    <span className="ai-status-dot" style={{ background: '#16a34a' }} />
                    <span>{storedMultimodalResult.modality_status?.audio === 'completed' ? 'Active Model' : 'Offline'}</span>
                  </span>
                </div>
              </div>

              <div className="result-modality-row">
                <div className="modality-row-label">
                  <PatientIcon name="video" size={15} />
                  <strong>Video Analysis</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ba1e53' }}>
                    {storedMultimodalResult.video_score !== null ? `${Math.round(storedMultimodalResult.video_score * 100)}%` : 'N/A'}
                  </span>
                  <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                    <span className="ai-status-dot" style={{ background: '#16a34a' }} />
                    <span>{storedMultimodalResult.modality_status?.video === 'completed' ? 'Active Model' : 'Offline'}</span>
                  </span>
                </div>
              </div>

              <div className="result-modality-row">
                <div className="modality-row-label">
                  <PatientIcon name="sparkles" size={15} />
                  <strong>Text Analysis</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ba1e53' }}>
                    {storedMultimodalResult.text_score !== null ? `${Math.round(storedMultimodalResult.text_score * 100)}%` : 'N/A'}
                  </span>
                  <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                    <span className="ai-status-dot" style={{ background: '#16a34a' }} />
                    <span>{storedMultimodalResult.modality_status?.text === 'completed' ? 'Active Model' : 'Offline'}</span>
                  </span>
                </div>
              </div>

              <div className="result-modality-row">
                <div className="modality-row-label">
                  <PatientIcon name="activity" size={15} />
                  <strong>Clinical Analysis</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ba1e53' }}>
                    {storedMultimodalResult.clinical_score !== undefined && storedMultimodalResult.clinical_score !== null
                      ? `${Math.round(storedMultimodalResult.clinical_score * 100)}%`
                      : storedClinicalModel?.predicted_probability !== undefined
                        ? `${Math.round(storedClinicalModel.predicted_probability * 100)}%`
                        : 'N/A'}
                  </span>
                  <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                    <span className="ai-status-dot" style={{ background: '#16a34a' }} />
                    <span>{storedMultimodalResult.modality_status?.clinical === 'completed' || storedClinicalModel ? 'Active Model' : 'Offline'}</span>
                  </span>
                </div>
              </div>

              <div className="result-modality-row is-fusion" style={{ background: '#fdf2f4', padding: '10px 12px', borderRadius: '8px', marginTop: '6px' }}>
                <div className="modality-row-label">
                  <PatientIcon name="ai-assistant" size={16} />
                  <strong>
                    {storedMultimodalResult.fusion_method === 'learned_stacking_four_modality'
                      ? 'Four-Modality Stacking Fusion'
                      : 'Learned Stacking Fusion'}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#ba1e53' }}>
                    {storedMultimodalResult.fusion_score !== null ? `${Math.round(storedMultimodalResult.fusion_score * 100)}%` : 'N/A'}
                  </span>
                  <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: '600' }}>
                    <span>Uncalibrated Research Score</span>
                  </span>
                </div>
              </div>

              {storedMultimodalResult.disagreement_flag && (
                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '8px 12px', borderRadius: '6px', marginTop: '8px', fontSize: '12px', color: '#92400e' }}>
                  <strong>⚠️ Algorithmic Modality Disagreement:</strong> {storedMultimodalResult.disagreement_details}
                </div>
              )}

              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#8d737e', fontStyle: 'italic', lineHeight: 1.4 }}>
                * {storedMultimodalResult.disclaimer || 'Experimental research prototype. Uncalibrated research risk score. Not a clinical diagnosis.'}
              </p>
            </div>
          ) : (
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

              <div className="result-modality-row">
                <div className="modality-row-label">
                  <PatientIcon name="activity" size={15} />
                  <strong>Clinical Analysis</strong>
                </div>
                {storedClinicalModel?.status === 'completed' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#ba1e53' }}>
                      {storedClinicalModel.predicted_risk_probability != null
                        ? `${Math.round(storedClinicalModel.predicted_risk_probability * 100)}%`
                        : storedClinicalModel.predicted_label || 'Completed'}
                    </span>
                    <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                      <span className="ai-status-dot" style={{ background: '#16a34a' }} />
                      <span>{storedClinicalModel.predicted_label ? `Evaluated (${storedClinicalModel.predicted_label})` : 'Active Model'}</span>
                    </span>
                  </div>
                ) : (
                  <span className="ai-status-pill is-pending">
                    <span className="ai-status-dot" />
                    <span>Awaiting Stage 1+2 Input</span>
                  </span>
                )}
              </div>

              <div className="result-modality-row is-fusion">
                <div className="modality-row-label">
                  <PatientIcon name="ai-assistant" size={15} />
                  <strong>Four-Modality Stacking Fusion</strong>
                </div>
                <span className="ai-status-pill is-pending">
                  <span className="ai-status-dot" />
                  <span>Awaiting model integration</span>
                </span>
              </div>
            </div>
          )}

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
              <span className="result-note-text">Video response captured for clinical evaluation</span>
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
                    <span className="epds-alert-pill">Question 10 non-zero response flagged</span>
                  )}
                </div>
              </div>

              <p className="epds-result-expl">
                This screening instrument helps reflect emotional wellbeing and symptoms over the past week.
                It does not replace a clinical consultation or diagnosis.
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

        {/* Card 3: Clinical ML Model (Random Forest Tabular Model) */}
        <section className="patient-card result-panel-card" aria-label="Clinical ML Model">
          <div className="result-panel-header">
            <div className="result-panel-title-wrap">
              <div className="result-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                <PatientIcon name="clipboard-check" size={20} />
              </div>
              <div>
                <h2 className="result-panel-title">Clinical Numerical Model</h2>
                <span className="result-panel-sub">Trained Random Forest (46 demographic &amp; psychosocial features)</span>
              </div>
            </div>

            <span className={`result-status-badge ${storedClinicalModel?.status === 'completed' ? 'is-completed' : 'is-pending'}`}>
              {storedClinicalModel?.status === 'completed' ? 'Model Evaluated' : 'Awaiting Stage 1+2 Input'}
            </span>
          </div>

          <div className="result-modality-rows">
            <div className="result-modality-row">
              <div className="modality-row-label">
                <PatientIcon name="sparkles" size={15} />
                <strong>Model Prediction</strong>
              </div>
              {storedClinicalModel?.status === 'completed' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#ba1e53' }}>
                    {storedClinicalModel.predicted_label || 'COMPLETED'}
                  </span>
                  <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a' }}>
                    <span>
                      {storedClinicalModel.predicted_risk_probability != null
                        ? `${(storedClinicalModel.predicted_risk_probability * 100).toFixed(1)}% probability`
                        : 'Evaluated'}
                    </span>
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#8d737e', fontStyle: 'italic' }}>
                    Pending Assessment
                  </span>
                  <span className="ai-status-pill is-pending">
                    <span className="ai-status-dot" />
                    <span>Awaiting Stage 1+2 Input</span>
                  </span>
                </div>
              )}
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <PatientIcon name="clipboard-check" size={15} />
                <strong>Feature Pipeline</strong>
              </div>
              <span style={{ fontSize: '13px', color: '#5c4750' }}>
                37 Stage 1 features + 9 Stage 2 factors
              </span>
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <PatientIcon name="heart" size={15} />
                <strong>Target Leakage Guard</strong>
              </div>
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                Zero EPDS Leakage (Strictly Independent)
              </span>
            </div>
          </div>

          <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#8d737e', fontStyle: 'italic', lineHeight: 1.4 }}>
            Evaluated by the pre-trained clinical numerical model. Kept strictly distinct from EPDS questionnaire scores.
          </p>
        </section>

        {/* Card 4: Mother's Wellbeing & Psychosocial Factors */}
        <section className="patient-card result-panel-card" aria-label="Mother's Wellbeing & Psychosocial Factors">
          <div className="result-panel-header">
            <div className="result-panel-title-wrap">
              <div className="result-panel-icon" style={{ background: '#fcebf0', color: '#ba1e53' }}>
                <PatientIcon name="heart" size={20} />
              </div>
              <div>
                <h2 className="result-panel-title">Wellbeing &amp; Support Context</h2>
                <span className="result-panel-sub">9 Stage 2 daily environmental factors</span>
              </div>
            </div>

            <span className={`result-status-badge ${storedPsychosocial ? 'is-completed' : 'is-pending'}`}>
              {storedPsychosocial ? 'Assessed' : 'Not Assessed'}
            </span>
          </div>

          <div className="result-modality-rows">
            <div className="result-modality-row">
              <div className="modality-row-label">
                <strong>Feeling on Motherhood</strong>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ba1e53' }}>
                {storedPsychosocial?.['Feeling about motherhood'] || 'Happy'}
              </span>
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <strong>Rest when Baby Asleep</strong>
              </div>
              <span style={{ fontSize: '13px', color: '#5c4750' }}>
                {storedPsychosocial?.['Relax/sleep when the newborn is asleep'] || 'Yes'}
              </span>
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <strong>Postpartum Irritability (Angry)</strong>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: storedPsychosocial?.['Angry after latest child birth'] === 'Yes' ? '#ba1e53' : '#16a34a' }}>
                {storedPsychosocial?.['Angry after latest child birth'] || 'No'}
              </span>
            </div>

            <div className="result-modality-row">
              <div className="modality-row-label">
                <strong>Daily Support Level</strong>
              </div>
              <span style={{ fontSize: '13px', color: '#5c4750' }}>
                {storedPsychosocial?.['Recieved Support'] ? `${storedPsychosocial['Recieved Support']} Support` : 'High Support'}
              </span>
            </div>
          </div>

          <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#8d737e', fontStyle: 'italic', lineHeight: 1.4 }}>
            Provides holistic context to your clinical team alongside your clinical profile and screening.
          </p>
        </section>
      </div>

      {/* ── Doctor Consultation Recommendation Card (Always accessible, not gated on ML integration) ── */}
      {(() => {
        let category = 'pending';
        if (hasEpds && epdsScore !== null) {
          if (epdsScore >= 13) category = 'high';
          else if (epdsScore >= 10) category = 'moderate';
          else category = 'low';
        }

        const consultConfig = {
          low: {
            categoryLabel: 'Low Risk Category',
            heading: 'Your Current Screening Result',
            message:
              'Your current screening session shows low-risk indicators. If you are still concerned about your emotional wellbeing, you can consult a healthcare professional.',
            buttonLabel: 'Consult a Doctor',
            badgeClass: 'is-low',
            cardClass: 'is-low',
          },
          moderate: {
            categoryLabel: 'Moderate Risk Category',
            heading: 'Professional Consultation Recommended',
            message:
              'Your screening session shows indicators that may benefit from further professional assessment.',
            buttonLabel: 'Find a Doctor',
            badgeClass: 'is-moderate',
            cardClass: 'is-moderate',
          },
          high: {
            categoryLabel: 'High Risk Category',
            heading: 'Professional Consultation Recommended',
            message:
              'Your screening session indicates that professional assessment may be helpful. We recommend consulting a qualified healthcare professional.',
            buttonLabel: 'Find a Doctor',
            badgeClass: 'is-high',
            cardClass: 'is-high',
          },
          pending: {
            categoryLabel: 'Doctor Consultation Available',
            heading: 'Consult a Healthcare Professional',
            message:
              'AI multimodal analysis is currently awaiting model integration and pending final clinical scoring. You can explore verified specialists, clinics, and hospital care teams at any time without waiting for AI processing.',
            buttonLabel: 'Find a Doctor',
            badgeClass: 'is-pending',
            cardClass: 'is-pending',
          },
        };

        const config = consultConfig[category];

        return (
          <section
            className={`patient-card results-consult-card ${config.cardClass}`}
            aria-label="Doctor Consultation Recommendation"
            data-testid="results-consultation-card"
          >
            <div className="results-consult-inner">
              <div className={`results-consult-icon-pill ${config.badgeClass}`} aria-hidden="true">
                <PatientIcon name="stethoscope" size={24} />
              </div>

              <div className="results-consult-content">
                <div className="results-consult-top-meta">
                  <span className={`results-consult-pill ${config.badgeClass}`}>
                    {config.categoryLabel}
                  </span>
                  <span className="results-consult-ml-notice">
                    AI models awaiting integration • Consultation permanently accessible
                  </span>
                </div>

                <h3 className="results-consult-heading">{config.heading}</h3>
                <p className="results-consult-message">{config.message}</p>

                <p className="results-consult-note">
                  <strong>Important:</strong> Screening is not a clinical diagnosis and does not replace medical advice. Always consult a qualified healthcare provider for clinical evaluation.
                </p>

                <div className="results-consult-actions">
                  <button
                    type="button"
                    className="patient-btn-primary results-consult-cta"
                    onClick={() => navigate('/patient/find-doctor')}
                    data-testid="consult-doctor-btn"
                    aria-label={`${config.buttonLabel} — navigate to doctor directory`}
                  >
                    <PatientIcon name="stethoscope" size={16} />
                    <span>{config.buttonLabel}</span>
                    <PatientIcon name="arrow-right" size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

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
                    {hasMultimodalInference ? (
                      <span className="ai-status-pill is-completed" style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: '600' }}>
                        Fusion Score: {Math.round(storedMultimodalResult.fusion_score * 100)}%
                      </span>
                    ) : (
                      <span className="ai-status-pill is-pending">
                        <span className="ai-status-dot" />
                        <span>Awaiting model integration</span>
                      </span>
                    )}
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