import { getAuthToken } from '../../auth/authService.js';

export function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) {
    return import.meta.env.VITE_MIORA_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('blob:')) {
    if (window.location.port === '5173' || window.location.port === '3000') {
      return 'http://127.0.0.1:8000';
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:8000';
}

/**
 * Submits uploaded maternal screening files & selected modalities to the
 * Central Multimodal Screening Analysis endpoint (/api/screenings/multimodal/analyze).
 *
 * Connects Clinical (46 predictors), Text (TF-IDF + LR), Audio (7-feature acoustic),
 * Video (220-feature dynamics), and Late Fusion stacking meta-classifiers without fabricating scores.
 */
export async function submitMultimodalAnalysis({
  motherId,
  selectedModalities = [],
  files = [],
  consentConfirmed,
  audioFeatures = null,
  videoFeatures = null,
  clinicalFeatures = null,
  epdsAnswers = null,
  textContent = null,
  apiBase: customApiBase,
  fetchImpl = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null,
}) {
  if (!motherId) {
    return { ok: false, reason: 'validation', message: 'A registered Mother ID is required.' };
  }
  if (!consentConfirmed) {
    return {
      ok: false,
      reason: 'consent',
      message: 'Please confirm mother consent before submitting files for analysis.',
    };
  }
  if (!files || files.length === 0 || !selectedModalities.length) {
    return {
      ok: false,
      reason: 'validation',
      message: 'Upload at least one valid file and select at least one modality.',
    };
  }

  const resolvedApiBase =
    typeof customApiBase === 'string'
      ? customApiBase.replace(/\/$/, '')
      : getApiBase();

  if (!fetchImpl) {
    return {
      ok: false,
      reason: 'backend-unavailable',
      message:
        'Multimodal analysis backend is not connected in this frontend environment. Your files were validated locally and have not been uploaded externally or assigned fabricated scores.',
    };
  }

  try {
    const formData = new FormData();
    formData.append('motherId', motherId);
    formData.append('consentConfirmed', String(consentConfirmed));

    // Map modality files to backend expected field names
    files.forEach((entry) => {
      if (!entry.rawFile) return;
      if (entry.modality === 'text') {
        formData.append('files_text', entry.rawFile, entry.name);
      } else if (entry.modality === 'voice') {
        formData.append('files_voice', entry.rawFile, entry.name);
      } else if (entry.modality === 'video') {
        formData.append('files_video', entry.rawFile, entry.name);
      }
    });

    if (textContent) {
      formData.append('text_content', textContent);
    }
    if (audioFeatures) {
      formData.append(
        'audio_features',
        typeof audioFeatures === 'string' ? audioFeatures : JSON.stringify(audioFeatures)
      );
    }
    if (videoFeatures) {
      formData.append(
        'video_features',
        typeof videoFeatures === 'string' ? videoFeatures : JSON.stringify(videoFeatures)
      );
    }
    if (clinicalFeatures) {
      formData.append(
        'clinical_features',
        typeof clinicalFeatures === 'string' ? clinicalFeatures : JSON.stringify(clinicalFeatures)
      );
    }
    if (epdsAnswers) {
      formData.append(
        'epds_answers',
        typeof epdsAnswers === 'string' ? epdsAnswers : JSON.stringify(epdsAnswers)
      );
    }

    const headers = {};
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const endpoint = `${resolvedApiBase}/api/screenings/multimodal/analyze`;
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      return {
        ok: false,
        reason: 'server-error',
        message:
          errorPayload.detail ||
          `Analysis request failed (HTTP ${response.status}). Please retry or save a draft.`,
      };
    }

    const raw = await response.json();

    // Map backend response to dashboard presentation schema
    const combinedScore =
      typeof raw.fusion_score === 'number'
        ? raw.fusion_score
        : typeof raw.clinical_score === 'number'
        ? raw.clinical_score
        : typeof raw.text_score === 'number'
        ? raw.text_score
        : typeof raw.audio_score === 'number'
        ? raw.audio_score
        : typeof raw.video_score === 'number'
        ? raw.video_score
        : null;

    let riskCategory = 'Indeterminate';
    if (typeof combinedScore === 'number') {
      if (combinedScore >= 0.65) riskCategory = 'High Risk';
      else if (combinedScore >= 0.40) riskCategory = 'Moderate Risk';
      else riskCategory = 'Low Risk';
    }

    const modalityContributions = {
      clinical:
        typeof raw.clinical_score === 'number'
          ? raw.clinical_score
          : (raw.clinical?.prediction?.predicted_risk_probability ?? null),
      text: typeof raw.text_score === 'number' ? raw.text_score : null,
      voice: typeof raw.audio_score === 'number' ? raw.audio_score : null,
      video: typeof raw.video_score === 'number' ? raw.video_score : null,
    };

    const indicators = [];
    if (typeof raw.clinical_score === 'number') {
      indicators.push(
        `Clinical Model (46 Covariates - Random Forest): Risk score ${raw.clinical_score.toFixed(2)} (${raw.modalities?.clinical?.status || 'completed'}) [Validated Survey Data]`
      );
    } else if (raw.modality_status?.clinical) {
      indicators.push(`Clinical Modality: ${raw.modality_status.clinical}`);
    }

    if (typeof raw.text_score === 'number') {
      indicators.push(
        `Text Model (TF-IDF + LR): Risk score ${raw.text_score.toFixed(2)} (${raw.modalities?.text?.status || 'completed'}) [Narrative Text]`
      );
    } else if (raw.modality_status?.text) {
      indicators.push(`Text Modality: ${raw.modality_status.text}`);
    }

    if (typeof raw.audio_score === 'number') {
      indicators.push(
        `Audio Model (7-Feature Acoustic): Risk score ${raw.audio_score.toFixed(2)} (${raw.modalities?.audio?.status || 'completed'}) [Acoustic Biomarkers]`
      );
    } else if (raw.modality_status?.audio) {
      const audioNotice = raw.modalities?.audio?.details?.notice
        ? ' (acoustic DSP extraction offline in live environment)'
        : '';
      indicators.push(`Voice Modality: ${raw.modality_status.audio}${audioNotice}`);
    }

    if (typeof raw.video_score === 'number') {
      indicators.push(
        `Video Model (220-Feature Dynamics): Risk score ${raw.video_score.toFixed(2)} (${raw.modalities?.video?.status || 'completed'}) [Visual Dynamics]`
      );
    } else if (raw.modality_status?.video) {
      const videoNotice = raw.modalities?.video?.details?.notice
        ? ' (visual dynamics extraction offline in live environment)'
        : '';
      indicators.push(`Video Modality: ${raw.modality_status.video}${videoNotice}`);
    }

    if (typeof raw.fusion_score === 'number') {
      indicators.push(
        `Four-Modality Late Fusion (${raw.fusion_method}): Final risk score ${raw.fusion_score.toFixed(2)}`
      );
    } else {
      indicators.push(
        `Multimodal Late Fusion: ${raw.fusion_status || 'not_available'} (requires ≥2 completed predictive modalities)`
      );
    }

    if (raw.disagreement_flag) {
      indicators.push('Cross-modal algorithmic divergence detected across active modalities (|Δ| ≥ 0.25).');
    }

    if (raw.q10_safety_alert?.triggered) {
      indicators.push(
        `CRISIS ALERT: EPDS Question 10 indicates thoughts of self-harm. Refer immediately to ${raw.q10_safety_alert.helpline}.`
      );
    }

    const nextSteps = [
      raw.disclaimer ||
        'Research prototype score only. Not a medical diagnosis or calibrated disease probability.',
      'Standard clinical EPDS evaluation and clinician consultation required.',
    ];
    if (raw.q10_safety_alert?.triggered) {
      nextSteps.unshift(
        `URGENT: Initiate crisis safety protocol & reach out to ${raw.q10_safety_alert.helpline}`
      );
    }

    const result = {
      ...raw,
      clinicalScore: typeof raw.clinical_score === 'number' ? raw.clinical_score : null,
      combinedScore,
      riskCategory,
      modalityContributions,
      q10SafetyAlert: raw.q10_safety_alert || null,
      indicators,
      nextSteps,
      epdsEquivalent: typeof combinedScore === 'number' ? Math.round(combinedScore * 20) : null,
      discordanceDetected: Boolean(raw.disagreement_flag),
    };

    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      reason: 'network-error',
      message: err?.message || 'Unable to reach the analysis service. Please retry.',
    };
  }
}


