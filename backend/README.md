# Backend REST API

## Overview
This module exposes FastAPI REST endpoints for Postpartum Depression (PPD) screening support, verified EPDS questionnaire administration, and multimodal screening intelligence.

> [!IMPORTANT]
> **Scientific & Clinical Boundaries:**  
> - Neither the EPDS screening score nor the multimodal screening inference constitutes a definitive medical or psychiatric diagnosis.  
> - The narrative text modality uses the trained synthetic text classification pipeline (`models/text_model/text_pipeline.joblib`) for architectural research and risk estimation. It must **never** override EPDS scoring or Question 10 self-harm safety escalation.  
> - No patient narratives, EPDS item answers, or personally identifiable information (PII) are written to persistent operational logs.

## Implemented Endpoints

- `GET /`: Health check and system metadata.
- `GET /api/questionnaire/epds`: Retrieve the verified 10-item EPDS question bank from `data/questions.json`.
- `POST /api/questionnaire/epds/submit`: Calculate validated EPDS score and enforce independent Question 10 safety alert rules.
- `POST /api/screenings/analyze`: Central screening orchestration across requested modalities (Clinical, Text, Audio, Video) with late fusion meta-classification.
- `POST /api/screenings/multimodal/analyze`: Central multimodal screening analysis for patient and clinician portals.
- `GET /api/screenings/multimodal/status`: Multimodal runtime readiness and model artifact status check.
- `POST /api/predict/clinical`: Single-record clinical tabular inference.
- `POST /api/predict/clinical/batch`: Batch clinical tabular inference.

---

## Synthetic Text Classification Integration

### Architecture & Lifecycle
- **Model Pipeline:** Self-contained TF-IDF vectorizer + Logistic Regression classifier serialized at `models/text_model/text_pipeline.joblib`.
- **Inference Service:** Integrated via `backend/services/three_modality_service.py` (`ThreeModalityInferenceService.predict_text`) and consumed by `backend/services/screening_service.py`.
- **Privacy Guarantee:** Operational logs record only non-identifying telemetry (`input_length`, `predicted_class`, `risk_score`). Raw patient narrative strings are never logged.

### Local Run
```bash
uvicorn backend.main:app --reload
```
