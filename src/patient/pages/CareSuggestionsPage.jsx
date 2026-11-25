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

  // Tasks from patient context
  const tasks = carePlan?.tasks || [
    { id: 'task-1', title: 'Breathing exercise', completed: true },
    { id: 'task-2', title: 'Mood check-in', completed: true },
    { id: 'task-3', title: 'Sleep routine', completed: true },
    { id: 'task-4', title: 'Journaling', completed: false },
    { id: 'task-5', title: 'Light activity', completed: false },
    { id: 'task-6', title: 'Self-care time', completed: false },
    { id: 'task-7', title: 'Reflection', completed: false },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;

  // Circular gauge calculations
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalTasks > 0 ? completedCount / totalTasks : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const handleStartBreathing = () => {
    setActiveModal('breathing');
  };

  const handleCompleteBreathing = () => {
    const breathingTask = tasks.find((t) => t.id === 'task-1');
    if (breathingTask && !breathingTask.completed) {
      toggleCareTask('task-1');
    }
    setActiveModal(null);
  };

  const handleSaveJournal = () => {
    if (journalEntry.trim()) {
      const journalTask = tasks.find((t) => t.id === 'task-4');
      if (journalTask && !journalTask.completed) {
        toggleCareTask('task-4');
      }
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
          <p className="miora-dash-subtitle patient-page-subheading care-subtitle">
            Evidence-based recovery plans, mindful restorative practices, and clinical guidance tailored to your postpartum journey.
          </p>
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
        {/* Left Column: Plan & Daily Suggestions */}
        <div className="care-main-left">
          {/* Clinician-Finalized Insights & Care Plan (synced from Doctor Dashboard) */}
          {(carePlan?.clinicianPlan || carePlan?.clinicianReview) && (
            <section
              className="patient-card care-plan-card"
              aria-label="Doctor Finalized Insights and Care Plan"
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: '14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="plan-badge-icon" aria-hidden="true">
                    <PatientIcon name="stethoscope" size={20} />
                  </div>
                  <div>
                    <h2 className="plan-title" style={{ margin: 0 }}>
                      Doctor-Finalized Insights &amp; Care Plan
                    </h2>
                    <p className="plan-desc" style={{ margin: '2px 0 0' }}>
                      Updated directly from your clinician&apos;s review and care planning session.
                    </p>
                  </div>
                </div>
                {carePlan?.clinicianReview?.final_risk_classification && (
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: '#fde7ec',
                      color: '#ba1e53',
                      textTransform: 'capitalize',
                    }}
                  >
                    Clinical Assessment: {carePlan.clinicianReview.final_risk_classification} Risk
                  </span>
                )}
              </div>

              {carePlan?.clinicianPlan && (
                <div
                  style={{
                    background: '#fff9fa',
                    border: '1px solid #f0dfe2',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12.5px', color: '#6b585f' }}>
                    <span>
                      <strong>Care Focus:</strong>{' '}
                      <span style={{ textTransform: 'capitalize' }}>
                        {(carePlan.clinicianPlan.intervention_type || 'counseling').replace('_', ' ')}
                      </span>
                    </span>
                    <span>
                      <strong>Priority:</strong>{' '}
                      <span style={{ textTransform: 'capitalize' }}>
                        {carePlan.clinicianPlan.priority || 'routine'}
                      </span>
                    </span>
                    {carePlan.clinicianPlan.scheduled_followup_date && (
                      <span>
                        <strong>Next Follow-up:</strong> {carePlan.clinicianPlan.scheduled_followup_date}
                      </span>
                    )}
                  </div>
                  {carePlan.clinicianPlan.notes && (
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: '#271218', whiteSpace: 'pre-line' }}>
                      {carePlan.clinicianPlan.notes}
                    </p>
                  )}
                </div>
              )}

              {carePlan?.clinicianReview && (
                <div
                  style={{
                    background: '#fdfaf9',
                    border: '1px solid #f0dfe2',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontSize: '12.5px', color: '#6b585f' }}>
                    <strong>Reviewed by:</strong> {carePlan.clinicianReview.clinician_name}
                    {carePlan.clinicianReview.reviewed_at && (
                      <> · {new Date(carePlan.clinicianReview.reviewed_at).toLocaleDateString()}</>
                    )}
                  </div>
                  {carePlan.clinicianReview.clinical_notes && (
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: '#271218', whiteSpace: 'pre-line' }}>
                      {carePlan.clinicianReview.clinical_notes}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Progress Tracker & Doctor Connection */}
        <div className="care-main-right">
          {/* Progress Tracker Card */}
          <section className="patient-card care-progress-card" aria-label="Care Plan Progress">
            <h2 className="progress-card-title">Daily Checklist</h2>
            <div className="progress-body-row">
              {/* Circular Gauge */}
              <div className="progress-gauge-wrap">
                <svg className="progress-gauge-svg" viewBox="0 0 90 90" aria-hidden="true">
                  <circle
                    className="progress-gauge-track"
                    cx="45"
                    cy="45"
                    r={radius}
                  />
                  <circle
                    className="progress-gauge-bar"
                    cx="45"
                    cy="45"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className="progress-gauge-text">
                  <span className="gauge-fraction">
                    {completedCount}/{totalTasks}
                  </span>
                  <span className="gauge-subtext">Tasks<br />Done</span>
                </div>
              </div>

              {/* Checklist */}
              <ul className="progress-tasks-list">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className={`progress-task-item ${task.completed ? 'is-completed' : ''}`}
                    onClick={() => toggleCareTask(task.id)}
                    role="checkbox"
                    aria-checked={task.completed}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        toggleCareTask(task.id);
                      }
                    }}
                    title="Click to toggle completion"
                  >
                    <span className={`task-check-circle ${task.completed ? 'completed' : 'pending'}`}>
                      {task.completed && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
                        </svg>
                      )}
                    </span>
                    <span className="task-name">{task.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Need More Support? Card */}
          <section className="patient-card care-support-card" aria-label="Clinical Support">
            <div className="support-header-row">
              <div className="support-icon-wrap" aria-hidden="true">
                <PatientIcon name="connect-doctor" size={18} />
              </div>
              <div className="support-text-wrap">
                <h2 className="support-title">Need Clinical Support?</h2>
                <p className="support-desc">
                  Connect directly with Dr. Elena Rostova for personalized psychiatric evaluations and guided care adjustments.
                </p>
              </div>
            </div>

            <NavLink to="/patient/connect-doctor" className="patient-btn-primary support-action-btn">
              <span>Connect to a Doctor</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </NavLink>
          </section>
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
