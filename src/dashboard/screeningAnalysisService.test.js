import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiBase, submitMultimodalAnalysis } from './services/screeningAnalysisService.js';
import { analyzeCrossModalDiscordance } from './utils/discordanceAnalysis.js';

describe('screeningAnalysisService & 4-Modality Pipeline Frontend Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves API base URL with fallback to local FastAPI backend', () => {
    const base = getApiBase();
    expect(base).toBeDefined();
    expect(typeof base).toBe('string');
  });

  it('submits 4-modality screening payload with clinical, audio, video features and epds Q10 answers', async () => {
    let capturedBody = null;
    let capturedHeaders = null;

    const mockFetch = vi.fn().mockImplementation(async (url, init) => {
      capturedBody = init.body;
      capturedHeaders = init.headers;
      return {
        ok: true,
        json: async () => ({
          status: 'completed',
          clinical_score: 0.62,
          text_score: 0.55,
          audio_score: 0.58,
          video_score: 0.64,
          fusion_score: 0.60,
          fusion_status: 'completed',
          fusion_method: 'learned_stacking_four_modality',
          modality_status: {
            clinical: 'completed',
            text: 'completed',
            audio: 'completed',
            video: 'completed',
          },
          modalities: {
            clinical: { status: 'completed', score: 0.62 },
            text: { status: 'completed', score: 0.55 },
            audio: { status: 'completed', score: 0.58 },
            video: { status: 'completed', score: 0.64 },
          },
          disagreement_flag: false,
          q10_safety_alert: {
            triggered: true,
            question_10_score: 2,
            severity: 'URGENT_SAFETY_ASSESSMENT',
            helpline: 'Tele-MANAS (14416 / 1800-891-4416)',
          },
        }),
      };
    });

    const dummyFile = new File(['vignette content'], 'sample.txt', { type: 'text/plain' });
    const response = await submitMultimodalAnalysis({
      motherId: 'M-108',
      selectedModalities: ['text', 'voice', 'video'],
      files: [{ modality: 'text', rawFile: dummyFile, name: 'sample.txt' }],
      consentConfirmed: true,
      audioFeatures: { f0_mean_hz: 180.5, jitter_local_percent: 1.2 },
      videoFeatures: new Array(220).fill(0.05),
      clinicalFeatures: { Age: 29, Parity: 1 },
      epdsAnswers: [{ question_id: 'EPDS_Q10', selected_index: 2 }],
      fetchImpl: mockFetch,
    });

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify formData fields sent
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get('motherId')).toBe('M-108');
    expect(capturedBody.get('clinical_features')).toContain('Age');
    expect(capturedBody.get('audio_features')).toContain('f0_mean_hz');
    expect(capturedBody.get('video_features')).toBeDefined();
    expect(capturedBody.get('epds_answers')).toContain('EPDS_Q10');

    // Verify mapped result
    const result = response.result;
    expect(result.clinicalScore).toBe(0.62);
    expect(result.combinedScore).toBe(0.60);
    expect(result.riskCategory).toBe('Moderate Risk');
    expect(result.modalityContributions.clinical).toBe(0.62);
    expect(result.modalityContributions.text).toBe(0.55);
    expect(result.modalityContributions.voice).toBe(0.58);
    expect(result.modalityContributions.video).toBe(0.64);

    // Verify Q10 crisis alert mapped
    expect(result.q10SafetyAlert).toBeDefined();
    expect(result.q10SafetyAlert.triggered).toBe(true);
    expect(result.indicators.some((ind) => ind.includes('CRISIS ALERT'))).toBe(true);
    expect(result.nextSteps.some((step) => step.includes('URGENT'))).toBe(true);
  });

  it('handles partial modalities and cross-modal discordance calculation across 4 modalities', () => {
    const screening4Mod = {
      id: 'SCR-TEST-4MOD',
      motherId: 'M-108',
      combinedScore: 0.65,
      risk: 'Moderate',
      modalities: {
        clinical: { status: 'completed', score: 0.85 },
        text: { status: 'completed', score: 0.50 },
        voice: { status: 'completed', score: 0.45 },
        video: { status: 'completed', score: 0.52 },
      },
    };

    const discordance = analyzeCrossModalDiscordance({ screening: screening4Mod });
    expect(discordance).toBeDefined();
    expect(discordance.completedModalities.length).toBe(4);
    expect(discordance.pairwiseAlignment.length).toBe(6); // 6 pairwise comparisons for 4 modalities
    expect(discordance.pairwiseAlignment.some((p) => p.key === 'clinical-text')).toBe(true);
    expect(discordance.pairwiseAlignment.some((p) => p.key === 'clinical-voice')).toBe(true);
    expect(discordance.pairwiseAlignment.some((p) => p.key === 'clinical-video')).toBe(true);
  });
});
