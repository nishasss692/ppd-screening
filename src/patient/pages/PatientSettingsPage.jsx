import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';

export function PatientSettingsPage() {
  const { settings, updateSettings } = usePatient();

  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [micPermission, setMicPermission] = useState('prompt');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [consultationAlerts, setConsultationAlerts] = useState(true);
  const [confidentialMode, setConfidentialMode] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.camera_permission !== undefined) setCameraPermission(settings.camera_permission);
      if (settings.mic_permission !== undefined) setMicPermission(settings.mic_permission);
      if (settings.email_notifs !== undefined) setEmailNotifs(settings.email_notifs);
      if (settings.consultation_alerts !== undefined) setConsultationAlerts(settings.consultation_alerts);
      if (settings.confidential_mode !== undefined) setConfidentialMode(settings.confidential_mode);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (updateSettings) {
        await updateSettings({
          camera_permission: cameraPermission,
          mic_permission: micPermission,
          email_notifs: emailNotifs,
          consultation_alerts: consultationAlerts,
          confidential_mode: confidentialMode,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.warn('Could not save settings to backend:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto', fontFamily: 'var(--patient-font-sans)' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--patient-brand-rose-deep)',
          background: 'var(--patient-brand-rose-subtle, #fde7ec)',
          border: '1px solid rgba(234, 58, 122, 0.2)',
          marginBottom: 10,
        }}>
          <span>Preferences &amp; Confidentiality</span>
        </div>
        <h1 style={{
          fontFamily: 'var(--patient-font-serif)',
          fontSize: 28,
          margin: '0 0 6px 0',
          color: 'var(--patient-ink, #271218)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}>
          Account &amp; Privacy Settings
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--patient-muted, #62555a)' }}>
          Configure confidential screening permissions, consultation alerts, and device security. Persisted in PostgreSQL.
        </p>
      </div>

      {saveSuccess && (
        <div style={{ background: 'var(--patient-success-bg, #ecfdf5)', color: 'var(--patient-success, #059669)', border: '1px solid #a7f3d0', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ Preferences saved successfully to database.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Screening Privacy & Permissions */}
        <section style={{
          background: '#ffffff',
          border: '1px solid var(--patient-blush-border, #f0dfe2)',
          borderRadius: 'var(--patient-radius-lg, 16px)',
          padding: '24px 28px',
          boxShadow: '0 4px 20px rgba(197, 35, 97, 0.05)',
        }}>
          <h2 style={{ fontFamily: 'var(--patient-font-serif)', fontSize: 18, margin: '0 0 16px 0', color: 'var(--patient-ink, #271218)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
            <PatientIcon name="video" size={19} color="var(--patient-brand-rose, #d93c75)" />
            <span>Screening Device Permissions</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--patient-ink, #271218)' }}>Camera Access</strong>
                <small style={{ color: 'var(--patient-muted, #62555a)', fontSize: 12 }}>Allow conversational facial &amp; visual biomarker analysis during screening</small>
              </div>
              <input type="checkbox" checked={cameraPermission !== 'denied'} onChange={(e) => setCameraPermission(e.target.checked ? 'granted' : 'denied')} style={{ accentColor: 'var(--patient-brand-rose, #d93c75)', width: 17, height: 17 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--patient-ink, #271218)' }}>Microphone Access</strong>
                <small style={{ color: 'var(--patient-muted, #62555a)', fontSize: 12 }}>Allow speech recognition, listen features, and vocal tone analysis</small>
              </div>
              <input type="checkbox" checked={micPermission !== 'denied'} onChange={(e) => setMicPermission(e.target.checked ? 'granted' : 'denied')} style={{ accentColor: 'var(--patient-brand-rose, #d93c75)', width: 17, height: 17 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--patient-ink, #271218)' }}>Strict Patient Confidentiality</strong>
                <small style={{ color: 'var(--patient-muted, #62555a)', fontSize: 12 }}>Only authorized clinical care team can access screening reports</small>
              </div>
              <input type="checkbox" checked={confidentialMode} onChange={(e) => setConfidentialMode(e.target.checked)} style={{ accentColor: 'var(--patient-brand-rose, #d93c75)', width: 17, height: 17 }} />
            </label>
          </div>
        </section>

        {/* Notifications & Reminders */}
        <section style={{
          background: '#ffffff',
          border: '1px solid var(--patient-blush-border, #f0dfe2)',
          borderRadius: 'var(--patient-radius-lg, 16px)',
          padding: '24px 28px',
          boxShadow: '0 4px 20px rgba(197, 35, 97, 0.05)',
        }}>
          <h2 style={{ fontFamily: 'var(--patient-font-serif)', fontSize: 18, margin: '0 0 16px 0', color: 'var(--patient-ink, #271218)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
            <PatientIcon name="bell" size={19} color="var(--patient-brand-rose, #d93c75)" />
            <span>Notification Preferences</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--patient-ink, #271218)' }}>Screening Report Ready Alerts</strong>
                <small style={{ color: 'var(--patient-muted, #62555a)', fontSize: 12 }}>Receive notifications when assessment scores and reports finish processing</small>
              </div>
              <input type="checkbox" checked={emailNotifs} onChange={(e) => setEmailNotifs(e.target.checked)} style={{ accentColor: 'var(--patient-brand-rose, #d93c75)', width: 17, height: 17 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--patient-ink, #271218)' }}>Consultation Reminders</strong>
                <small style={{ color: 'var(--patient-muted, #62555a)', fontSize: 12 }}>Reminder alerts 24 hours prior to scheduled doctor telehealth calls</small>
              </div>
              <input type="checkbox" checked={consultationAlerts} onChange={(e) => setConsultationAlerts(e.target.checked)} style={{ accentColor: 'var(--patient-brand-rose, #d93c75)', width: 17, height: 17 }} />
            </label>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: 'var(--patient-brand-rose, #d93c75)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              boxShadow: '0 2px 8px rgba(217, 60, 117, 0.25)',
            }}
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default PatientSettingsPage;
