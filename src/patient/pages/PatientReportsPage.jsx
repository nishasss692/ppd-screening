import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';
import {
  fetchPatientConsultationReports,
  downloadPatientConsultationReportBlob,
} from '../services/patientApiService.js';
import './reports.css';

export function PatientReportsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const initialTab =
    rawTab === 'appointments'
      ? 'appointments'
      : rawTab === 'consultations'
        ? 'consultations'
        : 'screening';

  const {
    patient,
    screening,
    carePlan,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    consultations,
    downloadReport,
    downloadToast,
  } = usePatient();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isEmptyStateDemo, setIsEmptyStateDemo] = useState(false);
  const [patientReports, setPatientReports] = useState([]);
  const [selectedReportForView, setSelectedReportForView] = useState(null);

  const isDoctorFinalized = Boolean(
    carePlan?.clinicianReview || carePlan?.clinicianPlan || patientReports.length > 0
  );

  useEffect(() => {
    let mounted = true;
    async function fetchReports() {
      try {
        const data = await fetchPatientConsultationReports();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setPatientReports(data);
          return;
        }
      } catch {
        // Fallback to empty
      }
      if (mounted) {
        setPatientReports([]);
      }
    }
    fetchReports();
    return () => { mounted = false; };
  }, []);

  const handleDownloadConsultationReport = async (rep) => {
    try {
      const blob = await downloadPatientConsultationReportBlob(rep.id || rep.report_code);
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AANCHAL_Consultation_${rep.report_code || rep.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      window.print();
    }
  };

  // Filter downloadable reports: preserve Screening Report PDF & Conversation Transcript, exclude raw recordings per Change 6
  const downloadableReports = useMemo(() => {
    const list = screening?.reports && screening.reports.length > 0
      ? screening.reports
      : [
        { id: 'rep-pdf', title: 'Screening Report', filename: 'AANCHAL_Screening_Report_17Nov2026.pdf', size: '2.4 MB', type: 'pdf', authorized: true, format: '.pdf' },
        { id: 'rep-txt', title: 'Conversation Transcript', filename: 'AANCHAL_Conversation_Transcript_17Nov2026.txt', size: '24 KB', type: 'txt', authorized: true, format: '.txt' },
      ];
    return list.filter((rep) => {
      const type = (rep.type || '').toLowerCase();
      const title = (rep.title || '').toLowerCase();
      if (type === 'wav' || type === 'mp4' || type === 'audio' || type === 'video') return false;
      if (title.includes('audio recording') || title.includes('video recording')) return false;
      return true;
    });
  }, [screening?.reports]);

  // Gauge calculations for 64% risk circle (circumference = 2 * PI * r = 2 * PI * 38 = 238.76)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = isEmptyStateDemo || !screening ? 0 : screening.riskScore;
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  // Trend chart points data
  const trendData = (!isEmptyStateDemo && screening?.trend) || [
    { week: 'Week 1', score: 42 },
    { week: 'Week 2', score: 50 },
    { week: 'Week 3', score: 58 },
    { week: 'Week 4', score: 64 },
  ];

  // SVG Chart sizing & mapping:
  const chartWidth = 265;
  const chartHeight = 115;
  const plotLeft = 24;
  const plotRight = 250;
  const plotTop = 10;
  const plotBottom = 92;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const points = trendData.map((d, i) => {
    const x = plotLeft + (i / (trendData.length - 1)) * plotW;
    const y = plotBottom - (d.score / 100) * plotH;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (pt.x - prev.x) / 2;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (pt.x - prev.x) / 2;
    const cpy2 = pt.y;
    return `${acc} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${plotBottom} L ${points[0].x} ${plotBottom} Z`;

  const uniquePatientReports = useMemo(() => {
    const seen = new Set();
    return (patientReports || []).filter((r) => {
      if (!r) return false;
      const key = String(r.report_code || r.id || `${r.doctor_name}-${r.consultation_date}`).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [patientReports]);

  const uniqueAppointments = useMemo(() => {
    const seenIds = new Set();
    const seenKeys = new Set();
    return (consultations || []).filter((appt) => {
      if (!appt) return false;
      const st = String(appt.status || '').toLowerCase();
      // Exclude declined/cancelled; show confirmed and pending confirmation appointments
      if (st.includes('cancel') || st.includes('declin') || st.includes('reject')) return false;
      const idKey = appt.id ? String(appt.id) : '';
      const doc = appt.assigned_doctor_name || appt.requested_doctor_name || appt.doctor_name || appt.doctorName || '';
      const dt = appt.confirmed_date || appt.requested_date || appt.date || '';
      const tm = appt.confirmed_time || appt.requested_time || appt.time || '';
      const sigKey = `${doc}|${dt}|${tm}|${appt.type || appt.mode || ''}`.toLowerCase();
      if ((idKey && seenIds.has(idKey)) || seenKeys.has(sigKey)) return false;
      if (idKey) seenIds.add(idKey);
      seenKeys.add(sigKey);
      return true;
    });
  }, [consultations]);

  const tabs = [
    { id: 'screening', label: 'Screening Reports', icon: 'clipboard' },
    { id: 'consultations', label: 'Clinical Reports', icon: 'file-text' },
    { id: 'appointments', label: 'My Appointments', icon: 'calendar' },
  ];

  return (
    <div className="reports-page-container">
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
        <span className="medhist-breadcrumb-current">My Reports</span>
      </div>

      {/* Hero Header Banner */}
      <div className="patient-card reports-hero-card">
        <div className="reports-hero-text">
          <div className="miora-dash-eyebrow">
            <span>REPORTS &amp; ANALYTICS</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="miora-dash-title patient-page-heading reports-title">
            My Reports &amp; <em>Analytics</em>
          </h1>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="reports-tabs-bar" aria-label="Reports Views">
        <div className="reports-tabs-list" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`reports-tab-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <PatientIcon name={tab.icon} size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Overview removed per user request — keep only Screening Reports & Clinical Reports */}
      {false && activeTab === 'overview' && (
        <div className="reports-overview-grid">
          {/* Top Row: 3 KPI / Summary Cards */}
          <div className="reports-top-cards-row">
            {/* Card 1: Latest Screening Result */}
            <section className="patient-card reports-card reports-screening-card" aria-labelledby="screening-result-title">
              <div className="reports-card-header">
                <span className="reports-card-icon" aria-hidden="true">
                  <PatientIcon name="clipboard" size={17} />
                </span>
                <h2 id="screening-result-title" className="reports-card-title">
                  Latest Screening Result
                </h2>
              </div>

              {isEmptyStateDemo || !screening ? (
                <div className="reports-empty-content">
                  <p>No screening session completed yet.</p>
                  <button
                    type="button"
                    className="patient-btn-primary"
                    onClick={() => navigate('/patient/screening')}
                  >
                    Start AI Screening
                  </button>
                </div>
              ) : (
                <div className="screening-result-content">
                  <div className="screening-gauge-wrap">
                    <svg className="screening-gauge-svg" viewBox="0 0 100 100" width="94" height="94" aria-hidden="true">
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        className="screening-gauge-track"
                        strokeWidth="7"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        className="screening-gauge-fill"
                        strokeWidth="7"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="screening-gauge-text">
                      <span className="screening-gauge-pct">{screening.riskScore}%</span>
                    </div>
                  </div>

                  <div className="screening-result-meta">
                    <div className="screening-status-row">
                      <span className="screening-risk-pill status-moderate">
                        {screening.riskLabel}
                      </span>
                    </div>
                    <p className="screening-date-text">
                      Completed: <strong>{screening.latestDate || screening.completedDateTime || screening.date}</strong>
                    </p>
                    <p className="screening-recom-note">
                      {screening.recommendationText || screening.summary}
                    </p>
                    <button
                      type="button"
                      className="reports-inline-link-btn"
                      onClick={() => setActiveTab('screening')}
                    >
                      <span>View Full Screening Report</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Card 2: Emotional Well-being Trend */}
            <section className="patient-card reports-card reports-trend-card" aria-labelledby="trend-title">
              <div className="reports-card-header">
                <span className="reports-card-icon" aria-hidden="true">
                  <PatientIcon name="trending-up" size={17} />
                </span>
                <h2 id="trend-title" className="reports-card-title">
                  Emotional Well-being Trend
                </h2>
              </div>

              <div className="trend-chart-container">
                <svg
                  className="trend-svg"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  aria-label="Well-being trajectory chart"
                >
                  <defs>
                    <linearGradient id="patientTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ea3a7a" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#ea3a7a" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid guidelines */}
                  <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#f0dfe2" strokeWidth="1" />
                  <line x1={plotLeft} y1={(plotTop + plotBottom) / 2} x2={plotRight} y2={(plotTop + plotBottom) / 2} stroke="#f8ecf0" strokeDasharray="3 3" />
                  <line x1={plotLeft} y1={plotTop} x2={plotRight} y2={plotTop} stroke="#f8ecf0" strokeDasharray="3 3" />

                  {/* Gradient Area Fill */}
                  <path d={areaD} fill="url(#patientTrendGrad)" />

                  {/* Spline Path */}
                  <path d={pathD} fill="none" stroke="#d93c75" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Data Points */}
                  {points.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredPoint === i ? 6 : 4}
                        fill="#ffffff"
                        stroke="#d93c75"
                        strokeWidth="2.5"
                        className="trend-point-dot"
                        onMouseEnter={() => setHoveredPoint(i)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  ))}
                </svg>

                {/* X-Axis labels */}
                <div className="trend-labels-row">
                  {trendData.map((d, i) => (
                    <span key={i} className="trend-x-label">{d.week}</span>
                  ))}
                </div>
              </div>

              <p className="trend-footer-text">
                Observed distress score trending from 42% to 64% across past 4 check-in intervals.
              </p>
            </section>

            {/* Card 3: Download Reports */}
            <section className="patient-card reports-card reports-download-card" aria-labelledby="download-title">
              <div className="reports-card-header">
                <span className="reports-card-icon" aria-hidden="true">
                  <PatientIcon name="file-text" size={17} />
                </span>
                <h2 id="download-title" className="reports-card-title">
                  Download Reports
                </h2>
              </div>

              <div className="reports-download-items-list">
                {downloadableReports.slice(0, 3).map((rep) => (
                  <div key={rep.id} className="reports-download-row">
                    <div className="download-row-info">
                      <strong className="download-row-title">{rep.title}</strong>
                      <span className="download-row-sub">{rep.filename} &bull; {rep.size}</span>
                    </div>

                    <button
                      type="button"
                      className="patient-btn-secondary download-action-btn"
                      onClick={() => downloadReport(rep)}
                      aria-label={`Download ${rep.title}`}
                    >
                      <PatientIcon name="download" size={13} />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Bottom Row: 2 Wider Analytical Cards */}
          <div className="reports-bottom-cards-row">
            {/* Card 4: Key Insights */}
            <section className="patient-card reports-card reports-insights-card" aria-labelledby="insights-title">
              <div className="reports-card-header">
                <span className="reports-card-icon" aria-hidden="true">
                  <PatientIcon name="sparkles" size={17} />
                </span>
                <h2 id="insights-title" className="reports-card-title">
                  Key Insights &amp; Clinical Signals
                </h2>
              </div>

              <div className="reports-insights-list">
                {(Array.isArray(screening?.insights) ? screening.insights : [
                  {
                    id: 'ins-1',
                    title: 'Sleep Disruption Impact',
                    text: 'Fragmented sleep cycles under 4 continuous hours show strong correlation with maternal fatigue and heightened stress markers.',
                    tag: `Sleep: ${screening?.insights?.sleep || 'Disturbed'}`,
                  },
                  {
                    id: 'ins-2',
                    title: 'Acoustic Tone & Vocal Energy',
                    text: 'Conversational acoustic variance indicates mild vocal flatness and energy drop during evening reflections.',
                    tag: `Stress: ${screening?.insights?.stress || 'Elevated'}`,
                  },
                  {
                    id: 'ins-3',
                    title: 'Grounding Responsiveness',
                    text: 'High engagement and heart-rate recovery recorded when practicing 4-7-8 parasympathetic breathing.',
                    tag: `Support: ${screening?.insights?.support || 'Recommended'}`,
                  },
                ]).map((ins) => (
                  <div key={ins.id} className="reports-insight-box">
                    <div className="insight-box-top">
                      <strong className="insight-box-title">{ins.title}</strong>
                      <span className="insight-box-tag">{ins.tag}</span>
                    </div>
                    <p className="insight-box-p">{ins.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Card 5: Assessment Summary & Next Steps */}
            <section className="patient-card reports-card reports-summary-card" aria-labelledby="summary-title">
              <div className="reports-card-header">
                <span className="reports-card-icon" aria-hidden="true">
                  <PatientIcon name="clipboard" size={17} />
                </span>
                <h2 id="summary-title" className="reports-card-title">
                  Assessment Summary &amp; Next Steps
                </h2>
              </div>

              <div className="reports-summary-body">
                <p className="summary-clinical-quote">
                  &ldquo;Overall screening indicators point to moderate postpartum distress consistent with sleep fragmentation and emotional exhaustion. Coordinated follow-up recommended.&rdquo;
                </p>

                <div className="summary-next-steps-list">
                  <div className="summary-step-item">
                    <span className="step-num-circle">1</span>
                    <div>
                      <strong>Review Personalised Care Plan</strong>
                      <p>Implement daily 4-7-8 breathing exercises and sleep hygiene restoration tasks.</p>
                    </div>
                  </div>

                  <div className="summary-step-item">
                    <span className="step-num-circle">2</span>
                    <div>
                      <strong>Virtual Check-in with Dr. Priya Mehta</strong>
                      <p>Next scheduled telehealth consultation on 20 Nov 2026 at 11:00 AM.</p>
                    </div>
                  </div>
                </div>

                <div className="summary-card-actions">
                  <button
                    type="button"
                    className="patient-btn-primary"
                    onClick={() => navigate('/patient/care-suggestions')}
                  >
                    View Care Suggestions
                  </button>
                  <button
                    type="button"
                    className="patient-btn-secondary"
                    onClick={() => navigate('/patient/connect-doctor')}
                  >
                    Consultation Details
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 1: Screening Reports View (only visible after doctor finalization) */}
      {activeTab === 'screening' && (
        <div className="reports-tab-view">
          {!isDoctorFinalized ? (
            <div className="patient-card reports-tab-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <h2 className="reports-tab-heading">Pending Clinician Finalization</h2>
              <p className="reports-tab-sub" style={{ maxWidth: '520px', margin: '8px auto 18px' }}>
                Your screening reports will be visible here once your doctor reviews and finalizes your assessment.
              </p>
              <button
                type="button"
                className="patient-btn-secondary"
                onClick={() => navigate('/patient/screening')}
              >
                <span>Go to Screening</span>
              </button>
            </div>
          ) : (
            <div className="patient-card reports-tab-card">
              <h2 className="reports-tab-heading">Screening Assessment Report</h2>
              <p className="reports-tab-sub">
                Your latest screening assessment recorded on{' '}
                <strong>{screening?.completedDateTime || screening?.date || 'Latest session'}</strong>.
              </p>

              <div className="screening-tab-details-grid">
                <div className="detail-stat-box">
                  <span className="detail-stat-label">Edinburgh PPD Score</span>
                  <span className="detail-stat-val">
                    {screening?.totalScore !== undefined
                      ? `${screening.totalScore} / 30`
                      : screening?.epdsResult?.total_score !== undefined
                        ? `${screening.epdsResult.total_score} / ${screening.epdsResult.maximum_score || 30}`
                        : 'Recorded'}
                  </span>
                  <span className="detail-stat-sub">
                    {screening?.riskLabel || 'Assessed'}
                  </span>
                </div>
                <div className="detail-stat-box">
                  <span className="detail-stat-label">Risk Score</span>
                  <span className="detail-stat-val">
                    {screening?.riskScore !== undefined ? `${screening.riskScore}%` : 'Reviewed'}
                  </span>
                  <span className="detail-stat-sub">Multimodal Screening</span>
                </div>
                <div className="detail-stat-box">
                  <span className="detail-stat-label">Clinician Status</span>
                  <span className="detail-stat-val">Finalized</span>
                  <span className="detail-stat-sub">
                    {carePlan?.clinicianReview?.clinician_name || 'Verified Record'}
                  </span>
                </div>
              </div>

              <div className="reports-tab-action-row">
                <button
                  type="button"
                  className="patient-btn-primary"
                  onClick={() => downloadReport({ title: 'Full Screening Report', filename: `AANCHAL_Screening_${screening?.date ? screening.date.replace(/\s+/g, '_') : 'Report'}.pdf`, type: 'pdf', authorized: true })}
                >
                  <PatientIcon name="download" size={14} />
                  <span>Download Official PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Clinical Reports View */}
      {activeTab === 'consultations' && (
        <div className="reports-tab-view">
          <div className="patient-card reports-tab-card">
            <div className="tab-card-header-row">
              <div>
                <h2 className="reports-tab-heading">Clinical Reports</h2>
                <p className="reports-tab-sub">
                  Doctor-finalized clinical reviews, consultation summaries, medication instructions, and care guidance.
                </p>
              </div>
            </div>

            {/* Doctor-Finalized Clinical Review (from Clinical Review page) */}
            {carePlan?.clinicianReview && (
              <article
                style={{
                  backgroundColor: '#fff9fa',
                  border: '1px solid #f1dede',
                  borderRadius: '10px',
                  padding: '20px',
                  marginTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#ba1e53', background: '#fde7ec', padding: '3px 10px', borderRadius: '999px', display: 'inline-block', marginBottom: '6px' }}>
                      Clinician Review Finalized
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2b2326', margin: 0 }}>
                      Clinical Assessment by {carePlan.clinicianReview.clinician_name}
                    </h3>
                  </div>
                  {carePlan.clinicianReview.final_risk_classification && (
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#ba1e53', background: '#fde7ec', padding: '4px 12px', borderRadius: '999px', textTransform: 'capitalize' }}>
                      {carePlan.clinicianReview.final_risk_classification} Risk
                    </span>
                  )}
                </div>
                {carePlan.clinicianReview.clinical_notes && (
                  <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: '#271218', whiteSpace: 'pre-line' }}>
                    {carePlan.clinicianReview.clinical_notes}
                  </p>
                )}
              </article>
            )}

            {/* List of Simplified Consultation Reports */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {uniquePatientReports.length === 0 && !carePlan?.clinicianReview ? (
                <p style={{ color: '#7a6870', fontStyle: 'italic', padding: '16px 0' }}>
                  No clinical reports have been finalized by your doctor yet. Once your doctor finalizes your clinical review or consultation report, it will appear here.
                </p>
              ) : (
                uniquePatientReports.map((r) => (
                  <article
                    key={r.id}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #f1dede',
                      borderRadius: '10px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#c73566', background: '#fdeaf0', padding: '3px 8px', borderRadius: '10px', display: 'inline-block', marginBottom: '6px' }}>
                          {r.report_code}
                        </span>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#2b2326', margin: 0 }}>
                          Consultation with {r.doctor_name}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#7a6870', margin: '2px 0 0 0' }}>
                          {r.doctor_specialization} &bull; {r.hospital_name} &bull; Visit Date: <strong>{r.consultation_date}</strong>
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="patient-btn-secondary"
                          onClick={() => setSelectedReportForView(r)}
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                          Read Full Summary
                        </button>
                        <button
                          type="button"
                          className="patient-btn-secondary"
                          onClick={() => handleDownloadConsultationReport(r)}
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          title="Download Consultation Summary"
                          aria-label={`Download report ${r.report_code}`}
                        >
                          <PatientIcon name="download" size={13} />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>

                    {/* Summary of What Was Discussed */}
                    <div style={{ backgroundColor: '#fffbf9', borderLeft: '3px solid #f4a6c0', padding: '12px 16px', borderRadius: '0 6px 6px 0', fontSize: '13px', lineHeight: '1.6', color: '#4a3d42' }}>
                      <strong style={{ display: 'block', color: '#2b2326', marginBottom: '4px' }}>
                        Summary of What We Discussed:
                      </strong>
                      <p style={{ margin: 0 }}>{r.summary}</p>
                    </div>

                    {/* Medication Instructions if prescribed */}
                    {r.medications_instructions && (
                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '6px', fontSize: '13px', lineHeight: '1.5' }}>
                        <strong style={{ color: '#166534', display: 'block', marginBottom: '2px' }}>
                          Prescribed Medication Instructions:
                        </strong>
                        <p style={{ margin: 0, color: '#14532d' }}>{r.medications_instructions}</p>
                      </div>
                    )}

                    {/* Follow-up Note */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#7a6870', borderTop: '1px solid #f8eaeb', paddingTop: '10px' }}>
                      <span>
                        Next Follow-up: <strong style={{ color: '#c73566' }}>{r.next_followup_date || 'Scheduled as needed'}</strong>
                      </span>
                      {r.submitted_at && <span>Signed by Doctor: {r.submitted_at}</span>}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          {/* Modal / Detailed view for selected report */}
          {selectedReportForView && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '16px',
              }}
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedReportForView(null)}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  maxWidth: '640px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: '28px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f3e8e2', paddingBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#c73566', background: '#fdeaf0', padding: '3px 8px', borderRadius: '10px' }}>
                      {selectedReportForView.report_code}
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#2b2326', margin: '6px 0 2px 0' }}>
                      Consultation Report &bull; Patient Care Summary
                    </h2>
                    <p style={{ fontSize: '12px', color: '#7a6870', margin: 0 }}>
                      Consultation with {selectedReportForView.doctor_name} on {selectedReportForView.consultation_date}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReportForView(null)}
                    style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#7a6870' }}
                    aria-label="Close report view"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#2b2326', marginBottom: '6px' }}>
                    What We Discussed
                  </h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#4a3d42', backgroundColor: '#fffbf9', padding: '12px 16px', borderRadius: '6px', border: '1px solid #f9ece4' }}>
                    {selectedReportForView.summary}
                  </p>
                </div>

                {selectedReportForView.medications_instructions && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#166534', marginBottom: '6px' }}>
                      Medication Instructions
                    </h4>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#14532d', backgroundColor: '#f0fdf4', padding: '12px 16px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      {selectedReportForView.medications_instructions}
                    </p>
                  </div>
                )}

                {selectedReportForView.recommendations && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#2b2326', marginBottom: '6px' }}>
                      Self-Care &amp; Restorative Guidance
                    </h4>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#4a3d42', backgroundColor: '#fffbf9', padding: '12px 16px', borderRadius: '6px', border: '1px solid #f9ece4' }}>
                      {selectedReportForView.recommendations}
                    </p>
                  </div>
                )}

                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#2b2326', marginBottom: '6px' }}>
                    Follow-Up Instructions
                  </h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#4a3d42', backgroundColor: '#fffbf9', padding: '12px 16px', borderRadius: '6px', border: '1px solid #f9ece4' }}>
                    {selectedReportForView.followup_instructions}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3e8e2', paddingTop: '16px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="patient-btn-secondary"
                    onClick={() => window.print()}
                  >
                    Print or Save as PDF
                  </button>
                  <button
                    type="button"
                    className="patient-btn-primary"
                    onClick={() => setSelectedReportForView(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download Toast Notification */}
      {activeTab === 'appointments' && (
        <div className="reports-consultations-tab">
          <section className="patient-card reports-card" aria-labelledby="my-appointments-tab-title">
            <div className="reports-card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 id="my-appointments-tab-title" className="reports-card-title">
                  My Appointments
                </h2>
                <p className="reports-card-sub">
                  Confirmed consultations and pending appointment requests awaiting hospital or doctor confirmation.
                </p>
              </div>
              <button
                type="button"
                className="patient-btn-primary"
                onClick={() => navigate('/patient/find-doctor')}
              >
                <PatientIcon name="stethoscope" size={15} />
                <span>Find a Doctor &rarr;</span>
              </button>
            </div>

            {uniqueAppointments.length === 0 ? (
              <div className="reports-empty-content" style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--patient-subtle)' }}>
                  No confirmed or pending appointments yet. Use Find a Doctor above to request a consultation.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                {uniqueAppointments.map((appt) => {
                  const statusRaw = String(appt.status || 'pending').toLowerCase();
                  const isConfirmed = ['confirmed', 'scheduled', 'completed'].includes(statusRaw);
                  const statusLabel =
                    statusRaw === 'rescheduled' || statusRaw === 'new time proposed'
                      ? 'New Time Proposed'
                      : statusRaw === 'pending' || statusRaw === 'requested'
                        ? 'Pending Confirmation'
                        : statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
                  const doctorName =
                    appt.assigned_doctor_name ||
                    appt.requested_doctor_name ||
                    appt.doctor_name ||
                    appt.doctorName ||
                    'Assigned Specialist';
                  const hospitalName = appt.hospital_name || appt.hospitalName || appt.location || appt.clinic || '';
                  const dateLabel = appt.confirmed_date || appt.requested_date || appt.date || 'Date TBD';
                  const timeLabel = appt.confirmed_time || appt.requested_time || appt.time || '';
                  const modeLabel = appt.type || appt.mode || 'Consultation';
                  const reasonText = appt.reason || appt.notes || '';

                  return (
                    <div
                      key={appt.id}
                      style={{
                        border: '1px solid #f1d9df',
                        borderRadius: 14,
                        padding: '16px 20px',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: isConfirmed ? '#ecfdf5' : '#fef3c7',
                            color: isConfirmed ? '#047857' : '#92400e',
                            border: `1px solid ${isConfirmed ? '#a7f3d0' : '#fde68a'}`,
                          }}
                        >
                          {statusLabel}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--patient-subtle)', fontWeight: 500 }}>
                          {modeLabel}
                        </span>
                      </div>
                      <strong style={{ fontSize: 16, color: 'var(--patient-ink)' }}>{doctorName}</strong>
                      {hospitalName && (
                        <span style={{ fontSize: 13, color: 'var(--patient-subtle)' }}>{hospitalName}</span>
                      )}
                      <div style={{ fontSize: 13.5, color: 'var(--patient-ink)', marginTop: 2 }}>
                        {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                      </div>
                      {reasonText && (
                        <div style={{ fontSize: 12.5, color: 'var(--patient-subtle)' }}>
                          Reason: {reasonText}
                        </div>
                      )}
                      {(statusRaw === 'rescheduled' || statusRaw === 'new time proposed') && (appt.proposed_date || appt.proposedDate) && (
                        <div style={{ fontSize: 12.5, color: '#9d174d', fontWeight: 600 }}>
                          Proposed Time: {appt.proposed_date || appt.proposedDate}{(appt.proposed_time || appt.proposedTime) ? ` · ${appt.proposed_time || appt.proposedTime}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Download Toast Notification */}
      {downloadToast && (
        <div
          className={`patient-toast ${downloadToast.type === 'success' ? 'is-success' : 'is-error'}`}
          role="status"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{downloadToast.message}</span>
        </div>
      )}
    </div>
  );
}

export default PatientReportsPage;
