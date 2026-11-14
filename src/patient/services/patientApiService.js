/**
 * MIORA Patient Portal API Service
 * Connects frontend patient components directly to PostgreSQL-backed FastAPI endpoints.
 */

import { getAuthToken } from '../../auth/authService.js';

function getApiBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return '';
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
 * Retrieve authenticated patient profile from GET /api/patients/me.
 */
export async function fetchPatientProfile() {
  const url = `${getApiBase()}/api/patients/me`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch patient profile`);
  }

  return response.json();
}

/**
 * Update authenticated patient profile via PUT /api/patients/me.
 */
export async function updatePatientProfile(profileData) {
  const url = `${getApiBase()}/api/patients/me`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to update patient profile`);
  }

  return response.json();
}

/**
 * Fetch patient medical history from GET /api/patients/me/medical-history.
 */
export async function fetchMedicalHistory() {
  const url = `${getApiBase()}/api/patients/me/medical-history`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch medical history`);
  }

  return response.json();
}

/**
 * Update patient medical history via PUT /api/patients/me/medical-history.
 */
export async function updateMedicalHistory(historyData) {
  const url = `${getApiBase()}/api/patients/me/medical-history`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(historyData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to update medical history`);
  }

  return response.json();
}

/**
 * Persist completed EPDS screening to PostgreSQL via POST /api/patients/me/screenings.
 */
export async function saveScreeningSession(answers, notes = '', videoMetadata = null, questionTimestamps = null) {
  const url = `${getApiBase()}/api/patients/me/screenings`;
  const payload = {
    answers,
    notes,
    video_metadata: videoMetadata || undefined,
    question_timestamps: questionTimestamps || undefined,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to save screening session`);
  }

  return response.json();
}

/**
 * Upload continuous video recording file to POST /api/patients/me/screenings/{screening_id}/video.
 */
export async function uploadScreeningVideo(screeningId, videoBlob, { durationSeconds = 0, questionTimestamps = [] } = {}) {
  const url = `${getApiBase()}/api/patients/me/screenings/${screeningId}/video`;
  const token = getAuthToken();
  const formData = new FormData();
  const filename = videoBlob?.name || `screening_${screeningId}.webm`;
  formData.append('video_file', videoBlob, filename);
  formData.append('duration_seconds', String(durationSeconds));
  formData.append('question_timestamps', JSON.stringify(questionTimestamps));

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to upload screening video`);
  }

  return response.json();
}

/**
 * Get URL to stream or download continuous video recording.
 */
export function getScreeningVideoUrl(screeningId) {
  return `${getApiBase()}/api/patients/me/screenings/${screeningId}/video`;
}

/**
 * Fetch all historical screenings from GET /api/patients/me/screenings.
 */
export async function fetchPatientScreenings() {
  const url = `${getApiBase()}/api/patients/me/screenings`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch screenings`);
  }

  return response.json();
}

/**
 * Fetch patient reports overview from GET /api/patients/me/reports.
 */
export async function fetchPatientReportsOverview() {
  const url = `${getApiBase()}/api/patients/me/reports`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch reports overview`);
  }

  return response.json();
}

