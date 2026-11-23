import React, { useState, useEffect } from 'react';
import { PatientIcon } from '../PatientIcons.jsx';

export const PSYCHOSOCIAL_QUESTIONS = [
  {
    id: 'feeling_about_motherhood',
    featureKey: 'Feeling about motherhood',
    title: 'How are you currently feeling about motherhood and caring for your baby?',
    helper: 'It is natural for motherhood to feel overwhelming, joyful, bittersweet, or exhausting. Choose what fits closest today.',
    options: [
      { value: 'Happy', label: 'Generally happy, affectionate, and positive about motherhood' },
      { value: 'Neutral', label: 'Ordinary or mixed feelings; some days are okay, some are tough' },
      { value: 'Sad', label: 'Often feeling down, sad, detached, or overwhelmed by motherhood' },
    ],
  },
  {
    id: 'relationship_husband',
    featureKey: 'Relationship with husband',
    title: 'How would you describe your relationship and mutual communication with your husband/partner?',
    helper: 'Partnership dynamics frequently evolve after childbirth. Select the option that best reflects recent days.',
    options: [
      { value: 'Friendly', label: 'Warm, supportive, and communicative' },
      { value: 'Good', label: 'Good and steady' },
      { value: 'Neutral', label: 'Average or manageable' },
      { value: 'Poor', label: 'Strained, distant, or frequent tension' },
      { value: 'Bad', label: 'Very difficult or distressing' },
      { value: 'Prefer not to answer', label: 'Prefer not to answer' },
    ],
  },
  {
    id: 'relationship_inlaws',
    featureKey: 'Relationship with the in-laws',
    title: 'How would you describe your current relationship with your in-laws or extended family?',
    helper: 'Family involvement is influential in postpartum adjustment. Select what feels true for you.',
    options: [
      { value: 'Friendly', label: 'Warm, helpful, and supportive' },
      { value: 'Good', label: 'Good and harmonious' },
      { value: 'Neutral', label: 'Neutral or routine contact' },
      { value: 'Poor', label: 'Strained or critical' },
      { value: 'Bad', label: 'Very stressful or uncomfortable' },
      { value: 'Prefer not to answer', label: 'Prefer not to answer' },
    ],
  },
  {
    id: 'sleep_when_baby_asleep',
    featureKey: 'Relax/sleep when the newborn is asleep',
    title: 'When your baby is asleep, are you able to relax or fall asleep yourself?',
    helper: 'Many mothers feel hyper-alert or struggle to wind down even when the infant is sleeping soundly.',
    options: [
      { value: 'Yes', label: 'Yes, I can rest or fall asleep when baby sleeps' },
      { value: 'No', label: 'No, I struggle to fall asleep or quiet my racing thoughts' },
    ],
  },
  {
    id: 'sleep_when_baby_tended',
    featureKey: 'Relax/sleep when newborn is tended ', // note: exact trailing space required by model
    title: 'When someone else (partner, family member) is actively caring for the baby, can you comfortably rest?',
    helper: 'Being able to hand over responsibility and rest is an important marker of emotional safety and rest.',
    options: [
      { value: 'Yes', label: 'Yes, I can relax knowing someone else is tending to my baby' },
      { value: 'No', label: 'No, I feel too anxious, guilty, or restless to rest' },
    ],
  },
  {
    id: 'angry_after_childbirth',
    featureKey: 'Angry after latest child birth',
    title: 'Have you noticed feeling unusually irritable, frustrated, or angry since giving birth?',
    helper: 'Postpartum irritability and sudden anger spikes are common hormonal and exhaustion reactions, not personal failure.',
    options: [
      { value: 'No', label: 'No, my patience and mood feel within my usual baseline' },
      { value: 'Yes', label: 'Yes, I find myself feeling easily irritated, short-tempered, or snappy' },
    ],
  },
  {
    id: 'received_support',
    featureKey: 'Recieved Support',
    title: 'How much practical and emotional support are you actually receiving on a day-to-day basis?',
    helper: 'Consider assistance with baby care, household meals, rest, and someone listening to you.',
    options: [
      { value: 'High', label: 'High — I have reliable, generous family and community help' },
      { value: 'Medium', label: 'Medium — Some help is available, but gaps remain' },
      { value: 'Low', label: 'Low — Very little or no consistent support' },
    ],
  },
  {
    id: 'need_for_support',
    featureKey: 'Need for Support',
    title: 'How much extra support do you feel you currently need right now?',
    helper: 'Tuning into your own needs helps your healthcare team understand your care requirements.',
    options: [
      { value: 'Low', label: 'Low — I feel steady and manageable with current routines' },
      { value: 'Medium', label: 'Medium — Some additional physical or emotional help would be beneficial' },
      { value: 'High', label: 'High — I urgently need more emotional, medical, or practical relief' },
    ],
  },
  {
    id: 'trust_and_share',
    featureKey: 'Trust and share feelings',
    title: 'Is there someone close in your life whom you truly trust and can openly share your vulnerable feelings with?',
    helper: 'Having at least one trusted confidant is a protective buffer against maternal emotional distress.',
    options: [
      { value: 'Yes', label: 'Yes, I have someone I trust completely and can open up to' },
      { value: 'No', label: 'No, I keep my feelings to myself or do not feel safe sharing' },
    ],
  },
];

