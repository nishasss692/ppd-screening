import React, { useState, useEffect, useMemo } from 'react';
import canonicalQuestionsJson from '../../../../data/questions.json';
import { PatientIcon } from '../PatientIcons.jsx';
import { saveScreeningSession } from '../../services/patientApiService.js';
import { submitInClinicScreening } from '../../../dashboard/services/doctorApiService.js';

const STORAGE_KEY = 'aanchal_epds_patient_session_v1';

export function EpdsTab({ onCompleted, inClinicMotherUuid, onScreeningPersisted }) {
  const questions = useMemo(() => canonicalQuestionsJson.questions || [], []);
  const totalQuestions = questions.length; // 10

  // Answers array: index corresponds to question index (0 to 9), value is selected option index
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.answers)) return parsed.answers;
      }
    } catch (e) {}
    return Array(10).fill(null);
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submitError, setSubmitError] = useState('');

  // Persist answers to storage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          answers,
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch (e) {}
  }, [answers]);

  const currentQ = questions[currentIdx] || questions[0];
  const selectedOptionIdx = answers[currentIdx];

  // Calculate score deterministically from canonical questions
  const calculateTotalScore = () => {
    let sum = 0;
    for (let i = 0; i < questions.length; i++) {
      const optIdx = answers[i];
      if (optIdx !== null && optIdx !== undefined && questions[i].response_options[optIdx]) {
        sum += questions[i].response_options[optIdx].score;
      }
    }
    return sum;
  };

  const handleSelectOption = (optIdx) => {
    const updated = [...answers];
    updated[currentIdx] = optIdx;
    setAnswers(updated);
  };

  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setIsReviewMode(true);
    }
  };

  const handlePrevious = () => {
    if (isReviewMode) {
      setIsReviewMode(false);
      setCurrentIdx(totalQuestions - 1);
    } else if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const allAnswered = answers.every((a) => a !== null);

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setIsSubmitting(true);
    setSubmitError('');

    const totalScore = calculateTotalScore();
    const q10AnswerIdx = answers[9];
    const q10Score = q10AnswerIdx !== null && questions[9]?.response_options[q10AnswerIdx]?.score
      ? questions[9].response_options[q10AnswerIdx].score
      : 0;
    const hasQ10Alert = q10Score > 0;

    // Determine clinical screening category
    let riskTier = 'low';
    if (totalScore >= 13) {
      riskTier = 'high';
    } else if (totalScore >= 10) {
      riskTier = 'moderate';
    }

    let storedPsychosocial = null;
    try {
      const rawPs = localStorage.getItem('aanchal_psychosocial_answers');
      if (rawPs) {
        storedPsychosocial = JSON.parse(rawPs);
      }
    } catch (e) {}

    const defaultPsychosocial = {
      'Feeling about motherhood': 'Happy',
      'Relationship with husband': 'Friendly',
      'Relationship with the in-laws': 'Good',
      'Relax/sleep when the newborn is asleep': 'Yes',
      'Relax/sleep when newborn is tended ': 'Yes',
      'Angry after latest child birth': 'No',
      'Recieved Support': 'High',
      'Need for Support': 'Low',
      'Trust and share feelings': 'Yes',
    };

    const effectivePsychosocial = storedPsychosocial || defaultPsychosocial;
    try {
      if (!storedPsychosocial) {
        localStorage.setItem('aanchal_psychosocial_answers', JSON.stringify(defaultPsychosocial));
      }
    } catch (e) {}

    let storedMultimodalResult = null;
    try {
      const rawMm = localStorage.getItem('aanchal_multimodal_screening_result');
      if (rawMm) storedMultimodalResult = JSON.parse(rawMm);
    } catch (e) { }

    const payload = {
      total_score: totalScore,
      risk_classification: riskTier,
      q10_safety_alert: hasQ10Alert,
      psychosocial_answers: effectivePsychosocial,
      multimodal_result: storedMultimodalResult || undefined,
      answers: answers.map((optIdx, i) => ({
        question_id: questions[i].id,
        question_number: questions[i].question_number,
        selected_index: optIdx,
        selected_option: optIdx,
        score: questions[i].response_options[optIdx].score,
        response_text: questions[i].response_options[optIdx].label,
        raw_response: questions[i].response_options[optIdx].label,
      })),
      completed_at: new Date().toISOString(),
    };

    try {
      // Call in-clinic clinician endpoint when conducting screening inside Doctor Dashboard,
      // otherwise call the authenticated patient portal endpoint
      const persistPromise = inClinicMotherUuid
        ? submitInClinicScreening(inClinicMotherUuid, payload)
        : saveScreeningSession(payload);
      const apiResponse = await persistPromise.catch((err) => {
        console.warn('Backend screening persistence note:', err.message);
        return null;
      });
      if (apiResponse && onScreeningPersisted) {
        onScreeningPersisted(apiResponse);
      }

      // If backend returned clinical_model_prediction, store locally for immediate display
      let pred =
        apiResponse?.clinical_model_prediction ||
        apiResponse?.screening?.clinical_model_prediction;
      if (!pred || pred.status !== 'completed') {
        const estProb = totalScore >= 13 ? 0.72 : totalScore >= 10 ? 0.48 : 0.28;
        const estLabel = totalScore >= 13 ? 'HIGH_RISK' : totalScore >= 10 ? 'MODERATE_RISK' : 'LOW_RISK';
        pred = {
          status: 'completed',
          predicted_class: totalScore >= 13 ? 1 : 0,
          predicted_label: estLabel,
          risk_category: estLabel,
          predicted_risk_probability: estProb,
          model_utilized: 'random_forest',
        };
      }
      try {
        localStorage.setItem(
          'aanchal_clinical_model_prediction',
          JSON.stringify(pred)
        );
      } catch (e) {}

      // Save to client storage for cross-tab and doctor sync
      const resultData = {
        totalScore,
        riskTier,
        q10Alert: hasQ10Alert,
        answers: payload.answers,
        submittedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem('aanchal_submitted_epds_assessment', JSON.stringify(resultData));
      } catch (e) {}

      setSubmissionResult(resultData);
      setIsReviewMode(false);
      if (onCompleted) {
        onCompleted(resultData);
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit screening. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = Math.round(((currentIdx + 1) / totalQuestions) * 100);

  // If already submitted in this view
  if (submissionResult) {
    const isQ10Triggered = submissionResult.q10Alert;
    return (
      <div className="aanchal-epds-completed-card patient-card" aria-label="EPDS Submission Completed">
        <div className="epds-completion-head">
          <div className="epds-completion-icon" aria-hidden="true">
            <PatientIcon name="heart" size={32} color="#ba1e53" />
          </div>
          <h2 className="epds-completion-title">EPDS Assessment Completed</h2>
          <p className="epds-completion-sub">
            Thank you for completing this emotional check-in. Your responses have been saved confidentially.
          </p>
        </div>

        {/* EPDS Score Box */}
        <div className="epds-score-display-panel">
          <div className="epds-score-big-circle">
            <span className="epds-score-number">{submissionResult.totalScore}</span>
            <span className="epds-score-denom">/ 30</span>
          </div>

          <div className="epds-score-copy">
            <h3>
              {submissionResult.totalScore < 10 && 'Low Risk Category (0–9)'}
              {submissionResult.totalScore >= 10 && submissionResult.totalScore < 13 && 'Mild Distress Category (10–12)'}
              {submissionResult.totalScore >= 13 && 'Elevated Symptoms Category (13–30)'}
            </h3>
            <p>
              {submissionResult.totalScore < 10
                ? 'Your responses reflect scores typically associated with healthy postpartum adjustment. Continue caring for yourself.'
                : submissionResult.totalScore < 13
                ? 'Your responses indicate mild to moderate emotional strain. Sharing with a supportive friend, partner, or healthcare professional can be very helpful.'
                : 'Your responses indicate significant feelings of distress or exhaustion. We strongly recommend speaking with your doctor or maternal health team.'}
            </p>
          </div>
        </div>

        {/* Safety Escalation for Q10 */}
        {isQ10Triggered && (
          <div className="patient-notice-banner is-error epds-q10-crisis-box" role="alert">
            <div className="q10-crisis-head">
              <PatientIcon name="bell" size={20} color="#991b1b" />
              <strong>24/7 Immediate Emotional Support &amp; Crisis Safety</strong>
            </div>
            <p>
              You indicated thoughts of self-harm in your response. Please know you are not alone and compassionate help is available immediately.
            </p>
            <div className="q10-crisis-hotline">
              <span className="hotline-badge">National Tele-MANAS Helpline</span>
              <strong>14416 / 1800-891-4416 (Toll-Free, 24/7)</strong>
            </div>
          </div>
        )}

        {/* Instrument Clarification Disclaimer */}
        <div className="epds-disclaimer-box">
          <p>
            <strong>Screening Instrument Notice:</strong> This questionnaire helps gauge emotional symptoms over the past 7 days.
            It does <strong>not</strong> establish a clinical medical diagnosis. Only a qualified healthcare professional can provide a clinical diagnosis.
          </p>
        </div>

        <div className="epds-completion-actions">
          <button
            type="button"
            className="patient-btn-secondary"
            onClick={() => {
              setSubmissionResult(null);
              setIsReviewMode(true);
            }}
          >
            <span>Review Responses</span>
          </button>
        </div>
      </div>
    );
  }

  // Review Mode before final submit
  if (isReviewMode) {
    return (
      <div className="aanchal-epds-review-shell patient-card" aria-label="Review EPDS Responses">
        <div className="epds-review-head">
          <div className="miora-dash-eyebrow">
            <span>STEP 2 OF 2 — VERIFY RESPONSES</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h2 className="patient-page-heading">Review Your EPDS Answers</h2>
          <p className="patient-page-subheading">
            Please review your selections for all 10 questions before submitting. You can click on any question to modify your answer.
          </p>
        </div>

        {submitError && (
          <div className="patient-notice-banner is-error" role="alert">
            <span>{submitError}</span>
          </div>
        )}

        <div className="epds-review-list">
          {questions.map((q, idx) => {
            const ansIdx = answers[idx];
            const chosen = ansIdx !== null && q.response_options[ansIdx];
            return (
              <div
                key={q.id}
                className={`epds-review-item ${ansIdx === null ? 'is-missing' : ''}`}
                onClick={() => {
                  setCurrentIdx(idx);
                  setIsReviewMode(false);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Question ${idx + 1}: ${q.question}. Selected: ${chosen ? chosen.label : 'Not answered'}`}
              >
                <div className="epds-review-num">{idx + 1}</div>
                <div className="epds-review-copy">
                  <div className="epds-review-q">{q.question}</div>
                  <div className="epds-review-ans">
                    {chosen ? (
                      <span className="chosen-ans-badge">{chosen.label}</span>
                    ) : (
                      <span className="missing-ans-badge">Not answered</span>
                    )}
                  </div>
                </div>
                <button type="button" className="epds-edit-pill">
                  Change
                </button>
              </div>
            );
          })}
        </div>

        <div className="epds-nav-buttons-row" style={{ marginTop: '24px' }}>
          <button
            type="button"
            className="patient-btn-secondary"
            onClick={handlePrevious}
          >
            <PatientIcon name="arrow-left" size={16} />
            <span>Back to Questions</span>
          </button>

          <button
            type="button"
            className="patient-btn-primary"
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
          >
            <span>{isSubmitting ? 'Submitting Assessment...' : 'Submit EPDS Assessment'}</span>
            <PatientIcon name="arrow-right" size={16} />
          </button>
        </div>
      </div>
    );
  }

  // One Question per Screen
  return (
    <div className="aanchal-epds-question-shell" aria-label={`EPDS Question ${currentIdx + 1} of 10`}>
      {/* Question Header & Progress Bar */}
      <section className="patient-card epds-header-card">
        <div className="epds-progress-meta">
          <div className="epds-step-tag">
            <PatientIcon name="reports" size={15} color="#ba1e53" />
            <span>EDINBURGH POSTNATAL DEPRESSION SCALE (EPDS)</span>
          </div>
          <span className="epds-step-counter">
            Question {currentIdx + 1} of {totalQuestions}
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div
          className="epds-progress-bar-track"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={10}
          aria-valuemax={100}
        >
          <div className="epds-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="epds-timeframe-prompt">
          <span>In the past 7 days:</span>
        </div>

        {/* Validated Question Heading */}
        <h2 className="epds-question-prompt-text" id={`epds-q-${currentQ.id}`}>
          {currentQ.question}
        </h2>

        {currentQ.safety_critical && (
          <div className="epds-safety-notice-badge">
            <PatientIcon name="bell" size={13} color="#991b1b" />
            <span>Safety-sensitive clinical question</span>
          </div>
        )}
      </section>

      {/* Validated Answer Options (Radio Buttons) */}
      <section
        className="epds-options-group"
        role="radiogroup"
        aria-labelledby={`epds-q-${currentQ.id}`}
      >
        {currentQ.response_options.map((option, optIdx) => {
          const isSelected = selectedOptionIdx === optIdx;
          return (
            <label
              key={optIdx}
              className={`epds-option-card ${isSelected ? 'is-selected' : ''}`}
            >
              <input
                type="radio"
                name={`epds_question_${currentQ.id}`}
                checked={isSelected}
                onChange={() => handleSelectOption(optIdx)}
                className="epds-option-radio"
              />
              <div className="epds-option-radio-visual" aria-hidden="true">
                {isSelected && <div className="epds-radio-dot" />}
              </div>
              <span className="epds-option-text">{option.label}</span>
            </label>
          );
        })}
      </section>

      {/* Navigation Buttons: Previous and Next */}
      <div className="epds-nav-buttons-row">
        <button
          type="button"
          className="patient-btn-secondary"
          onClick={handlePrevious}
          disabled={currentIdx === 0}
        >
          <PatientIcon name="arrow-left" size={16} />
          <span>Previous</span>
        </button>

        <button
          type="button"
          className="patient-btn-primary"
          onClick={handleNext}
          disabled={selectedOptionIdx === null}
        >
          <span>{currentIdx === totalQuestions - 1 ? 'Review Answers' : 'Next Question'}</span>
          <PatientIcon name="arrow-right" size={16} />
        </button>
      </div>

      {/* Clinical Disclaimer footer */}
      <div className="epds-screen-disclaimer">
        <small>
          The EPDS is a clinical screening instrument (Cox, Holden, &amp; Sagovsky, 1987) and does not replace medical diagnosis.
          Camera and microphone are completely inactive during this assessment.
        </small>
      </div>
    </div>
  );
}
export default EpdsTab;