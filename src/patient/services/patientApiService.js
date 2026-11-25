/**
 * MIORA Patient Portal API Service
 * Connects frontend patient components directly to PostgreSQL-backed FastAPI endpoints.
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
export async function saveScreeningSession(
  answersOrPayload,
  notes = '',
  videoMetadata = null,
  questionTimestamps = null,
  psychosocialAnswers = null
) {
  const url = `${getApiBase()}/api/patients/me/screenings`;
  let payload;

  if (
    answersOrPayload &&
    typeof answersOrPayload === 'object' &&
    !Array.isArray(answersOrPayload)
  ) {
    const rawAnswers = answersOrPayload.answers || [];
    const normalizedAnswers = Array.isArray(rawAnswers)
      ? rawAnswers.map((a) => ({
          question_id: a.question_id,
          selected_index: a.selected_index ?? a.selected_option ?? a.score ?? 0,
          selected_option: a.selected_option ?? a.selected_index ?? a.score ?? 0,
          raw_response: a.raw_response ?? a.response_text ?? '',
        }))
      : [];
    payload = {
      answers: normalizedAnswers,
      notes: answersOrPayload.notes || notes || undefined,
      video_metadata: answersOrPayload.video_metadata || videoMetadata || undefined,
      question_timestamps:
        answersOrPayload.question_timestamps || questionTimestamps || undefined,
      psychosocial_answers:
        answersOrPayload.psychosocial_answers || psychosocialAnswers || undefined,
    };
  } else {
    const rawAnswers = Array.isArray(answersOrPayload) ? answersOrPayload : [];
    const normalizedAnswers = rawAnswers.map((a) => ({
      question_id: a.question_id,
      selected_index: a.selected_index ?? a.selected_option ?? a.score ?? 0,
      selected_option: a.selected_option ?? a.selected_index ?? a.score ?? 0,
      raw_response: a.raw_response ?? a.response_text ?? '',
    }));
    payload = {
      answers: normalizedAnswers,
      notes: notes || undefined,
      video_metadata: videoMetadata || undefined,
      question_timestamps: questionTimestamps || undefined,
      psychosocial_answers: psychosocialAnswers || undefined,
    };
  }

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
 * Retrieve mother's persistent Stage 1 clinical profile from GET /api/patients/me/clinical-profile.
 */
export async function fetchClinicalProfile() {
  const url = `${getApiBase()}/api/patients/me/clinical-profile`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch clinical profile`);
  }

  return response.json();
}

/**
 * Save or update mother's Stage 1 clinical profile via PUT /api/patients/me/clinical-profile.
 */
export async function updateClinicalProfile(data) {
  const url = `${getApiBase()}/api/patients/me/clinical-profile`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to save clinical profile`);
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

/**
 * Download genuine screening report PDF as a Blob from FastAPI backend.
 */
export async function downloadReportPdfBlob(screeningId) {
  const url = screeningId
    ? `${getApiBase()}/api/patients/me/screenings/${screeningId}/report.pdf`
    : `${getApiBase()}/api/patients/me/reports/latest/pdf`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders({ Accept: 'application/pdf' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to download PDF report`);
  }

  return response.blob();
}

/**
 * Download genuine screening transcript TXT as a Blob from FastAPI backend.
 */
export async function downloadTranscriptTxtBlob(screeningId) {
  const url = screeningId
    ? `${getApiBase()}/api/patients/me/screenings/${screeningId}/transcript.txt`
    : `${getApiBase()}/api/patients/me/reports/latest/transcript`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders({ Accept: 'text/plain' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to download transcript`);
  }

  return response.blob();
}

/**
 * Fetch patient-friendly consultation reports written by doctors from GET /api/patients/me/consultation-reports.
 */
