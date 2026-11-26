import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './care-suggestions.css';

function safeText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    return trimmed;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
}

function formatHumanDate(val) {
  const str = safeText(val);
  if (!str) return '';
  // Already human-readable like "28 Nov 2026"
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(str)) return str;
  const parsed = new Date(str.length === 10 ? `${str}T00:00:00` : str);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function humanizeSlug(val) {
  const str = safeText(val);
  if (!str) return '';
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeList(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((item) => humanizeSlug(safeText(item))).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(/[,|;\n]+/)
      .map((s) => humanizeSlug(s.trim()))
      .filter(Boolean);
  }
  return [];
}

function parseClinicianPlan(clinicianPlan, consultations = []) {
  const result = {
    hospitalName: '',
    hospitalLocation: '',
    doctorName: '',
    doctorRole: '',
    consultationDate: '',
    consultationTime: '',
    consultationType: '',
    consultationStatus: '',
    clinicalObservations: '',
    assessment: '',
    carePlanSummary: '',
    recommendations: [],
    milestones: [],
    followUpNote: '',
  };

  if (!clinicianPlan) return result;

  const rawNotes = clinicianPlan.notes;
  let jsonObj = null;

  if (rawNotes && typeof rawNotes === 'object' && !Array.isArray(rawNotes)) {
    jsonObj = rawNotes;
  } else if (typeof rawNotes === 'string' && rawNotes.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawNotes.trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        jsonObj = parsed;
      }
    } catch {
      jsonObj = null;
    }
  }

  if (jsonObj) {
    result.hospitalName = safeText(jsonObj.hospital_name || jsonObj.hospitalName || jsonObj.clinic);
    result.hospitalLocation = safeText(jsonObj.hospital_location || jsonObj.hospitalLocation);
    result.doctorName = safeText(jsonObj.doctor_name || jsonObj.doctorName || jsonObj.clinician_name);
    result.doctorRole = safeText(jsonObj.doctor_role || jsonObj.doctorRole);
    result.consultationDate = formatHumanDate(
      jsonObj.confirmed_date || jsonObj.confirmedDate || jsonObj.requested_date || jsonObj.requestedDate || jsonObj.date || clinicianPlan.scheduled_followup_date
    );
    result.consultationTime = safeText(
      jsonObj.confirmed_time || jsonObj.confirmedTime || jsonObj.requested_time || jsonObj.requestedTime || jsonObj.time
    );
    result.consultationType = safeText(
      jsonObj.consultation_type || jsonObj.consultationType || jsonObj.type || clinicianPlan.intervention_type
    );
    result.consultationStatus = humanizeSlug(jsonObj.status || clinicianPlan.status);
    result.clinicalObservations = safeText(
      jsonObj.clinical_observations || jsonObj.clinicalObservations || jsonObj.observations || jsonObj.reason
    );
    result.assessment = safeText(
      jsonObj.assessment || jsonObj.clinical_assessment || jsonObj.clinicalAssessment
    );
    result.carePlanSummary = safeText(
      jsonObj.care_plan || jsonObj.carePlan || jsonObj.plan_summary || jsonObj.planSummary || jsonObj.summary
    );
    result.recommendations = normalizeList(jsonObj.recommendations);
    result.followUpNote = safeText(jsonObj.follow_up || jsonObj.followUp || jsonObj.followup_recommendation);
    if (Array.isArray(jsonObj.milestones)) {
      result.milestones = jsonObj.milestones
        .map((m) => {
          if (typeof m === 'string') return { timeframe: '', title: m, detail: '' };
          if (m && typeof m === 'object') {
            return {
              timeframe: safeText(m.timeframe || m.when),
              title: safeText(m.title || m.label),
              detail: safeText(m.detail || m.description),
            };
          }
          return null;
        })
        .filter((m) => m && (m.title || m.detail));
    }
  } else if (typeof rawNotes === 'string' && rawNotes.trim()) {
    const lines = rawNotes.split(/\r?\n/);
    const summaryLines = [];
    let inMilestones = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const recMatch = trimmed.match(/^Recommendations:\s*(.+)$/i);
      if (recMatch) {
        inMilestones = false;
        result.recommendations = normalizeList(recMatch[1]);
        continue;
      }

      if (/^Care Milestones:$/i.test(trimmed)) {
        inMilestones = true;
        continue;
      }

      if (inMilestones && trimmed.startsWith('-')) {
        const body = trimmed.replace(/^-\s*/, '');
        const milestoneMatch = body.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/);
        if (milestoneMatch) {
          result.milestones.push({
            timeframe: safeText(milestoneMatch[1]),
            title: safeText(milestoneMatch[2]),
            detail: safeText(milestoneMatch[3]),
          });
        } else {
          result.milestones.push({ timeframe: '', title: body, detail: '' });
        }
        continue;
      }

      summaryLines.push(trimmed);
    }

    result.carePlanSummary = summaryLines.join('\n');
    if (clinicianPlan.intervention_type) {
      result.consultationType = humanizeSlug(clinicianPlan.intervention_type);
    }
    if (clinicianPlan.scheduled_followup_date) {
      result.consultationDate = formatHumanDate(clinicianPlan.scheduled_followup_date);
    }
  }

  // Fill missing consultation metadata from patient's latest booked consultation if available
  const latestAppt = Array.isArray(consultations) && consultations.length > 0 ? consultations[0] : null;
  if (latestAppt) {
    if (!result.hospitalName) result.hospitalName = safeText(latestAppt.hospitalName || latestAppt.clinic);
    if (!result.hospitalLocation) result.hospitalLocation = safeText(latestAppt.hospitalLocation);
    if (!result.doctorName) result.doctorName = safeText(latestAppt.doctorName);
    if (!result.doctorRole) result.doctorRole = safeText(latestAppt.role);
    if (!result.consultationDate) result.consultationDate = formatHumanDate(latestAppt.date);
    if (!result.consultationTime) result.consultationTime = safeText(latestAppt.time);
    if (!result.consultationType) result.consultationType = safeText(latestAppt.type);
    if (!result.consultationStatus) result.consultationStatus = safeText(latestAppt.status);
    if (!result.clinicalObservations && latestAppt.summary) {
      result.clinicalObservations = safeText(latestAppt.summary);
    }
  }

  if (!result.followUpNote && clinicianPlan.referral_destination) {
    result.followUpNote = safeText(clinicianPlan.referral_destination);
  }

  return result;
}

