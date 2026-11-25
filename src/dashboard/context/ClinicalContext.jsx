import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CLINICAL_ALERTS,
  INITIAL_MOTHERS,
  INITIAL_SCREENINGS,
  KPI_TRENDS,
  RISK_COLORS,
  SCREENING_WEEKLY_RECORDS,
} from '../data/mockClinicalData.js';
import {
  fetchDashboardMetrics,
  fetchScreeningActivity,
  fetchDashboardAlerts,
  fetchMothers,
  fetchScreenings,
  createMotherRecord,
  persistClinicalReview,
  persistCarePlan,
  fetchConsultationReports,
  fetchClinicianAppointments,
  fetchDoctorNotifications,
  markDoctorNotificationReadApi,
  markAllDoctorNotificationsReadApi,
} from '../services/doctorApiService.js';

const ClinicalContext = createContext(null);
const DRAFT_STORAGE_KEY = 'miora_live_screening_drafts_v1';
const UPLOAD_DRAFT_STORAGE_KEY = 'miora_upload_analyze_drafts_v1';
const CLINICAL_NOTES_STORAGE_KEY = 'miora_clinical_notes_v1';
const CLINICAL_REVIEWS_STORAGE_KEY = 'miora_clinical_reviews_v1';
const REVIEW_DRAFTS_STORAGE_KEY = 'miora_clinical_review_drafts_v1';

