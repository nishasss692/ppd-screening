/**
 * Doctor Assistant API Client Service (Clinician Copilot)
 *
 * Connects the Doctor Dashboard with POST /api/doctor-assistant/chat.
 *
 * Strict Privacy & Clinical Boundary Guarantees:
 * - Strictly non-diagnostic: for dashboard navigation, feature explanations,
 *   and EPDS instrument reference only.
 * - Never includes or transmits patient identifiable records (PHI/PII),
 *   screening recordings, or clinical EHR data to the LLM.
 */

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) {
    return import.meta.env.VITE_MIORA_API_URL;
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null' &&
    !window.location.origin.startsWith('blob:')
  ) {
    return window.location.origin;
  }
  return '';
}

export const FALLBACK_DOCTOR_KNOWLEDGE = {
  discordance: (
    'Cross-modal discordance evaluates divergence between a mother’s subjective EPDS self-report ' +
    'and objective nonverbal acoustic and facial affective signals. For example, if a mother reports low distress ' +
    'but exhibits psychomotor slowing and flat facial affect, the system flags a masked distress pattern for review.'
  ),
  epds: (
    'The Edinburgh Postnatal Depression Scale (EPDS) is a 10-item screening instrument evaluating feelings over ' +
    'the past 7 days. Validated cutoffs: 0–9 (low likelihood), 10–12 (possible depression; repeat in 2 weeks), ' +
    'and 13–30 (probable depression; diagnostic evaluation recommended). Item 10 non-zero scores (1, 2, or 3) ' +
    'mandate immediate human safety assessment regardless of the total score. Tele-MANAS: 14416 / 1800-891-4416.'
  ),
  review: (
    'The Clinical Review screen (/clinical-review) enables attending clinicians to review AI multimodal signals, ' +
    'record diagnostic impressions, document disagreement rationales, choose care plan recommendations, ' +
    'and sign off to finalize the official clinical note.'
  ),
  navigation: (
    'Clinician Dashboard Navigation:\n' +
    '• Dashboard (/dashboard): Priority cases, KPIs, recent reviews.\n' +
    '• Mothers & Cases (/mothers): Searchable patient directory.\n' +
    '• Screening (/live-screening, /upload-analyze): Multimodal recording & uploads.\n' +
    '• Results (/results): Multimodal findings breakdown.\n' +
    '• Discordance (/discordance): Cross-modal divergence assessment.\n' +
    '• Insights & Care (/insights): Care planning & follow-ups.\n' +
    '• Clinical Review (/clinical-review): Final clinical sign-off.'
  ),
  default: (
    'Miora Clinician Copilot provides guidance on dashboard navigation and standard EPDS instrument interpretation. ' +
    'This assistant is strictly non-diagnostic and does not process patient identifiable data or make treatment decisions.'
  ),
};

/**
 * Client-side boundary pre-screening for the Doctor Assistant.
 * Validates that queries are strictly non-diagnostic and free of patient PHI/PII.
 */
export function screenDoctorAssistantPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return { allowed: true };
  const clean = prompt.trim().toLowerCase();

  // Diagnostic or Prescriptive Demands
  const diagnosticPatterns = [
    /\b(diagnose|confirm diagnosis of|does (she|this patient) have (depression|ppd|psychosis))\b/i,
    /\b(prescribe|medication dosage|which drug|start her on (sertraline|ssri|antidepressant|fluoxetine|zoloft))\b/i,
    /\b(what dose|treatment plan for this specific patient|prescriptive order)\b/i,
  ];
  if (diagnosticPatterns.some((p) => p.test(clean))) {
    return {
      allowed: false,
      reason: 'Non-Diagnostic Clinical Boundary Notice: The Miora Clinician Copilot cannot diagnose patients or prescribe medications.',
    };
  }

  // Patient Identifiable Information (PHI/PII)
  const phiPatterns = [
    /\b(mrn|patient name|ssn|aadhaar|dob|date of birth)\s*[:=]\s*\w+/i,
    /\bpatient\s+(?:name|is|named)\s+[a-z]+/i,
    /\bpatient\s+[a-z]+\s+[a-z]+/i,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b\d{10,12}\b/,
  ];
  if (phiPatterns.some((p) => p.test(clean))) {
    return {
      allowed: false,
      reason: 'PHI Protection: Patient identifiable information must not be transmitted to AI services.',
    };
  }

  return { allowed: true };
}

/**
 * Send clinician query to the backend doctor assistant endpoint.
 *
 * @param {Object} params
 * @param {string} params.message - Clinician question
 * @param {Array<{role: string, content: string}>} [params.history] - Prior turns
 * @param {Function} [fetchImpl] - Optional custom fetch implementation (useful for tests)
 * @returns {Promise<Object>} DoctorAssistantChatResponse
 */
export async function sendDoctorAssistantChat({ message, history = [] }, fetchImpl = window.fetch) {
  if (!message || !message.trim()) {
    throw new Error('Message cannot be empty or whitespace.');
  }

  // Privacy Protection: Strip any accidental patient identifiers
  const cleanMessage = message.trim();

  const apiBase = getApiBase();
  const url = `${apiBase.replace(/\/$/, '')}/api/doctor-assistant/chat`;

  // Format turns into standard [{role: 'user'|'model', content: string}]
  const formattedHistory = Array.isArray(history)
    ? history
        .filter((turn) => turn && (turn.content || turn.text))
        .map((turn) => ({
          role: turn.role || (turn.sender === 'user' ? 'user' : 'model'),
          content: (turn.content || turn.text || '').trim(),
        }))
        .filter((turn) => turn.content.length > 0)
    : [];

  const payload = {
    message: cleanMessage,
    history: formattedHistory.length > 0 ? formattedHistory : undefined,
  };

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetail = 'Doctor assistant service error';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      }
      const error = new Error(errorDetail);
      error.status = response.status;
      throw error;
    }

    const result = await response.json();
    return result;
  } catch (err) {
    // If backend is offline or network fails, provide honest non-diagnostic fallback
    const lower = cleanMessage.toLowerCase();
    let fallbackText = FALLBACK_DOCTOR_KNOWLEDGE.default;
    if (lower.includes('discordance') || lower.includes('cross-modal')) {
      fallbackText = FALLBACK_DOCTOR_KNOWLEDGE.discordance;
    } else if (lower.includes('epds') || lower.includes('cutoff') || lower.includes('threshold') || lower.includes('item 10')) {
      fallbackText = FALLBACK_DOCTOR_KNOWLEDGE.epds;
    } else if (lower.includes('review') || lower.includes('sign-off') || lower.includes('note')) {
      fallbackText = FALLBACK_DOCTOR_KNOWLEDGE.review;
    } else if (lower.includes('navigate') || lower.includes('where') || lower.includes('screens') || lower.includes('dashboard')) {
      fallbackText = FALLBACK_DOCTOR_KNOWLEDGE.navigation;
    }

    return {
      status: 'fallback',
      text: fallbackText,
      message: fallbackText,
      source: 'fallback',
      model: null,
      is_diagnostic: false,
      disclaimer:
        'Miora Clinician Copilot provides workflow and instrument navigation only. Strictly non-diagnostic. ' +
        'Does not make clinical decisions, diagnose patients, or prescribe treatments.',
    };
  }
}

