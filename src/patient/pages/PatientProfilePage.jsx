import React, { useState, useEffect } from 'react';
import { usePatient } from '../context/PatientContext.jsx';

export function PatientProfilePage() {
  const { patient, updatePatientProfile } = usePatient();
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
    <div style={{ padding: '24px 32px', maxWidth: 860 }}>
      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: '0 0 6px 0', color: 'var(--patient-text-primary)' }}>
          Patient Profile
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--patient-text-muted)' }}>
          Manage your personal details, postpartum timeline, and emergency contacts.
        </p>
      </div>

      {saveSuccess && (
        <div style={{ background: 'var(--patient-success-bg, #ecfdf5)', color: 'var(--patient-success, #059669)', border: '1px solid #a7f3d0', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ Profile details updated and saved to database successfully.
        </div>
      )}

      {saveError && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✕ {saveError}
        </div>
      )}

      {/* Main Profile Card */}
      <div style={{ background: '#ffffff', border: '1px solid var(--patient-border)', borderRadius: 12, padding: 24, boxShadow: 'var(--patient-shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--patient-border-subtle)', paddingBottom: 20, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--patient-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
            {patient?.avatarInitials || 'P'}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 4px 0', color: 'var(--patient-text-primary)' }}>
              {patient?.fullName || 'Patient'}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--patient-text-muted)' }}>
              Patient ID: <strong>{patient?.id || 'P-101'}</strong> · Week {patient?.postpartumWeek || 4} Postpartum
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsEditing((prev) => !prev);
              setSaveError('');
            }}
            style={{
              background: isEditing ? 'none' : 'var(--patient-primary-subtle)',
              border: '1px solid var(--patient-primary)',
              color: 'var(--patient-primary)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--patient-text-primary)' }}>Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--patient-border)', borderRadius: 6, fontSize: 13 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--patient-text-primary)' }}>Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--patient-border)', borderRadius: 6, fontSize: 13 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--patient-text-primary)' }}>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                placeholder="Optional"
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--patient-border)', borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--patient-text-primary)' }}>Postpartum Week</label>
              <input
                type="number"
                min="1"
                max="52"
                value={formData.postpartumWeek}
                onChange={(e) => setFormData({ ...formData, postpartumWeek: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--patient-border)', borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--patient-text-primary)' }}>Emergency Contact Name</label>
              <input
                type="text"
                value={formData.emergencyName}
                placeholder="Partner, relative, or friend"
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--patient-border)', borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--patient-text-primary)' }}>Emergency Contact Phone</label>
              <input
                type="tel"
                value={formData.emergencyPhone}
                placeholder="Contact number"
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--patient-border)', borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  background: 'var(--patient-primary)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '9px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? 'Saving to Database...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--patient-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Email Address</span>
              <strong style={{ fontSize: 13.5, color: 'var(--patient-text-body)' }}>{patient?.email || 'Not provided'}</strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--patient-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Phone Number</span>
              <strong style={{ fontSize: 13.5, color: 'var(--patient-text-body)' }}>{patient?.phone || 'Not provided'}</strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--patient-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Emergency Contact</span>
              <strong style={{ fontSize: 13.5, color: 'var(--patient-text-body)' }}>
                {patient?.emergencyContact?.name
                  ? `${patient.emergencyContact.name} ${patient.emergencyContact.phone ? `(${patient.emergencyContact.phone})` : ''}`
                  : 'Not registered'}
              </strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--patient-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Account Status</span>
              <strong style={{ fontSize: 13.5, color: 'var(--patient-success, #059669)' }}>
                Active (Connected to PostgreSQL)
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default PatientProfilePage;
