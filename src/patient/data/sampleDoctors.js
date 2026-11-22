/**
 * SAMPLE DOCTOR & HOSPITAL RECORDS — Frontend Development Demonstration Only
 *
 * These are entirely fictional records for UI development and testing.
 * No real doctors, hospitals, qualifications, or clinical credentials are
 * represented here. All data is fabricated for demonstration purposes.
 *
 * INTEGRATION NOTE: Replace SAMPLE_DOCTORS and SAMPLE_HOSPITALS with a
 * verified API call (e.g. GET /api/doctors?location=...) when the backend is
 * ready. The shape of each record should remain identical so the UI requires
 * no changes.
 *
 * DATA PRIVACY: No patient screening responses, EPDS scores, or personal
 * health information are stored in or transmitted via this module.
 */

/** @typedef {Object} Hospital
 * @property {string} hospitalId   - Stable unique ID (format: HOSP-NNN)
 * @property {string} name         - Display name
 * @property {string} location     - City, State
 * @property {string} address      - Full street address
 * @property {string} phone        - Main switchboard number
 */

/** @typedef {Object} Doctor
 * @property {string}   doctorId          - Stable unique ID (format: DR-NNN)
 * @property {string}   hospitalId        - References a SAMPLE_HOSPITALS key
 * @property {string}   name              - Full name with title
 * @property {string}   initials          - For avatar fallback
 * @property {string}   specialization    - Primary specialty label
 * @property {string[]} subspecialties    - Focus areas shown as tags
 * @property {number}   yearsExperience
 * @property {string}   availability      - Human-readable schedule string
 * @property {string[]} consultationTypes - e.g. ['In-person', 'Telehealth']
 * @property {string[]} timeSlots         - Available slot labels
 * @property {boolean}  demoFlag          - Always true; shown as disclaimer
 */

export const SAMPLE_HOSPITALS = {
  'HOSP-001': {
    hospitalId: 'HOSP-001',
    name: 'Apollo Women\'s Hospital',
    location: 'Bangalore, Karnataka',
    address: '154, Bannerghatta Road, Bangalore — 560 029',
    phone: '+91 80-2222-3333',
  },
  'HOSP-002': {
    hospitalId: 'HOSP-002',
    name: 'Cloudnine Hospitals',
    location: 'Hyderabad, Telangana',
    address: 'Plot No. 11, Kondapur, Hyderabad — 500 084',
    phone: '+91 40-6677-8899',
  },
  'HOSP-003': {
    hospitalId: 'HOSP-003',
    name: 'Rainbow Children\'s Hospital',
    location: 'Chennai, Tamil Nadu',
    address: '22, Vijayaraghava Road, T. Nagar, Chennai — 600 017',
    phone: '+91 44-7101-0101',
  },
  'HOSP-004': {
    hospitalId: 'HOSP-004',
    name: 'Motherhood Hospitals',
    location: 'Mumbai, Maharashtra',
    address: 'B-5, Linking Road, Santacruz West, Mumbai — 400 054',
    phone: '+91 22-6922-0022',
  },
};

