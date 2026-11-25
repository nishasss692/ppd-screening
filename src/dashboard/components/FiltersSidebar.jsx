import React, { useState } from 'react';
import { DashboardIcon } from './DashboardIcon.jsx';

const CLINICAL_RISK_OPTIONS = [
  { value: 'Low', pillClass: 'filter-pill-low' },
  { value: 'Moderate', pillClass: 'filter-pill-moderate' },
  { value: 'High', pillClass: 'filter-pill-high' },
];

const STATUS_OPTIONS = ['Active', 'Follow-up', 'Pending', 'Completed'];

export function FiltersSidebar({
  selectedRisks,
  onToggleRisk,
  weekRange,
  onWeekRangeChange,
  selectedStatuses,
  onToggleStatus,
  onClearFilters,
  activeFilterCount,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [minWeek, maxWeek] = weekRange;

  const minPercent = (minWeek / 24) * 100;
  const maxPercent = (maxWeek / 24) * 100;

  const handleMinChange = (e) => {
    const nextMin = Math.min(Number(e.target.value), maxWeek);
    onWeekRangeChange([nextMin, maxWeek]);
  };

  const handleMaxChange = (e) => {
    const nextMax = Math.max(Number(e.target.value), minWeek);
    onWeekRangeChange([minWeek, nextMax]);
  };

  const isReviewSelected = selectedRisks.includes('Requires Review') || selectedStatuses.includes('Review');

  const handleToggleReviewStatus = () => {
    onToggleRisk('Requires Review');
  };

  const panelContent = (
    <div className="miora-filters-inner">
      <div className="miora-filters-header">
        <span className="miora-card-icon" aria-hidden="true">
          <DashboardIcon name="filter" size={17} strokeWidth={1.8} />
        </span>
        <h2 className="miora-filters-title">Filters</h2>
        <button
          type="button"
          className="miora-filters-mobile-close"
          aria-label="Close filters"
          onClick={() => setDropdownOpen(false)}
        >
          <DashboardIcon name="close" size={18} />
        </button>
      </div>

      {/* Clinical Risk Level */}
      <fieldset className="miora-filter-group">
        <legend className="miora-filter-legend">Clinical Risk Level</legend>
        <div className="miora-filter-checks">
          {CLINICAL_RISK_OPTIONS.map((opt) => {
            const checked = selectedRisks.includes(opt.value);
            return (
              <label key={opt.value} className="miora-filter-check-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleRisk(opt.value)}
                />
                <span className={`miora-filter-risk-chip ${opt.pillClass}`}>
                  {opt.value}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="miora-filter-divider" aria-hidden="true" />

      {/* Workflow / Review Status (Separated out from Clinical Risk Level) */}
      <fieldset className="miora-filter-group">
        <legend className="miora-filter-legend">Review Status</legend>
        <div className="miora-filter-checks">
          <label className="miora-filter-check-row">
            <input
              type="checkbox"
              checked={isReviewSelected}
              onChange={handleToggleReviewStatus}
            />
            <span className="miora-filter-risk-chip filter-pill-review">
              Requires Review
            </span>
          </label>
        </div>
      </fieldset>

      <div className="miora-filter-divider" aria-hidden="true" />

      {/* Postpartum Week Range */}
      <fieldset className="miora-filter-group">
        <legend className="miora-filter-legend">Postpartum Week</legend>
        <div className="miora-range-slider">
          <div className="miora-range-track" aria-hidden="true">
            <div
              className="miora-range-fill"
              style={{
                left: `${minPercent}%`,
                width: `${Math.max(maxPercent - minPercent, 0)}%`,
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={24}
            value={minWeek}
            onChange={handleMinChange}
            aria-label="Minimum postpartum week"
            className="miora-range-input miora-range-input-min"
          />
          <input
            type="range"
            min={0}
            max={24}
            value={maxWeek}
            onChange={handleMaxChange}
            aria-label="Maximum postpartum week"
            className="miora-range-input miora-range-input-max"
          />
        </div>
        <div className="miora-range-labels">
          <span>Week {minWeek}</span>
          <span className="miora-range-dash" aria-hidden="true">
            –
          </span>
          <span>Week {maxWeek}</span>
        </div>
      </fieldset>

      <div className="miora-filter-divider" aria-hidden="true" />

      {/* Case Status */}
      <fieldset className="miora-filter-group">
        <legend className="miora-filter-legend">Case Status</legend>
        <div className="miora-filter-checks">
          {STATUS_OPTIONS.map((status) => {
            const checked = selectedStatuses.includes(status);
            return (
              <label key={status} className="miora-filter-check-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleStatus(status)}
                />
                <span className="miora-filter-status-text">{status}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="miora-filter-divider" aria-hidden="true" />

      <button
        type="button"
        className="miora-clear-filters-btn"
        onClick={onClearFilters}
      >
        <DashboardIcon name="refresh" size={14} strokeWidth={1.9} />
        <span>Clear Filters</span>
      </button>
    </div>
  );

  return (
    <div className="miora-filters-dropdown-wrap">
      <div className="miora-filters-dropdown-bar">
        <button
          type="button"
          className={`miora-btn-secondary miora-filters-dropdown-trigger ${dropdownOpen ? 'is-open' : ''}`}
          aria-expanded={dropdownOpen}
          aria-controls="mothers-filters-dropdown-panel"
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          <DashboardIcon name="filter" size={15} strokeWidth={1.85} />
          <span>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </span>
          <DashboardIcon name={dropdownOpen ? 'chevronUp' : 'chevronDown'} size={14} strokeWidth={2} />
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="miora-clear-filters-btn"
            style={{ width: 'auto', padding: '7px 12px' }}
            onClick={onClearFilters}
          >
            <DashboardIcon name="refresh" size={13} strokeWidth={1.9} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {dropdownOpen && (
        <div
          id="mothers-filters-dropdown-panel"
          className="miora-card miora-filters-dropdown-panel"
          role="region"
          aria-label="Registry filters"
        >
          {panelContent}
        </div>
      )}
    </div>
  );
}

