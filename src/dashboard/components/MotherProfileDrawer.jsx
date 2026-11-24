import React, { useEffect, useState } from 'react';
import { DashboardIcon } from './DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from './Badges.jsx';

export function MotherProfileDrawer({
  mother,
  relatedScreenings,
  onClose,
  onUpdateStatus,
  onOpenResults,
  onStartScreening,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  if (!mother) return null;

  const displayId =
    mother.id.length > 15
      ? `${mother.id.slice(0, 8)}...${mother.id.slice(-5)}`
      : mother.id;

  const handleCopyId = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(mother.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Meaningful Voice & Video filter (remove generic sync noise)
  const isGenericSyncCue =
    !mother.voiceCueSummary ||
    mother.voiceCueSummary.toLowerCase().includes('synchronized from postgresql') ||
    mother.voiceCueSummary.toLowerCase().includes('backend synchronization');

  const voiceObservation = isGenericSyncCue
    ? 'Acoustic and conversational telemetry recorded. Available in full screening review.'
    : mother.voiceCueSummary;

  const epdsInterpretation =
    mother.epdsScore >= 13
      ? 'Elevated symptoms category (Clinical assessment recommended)'
      : mother.epdsScore >= 10
        ? 'Moderate distress range (Follow-up check-in recommended)'
        : 'Low distress range';

  return (
    <div className="miora-profile-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="miora-profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Mother profile ${mother.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* A. Patient Header */}
        <div className="miora-profile-drawer-head">
          <div className="miora-profile-identity">
            <span className="miora-initials-avatar miora-initials-avatar-lg" aria-hidden="true">
              {mother.avatarInitials}
            </span>
            <div className="miora-profile-id-group">
              <div className="miora-profile-id-row">
                <span className="miora-case-id-tag" title={mother.id}>
                  {displayId} · {mother.initials}
                </span>
                <button
                  type="button"
                  className="miora-copy-id-btn"
                  onClick={handleCopyId}
                  title="Copy full Mother ID"
                  aria-label="Copy full Mother ID"
                >
                  <DashboardIcon name={copied ? 'check' : 'clipboardList'} size={13} />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <h3 className="miora-profile-name">{mother.name}</h3>
              <p className="miora-profile-timeline">
                Week {mother.postpartumWeek} Postpartum · Last screening {mother.lastScreeningDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="dash-icon-btn miora-drawer-close-btn"
            aria-label="Close mother profile"
            onClick={onClose}
          >
            <DashboardIcon name="close" size={18} />
          </button>
        </div>

        {/* B. Clinical Overview Cards */}
        <div className="miora-detail-grid">
          <div className="miora-detail-block">
            <span className="miora-detail-block-label">Case Status</span>
            <div className="miora-status-select-row">
              <StatusBadge status={mother.status} showDot={false} />
              <select
                aria-label={`Update status for ${mother.id}`}
                value={mother.status}
                onChange={(e) => onUpdateStatus(mother.id, e.target.value)}
                className="miora-case-status-select"
              >
                <option value="Active">Active</option>
                <option value="Review">Review</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="miora-detail-block">
            <span className="miora-detail-block-label">Latest Screening Risk</span>
            <div className="miora-risk-row">
              <RiskBadge risk={mother.risk} showDot />
            </div>
          </div>

          <div className="miora-detail-block">
            <span className="miora-detail-block-label">EPDS Equivalent</span>
            <strong className="miora-epds-score-highlight">{mother.epdsScore} / 30</strong>
          </div>
        </div>

        {/* C. Screening Summary Sections */}
        <div className="miora-drawer-sections-wrap">
          {/* Section: Validated EPDS Screening */}
          <div className="miora-clinical-subcard">
            <div className="miora-subcard-head">
              <DashboardIcon name="fileText" size={15} />
              <h4>Validated EPDS Screening</h4>
              <span className="miora-subcard-pill">Standardized</span>
            </div>
            <div className="miora-subcard-body">
              <div className="miora-epds-summary-row">
                <span className="miora-epds-score-badge">{mother.epdsScore} / 30</span>
                <span className="miora-epds-interp">{epdsInterpretation}</span>
              </div>
              <p className="miora-subcard-meta">
                Screened: {mother.lastScreeningDate} · Completed 10-item clinical questionnaire
              </p>
            </div>
          </div>

          {/* Section: AI & Multimodal Analysis */}
          <div className="miora-clinical-subcard">
            <div className="miora-subcard-head">
              <DashboardIcon name="video" size={15} />
              <h4>AI Multimodal Telemetry</h4>
              <span className="miora-subcard-pill">
                {mother.discordanceFlag ? 'Discrepancy Noted' : 'Telemetry Recorded'}
              </span>
            </div>
            <div className="miora-subcard-body">
              <p className="miora-subcard-text">
                {mother.discordanceFlag
                  ? `Clinical model noted potential divergence: ${mother.discordanceType || 'Cross-modal discrepancy'}. Review alongside EPDS score.`
                  : 'Multimodal acoustic, facial, and linguistic telemetry captured for longitudinal clinical reference.'}
              </p>
            </div>
          </div>

          {/* Section: Voice & Video Findings */}
          <div className="miora-clinical-subcard">
            <div className="miora-subcard-head">
              <DashboardIcon name="waveform" size={15} />
              <h4>Voice &amp; Prosody Telemetry</h4>
            </div>
            <div className="miora-subcard-body">
              <p className="miora-subcard-text">{voiceObservation}</p>
            </div>
          </div>

          {/* Section: Text Reflection */}
          <div className="miora-clinical-subcard">
            <div className="miora-subcard-head">
              <DashboardIcon name="messageCircle" size={15} />
              <h4>Recorded Patient Reflection</h4>
            </div>
            <div className="miora-subcard-body">
              <p className="miora-subcard-text">
                {mother.textCueSummary && mother.textCueSummary !== 'Recorded in patient registry.'
                  ? `“${mother.textCueSummary}”`
                  : 'No self-reported text reflection provided during session.'}
              </p>
            </div>
          </div>

          {/* Section D: Reason for Monitoring */}
          <div className="miora-clinical-subcard">
            <div className="miora-subcard-head">
              <DashboardIcon name="clipboardList" size={15} />
              <h4>Reason for Monitoring</h4>
            </div>
            <div className="miora-subcard-body">
              <p className="miora-subcard-text">
                {mother.reasonForReview || 'Standard maternal intake and postpartum follow-up.'}
              </p>
            </div>
          </div>

          {/* Section E: Recommended Care Pathway */}
          <div className="miora-clinical-subcard is-pathway">
            <div className="miora-subcard-head">
              <DashboardIcon name="stethoscope" size={15} />
              <h4>Recommended Care Pathway</h4>
            </div>
            <div className="miora-subcard-body">
              <p className="miora-subcard-text">
                {mother.carePlan || 'Continue scheduled postpartum wellness tracking and clinical monitoring.'}
              </p>
            </div>
          </div>
        </div>

        {/* Related Screening Sessions */}
        {relatedScreenings.length > 0 && (
          <div className="miora-related-cases">
            <h4>Related Screening Cases</h4>
            <div className="miora-recent-list">
              {relatedScreenings.map((scr) => (
                <button
                  key={scr.id}
                  type="button"
                  className="miora-recent-item"
                  onClick={() => onOpenResults(mother.id)}
                >
                  <div className="miora-recent-left">
                    <span className="miora-recent-id">{scr.id}</span>
                    <span className="miora-recent-meta">
                      {scr.modality} · {scr.completedAgo}
                    </span>
                  </div>
                  <div className="miora-recent-right">
                    <RiskBadge risk={scr.risk} />
                    <DashboardIcon name="chevronRight" size={16} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* F. Action Buttons */}
        <div className="miora-detail-footer">
          <button
            type="button"
            className="miora-btn-secondary"
            onClick={() => onOpenResults(mother.id)}
          >
            View Screening Results
          </button>
          <button
            type="button"
            className="miora-cta-primary"
            onClick={() => onStartScreening(mother.id)}
          >
            Run New Screening
          </button>
        </div>
      </aside>
    </div>
  );
}

