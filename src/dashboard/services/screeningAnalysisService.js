import { getAuthToken } from '../../auth/authService.js';

export function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) {
    return import.meta.env.VITE_MIORA_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('blob:')) {
    return window.location.origin;
  }
  return '';
}

/**
 * Submits uploaded maternal screening files & selected modalities to the
 * Stage 1 Three-Modality Multimodal Analysis endpoint (/api/screenings/multimodal/analyze).
 *
 * Connects Text (TF-IDF + LR), Audio (7-feature acoustic), Video (220-feature dynamics),
 * and Late Fusion stacking meta-classifiers without fabricating clinical scores.
 */
export async function submitMultimodalAnalysis({
  motherId,
  selectedModalities = [],
  files = [],
  consentConfirmed,
  audioFeatures = null,
  videoFeatures = null,
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

    // Map backend ThreeModalityAnalyzeResponse to dashboard presentation schema
    const combinedScore =
      typeof raw.fusion_score === 'number'
        ? raw.fusion_score
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
      text: typeof raw.text_score === 'number' ? raw.text_score : null,
      voice: typeof raw.audio_score === 'number' ? raw.audio_score : null,
      video: typeof raw.video_score === 'number' ? raw.video_score : null,
    };

    const indicators = [];
    if (typeof raw.text_score === 'number') {
      indicators.push(
        `Text Model (TF-IDF + LR): Risk score ${raw.text_score.toFixed(2)} (${raw.modalities?.text?.status || 'completed'})`
      );
    } else if (raw.modality_status?.text) {
      indicators.push(`Text Modality: ${raw.modality_status.text}`);
    }

    if (typeof raw.audio_score === 'number') {
      indicators.push(
        `Audio Model (7-Feature Acoustic): Risk score ${raw.audio_score.toFixed(2)} (${raw.modalities?.audio?.status || 'completed'})`
      );
    } else if (raw.modality_status?.audio) {
      const audioNotice = raw.modalities?.audio?.details?.notice
        ? ' (acoustic DSP extraction offline in live environment)'
        : '';
      indicators.push(`Voice Modality: ${raw.modality_status.audio}${audioNotice}`);
    }

    if (typeof raw.video_score === 'number') {
      indicators.push(
        `Video Model (220-Feature Dynamics): Risk score ${raw.video_score.toFixed(2)} (${raw.modalities?.video?.status || 'completed'})`
      );
    } else if (raw.modality_status?.video) {
      const videoNotice = raw.modalities?.video?.details?.notice
        ? ' (visual dynamics extraction offline in live environment)'
        : '';
      indicators.push(`Video Modality: ${raw.modality_status.video}${videoNotice}`);
    }

    if (typeof raw.fusion_score === 'number') {
      indicators.push(
        `Multimodal Late Fusion (${raw.fusion_method}): Final risk score ${raw.fusion_score.toFixed(2)}`
      );
    } else {
      indicators.push(
        `Multimodal Late Fusion: ${raw.fusion_status || 'not_available'} (requires ≥2 completed predictive modalities)`
      );
    }

    if (raw.disagreement_flag) {
      indicators.push('Cross-modal algorithmic divergence detected across active modalities.');
    }

    const nextSteps = [
      raw.disclaimer ||
        'Research prototype score only. Not a medical diagnosis or calibrated disease probability.',
      'Standard clinical EPDS evaluation and clinician consultation required.',
    ];

    const result = {
      ...raw,
      combinedScore,
      riskCategory,
      modalityContributions,
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


