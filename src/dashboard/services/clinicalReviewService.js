/**
 * Persists a finalized Clinician Review & Assessment separately from AI outputs.
 * When VITE_MIORA_API_URL is configured, posts to POST /api/clinical-reviews and
 * waits for backend confirmation before signaling completion.
 * When no remote API URL is configured in the frontend workspace, persists via
 * the local ClinicalContext store and marks persistenceMode: 'local'.
 */
export async function submitClinicalReview({
  payload,
  fetchImpl = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null,
}) {
  if (!payload?.motherId || !payload?.screeningId) {
    return {
      ok: false,
      reason: 'validation',
      message: 'A valid mother and screening session are required to finalize review.',
    };
  }

  const apiBase =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

  if (!apiBase) {
    return {
      ok: true,
      persistenceMode: 'local',
      record: payload,
      message: 'Saved in local clinical workspace (remote EHR API not configured).',
    };
  }

  if (!fetchImpl) {
    return {
      ok: false,
      reason: 'network-unavailable',
      message: 'Network client is unavailable; review changes have been preserved locally.',
    };
  }

  try {
    const isUuid = (val) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const resolvedMotherUuid = isUuid(payload.motherUuid)
      ? payload.motherUuid
      : isUuid(payload.motherId)
        ? payload.motherId
        : null;

    if (!resolvedMotherUuid) {
      return {
        ok: true,
        persistenceMode: 'local',
        record: payload,
        message: 'Saved in local clinical workspace (no backend UUID for demo record).',
      };
    }

    const resolvedScreeningUuid = isUuid(payload.screeningUuid)
      ? payload.screeningUuid
      : isUuid(payload.screeningId)
        ? payload.screeningId
        : undefined;

    const decision = payload.clinicianAssessment?.decision;
    const reviewStatus = decision === 'disagree' ? 'overridden' : 'confirmed';
    const notesParts = [
      payload.clinicianAssessment?.reviewNotes,
      payload.clinicianAssessment?.decisionReason
        ? `Decision rationale: ${payload.clinicianAssessment.decisionReason}`
        : null,
      payload.followUpPlan
        ? `Follow-up: ${payload.followUpPlan.nextScreening} | ${payload.followUpPlan.careAction} | ${payload.followUpPlan.additionalSupport}`
        : null,
    ].filter(Boolean);

    const backendPayload = {
      mother_id: resolvedMotherUuid,
      ...(resolvedScreeningUuid ? { screening_id: resolvedScreeningUuid } : {}),
      clinician_id: 'DOC-101',
      clinician_name: (typeof window !== 'undefined' && window.localStorage?.getItem('miora_auth_user_v1') ? JSON.parse(window.localStorage.getItem('miora_auth_user_v1'))?.fullName : null) || 'Dr. Priya Mehta',
      review_status: reviewStatus,
      final_risk_classification: (payload.clinicianAssessment?.risk || 'moderate').toLowerCase(),
      clinical_notes: notesParts.join('\n') || 'Confirmed through clinician assessment.',
      required_immediate_escalation:
        (payload.clinicianAssessment?.risk || '').toLowerCase() === 'high' ||
        /urgent|immediate|crisis/i.test(payload.followUpPlan?.careAction || ''),
    };

    const headers = { 'Content-Type': 'application/json' };
    try {
      const token =
        typeof localStorage !== 'undefined' ? localStorage.getItem('aanchal_auth_token') : null;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // ignore storage errors
    }

    const response = await fetchImpl(`${apiBase.replace(/\/$/, '')}/api/clinical-reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: 'server-error',
        message: `Could not persist clinical review (HTTP ${response.status}). Your entries are preserved — please retry.`,
      };
    }

    const saved = await response.json().catch(() => payload);
    return {
      ok: true,
      persistenceMode: 'remote',
      record: saved,
      message: 'Confirmed and persisted to Miora clinical backend.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'network-error',
      message:
        err?.message ||
        'Unable to reach clinical backend. Entered assessment details were preserved — please retry.',
    };
  }
}