function parseClinicianReview(clinicianReview) {
  if (!clinicianReview) return null;

  const doctorName = safeText(clinicianReview.clinician_name) || 'Assigned Specialist';
  const reviewedDate = formatHumanDate(clinicianReview.reviewed_at);
  const rawRisk = safeText(clinicianReview.final_risk_classification);
  const riskLevel = rawRisk
    ? `${humanizeSlug(rawRisk)}${rawRisk.toLowerCase().includes('risk') ? '' : ' Risk'}`
    : '';

  const rawNotes = safeText(clinicianReview.clinical_notes);
  let decisionRationale = '';
  let followUpItems = [];
  const extraLines = [];

  if (rawNotes) {
    for (const line of rawNotes.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip redundant risk line if it duplicates the risk classification
      if (/^(low|moderate|high)\s*risk$/i.test(trimmed)) continue;

      const rationaleMatch = trimmed.match(/^Decision rationale:\s*(.+)$/i);
      if (rationaleMatch) {
        decisionRationale = safeText(rationaleMatch[1]);
        continue;
      }

      const followUpMatch = trimmed.match(/^Follow-up:\s*(.+)$/i);
      if (followUpMatch) {
        followUpItems = followUpMatch[1]
          .split('|')
          .map((item) => safeText(item))
          .filter(Boolean);
        continue;
      }

      extraLines.push(trimmed);
    }
  }

  if (!decisionRationale && extraLines.length > 0) {
    decisionRationale = extraLines.join(' ');
  }

  return {
    doctorName,
    reviewedDate,
    riskLevel,
    decisionRationale,
    followUpItems,
    escalationRequired: Boolean(clinicianReview.required_immediate_escalation),
  };
}

