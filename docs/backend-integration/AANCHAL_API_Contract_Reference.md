# AANCHAL — API Contract Reference

**Project:** AANCHAL (Perinatal Depression Screening & Care Platform)  
**Frontend Branch:** `frontend-changes-1`  
**Base Commit:** `0a74dd6`  
**Document Version:** 1.0.0  
**Target Backend:** FastAPI + SQLAlchemy + PostgreSQL (with SQLite development fallback)

---

## Quick Reference Summary Table

| Category | HTTP Method | Endpoint URL | Status | Roles Permitted |
| :--- | :---: | :--- | :---: | :---: |
| **Auth** | `POST` | `/api/auth/login` | **IMPLEMENTED** | All (`patient`, `doctor`, `hospital`, `family`, `admin`) |
| **Auth** | `POST` | `/api/auth/register` | **IMPLEMENTED** | Public (`patient`, `doctor`, `family`) |
| **Auth** | `POST` | `/api/hospital/login` | **IMPLEMENTED** | `hospital`, `admin` |
| **Patient Profile** | `GET` | `/api/patients/me` | **IMPLEMENTED** | `patient` |
| **Patient Profile** | `PUT` | `/api/patients/me` | **IMPLEMENTED** | `patient` |
| **Medical History** | `GET` | `/api/patients/me/medical-history` | **IMPLEMENTED** | `patient` |
| **Medical History** | `PUT` | `/api/patients/me/medical-history` | **IMPLEMENTED** | `patient` |
| **EPDS Screening** | `POST` | `/api/patients/me/screenings` | **IMPLEMENTED** | `patient` |
| **Screening List** | `GET` | `/api/patients/me/screenings` | **IMPLEMENTED** | `patient` |
| **Screening Video**| `POST` | `/api/patients/me/screenings/{id}/video` | **IMPLEMENTED** | `patient` |
| **Screening Video**| `GET` | `/api/patients/me/screenings/{id}/video` | **IMPLEMENTED** | `patient`, `doctor` |
| **Multimodal ML** | `POST` | `/api/screenings/multimodal/analyze` | **IMPLEMENTED** | `patient`, `doctor`, `family` |
| **Screening Report**| `GET` | `/api/patients/me/screenings/{id}/report.pdf` | **IMPLEMENTED** | `patient` |
| **Doctor Directory**| `GET` | `/api/doctors` | **PROPOSED** | Public / All authenticated |
| **Hospital Directory**| `GET`| `/api/hospitals` | **PROPOSED** | Public / All authenticated |
| **Appointment Req**| `POST` | `/api/patients/me/appointments` | **IMPLEMENTED** | `patient` |
| **Appointment List**| `GET` | `/api/patients/me/appointments` | **IMPLEMENTED** | `patient` |
| **Hospital Appts** | `GET` | `/api/hospital/appointments` | **IMPLEMENTED** | `hospital` |
| **Hospital Appt Det**| `GET`| `/api/hospital/appointments/{id}` | **IMPLEMENTED** | `hospital` |
| **Appt Status** | `PUT` | `/api/hospital/appointments/{id}/status` | **IMPLEMENTED** | `hospital` |
| **Assign Doctor** | `PUT` | `/api/hospital/appointments/{id}/assign` | **IMPLEMENTED** | `hospital` |
| **Hospital Doctors**| `GET`| `/api/hospital/doctors` | **IMPLEMENTED** | `hospital` |
| **Create Report** | `POST` | `/api/consultation-reports` | **IMPLEMENTED** | `doctor`, `clinician`, `admin` |
| **List Reports (Doc)**| `GET`| `/api/consultation-reports` | **IMPLEMENTED** | `doctor`, `clinician` |
| **Hospital Reports**| `GET` | `/api/hospital/reports` | **IMPLEMENTED** | `hospital` |
| **Hospital Rep Det**| `GET` | `/api/hospital/reports/{id}` | **IMPLEMENTED** | `hospital` |
| **Patient Reports** | `GET` | `/api/patients/me/consultation-reports` | **IMPLEMENTED** | `patient` |
| **Notifications** | `GET` | `/api/patients/me/notifications` | **IMPLEMENTED** | `patient` |
| **Care Plan Tasks**| `PUT` | `/api/patients/me/care-plan/tasks/{task_id}`| **IMPLEMENTED** | `patient` |

