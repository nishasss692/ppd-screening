import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { fetchClinicalProfile, updateClinicalProfile } from '../services/patientApiService.js';
import { PatientIcon } from '../components/PatientIcons.jsx';
import '../styles/clinicalProfile.css';

export function ClinicalProfilePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('demographics');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 37 Stage 1 features state
  const [formData, setFormData] = useState({
    // Section 1: Demographics & Household (13 features)
    'Age': '28',
    'Residence': 'City',
    'Education Level': 'University',
    'Marital status': 'Married',
    'Occupation before latest pregnancy': 'Service',
    'Monthly income before latest pregnancy': '20000 to 30000',
    'Occupation After Your Latest Childbirth': 'Housewife',
    'Current monthly income': '10000 to 20000',
    "Husband's education level": 'University',
    'Husband’s monthly income': '20000 to 30000',
    'Addiction': 'Missing',
    'Family type': 'Nuclear',
    'Number of household members': '2 to 5',

    // Section 2: Obstetric & Pregnancy History (15 features)
    'Total children': 'One',
    'Number of the latest pregnancy': '1',
    'Age of immediate older children': 'Missing',
    'Disease before pregnancy': 'Missing',
    'History of pregnancy loss': 'Missing',
    'Pregnancy plan': 'Yes',
    'Regular checkups': 'Yes',
    'Pregnancy length': '9 months',
    'Mode of delivery': 'Normal Delivery',
    'Birth compliancy': 'Yes',
    'Diseases during pregnancy': 'Missing',
    'Major changes or losses during pregnancy': 'No',
    'Fear of pregnancy': 'No',
    'Depression before pregnancy (PHQ2)': 'Negative',
    'Depression during pregnancy (PHQ2)': 'Negative',

    // Section 3: Baby & Feeding (7 features)
    'Age of newborn': '0 to 6 months',
    'Gender of newborn': 'Girl',
    'Breastfeed': 'Yes',
    'Newborn illness': 'No',
    'Worry about newborn': 'No',
    'Relationship with the newborn': 'Good',
    'Relationship between father and newborn': 'Good',

    // Section 4: Daily Wellbeing & Safety (2 features)
    'Abuse': 'No',
    'Feeling for regular activities': 'Missing',
  });

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const res = await fetchClinicalProfile();
        if (mounted && res && res.clinical_profile) {
          setFormData((prev) => ({
            ...prev,
            ...res.clinical_profile,
          }));
        }
      } catch (err) {
        // Fall back gracefully to initial defaults if offline/unconfigured
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      await updateClinicalProfile({
        clinical_profile: formData,
        profile_completed: true,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to update clinical profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="clinical-profile-shell">
      {/* Breadcrumb Navigation */}
      <div className="medhist-breadcrumb-bar">
        <NavLink to="/patient/dashboard" className="medhist-breadcrumb-link">
          <PatientIcon name="home" size={13} />
          <span>Dashboard</span>
        </NavLink>
        <span className="medhist-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <NavLink to="/patient/profile" className="medhist-breadcrumb-link">
          <span>Profile</span>
        </NavLink>
        <span className="medhist-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="medhist-breadcrumb-current">Stage 1 Clinical Profile</span>
      </div>

      {/* Header Banner */}
      <div className="clinical-profile-banner">
        <div className="miora-dash-eyebrow">
          <span>STAGE 1 DATA COLLECTION</span>
          <span className="miora-dash-eyebrow-line" aria-hidden="true" />
        </div>
        <h1 className="clinical-profile-title">
          Maternal Clinical &amp; <em>Background Profile</em>
        </h1>
        <p className="clinical-profile-subtitle">
          This comprehensive health profile supplies the demographic, medical, and obstetric context
          evaluated by AANCHAL&apos;s clinical record screening model. Complete once; update anytime.
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="clinical-privacy-card">
        <div className="clinical-privacy-icon">
          <PatientIcon name="lock" size={20} />
        </div>
        <div>
          <strong>Strict Medical Confidentiality:</strong> Your background information is stored in
          encrypted health records and accessible exclusively to your verified clinical care team.
          Sensitive questions provide a &ldquo;Prefer not to answer&rdquo; option and are never shared publicly.
        </div>
      </div>

      {saveSuccess && (
        <div className="clinical-notice-banner is-success">
          Your Stage 1 clinical profile was saved successfully to your health record.
        </div>
      )}

      {saveError && (
        <div className="clinical-notice-banner is-error">
          {saveError}
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div className="clinical-tabs-nav" role="tablist">
        <button
          type="button"
          className={`clinical-tab-btn ${activeTab === 'demographics' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('demographics')}
        >
          <PatientIcon name="user" size={15} />
          <span>1. Demographics &amp; Household</span>
        </button>
        <button
          type="button"
          className={`clinical-tab-btn ${activeTab === 'obstetrics' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('obstetrics')}
        >
          <PatientIcon name="flower" size={15} />
          <span>2. Pregnancy &amp; Medical</span>
        </button>
        <button
          type="button"
          className={`clinical-tab-btn ${activeTab === 'newborn' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('newborn')}
        >
          <PatientIcon name="heart" size={15} />
          <span>3. Baby &amp; Care</span>
        </button>
        <button
          type="button"
          className={`clinical-tab-btn ${activeTab === 'wellbeing' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('wellbeing')}
        >
          <PatientIcon name="sun" size={15} />
          <span>4. Functioning &amp; Safety</span>
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave} className="clinical-form-card">
        {activeTab === 'demographics' && (
          <div>
            <div className="clinical-form-card-header">
              <h2 className="clinical-card-title">Demographics &amp; Household Structure</h2>
              <p className="clinical-card-desc">Socioeconomic and family factors associated with maternal wellbeing.</p>
            </div>
            <div className="clinical-grid">
              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-age">Maternal Age (years)</label>
                <input
                  id="field-age"
                  type="number"
                  name="Age"
                  className="clinical-input"
                  min="15"
                  max="55"
                  value={formData['Age'] || ''}
                  onChange={handleChange}
                />
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-residence">Residence Environment</label>
                <select id="field-residence" name="Residence" className="clinical-select" value={formData['Residence']} onChange={handleChange}>
                  <option value="City">City / Urban</option>
                  <option value="Village">Village / Rural</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-education">Education Level</label>
                <select id="field-education" name="Education Level" className="clinical-select" value={formData['Education Level']} onChange={handleChange}>
                  <option value="Primary School">Primary School</option>
                  <option value="High School">High School</option>
                  <option value="College">College / Diploma</option>
                  <option value="University">University / Postgraduate</option>
                  <option value="Missing">Prefer not to answer</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-marital">Marital Status</label>
                <select id="field-marital" name="Marital status" className="clinical-select" value={formData['Marital status']} onChange={handleChange}>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced / Separated</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-family-type">Family Structure</label>
                <select id="field-family-type" name="Family type" className="clinical-select" value={formData['Family type']} onChange={handleChange}>
                  <option value="Nuclear">Nuclear Family</option>
                  <option value="Joint">Joint / Extended Family</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-household-members">Household Members</label>
                <select id="field-household-members" name="Number of household members" className="clinical-select" value={formData['Number of household members']} onChange={handleChange}>
                  <option value="2 to 5">2 to 5 members</option>
                  <option value="6 to 8">6 to 8 members</option>
                  <option value="9 or more">9 or more members</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-occ-before">Occupation Before Pregnancy</label>
                <select id="field-occ-before" name="Occupation before latest pregnancy" className="clinical-select" value={formData['Occupation before latest pregnancy']} onChange={handleChange}>
                  <option value="Housewife">Homemaker / Housewife</option>
                  <option value="Service">Employed / Service</option>
                  <option value="Business">Business / Self-Employed</option>
                  <option value="Teacher">Teaching / Education</option>
                  <option value="Doctor">Healthcare / Doctor</option>
                  <option value="Student">Student</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-occ-after">Occupation After Childbirth</label>
                <select id="field-occ-after" name="Occupation After Your Latest Childbirth" className="clinical-select" value={formData['Occupation After Your Latest Childbirth']} onChange={handleChange}>
                  <option value="Housewife">Homemaker / Housewife</option>
                  <option value="Service">Employed / Service</option>
                  <option value="Business">Business / Self-Employed</option>
                  <option value="Teacher">Teaching / Education</option>
                  <option value="Doctor">Healthcare / Doctor</option>
                  <option value="Student">Student</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-inc-before">Monthly Income Before Pregnancy</label>
                <select id="field-inc-before" name="Monthly income before latest pregnancy" className="clinical-select" value={formData['Monthly income before latest pregnancy']} onChange={handleChange}>
                  <option value="Less than 5000">Less than 5,000</option>
                  <option value="5000 to 10000">5,000 to 10,000</option>
                  <option value="10000 to 20000">10,000 to 20,000</option>
                  <option value="20000 to 30000">20,000 to 30,000</option>
                  <option value="More than 30000">More than 30,000</option>
                  <option value="Missing">Prefer not to answer</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-inc-now">Current Monthly Income</label>
                <select id="field-inc-now" name="Current monthly income" className="clinical-select" value={formData['Current monthly income']} onChange={handleChange}>
                  <option value="Less than 5000">Less than 5,000</option>
                  <option value="5000 to 10000">5,000 to 10,000</option>
                  <option value="10000 to 20000">10,000 to 20,000</option>
                  <option value="20000 to 30000">20,000 to 30,000</option>
                  <option value="More than 30000">More than 30,000</option>
                  <option value="Missing">Prefer not to answer</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-husband-edu">Husband / Partner Education</label>
                <select id="field-husband-edu" name="Husband's education level" className="clinical-select" value={formData["Husband's education level"]} onChange={handleChange}>
                  <option value="Primary School">Primary School</option>
                  <option value="High School">High School</option>
                  <option value="College">College / Diploma</option>
                  <option value="University">University / Postgraduate</option>
                  <option value="Missing">Prefer not to answer / N/A</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-husband-inc">Husband / Partner Income</label>
                <select id="field-husband-inc" name="Husband’s monthly income" className="clinical-select" value={formData['Husband’s monthly income']} onChange={handleChange}>
                  <option value="Less than 5000">Less than 5,000</option>
                  <option value="5000 to 10000">5,000 to 10,000</option>
                  <option value="10000 to 20000">10,000 to 20,000</option>
                  <option value="20000 to 30000">20,000 to 30,000</option>
                  <option value="More than 30000">More than 30,000</option>
                  <option value="Missing">Prefer not to answer / N/A</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-addiction">Substance Addiction History</label>
                <select id="field-addiction" name="Addiction" className="clinical-select" value={formData['Addiction']} onChange={handleChange}>
                  <option value="Missing">None / Prefer not to say</option>
                  <option value="Smoking">Smoking / Tobacco</option>
                  <option value="Drinking">Alcohol</option>
                  <option value="Drugs">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'obstetrics' && (
          <div>
            <div className="clinical-form-card-header">
              <h2 className="clinical-card-title">Pregnancy, Delivery &amp; Medical History</h2>
              <p className="clinical-card-desc">Obstetric events and maternal health background.</p>
            </div>
            <div className="clinical-grid">
              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-pregnancy-num">Number of This Pregnancy</label>
                <input
                  id="field-pregnancy-num"
                  type="number"
                  name="Number of the latest pregnancy"
                  className="clinical-input"
                  min="1"
                  max="10"
                  value={formData['Number of the latest pregnancy'] || '1'}
                  onChange={handleChange}
                />
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-total-children">Total Living Children</label>
                <select id="field-total-children" name="Total children" className="clinical-select" value={formData['Total children']} onChange={handleChange}>
                  <option value="One">One child</option>
                  <option value="Two">Two children</option>
                  <option value="More than two">More than two children</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-older-age">Age of Immediate Older Child</label>
                <select id="field-older-age" name="Age of immediate older children" className="clinical-select" value={formData['Age of immediate older children']} onChange={handleChange}>
                  <option value="Missing">First baby (None) / Prefer not to say</option>
                  <option value="1yr to 3yr">1 to 3 years</option>
                  <option value="4yr to 6yr">4 to 6 years</option>
                  <option value="7yr to 12yr">7 to 12 years</option>
                  <option value="13yr or more">13 years or older</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-delivery-mode">Mode of Delivery</label>
                <select id="field-delivery-mode" name="Mode of delivery" className="clinical-select" value={formData['Mode of delivery']} onChange={handleChange}>
                  <option value="Normal Delivery">Normal Vaginal Delivery</option>
                  <option value="Caesarean Section">Caesarean Section (C-Section)</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-preg-length">Gestational Duration at Birth</label>
                <select id="field-preg-length" name="Pregnancy length" className="clinical-select" value={formData['Pregnancy length']} onChange={handleChange}>
                  <option value="9 months">Full Term (9 months)</option>
                  <option value="10 months">Post-Term (10 months)</option>
                  <option value="8 months">32-36 weeks (8 months)</option>
                  <option value="7 months">28-31 weeks (7 months)</option>
                  <option value="6 months">Pre-term (6 months)</option>
                  <option value="Less than 5 months">Less than 5 months</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-loss-hist">History of Pregnancy Loss</label>
                <select id="field-loss-hist" name="History of pregnancy loss" className="clinical-select" value={formData['History of pregnancy loss']} onChange={handleChange}>
                  <option value="Missing">None / Prefer not to say</option>
                  <option value="Miscarriage">Miscarriage</option>
                  <option value="Still-born Delivery">Still-born Delivery</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-planned">Was This Pregnancy Planned?</label>
                <select id="field-planned" name="Pregnancy plan" className="clinical-select" value={formData['Pregnancy plan']} onChange={handleChange}>
                  <option value="Yes">Yes, planned</option>
                  <option value="No">No, unplanned / unexpected</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-checkups">Attended Regular Antenatal Checkups</label>
                <select id="field-checkups" name="Regular checkups" className="clinical-select" value={formData['Regular checkups']} onChange={handleChange}>
                  <option value="Yes">Yes, regularly</option>
                  <option value="No">No, irregular / missed</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-birth-compliancy">Delivery Without Acute Complications</label>
                <select id="field-birth-compliancy" name="Birth compliancy" className="clinical-select" value={formData['Birth compliancy']} onChange={handleChange}>
                  <option value="Yes">Yes, uncomplicated</option>
                  <option value="No">No, acute complications arose</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-disease-before">Pre-existing Medical Illness</label>
                <select id="field-disease-before" name="Disease before pregnancy" className="clinical-select" value={formData['Disease before pregnancy']} onChange={handleChange}>
                  <option value="Missing">None / Prefer not to say</option>
                  <option value="Chronic Disease">Chronic Condition (Thyroid, Diabetes, etc.)</option>
                  <option value="Non-Chronic Disease">Other Medical History</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-disease-during">Complications During Pregnancy</label>
                <select id="field-disease-during" name="Diseases during pregnancy" className="clinical-select" value={formData['Diseases during pregnancy']} onChange={handleChange}>
                  <option value="Missing">None / Normal</option>
                  <option value="Chronic Disease">Gestational Complication (Preeclampsia, GDM, etc.)</option>
                  <option value="Non-Chronic Disease">Other Infection / Temporary Illness</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-losses">Major Life Losses or Disruption in Pregnancy</label>
                <select id="field-losses" name="Major changes or losses during pregnancy" className="clinical-select" value={formData['Major changes or losses during pregnancy']} onChange={handleChange}>
                  <option value="No">No</option>
                  <option value="Yes">Yes (bereavement, relocation, financial crisis)</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-fear">Intense Anxiety or Fear of Pregnancy</label>
                <select id="field-fear" name="Fear of pregnancy" className="clinical-select" value={formData['Fear of pregnancy']} onChange={handleChange}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-dep-before">Prior Depression History (Before Pregnancy)</label>
                <select id="field-dep-before" name="Depression before pregnancy (PHQ2)" className="clinical-select" value={formData['Depression before pregnancy (PHQ2)']} onChange={handleChange}>
                  <option value="Negative">No history / Negative</option>
                  <option value="Positive">Yes / Diagnosed or felt depressed</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-dep-during">Depressive Feelings During Pregnancy</label>
                <select id="field-dep-during" name="Depression during pregnancy (PHQ2)" className="clinical-select" value={formData['Depression during pregnancy (PHQ2)']} onChange={handleChange}>
                  <option value="Negative">No / Negative</option>
                  <option value="Positive">Yes / Experienced antenatal depression</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'newborn' && (
          <div>
            <div className="clinical-form-card-header">
              <h2 className="clinical-card-title">Baby Details, Feeding &amp; Early Bonding</h2>
              <p className="clinical-card-desc">Infant health status and maternal-infant interaction factors.</p>
            </div>
            <div className="clinical-grid">
              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-baby-age">Current Age of Baby</label>
                <select id="field-baby-age" name="Age of newborn" className="clinical-select" value={formData['Age of newborn']} onChange={handleChange}>
                  <option value="0 to 6 months">0 to 6 months</option>
                  <option value="6 months to 1 year">6 months to 1 year</option>
                  <option value="1 year to 1.5 year">1 to 1.5 years</option>
                  <option value="Older than 1.5 year">Older than 1.5 years</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-baby-gender">Baby Gender</label>
                <select id="field-baby-gender" name="Gender of newborn" className="clinical-select" value={formData['Gender of newborn']} onChange={handleChange}>
                  <option value="Girl">Girl</option>
                  <option value="Boy">Boy</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-breastfeed">Currently Breastfeeding</label>
                <select id="field-breastfeed" name="Breastfeed" className="clinical-select" value={formData['Breastfeed']} onChange={handleChange}>
                  <option value="Yes">Yes</option>
                  <option value="No">No / Formula Feeding</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-baby-illness">Baby Experienced Neonatal Illness</label>
                <select id="field-baby-illness" name="Newborn illness" className="clinical-select" value={formData['Newborn illness']} onChange={handleChange}>
                  <option value="No">No</option>
                  <option value="Yes">Yes (NICU stay, jaundice, infection)</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-worry-baby">Persistent Worry About Baby&apos;s Health</label>
                <select id="field-worry-baby" name="Worry about newborn" className="clinical-select" value={formData['Worry about newborn']} onChange={handleChange}>
                  <option value="No">No, feeling reassured</option>
                  <option value="Yes">Yes, frequent health worries</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-mother-bond">How Would You Describe Your Bond With Baby?</label>
                <select id="field-mother-bond" name="Relationship with the newborn" className="clinical-select" value={formData['Relationship with the newborn']} onChange={handleChange}>
                  <option value="Very good">Very warm &amp; strong bond</option>
                  <option value="Good">Good</option>
                  <option value="Neutral">Neutral / Developing slowly</option>
                  <option value="Bad">Difficult / Struggling to connect</option>
                </select>
              </div>

              <div className="clinical-field-group">
                <label className="clinical-label" htmlFor="field-father-bond">Father&apos;s Connection With Baby</label>
                <select id="field-father-bond" name="Relationship between father and newborn" className="clinical-select" value={formData['Relationship between father and newborn']} onChange={handleChange}>
                  <option value="Very good">Very warm &amp; engaged</option>
                  <option value="Good">Good</option>
                  <option value="Neutral">Neutral / Less involved</option>
                  <option value="Bad">Strained / Distant</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wellbeing' && (
          <div>
            <div className="clinical-form-card-header">
              <h2 className="clinical-card-title">Daily Functioning &amp; Personal Safety</h2>
              <p className="clinical-card-desc">Personal safety indicators and baseline daily energy.</p>
            </div>
            <div className="clinical-grid">
              <div className="clinical-field-group is-fullwidth">
                <label className="clinical-label" htmlFor="field-abuse">Have You Experienced Domestic, Verbal or Emotional Abuse?</label>
                <span className="clinical-sublabel">Your response is kept strictly confidential from partners and family.</span>
                <select id="field-abuse" name="Abuse" className="clinical-select" value={formData['Abuse']} onChange={handleChange}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="Missing">Prefer not to answer</option>
                </select>
              </div>

              <div className="clinical-field-group is-fullwidth">
                <label className="clinical-label" htmlFor="field-activity-feeling">Daily Energy and Motivation for Regular Activities</label>
                <select id="field-activity-feeling" name="Feeling for regular activities" className="clinical-select" value={formData['Feeling for regular activities']} onChange={handleChange}>
                  <option value="Missing">Normal / Manageable</option>
                  <option value="Tired">Constantly exhausted / Low energy</option>
                  <option value="Worried">Preoccupied with anxious thoughts</option>
                  <option value="Afraid">Fearful / Panicky about tasks</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="clinical-bottom-actions">
          <button
            type="button"
            className="clinical-btn-secondary"
            onClick={() => navigate('/patient/dashboard')}
          >
            Back to Dashboard
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab !== 'wellbeing' && (
              <button
                type="button"
                className="clinical-btn-secondary"
                onClick={() => {
                  if (activeTab === 'demographics') setActiveTab('obstetrics');
                  else if (activeTab === 'obstetrics') setActiveTab('newborn');
                  else if (activeTab === 'newborn') setActiveTab('wellbeing');
                }}
              >
                Next Section &rsaquo;
              </button>
            )}

            <button
              type="submit"
              className="clinical-btn-primary"
              disabled={isSaving}
            >
              <PatientIcon name="check" size={15} />
              <span>{isSaving ? 'Saving Profile...' : 'Save Clinical Profile'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
