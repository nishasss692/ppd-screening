import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './care-suggestions.css';

export function CareSuggestionsPage() {
  const navigate = useNavigate();
  const {
    patient,
    screening,
    carePlan,
    toggleCareTask,
  } = usePatient();

  // Modals for interactive actions
  const [activeModal, setActiveModal] = useState(null); // 'breathing' | 'sleep' | 'journaling'
  const [journalEntry, setJournalEntry] = useState('');

  const isDoctorFinalized = Boolean(carePlan?.clinicianPlan || carePlan?.clinicianReview);

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

        <div className="care-hero-illu-wrap" aria-hidden="true">
          <img
            src="/assets/care-mother-feathered.png"
            alt=""
            className="care-hero-illustration"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
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
                  {carePlan?.clinicianReview?.final_risk_classification && (
                    <span className="care-risk-pill">
                      Clinical Assessment: {carePlan.clinicianReview.final_risk_classification} Risk
                    </span>
                  )}
                </div>

                {/* Clinician Care Plan Guidance */}
                {carePlan?.clinicianPlan?.notes && (
                  <div className="care-guidance-callout">
                    <div className="care-callout-head">
                      <PatientIcon name="sparkles" size={15} />
                      <span>Personalised Care Plan Guidance</span>
                    </div>
                    <p className="care-callout-text">
                      {carePlan.clinicianPlan.notes}
                    </p>
                  </div>
                )}

                {/* Clinician Review Notes */}
                {carePlan?.clinicianReview && (
                  <div className="care-review-callout">
                    <div className="care-callout-head">
                      <PatientIcon name="user" size={15} />
                      <span>
                        Reviewed by {carePlan.clinicianReview.clinician_name}
                        {carePlan.clinicianReview.reviewed_at && (
                          <> &bull; {new Date(carePlan.clinicianReview.reviewed_at).toLocaleDateString()}</>
                        )}
                      </span>
                    </div>
                    {carePlan.clinicianReview.clinical_notes && (
                      <p className="care-callout-text">
                        {carePlan.clinicianReview.clinical_notes}
                      </p>
                    )}
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
