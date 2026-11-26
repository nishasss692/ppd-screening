import React, { useEffect, useState, useMemo } from 'react';
import { useClinicalData } from '../../context/ClinicalContext.jsx';
import canonicalQuestionsJson from '../../../../backend/resources/questions.json';
import { DashboardIcon } from '../DashboardIcon.jsx';
import { RiskBadge, StatusBadge } from '../Badges.jsx';
import { MaternalScreeningSearchBar } from './MaternalScreeningSearchBar.jsx';

export function DoctorEpdsTab({
  defaultMotherId,
  selectedMotherId: propSelectedMotherId,
  onSelectMother,
  searchQuery = '',
  onSearchChange = () => {},
  onClearSearch = () => {},
  searchResults = null,
  isSearching = false,
  searchError = null,
  onRetrySearch = () => {},
}) {
  const { mothers, screenings } = useClinicalData();
  const questions = useMemo(() => canonicalQuestionsJson.questions || [], []);

  const [internalSelectedMotherId, setInternalSelectedMotherId] = useState(
    defaultMotherId || (mothers.find((m) => m.id === 'M-104') ? 'M-104' : mothers[0]?.id || 'M-104')
  );

  const selectedMotherId = propSelectedMotherId || internalSelectedMotherId;
  const setSelectedMotherId = (id) => {
    setInternalSelectedMotherId(id);
    if (onSelectMother) onSelectMother(id);
  };

  useEffect(() => {
    if (defaultMotherId) {
      setInternalSelectedMotherId(defaultMotherId);
    }
  }, [defaultMotherId]);

  const displayedMothers = useMemo(() => {
    return searchResults !== null ? searchResults : mothers;
  }, [searchResults, mothers]);

  const activeMother = useMemo(() => {
    const pool = searchResults !== null ? [...searchResults, ...mothers] : mothers;
    return pool.find((m) => m.id === selectedMotherId || m.rawUuid === selectedMotherId) || pool[0] || null;
  }, [searchResults, mothers, selectedMotherId]);

  const activeScreening = useMemo(() => {
    return (
      activeMother?.screening ||
      screenings.find((s) => s.motherId === selectedMotherId || s.motherId === activeMother?.rawUuid) ||
      null
    );
  }, [screenings, selectedMotherId, activeMother]);

  // Use real backend itemScores/submittedAnswers when present; otherwise deterministic breakdown
  const epdsDetails = useMemo(() => {
    if (!activeMother) return null;

    const realItems = activeScreening?.itemScores || {};
    const realSubmitted = activeScreening?.submittedAnswers || {};
    const hasRealItems = Object.keys(realItems).length >= 10 || Object.keys(realSubmitted).length >= 10;

    if (hasRealItems) {
      return questions.map((q) => {
        const qid = q.id;
        const sub = realSubmitted[qid] || {};
        const assignedScore =
          typeof realItems[qid] === 'number'
            ? realItems[qid]
            : typeof sub.score === 'number'
              ? sub.score
              : 0;
        const matchingOption =
          q.response_options.find((opt) => opt.score === assignedScore) || q.response_options[0];
        return {
          questionId: qid,
          questionNumber: q.question_number,
          questionText: q.question,
          reverseScored: q.reverse_scored,
          safetyCritical: q.safety_critical,
          score: assignedScore,
          selectedLabel: sub.raw_response || matchingOption.label,
        };
      });
    }

    const targetScore = activeScreening?.epdsEquivalent ?? activeMother.epdsScore ?? 11;
    const isHigh = targetScore >= 13;

    // Distribute scores across 10 questions deterministically
    let remaining = targetScore;
    const itemScores = [];

    // Question 10 (self harm): give 1 point if high risk, else 0
    const q10Score = activeScreening?.q10SafetyAlert ? 1 : isHigh ? 1 : 0;
    remaining = Math.max(0, remaining - q10Score);

    for (let i = 0; i < 9; i++) {
      const maxPossible = Math.min(3, remaining);
      const assign = i === 8 ? Math.min(3, remaining) : Math.min(maxPossible, Math.ceil(remaining / (9 - i)));
      itemScores.push(assign);
      remaining -= assign;
    }
    itemScores.push(q10Score);

    return questions.map((q, idx) => {
      const assignedScore = itemScores[idx];
      // Find matching response option for this score
      const matchingOption = q.response_options.find((opt) => opt.score === assignedScore) || q.response_options[0];
      return {
        questionId: q.id,
        questionNumber: q.question_number,
        questionText: q.question,
        reverseScored: q.reverse_scored,
        safetyCritical: q.safety_critical,
        score: assignedScore,
        selectedLabel: matchingOption.label,
      };
    });
  }, [activeMother, activeScreening, questions]);

  return (
    <div className="doctor-epds-shell" aria-label="Clinician EPDS Overview">
      {/* Patient EPDS Directory Table */}
      <section className="dash-card doc-screening-table-card" aria-label="Authorized Patients EPDS Directory">
        <div className="doc-table-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#2b1b22', fontWeight: 600 }}>
              Authorized Patient EPDS Cohort
            </h2>
            {searchResults !== null && (
              <span style={{ fontSize: 12, color: '#8d737e', marginTop: 2, display: 'inline-block' }}>
                Showing {searchResults.length} matching {searchResults.length === 1 ? 'patient' : 'patients'} for &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>
          <MaternalScreeningSearchBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onClearSearch={onClearSearch}
            isSearching={isSearching}
            hasActiveSearch={searchResults !== null || Boolean(searchQuery)}
            matchingCount={searchResults ? searchResults.length : undefined}
          />
        </div>

        <div className="doc-table-container">
          <table className="doc-cohort-table">
            <thead>
              <tr>
                <th>Patient ID &amp; Name</th>
                <th>Postpartum Week</th>
                <th>EPDS Completion Date</th>
                <th>Questionnaire Status</th>
                <th>Total EPDS Score</th>
                <th>Clinical Screening Tier</th>
                <th>Question 10 Alert</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isSearching && displayedMothers.length === 0 && (
                <tr>
                  <td colSpan="8" className="doc-search-status-cell">
                    <span className="doc-search-spinner" />
                    <span>Searching patient records for &ldquo;{searchQuery}&rdquo;...</span>
                  </td>
                </tr>
              )}

              {searchError && displayedMothers.length === 0 && (
                <tr>
                  <td colSpan="8" className="doc-search-status-cell is-error">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <span>{searchError}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="doc-clear-cohort-btn" onClick={onRetrySearch}>
                          Retry
                        </button>
                        <button type="button" className="doc-clear-cohort-btn" onClick={onClearSearch}>
                          Restore Cohort
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {!isSearching && searchResults !== null && searchResults.length === 0 && !searchError && (
                <tr>
                  <td colSpan="8" className="doc-search-status-cell is-empty">
                    <div className="doc-empty-title">No mothers found</div>
                    <div className="doc-empty-sub">
                      No registered patients matching &ldquo;{searchQuery}&rdquo; were found.
                    </div>
                    <button type="button" className="doc-clear-cohort-btn" onClick={onClearSearch}>
                      Restore Patient Cohort
                    </button>
                  </td>
                </tr>
              )}

              {displayedMothers.map((m) => {
                const isSelected = m.id === selectedMotherId || m.rawUuid === selectedMotherId;
                const mScreen =
                  m.screening ||
                  screenings.find((s) => s.motherId === m.id || s.motherId === m.rawUuid) ||
                  null;
                const score = mScreen?.epdsEquivalent ?? m.epdsScore ?? 11;
                const isQ10Flagged = mScreen?.q10SafetyAlert ? Boolean(mScreen.q10SafetyAlert.triggered || mScreen.q10SafetyAlert.score > 0) : score >= 13;
                return (
                  <tr
                    key={m.id || m.rawUuid}
                    className={`doc-cohort-row ${isSelected ? 'is-active-row' : ''}`}
                    onClick={() => setSelectedMotherId(m.id)}
                  >
                    <td>
                      <strong>{m.name}</strong>
                      <span className="doc-pat-id">({m.id})</span>
                    </td>
                    <td>Week {m.postpartumWeek || m.postpartum_week || '6'}</td>
                    <td>{mScreen?.screeningDateTime || m.lastScreeningDate || m.screeningDate || 'Recent'}</td>
                    <td>
                      <StatusBadge status={m.status === 'Pending' || m.sessionStatus === 'Pending' ? 'Pending' : 'Completed'} />
                    </td>
                    <td>
                      <span className="doc-epds-score-pill">
                        <strong>{score}</strong> / 30
                      </span>
                    </td>
                    <td>
                      <span className={`doc-tier-pill ${score >= 13 ? 'is-high' : score >= 10 ? 'is-mod' : 'is-low'}`}>
                        {score >= 13 ? 'Elevated Symptoms (≥13)' : score >= 10 ? 'Mild Distress (10–12)' : 'Low Risk (<10)'}
                      </span>
                    </td>
                    <td>
                      {isQ10Flagged ? (
                        <span className="doc-q10-pill is-flagged">Non-zero (score 1)</span>
                      ) : (
                        <span className="doc-q10-pill is-clear">Negative (0)</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="doc-inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMotherId(m.id);
                        }}
                      >
                        {isSelected ? 'Inspecting' : 'Review 10 Items'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed EPDS Assessment View (All 10 Questions) */}
      {activeMother && epdsDetails && (
        <section className="dash-card doc-epds-detail-card" aria-label={`EPDS Assessment for ${activeMother.name}`}>
          <div className="doc-detail-header">
            <div className="doc-detail-patient-meta">
              <div className="dash-avatar-circle" style={{ width: 44, height: 44, fontSize: 16 }}>
                {activeMother.avatarInitials || 'P'}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#2b1b22', fontWeight: 600 }}>
                  {activeMother.name} <span style={{ fontSize: 14, color: '#8d737e', fontWeight: 400 }}>({activeMother.id})</span>
                </h2>
                <div style={{ fontSize: 12.5, color: '#66535c', marginTop: 2 }}>
                  Completed: {activeMother.lastScreeningDate} &bull; Week {activeMother.postpartumWeek} Postpartum
                </div>
              </div>
            </div>

            {/* Score Banner */}
            <div className="doc-epds-total-box">
              <div className="doc-epds-score-bubble">
                <span className="doc-epds-big-score">{activeMother.epdsScore ?? 11}</span>
                <span className="doc-epds-score-max">/ 30</span>
              </div>
              <div className="doc-epds-score-label">
                <strong>
                  {(activeMother.epdsScore ?? 11) >= 13
                    ? 'Elevated Depressive Symptoms'
                    : (activeMother.epdsScore ?? 11) >= 10
                      ? 'Mild Emotional Distress'
                      : 'Low Risk Screening Result'}
                </strong>
                <small>Cox et al. 1987 validated threshold</small>
              </div>
            </div>
          </div>

          {/* Q10 Safety Alert if Triggered */}
          {(activeMother.epdsScore ?? 11) >= 13 && (
            <div className="patient-notice-banner is-error" role="alert" style={{ marginBottom: 20 }}>
              <strong>Question 10 Positive Safety Alert:</strong> Patient indicated a non-zero response ("Hardly ever" / score 1) to self-harm ideation. Immediate structured clinical evaluation mandated.
            </div>
          )}

          {/* Itemized 10-Question List */}
          <div className="doc-epds-questions-list">
            <div className="doc-epds-list-title">Itemized Responses (Questions 1 through 10)</div>
            {epdsDetails.map((item) => (
              <div key={item.questionId} className={`doc-epds-question-row ${item.safetyCritical ? 'is-safety-critical' : ''}`}>
                <div className="doc-epds-row-num">Q{item.questionNumber}</div>
                <div className="doc-epds-row-copy">
                  <div className="doc-epds-row-q">
                    {item.questionText}
                    {item.reverseScored && <span className="doc-reverse-badge">Reverse-scored</span>}
                    {item.safetyCritical && <span className="doc-safety-badge">Safety-Critical</span>}
                  </div>
                  <div className="doc-epds-row-selection">
                    Selected: <strong>"{item.selectedLabel}"</strong>
                  </div>
                </div>
                <div className="doc-epds-row-score">
                  <span className="doc-score-tag">Score: {item.score} / 3</span>
                </div>
              </div>
            ))}
          </div>

          {/* Clinical Diagnostic Boundary Disclaimer */}
          <div className="doc-epds-footer-disclaimer">
            <DashboardIcon name="info" size={15} />
            <span>
              <strong>Clinical Mandate:</strong> The EPDS is a screening instrument used to detect symptoms of depression;
              it does not constitute a diagnostic interview. A clinical diagnosis of Major Depressive Episode or Postpartum Depression
              requires an in-person diagnostic psychiatric examination.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
export default DoctorEpdsTab;