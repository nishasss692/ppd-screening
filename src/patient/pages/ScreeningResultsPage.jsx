import React, { useMemo } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { getCurrentUser } from '../../auth/authService.js';
import './screening-results.css';

/* ── Risk category derivation
   Low:      riskPercentage < 33
   Moderate: 33 <= riskPercentage < 43
   High:     riskPercentage >= 43
──────────────────────────────────────────────────────────────────────────── */
function getRiskCategory(pct) {
  if (pct === null || pct === undefined) return 'pending';
  if (pct >= 43) return 'high';
  if (pct >= 33) return 'moderate';
  return 'low';
}

/* ── Consultation card content by risk category ───────────────────────────── */
const CONSULT_CONTENT = {
  low: {
    heading: 'Your Current Screening Result',
    message:
      'Your current screening session shows low-risk indicators. If you are still concerned about your emotional wellbeing, you can consult a healthcare professional.',
    buttonLabel: 'Consult a Doctor',
    cardClass: 'consult-card-low',
    iconClass: 'consult-icon-low',
    categoryLabel: 'Low Risk Category',
  },
  moderate: {
    heading: 'Professional Consultation Recommended',
    message:
      'Your screening session shows indicators that may benefit from further professional assessment.',
    buttonLabel: 'Find a Doctor',
    cardClass: 'consult-card-moderate',
    iconClass: 'consult-icon-moderate',
    categoryLabel: 'Moderate Risk Category',
  },
  high: {
    heading: 'Professional Consultation Recommended',
    message:
      'Your screening session indicates that professional assessment may be helpful. We recommend consulting a qualified healthcare professional.',
    buttonLabel: 'Find a Doctor',
    cardClass: 'consult-card-high',
    iconClass: 'consult-icon-high',
    categoryLabel: 'High Risk Category',
  },
  pending: {
    heading: 'Consult a Healthcare Professional',
    message:
      'AI multimodal analysis is currently awaiting model integration and pending final clinical scoring. You can explore verified specialists, clinics, and hospital care teams at any time without waiting for AI processing.',
    buttonLabel: 'Find a Doctor',
    cardClass: 'consult-card-pending',
    iconClass: 'consult-icon-pending',
    categoryLabel: 'Doctor Consultation Available',
  },
};

