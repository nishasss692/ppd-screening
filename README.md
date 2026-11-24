# MIORA — Postpartum Health & Clinical Intelligence Platform

[![CI Test Suite](https://github.com/nishasss692/ppd-screening/actions/workflows/ci.yml/badge.svg)](https://github.com/nishasss692/ppd-screening/actions)
[![Python 3.10--3.13](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-blue.svg?style=flat&logo=python)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19.3-61dafb.svg?style=flat&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Pydantic v2](https://img.shields.io/badge/pydantic-v2.6+-green.svg)](https://docs.pydantic.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%7C%2018-336791.svg?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Vite 5](https://img.shields.io/badge/Vite-5.4-646cff.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-95%20Tests%20Passing-green.svg?style=flat&logo=vitest)](https://vitest.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-Tests%20Passing-brightgreen.svg?style=flat&logo=pytest)](https://pytest.org/)
[![License: Research & Clinical Prototype](https://img.shields.io/badge/License-Research%20Prototype-lightgrey.svg)]()

> **MIORA** (*Maternal Intelligence & Outcome Review Architecture*) is a multimodal clinical screening and emotional well-being intelligence platform designed to assist healthcare professionals and mothers in identifying, monitoring, and evaluating risk for **Postpartum Depression (PPD)** after childbirth.

---

## Table of Contents
1. [Platform Overview & Key Features](#1-platform-overview--key-features)
2. [Dual-Portal Architecture](#2-dual-portal-architecture)
   - [A. Clinician Command Dashboard](#a-clinician-command-dashboard)
   - [B. Patient Emotional Care Portal](#b-patient-emotional-care-portal)
3. [Multimodal Machine Learning & Safety Core](#3-multimodal-machine-learning--safety-core)
   - [Modality Pipelines & Fusion Architecture](#modality-pipelines--fusion-architecture)
   - [Safety & Crisis Protocol](#safety--crisis-protocol)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [Local Development & Quickstart](#6-local-development--quickstart)
   - [Prerequisites](#prerequisites)
   - [Step 1: Backend Setup](#step-1-backend-setup)
   - [Step 2: Frontend Setup](#step-2-frontend-setup)
   - [Step 3: Environment Variables](#step-3-environment-variables)
7. [Running the Test Suites](#7-running-the-test-suites)
8. [Clinical Disclaimer & Safety Governance](#8-clinical-disclaimer--safety-governance)
9. [Citation & License](#9-citation--license)

---

## 1. Platform Overview & Key Features

Postpartum Depression (PPD) affects an estimated 10% to 20% of childbearing women worldwide, often going underdiagnosed due to social stigma, clinic distance, and fear of judgment. Traditional screening relies on self-reported questionnaires like the **Edinburgh Postnatal Depression Scale (EPDS)**, which can be vulnerable to recall bias and conversational discomfort.

**MIORA** combines compassionate patient engagement with clinician-facing decision intelligence:
- **Conversational EPDS Screening**: Administers the validated 10-item EPDS through an empathetic AI voice dialogue rather than cold forms.
- **Mother-Controlled Audio & Visual Sensors**: Live video stream and microphone activation with full patient autonomy (microphone stays idle until clicked).
- **Multilingual Support (8 Indian Languages)**: Conversational check-ins in English, Hindi, Kannada, Tamil, Telugu, Malayalam, Bengali, and Marathi.
- **Deterministic Crisis Safety Intercept**: Immediate, zero-latency escalation to **Tele-MANAS (14416 / 1800-891-4416)** whenever Question 10 or distress markers indicate self-harm risk.
- **Cross-Modal Discordance Engine**: Identifies discrepancies between self-reported scores and behavioral acoustic/facial cues for clinical review.
- **Enterprise Persistence**: Real-time synchronization of patient records, screening sessions, consultation appointments, and care tasks with PostgreSQL.

---

## 2. Dual-Portal Architecture

### A. Clinician Command Dashboard
Designed for obstetricians, perinatal psychiatrists, and clinical care coordinators:
1. **Command Center (`/dashboard`)**: High-level maternal risk distribution, weekly screening velocity, priority cases needing immediate review, and real-time clinical KPIs.
2. **Mothers & Cases (`/mothers`)**: Comprehensive patient cohort management with faceted filtering (Risk Tier, Postpartum Week, Age, Review Status), search, and new mother onboarding.
3. **Live Multimodal Screening (`/screening`)**: Real-time screening observation console with webcam/mic feeds, behavioral telemetry, and timestamped answer tracking.
4. **Upload & Analyze (`/upload`)**: Secondary evaluation tool for importing clinical videos, acoustic WAV files, or patient narratives with automated modality validation.
5. **Screening Results (`/results`)**: Detailed breakdown of EPDS score (0–30), clinical risk classification (Low, Moderate, High), modality factor attribution, and clinical notes export.
6. **Cross-Modal Discordance Engine (`/discordance`)**: Detects cases where a patient self-reports low distress while exhibiting high vocal flat affect or facial withdrawal (protective minimization).
7. **Personalized Insights & Care (`/insights`)**: Tailored postpartum recovery plans, milestone tracking, clinician follow-up scheduling, and PDF care report generation.
8. **Clinician Copilot (AI Assistant)**: TopNav-embedded copilot answering clinical workflow queries, clinical literature references, and dosage protocols.

### B. Patient Emotional Care Portal
A calming, blush-and-cream design system featuring the signature rose header card, Playfair serif typography, and reassuring maternal illustrations:
1. **Patient Home (`/patient/dashboard`)**: Personalized welcome banner (`Welcome back, Amara`), quick-action check-ins, upcoming appointments, and daily recovery tasks.
2. **Medical History (`/patient/medical-history`)**: Secure, encrypted capture of prior PPD diagnoses and past medical record uploads (PDF/JPEG, 256-bit encryption).
3. **AI Screening Session (`/patient/screening`)**:
   - Gated start: Begins only when the patient confirms (`▶ Start Screening` button or voice command `"start"`).
   - Conversational EPDS: Questions read aloud via natural browser speech synthesis; voice or typed responses mapped to validated scores (0–3).
   - Continuous MediaRecorder: Synchronized video and audio analysis with timestamped question intervals.
   - Immediate in-chat report persistence without abrupt page redirects.
4. **AI Emotional Assistant (`/patient/assistant`)**: Empathetic chat companion with mood selector pills, quick prompts, and multilingual translation in 8 regional languages.
5. **Anonymous Mothers Community (`/patient/community`)**: Safe, pseudonymous peer-support forum with compassionate moderation tags and empathy reactions.
6. **Connect to a Doctor (`/patient/connect`)**: Telehealth consultation booking with assigned lead psychiatrist (Dr. Elena Rostova), upcoming session countdown, and virtual waiting room.
7. **My Reports & Analytics (`/patient/reports`)**: Longitudinal risk gauge (0–30), 4-week emotional trajectory SVG charts, past screening session archive, and consultation history.
8. **Care Suggestions (`/patient/care`)**: Guided recovery plan (sleep hygiene, gentle movement, pelvic recovery, nutrition) with interactive progress tracking.
9. **Patient Settings & Profile (`/patient/settings`, `/patient/profile`)**: Confidentiality controls, language selection, emergency contact management, and session logout.

---

## 3. Multimodal Machine Learning & Safety Core

### Modality Pipelines & Fusion Architecture

The screening platform implements a unified four-modality late-fusion architecture combining:
1. **Clinical Numerical**: 46 validated demographic, obstetric, socioeconomic, and PHQ-2 survey predictors.
2. **Narrative Text**: Maternal domestic context vignettes evaluated via TF-IDF vectorization and $L_2$-regularized Logistic Regression (`models/text_model/text_pipeline.joblib`).
3. **Voice Audio**: 7 physiological acoustic vocal biomarkers (mean/std F0, jitter, shimmer, HNR, speech rate, pause ratio) with StandardScaler (`models/audio_model/`).
4. **Facial Video**: 220 temporal summary statistics over facial Action Units and landmarks (`artifacts/video_experiments/`).

```mermaid
flowchart TD
    subgraph Input["1. Maternal Input Streams"]
        C["Clinical Survey Predictors\n(46 Demographics & Covariates)"]
        T["Narrative Text Self-Report\n(Maternal Domestic Context)"]
        A["Voice & Acoustic Stream\n(F0, Jitter, Shimmer, HNR, Pause Ratio)"]
        V["Live Video / Visual Stream\n(Facial Dynamics, Action Units AU04/12/15)"]
    end

    subgraph Processing["2. Unimodal Feature Extraction & Models"]
        P_C["Clinical Pipeline (Random Forest / Logistic Regr.)\nmodels/clinical_numerical/"]
        P_T["Text Pipeline (TF-IDF + Logistic Regression)\nmodels/text_model/text_pipeline.joblib"]
        P_A["Audio Pipeline (Scaler + Logistic Regression)\nmodels/audio_model/logistic_regression.joblib"]
        P_V["Video Pipeline (OpenFace 220 Features + Baseline)\nartifacts/video_experiments/.../fitted_model.joblib"]
    end

    subgraph Fusion["3. Unified Four-Modality Late Fusion Engine"]
        F1["Stacking Meta-Classifier & Dynamic Reweighting\nmodels/fusion/fusion_meta_learner.joblib"]
        F2["Uncalibrated Multimodal Research Risk Score [0.0, 1.0]\nDynamic Normalization & Cross-Modal Discordance (|Δ| >= 0.25)"]
    end

    subgraph Safety["4. Clinical Safety & Output"]
        S["Standalone EPDS Question 10 Intercept\n(Tele-MANAS 14416 / 1800-891-4416)"]
        R["Screening Summary & Research Output"]
        DB[(PostgreSQL Hospital Database)]
        Dash["Clinician & Patient Interfaces"]
    end

    C --> P_C --> F1
    T --> P_T --> F1
    A --> P_A --> F1
    V --> P_V --> F1
    F1 --> F2
    F2 --> R

    T -.->|Question 10 / Self-Harm| S
    S --> R
    R --> DB
    R --> Dash
```

### Safety & Crisis Protocol
- **Strict Target Leakage Safeguard**: `EPDS Score`, `EPDS Result`, and individual EPDS questions are strictly excluded from all model feature spaces (`EXCLUDED_COLUMNS`, `extra='forbid'`). The authentic ground-truth binary target is `target_canonical_epds_ge_13` (`EPDS >= 13`).
- **Standalone EPDS Question 10 Guardrail**: Any non-zero answer on Question 10 (*"The thought of harming myself has occurred to me"*) automatically triggers an emergency banner with direct toll-free helpline links to **Tele-MANAS (14416 / 1800-891-4416)** and local emergency services.
- **Zero Hallucination / Zero Override**: The crisis intercept is a standalone deterministic rule operating outside ML probability fusion—it cannot be bypassed, suppressed, or downgraded by AI predictions.
- **Dynamic Reweighting Without Fabrication**: When modalities are unavailable or unrequested, weights are dynamically re-normalized across available completed predictive modalities; missing streams are never imputed or zero-filled. If fewer than 2 predictive modalities exist, fusion safely returns `status="not_available"`.

---

## 4. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19.3, Vite 5.4, React Router DOM 7.18 |
| **Data Visualization & Media** | Recharts 3.10, Three.js, MediaStream API, MediaRecorder API, Web Speech API |
| **Frontend Testing** | Vitest 2.1, @testing-library/react 16.3, jsdom |
| **Backend Framework** | FastAPI 0.110+, Uvicorn 0.28+, Pydantic v2.6+ |
| **Database & Persistence** | PostgreSQL 16/18, SQLAlchemy 2.0+, Alembic 1.13+, psycopg2-binary |
| **Machine Learning & Signal Processing** | PyTorch 2.2+, Scikit-learn 1.4+, OpenCV (Headless), SciPy, NumPy, Pandas |
| **Generative AI** | Google GenAI SDK (`google-genai`), Gemini 3.5 Flash Lite |
| **Backend Testing** | Pytest 8.0+, HTTPX, TestClient |
| **CI / CD Automation** | GitHub Actions (`ubuntu-latest`, Python 3.10–3.12, Node.js 20) |

---

## 5. Repository Structure

```
ppd-screening/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI matrix (Backend + Frontend)
├── backend/
│   ├── database/                # SQLAlchemy connection pool, session, and declarative Base
│   ├── models/                  # Database models (User, Mother, Screening, Review, Community)
│   ├── routers/                 # FastAPI API route controllers (Auth, Screening, Questionnaire, Community)
│   ├── schemas/                 # Pydantic v2 request/response contracts
│   ├── services/                # Business logic (Auth, ThreeModalityService, Community)
│   └── main.py                  # FastAPI application entrypoint & lifespan lifecycle
├── data/
│   └── questions.json           # Canonical 10-item EPDS questionnaire schema
├── models/
│   ├── audio_model/             # Trained audio scaler and logistic regression classifier
│   └── text_model/              # Trained text TF-IDF vectorizer and classification pipeline
├── artifacts/
│   ├── three_modality_fusion/   # Trained meta-classifier and fusion experiment summaries
│   └── video_experiments/       # Optimized baseline video models and metrics
├── pipelines/
│   ├── clinical_numerical/      # Benchmark clinical survey modeling
│   ├── three_modality_fusion/   # Stage 1 three-modality stacking fusion pipeline
│   └── video_model/             # Video tensor extraction, caching, and baseline models
├── reports/                     # Architecture, audit, and reliability reports
├── public/                      # Static assets, WebP/AVIF images, manifest, and icons
├── src/
│   ├── auth/                    # Role-based JWT authentication services & guards
│   ├── components/              # Landing page components (Header, Hero, Approach, Features, etc.)
│   ├── dashboard/               # Clinician Command Dashboard screens (01–07)
│   ├── patient/                 # Patient Emotional Care Portal screens & context
│   │   ├── components/          # Patient icons, modals, and multimodal screening tabs
│   │   ├── context/             # PatientContext provider & PostgreSQL sync
│   │   ├── layout/              # Unified TopNav & blush shell layout
│   │   ├── pages/               # Patient screens (Home, Medical History, Screening, Community, etc.)
│   │   ├── services/            # Patient API client & Web Speech assistant service
│   │   └── styles/              # Design tokens, hero cards, and layout CSS
│   ├── App.jsx                  # Root application router & providers
│   └── main.jsx                 # React DOM mount point
├── tests/                       # Unit and integration test suites (Pytest + Vitest)
├── package.json                 # Node.js dependencies & scripts
├── pytest.ini                   # Pytest test discovery configuration
├── requirements.txt             # Python backend dependencies
└── README.md                    # Platform documentation
```

---

## 6. Local Development & Quickstart

### Prerequisites
- **Node.js**: v20.x or higher
- **Python**: v3.10, v3.11, v3.12, or v3.13
- **PostgreSQL**: v16+ (or SQLite fallback for offline development)
- **Git**

---

### Step 1: Backend Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nishasss692/ppd-screening.git
   cd ppd-screening
   ```

2. **Create and activate a Python virtual environment:**
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Launch the FastAPI development server:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Interactive Swagger documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs).

---

### Step 2: Frontend Setup

1. **Install Node.js packages:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   The application will be live at: [http://localhost:3000](http://localhost:3000).

---

### Step 3: Environment Variables

Create a `.env` file in the project root (refer to `.env.example`):
```ini
# Environment
ENVIRONMENT=development
RANDOM_SEED=42
LOG_LEVEL=INFO

# API Server
API_HOST=0.0.0.0
API_PORT=8000

# PostgreSQL Database (Defaults to SQLite when unset)
DATABASE_URL=postgresql://postgres:password@localhost:5432/ppd_screening
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_ECHO=false

# JWT Authentication
JWT_SECRET_KEY=your_secure_random_jwt_secret_key_minimum_32_characters
JWT_EXPIRATION_HOURS=24

# Gemini Voice Assistant (Optional; offline fallback enabled)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_MAX_TOKENS=1000
```

---

## 7. Running the Test Suites

Both backend and frontend feature thorough automated test suites:

### Frontend Unit & Integration Tests (Vitest)
```bash
# Run all Vitest unit and integration tests
npm test

# Run patient portal tests only
npx vitest run src/patient/ --run
```

### Frontend Production Build
```bash
npm run build
```

### Backend Test Suite (Pytest)
```bash
# Run all pytest suites
pytest -v

# Run backend integration tests
pytest tests/test_three_modality_backend_integration.py -v
```

---

## 8. Clinical Disclaimer & Safety Governance

> [!IMPORTANT]
> **RESEARCH PROTOTYPE NOTICE — NOT A MEDICAL DEVICE**  
> 1. **Screening Aid, Not Diagnosis**: MIORA and the Edinburgh Postnatal Depression Scale (EPDS) are clinical screening aids designed to quantify depressive risk indicators and emotional distress. They **do not** formulate medical diagnoses, establish psychiatric etiology, or prescribe pharmacotherapy.  
> 2. **Clinical Decision Support**: All scores, acoustic features, and video analysis markers are supportive research tools intended for review by licensed medical practitioners (e.g., obstetricians, perinatal psychiatrists, midwives, and clinical psychologists).  
> 3. **Emergency Situations**: In cases of acute psychiatric crisis, severe despair, or thoughts of self-harm, patients are immediately guided to accredited 24/7 crisis hotlines including **Tele-MANAS (14416 / 1800-891-4416)** or local emergency rooms.  
> 4. **Data Privacy**: All patient communications and medical history records are encrypted in transit and at rest in compliance with clinical confidentiality standards.

---

## 9. Citation & License

This prototype is developed for academic and computational research into multimodal psychiatric screening architectures.

If utilizing this repository structure or methodology in your research, please cite:
```bibtex
@misc{miora_multimodal_screening_2026,
  title={MIORA: Postpartum Depression Multimodal Recognition and Clinical Screening Architecture},
  author={MIORA Research Team},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/nishasss692/ppd-screening}}
}
```

This repository is distributed under a **Research & Clinical Prototype License**. Designed for academic investigation, clinical research, and computational screening evaluation. Commercial exploitation or unsupervised clinical deployment without regulatory clearance is strictly prohibited.
