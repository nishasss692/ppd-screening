"""Test suite for AANCHAL Two-Stage Clinical Data Collection (Option B).

Verifies:
- Stage 1 (Clinical Profile): 37 features
- Stage 2 (Psychosocial Assessment): 9 features
- Canonical mapping and exact trailing space preservation
- Random Forest inference execution (46 features)
- Anti-leakage guarantees (EPDS score and items stripped)
- Dedicated patient profile endpoints
- Screening submission and snapshot immutability
"""

import uuid
import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.services.clinical_adapter import assemble_clinical_features
from backend.services.clinical_service import clinical_service


def test_feature_adapter_exact_46_features():
    """Verify adapter assembles exactly 46 features with exact names and types."""
    sample_stage1 = {
        "Age": 28,
        "Residence": "Urban",
        "Education Level": "Graduate",
        "Marital status": "Married",
        "Occupation before latest pregnancy": "Private Job",
        "Monthly income before latest pregnancy": "40000",
        "Occupation After Your Latest Childbirth": "Housewife",
        "Current monthly income": "0",
        "Husband's education level": "Post Graduate",
        "Husband’s monthly income": "60000",
        "Addiction": "No",
        "Family type": "Nuclear",
        "Number of household members": 4,
        "Total children": 1,
        "Number of the latest pregnancy": 1,
        "Age of immediate older children": "None",
        "Disease before pregnancy": "None",
        "History of pregnancy loss": "No",
        "Pregnancy plan": "Planned",
        "Regular checkups": "Regular",
        "Pregnancy length": "Full Term",
        "Mode of delivery": "Normal",
        "Birth compliancy": "Yes",
        "Diseases during pregnancy": "None",
        "Major changes or losses during pregnancy": "No",
        "Fear of pregnancy": "No",
        "Depression before pregnancy (PHQ2)": "No",
        "Depression during pregnancy (PHQ2)": "No",
        "Age of newborn": "4 weeks",
        "Gender of newborn": "Female",
        "Breastfeed": "Exclusive",
        "Newborn illness": "No",
        "Worry about newborn": "No",
        "Relationship with the newborn": "Warm",
        "Relationship between father and newborn": "Warm",
        "Abuse": "No",
        "Feeling for regular activities": "Normal",
    }

    sample_stage2 = {
        "Feeling about motherhood": "Happy",
        "Relationship with husband": "Friendly",
        "Relationship with the in-laws": "Good",
        "Relax/sleep when the newborn is asleep": "Yes",
        "Relax/sleep when newborn is tended ": "Yes",
        "Angry after latest child birth": "No",
        "Recieved Support": "High",
        "Need for Support": "Low",
        "Trust and share feelings": "Yes",
        "qualitative_reflection": "Doing well overall with husband helping at night.",
    }

    features_dict, is_valid, missing_list = assemble_clinical_features(
        clinical_profile=sample_stage1,
        psychosocial_answers=sample_stage2,
        fallback_age=28,
    )

    # 1. Exactly 46 features
    assert len(features_dict) == 46
    assert is_valid is True
    assert len(missing_list) == 0

    # 2. Key with trailing space must be present
    assert "Relax/sleep when newborn is tended " in features_dict
    assert features_dict["Relax/sleep when newborn is tended "] == "Yes"

    # 3. Qualitative reflection must NOT be in model features
    assert "qualitative_reflection" not in features_dict

    # 4. Strictly zero EPDS leakage
    for k in features_dict:
        assert "EPDS" not in k
        assert "epds" not in k.lower()

    # 5. Model prediction executes without error
    prediction_response = clinical_service.predict(mother_id="M-TEST-001", features=features_dict)
    assert prediction_response["status"] == "completed"
    pred = prediction_response["prediction"]
    assert pred["risk_category"] in ["LOW_RISK", "HIGH_RISK"]
    assert 0.0 <= pred["predicted_risk_probability"] <= 1.0


def test_feature_adapter_prefer_not_to_answer_maps_to_missing():
    """Verify 'Prefer not to answer' maps to 'Missing' category."""
    features_dict, is_valid, missing_list = assemble_clinical_features(
        clinical_profile={"Residence": "Prefer not to answer"},
        psychosocial_answers={"Relationship with husband": "Prefer not to answer"},
        fallback_age=25,
    )
    assert features_dict["Residence"] == "Missing"
    assert features_dict["Relationship with husband"] == "Missing"


def test_clinical_profile_api_endpoints():
    """Verify patient clinical-profile get and put endpoints."""
    with TestClient(app) as client:
        # Create a fresh patient with unique email
        unique_id = uuid.uuid4().hex[:8]
        reg_payload = {
            "name": "Priya Sharma",
            "email": f"priya.test.{unique_id}@example.com",
            "password": "Password123!",
            "role": "patient",
        }
        reg_res = client.post("/api/auth/register", json=reg_payload)
        assert reg_res.status_code == 201
        res_data = reg_res.json()
        token = res_data.get("token") or res_data.get("access_token")
        headers = {"Authorization": f"Bearer {token}"}

        # Initial profile fetch
        get_res = client.get("/api/patients/me/clinical-profile", headers=headers)
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["profile_completed"] is False
        assert isinstance(get_data["clinical_profile"], dict)

        # Update clinical profile
        update_payload = {
            "profile_completed": True,
            "clinical_profile": {
                "Age": 29,
                "Residence": "Urban",
                "Mode of delivery": "Normal",
                "Pregnancy plan": "Planned",
            },
        }
        put_res = client.put(
            "/api/patients/me/clinical-profile",
            headers=headers,
            json=update_payload,
        )
        assert put_res.status_code == 200
        put_data = put_res.json()
        assert put_data["profile_completed"] is True
        assert put_data["clinical_profile"]["Age"] == 29
        assert put_data["clinical_profile"]["Mode of delivery"] == "Normal"

        # Submit a screening with 10 canonical answers and psychosocial answers
        answers_10 = [
            {"question_id": f"EPDS_Q{i:02d}", "selected_index": 0}
            for i in range(1, 11)
        ]
        screening_payload = {
            "answers": answers_10,
            "total_score": 0,
            "risk_classification": "low",
            "psychosocial_answers": {
                "Feeling about motherhood": "Happy",
                "Relationship with husband": "Friendly",
                "Relationship with the in-laws": "Good",
                "Relax/sleep when the newborn is asleep": "Yes",
                "Relax/sleep when newborn is tended ": "Yes",
                "Angry after latest child birth": "No",
                "Recieved Support": "High",
                "Need for Support": "Low",
                "Trust and share feelings": "Yes",
            },
        }
        scr_res = client.post("/api/patients/me/screenings", headers=headers, json=screening_payload)
        assert scr_res.status_code == 201
        scr_data = scr_res.json()

        # Check that clinical model ran and saved snapshot
        assert scr_data["psychosocial_answers"] is not None
        assert scr_data["clinical_features_snapshot"] is not None
        assert len(scr_data["clinical_features_snapshot"]) == 46
        assert scr_data["clinical_model_prediction"] is not None
        assert scr_data["clinical_model_prediction"]["status"] == "completed"
        assert scr_data["clinical_model_prediction"]["predicted_label"] == "LOW_RISK"