export const SAMPLE_DOCTORS = [
  {
    doctorId: 'DR-001',
    hospitalId: 'HOSP-001',
    name: 'Dr. Priya Mehta',
    initials: 'PM',
    specialization: 'Perinatal Psychiatry',
    subspecialties: ['Postpartum Depression', 'Perinatal Anxiety', 'Maternal Mental Health'],
    yearsExperience: 14,
    availability: 'Mon, Wed, Fri · 10:00 AM – 2:00 PM',
    consultationTypes: ['In-person', 'Telehealth'],
    timeSlots: ['10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM'],
    demoFlag: true,
  },
  {
    doctorId: 'DR-002',
    hospitalId: 'HOSP-002',
    name: 'Dr. Ananya Krishnaswamy',
    initials: 'AK',
    specialization: 'Obstetrics & Maternal Mental Health',
    subspecialties: ['Postpartum Mood Disorders', 'Breastfeeding Support', 'Sleep Health'],
    yearsExperience: 11,
    availability: 'Tue, Thu · 09:00 AM – 1:00 PM',
    consultationTypes: ['In-person', 'Telehealth'],
    timeSlots: ['09:00 AM', '10:30 AM', '12:00 PM'],
    demoFlag: true,
  },
  {
    doctorId: 'DR-003',
    hospitalId: 'HOSP-001',
    name: 'Dr. Suresh Patel',
    initials: 'SP',
    specialization: 'Psychiatry & Psychotherapy',
    subspecialties: ['Postpartum Depression', 'Cognitive Behavioural Therapy', 'Family Therapy'],
    yearsExperience: 18,
    availability: 'Mon – Fri · 02:00 PM – 6:00 PM',
    consultationTypes: ['In-person', 'Telehealth', 'Audio Consult'],
    timeSlots: ['02:00 PM', '03:00 PM', '04:30 PM', '05:30 PM'],
    demoFlag: true,
  },
  {
    doctorId: 'DR-004',
    hospitalId: 'HOSP-003',
    name: 'Dr. Divya Narayan',
    initials: 'DN',
    specialization: 'Clinical Psychology',
    subspecialties: ['Perinatal Psychology', 'Mindfulness Therapy', 'Infant Bonding'],
    yearsExperience: 9,
    availability: 'Wed, Fri, Sat · 10:00 AM – 3:00 PM',
    consultationTypes: ['Telehealth', 'In-person'],
    timeSlots: ['10:00 AM', '11:30 AM', '01:00 PM', '02:30 PM'],
    demoFlag: true,
  },
  {
    doctorId: 'DR-005',
    hospitalId: 'HOSP-002',
    name: 'Dr. Reema Chaudhary',
    initials: 'RC',
    specialization: 'General Psychiatry & Women\'s Health',
    subspecialties: ['Postpartum Care', 'Anxiety Disorders', 'Partner Support'],
    yearsExperience: 7,
    availability: 'Mon, Tue, Thu · 09:30 AM – 1:30 PM',
    consultationTypes: ['Telehealth', 'Audio Consult'],
    timeSlots: ['09:30 AM', '11:00 AM', '12:30 PM'],
    demoFlag: true,
  },
  {
    doctorId: 'DR-006',
    hospitalId: 'HOSP-004',
    name: 'Dr. Kavitha Sundaram',
    initials: 'KS',
    specialization: 'Perinatal Psychiatry & Lactation',
    subspecialties: ['PPD Screening', 'Breastfeeding & Mood', 'Maternal Trauma'],
    yearsExperience: 16,
    availability: 'Mon, Wed, Sat · 09:00 AM – 12:00 PM',
    consultationTypes: ['In-person', 'Telehealth'],
    timeSlots: ['09:00 AM', '10:00 AM', '11:00 AM'],
    demoFlag: true,
  },
];

/**
 * Look up a doctor by their stable doctorId.
 * @param {string} doctorId
 * @returns {Doctor|null}
 */
export function getDoctorById(doctorId) {
  return SAMPLE_DOCTORS.find((d) => d.doctorId === doctorId) || null;
}

/**
 * Look up a hospital by its stable hospitalId.
 * @param {string} hospitalId
 * @returns {Hospital|null}
 */
export function getHospitalById(hospitalId) {
  return SAMPLE_HOSPITALS[hospitalId] || null;
}

/**
 * Returns a combined doctor + hospital record for display.
 * This mirrors what a future /api/doctors/:id endpoint would return.
 * @param {string} doctorId
 * @returns {{ doctor: Doctor, hospital: Hospital }|null}
 */
export function getDoctorWithHospital(doctorId) {
  const doctor = getDoctorById(doctorId);
  if (!doctor) return null;
  const hospital = getHospitalById(doctor.hospitalId);
  return { doctor, hospital };
}