export function CareSuggestionsPage() {
  const navigate = useNavigate();
  const {
    patient,
    screening,
    carePlan,
    consultations,
    toggleCareTask,
  } = usePatient();

  // Modals for interactive actions
  const [activeModal, setActiveModal] = useState(null); // 'breathing' | 'sleep' | 'journaling'
  const [journalEntry, setJournalEntry] = useState('');

  const isDoctorFinalized = Boolean(carePlan?.clinicianPlan || carePlan?.clinicianReview);
  const parsedPlan = parseClinicianPlan(carePlan?.clinicianPlan, consultations);
  const parsedReview = parseClinicianReview(carePlan?.clinicianReview);
  const hasConsultationDetails = Boolean(
    parsedPlan.hospitalName ||
      parsedPlan.doctorName ||
      parsedPlan.consultationDate ||
      parsedPlan.consultationTime ||
      parsedPlan.consultationType
  );
  const hasGuidanceSections = Boolean(
    parsedPlan.clinicalObservations ||
      parsedPlan.assessment ||
      parsedPlan.carePlanSummary ||
      parsedPlan.recommendations.length > 0 ||
      parsedPlan.milestones.length > 0 ||
      parsedPlan.followUpNote
  );

  const handleStartBreathing = () => {
    setActiveModal('breathing');
  };

  const handleCompleteBreathing = () => {
    if (toggleCareTask) toggleCareTask('task-1');
    setActiveModal(null);
  };

  const handleSaveJournal = () => {
    if (journalEntry.trim() && toggleCareTask) {
      toggleCareTask('task-4');
    }
    setActiveModal(null);
    setJournalEntry('');
  };

  const riskDisplay = screening?.riskLabel
    ? screening.riskLabel.replace(' for PPD', '')
    : 'Moderate Risk';

  return (
    <div className="care-page-container">
      {/* Breadcrumb Bar */}
      <div className="medhist-breadcrumb-bar">
        <NavLink to="/patient/dashboard" className="medhist-breadcrumb-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
            <path d="M9.5 21v-7h5v7" />
          </svg>
          <span>Home</span>
        </NavLink>
        <span className="medhist-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="medhist-breadcrumb-current">Care Suggestions</span>
      </div>

      {/* Hero Header Banner */}
      <div className="patient-card care-hero-card">
        <div className="care-hero-text">
          <div className="miora-dash-eyebrow">
            <span>CARE &amp; RECOVERY</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="miora-dash-title patient-page-heading care-title">
            Personalised Care <em>Suggestions</em>
          </h1>
        </div>
      </div>

      {/* Main Content: Only visible once the doctor finalizes care plan or clinical review */}
      {!isDoctorFinalized ? (
        <section
          className="patient-card care-plan-card"
          aria-label="Pending Clinician Finalization"
          style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px', gap: '10px' }}
        >
          <div className="plan-badge-icon" aria-hidden="true">
            <PatientIcon name="stethoscope" size={22} />
          </div>
          <h2 className="plan-title" style={{ margin: 0 }}>
            Pending Clinician Finalization
          </h2>
          <p className="plan-desc" style={{ maxWidth: '540px', margin: 0 }}>
            Your personalized insights and care suggestions will appear here once your doctor finalizes your care plan.
          </p>
        </section>
      ) : (
        <div className="care-main-grid">
          {/* Left Column: Doctor-Finalized Insights, Care Plan & Restorative Tools */}
          <div className="care-main-left">
            {/* Clinician-Finalized Insights & Care Plan (synced from Doctor Dashboard) */}
            {(carePlan?.clinicianPlan || carePlan?.clinicianReview) && (
              <section
                className="patient-card care-plan-card care-finalized-hero"
                aria-label="Doctor Finalized Insights and Care Plan"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '18px' }}
              >
                <div className="care-finalized-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="plan-badge-icon" aria-hidden="true">
                      <PatientIcon name="stethoscope" size={20} />
                    </div>
                    <div>
                      <span className="care-verified-pill">
                        <PatientIcon name="shield-check" size={13} />
                        <span>Clinician Verified</span>
                      </span>
                      <h2 className="plan-title" style={{ margin: '4px 0 0' }}>
                        Doctor-Finalized Insights &amp; Care Plan
                      </h2>
                    </div>
                  </div>
                  {parsedReview?.riskLevel && (
                    <span className="care-risk-pill">
                      Clinical Assessment: {parsedReview.riskLevel}
                    </span>
                  )}
                </div>

                {/* Consultation Details Card */}
                {hasConsultationDetails && (
                  <div className="care-guidance-callout">
                    <div className="care-callout-head">
                      <PatientIcon name="calendar" size={15} />
                      <span>Consultation &amp; Appointment Details</span>
                    </div>
                    <div className="care-detail-grid">
                      {parsedPlan.hospitalName && (
                        <div className="care-detail-item">
                          <span className="care-detail-label">Hospital</span>
                          <span className="care-detail-value">
                            {parsedPlan.hospitalName}
                            {parsedPlan.hospitalLocation ? ` (${parsedPlan.hospitalLocation})` : ''}
                          </span>
                        </div>
                      )}
                      {parsedPlan.doctorName && (
                        <div className="care-detail-item">
                          <span className="care-detail-label">Doctor</span>
                          <span className="care-detail-value">
                            {parsedPlan.doctorName}
                            {parsedPlan.doctorRole ? ` — ${parsedPlan.doctorRole}` : ''}
                          </span>
                        </div>
                      )}
                      {(parsedPlan.consultationDate || parsedPlan.consultationTime) && (
                        <div className="care-detail-item">
                          <span className="care-detail-label">Date &amp; Time</span>
                          <span className="care-detail-value">
                            {[parsedPlan.consultationDate, parsedPlan.consultationTime].filter(Boolean).join(' at ')}
                          </span>
                        </div>
                      )}
                      {parsedPlan.consultationType && (
                        <div className="care-detail-item">
                          <span className="care-detail-label">Consultation Type</span>
                          <span className="care-detail-value">
                            {parsedPlan.consultationType}
                            {parsedPlan.consultationStatus ? ` (${parsedPlan.consultationStatus})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Clinician Care Plan Guidance */}
                {hasGuidanceSections && (
                  <div className="care-guidance-callout">
                    <div className="care-callout-head">
                      <PatientIcon name="sparkles" size={15} />
                      <span>Personalised Care Plan Guidance</span>
                    </div>

                    <div className="care-structured-sections">
                      {parsedPlan.clinicalObservations && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Clinical Observations</span>
                          <p className="care-callout-text">{parsedPlan.clinicalObservations}</p>
                        </div>
                      )}

                      {parsedPlan.assessment && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Assessment</span>
                          <p className="care-callout-text">{parsedPlan.assessment}</p>
                        </div>
                      )}

                      {parsedPlan.carePlanSummary && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Care Plan</span>
                          <p className="care-callout-text">{parsedPlan.carePlanSummary}</p>
                        </div>
                      )}

                      {parsedPlan.recommendations.length > 0 && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Follow-up Recommendations</span>
                          <div className="care-chip-list">
                            {parsedPlan.recommendations.map((rec, idx) => (
                              <span key={idx} className="care-guidance-chip">{rec}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {parsedPlan.milestones.length > 0 && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Scheduled Care Milestones</span>
                          <ul className="care-milestones-list">
                            {parsedPlan.milestones.map((m, idx) => (
                              <li key={idx} className="care-milestone-item">
                                {m.timeframe && <span className="care-milestone-time">{m.timeframe}</span>}
                                <span className="care-milestone-body">
                                  {m.title && <strong>{m.title}</strong>}
                                  {m.title && m.detail ? ': ' : ''}
                                  {m.detail}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {parsedPlan.followUpNote && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Follow-up &amp; Referral</span>
                          <p className="care-callout-text">{parsedPlan.followUpNote}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reviewed by Doctor Section */}
                {parsedReview && (
                  <div className="care-review-callout">
                    <div className="care-review-header">
                      <div className="care-callout-head">
                        <PatientIcon name="user" size={15} />
                        <span>
                          Reviewed by {parsedReview.doctorName}
                          {parsedReview.reviewedDate && <> &bull; {parsedReview.reviewedDate}</>}
                        </span>
                      </div>
                      {parsedReview.riskLevel && (
                        <span className="care-review-risk-badge">{parsedReview.riskLevel}</span>
                      )}
                    </div>

                    <div className="care-structured-sections">
                      {parsedReview.riskLevel && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Risk Level</span>
                          <p className="care-callout-text">{parsedReview.riskLevel}</p>
                        </div>
                      )}

                      {parsedReview.decisionRationale && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Decision Rationale</span>
                          <p className="care-callout-text">{parsedReview.decisionRationale}</p>
                        </div>
                      )}

                      {parsedReview.followUpItems.length > 0 && (
                        <div className="care-structured-block">
                          <span className="care-section-label">Follow-up Plan</span>
                          <div className="care-chip-list">
                            {parsedReview.followUpItems.map((item, idx) => (
                              <span key={idx} className="care-guidance-chip">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Interactive Modals */}
      {/* 1. Breathing Exercise Modal */}
      {activeModal === 'breathing' && (
        <div className="companion-modal-backdrop" onClick={() => setActiveModal(null)} role="dialog" aria-modal="true">
          <div className="patient-card care-interactive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="companion-modal-head">
              <h3 className="companion-modal-title">4-7-8 Breathing Exercise</h3>
              <button
                type="button"
                className="companion-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p className="care-modal-desc">
              Take a slow, gentle breath in through your nose for 4 seconds, hold softly for 7 seconds, and exhale completely through your mouth for 8 seconds.
            </p>
            <div className="breathing-circle-wrap">
              <div className="breathing-bubble">Breathe</div>
            </div>
            <button
              type="button"
              className="patient-btn-primary modal-action-btn"
              onClick={handleCompleteBreathing}
            >
              Complete Exercise &amp; Mark Done
            </button>
          </div>
        </div>
      )}

      {/* 2. Better Sleep Tips Modal */}
      {activeModal === 'sleep' && (
        <div className="companion-modal-backdrop" onClick={() => setActiveModal(null)} role="dialog" aria-modal="true">
          <div className="patient-card care-interactive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="companion-modal-head">
              <h3 className="companion-modal-title">Postpartum Sleep Hygiene</h3>
              <button
                type="button"
                className="companion-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p className="care-modal-desc">
              Sleep is essential for maternal emotional recovery. Gentle, evidence-based recommendations:
            </p>
            <ul className="care-tips-ul">
              <li><strong>Consolidated sleep block:</strong> Coordinate night feedings with your partner to preserve at least one 4-hour stretch of deep sleep.</li>
              <li><strong>Circadian lighting:</strong> Keep room lighting amber and dim 45 minutes prior to sleep.</li>
              <li><strong>Nervous system offloading:</strong> Practice 3 minutes of mindful sensory grounding before laying down.</li>
              <li><strong>Nap with flexibility:</strong> A 20-minute restorative rest during midday replenishes daytime mental energy.</li>
            </ul>
            <button
              type="button"
              className="patient-btn-secondary modal-action-btn"
              onClick={() => setActiveModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 3. Mood Journaling Modal */}
      {activeModal === 'journaling' && (
        <div className="companion-modal-backdrop" onClick={() => setActiveModal(null)} role="dialog" aria-modal="true">
          <div className="patient-card care-interactive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="companion-modal-head">
              <h3 className="companion-modal-title">Daily Mood Reflection</h3>
              <button
                type="button"
                className="companion-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p className="care-modal-desc">
              Write down whatever thoughts or feelings are present right now. There are no expectations or judgments.
            </p>
            <textarea
              className="journal-textarea"
              placeholder="How are you feeling today? What is one thing that brought a small moment of comfort?..."
              rows={4}
              value={journalEntry}
              onChange={(e) => setJournalEntry(e.target.value)}
            />
            <button
              type="button"
              className="patient-btn-primary modal-action-btn"
              onClick={handleSaveJournal}
            >
              Save Reflection &amp; Mark Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CareSuggestionsPage;
