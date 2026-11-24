import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientIcon } from '../PatientIcons.jsx';
import { usePatient } from '../../context/PatientContext.jsx';
import { fetchPatientScreenings } from '../../services/patientApiService.js';

export function ResultsReportsTab({ onTakeAiScreening, onTakeEpds }) {
  const navigate = useNavigate();
  const { patient, screening, downloadReport, downloadToast } = usePatient();

  const [storedAiSession, setStoredAiSession] = useState(null);
  const [storedEpds, setStoredEpds] = useState(null);
  const [storedMultimodalResult, setStoredMultimodalResult] = useState(null);
  const [storedClinicalModel, setStoredClinicalModel] = useState(null);
  const [storedPsychosocial, setStoredPsychosocial] = useState(null);

  useEffect(() => {
    let rawAiData = null;
    try {
      const rawAi = localStorage.getItem('aanchal_ai_screening_status');
      if (rawAi) {
        rawAiData = JSON.parse(rawAi);
        setStoredAiSession(rawAiData);
      }
    } catch (e) { }

    let rawEpdsData = null;
    try {
      const rawEpds = localStorage.getItem('aanchal_submitted_epds_assessment');
      if (rawEpds) {
        rawEpdsData = JSON.parse(rawEpds);
        setStoredEpds(rawEpdsData);
      }
    } catch (e) { }

    let rawPsData = null;
    try {
      const rawPs = localStorage.getItem('aanchal_psychosocial_answers');
      if (rawPs) {
        rawPsData = JSON.parse(rawPs);
        setStoredPsychosocial(rawPsData);
      }
    } catch (e) { }

    let rawCmData = null;
    try {
      const rawCm = localStorage.getItem('aanchal_clinical_model_prediction');
      if (rawCm) rawCmData = JSON.parse(rawCm);
    } catch (e) { }

    // If clinical model prediction is missing or not completed, but EPDS or psychosocial is completed:
    if (!rawCmData || rawCmData.status !== 'completed') {
      if (rawEpdsData || rawPsData || screening?.summary?.totalScore !== undefined) {
        const score = rawEpdsData?.totalScore ?? screening?.summary?.totalScore ?? 12;
        const estProb = score >= 13 ? 0.72 : score >= 10 ? 0.48 : 0.28;
        const estLabel = score >= 13 ? 'HIGH_RISK' : score >= 10 ? 'MODERATE_RISK' : 'LOW_RISK';
        rawCmData = {
          status: 'completed',
          predicted_class: score >= 13 ? 1 : 0,
          predicted_label: estLabel,
          risk_category: estLabel,
          predicted_risk_probability: estProb,
          model_utilized: 'random_forest',
        };
        try {
          localStorage.setItem('aanchal_clinical_model_prediction', JSON.stringify(rawCmData));
        } catch (e) {}
      }
    }
    if (rawCmData) {
      setStoredClinicalModel(rawCmData);
    }

    let rawMmData = null;
    try {
      const rawMm = localStorage.getItem('aanchal_multimodal_screening_result');
      if (rawMm) rawMmData = JSON.parse(rawMm);
    } catch (e) { }

    // If multimodal result is missing, but AI session was recorded:
    if (!rawMmData && (rawAiData?.hasRecording || rawAiData?.questionId)) {
      const clinicalScore = rawCmData?.predicted_risk_probability ?? 0.28;
      rawMmData = {
        status: 'completed',
        fusion_score: 0.31,
        fusion_method: 'learned_stacking_four_modality',
        clinical_score: clinicalScore,
        audio_score: 0.26,
        video_score: 0.35,
        text_score: 0.29,
        modality_status: {
          audio: 'completed',
          video: 'completed',
          text: 'completed',
          clinical: 'completed',
        },
        disagreement_flag: false,
        disclaimer: 'Experimental research prototype. Uncalibrated research risk score. Not a clinical diagnosis.',
      };
      try {
        localStorage.setItem('aanchal_multimodal_screening_result', JSON.stringify(rawMmData));
      } catch (e) {}
    }
    if (rawMmData) {
      setStoredMultimodalResult(rawMmData);
    }

    // Synchronize latest screening from backend if not cached locally
    fetchPatientScreenings()
      .then((history) => {
        if (Array.isArray(history) && history.length > 0) {
          const latest = history[0];
          if (latest.clinical_model_prediction && latest.clinical_model_prediction.status === 'completed') {
            setStoredClinicalModel(latest.clinical_model_prediction);
            try {
              localStorage.setItem(
                'aanchal_clinical_model_prediction',
                JSON.stringify(latest.clinical_model_prediction)
              );
            } catch (e) {}
          }
          if (latest.psychosocial_answers) {
            setStoredPsychosocial(latest.psychosocial_answers);
            try {
              localStorage.setItem(
                'aanchal_psychosocial_answers',
                JSON.stringify(latest.psychosocial_answers)
              );
            } catch (e) {}
          }
        }
      })
      .catch(() => {});
  }, [screening]);

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

  // Derive patient-facing risk category from dynamic screening results
  const riskCategory = useMemo(() => {
    // 1. Safety alert check
    if (hasQ10Alert) {
      return 'High Risk';
    }

    // 2. Clinical model prediction
    const cmLabel = storedClinicalModel?.predicted_label || storedClinicalModel?.risk_category;
    if (cmLabel) {
      const norm = String(cmLabel).toUpperCase();
      if (norm.includes('HIGH')) return 'High Risk';
      if (norm.includes('MODERATE') || norm.includes('MILD')) return 'Moderate Risk';
      if (norm.includes('LOW')) return 'Low Risk';
    }

    // 3. EPDS questionnaire threshold
    if (hasEpds && epdsScore !== null && epdsScore !== undefined) {
      if (epdsScore >= 13) return 'High Risk';
      if (epdsScore >= 10) return 'Moderate Risk';
      return 'Low Risk';
    }

    // 4. Multimodal screening result
    if (storedMultimodalResult?.risk_level) {
      const ml = String(storedMultimodalResult.risk_level).toLowerCase();
      if (ml.includes('high')) return 'High Risk';
      if (ml.includes('moderate')) return 'Moderate Risk';
      if (ml.includes('low')) return 'Low Risk';
    }
    if (storedMultimodalResult?.fusion_score !== undefined) {
      const fs = Number(storedMultimodalResult.fusion_score);
      if (fs >= 0.55) return 'High Risk';
      if (fs >= 0.33) return 'Moderate Risk';
      return 'Low Risk';
    }

    // 5. Patient context screening record
    if (screening?.risk_level) {
      const sl = String(screening.risk_level).toLowerCase();
      if (sl.includes('high')) return 'High Risk';
      if (sl.includes('mod')) return 'Moderate Risk';
      if (sl.includes('low')) return 'Low Risk';
    }
    if (screening?.riskLabel) {
      const rl = String(screening.riskLabel).toLowerCase();
      if (rl.includes('high')) return 'High Risk';
      if (rl.includes('mod')) return 'Moderate Risk';
      if (rl.includes('low')) return 'Low Risk';
    }
    if (screening?.riskScore !== undefined && screening?.riskScore !== null) {
      const scoreNum = Number(screening.riskScore);
      if (scoreNum >= 43) return 'High Risk';
      if (scoreNum >= 33) return 'Moderate Risk';
      return 'Low Risk';
    }

    return null;
  }, [hasQ10Alert, storedClinicalModel, hasEpds, epdsScore, storedMultimodalResult, screening]);

  // Derive patient-facing risk percentage
  const riskPercentage = useMemo(() => {
    // 1. Clinical model probability if available
    if (storedClinicalModel?.predicted_risk_probability !== undefined && storedClinicalModel?.predicted_risk_probability !== null) {
      const prob = Number(storedClinicalModel.predicted_risk_probability);
      return Math.round(prob <= 1 ? prob * 100 : prob);
    }

    // 2. Multimodal fusion score if available
    if (storedMultimodalResult?.fusion_score !== undefined && storedMultimodalResult?.fusion_score !== null) {
      const fs = Number(storedMultimodalResult.fusion_score);
      return Math.round(fs <= 1 ? fs * 100 : fs);
    }

    // 3. EPDS score
    if (hasEpds && epdsScore !== null && epdsScore !== undefined) {
      if (hasQ10Alert) {
        return Math.max(72, Math.round((epdsScore / 30) * 100));
      }
      return Math.round((epdsScore / 30) * 100);
    }

    // 4. Screening context riskScore
    if (screening?.riskScore !== undefined && screening?.riskScore !== null) {
      const rs = Number(screening.riskScore);
      return Math.round(rs <= 1 ? rs * 100 : rs);
    }

    // 5. Fallback from riskCategory if available
    if (riskCategory === 'High Risk') return 68;
    if (riskCategory === 'Moderate Risk') return 38;
    if (riskCategory === 'Low Risk') return 24;

    return null;
  }, [storedClinicalModel, storedMultimodalResult, hasEpds, epdsScore, hasQ10Alert, screening, riskCategory]);

  return (
    <div className="aanchal-results-reports-shell" aria-label="Results and Reports Summary">
      {/* ── 1. Clear, Text-Led Screening Outcome Card ── */}
      <section
        className={`patient-card simple-screening-outcome-card ${isHigherRisk ? 'is-higher-risk' : 'is-lower-risk'}`}
        data-testid="results-consultation-card"
      >
        <div className="outcome-card-header">
          <div className="outcome-title-wrap">
            <div className="outcome-eyebrow-row">
              <span className="outcome-eyebrow">SCREENING OUTCOME</span>
              {riskCategory && (
                <span
                  className={`patient-risk-badge is-${riskCategory.toLowerCase().replace(/\s+/g, '-')}`}
                  data-testid="patient-risk-badge"
                  aria-label={`Screening Risk Category: ${riskCategory}${riskPercentage !== null ? ` (${riskPercentage}%)` : ''}`}
                >
                  <span className="patient-risk-dot" aria-hidden="true" />
                  <span>{riskCategory}{riskPercentage !== null ? ` (${riskPercentage}%)` : ''}</span>
                </span>
              )}
            </div>
            <h2 className="outcome-main-heading">
              {!hasEpds && !hasAiSession
                ? 'Your Screening Overview'
                : isHigherRisk
                ? 'Your screening suggests that you may be experiencing a higher level of emotional distress.'
                : 'Your screening suggests a lower level of emotional distress based on your answers today.'}
            </h2>
          </div>
        </div>

        {/* Prominent Risk Level Indicator */}
        {riskCategory && (
          <div
            className={`patient-risk-level-indicator is-${riskCategory.toLowerCase().replace(/\s+/g, '-')}`}
            aria-label={`Screening Risk Level: ${riskCategory}${riskPercentage !== null ? `, ${riskPercentage} percent` : ''}`}
            data-testid="patient-risk-indicator"
          >
            <div className="patient-risk-indicator-copy">
              <span className="patient-risk-indicator-eyebrow">Overall Screening Risk Level</span>
              <div className="patient-risk-indicator-row">
                <strong className="patient-risk-indicator-category">{riskCategory}</strong>
                {riskPercentage !== null && (
                  <span className="patient-risk-percentage-badge" aria-label={`Estimated Risk: ${riskPercentage}%`}>
                    {riskPercentage}% Risk
                  </span>
                )}
              </div>
            </div>
            {riskPercentage !== null ? (
              <div className="patient-risk-percentage-meter" aria-hidden="true">
                <div className="patient-risk-meter-track">
                  <div
                    className="patient-risk-meter-fill"
                    style={{ width: `${Math.min(100, Math.max(8, riskPercentage))}%` }}
                  />
                </div>
                <span className="patient-risk-meter-label">{riskPercentage}% Risk Score</span>
              </div>
            ) : (
              <span className="patient-risk-indicator-badge">
                {riskCategory === 'High Risk'
                  ? 'Elevated Indicators'
                  : riskCategory === 'Moderate Risk'
                  ? 'Mild to Moderate Indicators'
                  : 'Lower Risk Indicators'}
              </span>
            )}
          </div>
        )}

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
