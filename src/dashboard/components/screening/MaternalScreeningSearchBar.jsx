import React from 'react';
import { DashboardIcon } from '../DashboardIcon.jsx';

/**
 * MaternalScreeningSearchBar
 * Dedicated search bar for Doctor Portal -> Maternal Screening Review.
 * Allows doctors to search for mothers across all database records by partial,
 * case-insensitive name matching.
 */
export function MaternalScreeningSearchBar({
  searchQuery,
  onSearchChange,
  onClearSearch,
  isSearching,
  hasActiveSearch,
  matchingCount,
}) {
  return (
    <div className="doc-search-box-wrap" role="search" aria-label="Search mothers by name">
      <div className="doc-search-input-group">
        <span className="doc-search-icon" aria-hidden="true">
          {isSearching ? (
            <span className="doc-search-spinner" />
          ) : (
            <DashboardIcon name="search" size={15} />
          )}
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search mother by name"
          aria-label="Search mother by name"
          className="doc-search-name-input"
          autoComplete="off"
          spellCheck="false"
        />
        {searchQuery && (
          <button
            type="button"
            className="doc-search-clear-inline"
            onClick={onClearSearch}
            aria-label="Clear search text"
            title="Clear search text"
          >
            <DashboardIcon name="x" size={14} />
          </button>
        )}
      </div>

      {hasActiveSearch && (
        <button
          type="button"
          className="doc-clear-cohort-btn"
          onClick={onClearSearch}
          aria-label="Restore cohort"
          title="Restore full patient cohort"
        >
          Clear Search
        </button>
      )}
    </div>
  );
}