---

## Detailed Contract Specifications

### 1. Authentication & Session

#### `POST /api/auth/login`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/auth/authService.js`, `src/LoginScreen.jsx`
- **Backend Handler:** `backend.routers.auth.login_user`
- **Headers:** `Content-Type: application/json`
- **Role Requirement:** Unauthenticated; validates selected portal role against user record.
- **Request Body:**
```json
{
  "email": "doctor@miora.health",
  "password": "password123",
  "selected_role": "doctor"
}
```
- **Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "redirect_url": "/mothers",
  "user": {
    "id": "e89c6d48-6a38-4e11-85b9-123456789abc",
    "email": "doctor@miora.health",
    "name": "Dr. Elena Rostova",
    "role": "doctor",
    "mother_id": null
  }
}
```
- **Error `403 Forbidden` (Role Mismatch):**
```json
{
  "detail": "Access denied: This account is registered as a Patient. Please select Patient to sign in."
}
```

---

#### `POST /api/auth/register`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/auth/authService.js`, `src/CreateAccountScreen.jsx`
- **Backend Handler:** `backend.routers.auth.register_user`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "email": "amara.k@example.com",
  "password": "password123",
  "name": "Amara K.",
  "full_name": "Amara K.",
  "role": "patient",
  "patient_email": null
}
```
- **Response `200 OK`:** Returns new user object and signed `access_token`.

---

#### `POST /api/hospital/login`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/hospital/hospitalService.js`, `src/HospitalLoginScreen.jsx`
- **Backend Handler:** `backend.routers.hospital.hospital_login`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "email_or_id": "HOSP-001",
  "password": "password123"
}
```
- **Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "hospital": {
    "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "hospital_id": "HOSP-001",
    "hospital_name": "Apollo Women's Hospital",
    "hospital_location": "Bangalore, Karnataka",
    "email": "apollo@hospital.miora.health",
    "role": "hospital"
  }
}
```

---

### 2. Patient Profile & Medical History

#### `GET /api/patients/me`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/context/PatientContext.jsx`
- **Backend Handler:** `backend.routers.patients.get_patient_profile`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `patient`
- **Response `200 OK`:**
```json
{
  "id": "M-108",
  "mother_uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Amara K.",
  "email": "patient@miora.health",
  "phone": "+91-98765-43210",
  "age": 28,
  "postpartum_week": 6,
  "pregnancy_type": "singleton",
  "delivery_date": "2026-10-06",
  "assigned_doctor": "Dr. Elena Rostova",
  "clinic": "Apollo Women's Hospital"
}
```

---

#### `PUT /api/patients/me`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/pages/PatientProfilePage.jsx`
- **Backend Handler:** `backend.routers.patients.update_patient_profile`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Amara Kapoor",
  "phone": "+91-98765-43210",
  "postpartum_week": 7,
  "emergency_contact_name": "Raj Kapoor",
  "emergency_contact_phone": "+91-98765-00000"
}
```
- **Response `200 OK`:** Returns updated profile object.

---

#### `GET /api/patients/me/medical-history` & `PUT /api/patients/me/medical-history`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/pages/MedicalHistoryScreen.jsx`
- **Backend Handler:** `backend.routers.patients.get_patient_medical_history`, `update_patient_medical_history`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body (PUT):**
```json
{
  "prior_ppd_diagnosis": "yes",
  "prior_depression_episodes": 1,
  "family_history_mood_disorders": "maternal_aunt",
  "current_medications": "Magnesium Glycinate, Prenatal multivitamins",
  "delivery_complications": "None",
  "notes": "Mild insomnia prior to pregnancy."
}
```

---

### 3. Screening Sessions & Media Processing

