import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './profileSettings.css';

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
    <div className="patient-settings-shell">
      {/* Breadcrumb Bar */}
      <div className="medhist-breadcrumb-bar">
        <NavLink to="/patient/dashboard" className="medhist-breadcrumb-link">
          <PatientIcon name="home" size={13} />
          <span>Dashboard</span>
        </NavLink>
        <span className="medhist-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="medhist-breadcrumb-current">Settings</span>
      </div>

      {/* Page Header */}
      <div className="patient-page-banner">
        <div className="miora-dash-eyebrow">
          <span>SETTINGS &amp; PRIVACY</span>
          <span className="miora-dash-eyebrow-line" aria-hidden="true" />
        </div>
        <h1 className="miora-dash-title patient-page-heading">
          Account &amp; <em>Privacy Settings</em>
        </h1>
      </div>

      {saveSuccess && (
        <div className="patient-notice-banner is-success">
          Preferences saved successfully to database.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Screening Privacy & Permissions */}
        <section className="patient-settings-card">
          <h2 style={{ fontFamily: 'var(--patient-font-serif)', fontSize: 18, margin: '0 0 16px 0', color: 'var(--patient-ink)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
            <PatientIcon name="video" size={19} color="var(--patient-brand-rose)" />
            <span>Screening Device Permissions</span>
          </h2>
          <div className="patient-settings-list">
            <label className="patient-settings-item">
              <div>
                <strong className="patient-settings-item-title">Camera Access</strong>
                <small className="patient-settings-item-desc">Allow conversational facial &amp; visual biomarker analysis during screening</small>
              </div>
              <input
                type="checkbox"
                className="patient-settings-checkbox"
                checked={cameraPermission !== 'denied'}
                onChange={(e) => setCameraPermission(e.target.checked ? 'granted' : 'denied')}
              />
            </label>
            <label className="patient-settings-item">
              <div>
                <strong className="patient-settings-item-title">Microphone Access</strong>
                <small className="patient-settings-item-desc">Allow speech recognition, listen features, and vocal tone analysis</small>
              </div>
              <input
                type="checkbox"
                className="patient-settings-checkbox"
                checked={micPermission !== 'denied'}
                onChange={(e) => setMicPermission(e.target.checked ? 'granted' : 'denied')}
              />
            </label>
            <label className="patient-settings-item">
              <div>
                <strong className="patient-settings-item-title">Strict Patient Confidentiality</strong>
                <small className="patient-settings-item-desc">Only authorized clinical care team can access screening reports</small>
              </div>
              <input
                type="checkbox"
                className="patient-settings-checkbox"
                checked={confidentialMode}
                onChange={(e) => setConfidentialMode(e.target.checked)}
              />
            </label>
          </div>
        </section>

        {/* Notifications & Reminders */}
        <section className="patient-settings-card">
          <h2 style={{ fontFamily: 'var(--patient-font-serif)', fontSize: 18, margin: '0 0 16px 0', color: 'var(--patient-ink)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
            <PatientIcon name="bell" size={19} color="var(--patient-brand-rose)" />
            <span>Notification Preferences</span>
          </h2>
          <div className="patient-settings-list">
            <label className="patient-settings-item">
              <div>
                <strong className="patient-settings-item-title">Screening Report Ready Alerts</strong>
                <small className="patient-settings-item-desc">Receive notifications when assessment scores and reports finish processing</small>
              </div>
              <input
                type="checkbox"
                className="patient-settings-checkbox"
                checked={emailNotifs}
                onChange={(e) => setEmailNotifs(e.target.checked)}
              />
            </label>
            <label className="patient-settings-item">
              <div>
                <strong className="patient-settings-item-title">Consultation Reminders</strong>
                <small className="patient-settings-item-desc">Reminder alerts 24 hours prior to scheduled doctor telehealth calls</small>
              </div>
              <input
                type="checkbox"
                className="patient-settings-checkbox"
                checked={consultationAlerts}
                onChange={(e) => setConsultationAlerts(e.target.checked)}
              />
            </label>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="patient-btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default PatientSettingsPage;
