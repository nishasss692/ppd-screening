import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import {
  ClinicalInterpretationCard,
  DiscordanceResultCard,
  KeyObservationsCard,
  ModalityComparisonCard,
  RiskByModalityCard,
} from '../components/DiscordanceVisuals.jsx';
import {
  AddClinicalNoteModal,
} from '../components/DiscordanceModals.jsx';
import { analyzeCrossModalDiscordance } from '../utils/discordanceAnalysis.js';

export function DiscordancePage() {
  const {
    mothers,
    screenings,
    selectedMotherId,
    setSelectedMotherId,
    clinicalNotes,
    addClinicalNote,
  } = useClinicalData();

  const { motherId: routeMotherId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [noteOpen, setNoteOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  const queryMotherId = searchParams.get('mother');
  const requestedMotherId = routeMotherId || queryMotherId || null;

  const activeScreening = useMemo(() => {
    if (requestedMotherId) {
      return (
        screenings.find((s) => s.motherId.toLowerCase() === requestedMotherId.toLowerCase()) ||
        null
      );
    }
    if (selectedMotherId) {
      const ctxMatch = screenings.find((s) => s.motherId === selectedMotherId);
      if (ctxMatch) return ctxMatch;
    }
    return screenings.find((s) => s.motherId === 'M-108') || screenings[0] || null;
  }, [screenings, requestedMotherId, selectedMotherId]);

  const activeMother = useMemo(() => {
    if (!activeScreening) return null;
    return mothers.find((m) => m.id === activeScreening.motherId) || null;
  }, [mothers, activeScreening]);

  useEffect(() => {
    if (activeScreening?.motherId && activeScreening.motherId !== selectedMotherId) {
      setSelectedMotherId(activeScreening.motherId);
    }
  }, [activeScreening?.motherId, selectedMotherId, setSelectedMotherId]);

  const analysis = useMemo(
    () => analyzeCrossModalDiscordance({ screening: activeScreening, mother: activeMother }),
    [activeScreening, activeMother]
  );

  const sessionNotes = useMemo(() => {
    if (!activeScreening) return [];
    return clinicalNotes.filter(
      (n) => n.motherId === activeScreening.motherId && n.screeningId === activeScreening.id
    );
  }, [clinicalNotes, activeScreening]);

  const handleSelectMotherSession = (nextMotherId) => {
    setActionFeedback('');
    setSelectedMotherId(nextMotherId);
    if (location.pathname.startsWith('/clinical-review')) {
      navigate(`/clinical-review?mother=${nextMotherId}`);
    } else {
      navigate(`/discordance/${nextMotherId}`);
    }
  };

  const handleSaveNote = (notePayload) => {
    const saved = addClinicalNote(notePayload);
    if (saved) {
      setActionFeedback(
        `Contextual note saved for ${notePayload.motherId} (${notePayload.screeningId}).`
      );
    }
  };

  if (requestedMotherId && !activeScreening) {
    return (
      <div className="miora-command-shell">
        <div className="miora-command-frame">
          <section className="miora-card miora-results-empty-state">
            <h2>Discordance Record Not Found</h2>
            <p>
              No multimodal screening session was found for Mother ID{' '}
              <strong>{requestedMotherId}</strong>.
            </p>
            <div className="miora-modal-actions">
              <button
                type="button"
                className="miora-btn-secondary"
                onClick={() => navigate('/mothers')}
              >
                Open Mothers &amp; Cases
              </button>
              <button
                type="button"
                className="miora-cta-primary"
                onClick={() => navigate('/discordance')}
              >
                View Latest Discordance
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const isCompleted = activeScreening?.status === 'Completed';

  return (
    <div className="miora-command-shell">
      <div className="miora-command-frame">
        {/* Page Header */}
        <section className="miora-dash-header" aria-labelledby="discordance-page-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>DISCORDANCE ANALYSIS</span>
            </div>
            <h1 id="discordance-page-heading" className="miora-dash-title">
              Cross-Modal Discordance
            </h1>
          </div>

          <div className="miora-results-header-actions">
            <button
              type="button"
              className="miora-btn-secondary"
              onClick={() => setNoteOpen(true)}
            >
              <DashboardIcon name="fileText" size={15} />
              <span>Add Note</span>
            </button>
          </div>
        </section>

        {/* Empty State when no screening is available */}
        {!activeScreening && (
          <section className="miora-card" style={{ padding: '48px 24px', textAlign: 'center', marginTop: '16px' }}>
            <DashboardIcon name="layers" size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>No Screening Sessions Available</h3>
            <p style={{ margin: 0, color: 'var(--miora-muted)', fontSize: '14px' }}>
              Complete a screening session in Live Screening or Upload &amp; Analyze to review cross-modal discordance.
            </p>
          </section>
        )}

        {/* Patient Information Strip */}
        {activeScreening && (
          <section
            className="miora-card miora-patient-strip"
            aria-label="Selected patient screening context"
          >
            <div className="miora-patient-item">
              <span className="miora-patient-icon" aria-hidden="true">
                <DashboardIcon name="user" size={18} />
              </span>
              <div className="miora-patient-meta">
                <div className="miora-patient-select-row">
                  <label htmlFor="discordance-session-select" className="sr-only">
                    Select mother for discordance analysis
                  </label>
                  <select
                    id="discordance-session-select"
                    className="miora-patient-id-select"
                    value={activeScreening.motherId}
                    onChange={(e) => handleSelectMotherSession(e.target.value)}
                  >
                    {screenings.map((s) => (
                      <option key={s.id} value={s.motherId}>
                        {s.motherId}
                      </option>
                    ))}
                  </select>
                  <Link
                    to={`/mothers/${activeScreening.motherId}`}
                    className="miora-disc-record-link"
                    onClick={() => setSelectedMotherId(activeScreening.motherId)}
                    title={`Open Mother Record ${activeScreening.motherId}`}
                  >
                    <span>Record</span>
                    <DashboardIcon name="externalLink" size={12} />
                  </Link>
                </div>
                <span className="miora-patient-sub">
                  {activeScreening.motherInitials || activeMother?.initials || '—'}
                </span>
              </div>
            </div>

            <span className="miora-patient-divider" aria-hidden="true" />

            <div className="miora-patient-item">
              <span className="miora-patient-icon is-plain" aria-hidden="true">
                <DashboardIcon name="calendar" size={18} />
              </span>
              <div className="miora-patient-meta">
                <span className="miora-patient-label">Postpartum Week</span>
                <strong>Week {activeScreening.postpartumWeek}</strong>
              </div>
            </div>

            <span className="miora-patient-divider" aria-hidden="true" />

            <div className="miora-patient-item">
              <span className="miora-patient-icon is-plain" aria-hidden="true">
                <DashboardIcon name="layers" size={18} />
              </span>
              <div className="miora-patient-meta">
                <span className="miora-patient-label">Screening Type</span>
                <strong>{activeScreening.modality}</strong>
              </div>
            </div>

            <span className="miora-patient-divider" aria-hidden="true" />

            <div className="miora-patient-item">
              <span className="miora-patient-icon is-plain" aria-hidden="true">
                <DashboardIcon name="clock" size={18} />
              </span>
              <div className="miora-patient-meta">
                <span className="miora-patient-label">Screening Date</span>
                <strong>{activeScreening.screeningDateTime || activeScreening.completedAgo}</strong>
              </div>
            </div>

            <div className="miora-results-status-wrap">
              <span
                className={`miora-results-status-pill ${isCompleted ? 'is-completed' : 'is-pending'
                  }`}
              >
                <DashboardIcon
                  name={isCompleted ? 'checkCircle' : 'clock'}
                  size={15}
                  strokeWidth={1.8}
                />
                <span>
                  {isCompleted ? 'Analysis Completed' : `Analysis ${activeScreening.status}`}
                </span>
              </span>
            </div>
          </section>
        )}

        {/* Row 1: Modality Comparison | Risk by Modality | Discordance Result */}
        {activeScreening && analysis && (
          <div className="miora-results-row-3 miora-disc-row-top">
            <ModalityComparisonCard modalityRows={analysis.modalityRows} />
            <RiskByModalityCard
              modalityRows={analysis.modalityRows}
              highestModalityKey={analysis.highestModality?.key || null}
            />
            <DiscordanceResultCard
              discordance={analysis.discordance}
              overallRisk={analysis.overallRisk}
            />
          </div>
        )}

        {/* Row 2: Key Observations (Important Differences) | Clinical Notes & Interpretation */}
        {activeScreening && analysis && (
          <div className="miora-results-row-2 miora-disc-row-bottom">
            <KeyObservationsCard observations={analysis.observations} />
            <ClinicalInterpretationCard
              interpretation={analysis.interpretation}
              limitations={analysis.limitations}
              sessionNotes={sessionNotes}
              onOpenAddNote={() => setNoteOpen(true)}
            />
          </div>
        )}

        {actionFeedback && (
          <div className="miora-live-feedback-row miora-results-feedback">
            <div className="miora-draft-pill" role="status">
              <DashboardIcon name="check" size={14} />
              <span>{actionFeedback}</span>
            </div>
          </div>
        )}
      </div>

      <AddClinicalNoteModal
        isOpen={noteOpen}
        onClose={() => setNoteOpen(false)}
        screening={activeScreening}
        onSaveNote={handleSaveNote}
      />
    </div>
  );
}
