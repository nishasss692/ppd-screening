import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './reports.css';

export function PatientReportsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const {
    patient,
    screening,
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

  useEffect(() => {
    let mounted = true;
    async function fetchReports() {
      try {
        const token = localStorage.getItem('aanchal_token') || localStorage.getItem('miora_token') || '';
        const res = await fetch('/api/patients/me/consultation-reports', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data) && data.length > 0) {
            setPatientReports(data);
            return;
          }
        }
      } catch {
        // Fallback to initial seed
      }
      if (mounted) {
        setPatientReports([]);
      }
    }
    fetchReports();
    return () => { mounted = false; };
  }, []);

  // Filter downloadable reports: preserve Screening Report PDF & Conversation Transcript, exclude raw recordings per Change 6
  const downloadableReports = useMemo(() => {
    const list = screening?.reports && screening.reports.length > 0
      ? screening.reports
      : [
          { id: 'rep-pdf', title: 'Screening Report', filename: 'Miora_Screening_Report_17Nov2026.pdf', size: '2.4 MB', type: 'pdf', authorized: true, format: '.pdf' },
          { id: 'rep-txt', title: 'Conversation Transcript', filename: 'Miora_Conversation_Transcript_17Nov2026.txt', size: '24 KB', type: 'txt', authorized: true, format: '.txt' },
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'bar-chart' },
    { id: 'screening', label: 'Screening Reports', icon: 'clipboard' },
    { id: 'consultations', label: 'Consultation Reports', icon: 'file-text' },
    { id: 'mood', label: 'Mood Tracking', icon: 'trending-up' },
    { id: 'all-reports', label: 'All Reports', icon: 'file-text' },
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

      {/* Hero Header Banner with Mother & Baby Illustration */}
      <div className="patient-card reports-hero-card">
        <div className="reports-hero-text">
          <div className="miora-dash-eyebrow">
            <span>REPORTS &amp; ANALYTICS</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="miora-dash-title patient-page-heading reports-title">
            My Reports &amp; <em>Analytics</em>
          </h1>
          <p className="miora-dash-subtitle patient-page-subheading reports-subtitle">
            Track your screenings, clinical evaluations, and emotional well-being trajectory over time.
          </p>
        </div>

        <div className="reports-hero-illu-wrap" aria-hidden="true">
          <img
            src="/assets/mother-baby-header-crop.png"
            alt=""
            className="reports-hero-illustration"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
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

        <button
          type="button"
          className="reports-empty-state-toggle-btn"
          onClick={() => setIsEmptyStateDemo((prev) => !prev)}
        >
          {isEmptyStateDemo ? 'Show Demo Data' : 'Simulate Empty State'}
        </button>
      </nav>

      {/* Tab 1: Overview Dashboard */}
      {activeTab === 'overview' && (
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
                      <strong>Virtual Check-in with Dr. Elena Rostova</strong>
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

      {/* Tab 2: Screening Reports View */}
      {activeTab === 'screening' && (
        <div className="reports-tab-view">
          <div className="patient-card reports-tab-card">
            <h2 className="reports-tab-heading">Detailed AI Screening Assessment</h2>
            <p className="reports-tab-sub">
              Full multimodal screening report conducted on 17 Nov 2026 with Dr. Elena Rostova's maternal care unit.
            </p>

            <div className="screening-tab-details-grid">
              <div className="detail-stat-box">
                <span className="detail-stat-label">Edinburgh PPD Score</span>
                <span className="detail-stat-val">
                  {screening?.totalScore !== undefined
                    ? `${screening.totalScore} / 30`
                    : screening?.epdsResult?.total_score !== undefined
                    ? `${screening.epdsResult.total_score} / ${screening.epdsResult.maximum_score || 30}`
                    : '14 / 30'}
                </span>
                <span className="detail-stat-sub">
                  {screening?.riskLabel || 'Moderate Risk Category'}
                </span>
              </div>
              <div className="detail-stat-box">
                <span className="detail-stat-label">Session Duration</span>
                <span className="detail-stat-val">04:12</span>
                <span className="detail-stat-sub">Acoustic &amp; Conversational</span>
              </div>
              <div className="detail-stat-box">
                <span className="detail-stat-label">Consent &amp; Privacy</span>
                <span className="detail-stat-val">Verified</span>
                <span className="detail-stat-sub">Encrypted Storage</span>
              </div>
            </div>

            <div className="reports-tab-action-row">
              <button
                type="button"
                className="patient-btn-primary"
                onClick={() => downloadReport({ title: 'Full Screening Report', filename: `Miora_Screening_${screening?.date ? screening.date.replace(/\s+/g, '_') : 'Report'}.pdf`, type: 'pdf', authorized: true })}
              >
                <PatientIcon name="download" size={14} />
                <span>Download Official PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Consultation Reports View */}
      {activeTab === 'consultations' && (
        <div className="reports-tab-view">
          <div className="patient-card reports-tab-card">
            <div className="tab-card-header-row">
              <div>
                <h2 className="reports-tab-heading">Consultation Reports</h2>
                <p className="reports-tab-sub">
                  Simplified, doctor-approved summaries of your consultations, medication instructions, and care guidance.
                </p>
              </div>

              <button
                type="button"
                className="patient-btn-primary"
                onClick={() => navigate('/patient/find-doctor')}
              >
                <PatientIcon name="calendar" size={14} />
                <span>Book Consultation</span>
              </button>
            </div>

            {/* List of Simplified Consultation Reports */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {patientReports.length === 0 ? (
                <p style={{ color: '#7a6870', fontStyle: 'italic', padding: '16px 0' }}>
                  No consultation reports have been published yet. Once you complete a consultation with your doctor, your simplified report will appear here.
                </p>
              ) : (
                patientReports.map((r) => (
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
                          onClick={() => window.print()}
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          title="Print / Save PDF"
                          aria-label={`Print or download report ${r.report_code}`}
                        >
                          <PatientIcon name="download" size={13} />
                          <span>PDF</span>
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

            {/* Existing Doctor Consultations / Appointments strip */}
            <div style={{ marginTop: '28px', borderTop: '1px solid #f0e1d8', paddingTop: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#2b2326', marginBottom: '12px' }}>
                Your Scheduled &amp; Past Appointments
              </h3>
              <div className="consultations-tab-list">
                {(consultations || []).map((c) => (
                  <div key={c.id} className="consultation-tab-row">
                    <div className="consultation-row-details">
                      <div className="consultation-row-top">
                        <strong>{c.doctorName} &bull; {c.role}</strong>
                        <span className={`connect-status-badge ${c.status === 'Scheduled' ? 'status-scheduled' : 'status-completed'}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="consultation-row-meta">
                        {c.clinic} &bull; {c.date} at {c.time} ({c.type})
                      </p>
                    </div>
                    <button
                      type="button"
                      className="patient-btn-secondary"
                      onClick={() => navigate('/patient/connect-doctor')}
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
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

      {/* Tab 4: Mood Tracking View */}
      {activeTab === 'mood' && (
        <div className="reports-tab-view">
          <div className="patient-card reports-tab-card">
            <h2 className="reports-tab-heading">Mood &amp; Emotional State Tracking</h2>
            <p className="reports-tab-sub">
              Weekly progress records across conversational checkpoints and self-checkins.
            </p>

            <div className="mood-progress-table-wrap">
              <table className="mood-progress-table">
                <thead>
                  <tr>
                    <th>Check-in Period</th>
                    <th>Emotional Score</th>
                    <th>Clinical Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((d) => (
                    <tr key={d.week}>
                      <td>{d.week}</td>
                      <td><strong>{d.score}%</strong></td>
                      <td>
                        <span className={`connect-status-badge ${d.score > 60 ? 'status-scheduled' : 'status-completed'}`}>
                          {d.score > 60 ? 'Moderate Alert' : 'Mild Strain'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: All Reports Archive */}
      {activeTab === 'all-reports' && (
        <div className="reports-tab-view">
          <div className="patient-card reports-tab-card">
            <h2 className="reports-tab-heading">Authorized Clinical Records Archive</h2>
            <p className="reports-tab-sub">
              Secure archive of all official reports and health summaries for {patient?.name || 'Amara'}.
            </p>

            <div className="reports-download-items-list">
              {downloadableReports.map((rep) => (
                <div key={rep.id} className="reports-download-row">
                  <div className="download-row-info">
                    <strong className="download-row-title">{rep.title}</strong>
                    <span className="download-row-sub">{rep.filename} &bull; {rep.size} &bull; Confidential (Patient Authorized)</span>
                  </div>

                  <button
                    type="button"
                    className="patient-btn-secondary download-action-btn"
                    onClick={() => downloadReport(rep)}
                  >
                    <PatientIcon name="download" size={13} />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
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
