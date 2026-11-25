import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { fetchHospitalReportDetail } from './hospitalService.js';
import { buildMultiPagePdfBlob, triggerBlobDownload } from '../utils/pdfBuilder.js';
import './hospital.css';

export function HospitalReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchHospitalReportDetail(id);
        if (mounted) {
          setReport(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Unable to retrieve clinical report.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (id) {
      loadReport();
    }

    return () => {
      mounted = false;
    };
  }, [id]);

  const handlePrint = () => {
    if (report) {
      const lines = [
        'AANCHAL - DOCTOR CONSULTATION REPORT',
        `Report Code: ${report.report_code || report.id}`,
        `Consultation Date: ${report.consultation_date || 'N/A'}`,
        `Patient: ${report.patient_name || 'N/A'} | Doctor: ${report.doctor_name || 'N/A'}`,
        `Hospital: ${report.hospital_name || 'N/A'} | Status: ${report.status || 'final'}`,
        '--------------------------------------------------------------------------------',
        '1. CONSULTATION SUMMARY',
        report.summary || 'No summary recorded.',
        '',
        '2. MEDICATION INSTRUCTIONS',
        report.medications_instructions || 'None prescribed.',
        '',
        '3. RECOMMENDATIONS & SELF-CARE',
        report.recommendations || 'None recorded.',
        '',
        '4. FOLLOW-UP INSTRUCTIONS',
        report.followup_instructions || 'As advised.',
        `Next Follow-up Date: ${report.next_followup_date || 'Scheduled as needed'}`,
      ];
      const blob = buildMultiPagePdfBlob(lines);
      triggerBlobDownload(blob, `AANCHAL_Consultation_${report.report_code || report.id}.pdf`);
      return;
    }
    window.print();
  };

  if (loading) {
    return (
      <div className="hosp-report-detail-page">
        <div className="hosp-loading-state" role="status">
          <span className="hosp-spinner" />
          <p>Loading clinical consultation report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="hosp-report-detail-page">
        <div className="hosp-error-banner" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error || 'Report not found.'}</span>
        </div>
        <button
          type="button"
          className="hosp-btn-secondary"
          onClick={() => navigate('/hospital/reports')}
          style={{ marginTop: '16px' }}
        >
          Back to Reports List
        </button>
      </div>
    );
  }

  return (
    <div className="hosp-report-detail-page">
      {/* Navigation Breadcrumb / Top Bar */}
      <nav className="hosp-breadcrumb-bar" aria-label="Breadcrumb">
        <Link to="/hospital/reports" className="hosp-breadcrumb-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to All Reports</span>
        </Link>
        <div className="hosp-breadcrumb-actions">
          <button
            type="button"
            className="hosp-btn-secondary hosp-btn-sm"
            onClick={handlePrint}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Print Report</span>
          </button>
        </div>
      </nav>

      {/* Main Clinical Document Card */}
      <article className="hosp-clinical-doc-card">
        {/* Document Header */}
        <header className="hosp-doc-header">
          <div className="hosp-doc-header-brand">
            <div className="hosp-doc-logo-pill">AANCHAL Clinical Care Network</div>
            <h1 className="hosp-doc-title">Comprehensive Clinical Consultation Report</h1>
            <p className="hosp-doc-subtitle">
              Confidential Medical Assessment &bull; Department of {report.department || 'Perinatal Mental Health'}
            </p>
          </div>
          <div className="hosp-doc-meta-badge">
            <span className="hosp-doc-code">{report.report_code}</span>
            <span
              className={`hosp-status-pill ${
                report.status === 'final' ? 'status-confirmed' : 'status-pending'
              }`}
            >
              {report.status === 'final' ? 'Finalized by Clinician' : 'Draft Assessment'}
            </span>
          </div>
        </header>

        {/* 1. Patient Information & 2. Consultation Details */}
        <section className="hosp-doc-grid-section" aria-label="Patient and consultation information">
          <div className="hosp-doc-info-block">
            <h2 className="hosp-section-kicker">1. Patient Information</h2>
            <div className="hosp-meta-pairs">
              <div>
                <span className="hosp-meta-label">Patient Full Name:</span>
                <strong className="hosp-meta-value">{report.patient_name}</strong>
              </div>
              <div>
                <span className="hosp-meta-label">Patient Case Identifier:</span>
                <strong className="hosp-meta-value">{report.patient_identifier}</strong>
              </div>
              {report.appointment_id && (
                <div>
                  <span className="hosp-meta-label">Associated Appointment ID:</span>
                  <span className="hosp-meta-value">{report.appointment_id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="hosp-doc-info-block">
            <h2 className="hosp-section-kicker">2. Consultation Details</h2>
            <div className="hosp-meta-pairs">
              <div>
                <span className="hosp-meta-label">Consultation Date:</span>
                <strong className="hosp-meta-value">{report.consultation_date}</strong>
              </div>
              <div>
                <span className="hosp-meta-label">Hospital / Clinic:</span>
                <span className="hosp-meta-value">{report.hospital_name}</span>
              </div>
              <div>
                <span className="hosp-meta-label">Clinical Department:</span>
                <span className="hosp-meta-value">{report.department}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 12. Doctor's Name & Professional Details */}
        <section className="hosp-doc-section" aria-label="Doctor professional details">
          <h2 className="hosp-section-title">Attending Physician Details</h2>
          <div className="hosp-doctor-profile-strip">
            <div className="hosp-doc-avatar-init">
              {report.doctor_name.replace('Dr. ', '').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong className="hosp-doc-lead-name">{report.doctor_name}</strong>
              <p className="hosp-doc-lead-meta">
                {report.doctor_specialization} &bull; Licensed Medical Specialist
              </p>
            </div>
          </div>
        </section>

        {/* 3. Presenting Concerns and Symptoms */}
        <section className="hosp-doc-section" aria-label="Presenting concerns and symptoms">
          <h2 className="hosp-section-title">3. Presenting Complaints &amp; Symptoms</h2>
          <div className="hosp-doc-content-box">
            <p>{report.presenting_complaints}</p>
          </div>
        </section>

        {/* 4. Clinical Observations */}
        <section className="hosp-doc-section" aria-label="Clinical observations">
          <h2 className="hosp-section-title">4. Clinical Observations &amp; Mental State Examination</h2>
          <div className="hosp-doc-content-box">
            <p>{report.clinical_observations}</p>
          </div>
        </section>

        {/* 5. AI Screening Summary & 6. EPDS Score (if authorized) */}
        {(report.ai_screening_summary || report.epds_summary) && (
          <section className="hosp-doc-section" aria-label="Screening review">
            <h2 className="hosp-section-title">5 &amp; 6. Authorized Screening &amp; EPDS Assessment Summary</h2>
            <div className="hosp-screening-review-card">
              {report.epds_summary && (
                <div className="hosp-screening-col">
                  <strong>EPDS Scoring Summary</strong>
                  <p>{report.epds_summary}</p>
                </div>
              )}
              {report.ai_screening_summary && (
                <div className="hosp-screening-col">
                  <strong>Acoustic &amp; Conversational Biomarker Findings</strong>
                  <p>{report.ai_screening_summary}</p>
                </div>
              )}
            </div>
            <small className="hosp-disclaimer-note">
              Note: Algorithmic screening findings are investigative reference tools only and do not constitute an automated diagnosis.
            </small>
          </section>
        )}

        {/* 7. Doctor's Clinical Assessment and Diagnosis */}
        <section className="hosp-doc-section" aria-label="Doctor's clinical assessment and diagnosis">
          <h2 className="hosp-section-title">7. Clinical Assessment &amp; Diagnosis</h2>
          <div className="hosp-doc-highlight-box">
            <strong>Diagnostic Impression / Assessment:</strong>
            <p>{report.clinical_assessment}</p>
          </div>
        </section>

        {/* 8. Treatment Plan */}
        <section className="hosp-doc-section" aria-label="Treatment plan">
          <h2 className="hosp-section-title">8. Treatment Plan &amp; Interventions</h2>
          <div className="hosp-doc-content-box">
            <p>{report.treatment_plan}</p>
          </div>
        </section>

        {/* 9. Medication Details, if prescribed */}
        <section className="hosp-doc-section" aria-label="Medication details">
          <h2 className="hosp-section-title">9. Prescribed Medication &amp; Posology</h2>
          <div className="hosp-doc-content-box">
            {report.medications ? (
              <p>{report.medications}</p>
            ) : (
              <p className="hosp-muted-text">No pharmacological therapy prescribed during this consultation.</p>
            )}
          </div>
        </section>

        {/* 10. Recommendations */}
        <section className="hosp-doc-section" aria-label="Recommendations">
          <h2 className="hosp-section-title">10. Psychosocial &amp; Lifestyle Recommendations</h2>
          <div className="hosp-doc-content-box">
            <p>{report.recommendations}</p>
          </div>
        </section>

        {/* 11. Follow-up Instructions and Date */}
        <section className="hosp-doc-section" aria-label="Follow-up instructions and date">
          <h2 className="hosp-section-title">11. Follow-up Plan &amp; Clinical Escalation Triggers</h2>
          <div className="hosp-followup-card">
            <div>
              <strong>Next Scheduled Follow-up:</strong>
              <p className="hosp-followup-target">{report.next_followup_date || 'To be scheduled based on clinical progress'}</p>
            </div>
            <div style={{ marginTop: '12px' }}>
              <strong>Follow-up Instructions:</strong>
              <p>{report.followup_instructions}</p>
            </div>
          </div>
        </section>

        {/* Confidential Clinician Notes (Hospital-Only View) */}
        {report.additional_notes && (
          <section className="hosp-doc-section hosp-confidential-section" aria-label="Confidential clinician notes">
            <div className="hosp-confidential-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Confidential Clinician / Hospital Administrative Note</span>
            </div>
            <div className="hosp-doc-content-box hosp-confidential-box">
              <p>{report.additional_notes}</p>
            </div>
          </section>
        )}

        {/* 13. Timestamps & Official Sign-off */}
        <footer className="hosp-doc-footer">
          <div className="hosp-doc-timestamps">
            <span>Report Created: {report.created_at}</span>
            <span>Last Updated: {report.updated_at}</span>
            {report.submitted_at && <span>Final Sign-off: {report.submitted_at}</span>}
          </div>
          <div className="hosp-doc-signoff-line">
            <div className="hosp-signoff-stamp">
              <span>Digitally Authenticated by Attending Physician</span>
              <strong>{report.doctor_name}</strong>
              <small>{report.hospital_name}</small>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

export default HospitalReportDetailPage;
