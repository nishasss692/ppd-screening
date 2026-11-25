import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientIcon } from '../PatientIcons.jsx';
import { usePatient } from '../../context/PatientContext.jsx';
import { fetchPatientScreenings } from '../../services/patientApiService.js';

export function ResultsReportsTab({ onTakeAiScreening, onTakeEpds }) {
  const navigate = useNavigate();
  const { patient, screening, consultationReports = [], downloadReport, downloadToast } = usePatient();

  const [storedAiSession, setStoredAiSession] = useState(null);
  const [storedEpds, setStoredEpds] = useState(null);
  const [storedMultimodalResult, setStoredMultimodalResult] = useState(null);
  const [storedClinicalModel, setStoredClinicalModel] = useState(null);

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

    let rawCmData = null;
    try {
      const rawCm = localStorage.getItem('aanchal_clinical_model_prediction');
      if (rawCm) {
        rawCmData = JSON.parse(rawCm);
        setStoredClinicalModel(rawCmData);
      }
    } catch (e) { }

    let rawMmData = null;
    try {
      const rawMm = localStorage.getItem('aanchal_multimodal_screening_result');
      if (rawMm) {
        rawMmData = JSON.parse(rawMm);
        setStoredMultimodalResult(rawMmData);
      }
    } catch (e) { }

    // Synchronize latest screening from backend if available
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
            } catch (e) { }
          }
        }
      })
      .catch(() => { });
  }, [screening]);

  const hasEpds = Boolean(storedEpds || screening?.summary?.totalScore !== undefined);
  const epdsScore = storedEpds ? storedEpds.totalScore : screening?.summary?.totalScore ?? null;
  const hasAiSession = Boolean(storedAiSession?.hasRecording || storedMultimodalResult);
  const hasAnyAssessment = Boolean(hasEpds || hasAiSession || storedClinicalModel?.status === 'completed');

  // Compute single unified Risk Percentage & Risk Category (Low / Moderate / High Risk)
  const { riskPercentage, riskLevel, riskKey } = useMemo(() => {
    if (!hasAnyAssessment) {
      return { riskPercentage: null, riskLevel: 'Pending', riskKey: 'pending' };
    }

    let pct = null;
    if (typeof storedMultimodalResult?.fusion_score === 'number') {
      pct = Math.round(storedMultimodalResult.fusion_score * 100);
    } else if (typeof storedClinicalModel?.predicted_risk_probability === 'number') {
      pct = Math.round(storedClinicalModel.predicted_risk_probability * 100);
    } else if (typeof storedClinicalModel?.predicted_probability === 'number') {
      pct = Math.round(storedClinicalModel.predicted_probability * 100);
    } else if (typeof epdsScore === 'number') {
      pct = Math.round((epdsScore / 30) * 100);
    } else {
      pct = 28;
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

  const submittedDate = storedEpds?.submittedAt
    ? new Date(storedEpds.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : screening?.summary?.screeningDate || 'Today';

  const riskBadgeStyle =
    riskKey === 'high'
      ? { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
      : riskKey === 'moderate'
        ? { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }
        : riskKey === 'low'
          ? { background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0' }
          : { background: '#f5f0f2', color: '#66535c', border: '1px solid #e7d8de' };

  const consultConfig = {
    low: {
      categoryLabel: 'Low Risk',
      heading: 'Your Screening Result',
      message:
        'Your screening indicates a low level of distress. If you have any concerns about your emotional wellbeing, you can always consult a healthcare professional.',
      buttonLabel: 'Consult a Doctor',
      badgeClass: 'is-low',
      cardClass: 'is-low',
    },
    moderate: {
      categoryLabel: 'Moderate Risk',
      heading: 'Professional Consultation Recommended',
      message:
        'Your screening indicates moderate distress that may benefit from speaking with a qualified healthcare professional.',
      buttonLabel: 'Find a Doctor',
      badgeClass: 'is-moderate',
      cardClass: 'is-moderate',
    },
    high: {
      categoryLabel: 'High Risk',
      heading: 'Professional Consultation Recommended',
      message:
        'Your screening indicates elevated distress. We strongly recommend consulting a qualified healthcare professional for supportive care.',
      buttonLabel: 'Find a Doctor',
      badgeClass: 'is-high',
      cardClass: 'is-high',
    },
    pending: {
      categoryLabel: 'Pending Assessment',
      heading: 'Consult a Healthcare Professional',
      message:
        'Complete your screening to view your risk summary, or explore verified doctors and clinics at any time.',
      buttonLabel: 'Find a Doctor',
      badgeClass: 'is-pending',
      cardClass: 'is-pending',
    },
  }[riskKey];

  return (
    <div className="aanchal-results-reports-shell" aria-label="Results and Reports Summary">
      {/* Simplified Patient Risk Summary Card */}
      <section className="patient-card" aria-label="Screening Risk Result" style={{ padding: '28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="miora-dash-eyebrow" style={{ marginBottom: '6px' }}>
              <span>SCREENING RESULT</span>
              <span className="miora-dash-eyebrow-line" aria-hidden="true" />
            </div>
            <h2 className="patient-page-heading" style={{ fontSize: '22px', margin: 0 }}>
              Your Wellbeing Risk Summary
            </h2>
            {hasAnyAssessment && (
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#8d737e' }}>
                Completed on {submittedDate}
              </p>
            )}
          </div>

          {hasAnyAssessment ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '50%',
                  background: '#fdf2f4',
                  border: '3px solid #ba1e53',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '26px', fontWeight: '800', color: '#ba1e53', lineHeight: 1 }}>
                  {riskPercentage}%
                </span>
                <span style={{ fontSize: '11px', color: '#8d737e', marginTop: '2px' }}>Risk</span>
              </div>

              <div>
                <span
                  style={{
                    ...riskBadgeStyle,
                    display: 'inline-block',
                    padding: '8px 18px',
                    borderRadius: '999px',
                    fontSize: '15px',
                    fontWeight: '700',
                  }}
                >
                  {riskLevel}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  ...riskBadgeStyle,
                  display: 'inline-block',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                Pending
              </span>
              {onTakeEpds && (
                <button type="button" className="patient-btn-primary" onClick={onTakeEpds}>
                  <span>Start Questionnaire</span>
                  <PatientIcon name="arrow-right" size={15} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Q10 Crisis Safety Alert (Never hidden or overridden) */}
        {storedEpds?.q10Alert && (
          <div className="patient-notice-banner is-error epds-q10-crisis-box" role="alert" style={{ marginTop: '20px' }}>
            <div className="q10-crisis-head">
              <PatientIcon name="bell" size={20} color="#991b1b" />
              <strong>24/7 Immediate Emotional Support &amp; Crisis Safety</strong>
            </div>
            <p>
              Please know you are not alone and compassionate help is available immediately.
            </p>
            <div className="q10-crisis-hotline">
              <span className="hotline-badge">National Tele-MANAS Helpline</span>
              <strong>14416 / 1800-891-4416 (Toll-Free, 24/7)</strong>
            </div>
          </div>
        )}
      </section>

      {/* Doctor Consultation Card */}
      <section
        className={`patient-card results-consult-card ${consultConfig.cardClass}`}
        aria-label="Doctor Consultation Recommendation"
        data-testid="results-consultation-card"
      >
        <div className="results-consult-inner">
          <div className={`results-consult-icon-pill ${consultConfig.badgeClass}`} aria-hidden="true">
            <PatientIcon name="stethoscope" size={24} />
          </div>

          <div className="results-consult-content">
            <div className="results-consult-top-meta">
              <span className={`results-consult-pill ${consultConfig.badgeClass}`}>
                {consultConfig.categoryLabel}
              </span>
            </div>

            <h3 className="results-consult-heading">{consultConfig.heading}</h3>
            <p className="results-consult-message">{consultConfig.message}</p>

            <div className="results-consult-actions">
              <button
                type="button"
                className="patient-btn-primary results-consult-cta"
                onClick={() => navigate('/patient/find-doctor')}
                data-testid="consult-doctor-btn"
                aria-label={`${consultConfig.buttonLabel} — navigate to doctor directory`}
              >
                <PatientIcon name="stethoscope" size={16} />
                <span>{consultConfig.buttonLabel}</span>
                <PatientIcon name="arrow-right" size={16} />
              </button>
              {hasAnyAssessment && (
                <button
                  type="button"
                  className="patient-btn-secondary"
                  onClick={() =>
                    downloadReport &&
                    downloadReport({
                      id: 'rep-pdf',
                      title: 'Screening Summary Report',
                      filename: 'AANCHAL_Screening_Report.pdf',
                      type: 'pdf',
                      authorized: true,
                      format: '.pdf',
                    })
                  }
                >
                  <PatientIcon name="download" size={15} />
                  <span>Download Summary PDF</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {downloadToast && (
        <div className="patient-notice-banner is-success" role="status" style={{ marginTop: 16 }}>
          {typeof downloadToast === 'string' ? downloadToast : downloadToast?.message}
        </div>
      )}

      {/* Doctor Consultation Reports (Written by Doctor) */}
      {consultationReports.length > 0 && (
        <section className="patient-card results-history-card" aria-label="Doctor Consultation Reports" style={{ marginTop: 20 }}>
          <div className="history-card-head">
            <div>
              <h2 className="result-panel-title">Doctor Consultation Reports</h2>
              <p className="result-panel-sub">Care summaries published by your doctor</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {consultationReports.map((rep) => (
              <div
                key={rep.id}
                style={{
                  border: '1px solid #f2dce4',
                  borderRadius: 10,
                  padding: '14px 16px',
                  background: '#fffbfc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong style={{ color: '#2b1b22', fontSize: 15 }}>
                      {rep.doctor_name} ({rep.report_code})
                    </strong>
                    <div style={{ fontSize: 12, color: '#8d737e' }}>
                      {rep.hospital_name} &bull; {rep.consultation_date}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="patient-btn-table-action"
                    onClick={() =>
                      downloadReport &&
                      downloadReport({
                        id: rep.id,
                        title: `Consultation Report ${rep.report_code}`,
                        filename: `AANCHAL_Consultation_${rep.report_code}.txt`,
                        type: 'consultation',
                        authorized: true,
                        format: '.txt',
                      })
                    }
                  >
                    <PatientIcon name="download" size={14} />
                    <span>Download Report</span>
                  </button>
                </div>
                {rep.summary && (
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#4a3d42', lineHeight: 1.5 }}>
                    {rep.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export default ResultsReportsTab;
