/**
 * Baseline clinician profile and deterministic clinical dataset for MIORA Dashboard.
 * Live records from PostgreSQL are synchronized on mount in ClinicalContext.
 */

export const CLINICIAN_PROFILE = {
  name: 'Dr. Elena Rostova',
  initials: 'DR',
  role: 'Lead Perinatal Psychiatrist',
  clinic: 'MIORA Maternal Care Center',
};

export const KPI_TRENDS = {
  registeredMothers: '+8.4%',
  screeningsCompleted: '+12.1%',
  casesForReview: '4 urgent',
  potentialDiscordance: '+2 this week',
};

export const RISK_COLORS = {
  'Low Risk': '#2f9e69',
  'Moderate Risk': '#d9822b',
  'High Risk': '#c73566',
  'Requires Review': '#7c5cbf',
};

export const SCREENING_WEEKLY_RECORDS = [
  { week: 'Week 1', dateRange: 'Feb 1 - Feb 7', screenings: 28, flagged: 5 },
  { week: 'Week 2', dateRange: 'Feb 8 - Feb 14', screenings: 32, flagged: 6 },
  { week: 'Week 3', dateRange: 'Feb 15 - Feb 21', screenings: 35, flagged: 7 },
  { week: 'Week 4', dateRange: 'Feb 22 - Feb 28', screenings: 38, flagged: 8 },
  { week: 'Week 5', dateRange: 'Mar 1 - Mar 7', screenings: 41, flagged: 8 },
  { week: 'Week 6', dateRange: 'Mar 8 - Mar 14', screenings: 44, flagged: 9 },
  { week: 'Week 7', dateRange: 'Mar 15 - Mar 21', screenings: 47, flagged: 10 },
  { week: 'Week 8', dateRange: 'Mar 22 - Mar 28', screenings: 50, flagged: 11 },
  { week: 'Week 9', dateRange: 'Mar 29 - Apr 4', screenings: 46, flagged: 9 },
  { week: 'Week 10', dateRange: 'Apr 5 - Apr 11', screenings: 54, flagged: 12 },
  { week: 'Week 11', dateRange: 'Apr 12 - Apr 18', screenings: 60, flagged: 14 },
  { week: 'Week 12', dateRange: 'Apr 19 - Apr 25', screenings: 66, flagged: 15 },
];

export const CLINICAL_ALERTS = [
  {
    id: 'alert-104',
    motherId: 'M-104',
    title: 'M-104 flagged for elevated distress cues',
    time: '12 min ago',
    severity: 'high',
  },
  {
    id: 'alert-108',
    motherId: 'M-108',
    title: 'M-108 potential voice-text mismatch detected',
    time: '28 min ago',
    severity: 'high',
  },
  {
    id: 'alert-112',
    motherId: 'M-112',
    title: 'M-112 incomplete screening session awaiting follow-up',
    time: '1 hr ago',
    severity: 'low',
  },
];

