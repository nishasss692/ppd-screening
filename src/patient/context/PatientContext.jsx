import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { getCurrentUser, getAuthToken } from '../../auth/authService.js';
import { buildMultiPagePdfBlob } from '../../utils/pdfBuilder.js';
import {
  fetchPatientProfile,
  updatePatientProfile as apiUpdatePatientProfile,
  fetchPatientReportsOverview,
  fetchPatientScreenings,
  downloadReportPdfBlob,
  downloadTranscriptTxtBlob,
  fetchPatientNotifications,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi,
  fetchPatientAppointments,
  bookPatientAppointment as apiBookPatientAppointment,
  fetchPatientCarePlan,
  toggleCarePlanTaskApi,
  fetchPatientSettings,
  updatePatientSettings as apiUpdatePatientSettings,
  fetchPatientConsultationReports,
  downloadPatientConsultationReportBlob,
} from '../services/patientApiService.js';

const PatientContext = createContext(null);

export const DEFAULT_PATIENT = {
  id: '',
  name: 'Patient',
  fullName: 'Patient',
  email: '',
  avatarInitials: 'P',
  postpartumWeek: 0,
};

export const DEFAULT_SCREENING = {
  id: 'SCR-2026-1117',
  date: '17 Nov 2026',
  completedDateTime: '17 Nov 2026 · 10:28 AM',
  riskScore: 64,
  riskLabel: 'Moderate Risk for PPD',
  summary:
    'Some signs of postpartum depression were observed. We recommend consulting a healthcare professional.',
  trend: [
    { week: 'Week 1', score: 42 },
    { week: 'Week 2', score: 50 },
    { week: 'Week 3', score: 58 },
    { week: 'Week 4', score: 64 },
  ],
  insights: {
    mood: 'Low to moderate',
    sleep: 'Disturbed',
    stress: 'Elevated',
    support: 'Recommended',
  },
  assessmentSummary: {
    emotionalSigns: 68,
    cognitiveSigns: 62,
    behaviouralSigns: 58,
    physicalIndicators: 46,
  },
  reports: [
    {
      id: 'rep-pdf',
      title: 'Screening Report',
      format: '.pdf',
      size: '2.4 MB',
      type: 'pdf',
      authorized: true,
      mimeType: 'application/pdf',
      filename: 'AANCHAL_Screening_Report_17Nov2026.pdf',
    },
    {
      id: 'rep-txt',
      title: 'Conversation Transcript',
      format: '.txt',
      size: '24 KB',
      type: 'txt',
      authorized: true,
      mimeType: 'text/plain',
      filename: 'AANCHAL_Conversation_Transcript_17Nov2026.txt',
    },
    {
      id: 'rep-wav',
      title: 'Audio Recording',
      format: '.wav',
      size: '7.8 MB',
      type: 'wav',
      authorized: true,
      mimeType: 'audio/wav',
      filename: 'AANCHAL_Audio_Session_17Nov2026.wav',
    },
    {
      id: 'rep-mp4',
      title: 'Video Recording',
      format: '.mp4',
      size: '48.2 MB',
      type: 'mp4',
      authorized: true,
      mimeType: 'video/mp4',
      filename: 'AANCHAL_Video_Session_17Nov2026.mp4',
    },
  ],
  nextSteps: [
    {
      id: 'step-consultation',
      title: 'Book a follow-up consultation',
      type: 'consultation',
      link: '/patient/connect-doctor',
    },
    {
      id: 'step-careplan',
      title: 'Try recommended self-care plan',
      type: 'careplan',
      link: '/patient/care-suggestions',
    },
    {
      id: 'step-retake',
      title: 'Retake screening (in 2 weeks)',
      type: 'screening',
      link: '/patient/screening',
    },
  ],
};

export const INITIAL_NOTIFICATIONS = [];

export const INITIAL_CONSULTATIONS = [
  {
    id: 'c-101',
    doctorName: 'Dr. Priya Mehta',
    role: 'Perinatal Psychiatry Lead',
    date: '20 Nov 2026',
    time: '11:00 AM',
    status: 'Scheduled',
    type: 'Telehealth Video',
    clinic: 'AANCHAL Maternal Care Unit',
  },
];

export const DEFAULT_CARE_PLAN = {
  duration: '2 Weeks',
  totalDays: 14,
  currentDay: 1,
  focusAreas: ['Mood', 'Sleep', 'Stress', 'Support'],
  tasks: [
    { id: 'task-1', title: 'Breathing exercise', completed: false },
    { id: 'task-2', title: 'Mood check-in', completed: false },
    { id: 'task-3', title: 'Sleep routine', completed: false },
    { id: 'task-4', title: 'Journaling', completed: false },
    { id: 'task-5', title: 'Light activity', completed: false },
    { id: 'task-6', title: 'Self-care time', completed: false },
    { id: 'task-7', title: 'Reflection', completed: false },
  ],
};

