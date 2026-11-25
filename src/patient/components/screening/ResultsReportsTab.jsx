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

    let key = 'low';
    let label = 'Low Risk';
    if (
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
  }, [hasAnyAssessment, storedMultimodalResult, storedClinicalModel, epdsScore]);

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
            <h2 className="patient-page-heading" style={{ fontSize: '24px', margin: 0 }}>
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
    </div>
  );
}
export default ResultsReportsTab;