const CORE_MOTHERS = [
  {
    id: 'M-104',
    name: 'Amara K.',
    initials: 'A. S.',
    avatarInitials: 'AS',
    postpartumWeek: 4,
    lastScreeningDate: 'Apr 17, 2026',
    lastScreeningIso: '2026-04-17T10:15:00.000Z',
    status: 'Review',
    risk: 'High',
    reasonForReview: 'Elevated distress cues',
    priority: true,
    discordanceFlag: true,
    discordanceType: 'Cross-modal divergence',
    epdsScore: 17,
    lastScreeningTime: '12 min ago',
    voiceCueSummary: 'Reduced pitch range and longer pause duration during sleep questions.',
    textCueSummary: 'Reported persistent exhaustion and difficulty resting.',
    carePlan: 'Priority perinatal psychiatry review within 48 hours.',
  },
  {
    id: 'M-108',
    name: 'Nadia R.',
    initials: 'N. R.',
    avatarInitials: 'NR',
    postpartumWeek: 2,
    lastScreeningDate: 'Apr 16, 2026',
    lastScreeningIso: '2026-04-16T10:24:00.000Z',
    status: 'Review',
    risk: 'Moderate',
    reasonForReview: 'Voice-text mismatch',
    priority: true,
    discordanceFlag: true,
    discordanceType: 'Voice-text mismatch',
    epdsScore: 11,
    lastScreeningTime: '28 min ago',
    voiceCueSummary: 'Higher vocal strain and lower energy despite calm self-report.',
    textCueSummary: 'Elevated negative sentiment in text responses.',
    carePlan: 'Schedule supportive clinician check-in within 7 days.',
  },
  {
    id: 'M-112',
    name: 'Priya M.',
    initials: 'P. M.',
    avatarInitials: 'PM',
    postpartumWeek: 5,
    lastScreeningDate: 'Apr 15, 2026',
    lastScreeningIso: '2026-04-15T15:20:00.000Z',
    status: 'Pending',
    risk: 'Pending',
    reasonForReview: 'Incomplete screening',
    priority: true,
    discordanceFlag: false,
    discordanceType: null,
    epdsScore: 9,
    lastScreeningTime: '1 hr ago',
    voiceCueSummary: 'Voice modality unavailable; follow-up session requested.',
    textCueSummary: 'Completed initial text check-in; awaiting remaining modalities.',
    carePlan: 'Follow up to complete remaining screening modalities.',
  },
  {
    id: 'M-115',
    name: 'Divya M.',
    initials: 'D. M.',
    avatarInitials: 'DM',
    postpartumWeek: 8,
    lastScreeningDate: 'Apr 15, 2026',
    lastScreeningIso: '2026-04-15T11:00:00.000Z',
    status: 'Completed',
    risk: 'Low',
    reasonForReview: 'Routine postpartum check-in',
    priority: false,
    discordanceFlag: false,
    discordanceType: null,
    epdsScore: 4,
    lastScreeningTime: '36 min ago',
    voiceCueSummary: 'Warm prosody and steady speech tempo.',
    textCueSummary: 'Positive adjustment and strong family support.',
    carePlan: 'Continue routine postpartum wellness cadence.',
  },
  {
    id: 'M-117',
    name: 'Sana K.',
    initials: 'S. K.',
    avatarInitials: 'SK',
    postpartumWeek: 4,
    lastScreeningDate: 'Apr 14, 2026',
    lastScreeningIso: '2026-04-14T09:50:00.000Z',
    status: 'Completed',
    risk: 'Low',
    reasonForReview: 'Routine postpartum check-in',
    priority: false,
    discordanceFlag: false,
    discordanceType: null,
    epdsScore: 3,
    lastScreeningTime: '10 min ago',
    voiceCueSummary: 'Expressive vocal tone with balanced pacing.',
    textCueSummary: 'Feels well-supported at home.',
    carePlan: 'Routine postpartum check-in.',
  },
  {
    id: 'M-120',
    name: 'Meera N.',
    initials: 'M. N.',
    avatarInitials: 'MN',
    postpartumWeek: 10,
    lastScreeningDate: 'Apr 14, 2026',
    lastScreeningIso: '2026-04-14T08:15:00.000Z',
    status: 'Follow-up',
    risk: 'High',
    reasonForReview: 'Elevated postpartum stress',
    priority: false,
    discordanceFlag: true,
    discordanceType: 'Audio-facial divergence',
    epdsScore: 15,
    lastScreeningTime: '2 hr ago',
    voiceCueSummary: 'Flat affect noted during follow-up screening.',
    textCueSummary: 'Reported persistent anxiety and sleep disruption.',
    carePlan: 'Follow-up consultation scheduled with care coordinator.',
  },
  {
    id: 'M-116',
    name: 'Kavya S.',
    initials: 'K. S.',
    avatarInitials: 'KS',
    postpartumWeek: 6,
    lastScreeningDate: 'Apr 13, 2026',
    lastScreeningIso: '2026-04-13T10:30:00.000Z',
    status: 'Completed',
    risk: 'Low',
    reasonForReview: 'Routine postpartum check-in',
    priority: false,
    discordanceFlag: false,
    discordanceType: null,
    epdsScore: 5,
    lastScreeningTime: '24 min ago',
    voiceCueSummary: 'Consistent vocal energy and natural inflection.',
    textCueSummary: 'Normal sleep fatigue; stable mood.',
    carePlan: 'Routine 4-week follow-up.',
  },
];

