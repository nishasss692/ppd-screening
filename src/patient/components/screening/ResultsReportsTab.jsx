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
    try {
      const rawAi = localStorage.getItem('aanchal_ai_screening_status');
      if (rawAi) setStoredAiSession(JSON.parse(rawAi));
    } catch (e) { }

    try {
      const rawEpds = localStorage.getItem('aanchal_submitted_epds_assessment');
      if (rawEpds) setStoredEpds(JSON.parse(rawEpds));
    } catch (e) { }

    try {
      const rawCm = localStorage.getItem('aanchal_clinical_model_prediction');
      if (rawCm) setStoredClinicalModel(JSON.parse(rawCm));
    } catch (e) { }

    try {
      const rawMm = localStorage.getItem('aanchal_multimodal_screening_result');
      if (rawMm) setStoredMultimodalResult(JSON.parse(rawMm));
    } catch (e) { }

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
  const hasQ10Alert = Boolean(storedEpds?.q10Alert || storedEpds?.answers?.q10 > 0);

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
    } else if (typeof storedMultimodalResult?.text_score === 'number') {
      pct = Math.round(storedMultimodalResult.text_score * 100);
    } else {
      pct = 28;
    }

    let key = 'low';
    let label = 'Low Risk';
    if (
      hasQ10Alert ||
      (typeof epdsScore === 'number' && epdsScore >= 13) ||
      storedClinicalModel?.predicted_label === 'HIGH_RISK' ||
      pct >= 60
    ) {
      key = 'high';
      label = 'High Risk';
    } else if (
      (typeof epdsScore === 'number' && epdsScore >= 10) ||
      storedClinicalModel?.predicted_label === 'MODERATE_RISK' ||
      pct >= 35
    ) {
      key = 'moderate';
      label = 'Moderate Risk';
    }

    return { riskPercentage: pct, riskLevel: label, riskKey: key };
  }, [hasAnyAssessment, hasQ10Alert, storedMultimodalResult, storedClinicalModel, epdsScore]);

  const isHigherRisk = Boolean(
    (typeof epdsScore === 'number' && epdsScore >= 10) ||
    hasQ10Alert ||
    storedClinicalModel?.predicted_label === 'HIGH_RISK' ||
    riskKey === 'high' ||
    riskKey === 'moderate'
  );

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

  return (
    <div className="aanchal-results-reports-shell" aria-label="Results and Reports Summary">
      {/* Simplified Patient Risk Summary Card */}
      <section className="patient-card" aria-label="Screening Risk Result" style={{ padding: '28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <img
              src="/assets/my-reports-mother-baby.png"
              alt=""
              aria-hidden="true"
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '16px',
                objectFit: 'cover',
                border: '1px solid #f2dce4',
                flexShrink: 0,
              }}
            />
            <div>
              <div className="miora-dash-eyebrow" style={{ marginBottom: '6px' }}>
                <span>SCREENING RESULT</span>
                <span className="miora-dash-eyebrow-line" aria-hidden="true" />
              </div>
              <h2 className="patient-page-heading" style={{ fontSize: '24px', margin: 0 }}>
                Your Wellbeing Risk Summary
              </h2>
              {hasAnyAssessment && (
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#8d737e' }}>
                  Completed on {submittedDate}
                </p>
              )}
            </div>
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

        {/* Q10 Crisis Safety Alert */}
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
              <span className="hotline-badge">National Crisis Helpline</span>
              <strong>1800-891-4416 (Toll-Free, 24/7)</strong>
            </div>
          </div>
        )}
      </section>

      {/* Doctor Consultation Card */}
      <section
        className={`patient-card results-consult-card ${riskKey === 'high' ? 'is-high' : riskKey === 'moderate' ? 'is-moderate' : riskKey === 'low' ? 'is-low' : 'is-pending'}`}
        aria-label="Doctor Consultation Recommendation"
        data-testid="results-consultation-card"
      >
        <div className="outcome-card-header" style={{ marginBottom: 12 }}>
          <div className="outcome-title-wrap">
            <span className="outcome-eyebrow" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#ba1e53', textTransform: 'uppercase' }}>
              SCREENING OUTCOME
            </span>
            <h2 className="outcome-main-heading" style={{ fontSize: 20, fontWeight: 600, color: '#2b1b22', marginTop: 4 }}>
              {!hasEpds && !hasAiSession
                ? 'Your Screening Overview'
                : isHigherRisk
                ? 'Your screening suggests that you may be experiencing a higher level of emotional distress.'
                : 'Your screening suggests a lower level of emotional distress based on your answers today.'}
            </h2>
          </div>
        </div>

        <p className="outcome-main-description" style={{ fontSize: 14.5, color: '#4a3d42', lineHeight: 1.6, marginBottom: 16 }}>
          {!hasEpds && !hasAiSession
            ? 'Complete your AI screening session or EPDS questionnaire below to receive a personalized summary of your emotional wellbeing.'
            : isHigherRisk
            ? 'It may be helpful to speak with a qualified healthcare professional for further assessment and support.'
            : 'This is encouraging, but it does not mean that you cannot be experiencing emotional difficulties. If you feel worried, overwhelmed, sad or simply need support, please consider speaking with a healthcare professional.'}
        </p>

        <div className="results-consult-inner" style={{ borderTop: '1px solid #f2dce4', paddingTop: 16, marginTop: 12 }}>
          <div className={`results-consult-icon-pill ${riskKey === 'high' ? 'is-high' : riskKey === 'moderate' ? 'is-moderate' : riskKey === 'low' ? 'is-low' : 'is-pending'}`} aria-hidden="true">
            <PatientIcon name="stethoscope" size={24} />
          </div>

          <div className="results-consult-content">
            <div className="results-consult-top-meta">
              <span className={`results-consult-pill ${riskKey === 'high' ? 'is-high' : riskKey === 'moderate' ? 'is-moderate' : riskKey === 'low' ? 'is-low' : 'is-pending'}`}>
                {riskLevel === 'Pending' ? 'Pending Assessment' : riskLevel}
              </span>
            </div>

            <h3 className="results-consult-heading">Professional Consultation Recommended</h3>
            <p className="results-consult-message">
              Speaking with a healthcare professional can help you understand how you are feeling and explore the support available to you. You can consult a healthcare professional regardless of whether your screening result is lower or higher risk.
            </p>

            <div className="results-consult-actions">
              <button
                type="button"
                className="patient-btn-primary results-consult-cta"
                onClick={() => navigate('/patient/find-doctor')}
                data-testid="consult-doctor-btn"
                aria-label="Find a Doctor — navigate to doctor directory"
              >
                <PatientIcon name="stethoscope" size={16} />
                <span>Find a Doctor</span>
                <PatientIcon name="arrow-right" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimers */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed #f2dce4' }}>
          <p className="outcome-disclaimer" style={{ fontSize: 12.5, color: '#7a5a60', margin: 0 }}>
            AANCHAL is a screening tool, not a medical diagnosis.
          </p>
          {!isHigherRisk && hasAnyAssessment && (
            <p className="outcome-lower-risk-warning" style={{ fontSize: 12.5, color: '#8a6a70', marginTop: 4 }}>
              A lower-risk result does not rule out postpartum depression or other emotional health concerns.
            </p>
          )}
        </div>
      </section>

      {/* ── 4. Simplified Assessment Cards Grid ── */}
      <div className="results-simplified-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
        {/* Card 1: Your EPDS Screening */}
        <section className="patient-card results-clean-card" aria-label="EPDS Score" style={{ padding: 20 }}>
          <div className="clean-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 className="clean-card-title" aria-label="EPDS Score" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2b1b22' }}>Your EPDS Screening</h2>
              <span className="clean-card-sub" style={{ fontSize: 12.5, color: '#8d737e' }}>Validated 10-item wellbeing screening</span>
            </div>
            <span className={`clean-card-badge ${hasEpds ? 'is-completed' : 'is-pending'}`} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: hasEpds ? '#ecfdf5' : '#f5f0f2', color: hasEpds ? '#15803d' : '#66535c' }}>
              {hasEpds ? 'Completed' : 'Pending'}
            </span>
          </div>

          {hasEpds ? (
            <div className="clean-card-body">
              <div className="epds-clean-score-display" style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span className="score-primary" style={{ fontSize: 32, fontWeight: 800, color: '#ba1e53' }}>{epdsScore}</span>
                <span className="score-denom" style={{ fontSize: 18, color: '#8d737e' }}>/30</span>
              </div>
              <div className="epds-score-status-text" style={{ fontSize: 13, color: '#4a3d42', marginBottom: 8 }}>
                <strong>
                  {epdsScore < 10 && 'Lower distress range'}
                  {epdsScore >= 10 && epdsScore < 13 && 'Mild distress range'}
                  {epdsScore >= 13 && 'Elevated distress range'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="clean-card-empty">
              <p style={{ fontSize: 13.5, color: '#7a5a60' }}>No EPDS assessment has been completed yet for this period.</p>
              {onTakeEpds && (
                <button
                  type="button"
                  className="patient-btn-primary"
                  onClick={onTakeEpds}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                >
                  <span>Start EPDS Questionnaire</span>
                  <PatientIcon name="arrow-right" size={15} />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Card 2: AI Screening Session */}
        <section className="patient-card results-clean-card" aria-label="AI Screening Results" style={{ padding: 20 }}>
          <div className="clean-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 className="clean-card-title" aria-label="AI Screening Results" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2b1b22' }}>AI Screening Results</h2>
              <span className="clean-card-sub" style={{ fontSize: 12.5, color: '#8d737e' }}>Conversational check-in</span>
            </div>
            <span className={`clean-card-badge ${hasAiSession ? 'is-completed' : 'is-pending'}`} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: hasAiSession ? '#ecfdf5' : '#f5f0f2', color: hasAiSession ? '#15803d' : '#66535c' }}>
              {hasAiSession ? 'Recorded' : 'Pending'}
            </span>
          </div>

          <div className="clean-card-body">
            {hasAiSession ? (
              <div style={{ fontSize: 13.5, color: '#4a3d42' }}>
                <strong>Your screening session has been recorded.</strong>
              </div>
            ) : (
              <div className="clean-card-empty">
                <p style={{ fontSize: 13.5, color: '#7a5a60' }}>A private, conversational check-in to express your feelings naturally.</p>
                {onTakeAiScreening && (
                  <button
                    type="button"
                    className="patient-btn-secondary"
                    onClick={onTakeAiScreening}
                    style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                  >
                    <span>Record AI Screening</span>
                    <PatientIcon name="arrow-right" size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 5. Assessment History & Available Reports Table ── */}
      <section className="patient-card results-reports-table-card" aria-label="Assessment History & Reports" style={{ marginTop: 20, padding: 20 }}>
        <div className="results-table-header" style={{ marginBottom: 12 }}>
          <h3 className="results-table-title" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2b1b22' }}>Assessment History &amp; Reports</h3>
          <p className="results-table-sub" style={{ fontSize: 12.5, color: '#8d737e', margin: '4px 0 0' }}>
            Records of your completed maternal wellbeing check-ins and clinical summaries.
          </p>
        </div>

        <div className="results-table-container" style={{ overflowX: 'auto' }}>
          <table className="results-summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f2dce4', textAlign: 'left', color: '#8d737e' }}>
                <th style={{ padding: '8px 12px' }}>Date</th>
                <th style={{ padding: '8px 12px' }}>Assessment Type</th>
                <th style={{ padding: '8px 12px' }}>EPDS Score</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {hasEpds ? (
                <tr style={{ borderBottom: '1px solid #fbf0f4' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <strong>{submittedDate}</strong>
                  </td>
                  <td style={{ padding: '10px 12px' }}>Sequential EPDS (10 items)</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 700, color: '#ba1e53' }}>{epdsScore} / 30</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 12, background: '#ecfdf5', color: '#15803d', fontWeight: 600 }}>Completed</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      type="button"
                      className="patient-btn-table-action"
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
                      <PatientIcon name="download" size={14} />
                      <span>Download Summary PDF</span>
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#8d737e' }}>
                    No prior assessments recorded. Complete your first screening to see your history and download clinical reports here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {downloadToast && (
        <div className="patient-notice-banner is-success" role="status" style={{ marginTop: 16 }}>
          {typeof downloadToast === 'string' ? downloadToast : downloadToast?.message}
        </div>
      )}

      {/* Doctor Consultation Reports */}
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

      {/* Emergency Support Section at the Very Bottom */}
      <section className="patient-card results-emergency-support-card" aria-label="Immediate Support Helpline" style={{ marginTop: 20 }}>
        <div className="emergency-support-header">
          <h3 className="emergency-support-title">Support Is Available Immediately</h3>
        </div>
        <p className="emergency-support-desc" style={{ fontSize: 14, color: '#4a3d42', margin: '8px 0 12px' }}>
          If you are feeling overwhelmed, hopeless, or concerned for your safety or your baby&apos;s wellbeing, please reach out for immediate, confidential support. Help is available 24 hours a day, 7 days a week.
        </p>
        <div className="emergency-support-helplines">
          <div className="emergency-helpline-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div className="helpline-meta">
              <strong>Tele-MANAS National Mental Health Helpline</strong>
              <div style={{ fontSize: 12.5, color: '#7a5a60' }}>Toll-free 24/7 tele-counseling support across India</div>
            </div>
            <a href="tel:14416" className="patient-btn-primary" style={{ textDecoration: 'none' }}>
              <span>Call 14416</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ResultsReportsTab;
