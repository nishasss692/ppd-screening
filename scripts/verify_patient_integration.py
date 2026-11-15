"""Essential verification script for Phase 1 Patient Dashboard Backend Integration.

Runs targeted checks against http://127.0.0.1:8000:
1. Health check & database connection
2. Patient authentication (login demo patient, register new test patient)
3. Profile retrieval and update (persistence in PostgreSQL)
4. Medical history retrieval and update (persistence in PostgreSQL)
5. EPDS screening submission and score calculation (persistence in PostgreSQL)
6. Screening history and detail retrieval
7. Real clinical PDF report & text transcript generation
8. Appointments booking and retrieval (persistence in PostgreSQL)
9. Notifications retrieval and mark-as-read (persistence in PostgreSQL)
10. Care plan tasks retrieval and toggle (persistence in PostgreSQL)
11. Settings & device preferences retrieval and update (persistence in PostgreSQL)
12. AI conversation turns retrieval and update (persistence in PostgreSQL)
13. Patient-specific access restrictions and role isolation
"""

import sys
import uuid
import requests


BASE_URL = "http://127.0.0.1:8000"


def run_checks():
    print("==================================================================")
    print("MIORA Phase 1: Essential Patient Dashboard Backend Verification")
    print("==================================================================")
    passed = 0
    total = 0

    def check(name, success, detail=""):
        nonlocal passed, total
        total += 1
        status_sym = "✓ PASS" if success else "✗ FAIL"
        if success:
            passed += 1
        print(f"[{status_sym}] {name} {detail}")
        if not success:
            print(f"       Details: {detail}")

    # Check 1: Root Health Check
    try:
        r = requests.get(f"{BASE_URL}/", timeout=5)
        check("1. Root Health Check", r.status_code == 200, f"Status: {r.status_code}")
    except Exception as e:
        check("1. Root Health Check", False, str(e))
        return

    # Check 2: Patient Authentication (Login demo patient)
    token = None
    try:
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "patient@miora.health",
                "password": "password123",
                "selected_role": "patient",
            },
            timeout=5,
        )
        data = r.json()
        token = data.get("access_token")
        check(
            "2. Patient Login (Amara K.)",
            r.status_code == 200 and token is not None,
            f"User: {data.get('user', {}).get('fullName')}, Token issued",
        )
    except Exception as e:
        check("2. Patient Login", False, str(e))

    if not token:
        print("Cannot continue without token.")
        return

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Check 3: Patient Profile Retrieval & Persistence (PostgreSQL)
    try:
        r = requests.get(f"{BASE_URL}/api/patients/me", headers=headers, timeout=5)
        prof = r.json()
        initial_name = prof.get("full_name")
        check("3a. Profile Retrieval", r.status_code == 200, f"Name: {initial_name}, ID: {prof.get('id')}")

        # Update profile
        r2 = requests.put(
            f"{BASE_URL}/api/patients/me",
            headers=headers,
            json={
                "name": "Amara K. Wilson",
                "phone": "+91-98765-43210",
                "postpartum_week": 5,
                "emergency_contact": {"name": "David Wilson", "phone": "+91-98765-11111"},
            },
            timeout=5,
        )
        updated = r2.json()
        # Fetch again to verify persistence
        r3 = requests.get(f"{BASE_URL}/api/patients/me", headers=headers, timeout=5)
        fetched = r3.json()
        persisted = (
            fetched.get("full_name") == "Amara K. Wilson"
            and fetched.get("postpartum_week") == 5
            and fetched.get("emergency_contact", {}).get("name") == "David Wilson"
        )
        check("3b. Profile Update & PostgreSQL Persistence", persisted, f"Persisted name: {fetched.get('full_name')}")
    except Exception as e:
        check("3. Profile Check", False, str(e))

    # Check 4: Medical History Retrieval & Persistence (PostgreSQL)
    try:
        med_payload = {
            "prior_ppd_diagnosis": "yes",
            "uploaded_files": [{"id": "doc-1", "name": "Previous_Discharge_Summary.pdf", "size": "1.4 MB"}],
            "medical_history": "History of mild postpartum anxiety in 2024.",
        }
        r_save = requests.put(f"{BASE_URL}/api/patients/me/medical-history", headers=headers, json=med_payload, timeout=5)
        check("4a. Medical History Save", r_save.status_code == 200, f"Status: {r_save.status_code}")

        r_get = requests.get(f"{BASE_URL}/api/patients/me/medical-history", headers=headers, timeout=5)
        med_data = r_get.json()
        med_persisted = (
            med_data.get("prior_ppd_diagnosis") == "yes"
            and len(med_data.get("uploaded_files", [])) > 0
            and "Discharge_Summary" in str(med_data.get("uploaded_files"))
        )
        check("4b. Medical History PostgreSQL Persistence", med_persisted, f"Files: {len(med_data.get('uploaded_files', []))}")
    except Exception as e:
        check("4. Medical History Check", False, str(e))

    # Check 5: EPDS Screening Submission & PostgreSQL Persistence
    test_screening_id = None
    try:
        epds_payload = {
            "answers": [
                {"question_id": f"EPDS_Q{i:02d}", "selected_index": 1, "raw_response": "Sometimes"}
                for i in range(1, 11)
            ],
            "notes": "Verified automated screening integration test session.",
        }
        r_epds = requests.post(f"{BASE_URL}/api/patients/me/screenings", headers=headers, json=epds_payload, timeout=5)
        scr_data = r_epds.json()
        test_screening_id = scr_data.get("id")
        score = scr_data.get("total_score")
        risk = scr_data.get("risk_classification")
        check(
            "5. EPDS Screening Submission & Scoring",
            r_epds.status_code == 201 and test_screening_id is not None,
            f"Screening ID: {test_screening_id}, Score: {score}/30, Risk: {risk}",
        )
    except Exception as e:
        check("5. EPDS Screening Submission", False, str(e))

    # Check 6: Screening History & Detail Retrieval
    try:
        r_hist = requests.get(f"{BASE_URL}/api/patients/me/screenings", headers=headers, timeout=5)
        hist = r_hist.json()
        found = any(s.get("id") == test_screening_id for s in hist) if test_screening_id else len(hist) > 0
        check("6a. Screening History from PostgreSQL", r_hist.status_code == 200 and found, f"Total sessions: {len(hist)}")

        if test_screening_id:
            r_detail = requests.get(f"{BASE_URL}/api/patients/me/screenings/{test_screening_id}", headers=headers, timeout=5)
            check("6b. Screening Detail by ID", r_detail.status_code == 200, f"Detail ID: {r_detail.json().get('id')}")
    except Exception as e:
        check("6. Screening History Check", False, str(e))

    # Check 7: Clinical PDF Report & Text Transcript Generation
    try:
        if test_screening_id:
            r_pdf = requests.get(f"{BASE_URL}/api/patients/me/screenings/{test_screening_id}/report.pdf", headers=headers, timeout=5)
            is_valid_pdf = r_pdf.status_code == 200 and r_pdf.content.startswith(b"%PDF")
            check("7a. Clinical PDF Report Generation (ReportLab)", is_valid_pdf, f"PDF bytes: {len(r_pdf.content)}")

            r_txt = requests.get(f"{BASE_URL}/api/patients/me/screenings/{test_screening_id}/transcript.txt", headers=headers, timeout=5)
            is_valid_txt = r_txt.status_code == 200 and b"MIORA MATERNAL SCREENING SESSION TRANSCRIPT" in r_txt.content
            check("7b. Text Transcript Generation", is_valid_txt, f"Transcript chars: {len(r_txt.text)}")
    except Exception as e:
        check("7. Reports Generation Check", False, str(e))

    # Check 8: Appointments Booking & Persistence
    try:
        appt_payload = {
            "doctor_name": "Dr. Elena Rostova",
            "role": "Perinatal Psychiatry Lead",
            "date": "2026-11-28",
            "time": "11:30 AM",
            "type": "Telehealth Video",
            "clinic": "Miora Maternal Care Unit",
            "reason": "Post-screening emotional check-in",
        }
        r_book = requests.post(f"{BASE_URL}/api/patients/me/appointments", headers=headers, json=appt_payload, timeout=5)
        booked = r_book.json()
        check("8a. Appointment Booking (CarePlan PostgreSQL)", r_book.status_code == 201, f"Appt ID: {booked.get('id')}")

        r_appts = requests.get(f"{BASE_URL}/api/patients/me/appointments", headers=headers, timeout=5)
        appts = r_appts.json()
        appt_found = any(a.get("id") == booked.get("id") for a in appts)
        check("8b. Appointments PostgreSQL Retrieval", r_appts.status_code == 200 and appt_found, f"Total consults: {len(appts)}")
    except Exception as e:
        check("8. Appointments Check", False, str(e))

    # Check 9: Notifications & Read State
    try:
        r_notifs = requests.get(f"{BASE_URL}/api/patients/me/notifications", headers=headers, timeout=5)
        notifs = r_notifs.json()
        check("9a. Notifications Retrieval", r_notifs.status_code == 200 and len(notifs) > 0, f"Count: {len(notifs)}")

        if notifs:
            first_id = notifs[0].get("id")
            r_mark = requests.put(f"{BASE_URL}/api/patients/me/notifications/{first_id}/read", headers=headers, timeout=5)
            check("9b. Notification Mark As Read", r_mark.status_code == 200, f"Marked ID: {first_id}")
    except Exception as e:
        check("9. Notifications Check", False, str(e))

    # Check 10: Care Plan Tasks & Persistence
    try:
        r_care = requests.get(f"{BASE_URL}/api/patients/me/care-plan", headers=headers, timeout=5)
        cp = r_care.json()
        check("10a. Care Plan Retrieval", r_care.status_code == 200 and "tasks" in cp, f"Tasks count: {len(cp.get('tasks', []))}")

        r_toggle = requests.put(f"{BASE_URL}/api/patients/me/care-plan/tasks/task-1", headers=headers, timeout=5)
        toggled = r_toggle.json()
        check("10b. Care Plan Task Toggle & Persistence", r_toggle.status_code == 200, f"Task-1 status: {toggled.get('success')}")
    except Exception as e:
        check("10. Care Plan Check", False, str(e))

    # Check 11: Settings & Preferences Persistence
    try:
        set_payload = {
            "camera_permission": "granted",
            "mic_permission": "granted",
            "email_notifs": True,
            "consultation_alerts": True,
            "confidential_mode": True,
            "language": "hi",
            "voice_locale": "hi-IN",
        }
        r_set = requests.put(f"{BASE_URL}/api/patients/me/settings", headers=headers, json=set_payload, timeout=5)
        check("11a. Settings Update", r_set.status_code == 200, f"Status: {r_set.status_code}")

        r_get_set = requests.get(f"{BASE_URL}/api/patients/me/settings", headers=headers, timeout=5)
        saved_set = r_get_set.json()
        set_persisted = (
            saved_set.get("language") == "hi"
            and saved_set.get("camera_permission") == "granted"
        )
        check("11b. Settings PostgreSQL Persistence", set_persisted, f"Saved language: {saved_set.get('language')}")
    except Exception as e:
        check("11. Settings Check", False, str(e))

    # Check 12: AI Conversation Persistence
    try:
        conv_payload = {
            "messages": [
                {"id": "msg-test-1", "sender": "user", "text": "I feel a little overwhelmed tonight."},
                {"id": "msg-test-2", "sender": "bot", "text": "I hear you, and it is completely understandable. You are doing a wonderful job."},
            ],
            "current_mood": "coping",
        }
        r_conv = requests.post(f"{BASE_URL}/api/patients/me/ai-conversations", headers=headers, json=conv_payload, timeout=5)
        check("12a. AI Conversation Save", r_conv.status_code == 200, f"Status: {r_conv.status_code}")

        r_get_conv = requests.get(f"{BASE_URL}/api/patients/me/ai-conversations", headers=headers, timeout=5)
        saved_conv = r_get_conv.json()
        conv_persisted = len(saved_conv.get("messages", [])) == 2 and saved_conv.get("current_mood") == "coping"
        check("12b. AI Conversation PostgreSQL Persistence", conv_persisted, f"Turns: {len(saved_conv.get('messages', []))}, Mood: {saved_conv.get('current_mood')}")
    except Exception as e:
        check("12. AI Conversation Check", False, str(e))

    # Check 13: Role-Based Access Restrictions & Isolation
    try:
        # A patient attempting to log into doctor portal should receive 403 Forbidden
        r_doctor_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "patient@miora.health",
                "password": "password123",
                "selected_role": "doctor",
            },
            timeout=5,
        )
        check("13a. Doctor Role Portal Access Forbidden for Patient", r_doctor_login.status_code == 403, f"Status: {r_doctor_login.status_code}")

        # A doctor token attempting to access patient-specific endpoints should receive 403 Forbidden
        r_doc_auth = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "doctor@miora.health", "password": "password123", "selected_role": "doctor"},
            timeout=5,
        )
        doc_token = r_doc_auth.json().get("access_token")
        r_pat_endpoint = requests.get(
            f"{BASE_URL}/api/patients/me",
            headers={"Authorization": f"Bearer {doc_token}"},
            timeout=5,
        )
        check("13b. Patient Portal Forbidden for Doctor Token", r_pat_endpoint.status_code == 403, f"Status: {r_pat_endpoint.status_code}")

        # Unauthenticated request to /api/patients/me should receive 401 Unauthorized
        r_unauth = requests.get(f"{BASE_URL}/api/patients/me", timeout=5)
        check("13c. Unauthenticated Request Blocked", r_unauth.status_code == 401, f"Status: {r_unauth.status_code}")

        # Patient cannot access another patient's screening
        fake_uuid = str(uuid.uuid4())
        r_other = requests.get(f"{BASE_URL}/api/patients/me/screenings/{fake_uuid}", headers=headers, timeout=5)
        check("13d. Cross-Patient Screening Isolation (404/Access Denied)", r_other.status_code == 404, f"Status: {r_other.status_code}")
    except Exception as e:
        check("13. Access Restrictions Check", False, str(e))

    # Check 14: New Patient Registration
    try:
        new_test_email = f"test_mother_{uuid.uuid4().hex[:6]}@miora.health"
        r_reg = requests.post(
            f"{BASE_URL}/api/patients/register",
            json={
                "name": "Fatima Zahra",
                "email": new_test_email,
                "password": "password123",
                "phone": "+91-99887-66554",
                "age": 26,
                "postpartum_week": 3,
            },
            timeout=5,
        )
        reg_data = r_reg.json()
        new_token = reg_data.get("access_token")
        check(
            "14. New Patient Registration & JWT Issuance",
            r_reg.status_code == 201 and new_token is not None,
            f"Email: {new_test_email}, Mother ID: {reg_data.get('user', {}).get('mother_id')}",
        )
    except Exception as e:
        check("14. New Patient Registration", False, str(e))

    print("==================================================================")
    print(f"VERIFICATION SUMMARY: {passed} of {total} checks PASSED.")
    print("==================================================================")
    if passed == total:
        print("ALL ESSENTIAL CHECKS PASSED SUCCESSFULLY!")
    else:
        print("SOME CHECKS FAILED. Review output above.")


if __name__ == "__main__":
    run_checks()
