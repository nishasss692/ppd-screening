import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClinicalData } from '../context/ClinicalContext.jsx';
import { DashboardIcon } from '../components/DashboardIcon.jsx';
import { DoctorAiScreeningTab } from '../components/screening/DoctorAiScreeningTab.jsx';
import { DoctorEpdsTab } from '../components/screening/DoctorEpdsTab.jsx';
import { DoctorResultsReportsTab } from '../components/screening/DoctorResultsReportsTab.jsx';
import * as doctorApiService from '../services/doctorApiService.js';
import '../components/screening/doctorScreeningStyles.css';

/**
 * Clinician Screening Oversight & Review
 * Displays submitted patient AI Screening, EPDS, and Clinical Reports directly.
 * Includes backend name-based search across all registered patient records in PostgreSQL database.
 */
export function LiveScreeningPage() {
  const { mothers } = useClinicalData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search state across database
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = full cohort; array = search active
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);

  const defaultMotherId = useMemo(() => {
    const paramId = searchParams.get('mother');
    if (paramId && mothers.some((m) => m.id === paramId)) return paramId;
    if (mothers.some((m) => m.id === 'M-108')) return 'M-108';
    return mothers[0]?.id || 'M-104';
  }, [mothers, searchParams]);

  const [selectedMotherId, setSelectedMotherId] = useState(defaultMotherId);

  useEffect(() => {
    if (defaultMotherId && !selectedMotherId) {
      setSelectedMotherId(defaultMotherId);
    }
  }, [defaultMotherId, selectedMotherId]);

  // Execute database search
  const executeSearch = useCallback(async (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      setSearchResults(null);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const data = await doctorApiService.searchMothersByName(trimmed);
      setSearchResults(Array.isArray(data) ? data : []);
      // If matching mothers found and current selection is not in results, select the first match
      if (Array.isArray(data) && data.length > 0) {
        setSelectedMotherId((prevId) => {
          const match = data.find((m) => m.id === prevId || m.rawUuid === prevId);
          return match ? prevId : data[0].id;
        });
      }
    } catch (err) {
      console.error('Database mother search failed:', err);
      // Fallback: search local loaded mothers if backend throws network error
      const lower = trimmed.toLowerCase();
      const localMatches = mothers.filter(
        (m) => (m.name && m.name.toLowerCase().includes(lower)) || (m.id && m.id.toLowerCase().includes(lower))
      );
      if (localMatches.length > 0) {
        setSearchResults(localMatches);
      } else {
        setSearchError(err.message || 'Failed to search patient records');
        setSearchResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, [mothers]);

  const handleSearchChange = useCallback((newQuery) => {
    setSearchQuery(newQuery);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    if (!newQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      setSearchError(null);
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      executeSearch(newQuery);
    }, 250);
  }, [executeSearch]);

  const handleClearSearch = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    setSearchQuery('');
    setSearchResults(null);
    setIsSearching(false);
    setSearchError(null);
    setSelectedMotherId(defaultMotherId);
  }, [defaultMotherId]);

  const handleRetrySearch = useCallback(() => {
    executeSearch(searchQuery);
  }, [executeSearch, searchQuery]);

  const rawTab = searchParams.get('tab');
  const screeningTab =
    rawTab === 'epds'
      ? 'epds'
      : rawTab === 'results' || rawTab === 'reports' || rawTab === 'results-reports'
        ? 'results'
        : 'ai-screening';

  const handleTabChange = (nextTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams);
  };

  const activeMother = useMemo(() => {
    const pool = searchResults !== null ? [...searchResults, ...mothers] : mothers;
    return pool.find((m) => m.id === selectedMotherId || m.rawUuid === selectedMotherId) || pool[0] || null;
  }, [mothers, selectedMotherId, searchResults]);

  return (
    <div className="miora-command-shell">
      <div className="miora-command-frame">
        {/* Page Header (Clinician Review Mode — No Live Recording Controls or Session Timers) */}
        <section className="miora-dash-header" aria-labelledby="live-screening-heading">
          <div className="miora-dash-header-copy">
            <div className="miora-dash-eyebrow">
              <span>PATIENT SCREENING REVIEW</span>
              <span className="miora-dash-eyebrow-line" aria-hidden="true" />
            </div>
            <h1 id="live-screening-heading" className="miora-dash-title">
              Maternal Screening <em>Review</em>
            </h1>
          </div>
        </section>

        {/* Exactly 3 Common Screening Tabs */}
        <div className="screening-tab-nav" role="tablist" aria-label="Screening sections" style={{ marginBottom: 20 }}>
          <button
            type="button"
            role="tab"
            id="tab-doc-ai-screening"
            aria-selected={screeningTab === 'ai-screening'}
            className={`screening-tab-nav-btn ${screeningTab === 'ai-screening' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('ai-screening')}
          >
            <DashboardIcon name="video" size={16} />
            <span>AI Screening</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-doc-epds"
            aria-selected={screeningTab === 'epds'}
            className={`screening-tab-nav-btn ${screeningTab === 'epds' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('epds')}
          >
            <DashboardIcon name="document" size={16} />
            <span>EPDS</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-doc-results"
            aria-selected={screeningTab === 'results'}
            className={`screening-tab-nav-btn ${screeningTab === 'results' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('results')}
          >
            <DashboardIcon name="sparkle" size={16} />
            <span>Results &amp; Reports</span>
          </button>
        </div>

        {/* Directly render patient screening results */}
        {screeningTab === 'ai-screening' && (
          <DoctorAiScreeningTab
            defaultMotherId={activeMother?.id}
            selectedMotherId={selectedMotherId}
            onSelectMother={setSelectedMotherId}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            searchError={searchError}
            onRetrySearch={handleRetrySearch}
          />
        )}

        {screeningTab === 'epds' && (
          <DoctorEpdsTab
            defaultMotherId={activeMother?.id}
            selectedMotherId={selectedMotherId}
            onSelectMother={setSelectedMotherId}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            searchError={searchError}
            onRetrySearch={handleRetrySearch}
          />
        )}

        {screeningTab === 'results' && (
          <DoctorResultsReportsTab
            defaultMotherId={activeMother?.id}
            selectedMotherId={selectedMotherId}
            onSelectMother={setSelectedMotherId}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            searchError={searchError}
            onRetrySearch={handleRetrySearch}
          />
        )}
      </div>
    </div>
  );
}

export default LiveScreeningPage;