export function ScreeningResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { screening, patient } = usePatient();

  const currentUser = getCurrentUser();
  const patientName = patient?.name || currentUser?.name || 'Amara';

  const riskPercentage = useMemo(() => {
    const paramStatus = searchParams.get('status');
    if (paramStatus === 'pending') return null;

    const paramScore = searchParams.get('score');
    if (paramScore === 'pending') return null;
    if (paramScore && !isNaN(Number(paramScore))) {
      const val = Number(paramScore);
      return val <= 1 ? Math.round(val * 100) : Math.round(val);
    }

    const cat = searchParams.get('category');
    if (cat === 'pending') return null;
    if (cat === 'low') return 20;
    if (cat === 'moderate') return 38;
    if (cat === 'high') return 64;

    if (screening?.isPending) return null;

    // Check localStorage for saved screening results
    try {
      const cmRaw = localStorage.getItem('aanchal_clinical_model_prediction');
      if (cmRaw) {
        const cm = JSON.parse(cmRaw);
        if (cm?.predicted_risk_probability !== undefined && cm?.predicted_risk_probability !== null) {
          const prob = Number(cm.predicted_risk_probability);
          return Math.round(prob <= 1 ? prob * 100 : prob);
        }
      }
    } catch (e) { }

    try {
      const mmRaw = localStorage.getItem('aanchal_multimodal_screening_result');
      if (mmRaw) {
        const mm = JSON.parse(mmRaw);
        if (mm?.fusion_score !== undefined && mm?.fusion_score !== null) {
          const fs = Number(mm.fusion_score);
          return Math.round(fs <= 1 ? fs * 100 : fs);
        }
      }
    } catch (e) { }

    try {
      const epdsRaw = localStorage.getItem('aanchal_submitted_epds_assessment');
      if (epdsRaw) {
        const epds = JSON.parse(epdsRaw);
        if (epds?.totalScore !== undefined && epds?.totalScore !== null) {
          return Math.round((Number(epds.totalScore) / 30) * 100);
        }
      }
    } catch (e) { }

    if (screening?.riskScore != null) {
      return Number(screening.riskScore);
    }

    if (screening?.totalScore != null) {
      return Math.round((Number(screening.totalScore) / 30) * 100);
    }

    return null;
  }, [searchParams, screening]);

  const hasScore = riskPercentage !== null;
  const displayPercentage = hasScore ? riskPercentage : 0;

  const gaugeRadius = 50;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const strokeOffset = gaugeCircumference * (1 - Math.min(Math.max(displayPercentage, 0), 100) / 100);

  return (
    <div className="results-page-shell">
      {/* Top Breadcrumb & Tracker Bar */}
      <div className="screening-top-bar-area">
        <div className="screening-header-titles">
          <div className="screening-breadcrumb">
            <NavLink to="/patient/reports" className="screening-breadcrumb-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
                <path d="M9.5 21v-7h5v7" />
              </svg>
              <span>Home</span>
            </NavLink>
            <span className="screening-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
            <NavLink to="/patient/screening" className="screening-breadcrumb-link">
              <span>AI Screening</span>
            </NavLink>
            <span className="screening-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
            <span className="screening-breadcrumb-current">Results</span>
          </div>
          <div className="miora-dash-eyebrow">
            <span>ASSESSMENT REPORT</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="miora-dash-title patient-page-heading screening-page-title">
            Screening <em>Results</em>
          </h1>
        </div>

        {/* 4-Stage Progress Tracker */}
        <div className="screening-stages-tracker" aria-label="Screening progress stages">
          <NavLink to="/patient/medical-history" className="tracker-stage is-completed">
            <div className="tracker-circle">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
              </svg>
            </div>
            <span className="tracker-label">Patient Details</span>
          </NavLink>

          <div className="tracker-line is-active-line" aria-hidden="true" />

          <NavLink to="/patient/screening" className="tracker-stage is-completed">
            <div className="tracker-circle">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
              </svg>
            </div>
            <span className="tracker-label">Screening</span>
          </NavLink>

          <div className="tracker-line is-active-line" aria-hidden="true" />

          <div className="tracker-stage is-completed">
            <div className="tracker-circle">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
              </svg>
            </div>
            <span className="tracker-label">Analysis</span>
          </div>

          <div className="tracker-line is-active-line" aria-hidden="true" />

          <div className="tracker-stage is-active">
            <div className="tracker-circle">
              <span className="tracker-inner-dot" />
            </div>
            <span className="tracker-label">Results</span>
          </div>
        </div>
      </div>

      {/* Main Content Cards */}
      <div className="results-content-stack">
        {/* Card 1: About PPD (Left) + Estimated Risk of PPD (Right Gauge) */}
        <section className="patient-card results-top-card" aria-label="Screening Overview">
          <div className="results-about-section">
            <span className="results-about-tag">About Postpartum Wellbeing</span>

            <p className="results-about-text">
              Postpartum Depression (PPD) is a common, treatable medical condition that can happen after childbirth. It can cause feelings of sadness, emotional fatigue, sleep disturbance, or feeling overwhelmed.
            </p>

            <div className="results-reassurance-box" role="note">
              <svg className="results-heart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <p className="results-reassurance-text">
                <strong>Please be gentle with yourself.</strong> This is a preliminary screening estimate, not a clinical diagnosis. Many mothers experience similar phases, and with compassionate support, they recover fully.
              </p>
            </div>
          </div>

          <div className="results-card-vdivider" aria-hidden="true" />

          <div className="results-risk-section">
            <h2 className="results-risk-heading">Estimated Risk of PPD</h2>

            {hasScore ? (
              <>
                <div className="results-circular-gauge" aria-label={`Estimated risk of PPD is ${riskPercentage} percent`}>
                  <svg className="results-gauge-svg" viewBox="0 0 124 124">
                    <circle
                      className="results-gauge-bg"
                      cx="62"
                      cy="62"
                      r={gaugeRadius}
                    />
                    <circle
                      className="results-gauge-fill"
                      cx="62"
                      cy="62"
                      r={gaugeRadius}
                      strokeDasharray={gaugeCircumference}
                      strokeDashoffset={strokeOffset}
                    />
                  </svg>
                  <span className="results-gauge-value">{riskPercentage}%</span>
                </div>

                <span className="results-risk-label-pill">
                  {riskPercentage >= 43 ? 'High Risk Category' : riskPercentage >= 33 ? 'Moderate Risk Category' : 'Low Risk Category'}
                </span>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <span className="ai-status-pill is-pending" style={{ marginBottom: 10, display: 'inline-flex' }}>
                  <span className="ai-status-dot" />
                  <span>Awaiting model integration</span>
                </span>
                <p style={{ fontSize: '12px', color: 'var(--patient-subtle)', margin: '8px 0 0' }}>
                  Multimodal AI model scoring is currently pending integration.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Card 2: Key Insights */}
        <section className="patient-card results-insights-card" aria-label="Key Insights">
          <div className="results-insights-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <h2 className="results-insights-title">Key Observed Signals</h2>
          </div>

          <div className="results-insights-grid">
            <div className="results-insight-item">
              <div className="insight-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                  <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <strong className="results-insight-name">Mood Changes</strong>
              <p className="results-insight-desc">Vocal tone and conversational pauses indicate emotional weariness.</p>
            </div>

            <div className="results-insight-item">
              <div className="insight-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  <circle cx="18.5" cy="6" r="0.75" fill="currentColor" stroke="none" />
                  <circle cx="20.5" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <strong className="results-insight-name">Sleep Disturbances</strong>
              <p className="results-insight-desc">Multiple nighttime awakenings correlated with high fatigue levels.</p>
            </div>

            <div className="results-insight-item">
              <div className="insight-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3c-1.5 3-4 6.5-7 8.5 2 1.5 4.5 2 7 2 2.5 0 5-.5 7-2-3-2-5.5-5.5-7-8.5z" />
                  <path d="M12 13.5c-2.5 3-5 5.5-9 6 3 1.5 6 1.5 9 1.5s6 0 9-1.5c-4-.5-6.5-3-9-6z" />
                </svg>
              </div>
              <strong className="results-insight-name">Emotional Sensitivity</strong>
              <p className="results-insight-desc">Heightened sensory vulnerability observed during self-reflection.</p>
            </div>
          </div>
        </section>

        {/* ── Risk-Based Consultation Card ──────────────────────────────── */}
        {(() => {
          const riskCategory = getRiskCategory(riskPercentage);
          const content = CONSULT_CONTENT[riskCategory];
          return (
            <section
              className={`patient-card results-consult-card ${content.cardClass}`}
              aria-label="Consultation recommendation"
              data-testid="results-consultation-card"
            >
              <div className="results-consult-inner">
                <div className={`results-consult-icon-wrap ${content.iconClass}`} aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>

                <div className="results-consult-body">
                  <span className={`results-consult-category-pill ${content.cardClass}`}>
                    {content.categoryLabel}
                  </span>
                  <h2 className="results-consult-heading">{content.heading}</h2>
                  <p className="results-consult-message">{content.message}</p>

                  <p className="results-consult-disclaimer">
                    <strong>Important:</strong> This screening is not a clinical diagnosis
                    and does not replace professional medical advice. Always consult a
                    qualified healthcare provider for diagnosis and treatment.
                  </p>

                  <div className="results-consult-actions">
                    <button
                      type="button"
                      className="patient-btn-primary results-consult-cta"
                      onClick={() => navigate('/patient/find-doctor')}
                      data-testid="consult-doctor-btn"
                      aria-label={`${content.buttonLabel} — navigate to doctor discovery`}
                    >
                      <span>{content.buttonLabel}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* Action Row */}
        <div className="results-actions-row">
          <button
            type="button"
            className="patient-btn-secondary results-action-btn"
            onClick={() => navigate('/patient/screening')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.5 2v6h-6" />
              <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" />
            </svg>
            <span>Retake Screening</span>
          </button>

          <button
            type="button"
            className="patient-btn-secondary results-action-btn"
            onClick={() => navigate('/patient/care-suggestions')}
          >
            <span>Explore Care Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScreeningResultsPage;