#### `POST /api/patients/me/screenings`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/context/PatientContext.jsx`
- **Backend Handler:** `backend.routers.patients.submit_and_save_screening`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Role Requirement:** `patient`
- **Request Body:**
```json
{
  "answers": {
    "q1": 1, "q2": 2, "q3": 1, "q4": 0, "q5": 2,
    "q6": 1, "q7": 2, "q8": 1, "q9": 1, "q10": 0
  },
  "notes": "Completed session after evening feed.",
  "video_metadata": {
    "duration": 184.2,
    "format": "video/webm"
  },
  "question_timestamps": [
    { "question_id": "q1", "start_sec": 0.0, "end_sec": 14.5 },
    { "question_id": "q2", "start_sec": 15.0, "end_sec": 32.1 }
  ]
}
```
- **Response `200 OK`:**
```json
{
  "screening_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "total_score": 11,
  "risk_category": "Moderate Risk",
  "q10_alert": false,
  "created_at": "2026-11-22T08:30:00Z"
}
```

---

#### `POST /api/patients/me/screenings/{screening_id}/video`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/pages/PatientScreeningPage.jsx`
- **Backend Handler:** `backend.routers.patients.upload_screening_video`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `video_file`: Binary file Blob (`.webm` or `.mp4`)
  - `duration_seconds`: `184.5`
  - `question_timestamps`: JSON stringified array of `{ question_id, start_sec, end_sec }`
- **Response `200 OK`:**
```json
{
  "message": "Continuous screening video successfully uploaded and securely archived.",
  "screening_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "video_duration_seconds": 184.5,
  "file_size_bytes": 14529812
}
```

---

#### `POST /api/screenings/multimodal/analyze`
- **Status:** **`IMPLEMENTED`** (Models load at startup; returns research risk score and modality statuses)
- **Consumer Files:** `src/dashboard/services/screeningAnalysisService.js`
- **Backend Handler:** `backend.routers.screening.analyze_multimodal_screening`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `motherId`: string UUID
  - `consentConfirmed`: `"true"`
  - `text_content`: string maternal self-report
  - `files_voice`: optional audio `.wav`
  - `files_video`: optional video `.webm`
  - `audio_features`: optional JSON string containing 7 physiological acoustic features
  - `video_features`: optional JSON string containing 220 summary statistics
- **Response `200 OK`:**
```json
{
  "multimodal_risk_score": 0.42,
  "cross_modal_disagreement": false,
  "disagreement_details": "Modality predictions are concordant within tolerance.",
  "modality_scores": {
    "text_score": 0.38,
    "audio_score": null,
    "video_score": null
  },
  "modality_statuses": {
    "text": "completed",
    "audio": "unavailable",
    "video": "unavailable"
  },
  "pipeline_version": "1.0.0-stage1-research"
}
```

---

### 4. Doctor & Hospital Directories

#### `GET /api/doctors`
- **Status:** **`PROPOSED — BACKEND IMPLEMENTATION REQUIRED`**
- **Consumer Files:** `src/patient/pages/FindDoctorPage.jsx` (currently consumes `sampleDoctors.js`)
- **Query Parameters (Optional):** `?location=Bangalore&specialization=Perinatal+Psychiatry`
- **Response `200 OK`:**
```json
[
  {
    "doctorId": "DR-001",
    "hospitalId": "HOSP-001",
    "name": "Dr. Priya Mehta",
    "initials": "PM",
    "specialization": "Perinatal Psychiatry",
    "subspecialties": ["Postpartum Depression", "Perinatal Anxiety", "Maternal Mental Health"],
    "yearsExperience": 14,
    "availability": "Mon, Wed, Fri · 10:00 AM – 2:00 PM",
    "consultationTypes": ["In-person", "Telehealth"],
    "timeSlots": ["10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM"],
    "hospital": {
      "hospitalId": "HOSP-001",
      "name": "Apollo Women's Hospital",
      "location": "Bangalore, Karnataka",
      "address": "154, Bannerghatta Road, Bangalore — 560 029",
      "phone": "+91 80-2222-3333"
    }
  }
]
```

---