// Generate remaining 321 cohort records so exact clinical baseline KPIs hold:
// Total Mothers: 328 | Active Cases (not Pending): 247 | Cases for Review / Follow-ups Due: 18
// High-Risk Cases: 7 | Potential Discordance: 7
const GENERATED_MOTHERS = Array.from({ length: 321 }, (_, idx) => {
  const num = 121 + idx;
  const id = `M-${num}`;
  const isHighRisk = idx < 5; // +2 core (M-104, M-120) = 7 High Risk
  const isReviewOrFollowup = idx < 15; // +3 core (M-104, M-108, M-120) = 18 Cases for Review
  const isPending = idx >= 15 && idx < 95; // +1 core (M-112) = 81 Pending => 328 - 81 = 247 Active
  const isDiscordant = idx < 4; // +3 core (M-104, M-108, M-120) = 7 Potential Discordance

  const status = isReviewOrFollowup
    ? idx % 2 === 0
      ? 'Review'
      : 'Follow-up'
    : isPending
      ? 'Pending'
      : 'Completed';

  const risk = isHighRisk
    ? 'High'
    : isReviewOrFollowup
      ? 'Moderate'
      : isPending
        ? 'Requires Review'
        : idx % 5 === 0
          ? 'Moderate'
          : 'Low';

  const week = isHighRisk ? (idx % 6) + 2 : (idx % 12) + 1;
  const day = String(Math.max(1, 12 - (idx % 11))).padStart(2, '0');
  const firstLetter = String.fromCharCode(65 + (idx % 26));
  const lastLetter = String.fromCharCode(65 + ((idx * 7 + 3) % 26));

  return {
    id,
    name: `Mother ${num}`,
    initials: `${firstLetter}. ${lastLetter}.`,
    avatarInitials: `${firstLetter}${lastLetter}`,
    postpartumWeek: week,
    lastScreeningDate: `Apr ${day}, 2026`,
    lastScreeningIso: `2026-04-${day}T09:00:00.000Z`,
    status,
    risk,
    reasonForReview: isHighRisk
      ? 'Elevated distress cues'
      : isReviewOrFollowup
        ? 'Scheduled follow-up check-in'
        : isPending
          ? 'Pending baseline check-in'
          : 'Routine postpartum check-in',
    priority: false,
    discordanceFlag: isDiscordant,
    discordanceType: isDiscordant ? 'Cross-modal divergence' : null,
    epdsScore: isHighRisk ? 15 : risk === 'Moderate' ? 10 : 4,
    lastScreeningTime: 'Earlier this week',
    voiceCueSummary: 'Baseline acoustic profile logged.',
    textCueSummary: 'Routine postpartum intake recorded.',
    carePlan: 'Standard maternal care follow-up.',
  };
});

export const INITIAL_MOTHERS = [...CORE_MOTHERS, ...GENERATED_MOTHERS];

