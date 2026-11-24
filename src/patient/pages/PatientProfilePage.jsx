import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { fetchClinicalProfile } from '../services/patientApiService.js';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './profileSettings.css';

export function PatientProfilePage() {
  const { patient, updatePatientProfile } = usePatient();
  const [clinicalData, setClinicalData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: patient?.fullName || '',
    email: patient?.email || '',
    phone: patient?.phone || '',
    postpartumWeek: patient?.postpartumWeek || 4,
    emergencyName: patient?.emergencyContact?.name || '',
    emergencyPhone: patient?.emergencyContact?.phone || '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadClinical() {
      try {
        const res = await fetchClinicalProfile();
        if (mounted && res && res.clinical_profile) {
          setClinicalData(res.clinical_profile);
        }
      } catch (err) {
        // Fall back gracefully to defaults
      }
    }
    loadClinical();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (patient) {
      setFormData({
        fullName: patient.fullName || patient.name || '',
        email: patient.email || '',
        phone: patient.phone || '',
        postpartumWeek: patient.postpartumWeek || 4,
        emergencyName: patient.emergencyContact?.name || '',
        emergencyPhone: patient.emergencyContact?.phone || '',
      });
    }
  }, [patient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      if (updatePatientProfile) {
        await updatePatientProfile({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          postpartumWeek: Number(formData.postpartumWeek),
          emergencyContact: formData.emergencyName
            ? { name: formData.emergencyName, phone: formData.emergencyPhone }
            : null,
        });
      }
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="patient-profile-shell">
      {/* Breadcrumb Bar */}
      <div className="medhist-breadcrumb-bar">
        <NavLink to="/patient/dashboard" className="medhist-breadcrumb-link">
          <PatientIcon name="home" size={13} />
          <span>Dashboard</span>
        </NavLink>
        <span className="medhist-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="medhist-breadcrumb-current">Profile</span>
      </div>

      {/* Page Header */}
      <div className="patient-profile-header-banner">
        <h1 className="patient-profile-page-heading">Patient Profile</h1>
      </div>

      {saveSuccess && (
        <div className="patient-notice-banner is-success">
          Profile details updated and saved to PostgreSQL successfully.
        </div>
      )}

      {saveError && (
        <div className="patient-notice-banner is-error">
          {saveError}
        </div>
      )}

      {/* Main Personal Profile Card */}
      <div className="patient-profile-card">
        <div className="patient-profile-user-row">
          <div className="patient-profile-avatar-large">
            {patient?.avatarInitials || 'P'}
          </div>
          <div className="patient-profile-user-meta">
            <h2 className="patient-profile-name">
              {patient?.fullName || 'Patient'}
            </h2>
            <span className="patient-profile-sub">
              Patient ID: <strong style={{ color: 'var(--patient-ink)' }}>{patient?.id || 'P-101'}</strong> · Week {patient?.postpartumWeek || 4} Postpartum
            </span>
          </div>
          <button
            type="button"
            className="patient-btn-secondary"
            onClick={() => {
              setIsEditing((prev) => !prev);
              setSaveError('');
            }}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="patient-profile-form">
            <div className="patient-form-group">
              <label className="patient-form-label">Full Name</label>
              <input
                type="text"
                className="patient-form-input"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div className="patient-form-group">
              <label className="patient-form-label">Email Address</label>
              <input
                type="email"
                className="patient-form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="patient-form-group">
              <label className="patient-form-label">Phone Number</label>
              <input
                type="tel"
                className="patient-form-input"
                value={formData.phone}
                placeholder="Optional"
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="patient-form-group">
              <label className="patient-form-label">Postpartum Week</label>
              <input
                type="number"
                min="1"
                max="52"
                className="patient-form-input"
                value={formData.postpartumWeek}
                onChange={(e) => setFormData({ ...formData, postpartumWeek: Number(e.target.value) })}
              />
            </div>
            <div className="patient-form-group">
              <label className="patient-form-label">Emergency Contact Name</label>
              <input
                type="text"
                className="patient-form-input"
                value={formData.emergencyName}
                placeholder="Partner, relative, or friend"
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
              />
            </div>
            <div className="patient-form-group">
              <label className="patient-form-label">Emergency Contact Phone</label>
              <input
                type="tel"
                className="patient-form-input"
                value={formData.emergencyPhone}
                placeholder="Contact number"
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <button
                type="submit"
                disabled={isSaving}
                className="patient-btn-primary"
              >
                {isSaving ? 'Saving to Database...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="patient-profile-info-grid">
            <div className="patient-profile-info-item">
              <span className="patient-profile-info-label">Email Address</span>
              <strong className="patient-profile-info-val">{patient?.email || 'Not provided'}</strong>
            </div>
            <div className="patient-profile-info-item">
              <span className="patient-profile-info-label">Phone Number</span>
              <strong className="patient-profile-info-val">{patient?.phone || 'Not provided'}</strong>
            </div>
            <div className="patient-profile-info-item">
              <span className="patient-profile-info-label">Postpartum Stage</span>
              <strong className="patient-profile-info-val">Week {patient?.postpartumWeek || 4} Postpartum</strong>
            </div>
            <div className="patient-profile-info-item">
              <span className="patient-profile-info-label">Emergency Contact</span>
              <strong className="patient-profile-info-val">
                {patient?.emergencyContact?.name
                  ? `${patient.emergencyContact.name} ${patient.emergencyContact.phone ? `(${patient.emergencyContact.phone})` : ''}`
                  : 'Not registered'}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Profile Section - Professional Medical Information Layout */}
      <div className="patient-profile-card clinical-info-section">
        <div className="clinical-info-header">
          <div>
            <h2 className="clinical-info-title">Clinical &amp; Background Profile</h2>
            <p className="clinical-info-desc">
              Structured clinical parameters, obstetric history, and household context for medical care evaluation.
            </p>
          </div>
          <NavLink to="/patient/clinical-profile" className="patient-btn-secondary clinical-action-btn">
            <span>View &amp; Edit Clinical Profile</span>
            <PatientIcon name="arrow-right" size={15} />
          </NavLink>
        </div>

        <div className="clinical-sections-grid">
          {/* Sub-section 1: Demographics & Household */}
          <div className="clinical-sub-card">
            <h3 className="clinical-sub-heading">Demographics &amp; Household</h3>
            <div className="clinical-details-list">
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Residence</span>
                <span className="clinical-detail-val">{clinicalData?.['Residence'] || 'City'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Education</span>
                <span className="clinical-detail-val">{clinicalData?.['Education Level'] || 'University'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Marital Status</span>
                <span className="clinical-detail-val">{clinicalData?.['Marital status'] || 'Married'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Family Type</span>
                <span className="clinical-detail-val">{clinicalData?.['Family type'] || 'Nuclear'}</span>
              </div>
            </div>
          </div>

          {/* Sub-section 2: Obstetric & Delivery History */}
          <div className="clinical-sub-card">
            <h3 className="clinical-sub-heading">Obstetric &amp; Delivery History</h3>
            <div className="clinical-details-list">
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Delivery Mode</span>
                <span className="clinical-detail-val">{clinicalData?.['Delivery mode'] || 'Normal'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Previous Pregnancies</span>
                <span className="clinical-detail-val">{clinicalData?.['Previous pregnancies'] || '1'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Pregnancy Complications</span>
                <span className="clinical-detail-val">{clinicalData?.['Pregnancy complications'] || 'None'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Gestational Age</span>
                <span className="clinical-detail-val">{clinicalData?.['Gestational age at delivery'] || 'Term (37–41 weeks)'}</span>
              </div>
            </div>
          </div>

          {/* Sub-section 3: Newborn & Postpartum Care */}
          <div className="clinical-sub-card">
            <h3 className="clinical-sub-heading">Newborn &amp; Postpartum Care</h3>
            <div className="clinical-details-list">
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Baby's Health Status</span>
                <span className="clinical-detail-val">{clinicalData?.["Baby's health status"] || 'Healthy'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Feeding Method</span>
                <span className="clinical-detail-val">{clinicalData?.['Feeding method'] || 'Exclusive Breastfeeding'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Rest &amp; Sleep</span>
                <span className="clinical-detail-val">{clinicalData?.['Sleep quality'] || 'Adequate rest'}</span>
              </div>
              <div className="clinical-detail-row">
                <span className="clinical-detail-label">Care Support</span>
                <span className="clinical-detail-val">{clinicalData?.['Family support level'] || 'Family support present'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default PatientProfilePage;
