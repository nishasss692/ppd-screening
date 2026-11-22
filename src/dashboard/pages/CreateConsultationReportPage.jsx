import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import '../dashboard.css';

export function CreateConsultationReportPage() {
  const { mothers, screenings, selectedMotherId } = useClinicalData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryMotherId = searchParams.get('mother') || searchParams.get('patient') || selectedMotherId || 'M-108';
  const queryAppointmentId = searchParams.get('appointmentId') || '';

  const activeMother = useMemo(() => {
    return mothers.find((m) => m.id.toLowerCase() === queryMotherId.toLowerCase()) || mothers[0] || null;
  }, [mothers, queryMotherId]);

  const activeScreening = useMemo(() => {
    if (!activeMother) return null;
    return screenings.find((s) => s.motherId === activeMother.id) || null;
  }, [screenings, activeMother]);

  // Form State
  const [patientId, setPatientId] = useState(activeMother?.id || 'M-108');
  const [patientName, setPatientName] = useState(activeMother?.name || 'Amara');
  const [appointmentId, setAppointmentId] = useState(queryAppointmentId);
  const [consultationDate, setConsultationDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  });

  const [presentingComplaints, setPresentingComplaints] = useState(
    'Patient presents with persistent low mood, sleep fragmentation (<4 continuous hours per night), and tearfulness especially during evening hours over the past 3 weeks.'
  );
  const [clinicalObservations, setClinicalObservations] = useState(
    'Patient is cooperative and engaged. Affect is constricted and mildly dysphoric with congruent mood. Normal speech rate and volume. No active suicidal ideation; EPDS Item 10 score is 0. Reality testing intact.'
  );
  const [clinicalAssessment, setClinicalAssessment] = useState(
    'Postpartum depression with mild-to-moderate emotional exhaustion and sleep fragmentation (ICD-10 F53.0).'
  );
  const [treatmentPlan, setTreatmentPlan] = useState(
    'Initiate structured supportive cognitive-behavioral perinatal therapy (6 bi-weekly sessions). Coordinate nighttime infant care with family to restore sleep architecture.'
  );
  const [medications, setMedications] = useState(
    'No psychotropic pharmacotherapy indicated at this stage. Continue prenatal vitamins and magnesium glycinate (200mg nightly) for sleep hygiene.'
  );
  const [recommendations, setRecommendations] = useState(
    'Engage in daily 4-7-8 parasympathetic breathing. Family support to ensure at least 5 hours of continuous sleep each night. Gradual reintroduction of gentle outdoor walks.'
  );
  const [followupInstructions, setFollowupInstructions] = useState(
    'Follow up in 3 weeks for clinical re-evaluation and progress assessment. If symptoms worsen acutely, reach out to our clinic or Tele-MANAS (14416) immediately.'
  );
  const [nextFollowupDate, setNextFollowupDate] = useState('11 Dec 2026 at 11:00 AM');
  const [additionalNotes, setAdditionalNotes] = useState(
    'Partner (Raj) attended part of the consultation and demonstrates strong empathy and practical commitment to night shift feeding.'
  );

  // Patient-friendly simplified fields
  const [patientSummary, setPatientSummary] = useState(
    'During your visit, your doctor discussed your feelings of exhaustion and low mood over the past few weeks. We agreed on a supportive care plan focused on getting more rest and emotional support.'
  );
  const [patientMeds, setPatientMeds] = useState(
    'Continue your daily prenatal vitamins. Take magnesium glycinate (200mg) before bedtime to help you unwind and rest.'
  );
  const [patientRecs, setPatientRecs] = useState(
    'Practice 4-7-8 breathing exercises daily. Let your family handle at least one night feed so you can sleep 5 hours continuously.'
  );
  const [patientFollowup, setPatientFollowup] = useState(
    'Your next appointment is on 11 Dec 2026 at 11:00 AM. If you feel overwhelmed before then, please contact our team.'
  );
  const [approvePatientVersion, setApprovePatientVersion] = useState(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedReportCode, setSavedReportCode] = useState('');

  // Update fields when active mother changes
  useEffect(() => {
    if (activeMother) {
      setPatientId(activeMother.id);
      setPatientName(activeMother.name);
    }
  }, [activeMother]);

  const handleSubmit = async (submitStatus = 'final') => {
    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);

    const payload = {
      patient_identifier: patientId,
      patient_name: patientName,
      appointment_id: appointmentId || null,
      doctor_id: 'DR-005',
      doctor_name: 'Dr. Elena Rostova',
      doctor_specialization: 'Perinatal Psychiatry Lead',
      hospital_id: 'HOSP-001',
      hospital_name: "Apollo Women's Hospital",
      department: 'Perinatal Mental Health',
      consultation_date: consultationDate,
      presenting_complaints: presentingComplaints,
      clinical_observations: clinicalObservations,
      clinical_assessment: clinicalAssessment,
      treatment_plan: treatmentPlan,
      medications: medications || null,
      recommendations: recommendations,
      followup_instructions: followupInstructions,
      next_followup_date: nextFollowupDate || null,
      additional_notes: additionalNotes || null,
      ai_screening_summary: activeScreening ? `Acoustic score: ${activeScreening.risk} risk. EPDS: ${activeScreening.totalScore}/30.` : null,
      epds_summary: activeScreening ? `Total Score: ${activeScreening.totalScore}/30. Q10: 0.` : null,
      status: submitStatus,
      patient_friendly_summary: patientSummary,
      patient_friendly_medications: patientMeds,
      patient_friendly_recommendations: patientRecs,
      patient_friendly_followup: patientFollowup,
      approve_patient_version: approvePatientVersion,
    };

    try {
      const res = await fetch('/api/consultation-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('aanchal_token') || localStorage.getItem('miora_token') || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save consultation report.');
      }

      const data = await res.json();
      setSavedReportCode(data.report_code);
      setStatusMessage(
        submitStatus === 'final'
          ? `Consultation report ${data.report_code} successfully submitted to hospital EHR and patient portal.`
          : `Draft saved successfully (${data.report_code}).`
      );
    } catch (err) {
      setErrorMessage(err.message || 'Error occurred while saving report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="miora-page-root" style={{ padding: '24px 32px' }}>
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: '16px' }}>
        <Link to="/clinical-review" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#14b8a6', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
          <DashboardIcon name="chevronLeft" size={16} />
          <span>Back to Clinical Review</span>
        </Link>
      </nav>

      {/* Header */}
      <header className="clinical-review-header" style={{ marginBottom: '24px' }}>
        <div className="cr-header-left">
          <span className="cr-eyebrow">DOCTOR CONSULTATION WORKFLOW</span>
          <h1 className="cr-title">Create Consultation Report</h1>
          <p className="cr-subtitle">
            Generate formal clinical documentation for hospital records and an approved simplified version for the patient.
          </p>
        </div>
      </header>

      {/* Alert Banners */}
      {statusMessage && (
        <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }} role="status">
          <DashboardIcon name="check" size={18} />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }} role="alert">
          <DashboardIcon name="alertTriangle" size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Layout: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Hospital Clinical Version */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }} aria-labelledby="clinical-doc-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f766e' }}>SECTION A</span>
              <h2 id="clinical-doc-title" style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '2px 0 0 0' }}>
                Hospital Version &bull; Detailed Clinical Report
              </h2>
            </div>
            <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
              Hospital Record
            </span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit('final'); }}>
            {/* Patient & Consultation Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Patient Case ID
                </label>
                <select
                  value={patientId}
                  onChange={(e) => {
                    const sel = mothers.find((m) => m.id === e.target.value);
                    if (sel) {
                      setPatientId(sel.id);
                      setPatientName(sel.name);
                    }
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  {mothers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} &bull; {m.name} (Week {m.postpartumWeek})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Consultation Date
                </label>
                <input
                  type="text"
                  value={consultationDate}
                  onChange={(e) => setConsultationDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  required
                />
              </div>
            </div>

            {/* Presenting Complaints */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Presenting Concerns &amp; Symptoms
              </label>
              <textarea
                rows={3}
                value={presentingComplaints}
                onChange={(e) => setPresentingComplaints(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', lineHeight: '1.5' }}
                required
              />
            </div>

            {/* Clinical Observations */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Clinical Observations &amp; Mental State Examination
              </label>
              <textarea
                rows={3}
                value={clinicalObservations}
                onChange={(e) => setClinicalObservations(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', lineHeight: '1.5' }}
                required
              />
            </div>

            {/* Doctor's Assessment and Diagnosis */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Clinical Assessment &amp; Diagnosis (Approved by Treating Doctor)
              </label>
              <textarea
                rows={2}
                value={clinicalAssessment}
                onChange={(e) => setClinicalAssessment(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #14b8a6', backgroundColor: '#f0fdfa', fontSize: '13px', fontWeight: '500' }}
                required
              />
            </div>

            {/* Treatment Plan */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Treatment Plan &amp; Interventions
              </label>
              <textarea
                rows={3}
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                required
              />
            </div>

            {/* Medication Details */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Medication Details (Name, dosage, frequency, duration, instructions)
              </label>
              <textarea
                rows={2}
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="Leave blank if no pharmacological therapy prescribed"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
              />
            </div>

            {/* Recommendations */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Psychosocial &amp; Restorative Recommendations
              </label>
              <textarea
                rows={2}
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                required
              />
            </div>

            {/* Follow-up Plan & Next Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Follow-up Instructions
                </label>
                <input
                  type="text"
                  value={followupInstructions}
                  onChange={(e) => setFollowupInstructions(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Next Follow-up Date
                </label>
                <input
                  type="text"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  placeholder="e.g. 11 Dec 2026 at 11:00 AM"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Additional Confidential Notes (Never shared with patient) */}
            <div style={{ marginBottom: '24px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '14px', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
                Additional Clinical Notes (Hospital &amp; Clinician Only &bull; STRICTLY PRIVATE)
              </label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Internal hospital notes, administrative observations, or private clinical flags..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fcd34d', backgroundColor: '#ffffff', fontSize: '13px' }}
              />
              <small style={{ color: '#b45309', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                These notes will remain strictly confidential and will never be exposed in the patient portal.
              </small>
            </div>

            {/* Primary Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="miora-btn-secondary"
                disabled={isSubmitting}
                onClick={() => handleSubmit('draft')}
              >
                Save Draft
              </button>

              <button
                type="submit"
                className="miora-cta-primary"
                disabled={isSubmitting}
                style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600' }}
              >
                {isSubmitting ? 'Submitting Report...' : 'Submit Final Report to Hospital & Patient'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Patient-Friendly Version (Doctor Reviews & Approves) */}
        <section style={{ backgroundColor: '#fffbf9', borderRadius: '12px', border: '1px solid #f3e8e2', padding: '24px' }} aria-labelledby="patient-doc-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #f0e1d8', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c73566' }}>SECTION B</span>
              <h2 id="patient-doc-title" style={{ fontSize: '18px', fontWeight: '700', color: '#881337', margin: '2px 0 0 0' }}>
                Patient Version &bull; Simplified Report
              </h2>
            </div>
            <span style={{ fontSize: '12px', background: '#ffe4e6', color: '#9f1239', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
              Patient Facing
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#7a6870', marginBottom: '16px', lineHeight: '1.5' }}>
            The patient will receive this clear, everyday-language version in their dashboard. Review and refine below to ensure compassionate, jargon-free communication.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Friendly Summary */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4c0519', marginBottom: '4px' }}>
                Summary of Discussion
              </label>
              <textarea
                rows={4}
                value={patientSummary}
                onChange={(e) => setPatientSummary(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecdd3', backgroundColor: '#ffffff', fontSize: '13px', lineHeight: '1.5' }}
              />
            </div>

            {/* Clear Medication Instructions */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4c0519', marginBottom: '4px' }}>
                Medication Instructions (Simple &amp; Clear)
              </label>
              <textarea
                rows={2}
                value={patientMeds}
                onChange={(e) => setPatientMeds(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecdd3', backgroundColor: '#ffffff', fontSize: '13px' }}
              />
            </div>

            {/* Supportive Recommendations */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4c0519', marginBottom: '4px' }}>
                Self-Care &amp; Wellbeing Guidance
              </label>
              <textarea
                rows={3}
                value={patientRecs}
                onChange={(e) => setPatientRecs(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecdd3', backgroundColor: '#ffffff', fontSize: '13px' }}
              />
            </div>

            {/* Follow-up Instructions */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4c0519', marginBottom: '4px' }}>
                Follow-Up Guidance for Patient
              </label>
              <textarea
                rows={3}
                value={patientFollowup}
                onChange={(e) => setPatientFollowup(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecdd3', backgroundColor: '#ffffff', fontSize: '13px' }}
              />
            </div>

            {/* Doctor Approval Checkbox */}
            <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #ffe4e6' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#881337', fontWeight: '600', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={approvePatientVersion}
                  onChange={(e) => setApprovePatientVersion(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#c73566' }}
                />
                <span>Approve simplified version for publication to patient portal</span>
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CreateConsultationReportPage;