#### `GET /api/hospitals`
- **Status:** **`PROPOSED — BACKEND IMPLEMENTATION REQUIRED`**
- **Consumer Files:** `src/patient/pages/FindDoctorPage.jsx`, `src/patient/data/sampleDoctors.js`
- **Response `200 OK`:**
```json
[
  {
    "hospitalId": "HOSP-001",
    "name": "Apollo Women's Hospital",
    "location": "Bangalore, Karnataka",
    "address": "154, Bannerghatta Road, Bangalore — 560 029",
    "phone": "+91 80-2222-3333"
  },
  {
    "hospitalId": "HOSP-002",
    "name": "Cloudnine Hospitals",
    "location": "Hyderabad, Telangana",
    "address": "Plot No. 11, Kondapur, Hyderabad — 500 084",
    "phone": "+91 40-6677-8899"
  }
]
```

---

### 5. Appointments & Hospital Triage

#### `POST /api/patients/me/appointments`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/pages/AppointmentBookingPage.jsx`
- **Backend Handler:** `backend.routers.patients.book_patient_appointment`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Role Requirement:** `patient`
- **Request Body:**
```json
{
  "doctor_name": "Dr. Priya Mehta",
  "doctor_id": "DR-001",
  "role": "Perinatal Psychiatry",
  "hospital_id": "HOSP-001",
  "hospital_name": "Apollo Women's Hospital",
  "hospital_location": "Bangalore, Karnataka",
  "phone": "+91-98765-43210",
  "date": "2026-11-28",
  "time": "11:00 AM",
  "type": "In-person",
  "clinic": "Apollo Women's Hospital",
  "reason": "Feeling constantly anxious and unable to sleep."
}
```
- **Response `200 OK`:**
```json
{
  "id": "appt-7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "doctorName": "Dr. Priya Mehta",
  "role": "Perinatal Psychiatry",
  "date": "2026-11-28",
  "time": "11:00 AM",
  "status": "pending",
  "type": "In-person",
  "clinic": "Apollo Women's Hospital",
  "created_at": "2026-11-22T08:45:00Z"
}
```

---

#### `GET /api/hospital/appointments`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/hospital/hospitalService.js`, `src/hospital/HospitalAppointmentsPage.jsx`
- **Backend Handler:** `backend.routers.hospital.list_hospital_appointments`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `hospital`
- **Query Parameter (Optional):** `?status_filter=pending` (or `confirmed`, `completed`, `cancelled`, `all`)
- **Response `200 OK`:**
```json
[
  {
    "id": "appt-7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "mother_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "patient_name": "Amara K.",
    "patient_phone": "+91-98765-43210",
    "requested_doctor_id": "DR-001",
    "requested_doctor_name": "Dr. Priya Mehta",
    "assigned_doctor_id": "DR-001",
    "assigned_doctor_name": "Dr. Priya Mehta",
    "hospital_id": "HOSP-001",
    "hospital_name": "Apollo Women's Hospital",
    "requested_date": "28 Nov 2026",
    "requested_time": "11:00 AM",
    "confirmed_date": null,
    "confirmed_time": null,
    "proposed_date": null,
    "proposed_time": null,
    "status": "pending",
    "type": "In-person",
    "reason": "Feeling constantly anxious and unable to sleep.",
    "hospital_notes": null,
    "created_at": "2026-11-22T08:45:00Z"
  }
]
```

---

#### `PUT /api/hospital/appointments/{id}/status`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/hospital/hospitalService.js`, `src/hospital/HospitalAppointmentDetailPage.jsx`
- **Backend Handler:** `backend.routers.hospital.update_appointment_status`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Role Requirement:** `hospital`
- **Request Body:**
```json
{
  "action": "propose_alternative",
  "proposed_date": "30 Nov 2026",
  "proposed_time": "02:00 PM",
  "notes": "Clinic closed for holiday on 28th."
}
```
*(Valid `action` values: `"accept"`, `"reject"`, `"propose_alternative"`, `"cancel"`)*
- **Response `200 OK`:** Returns updated `HospitalAppointmentItem`.