const STORAGE_KEY = 'aanchal_psychosocial_answers';

export function PsychosocialTab({ onContinueToEpds }) {
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return {};
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [reflection, setReflection] = useState(() => {
    try {
      const saved = localStorage.getItem('aanchal_psychosocial_reflection');
      return saved || '';
    } catch (e) {
      return '';
    }
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch (e) {}
  }, [answers]);

  useEffect(() => {
    try {
      localStorage.setItem('aanchal_psychosocial_reflection', reflection);
    } catch (e) {}
  }, [reflection]);

  const currentQ = PSYCHOSOCIAL_QUESTIONS[currentIdx];
  const selectedValue = answers[currentQ.featureKey];

  const handleSelect = (val) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQ.featureKey]: val,
    }));
  };

  const handleNext = () => {
    if (currentIdx < PSYCHOSOCIAL_QUESTIONS.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setSaveSuccess(true);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const answeredCount = PSYCHOSOCIAL_QUESTIONS.filter(
    (q) => answers[q.featureKey] !== undefined && answers[q.featureKey] !== null
  ).length;

  const isComplete = answeredCount === PSYCHOSOCIAL_QUESTIONS.length;

  const handleProceed = () => {
    if (onContinueToEpds) {
      onContinueToEpds(answers);
    }
  };

  return (
    <div className="aanchal-psychosocial-shell" aria-label="Mother's Wellbeing & Support Assessment">
      {/* Intro Header */}
      <section className="patient-card" style={{ marginBottom: '20px', padding: '24px', background: '#fff' }}>
        <div className="miora-dash-eyebrow">
          <span>STAGE 2 SCREENING ASSESSMENT</span>
          <span className="miora-dash-eyebrow-line" aria-hidden="true" />
        </div>
        <h2 className="patient-page-heading" style={{ fontSize: '20px', marginTop: 4 }}>
          Mother&apos;s Wellbeing &amp; <em>Support Assessment</em>
        </h2>
        <p className="patient-page-subheading" style={{ marginTop: 6, color: '#5c4750' }}>
          Nine focused questions examining your daily emotional environment, relationships, and rest.
          These answers are integrated with your clinical background into our verified clinical risk model.
        </p>

        {/* Progress tracker */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 6, background: '#f5e8ed', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round(((currentIdx + 1) / PSYCHOSOCIAL_QUESTIONS.length) * 100)}%`,
                height: '100%',
                background: '#ba1e53',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ba1e53' }}>
            Question {currentIdx + 1} of {PSYCHOSOCIAL_QUESTIONS.length}
          </span>
        </div>
      </section>

      {/* Active Question Card */}
      <section className="patient-card" style={{ padding: '28px', background: '#fff', border: '1px solid #f6d1dd' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#fcebf0',
              color: '#ba1e53',
              fontWeight: 700,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {currentIdx + 1}
          </span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#2d3748', lineHeight: 1.4 }}>
              {currentQ.title}
            </h3>
            {currentQ.helper && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#718096' }}>
                {currentQ.helper}
              </p>
            )}
          </div>
        </div>

        {/* Options */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentQ.options.map((opt) => {
            const isSelected = selectedValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                style={{
                  textAlign: 'left',
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: isSelected ? '2px solid #ba1e53' : '1px solid #f0d5df',
                  background: isSelected ? '#fdf2f6' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: isSelected ? '6px solid #ba1e53' : '2px solid #cbd5e1',
                    background: '#fff',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, color: isSelected ? '#ba1e53' : '#334155', fontWeight: isSelected ? 600 : 400 }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #fcebf0' }}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="patient-btn-secondary"
            style={{ opacity: currentIdx === 0 ? 0.4 : 1, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}
          >
            Previous
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="patient-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <span>{currentIdx === PSYCHOSOCIAL_QUESTIONS.length - 1 ? 'Review & Complete' : 'Next Question'}</span>
            <PatientIcon name="arrow-right" size={15} />
          </button>
        </div>
      </section>

      {/* Optional Qualitative Reflection Card */}
      <section className="patient-card" style={{ marginTop: '20px', padding: '24px', background: '#fff' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#2d3748' }}>
          Personal Reflection (Optional)
        </h3>
        <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#718096' }}>
          Any additional thoughts about your home, baby, or emotional climate. This text is reserved for your healthcare clinician and is kept strictly out of the statistical model.
        </p>
        <textarea
          rows={3}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="e.g. My partner works long shifts; nighttime feeds are currently exhausting..."
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 8,
            border: '1px solid #f0d5df',
            fontFamily: 'inherit',
            fontSize: 13.5,
            color: '#2d3748',
            resize: 'vertical',
          }}
        />
      </section>

      {/* Completion & Continue to EPDS CTA */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, color: '#718096' }}>
          {isComplete ? 'All 9 questions completed.' : `${answeredCount} of 9 answered.`}
        </span>
        <button
          type="button"
          onClick={handleProceed}
          className="patient-btn-primary"
          style={{ padding: '12px 28px', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span>Continue to EPDS Assessment</span>
          <PatientIcon name="arrow-right" size={16} />
        </button>
      </div>
    </div>
  );
}

export default PsychosocialTab;