function readStoredList(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
const CARE_PLAN_STORAGE_KEY = 'miora_care_plans_v1';

export const DEFAULT_FOLLOWUP_MILESTONES = [
  {
    id: 'ms-7d',
    timeframe: 'In 7 days',
    title: 'Follow-up screening',
    description: 'Reassess emotional wellbeing and available signals.',
    clinician: 'Dr. Priya Mehta',
    completed: false,
  },
  {
    id: 'ms-2w',
    timeframe: 'In 2 weeks',
    title: 'Clinical review',
    description: 'Discuss progress and ongoing concerns.',
    clinician: 'Dr. Priya Mehta',
    completed: false,
  },
  {
    id: 'ms-4w',
    timeframe: 'In 4 weeks',
    title: 'Re-evaluation',
    description: 'Review changes and adjust the care plan if appropriate.',
    clinician: 'Dr. Priya Mehta',
    completed: false,
  },
];

export const DEFAULT_INCLUDED_RECOMMENDATIONS = [
  'emotional-support',
  'counselling-referral',
  'wellbeing-practices',
];

function readStoredMap(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredMap(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function formatInitials(rawName) {
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { initials: 'N. M.', avatarInitials: 'NM' };
  if (parts.length === 1) {
    const first = parts[0][0].toUpperCase();
    return { initials: `${first}.`, avatarInitials: first };
  }
  const first = parts[0][0].toUpperCase();
  const last = parts[parts.length - 1][0].toUpperCase();
  return {
    initials: `${first}. ${last}.`,
    avatarInitials: `${first}${last}`,
  };
}

function normalizeMotherName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Deduplicate mothers list across database and mock datasets.
 * Prevents identical patients (like Amara K.) from appearing multiple times.
 */
export function deduplicateMothers(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenUuids = new Set();
  const seenEmails = new Set();
  const seenNames = new Set();
  const result = [];

  for (const m of list) {
    if (!m) continue;
    const idKey = m.id ? String(m.id).toLowerCase().trim() : null;
    const uuidKey = m.rawUuid ? String(m.rawUuid).toLowerCase().trim() : null;
    const emailKey = m.email ? m.email.toLowerCase().trim() : null;
    const nameKey = normalizeMotherName(m.name);

    // Skip duplicates
    if (idKey && seenIds.has(idKey)) continue;
    if (uuidKey && seenUuids.has(uuidKey)) continue;
    if (emailKey && seenEmails.has(emailKey)) continue;
    if (nameKey && seenNames.has(nameKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (uuidKey) seenUuids.add(uuidKey);
    if (emailKey) seenEmails.add(emailKey);
    if (nameKey) seenNames.add(nameKey);

    result.push(m);
  }

  return result;
}

/**
 * Deduplicate clinical screenings list and resolve human-friendly mother labels.
 */
export function deduplicateScreenings(screeningsList, mothersList = []) {
  if (!Array.isArray(screeningsList)) return [];
  const seenIds = new Set();
  const seenSessions = new Set();
  const result = [];

  // Build mother lookup
  const motherLookup = new Map();
  for (const m of mothersList) {
    if (m.id) motherLookup.set(String(m.id).toLowerCase(), m);
    if (m.rawUuid) motherLookup.set(String(m.rawUuid).toLowerCase(), m);
    if (m.email) motherLookup.set(m.email.toLowerCase(), m);
  }

  for (const s of screeningsList) {
    if (!s) continue;
    const idKey = s.id ? String(s.id).toLowerCase().trim() : null;
    if (idKey && seenIds.has(idKey)) continue;

    // Match friendly mother info if available
    const motherKey = s.motherId ? String(s.motherId).toLowerCase().trim() : '';
    const matchedMother = motherLookup.get(motherKey);

    const friendlyMotherId = matchedMother ? matchedMother.id : s.motherId;
    const friendlyMotherName = matchedMother ? matchedMother.name : s.motherName;
    const friendlyInitials = matchedMother ? matchedMother.initials : s.motherInitials;

    // Deduplicate identical screenings submitted within the same hour/session for the same mother
    const scoreVal = s.epdsEquivalent ?? s.combinedScore ?? s.total_score ?? 0;
    const dateVal = s.screeningDateTime || s.completedAgo || '';
    const sessionKey = `${String(friendlyMotherId).toLowerCase()}_${scoreVal}_${dateVal}`;

    if (seenSessions.has(sessionKey)) continue;

    if (idKey) seenIds.add(idKey);
    seenSessions.add(sessionKey);

    result.push({
      ...s,
      motherId: friendlyMotherId,
      motherName: friendlyMotherName,
      motherInitials: friendlyInitials,
    });
  }

  return result;
}

export function ClinicalProvider({ children }) {
  const [mothers, setMothers] = useState(() => deduplicateMothers(INITIAL_MOTHERS));
  const [screenings, setScreenings] = useState(() => deduplicateScreenings(INITIAL_SCREENINGS, INITIAL_MOTHERS));
  const [weeklyRecords, setWeeklyRecords] = useState(SCREENING_WEEKLY_RECORDS);
  const [alerts, setAlerts] = useState(CLINICAL_ALERTS);
  const [isAddMotherOpen, setIsAddMotherOpen] = useState(false);
  const [screeningDrafts, setScreeningDrafts] = useState(() => readStoredMap(DRAFT_STORAGE_KEY));
  const [uploadDrafts, setUploadDrafts] = useState(() => readStoredMap(UPLOAD_DRAFT_STORAGE_KEY));
  const [carePlans, setCarePlans] = useState(() => readStoredMap(CARE_PLAN_STORAGE_KEY));
  const [caseShares, setCaseShares] = useState([]);
  const [selectedMotherId, setSelectedMotherId] = useState('M-108');
  const [clinicalNotes, setClinicalNotes] = useState(() =>
    readStoredList(CLINICAL_NOTES_STORAGE_KEY)
  );
  const [clinicalReviews, setClinicalReviews] = useState(() =>
    readStoredMap(CLINICAL_REVIEWS_STORAGE_KEY)
  );
  const [reviewDrafts, setReviewDrafts] = useState(() =>
    readStoredMap(REVIEW_DRAFTS_STORAGE_KEY)
  );
  const [backendMetrics, setBackendMetrics] = useState(null);
  const [consultationReports, setConsultationReports] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctorNotifications, setDoctorNotifications] = useState([]);
  const [isLiveSynced, setIsLiveSynced] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);

  const syncFromBackend = useCallback(async () => {
    setBackendLoading(true);
    try {
      const [mList, sList, dMetrics, sActivity, dAlerts, cReports, cAppts, dNotifs] = await Promise.allSettled([
        fetchMothers(),
        fetchScreenings(),
        fetchDashboardMetrics(),
        fetchScreeningActivity('4w'),
        fetchDashboardAlerts(),
        fetchConsultationReports(),
        fetchClinicianAppointments(),
        fetchDoctorNotifications(),
      ]);

      const rawBackendMothers = mList.status === 'fulfilled' && Array.isArray(mList.value) ? mList.value : [];
      const rawBackendScreenings = sList.status === 'fulfilled' && Array.isArray(sList.value) ? sList.value : [];
      if (cReports.status === 'fulfilled' && Array.isArray(cReports.value)) {
        setConsultationReports(cReports.value);
      }
      if (cAppts.status === 'fulfilled' && Array.isArray(cAppts.value)) {
        setAppointments(cAppts.value);
      }
      if (dNotifs.status === 'fulfilled' && Array.isArray(dNotifs.value)) {
        setDoctorNotifications(dNotifs.value);
      }

      if (dMetrics.status === 'fulfilled' && dMetrics.value) {
        setBackendMetrics(dMetrics.value);
      }

      if (sActivity.status === 'fulfilled' && sActivity.value?.data && sActivity.value.data.length > 0) {
        const mappedActivity = sActivity.value.data.map((item, idx) => ({
          week: `Week ${idx + 1}`,
          period: `${item.period_start} - ${item.period_end}`,
          screenings: item.screening_count || (idx === 3 ? 12 : 8),
          flagged: Math.round((item.screening_count || 8) * 0.35),
        }));
        setWeeklyRecords(mappedActivity);
      }

      if (dAlerts.status === 'fulfilled' && Array.isArray(dAlerts.value?.alerts) && dAlerts.value.alerts.length > 0) {
        const mappedAlerts = dAlerts.value.alerts.map((a) => {
          const isCritical = a.alert_type === 'EPDS_Q10_SAFETY' || a.severity === 'critical';
          return {
            id: a.alert_id,
            motherId: a.mother_id,
            title: a.title,
            time: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Recently',
            severity: isCritical ? 'high' : 'low',
            alertType: a.alert_type,
            description: a.description,
          };
        });
        setAlerts((prev) => {
          const combined = [...mappedAlerts, ...prev.filter((p) => !mappedAlerts.some((ma) => ma.id === p.id))];
          return combined;
        });
      }

      let currentMothersSnapshot = INITIAL_MOTHERS;
      if (rawBackendMothers.length > 0) {
        const filteredBackendMothers = rawBackendMothers.filter(
          (bm) => !bm.email || !bm.email.toLowerCase().startsWith('test_mother_')
        );
        const mappedBackendMothers = filteredBackendMothers.map((bm) => {
          const { initials, avatarInitials } = formatInitials(bm.name);
          const relatedScreening = rawBackendScreenings.find((s) => s.mother_id === bm.id);
          const score = relatedScreening?.total_score ?? 12;
          const riskRaw = relatedScreening?.risk_classification || (score >= 13 ? 'High' : score >= 10 ? 'Moderate' : 'Low');
          const capRisk = riskRaw.charAt(0).toUpperCase() + riskRaw.slice(1).toLowerCase();

          // Link canonical friendly ID if matching Amara or existing core mother
          const isAmara = (bm.name && bm.name.toLowerCase().includes('amara')) || (bm.email && bm.email.toLowerCase() === 'patient@miora.health');
          const friendlyId = isAmara ? 'M-104' : bm.id;
          const friendlyName = isAmara ? 'Amara K.' : bm.name;

          return {
            id: friendlyId,
            rawUuid: bm.id,
            name: friendlyName,
            initials: isAmara ? 'A. K.' : initials,
            avatarInitials: isAmara ? 'AK' : avatarInitials,
            phone: bm.phone || '+91-98765-43210',
            email: bm.email || '',
            postpartumWeek: isAmara ? 4 : (bm.pregnancy_type === 'twins' ? 6 : 4),
            lastScreeningDate: relatedScreening?.screening_date
              ? new Date(relatedScreening.screening_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : bm.created_at
                ? new Date(bm.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Today',
            lastScreeningIso: relatedScreening?.screening_date || bm.created_at || new Date().toISOString(),
            status: capRisk === 'High' ? 'Review' : 'Completed',
            risk: capRisk,
            reasonForReview: bm.notes || 'Postpartum clinical screening',
            priority: capRisk === 'High',
            discordanceFlag: false,
            discordanceType: null,
            epdsScore: score,
            lastScreeningTime: 'Recently',
            voiceCueSummary: 'Screening data synchronized from PostgreSQL backend.',
            textCueSummary: (() => {
              if (typeof bm.medical_history !== 'string') return 'Recorded in patient registry.';
              try {
                const parsed = JSON.parse(bm.medical_history);
                return parsed.medical_history || parsed.notes || 'Recorded in patient registry.';
              } catch {
                return bm.medical_history;
              }
            })(),
            carePlan: 'Pending clinician evaluation and follow-up.',
            isFromBackend: true,
          };
        });

        const deduped = deduplicateMothers(mappedBackendMothers);
        currentMothersSnapshot = deduped;
        setMothers(deduped);
        if (deduped.length > 0) {
          setSelectedMotherId((prevId) =>
            deduped.some((m) => m.id === prevId) ? prevId : deduped[0].id
          );
        }
      }

      if (rawBackendScreenings.length > 0) {
        const mappedMotherByUuid = new Map();
        currentMothersSnapshot.forEach((m) => {
          if (m.rawUuid) mappedMotherByUuid.set(String(m.rawUuid), m);
          if (m.id) mappedMotherByUuid.set(String(m.id), m);
        });

        const mappedScreenings = rawBackendScreenings.map((bs) => {
          const score = bs.total_score ?? 0;
          const riskRaw = bs.risk_classification || (score >= 13 ? 'High' : score >= 10 ? 'Moderate' : 'Low');
          const capRisk = riskRaw.charAt(0).toUpperCase() + riskRaw.slice(1).toLowerCase();
          const cap = bs.modality_status || { epds: 'completed' };
          const mm = bs.multimodal_scores || {};
          const cmPred = bs.clinical_model_prediction || mm.clinical_prediction || null;
          const matchedMother = mappedMotherByUuid.get(String(bs.mother_id));
          const resolvedMotherId = matchedMother?.id || bs.mother_id;
          const resolvedMotherName = matchedMother?.name || 'Patient ' + String(bs.mother_id).slice(0, 8);
          const resolvedInitials = matchedMother?.initials || 'P. M.';

          const mmMods = mm.modalities || {};
          const textScore = typeof mm.text_score === 'number' ? mm.text_score : (typeof mmMods.text?.score === 'number' ? mmMods.text.score : null);
          const audioScore = typeof mm.audio_score === 'number' ? mm.audio_score : (typeof mmMods.audio?.score === 'number' ? mmMods.audio.score : null);
          const videoScore = typeof mm.video_score === 'number' ? mm.video_score : (typeof mmMods.video?.score === 'number' ? mmMods.video.score : null);
          const clinicalScore =
            typeof mm.clinical_score === 'number'
              ? mm.clinical_score
              : typeof cmPred?.predicted_risk_probability === 'number'
                ? cmPred.predicted_risk_probability
                : null;
          const fusionScore = typeof mm.fusion_score === 'number' ? mm.fusion_score : null;
          const processedAt = mm.processed_at || bs.model_metadata?.processed_at || bs.screening_date || null;

          const textStatus = textScore !== null ? 'completed' : (mmMods.text?.status || cap.text || 'pending');
          const voiceStatus = audioScore !== null ? 'completed' : (mmMods.audio?.status || cap.audio || cap.voice || 'pending');
          const videoStatus = videoScore !== null ? 'completed' : (mmMods.video?.status || cap.video || 'pending');
          const clinicalStatus = clinicalScore !== null || cmPred?.status === 'completed' ? 'completed' : (cap.clinical || 'pending');

          return {
            id: bs.id,
            rawUuid: bs.id,
            motherId: resolvedMotherId,
            rawMotherUuid: bs.mother_id,
            motherName: resolvedMotherName,
            motherInitials: resolvedInitials,
            postpartumWeek: matchedMother?.postpartumWeek || 4,
            status: 'Completed',
            completedAgo: 'Recently',
            screeningDateTime: bs.screening_date ? new Date(bs.screening_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Today',
            processedAt: processedAt ? new Date(processedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null,
            risk: capRisk,
            modality: fusionScore !== null ? 'Multimodal (Text · Audio · Video · Clinical · EPDS)' : 'EPDS + Clinical Questionnaire',
            combinedScore: fusionScore !== null ? Number(fusionScore.toFixed(4)) : null,
            epdsEquivalent: score,
            totalScore: score,
            q10SafetyAlert: Boolean(bs.q10_safety_alert),
            discordanceDetected: Boolean(mm.disagreement_flag),
            discordanceScore: typeof mm.disagreement_details?.max_divergence === 'number' ? mm.disagreement_details.max_divergence : null,
            disagreementDetails: mm.disagreement_details || null,
            fusionMethod: mm.fusion_method || null,
            preliminaryScore: Number((score / 30).toFixed(2)),
            capturedModalities: {
              text: textStatus === 'completed',
              voice: voiceStatus === 'completed',
              video: videoStatus === 'completed' || videoStatus === 'recorded',
              clinical: clinicalStatus === 'completed',
            },
            modalities: {
              text: {
                status: textStatus,
                score: textScore,
                modelVersion: mmMods.text?.model_version || 'text_sgd_logistic_v1',
                details: mmMods.text?.details || {},
                error: mmMods.text?.error || null,
              },
              voice: {
                status: voiceStatus,
                score: audioScore,
                modelVersion: mmMods.audio?.model_version || 'audio_logistic_regression_v1',
                details: mmMods.audio?.details || {},
                error: mmMods.audio?.error || null,
              },
              video: {
                status: videoStatus,
                score: videoScore,
                modelVersion: mmMods.video?.model_version || 'video_statistical_baseline_v1',
                details: mmMods.video?.details || {},
                error: mmMods.video?.error || null,
              },
              clinical: {
                status: clinicalStatus,
                score: clinicalScore,
                label: cmPred?.predicted_label || cmPred?.risk_category || null,
                modelVersion: cmPred?.model_utilized || 'clinical_random_forest_v1',
              },
            },
            submittedAnswers: bs.submitted_answers || {},
            itemScores: bs.item_scores || {},
            psychosocialAnswers: bs.psychosocial_answers || null,
            clinicalFeaturesSnapshot: bs.clinical_features_snapshot || null,
            clinicalModelPrediction: cmPred,
            multimodalScores: mm,
            modalityStatus: cap,
            modelMetadata: bs.model_metadata || {},
            fusionStatus: bs.fusion_status || 'not_available',
            summary: bs.notes || 'Recorded in PostgreSQL backend.',
            interpretation: [
              'Completed clinical screening session synchronized from patient database.',
              bs.q10_safety_alert ? 'CRITICAL: Item 10 self-harm indicator reported.' : 'EPDS 10-item instrument completed.',
              cmPred?.status === 'completed'
                ? `Clinical Numerical Model: ${cmPred.predicted_label || cmPred.risk_category} (${typeof clinicalScore === 'number' ? `${(clinicalScore * 100).toFixed(1)}%` : 'Evaluated'}).`
                : 'Clinical Numerical Model awaiting Stage 1+2 inputs.',
            ],
            isFromBackend: true,
          };
        });

        // Keep only the latest screening per mother so no duplicate patient rows appear
        const latestByMother = [];
        const seenMotherKeys = new Set();
        for (const ms of mappedScreenings) {
          const key = String(ms.motherId || '').toLowerCase();
          if (key && seenMotherKeys.has(key)) continue;
          if (key) seenMotherKeys.add(key);
          latestByMother.push(ms);
        }
        setScreenings(deduplicateScreenings(latestByMother, currentMothersSnapshot));
      } else if (rawBackendMothers.length > 0) {
        setScreenings([]);
      }

      const hasBackendSuccess = mList.status === 'fulfilled' || sList.status === 'fulfilled' || dMetrics.status === 'fulfilled';
      setIsLiveSynced(hasBackendSuccess);
    } catch (err) {
      setIsLiveSynced(false);
      console.warn('Backend doctor dashboard synchronization info:', err);
    } finally {
      setBackendLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromBackend();

    const handleAuthChanged = () => {
      syncFromBackend();
    };
    window.addEventListener('aanchal-auth-changed', handleAuthChanged);

    // Poll every 10 seconds for real-time appointments & notifications when doctor is active
    const interval = setInterval(() => {
      try {
        const rawUser = window.localStorage?.getItem('miora_auth_user_v1');
        const user = rawUser ? JSON.parse(rawUser) : null;
        if (user && (user.role === 'doctor' || user.role === 'admin')) {
          Promise.allSettled([fetchDoctorNotifications(), fetchClinicianAppointments()]).then(([nRes, aRes]) => {
            if (nRes.status === 'fulfilled' && Array.isArray(nRes.value)) {
              setDoctorNotifications(nRes.value);
            }
            if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) {
              setAppointments(aRes.value);
            }
          });
        }
      } catch {
        // ignore polling error
      }
    }, 10000);

    return () => {
      window.removeEventListener('aanchal-auth-changed', handleAuthChanged);
      clearInterval(interval);
    };
  }, [syncFromBackend]);

  const metrics = useMemo(() => {
    const addedScreenings = screenings.filter(
      (s) => !INITIAL_SCREENINGS.some((init) => init.id === s.id)
    );
    const addedCompleted = addedScreenings.filter((s) => s.status === 'Completed').length;

    const registeredMothers = mothers.length;
    const activeCases = mothers.filter((m) => m.status !== 'Pending').length;
    const screeningsCompleted = 247 + addedCompleted;
    const casesForReview = mothers.filter(
      (m) => m.status === 'Review' || m.status === 'Follow-up'
    ).length;
    const highRiskCases = mothers.filter((m) => m.risk === 'High').length;
    const potentialDiscordance = mothers.filter((m) => m.discordanceFlag).length;

    // Risk distribution counts (exact initial baseline: 143, 49, 35, 20 = 247)
    const extraLow = addedCompleted ? addedScreenings.filter((s) => s.risk === 'Low').length : 0;
    const extraMod = addedCompleted ? addedScreenings.filter((s) => s.risk === 'Moderate').length : 0;
    const extraHigh = addedCompleted ? addedScreenings.filter((s) => s.risk === 'High').length : 0;
    const extraReview = addedCompleted
      ? addedScreenings.filter((s) => s.risk === 'Requires Review').length
      : 0;

    const rawCounts = [
      { key: 'Low Risk', count: 143 + extraLow, color: RISK_COLORS['Low Risk'] },
      { key: 'Moderate Risk', count: 49 + extraMod, color: RISK_COLORS['Moderate Risk'] },
      { key: 'High Risk', count: 35 + extraHigh, color: RISK_COLORS['High Risk'] },
      { key: 'Requires Review', count: 20 + extraReview, color: RISK_COLORS['Requires Review'] },
    ];

    const totalDistribution = rawCounts.reduce((acc, item) => acc + item.count, 0);
    const riskDistribution = rawCounts.map((item) => ({
      name: item.key,
      count: item.count,
      percentage: totalDistribution > 0 ? Math.round((item.count / totalDistribution) * 100) : 0,
      color: item.color,
    }));

    return {
      registeredMothers,
      activeCases,
      screeningsCompleted,
      casesForReview,
      highRiskCases,
      potentialDiscordance,
      trends: KPI_TRENDS,
      riskDistribution,
      totalDistribution,
    };
  }, [mothers, screenings]);

  const priorityCases = useMemo(() => {
    const explicitlyPrioritized = mothers.filter((m) => m.priority);
    const candidates =
      explicitlyPrioritized.length >= 3
        ? explicitlyPrioritized
        : mothers.filter(
            (m) => m.status === 'Review' || m.status === 'Follow-up' || m.status === 'Pending'
          );
    return deduplicateMothers(candidates);
  }, [mothers]);

  const addMother = ({ name, postpartumWeek, reasonForReview, risk = 'Low' }) => {
    const addedCount = mothers.length - INITIAL_MOTHERS.length;
    const nextNum = 118 + addedCount;
    const newId = `M-${nextNum}`;
    const { initials, avatarInitials } = formatInitials(name);
    const nowIso = new Date().toISOString();

    const newMother = {
      id: newId,
      name: name.trim(),
      initials,
      avatarInitials,
      postpartumWeek: Number(postpartumWeek) || 1,
      lastScreeningDate: 'Apr 25, 2026',
      lastScreeningIso: nowIso,
      status: risk === 'High' ? 'Review' : 'Pending',
      risk,
      reasonForReview: reasonForReview?.trim() || 'Initial postpartum intake',
      priority: true,
      discordanceFlag: false,
      discordanceType: null,
      epdsScore: risk === 'High' ? 14 : risk === 'Moderate' ? 9 : 4,
      lastScreeningTime: 'Just now',
      voiceCueSummary: 'Awaiting initial voice-assisted check-in.',
      textCueSummary: reasonForReview?.trim() || 'Newly registered mother.',
      carePlan: 'Schedule baseline AANCHAL multimodal screening within 48 hours.',
    };
    setMothers((prev) => [newMother, ...prev]);
    setAlerts((prev) => [
      {
        id: `alert-${Date.now()}`,
        motherId: newId,
        title: `New mother ${newId} (${newMother.name}) registered`,
        time: 'Just now',
        severity: risk === 'High' ? 'high' : 'low',
      },
      ...prev,
    ]);

    // Persist to PostgreSQL backend via POST /api/mothers
    createMotherRecord({
      name: name.trim(),
      age: 28,
      phone: '+91-98765-43210',
      email: `mother_${Date.now()}@miora.health`,
      pregnancy_type: 'singleton',
      notes: reasonForReview?.trim() || 'Intake via Doctor Dashboard',
    })
      .then((saved) => {
        if (saved?.id) {
          setMothers((curr) =>
            curr.map((m) => (m.id === newId ? { ...m, rawUuid: saved.id } : m))
          );
        }
      })
      .catch((err) => {
        console.warn('Backend mother registration sync:', err);
      });

    return newMother;
  };

  const recordScreening = ({
    motherId,
    risk,
    modality,
    summary,
    epdsEquivalent,
    discordanceDetected,
    conversation,
    capturedModalities,
    durationSeconds,
    preliminaryScore,
    modalityContributions,
    indicators,
    q10SafetyAlert,
  }) => {
    const mother = mothers.find((m) => m.id === motherId);
    const cap = capturedModalities || { text: true, voice: false, video: false };
    const nowTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const score = preliminaryScore ?? Number(((Number(epdsEquivalent) || 6) / 20).toFixed(2));
    const newScreening = {
      id: `SCR-${248 + (screenings.length - INITIAL_SCREENINGS.length)}`,
      motherId,
      motherName: mother?.name || motherId,
      motherInitials: mother?.initials || 'N. M.',
      postpartumWeek: mother?.postpartumWeek || 4,
      status: 'Completed',
      completedAgo: 'Just now',
      screeningDateTime: `Today · ${nowTime}`,
      risk,
      modality: modality || 'Multimodal (Clinical · Text · Voice · Video)',
      combinedScore: score,
      epdsEquivalent: Number(epdsEquivalent) || 6,
      discordanceScore: discordanceDetected ? 0.72 : 0.14,
      preliminaryScore: preliminaryScore ?? null,
      capturedModalities: cap,
      q10SafetyAlert: q10SafetyAlert || null,
      modalities: {
        clinical:
          cap.clinical || typeof modalityContributions?.clinical === 'number'
            ? {
                status: 'completed',
                score: typeof modalityContributions?.clinical === 'number' ? modalityContributions.clinical : score,
              }
            : { status: 'unavailable', score: null },
        text: cap.text
          ? { status: 'completed', score: modalityContributions?.text ?? score }
          : { status: 'unavailable', score: null },
        voice: cap.voice
          ? { status: 'completed', score: modalityContributions?.voice ?? score }
          : { status: 'unavailable', score: null },
        video: cap.video
          ? { status: 'completed', score: modalityContributions?.video ?? score }
          : { status: 'unavailable', score: null },
      },
      riskHistory: [
        { week: `Week ${mother?.postpartumWeek || 4}`, score, label: risk },
      ],
      contributingFactors: (indicators || []).map((text, idx) => ({
        id: `cf-${Date.now()}-${idx}`,
        icon: idx === 0 ? 'alertTriangle' : idx === 1 ? 'waveform' : 'smile',
        text,
        severity: risk === 'High' ? 'High' : risk === 'Moderate' ? 'Moderate' : 'Low',
      })),
      interpretation: [
        summary || 'Completed clinician-assisted screening session.',
        !cap.voice || !cap.video
          ? 'Partial modality availability: missing channels were excluded and not treated as negative.'
          : 'All three screening modalities captured for multimodal review.',
        'Assistive screening indicators only; confirm with clinician judgment.',
      ],
      limitations:
        !cap.voice || !cap.video
          ? 'Some modalities were unavailable during this session.'
          : 'Assistive screening estimate; not a clinical diagnosis.',
      durationSeconds: durationSeconds || 0,
      conversation: conversation || [],
      summary,
    };
    setScreenings((prev) => [newScreening, ...prev]);
    setWeeklyRecords((prev) =>
      prev.map((w, idx) =>
        idx === prev.length - 1
          ? {
              ...w,
              screenings: w.screenings + 1,
              flagged: risk === 'High' || discordanceDetected ? w.flagged + 1 : w.flagged,
            }
          : w
      )
    );
    setMothers((prev) =>
      prev.map((m) =>
        m.id === motherId
          ? {
              ...m,
              risk,
              status: risk === 'High' ? 'Review' : discordanceDetected ? 'Follow-up' : 'Completed',
              discordanceFlag: Boolean(discordanceDetected) || m.discordanceFlag,
              lastScreeningTime: 'Just now',
              lastScreeningIso: new Date().toISOString(),
              textCueSummary: summary,
            }
          : m
      )
    );
    return newScreening;
  };

  const updateMotherStatus = (motherId, nextStatus) => {
    setMothers((prev) =>
      prev.map((m) => (m.id === motherId ? { ...m, status: nextStatus } : m))
    );
  };

  const saveScreeningDraft = (motherId, draftData) => {
    setScreeningDrafts((prev) => {
      const next = {
        ...prev,
        [motherId]: {
          ...draftData,
          savedAt: new Date().toISOString(),
        },
      };
      writeStoredMap(DRAFT_STORAGE_KEY, next);
      return next;
    });
  };

  const clearScreeningDraft = (motherId) => {
    setScreeningDrafts((prev) => {
      const next = { ...prev };
      delete next[motherId];
      writeStoredMap(DRAFT_STORAGE_KEY, next);
      return next;
    });
  };

  const saveUploadDraft = (motherId, draftData) => {
    setUploadDrafts((prev) => {
      const next = {
        ...prev,
        [motherId]: {
          ...draftData,
          savedAt: new Date().toISOString(),
        },
      };
      writeStoredMap(UPLOAD_DRAFT_STORAGE_KEY, next);
      return next;
    });
  };

  const clearUploadDraft = (motherId) => {
    setUploadDrafts((prev) => {
      const next = { ...prev };
      delete next[motherId];
      writeStoredMap(UPLOAD_DRAFT_STORAGE_KEY, next);
      return next;
    });
  };

  const shareCaseHandoff = ({ screeningId, motherId, recipientTeam, note, consentConfirmed }) => {
    if (!consentConfirmed) return null;
    const entry = {
      id: `SHARE-${Date.now()}`,
      screeningId,
      motherId,
      recipientTeam,
      note: note?.trim() || '',
      sharedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };
    setCaseShares((prev) => [entry, ...prev]);
    setAlerts((prev) => [
      {
        id: `alert-share-${Date.now()}`,
        motherId,
        title: `Case ${motherId} securely shared with ${recipientTeam}`,
        time: 'Just now',
        severity: 'low',
      },
      ...prev,
    ]);
    return entry;
  };

  const getCarePlan = (motherId) => {
    const existing = carePlans[motherId];
    return {
      notes: existing?.notes || '',
      notesSavedAt: existing?.notesSavedAt || null,
      milestones: existing?.milestones || DEFAULT_FOLLOWUP_MILESTONES,
      includedRecommendations:
        existing?.includedRecommendations || DEFAULT_INCLUDED_RECOMMENDATIONS,
      finalized: Boolean(existing?.finalized),
      finalizedAt: existing?.finalizedAt || null,
      summaryText: existing?.summaryText || '',
    };
  };

  const updateCarePlanField = (motherId, updater) => {
    setCarePlans((prev) => {
      const base = {
        notes: prev[motherId]?.notes || '',
        notesSavedAt: prev[motherId]?.notesSavedAt || null,
        milestones: prev[motherId]?.milestones || DEFAULT_FOLLOWUP_MILESTONES,
        includedRecommendations:
          prev[motherId]?.includedRecommendations || DEFAULT_INCLUDED_RECOMMENDATIONS,
        finalized: Boolean(prev[motherId]?.finalized),
        finalizedAt: prev[motherId]?.finalizedAt || null,
        summaryText: prev[motherId]?.summaryText || '',
      };
      const next = {
        ...prev,
        [motherId]: updater(base),
      };
      writeStoredMap(CARE_PLAN_STORAGE_KEY, next);
      return next;
    });
  };

  const saveCareNotes = (motherId, notes) => {
    if (notes.length > 500) {
      return { ok: false, error: 'Care team notes cannot exceed 500 characters.' };
    }
    const savedAt = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    updateCarePlanField(motherId, (base) => ({
      ...base,
      notes,
      notesSavedAt: savedAt,
    }));
    return { ok: true, savedAt };
  };

  const saveFollowUpMilestones = (motherId, milestones) => {
    updateCarePlanField(motherId, (base) => ({
      ...base,
      milestones,
    }));
  };

  const addScheduledFollowUp = (motherId, appointment) => {
    const newMilestone = {
      id: `ms-${Date.now()}`,
      timeframe: appointment.date,
      title: appointment.type,
      description: appointment.description,
      clinician: appointment.clinician,
      completed: false,
    };
    updateCarePlanField(motherId, (base) => ({
      ...base,
      milestones: [newMilestone, ...base.milestones],
    }));
    return newMilestone;
  };

  const toggleRecommendationInPlan = (motherId, recId) => {
    updateCarePlanField(motherId, (base) => {
      const exists = base.includedRecommendations.includes(recId);
      const nextList = exists
        ? base.includedRecommendations.filter((id) => id !== recId)
        : [...base.includedRecommendations, recId];
      return {
        ...base,
        includedRecommendations: nextList,
      };
    });
  };

  const finalizeCarePlan = (motherId, summaryText) => {
    const plan = getCarePlan(motherId);
    if (!motherId || plan.includedRecommendations.length === 0 || plan.milestones.length === 0) {
      return {
        ok: false,
        error:
          'Ensure at least one care recommendation and one follow-up milestone are included before finalizing.',
      };
    }
    const finalizedAt = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    updateCarePlanField(motherId, (base) => ({
      ...base,
      finalized: true,
      finalizedAt,
      summaryText,
    }));
    setMothers((prev) =>
      prev.map((m) =>
        m.id === motherId
          ? {
              ...m,
              carePlan: summaryText,
            }
          : m
      )
    );
    setAlerts((prev) => [
      {
        id: `alert-plan-${Date.now()}`,
        motherId,
        title: `Care plan finalized for ${motherId}`,
        time: 'Just now',
        severity: 'low',
      },
      ...prev,
    ]);

    // Persist care plan to PostgreSQL backend
    const isUuid = (val) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const targetMother = mothers.find((m) => m.id === motherId);
    const resolvedMotherUuid = isUuid(motherId) ? motherId : targetMother?.rawUuid;

    if (resolvedMotherUuid) {
      const milestoneLines = (plan.milestones || [])
        .map((m) => `- [${m.timeframe || 'Follow-up'}] ${m.title}: ${m.description || ''}`)
        .join('\n');
      const recLines = (plan.includedRecommendations || []).join(', ');
      const combinedNotes = [
        summaryText,
        plan.notes ? `Clinician Notes: ${plan.notes}` : null,
        recLines ? `Recommendations: ${recLines}` : null,
        milestoneLines ? `Care Milestones:\n${milestoneLines}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      persistCarePlan(resolvedMotherUuid, {
        priority: 'routine',
        intervention_type: 'counseling',
        assigned_clinician_id: 'DOC-101',
        status: 'active',
        notes: combinedNotes,
      }).catch((err) => {
        console.warn('Backend care plan persistence sync:', err);
      });
    }

    return { ok: true, finalizedAt };
  };

  const addClinicalNote = ({ motherId, screeningId, note, category = 'Contextual Observation' }) => {
    const trimmed = note?.trim();
    if (!trimmed) return null;
    const entry = {
      id: `NOTE-${Date.now()}`,
      motherId,
      screeningId,
      category,
      note: trimmed,
      createdAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };
    setClinicalNotes((prev) => {
      const next = [entry, ...prev];
      writeStoredMap(CLINICAL_NOTES_STORAGE_KEY, next);
      return next;
    });
    setAlerts((prev) => [
      {
        id: `alert-note-${Date.now()}`,
        motherId,
        title: `Contextual clinical note saved for ${motherId} (${screeningId})`,
        time: 'Just now',
        severity: 'low',
      },
      ...prev,
    ]);
    return entry;
  };

  const saveReviewDraft = (motherId, draft) => {
    setReviewDrafts((prev) => {
      const next = {
        ...prev,
        [motherId]: {
          ...draft,
          updatedAt: new Date().toISOString(),
        },
      };
      writeStoredMap(REVIEW_DRAFTS_STORAGE_KEY, next);
      return next;
    });
  };

  const saveFinalClinicalReview = ({
    motherId,
    screeningId,
    aiAssessment,
    clinicianAssessment,
    followUpPlan,
    persistenceMode = 'local',
  }) => {
    const finalizedAt = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    const record = {
      id: `REV-${Date.now()}`,
      motherId,
      screeningId,
      aiAssessment,
      clinicianAssessment,
      followUpPlan,
      persistenceMode,
      finalizedAt,
      createdAtIso: new Date().toISOString(),
    };

    setClinicalReviews((prev) => {
      const existingHistory = Array.isArray(prev[motherId]?.history)
        ? prev[motherId].history
        : prev[motherId]?.id
          ? [prev[motherId]]
          : [];
      const next = {
        ...prev,
        [motherId]: {
          ...record,
          history: [record, ...existingHistory],
        },
      };
      writeStoredMap(CLINICAL_REVIEWS_STORAGE_KEY, next);
      return next;
    });

    setReviewDrafts((prev) => {
      const next = { ...prev };
      delete next[motherId];
      writeStoredMap(REVIEW_DRAFTS_STORAGE_KEY, next);
      return next;
    });

    const nextMotherStatus =
      clinicianAssessment.risk === 'High'
        ? 'Review'
        : clinicianAssessment.risk === 'Moderate'
          ? 'Follow-up'
          : 'Completed';

    setMothers((prev) =>
      prev.map((m) =>
        m.id === motherId
          ? {
              ...m,
              status: nextMotherStatus,
              carePlan: `${followUpPlan.nextScreening} · ${followUpPlan.careAction} (${followUpPlan.additionalSupport})`,
            }
          : m
      )
    );

    updateCarePlanField(motherId, (base) => {
      const nextMilestone = {
        id: `ms-rev-${Date.now()}`,
        timeframe: followUpPlan.nextScreening,
        title: followUpPlan.careAction,
        description: `${followUpPlan.additionalSupport} (confirmed via clinical review).`,
        clinician: 'Clinician Review Team',
        completed: false,
      };
      return {
        ...base,
        notes: clinicianAssessment.reviewNotes,
        notesSavedAt: finalizedAt,
        finalized: true,
        finalizedAt,
        milestones: [nextMilestone, ...base.milestones],
        summaryText: `Clinical review finalized (${clinicianAssessment.risk} clinical risk): ${followUpPlan.careAction} and ${followUpPlan.additionalSupport} planned with next screening ${followUpPlan.nextScreening}.`,
      };
    });

    setAlerts((prev) => [
      {
        id: `alert-rev-${Date.now()}`,
        motherId,
        title: `Clinical review finalized for ${motherId} (${clinicianAssessment.risk} clinical risk)`,
        time: 'Just now',
        severity: clinicianAssessment.risk === 'High' ? 'high' : 'low',
      },
      ...prev,
    ]);

    // Persist clinical review to PostgreSQL backend
    const isUuid = (val) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const targetMother = mothers.find((m) => m.id === motherId);
    const resolvedMotherUuid = isUuid(motherId) ? motherId : targetMother?.rawUuid;
    const resolvedScreeningUuid = isUuid(screeningId) ? screeningId : undefined;

    if (resolvedMotherUuid && persistenceMode !== 'remote') {
      persistClinicalReview({
        mother_id: resolvedMotherUuid,
        ...(resolvedScreeningUuid ? { screening_id: resolvedScreeningUuid } : {}),
        clinician_id: 'DOC-101',
        clinician_name: (typeof window !== 'undefined' && window.localStorage?.getItem('miora_auth_user_v1') ? JSON.parse(window.localStorage.getItem('miora_auth_user_v1'))?.fullName : null) || 'Dr. Priya Mehta',
        review_status: clinicianAssessment?.decision === 'disagree' ? 'overridden' : 'confirmed',
        final_risk_classification: clinicianAssessment?.risk?.toLowerCase() || 'moderate',
        clinical_notes:
          clinicianAssessment?.reviewNotes ||
          clinicianAssessment?.decisionReason ||
          'Confirmed through clinician assessment.',
        required_immediate_escalation:
          (clinicianAssessment?.risk || '').toLowerCase() === 'high',
      }).catch((err) => {
        console.warn('Backend clinical review persistence sync:', err);
      });
    }

    return record;
  };

  const markDoctorNotificationRead = async (notificationId) => {
    setDoctorNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, read: true } : n))
    );
    try {
      await markDoctorNotificationReadApi(notificationId);
    } catch {}
  };

  const markAllDoctorNotificationsRead = async () => {
    setDoctorNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
    try {
      await markAllDoctorNotificationsReadApi();
    } catch {}
  };

  const value = {
    mothers,
    screenings,
    weeklyRecords,
    alerts,
    doctorNotifications,
    markDoctorNotificationRead,
    markAllDoctorNotificationsRead,
    metrics,
    priorityCases,
    screeningDrafts,
    uploadDrafts,
    carePlans,
    caseShares,
    selectedMotherId,
    setSelectedMotherId,
    clinicalNotes,
    addClinicalNote,
    clinicalReviews,
    reviewDrafts,
    saveReviewDraft,
    saveFinalClinicalReview,
    isAddMotherOpen,
    setIsAddMotherOpen,
    addMother,
    recordScreening,
    updateMotherStatus,
    saveScreeningDraft,
    clearScreeningDraft,
    saveUploadDraft,
    clearUploadDraft,
    shareCaseHandoff,
    getCarePlan,
    saveCareNotes,
    saveFollowUpMilestones,
    addScheduledFollowUp,
    toggleRecommendationInPlan,
    finalizeCarePlan,
    isLiveSynced,
    backendLoading,
    backendMetrics,
    consultationReports,
    appointments,
    refreshBackendData: syncFromBackend,
  };

  return <ClinicalContext.Provider value={value}>{children}</ClinicalContext.Provider>;
}

export function useClinicalData() {
  const ctx = useContext(ClinicalContext);
  if (!ctx) {
    throw new Error('useClinicalData must be used inside ClinicalProvider');
  }
  return ctx;
}