---

#### `PUT /api/hospital/appointments/{id}/assign`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/hospital/hospitalService.js`, `src/hospital/HospitalAppointmentDetailPage.jsx`
- **Backend Handler:** `backend.routers.hospital.assign_doctor`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Role Requirement:** `hospital`
- **Request Body:**
```json
{
  "doctor_id": "DR-005",
  "doctor_name": "Dr. Elena Rostova"
}
```
- **Response `200 OK`:** Returns updated appointment with `assigned_doctor_id` and `assigned_doctor_name`.

---

### 6. Clinical Consultation Reports

#### `POST /api/consultation-reports`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/dashboard/pages/CreateConsultationReportPage.jsx`
- **Backend Handler:** `backend.routers.consultation_reports.create_consultation_report`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Role Requirement:** `doctor`, `clinician`, `admin`
- **Request Body:**
```json
{
  "patient_identifier": "M-108",
  "patient_name": "Amara K.",
  "appointment_id": "appt-7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "doctor_id": "DR-005",
  "doctor_name": "Dr. Elena Rostova",
  "doctor_specialization": "Perinatal Psychiatry Lead",
  "hospital_id": "HOSP-001",
  "hospital_name": "Apollo Women's Hospital",
  "department": "Perinatal Mental Health",
  "consultation_date": "22 Nov 2026",
  "presenting_complaints": "Low mood, fragmented sleep under 4 continuous hours, crying spells especially in evenings over past 3 weeks.",
  "clinical_observations": "Patient is cooperative, affect is constricted and mildly dysphoric. Thought processes coherent, denied active suicidal ideation (EPDS Item 10 score 0). Insight preserved.",
  "clinical_assessment": "Postpartum depression with mild-to-moderate emotional exhaustion and sleep fragmentation (ICD-10 F53.0).",
  "treatment_plan": "Supportive CBT (6 sessions) + family sleep restoration.",
  "medications": "No pharmacotherapy indicated at this stage. Prenatal vitamins and magnesium glycinate (200mg nightly) for sleep hygiene.",
  "recommendations": "Daily 4-7-8 breathing exercises. Partner to manage 1-2 nighttime feeds.",
  "followup_instructions": "Review in 3 weeks. Contact clinic or Tele-MANAS (14416) immediately if distress increases.",
  "next_followup_date": "13 Dec 2026 at 11:00 AM",
  "additional_notes": "Husband Raj is supportive. Patient is receptive to non-pharmacological care.",
  "ai_screening_summary": "Acoustic prosody flat. EPDS equivalent score 14/30.",
  "epds_summary": "EPDS Total: 14/30. Item 10: 0.",
  "status": "final",
  "patient_friendly_summary": "During your consultation on 22 Nov 2026, Dr. Elena Rostova reviewed your emotional wellbeing and discussed your sleep challenges and low mood. We agreed on a gentle, supportive plan focused on getting more continuous rest and daily relaxation.",
  "patient_friendly_medications": "Continue your regular daily vitamins. Magnesium glycinate (200mg) before bed can help relax your body for sleep.",
  "patient_friendly_recommendations": "Practice your 4-7-8 breathing exercises daily. Ask your partner or family to help take over one nighttime feed so you can get at least 5 hours of unbroken sleep.",
  "patient_friendly_followup": "Your next check-in is scheduled for 13 Dec 2026 at 11:00 AM. If you feel overwhelmed before then, please message us or reach out anytime.",
  "approve_patient_version": true
}
```
- **Response `200 OK`:**
```json
{
  "id": "e4b02534-1188-4c12-bd77-0d92f58e1c39",
  "report_code": "REP-2026-002",
  "patient_identifier": "M-108",
  "doctor_name": "Dr. Elena Rostova",
  "hospital_name": "Apollo Women's Hospital",
  "status": "final",
  "patient_approved": true,
  "created_at": "2026-11-22T08:50:00Z"
}
```

---