export async function fetchPatientConsultationReports() {
  const url = `${getApiBase()}/api/patients/me/consultation-reports`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Download patient-friendly doctor consultation report as a Blob from GET /api/patients/me/consultation-reports/{reportId}/download.
 */
export async function downloadPatientConsultationReportBlob(reportId) {
  const url = `${getApiBase()}/api/patients/me/consultation-reports/${encodeURIComponent(reportId)}/download`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders({ Accept: 'text/plain' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to download consultation report`);
  }

  return response.blob();
}

/**
 * Fetch patient appointments from GET /api/patients/me/appointments.
 */
export async function fetchPatientAppointments() {
  const url = `${getApiBase()}/api/patients/me/appointments`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch appointments`);
  }

  return response.json();
}

/**
 * Book an appointment via POST /api/patients/me/appointments.
 */
export async function bookPatientAppointment(appointmentData) {
  const url = `${getApiBase()}/api/patients/me/appointments`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(appointmentData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to book appointment`);
  }

  return response.json();
}

/**
 * Fetch patient notifications from GET /api/patients/me/notifications.
 */
export async function fetchPatientNotifications() {
  const url = `${getApiBase()}/api/patients/me/notifications`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch notifications`);
  }

  return response.json();
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsReadApi(notificationId) {
  const url = `${getApiBase()}/api/patients/me/notifications/${notificationId}/read`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to mark notification read`);
  }

  return response.json();
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsAsReadApi() {
  const url = `${getApiBase()}/api/patients/me/notifications/read-all`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to mark all notifications read`);
  }

  return response.json();
}

/**
 * Fetch care plan and task completion from GET /api/patients/me/care-plan.
 */
export async function fetchPatientCarePlan() {
  const url = `${getApiBase()}/api/patients/me/care-plan`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch care plan`);
  }

  return response.json();
}

/**
 * Toggle care plan task completion status via PUT /api/patients/me/care-plan/tasks/{task_id}.
 */
export async function toggleCarePlanTaskApi(taskId) {
  const url = `${getApiBase()}/api/patients/me/care-plan/tasks/${taskId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to toggle care plan task`);
  }

  return response.json();
}

/**
 * Fetch patient device and privacy settings from GET /api/patients/me/settings.
 */
export async function fetchPatientSettings() {
  const url = `${getApiBase()}/api/patients/me/settings`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch settings`);
  }

  return response.json();
}

/**
 * Update patient settings via PUT /api/patients/me/settings.
 */
export async function updatePatientSettings(settingsData) {
  const url = `${getApiBase()}/api/patients/me/settings`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(settingsData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to update settings`);
  }

  return response.json();
}

/**
 * Fetch saved AI assistant conversations from GET /api/patients/me/ai-conversations.
 */
export async function fetchPatientAiConversations() {
  const url = `${getApiBase()}/api/patients/me/ai-conversations`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch AI conversations`);
  }

  return response.json();
}

/**
 * Save AI assistant conversations to POST /api/patients/me/ai-conversations.
 */
export async function savePatientAiConversations(messages, currentMood = null) {
  const url = `${getApiBase()}/api/patients/me/ai-conversations`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      messages,
      current_mood: currentMood,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to save AI conversations`);
  }

  return response.json();
}

/**
 * Retrieve status and readiness of multimodal screening model pipelines.
 */
export async function fetchMultimodalStatus() {
  const url = `${getApiBase()}/api/screenings/multimodal/status`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch multimodal pipeline status`);
  }

  return response.json();
}

/**
 * Submit multimodal screening inputs (text, audio, video) to POST /api/screenings/multimodal/analyze.
 */
export async function submitMultimodalScreening(formData) {
  const url = `${getApiBase()}/api/screenings/multimodal/analyze`;
  const token = getAuthToken();
  const headers = {
    Accept: 'application/json',
  };
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
    throw new Error(err.detail || `HTTP ${response.status}: Multimodal screening analysis failed`);
  }

  return response.json();
}

/**
 * Retrieve public hospital directory from GET /api/hospitals.
 */
export async function fetchHospitals() {
  const url = `${getApiBase()}/api/hospitals`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch hospital directory`);
  }

  return response.json();
}

/**
 * Retrieve public doctor directory from GET /api/doctors.
 * Supports optional filters: { location, specialization }.
 */
export async function fetchDoctors(filters = {}) {
  const params = new URLSearchParams();
  if (filters.location) {
    params.append('location', filters.location);
  }
  if (filters.specialization) {
    params.append('specialization', filters.specialization);
  }
  const queryString = params.toString();
  const url = `${getApiBase()}/api/doctors${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}: Failed to fetch doctor directory`);
  }

  return response.json();
}


