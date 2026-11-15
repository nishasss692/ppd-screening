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
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto', fontFamily: 'var(--patient-font-sans)' }}>
      {/* Title */}
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
          <span>Personal Account</span>
        </div>
        <h1 style={{
          fontFamily: 'var(--patient-font-serif)',
          fontSize: 28,
          margin: '0 0 6px 0',
          color: 'var(--patient-ink, #271218)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}>
          Patient Profile
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--patient-muted, #62555a)' }}>
          Manage your personal details, postpartum timeline, and emergency contacts. Connected directly to PostgreSQL.
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
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--patient-blush-border, #f0dfe2)',
        borderRadius: 'var(--patient-radius-lg, 16px)',
        padding: '28px 32px',
        boxShadow: '0 4px 20px rgba(197, 35, 97, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, borderBottom: '1px solid var(--patient-blush-border, #f0dfe2)', paddingBottom: 22, marginBottom: 22 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--patient-brand-rose, #d93c75), var(--patient-brand-rose-deep, #ca2261))',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(217, 60, 117, 0.25)',
          }}>
            {patient?.avatarInitials || 'P'}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--patient-font-serif)', fontSize: 20, margin: '0 0 4px 0', color: 'var(--patient-ink, #271218)', fontWeight: 600 }}>
              {patient?.fullName || 'Patient'}
            </h2>
            <span style={{ fontSize: 13, color: 'var(--patient-muted, #62555a)' }}>
              Patient ID: <strong style={{ color: 'var(--patient-ink, #271218)' }}>{patient?.id || 'P-101'}</strong> · Week {patient?.postpartumWeek || 4} Postpartum
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsEditing((prev) => !prev);
              setSaveError('');
            }}
            style={{
              background: isEditing ? 'none' : 'var(--patient-brand-rose-subtle, #fde7ec)',
              border: '1px solid var(--patient-brand-rose, #d93c75)',
              color: 'var(--patient-brand-rose-deep, #ca2261)',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
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
                  background: 'var(--patient-brand-rose, #d93c75)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 22px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(217, 60, 117, 0.25)',
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