#### `GET /api/hospital/reports`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/hospital/hospitalService.js`, `src/hospital/HospitalReportsPage.jsx`
- **Backend Handler:** `backend.routers.hospital.list_hospital_reports`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `hospital`
- **Query Parameters (Optional):** `?search=Amara&doctor=Dr.+Elena+Rostova&status_filter=final&date_filter=2026-11-22`
- **Response `200 OK`:**
```json
[
  {
    "id": "e4b02534-1188-4c12-bd77-0d92f58e1c39",
    "report_code": "REP-2026-002",
    "patient_name": "Amara K.",
    "patient_identifier": "M-108",
    "doctor_name": "Dr. Elena Rostova",
    "doctor_specialization": "Perinatal Psychiatry Lead",
    "hospital_name": "Apollo Women's Hospital",
    "department": "Perinatal Mental Health",
    "appointment_date": "22 Nov 2026",
    "submission_date": "22 Nov 2026",
    "status": "final",
    "created_at": "2026-11-22T08:50:00Z"
  }
]
```

---

#### `GET /api/hospital/reports/{report_id}`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/hospital/hospitalService.js`, `src/hospital/HospitalReportDetailPage.jsx`
- **Backend Handler:** `backend.routers.hospital.get_hospital_report_detail`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `hospital`
- **Response `200 OK`:** Returns full clinical record including `clinical_observations`, `clinical_assessment`, `treatment_plan`, `medications`, and private `additional_notes`.

---

#### `GET /api/patients/me/consultation-reports`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/pages/PatientReportsPage.jsx`
- **Backend Handler:** `backend.routers.patients.get_patient_consultation_reports`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `patient`
- **Security Filter:** Only returns reports where `patient_approved == True` and `status == "final"`.
- **Response `200 OK`:**
```json
[
  {
    "id": "e4b02534-1188-4c12-bd77-0d92f58e1c39",
    "report_code": "REP-2026-002",
    "doctor_name": "Dr. Elena Rostova",
    "doctor_specialization": "Perinatal Psychiatry Lead",
    "hospital_name": "Apollo Women's Hospital",
    "consultation_date": "22 Nov 2026",
    "summary": "During your consultation on 22 Nov 2026, Dr. Elena Rostova reviewed your emotional wellbeing and discussed your sleep challenges and low mood. We agreed on a gentle, supportive plan focused on getting more continuous rest and daily relaxation.",
    "medications_instructions": "Continue your regular daily vitamins. Magnesium glycinate (200mg) before bed can help relax your body for sleep.",
    "recommendations": "Practice your 4-7-8 breathing exercises daily. Ask your partner or family to help take over one nighttime feed so you can get at least 5 hours of unbroken sleep.",
    "followup_instructions": "Your next check-in is scheduled for 13 Dec 2026 at 11:00 AM. If you feel overwhelmed before then, please message us or reach out anytime.",
    "next_followup_date": "13 Dec 2026 at 11:00 AM",
    "submitted_at": "22 Nov 2026"
  }
]
```
> [!NOTE]
> `additional_notes`, raw diagnostic codes, and unapproved draft notes are excluded by the serializer to ensure patient mental health safety.

---

### 7. Notifications & Self-Care Tasks

#### `GET /api/patients/me/notifications`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/context/PatientContext.jsx`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `patient`
- **Response `200 OK`:**
```json
[
  {
    "id": "notif-001",
    "title": "Consultation Report Ready",
    "message": "Dr. Elena Rostova has shared your consultation summary and wellbeing recommendations.",
    "date": "22 Nov 2026",
    "read": false
  }
]
```

---

#### `PUT /api/patients/me/care-plan/tasks/{task_id}`
- **Status:** **`IMPLEMENTED`**
- **Consumer Files:** `src/patient/services/patientApiService.js`, `src/patient/context/PatientContext.jsx`
- **Headers:** `Authorization: Bearer <token>`
- **Role Requirement:** `patient`
- **Response `200 OK`:** Returns updated array of care plan tasks with toggled `completed` state.

---

*Authored for the AANCHAL Perinatal Screening Engineering Team — 22 Nov 2026.*