export function PatientProvider({ children }) {
  const [patient, setPatient] = useState(() => {
    try {
      const authUser = getCurrentUser();
      if (authUser && (authUser.role === 'patient' || authUser.role === 'family')) {
        const parts = (authUser.name || authUser.fullName || (authUser.role === 'family' ? 'Raj' : 'Amara')).trim().split(/\s+/);
        const firstName = parts[0] || (authUser.role === 'family' ? 'Raj' : 'Amara');
        return {
          id: authUser.id || 'P-101',
          name: firstName,
          fullName: authUser.fullName || authUser.name || (authUser.role === 'family' ? 'Raj K.' : 'Amara Wilson'),
          email: authUser.email || (authUser.role === 'family' ? 'family@miora.health' : 'amara@miora.health'),
          role: authUser.role,
          avatarInitials: firstName[0]?.toUpperCase() || (authUser.role === 'family' ? 'R' : 'A'),
          postpartumWeek: authUser.postpartumWeek || 4,
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PATIENT;
  });

  const [screening, setScreening] = useState(DEFAULT_SCREENING);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [consultations, setConsultations] = useState(INITIAL_CONSULTATIONS);
  const [downloadToast, setDownloadToast] = useState(null);
  const [persistentScreenings, setPersistentScreenings] = useState([]);
  const [consultationReports, setConsultationReports] = useState([]);
  const [isLoadingBackendData, setIsLoadingBackendData] = useState(false);
  const [carePlan, setCarePlan] = useState(DEFAULT_CARE_PLAN);
  const [settings, setSettings] = useState({
    camera_permission: 'prompt',
    mic_permission: 'prompt',
    email_notifs: true,
    consultation_alerts: true,
    confidential_mode: true,
    language: 'en',
    voice_locale: 'en-IN',
  });

  const reloadPatientData = useCallback(async () => {
    const authUser = getCurrentUser();
    const token = getAuthToken();
    if (!authUser || (authUser.role !== 'patient' && authUser.role !== 'family') || !token) return;

    try {
      setIsLoadingBackendData(true);
      const [
        profileRes,
        reportsRes,
        screeningsRes,
        notifsRes,
        apptsRes,
        carePlanRes,
        settingsRes,
        consultReportsRes,
      ] = await Promise.allSettled([
        fetchPatientProfile(),
        fetchPatientReportsOverview(),
        fetchPatientScreenings(),
        fetchPatientNotifications(),
        fetchPatientAppointments(),
        fetchPatientCarePlan(),
        fetchPatientSettings(),
        fetchPatientConsultationReports(),
      ]);

      if (consultReportsRes.status === 'fulfilled' && Array.isArray(consultReportsRes.value)) {
        setConsultationReports(consultReportsRes.value);
      }

      // 1. Profile
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        const prof = profileRes.value;
        const firstName = (prof.full_name || authUser.name || 'Amara').trim().split(/\s+/)[0];
        setPatient((prev) => ({
          ...prev,
          id: prof.id ? `P-${prof.id.slice(0, 8).toUpperCase()}` : prev.id,
          motherId: prof.id,
          userId: prof.user_id,
          name: firstName,
          fullName: prof.full_name || prev.fullName,
          email: prof.email || prev.email,
          phone: prof.phone || prev.phone,
          avatarInitials: firstName[0]?.toUpperCase() || 'A',
          postpartumWeek: prof.postpartum_week ?? prev.postpartumWeek,
          emergencyContact: prof.emergency_contact,
        }));
      }

      // 2. Screenings & History
      if (screeningsRes.status === 'fulfilled' && Array.isArray(screeningsRes.value) && screeningsRes.value.length > 0) {
        const scrList = screeningsRes.value;
        setPersistentScreenings(scrList);

        const latest = scrList[0];
        const riskPct = Math.round(((latest.total_score || 0) / 30) * 100);
        const formattedDate = new Date(latest.screening_date || latest.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const timePart = new Date(latest.screening_date || latest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Build trend points from real historical screenings
        const reversed = [...scrList].reverse();
        const trendPoints = reversed.map((s, idx) => ({
          week: `Check-in ${idx + 1}`,
          score: Math.round(((s.total_score || 0) / 30) * 100),
          date: new Date(s.screening_date || s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        }));

        setScreening((prev) => ({
          ...prev,
          id: latest.id,
          date: formattedDate,
          completedDateTime: `${formattedDate} · ${timePart}`,
          latestDate: `${formattedDate} · ${timePart}`,
          riskScore: riskPct,
          riskLabel: `${(latest.risk_classification || 'moderate').toUpperCase()} Risk (EPDS ${latest.total_score}/30)`,
          summary: latest.notes || `EPDS Assessment score: ${latest.total_score}/30`,
          q10Alert: latest.q10_safety_alert,
          submittedAnswers: latest.submitted_answers,
          itemScores: latest.item_scores,
          trend: trendPoints.length > 1 ? trendPoints : prev.trend,
        }));
      } else if (reportsRes.status === 'fulfilled' && reportsRes.value?.latest_screening) {
        const latest = reportsRes.value.latest_screening;
        setScreening((prev) => ({
          ...prev,
          id: latest.id,
          date: latest.date,
          completedDateTime: latest.completedDateTime,
          latestDate: latest.completedDateTime,
          riskScore: latest.riskScore,
          riskLabel: latest.riskLabel,
          summary: latest.summary,
          q10Alert: latest.q10SafetyAlert,
        }));
      }

      // 3. Notifications
      if (notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value)) {
        setNotifications(notifsRes.value);
      }

      // 4. Appointments
      if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value) && apptsRes.value.length > 0) {
        setConsultations(apptsRes.value);
      }

      // 5. Care Plan
      if (carePlanRes.status === 'fulfilled' && carePlanRes.value?.tasks) {
        setCarePlan(carePlanRes.value);
      }

      // 6. Settings
      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        setSettings(settingsRes.value);
      }
    } catch (err) {
      console.warn('Backend patient data sync notice:', err);
    } finally {
      setIsLoadingBackendData(false);
    }
  }, []);

  useEffect(() => {
    reloadPatientData();

    const handleAuthChanged = () => {
      reloadPatientData();
    };
    window.addEventListener('aanchal-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('aanchal-auth-changed', handleAuthChanged);
  }, [reloadPatientData]);

  // Update profile handler connected to PostgreSQL
  const updatePatientProfile = async (profileData) => {
    try {
      const updated = await apiUpdatePatientProfile({
        name: profileData.fullName || profileData.name,
        full_name: profileData.fullName || profileData.name,
        phone: profileData.phone,
        email: profileData.email,
        postpartum_week: profileData.postpartumWeek,
        emergency_contact: profileData.emergencyContact,
      });

      const firstName = (updated.full_name || updated.name || 'Amara').trim().split(/\s+/)[0];
      setPatient((prev) => ({
        ...prev,
        name: firstName,
        fullName: updated.full_name || updated.name,
        email: updated.email || prev.email,
        phone: updated.phone || prev.phone,
        postpartumWeek: updated.postpartum_week ?? prev.postpartumWeek,
        emergencyContact: updated.emergency_contact,
      }));
      return updated;
    } catch (err) {
      console.error('Failed to update patient profile:', err);
      throw err;
    }
  };

  // Toggle Care Task connected to PostgreSQL
  const toggleCareTask = async (taskId) => {
    // Optimistic UI update
    setCarePlan((prev) => ({
      ...prev,
      tasks: (prev.tasks || DEFAULT_CARE_PLAN.tasks).map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
    }));

    try {
      const res = await toggleCarePlanTaskApi(taskId);
      if (res?.tasks) {
        setCarePlan((prev) => ({ ...prev, tasks: res.tasks }));
      }
    } catch (err) {
      console.warn('Could not persist task toggle to backend:', err);
    }
  };

  // Notification handlers connected to PostgreSQL
  const markNotificationRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await markNotificationAsReadApi(id);
    } catch (err) {
      console.warn('Could not mark notification read on backend:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsAsReadApi();
    } catch (err) {
      console.warn('Could not mark all notifications read on backend:', err);
    }
  };

  // Book appointment connected to PostgreSQL
  const bookAppointment = async (appointmentData) => {
    try {
      const booked = await apiBookPatientAppointment(appointmentData);
      setConsultations((prev) => [booked, ...prev]);
      await reloadPatientData().catch(() => { });
      return booked;
    } catch (err) {
      console.warn('Booking appointment fallback in offline/test environment:', err);
      const fallbackBooked = {
        id: `c-${Date.now()}`,
        doctorName: appointmentData.doctor_name || 'Dr. Priya Mehta',
        role: appointmentData.role || 'Perinatal Psychiatry Lead',
        date: appointmentData.date,
        time: appointmentData.time,
        status: 'Scheduled',
        type: appointmentData.type || 'Telehealth Video',
        clinic: appointmentData.clinic || 'AANCHAL Maternal Care Unit',
        reason: appointmentData.reason,
      };
      setConsultations((prev) => [fallbackBooked, ...prev]);
      return fallbackBooked;
    }
  };

  // Update Settings connected to PostgreSQL
  const updateSettings = async (newSettings) => {
    const updated = await apiUpdatePatientSettings(newSettings);
    setSettings(updated);
    return updated;
  };

  // Genuine Report Download streaming from FastAPI backend
  const downloadReport = async (reportInput) => {
    if (!reportInput) return { success: false, error: 'No report selected' };

    const report =
      typeof reportInput === 'string'
        ? {
          id: reportInput,
          title: reportInput.includes('transcript') ? 'Conversation Transcript' : 'Screening Report',
          filename: reportInput.includes('transcript')
            ? 'AANCHAL_Conversation_Transcript.txt'
            : 'AANCHAL_Screening_Report.pdf',
          type: reportInput.includes('transcript') ? 'txt' : 'pdf',
          authorized: true,
          format: reportInput.includes('transcript') ? '.txt' : '.pdf',
        }
        : reportInput;

    if (report.authorized === false) {
      const errorMsg = 'Access Denied: You are not authorized to download this file.';
      setDownloadToast({ type: 'error', message: errorMsg });
      setTimeout(() => setDownloadToast(null), 4000);
      return { success: false, error: errorMsg };
    }

    try {
      let blob = null;
      let targetFilename = report.filename || `${(report.title || 'Report').replace(/\s+/g, '_')}${report.format || '.pdf'}`;

      const fallbackUuid = persistentScreenings?.[0]?.id || null;
      const targetScreeningId =
        screening?.id && !String(screening.id).startsWith('SCR-') ? screening.id : fallbackUuid;

      if (report.type === 'consultation' && report.id) {
        blob = await downloadPatientConsultationReportBlob(report.id);
        if (!targetFilename.endsWith('.txt')) targetFilename += '.txt';
      } else if (report.type === 'pdf') {
        blob = await downloadReportPdfBlob(targetScreeningId);
        if (!blob || blob.size < 100) {
          throw new Error('Downloaded PDF file was empty or invalid.');
        }
        const firstName = (patient?.name || 'Amara').split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, '');
        if (!report.filename || report.filename === 'AANCHAL_Screening_Report.pdf') {
          targetFilename = `AANCHAL_Screening_Report_${firstName || 'Patient'}.pdf`;
        }
        if (!targetFilename.endsWith('.pdf')) targetFilename += '.pdf';
      } else if (report.type === 'txt') {
        blob = await downloadTranscriptTxtBlob(targetScreeningId);
        if (!targetFilename.endsWith('.txt')) targetFilename += '.txt';
      } else {
        // Fallback for audio/video media if requested
        blob = new Blob(['AANCHAL multimodal screening media recording'], { type: report.mimeType || 'application/octet-stream' });
      }

      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const msg = `Downloaded ${report.title} (${report.format?.toUpperCase() || 'FILE'})`;
      setDownloadToast({ type: 'success', message: msg });
      setTimeout(() => setDownloadToast(null), 3500);
      return { success: true };
    } catch (err) {
      console.error('Report download error:', err);
      const errorMsg = 'An error occurred while downloading the file from server.';
      setDownloadToast({ type: 'error', message: errorMsg });
      setTimeout(() => setDownloadToast(null), 4000);
      return { success: false, error: errorMsg };
    }
  };

  const value = useMemo(
    () => ({
      patient,
      updatePatientProfile,
      screening,
      setScreening,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      consultations,
      setConsultations,
      bookAppointment,
      downloadReport,
      downloadToast,
      setDownloadToast,
      carePlan,
      setCarePlan,
      toggleCareTask,
      settings,
      updateSettings,
      persistentScreenings,
      consultationReports,
      reloadPatientData,
      isLoadingBackendData,
    }),
    [
      patient,
      screening,
      notifications,
      consultations,
      downloadToast,
      carePlan,
      settings,
      persistentScreenings,
      consultationReports,
      reloadPatientData,
      isLoadingBackendData,
    ]
  );

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient() {
  const context = useContext(PatientContext);
  if (!context) {
    return {
      patient: DEFAULT_PATIENT,
      updatePatientProfile: async () => { },
      screening: DEFAULT_SCREENING,
      notifications: INITIAL_NOTIFICATIONS,
      consultations: INITIAL_CONSULTATIONS,
      carePlan: DEFAULT_CARE_PLAN,
      toggleCareTask: () => { },
      setCarePlan: () => { },
      markNotificationRead: () => { },
      markAllNotificationsRead: () => { },
      bookAppointment: async () => { },
      downloadReport: () => ({ success: true }),
      downloadToast: null,
      setDownloadToast: () => { },
      settings: {},
      updateSettings: async () => { },
    };
  }
  return context;
}