export const INITIAL_SCREENINGS = [
  {
    id: 'SCR-247',
    motherId: 'M-117',
    motherName: 'Sana K.',
    motherInitials: 'S. K.',
    postpartumWeek: 4,
    status: 'Completed',
    completedAgo: '10 min ago',
    screeningDateTime: 'Apr 14, 2026 · 09:50 AM',
    risk: 'Low',
    modality: 'Multimodal (Text · Voice · Video)',
    combinedScore: 0.18,
    epdsEquivalent: 3,
    discordanceScore: 0.08,
    preliminaryScore: 0.18,
    capturedModalities: { text: true, voice: true, video: true },
    modalities: {
      text: { status: 'completed', score: 0.14 },
      voice: { status: 'completed', score: 0.21 },
      video: { status: 'completed', score: 0.19 },
    },
    riskHistory: [
      { week: 'W1', score: 0.26, label: 'Low' },
      { week: 'W2', score: 0.22, label: 'Low' },
      { week: 'W3', score: 0.20, label: 'Low' },
      { week: 'W4', score: 0.18, label: 'Low' },
    ],
    contributingFactors: [
      { id: 'f-117-1', icon: 'fileText', text: 'Positive maternal mood self-report', severity: 'Low' },
      { id: 'f-117-2', icon: 'mic', text: 'Steady vocal prosody and energy', severity: 'Low' },
    ],
    summary: 'Low distress cues across text, acoustic, and facial modalities.',
    interpretation: [
      'Consistent alignment across self-reported EPDS and behavioral cues.',
      'Routine postpartum wellness follow-up recommended.',
    ],
  },
  {
    id: 'SCR-246',
    motherId: 'M-116',
    motherName: 'Kavya S.',
    motherInitials: 'K. S.',
    postpartumWeek: 6,
    status: 'Completed',
    completedAgo: '24 min ago',
    screeningDateTime: 'Apr 13, 2026 · 10:30 AM',
    risk: 'Low',
    modality: 'Multimodal (Text · Voice)',
    combinedScore: 0.24,
    epdsEquivalent: 5,
    discordanceScore: 0.11,
    preliminaryScore: 0.24,
    capturedModalities: { text: true, voice: true, video: false },
    modalities: {
      text: { status: 'completed', score: 0.22 },
      voice: { status: 'completed', score: 0.26 },
      video: { status: 'unavailable', score: null },
    },
    riskHistory: [
      { week: 'W3', score: 0.30, label: 'Low' },
      { week: 'W4', score: 0.28, label: 'Low' },
      { week: 'W5', score: 0.25, label: 'Low' },
      { week: 'W6', score: 0.24, label: 'Low' },
    ],
    contributingFactors: [
      { id: 'f-116-1', icon: 'fileText', text: 'Mild expected newborn sleep fatigue', severity: 'Low' },
    ],
    summary: 'Stable mood indicators with mild expected newborn sleep fatigue.',
    interpretation: [
      'Self-report and acoustic prosody are well aligned.',
      'Continue standard postpartum check-ins.',
    ],
  },
  {
    id: 'SCR-245',
    motherId: 'M-115',
    motherName: 'Divya M.',
    motherInitials: 'D. M.',
    postpartumWeek: 8,
    status: 'Completed',
    completedAgo: '36 min ago',
    screeningDateTime: 'Apr 15, 2026 · 11:00 AM',
    risk: 'Low',
    modality: 'Text Only',
    combinedScore: 0.20,
    epdsEquivalent: 4,
    discordanceScore: 0.06,
    preliminaryScore: 0.20,
    capturedModalities: { text: true, voice: false, video: false },
    modalities: {
      text: { status: 'completed', score: 0.20 },
      voice: { status: 'unavailable', score: null },
      video: { status: 'unavailable', score: null },
    },
    riskHistory: [
      { week: 'W5', score: 0.25, label: 'Low' },
      { week: 'W6', score: 0.23, label: 'Low' },
      { week: 'W7', score: 0.21, label: 'Low' },
      { week: 'W8', score: 0.20, label: 'Low' },
    ],
    contributingFactors: [
      { id: 'f-115-1', icon: 'fileText', text: 'Low self-reported distress indicators', severity: 'Low' },
    ],
    summary: 'Positive postpartum recovery and low screening risk.',
    interpretation: ['EPDS total within low-risk range (0-9).'],
  },
  {
    id: 'SCR-243',
    motherId: 'M-108',
    motherName: 'Nadia R.',
    motherInitials: 'N. R.',
    postpartumWeek: 2,
    status: 'Completed',
    completedAgo: '28 min ago',
    screeningDateTime: 'Apr 16, 2026 · 10:24 AM',
    risk: 'Moderate',
    modality: 'Multimodal (Text · Voice · Video)',
    combinedScore: 0.62,
    epdsEquivalent: 11,
    discordanceScore: 0.81,
    preliminaryScore: 0.62,
    capturedModalities: { text: true, voice: true, video: true },
    modalities: {
      text: { status: 'completed', score: 0.58 },
      voice: { status: 'completed', score: 0.66 },
      video: { status: 'completed', score: 0.60 },
    },
    riskHistory: [
      { week: 'W1', score: 0.48, label: 'Moderate' },
      { week: 'W2 (Early)', score: 0.54, label: 'Moderate' },
      { week: 'W2 (Mid)', score: 0.58, label: 'Moderate' },
      { week: 'W2 (Current)', score: 0.62, label: 'Moderate' },
    ],
    contributingFactors: [
      { id: 'f-108-1', icon: 'fileText', text: 'Elevated negative sentiment in text', severity: 'Moderate' },
      { id: 'f-108-2', icon: 'mic', text: 'Higher vocal strain and lower energy', severity: 'Moderate' },
      { id: 'f-108-3', icon: 'video', text: 'Reduced positive facial expressiveness', severity: 'Moderate' },
    ],
    summary: 'Moderate risk with notable cross-modal variation between acoustic and written cues.',
    interpretation: [
      'Voice and facial signals reflect slightly elevated strain relative to written responses.',
      'Recommended for clinician follow-up and empathetic check-in within 7 days.',
    ],
  },
  {
    id: 'SCR-244',
    motherId: 'M-104',
    motherName: 'Amara K.',
    motherInitials: 'A. S.',
    postpartumWeek: 4,
    status: 'Completed',
    completedAgo: '12 min ago',
    screeningDateTime: 'Apr 17, 2026 · 10:15 AM',
    risk: 'High',
    modality: 'Multimodal (Text · Voice · Video)',
    combinedScore: 0.78,
    epdsEquivalent: 17,
    discordanceScore: 0.74,
    preliminaryScore: 0.78,
    capturedModalities: { text: true, voice: true, video: true },
    modalities: {
      text: { status: 'completed', score: 0.72 },
      voice: { status: 'completed', score: 0.82 },
      video: { status: 'completed', score: 0.76 },
    },
    riskHistory: [
      { week: 'W1', score: 0.56, label: 'Moderate' },
      { week: 'W2', score: 0.64, label: 'Moderate' },
      { week: 'W3', score: 0.72, label: 'High' },
      { week: 'W4', score: 0.78, label: 'High' },
    ],
    contributingFactors: [
      { id: 'f-104-1', icon: 'fileText', text: 'Elevated emotional fatigue in text', severity: 'High' },
      { id: 'f-104-2', icon: 'mic', text: 'Reduced vocal energy and prosody range', severity: 'High' },
      { id: 'f-104-3', icon: 'video', text: 'Sustained low facial affect cues', severity: 'High' },
    ],
    summary: 'Elevated distress indicators across all captured modalities.',
    interpretation: [
      'EPDS score exceeds clinical threshold (>=13) with corroborating acoustic and visual signals.',
      'Prompt clinician review and support referral advised.',
    ],
  },
  {
    id: 'SCR-241',
    motherId: 'M-112',
    motherName: 'Priya M.',
    motherInitials: 'P. M.',
    postpartumWeek: 5,
    status: 'Pending',
    completedAgo: '1 hr ago',
    screeningDateTime: 'Apr 15, 2026 · 03:20 PM',
    risk: 'Requires Review',
    modality: 'Text Only (Partial)',
    combinedScore: null,
    epdsEquivalent: 9,
    discordanceScore: null,
    preliminaryScore: null,
    capturedModalities: { text: true, voice: false, video: false },
    modalities: {
      text: { status: 'completed', score: 0.52 },
      voice: { status: 'unavailable', score: null },
      video: { status: 'unavailable', score: null },
    },
    riskHistory: [],
    contributingFactors: [],
    summary: 'Partial screening captured; voice and video modalities pending completion.',
    interpretation: [
      'Only written self-report cues were captured during this session.',
      'Complete additional screening modalities before finalizing multimodal assessment.',
    ],
  },
];
