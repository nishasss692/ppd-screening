/**
 * MIORA Doctor Dashboard API Service
 * Connects clinician dashboard components directly to PostgreSQL-backed FastAPI endpoints.
 */

import { getAuthToken } from '../../auth/authService.js';

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) {
    return import.meta.env.VITE_MIORA_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('blob:')) {
    if (window.location.port === '3000' || window.location.port === '5173') {
      return 'http://127.0.0.1:8000';
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:8000';
}

function getHeaders(extraHeaders = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch platform aggregate metrics from GET /api/dashboard/metrics.
 */
export async function fetchDashboardMetrics() {
  const url = `${getApiBase()}/api/dashboard/metrics`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch dashboard metrics`);
  }
  return res.json();
}

/**
 * Fetch weekly screening activity time-series from GET /api/dashboard/screening-activity.
 * @param {'4w'|'8w'|'12w'} [timeframe='4w']
 */
export async function fetchScreeningActivity(timeframe = '4w') {
  const url = `${getApiBase()}/api/dashboard/screening-activity?timeframe=${encodeURIComponent(timeframe)}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch screening activity`);
  }
  return res.json();
}

/**
 * Fetch active clinical and safety alerts from GET /api/dashboard/alerts.
 */
export async function fetchDashboardAlerts() {
  const url = `${getApiBase()}/api/dashboard/alerts`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch dashboard alerts`);
  }
  return res.json();
}

/**
 * Fetch registered mothers directory from GET /api/mothers.
 */
export async function fetchMothers(skip = 0, limit = 100) {
  const url = `${getApiBase()}/api/mothers?skip=${skip}&limit=${limit}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch mothers`);
  }
  return res.json();
}

/**
 * Fetch all clinical screenings from GET /api/screenings.
 */
export async function fetchScreenings(skip = 0, limit = 100) {
  const url = `${getApiBase()}/api/screenings?skip=${skip}&limit=${limit}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch screenings`);
  }
  return res.json();
}

/**
 * Register a new mother in PostgreSQL via POST /api/mothers.
 */
export async function createMotherRecord(payload) {
  const url = `${getApiBase()}/api/mothers`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}: Failed to create mother`);
  }
  return res.json();
}

/**
 * Record a clinical review via POST /api/clinical-reviews.
 */
export async function persistClinicalReview(payload) {
  const url = `${getApiBase()}/api/clinical-reviews`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}: Failed to save clinical review`);
  }
  return res.json();
}

/**
 * Fetch clinical reviews for a mother from GET /api/mothers/{mother_id}/clinical-reviews.
 */
export async function fetchMotherClinicalReviews(motherId) {
  const url = `${getApiBase()}/api/mothers/${motherId}/clinical-reviews`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

/**
 * Save/update a care plan via PUT /api/mothers/{mother_id}/care-plan.
 */
export async function persistCarePlan(motherId, payload) {
  const url = `${getApiBase()}/api/mothers/${motherId}/care-plan`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}: Failed to save care plan`);
  }
  return res.json();
}

/**
 * Fetch a care plan via GET /api/mothers/{mother_id}/care-plan.
 */
export async function fetchMotherCarePlan(motherId) {
  const url = `${getApiBase()}/api/mothers/${motherId}/care-plan`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

/**
 * Record screening handoff event via POST /api/screenings/{screening_id}/handoff.
 */
export async function recordScreeningHandoff(screeningId, payload) {
  const url = `${getApiBase()}/api/screenings/${screeningId}/handoff`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}: Failed to record handoff`);
  }
  return res.json();
}

/**
 * Create or draft a doctor consultation report via POST /api/consultation-reports.
 */
export async function createConsultationReport(payload) {
  const url = `${getApiBase()}/api/consultation-reports`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}: Failed to save consultation report`);
  }
  return res.json();
}

/**
 * List consultation reports from GET /api/consultation-reports.
 */
export async function fetchConsultationReports(motherId = null) {
  const query = motherId ? `?mother_id=${encodeURIComponent(motherId)}` : '';
  const url = `${getApiBase()}/api/consultation-reports${query}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

/**
 * Download clinical screening PDF from GET /api/screenings/{screening_id}/report.pdf.
 */
export async function downloadClinicianScreeningPdfBlob(screeningId) {
  const url = `${getApiBase()}/api/screenings/${screeningId}/report.pdf`;
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to download screening PDF`);
  }
  return res.blob();
}

/**
 * Download clinical screening transcript from GET /api/screenings/{screening_id}/transcript.txt.
 */
export async function downloadClinicianScreeningTxtBlob(screeningId) {
  const url = `${getApiBase()}/api/screenings/${screeningId}/transcript.txt`;
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to download screening transcript`);
  }
  return res.blob();
}

