import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchHospitalDoctors, fetchHospitalReports } from './hospitalService.js';
import { buildMultiPagePdfBlob, triggerBlobDownload } from '../utils/pdfBuilder.js';
import './hospital.css';

export function HospitalReportsPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [repsData, docsData] = await Promise.all([
          fetchHospitalReports({
            search: searchQuery,
            doctor: selectedDoctor,
            status: selectedStatus,
            date: selectedDate,
          }),
          fetchHospitalDoctors().catch(() => []),
        ]);
        if (mounted) {
          setReports(repsData || []);
          setDoctors(docsData || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load consultation reports.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [searchQuery, selectedDoctor, selectedStatus, selectedDate]);

  // Client-side sorting & fallback filtering
  const filteredReports = useMemo(() => {
    let list = [...reports];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.patient_name?.toLowerCase().includes(q) ||
          r.patient_identifier?.toLowerCase().includes(q) ||
          r.report_code?.toLowerCase().includes(q)
      );
    }

    if (selectedDoctor !== 'all') {
      list = list.filter(
        (r) =>
          r.doctor_name?.toLowerCase().includes(selectedDoctor.toLowerCase()) ||
          r.doctor_id === selectedDoctor
      );
    }

    if (selectedStatus !== 'all') {
      list = list.filter((r) => r.status?.toLowerCase() === selectedStatus.toLowerCase());
    }

    if (selectedDate) {
      list = list.filter((r) => r.appointment_date?.includes(selectedDate));
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } else if (sortBy === 'patient') {
      list.sort((a, b) => (a.patient_name || '').localeCompare(b.patient_name || ''));
    }

    return list;
  }, [reports, searchQuery, selectedDoctor, selectedStatus, selectedDate, sortBy]);

  const handleDownloadPdf = (e, report) => {
    e.stopPropagation();
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
  };

  return (
    <div className="hosp-reports-page">
      {/* Breadcrumb Bar */}
      <div className="hosp-breadcrumb-bar">
        <span className="hosp-breadcrumb-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
            <path d="M9.5 21v-7h5v7" />
          </svg>
          <span>Home</span>
        </span>
        <span className="hosp-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="hosp-breadcrumb-current">Reports</span>
      </div>

      {/* Hero Header Card */}
      <div className="hosp-hero-card">
        <div>
          <div className="hosp-eyebrow">
            <span>CLINICAL DOCUMENTATION</span>
            <span className="hosp-eyebrow-line" aria-hidden="true" />
          </div>
          <h1 className="hosp-hero-title">
            Doctor Consultation <em>Reports</em>
          </h1>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <section className="hosp-filter-bar" aria-label="Report search and filters">
        <div className="hosp-search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="hosp-search-input"
            placeholder="Search by patient name, case ID, or Report ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search reports"
          />
          {searchQuery && (
            <button
              type="button"
              className="hosp-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        <div className="hosp-filter-group">
          {/* Doctor Filter */}
          <div className="hosp-filter-select-wrap">
            <label htmlFor="filter-doctor" className="hosp-sr-only">Filter by Doctor</label>
            <select
              id="filter-doctor"
              className="hosp-filter-select"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
            >
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.name}>
                  {d.name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="hosp-filter-select-wrap">
            <label htmlFor="filter-status" className="hosp-sr-only">Filter by Status</label>
            <select
              id="filter-status"
              className="hosp-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="final">Final / Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="hosp-filter-select-wrap">
            <label htmlFor="filter-sort" className="hosp-sr-only">Sort By</label>
            <select
              id="filter-sort"
              className="hosp-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recent">Sort by Most Recent</option>
              <option value="patient">Sort by Patient Name</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Table / Content */}
      {loading ? (
        <div className="hosp-loading-state" role="status">
          <span className="hosp-spinner" />
          <p>Loading clinical consultation reports...</p>
        </div>
      ) : error ? (
        <div className="hosp-error-banner" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="hosp-empty-state">
          <div className="hosp-empty-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h3>No Consultation Reports Found</h3>
          <p>
            {searchQuery || selectedDoctor !== 'all' || selectedStatus !== 'all'
              ? 'No reports match your active search or filter criteria. Try clearing filters.'
              : 'Doctors submit clinical reports after completing consultations with assigned patients.'}
          </p>
          {(searchQuery || selectedDoctor !== 'all' || selectedStatus !== 'all') && (
            <button
              type="button"
              className="hosp-btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setSelectedDoctor('all');
                setSelectedStatus('all');
                setSelectedDate('');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="hosp-table-card">
          <div className="hosp-table-responsive">
            <table className="hosp-data-table">
              <thead>
                <tr>
                  <th scope="col">Report ID</th>
                  <th scope="col">Patient</th>
                  <th scope="col">Doctor</th>
                  <th scope="col">Hospital / Dept</th>
                  <th scope="col">Appointment Date</th>
                  <th scope="col">Submission Date</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="hosp-table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((rep) => (
                  <tr
                    key={rep.id}
                    className="hosp-table-row"
                    onClick={() => navigate(`/hospital/reports/${rep.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="hosp-code-badge">{rep.report_code}</span>
                    </td>
                    <td>
                      <div className="hosp-patient-cell">
                        <strong>{rep.patient_name}</strong>
                        <span className="hosp-patient-id">{rep.patient_identifier}</span>
                      </div>
                    </td>
                    <td>
                      <div className="hosp-doctor-cell">
                        <strong>{rep.doctor_name}</strong>
                        <span className="hosp-doctor-spec">{rep.doctor_specialization}</span>
                      </div>
                    </td>
                    <td>
                      <div className="hosp-dept-cell">
                        <span>{rep.hospital_name}</span>
                        <small className="hosp-dept-sub">{rep.department}</small>
                      </div>
                    </td>
                    <td>{rep.appointment_date}</td>
                    <td>{rep.submission_date || 'Pending'}</td>
                    <td>
                      <span
                        className={`hosp-status-pill ${
                          rep.status === 'final' ? 'status-confirmed' : 'status-pending'
                        }`}
                      >
                        {rep.status === 'final' ? 'Final' : 'Draft'}
                      </span>
                    </td>
                    <td className="hosp-table-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="hosp-actions-group">
                        <button
                          type="button"
                          className="hosp-btn-secondary hosp-btn-sm"
                          onClick={() => navigate(`/hospital/reports/${rep.id}`)}
                          aria-label={`View clinical report ${rep.report_code}`}
                        >
                          View Report
                        </button>
                        <button
                          type="button"
                          className="hosp-icon-btn"
                          onClick={(e) => handleDownloadPdf(e, rep)}
                          aria-label={`Print or download PDF for report ${rep.report_code}`}
                          title="Print / Save PDF"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 9V2h12v7" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="hosp-table-footer">
            <span>Showing {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</span>
          </footer>
        </div>
      )}
    </div>
  );
}

export default HospitalReportsPage;
