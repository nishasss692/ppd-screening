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

  // Question 10 Flag check
  const hasQ10Alert = Boolean(storedEpds?.q10Alert || storedEpds?.answers?.q10 > 0);

  // Derive dynamic risk classification
  let isHigherRisk = false;
  if (hasEpds && epdsScore !== null) {
    if (epdsScore >= 10 || hasQ10Alert) {
      isHigherRisk = true;
    }
  } else if (storedClinicalModel?.predicted_label === 'HIGH_RISK') {
    isHigherRisk = true;
  }

  return (
    <div className="aanchal-results-reports-shell" aria-label="Results and Reports Summary">
      {/* ── 1. Clear, Text-Led Screening Outcome Card ── */}
      <section
        className={`patient-card simple-screening-outcome-card ${isHigherRisk ? 'is-higher-risk' : 'is-lower-risk'}`}
        data-testid="results-consultation-card"
      >
        <div className="outcome-card-header">
          <div className="outcome-title-wrap">
            <span className="outcome-eyebrow">SCREENING OUTCOME</span>
            <h2 className="outcome-main-heading">
              {!hasEpds && !hasAiSession
                ? 'Your Screening Overview'
                : isHigherRisk
                ? 'Your screening suggests that you may be experiencing a higher level of emotional distress.'
                : 'Your screening suggests a lower level of emotional distress based on your answers today.'}
            </h2>
          </div>
        </div>

        <p className="outcome-main-description">
          {!hasEpds && !hasAiSession
            ? 'Complete your AI screening session or EPDS questionnaire below to receive a personalized summary of your emotional wellbeing.'
            : isHigherRisk
            ? 'It may be helpful to speak with a qualified healthcare professional for further assessment and support.'
            : 'This is encouraging, but it does not mean that you cannot be experiencing emotional difficulties. If you feel worried, overwhelmed, sad or simply need support, please consider speaking with a healthcare professional.'}
        </p>

        {/* ── 2. Professional Consultation Section (Placed directly here) ── */}
        <div className="outcome-consultation-box">
          <h3 className="outcome-consult-heading">Professional Consultation Recommended</h3>
          <p className="outcome-consult-description">
            Speaking with a healthcare professional can help you understand how you are feeling and explore the support available to you. You can consult a healthcare professional regardless of whether your screening result is lower or higher risk.
          </p>
          <div className="outcome-consult-actions">
            <button
              type="button"
              className="patient-btn-primary outcome-find-doctor-btn"
              onClick={() => navigate('/patient/find-doctor')}
              data-testid="consult-doctor-btn"
              aria-label="Find a Doctor — navigate to doctor directory"
            >
              <span>Find a Doctor</span>
              <PatientIcon name="arrow-right" size={16} />
            </button>
          </div>
        </div>

        {/* ── 3. Screening Disclaimer (Conditional display) ── */}
        <div className="screening-result-disclaimer-box" role="note">
          <p>
            <strong>AANCHAL is a screening tool, not a medical diagnosis.</strong>
            {!isHigherRisk && (
              <>
                {' '}A lower-risk result does not rule out postpartum depression or other emotional health concerns. We recommend consulting a qualified healthcare professional regardless of your screening result.
              </>
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
          </p>
        </div>
      </section>

      {/* ── 4. Simplified Assessment Cards Grid (Text-led headers, no icons) ── */}
      <div className="results-simplified-grid">
        {/* Card 1: Your EPDS Screening */}
        <section className="patient-card results-clean-card" aria-label="EPDS Score">
          <div className="clean-card-header">
            <div>
              <h2 className="clean-card-title" aria-label="EPDS Score" style={{ fontSize: 16 }}>Your EPDS Screening</h2>
              <span className="clean-card-sub">Validated 10-item wellbeing screening</span>
            </div>
            <span className={`clean-card-badge ${hasEpds ? 'is-completed' : 'is-pending'}`}>
              {hasEpds ? 'Completed' : 'Pending'}
            </span>
          </div>

          {hasEpds ? (
            <div className="clean-card-body">
              <div className="epds-clean-score-display">
                <div className="epds-score-number">
                  <span className="score-primary">{epdsScore}</span>
                  <span className="score-denom">/30</span>
                </div>
                <div className="epds-score-status-text">
                  <strong>
                    {epdsScore < 10 && 'Lower distress range'}
                    {epdsScore >= 10 && epdsScore < 13 && 'Mild distress range'}
                    {epdsScore >= 13 && 'Elevated distress range'}
                  </strong>
                  <span className="epds-date-stamp">Completed: {epdsSubmittedDate} • {epdsScore} out of 30</span>
                </div>
              </div>

              <p className="clean-card-explanation">
                {epdsScore < 10 &&
                  'Your score reflects mild or minimal symptoms over the past week. Continuing to monitor how you feel and staying connected with your loved ones is encouraged.'}
                {epdsScore >= 10 && epdsScore < 13 &&
                  'Your score suggests you may be navigating mild emotional distress. Sharing how you are feeling with your healthcare provider can provide clarity and relief.'}
                {epdsScore >= 13 &&
                  'Your score reflects elevated emotional symptoms that deserve gentle, compassionate support and professional medical guidance.'}
              </p>
            </div>
          ) : (
            <div className="clean-card-empty">
              <p>No EPDS assessment has been completed yet for this period.</p>
              <button
                type="button"
                className="patient-btn-primary"
                onClick={onTakeEpds}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Start EPDS Questionnaire</span>
                <PatientIcon name="arrow-right" size={15} />
              </button>
            </div>
          )}
        </section>

        {/* Card 2: AI Screening Session */}
        <section className="patient-card results-clean-card" aria-label="AI Screening Results">
          <div className="clean-card-header">
            <div>
              <h2 className="clean-card-title" aria-label="AI Screening Results" style={{ fontSize: 16 }}>AI Screening Session</h2>
              <span className="clean-card-sub">Conversational check-in</span>
            </div>
            <span className={`clean-card-badge ${hasAiSession ? 'is-completed' : 'is-pending'}`}>
              {hasAiSession ? 'Recorded' : 'Pending'}
            </span>
          </div>

          <div className="clean-card-body">
            {hasAiSession ? (
              <>
                <div className="ai-session-recorded-notice">
                  <div className="recorded-dot" />
                  <strong>Your screening session has been recorded.</strong>
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

                <div className="ai-components-status-list">
                  <div className="ai-status-row">
                    <span>Multimodal Analysis</span>
                    <span className={`ai-status-text ${hasMultimodalInference ? 'is-ok' : 'is-pending'}`}>
                      {hasMultimodalInference ? 'Analysis Available' : 'Analysis not available yet'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="clean-card-empty">
                <p>A private, conversational check-in to express your feelings naturally.</p>
                <button
                  type="button"
                  className="patient-btn-secondary"
                  onClick={onTakeAiScreening}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Record AI Screening</span>
                  <PatientIcon name="arrow-right" size={15} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Card 3: Your Wellbeing & Support */}
        <section className="patient-card results-clean-card" aria-label="Wellbeing & Support Context">
          <div className="clean-card-header">
            <div>
              <h2 className="clean-card-title" style={{ fontSize: 16 }}>Your Wellbeing &amp; Support</h2>
              <span className="clean-card-sub">Daily environment and rest factors</span>
            </div>
            <span className={`clean-card-badge ${storedPsychosocial ? 'is-completed' : 'is-pending'}`}>
              {storedPsychosocial ? 'Assessed' : 'Not Assessed'}
            </span>
          </div>

          <div className="clean-card-body">
            {storedPsychosocial ? (
              <div className="psychosocial-summary-list">
                <div className="psychosocial-summary-item">
                  <span className="summary-label">Feelings about motherhood</span>
                  <span className="summary-value">
                    {storedPsychosocial['Feeling about motherhood'] || 'Generally positive'}
                  </span>
                </div>
                <div className="psychosocial-summary-item">
                  <span className="summary-label">Rest and sleep</span>
                  <span className="summary-value">
                    {storedPsychosocial['Relax/sleep when the newborn is asleep'] === 'Yes'
                      ? 'Able to rest when baby sleeps'
                      : 'Resting when possible'}
                  </span>
                </div>
                <div className="psychosocial-summary-item">
                  <span className="summary-label">Daily support</span>
                  <span className="summary-value">
                    {storedPsychosocial['Recieved Support']
                      ? `${storedPsychosocial['Recieved Support']} Support`
                      : 'Support available'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="clean-card-empty">
                <p>Complete the Wellbeing &amp; Support check-in to share context about your home and sleep.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 5. Assessment History & Available Reports ── */}
      <section className="patient-card results-reports-table-card" aria-label="Assessment History & Reports">
        <div className="results-table-header">
          <div>
            <h3 className="results-table-title">Assessment History &amp; Reports</h3>
            <p className="results-table-sub">
              Records of your completed maternal wellbeing check-ins and clinical summaries.
            </p>
          </div>
        </div>

        {downloadToast && (
          <div className="patient-notice-banner is-success" role="status" style={{ marginBottom: 16 }}>
            {downloadToast}
          </div>
        )}

        {/* Responsive Table / Card Container */}
        <div className="results-table-container">
          <table className="results-summary-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Assessment Type</th>
                <th>EPDS Score</th>
                <th>Status</th>
                <th>Action</th>
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
                    <span className="patient-history-status is-completed">
                      Completed
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
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#8d737e' }}>
                    No prior assessments recorded. Complete your first screening to see your history and download clinical reports here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 6. Emergency Support – Dedicated Section at the Very Bottom ── */}
      <section className="patient-card results-emergency-support-card" aria-label="Immediate Support Helpline">
        <div className="emergency-support-header">
          <h3 className="emergency-support-title">Support Is Available Immediately</h3>
        </div>
        <p className="emergency-support-desc">
          If you are feeling overwhelmed, hopeless, or concerned for your safety or your baby&apos;s wellbeing, please reach out for immediate, confidential support. Help is available 24 hours a day, 7 days a week.
        </p>
        <div className="emergency-support-helplines">
          <div className="emergency-helpline-item">
            <div className="helpline-meta">
              <strong>Tele-MANAS National Mental Health Helpline</strong>
              <span>Toll-free 24/7 tele-counseling support across India</span>
            </div>
            <a href="tel:14416" className="patient-btn-helpline">
              <span>Call 14416</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ResultsReportsTab;
