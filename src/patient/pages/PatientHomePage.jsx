import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { useClinicalData } from '../../dashboard/context/ClinicalContext.jsx';
import { DashboardIcon } from '../../dashboard/components/DashboardIcon.jsx';
import { KpiCard } from '../../dashboard/components/KpiCard.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './patientHome.css';

export function PatientHomePage() {
  const navigate = useNavigate();
  const { patient, screening } = usePatient();
  const clinical = useClinicalData();
  const metrics = clinical?.metrics || {
    registeredMothers: 344,
    screeningsCompleted: 263,
    casesForReview: 33,
    potentialDiscordance: 7,
    trends: {
      registeredMothers: '+5%',
      screeningsCompleted: '+8%',
      casesForReview: '+12%',
      potentialDiscordance: '+3%',
    },
  };

  const patientName = patient?.name || 'Amara';
  const riskScore = screening?.riskScore ?? 64;
  const riskLabel = screening?.riskLabel || screening?.riskLevel || 'Moderate Attention';

  // Gauge calculations for 54px circle (radius 22, circumference ~138.23)
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (riskScore / 100) * circumference;

  return (
    <div className="patient-home-container">
      {/* Dashboard Header matching Clinician Command Center exactly */}
      <section className="miora-dash-header" aria-labelledby="patient-home-heading">
        <div className="miora-dash-header-copy">
          <div className="miora-dash-eyebrow">
            <span>DASHBOARD</span>
            <span className="miora-dash-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 id="patient-home-heading" className="miora-dash-title">
            Welcome back, <em>{patientName}</em>
          </h1>
          <p className="miora-dash-subtitle">
            Your personalized companion for postpartum recovery and emotional intelligence. A real-time overview of maternal wellbeing, screenings and cases requiring attention.
          </p>
        </div>

        <div className="miora-dash-header-actions">
          <button
            type="button"
            className="miora-cta-primary"
            onClick={() => navigate('/patient/screening')}
          >
            <DashboardIcon name="plus" size={16} strokeWidth={2.2} />
            <span>Start Screening</span>
          </button>
        </div>
      </section>

      {/* 4 KPI Cards Grid matching Doctor Dashboard exactly */}
      <section className="miora-kpi-grid" aria-label="Key clinical metrics">
        <KpiCard
          icon="users"
          value={metrics.registeredMothers || 344}
          trend={metrics.trends?.registeredMothers || '+5%'}
          trendTone="positive"
          label="Registered Mothers"
          onClick={() => navigate('/patient/reports')}
        />
        <KpiCard
          icon="mic"
          value={metrics.screeningsCompleted || 263}
          trend={metrics.trends?.screeningsCompleted || '+8%'}
          trendTone="positive"
          label="Screenings Completed"
          onClick={() => navigate('/patient/screening')}
        />
        <KpiCard
          icon="alertTriangle"
          value={metrics.casesForReview || 33}
          trend={metrics.trends?.casesForReview || '+12%'}
          trendTone="attention"
          label="Cases for Review"
          onClick={() => navigate('/patient/reports')}
        />
        <KpiCard
          icon="layers"
          value={metrics.potentialDiscordance || 7}
          trend={metrics.trends?.potentialDiscordance || '+3%'}
          trendTone="positive"
          label="Potential Discordance"
          onClick={() => navigate('/patient/care-suggestions')}
        />
      </section>

      {/* 6-Card Dashboard Grid */}
      <div className="patient-home-grid">
        {/* Card 1: Wellness Index */}
        <div className="patient-home-card">
          <div>
            <div className="patient-home-card-header">
              <div className="patient-home-card-icon-wrap">
                <PatientIcon name="reports" size={18} />
              </div>
              <span className="patient-home-status-tag">Active Index</span>
            </div>

            <h2 className="patient-home-card-title">Postpartum Wellness Index</h2>
            <p className="patient-home-card-desc">
              Multimodal synthesis from your latest screening and clinical indicators.
            </p>

            <div className="patient-home-gauge-row">
              <svg className="patient-home-gauge-svg" viewBox="0 0 54 54">
                <circle
                  cx="27"
                  cy="27"
                  r={radius}
                  fill="none"
                  stroke="#fbeaf0"
                  strokeWidth="5"
                />
                <circle
                  cx="27"
                  cy="27"
                  r={radius}
                  fill="none"
                  stroke="var(--patient-brand-rose)"
                  strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              <div className="patient-home-gauge-info">
                <span className="patient-home-gauge-val">{riskScore}%</span>
                <span className="patient-home-gauge-sub">{riskLabel}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="patient-btn-secondary patient-home-card-btn"
            onClick={() => navigate('/patient/reports')}
          >
            <span>View Full Reports &amp; Analytics</span>
            <PatientIcon name="arrow-right" size={13} />
          </button>
        </div>

        {/* Card 2: AI Screening */}
        <div className="patient-home-card">
          <div>
            <div className="patient-home-card-header">
              <div className="patient-home-card-icon-wrap">
                <PatientIcon name="ai-screening" size={18} />
              </div>
              <span className="patient-home-status-tag">Check-In Due</span>
            </div>

            <h2 className="patient-home-card-title">AI Screening Check-In</h2>
            <p className="patient-home-card-desc">
              A 3-minute confidential multimodal check-in assessing facial sentiment, voice acoustics, and conversational cues.
            </p>

            <div className="patient-home-chips-list">
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Camera &amp; mic live preview</span>
              </div>
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Immediate objective score</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="patient-btn-primary patient-home-card-btn"
            onClick={() => navigate('/patient/screening')}
          >
            <span>Begin Screening Session</span>
            <PatientIcon name="arrow-right" size={13} />
          </button>
        </div>

        {/* Card 3: AI Assistant */}
        <div className="patient-home-card">
          <div>
            <div className="patient-home-card-header">
              <div className="patient-home-card-icon-wrap">
                <PatientIcon name="ai-assistant" size={18} />
              </div>
              <span className="patient-home-status-tag">24/7 Companion</span>
            </div>

            <h2 className="patient-home-card-title">AI Assistant Companion</h2>
            <p className="patient-home-card-desc">
              Non-judgmental, compassionate maternal emotional support anytime you need to reflect or ask questions.
            </p>

            <div className="patient-home-chips-list">
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Voice &amp; speech synthesis</span>
              </div>
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Mood tracking check-ins</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="patient-btn-secondary patient-home-card-btn"
            onClick={() => navigate('/patient/ai-assistant')}
          >
            <span>Open AI Assistant</span>
            <PatientIcon name="arrow-right" size={13} />
          </button>
        </div>

        {/* Card 4: Care Suggestions */}
        <div className="patient-home-card">
          <div>
            <div className="patient-home-card-header">
              <div className="patient-home-card-icon-wrap">
                <PatientIcon name="care-suggestions" size={18} />
              </div>
              <span className="patient-home-status-tag">Restorative Plan</span>
            </div>

            <h2 className="patient-home-card-title">Care Suggestions</h2>
            <p className="patient-home-card-desc">
              Evidence-based restorative practices including 4-7-8 breathing, sleep consolidation, and journaling.
            </p>

            <div className="patient-home-chips-list">
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>4-7-8 Parasympathetic breathing</span>
              </div>
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Postpartum sleep restoration tips</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="patient-btn-secondary patient-home-card-btn"
            onClick={() => navigate('/patient/care-suggestions')}
          >
            <span>Explore Care Practices</span>
            <PatientIcon name="arrow-right" size={13} />
          </button>
        </div>

        {/* Card 5: Medical History */}
        <div className="patient-home-card">
          <div>
            <div className="patient-home-card-header">
              <div className="patient-home-card-icon-wrap">
                <PatientIcon name="medical-history" size={18} />
              </div>
              <span className="patient-home-status-tag">Encrypted</span>
            </div>

            <h2 className="patient-home-card-title">Medical History &amp; Records</h2>
            <p className="patient-home-card-desc">
              Manage your baseline clinical health background, depression history, and uploaded diagnostic files.
            </p>

            <div className="patient-home-chips-list">
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>PPD diagnosis question recorded</span>
              </div>
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>256-bit encrypted documents</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="patient-btn-secondary patient-home-card-btn"
            onClick={() => navigate('/patient/medical-history')}
          >
            <span>Review Medical History</span>
            <PatientIcon name="arrow-right" size={13} />
          </button>
        </div>

        {/* Card 6: Connected Clinician */}
        <div className="patient-home-card">
          <div>
            <div className="patient-home-card-header">
              <div className="patient-home-card-icon-wrap">
                <PatientIcon name="connect-doctor" size={18} />
              </div>
              <span className="patient-home-status-tag">Connected</span>
            </div>

            <h2 className="patient-home-card-title">Connect to a Doctor</h2>
            <p className="patient-home-card-desc">
              Direct consultation channel with your assigned maternal mental health specialist.
            </p>

            <div className="patient-home-chips-list">
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Dr. Elena Rostova &bull; OB/GYN</span>
              </div>
              <div className="patient-home-chip-item">
                <span className="patient-home-chip-dot" />
                <span>Next consult: Nov 24, 2026</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="patient-btn-secondary patient-home-card-btn"
            onClick={() => navigate('/patient/connect-doctor')}
          >
            <span>Book / View Consultations</span>
            <PatientIcon name="arrow-right" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

