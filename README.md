# MIORA — Postpartum Health & Clinical Intelligence Platform

[![CI Test Suite](https://github.com/nishasss692/ppd/actions/workflows/ci.yml/badge.svg)](https://github.com/nishasss692/ppd/actions)
[![React 19](https://img.shields.io/badge/React-19.3-61dafb.svg?style=flat&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10--3.13](https://img.shields.io/badge/Python-3.10%20|%203.11%20|%203.12%20|%203.13-blue.svg?style=flat&logo=python)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20|%2018-336791.svg?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Vite 5](https://img.shields.io/badge/Vite-5.4-646cff.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-95%20Tests%20Passing-green.svg?style=flat&logo=vitest)](https://vitest.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-141%20Tests%20Passing-brightgreen.svg?style=flat&logo=pytest)](https://pytest.org/)
[![License: Research & Clinical Prototype](https://img.shields.io/badge/License-Research%20Prototype-lightgrey.svg)]()

> **MIORA** (*Maternal Intelligence & Outcome Review Architecture*) is a multimodal clinical screening and emotional well-being intelligence platform designed to assist healthcare professionals in identifying, monitoring, and evaluating risk for **Postpartum Depression (PPD)** after childbirth.

---

## Table of Contents
1. [Platform Overview & Key Features](#1-platform-overview--key-features)
2. [Dual-Portal Architecture](#2-dual-portal-architecture)
   - [Clinician Command Dashboard](#a-clinician-command-dashboard)
   - [Patient Emotional Care Portal](#b-patient-emotional-care-portal)
3. [Multimodal Machine Learning & Safety Core](#3-multimodal-machine-learning--safety-core)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [Local Development & Quickstart](#6-local-development--quickstart)
   - [Prerequisites](#prerequisites)
   - [Backend Setup (FastAPI & PostgreSQL)](#step-1-backend-setup)
   - [Frontend Setup (React 19 & Vite)](#step-2-frontend-setup)
   - [Environment Variables (.env)](#step-3-environment-variables)
7. [Running the Test Suites](#7-running-the-test-suites)
8. [Clinical Disclaimer & Safety Governance](#8-clinical-disclaimer--safety-governance)

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
5. **Connect to a Doctor (`/patient/connect`)**: Telehealth consultation booking with assigned lead psychiatrist (Dr. Elena Rostova), upcoming session countdown, and virtual waiting room.
6. **My Reports & Analytics (`/patient/reports`)**: Longitudinal risk gauge (0–30), 4-week emotional trajectory SVG charts, past screening session archive, and consultation history.
7. **Care Suggestions (`/patient/care`)**: Guided recovery plan (sleep hygiene, gentle movement, pelvic recovery, nutrition) with interactive progress tracking.
8. **Patient Settings & Profile (`/patient/settings`, `/patient/profile`)**: Confidentiality controls, language selection, emergency contact management, and session logout.

---

## 3. Multimodal Machine Learning & Safety Core

```mermaid
flowchart TD
    subgraph Input["1. Maternal Input Streams"]
        T["Text / Conversational EPDS\n(10 Canonical Items, 0-30 Score)"]
        A["Voice & Acoustic Stream\n(F0, Jitter, Shimmer, HNR, Speech Rate)"]
        V["Live Video / Visual Stream\n(Facial Valence, Gaze, Action Units AU04/12/15)"]
        C["Clinical History & Survey\n(Obstetric Factors, Prior PPD, Support System)"]
    end

    subgraph Processing["2. Independent Modality Inference"]
        P_T["Biomedical NER & Sentiment Classifier"]
        P_A["Acoustic Feature Extraction & Model"]
        P_V["Facial Dynamics & Affect Analyzer"]
        P_C["Gradient Boosted Clinical Risk Predictor"]
    end

    subgraph Fusion["3. Cross-Modal Integration & Safety"]
        F["Multimodal Late Fusion Combiner\n(Confidence Weighting & Fallback Handling)"]
        D["Discordance Detection\n(Identifies Masked / Minimized Depression)"]
        S["Deterministic Emergency Safety Intercept\n(Tele-MANAS 14416 / 1800-891-4416 Hotline)"]
    end

    subgraph Output["4. Unified Clinical Output"]
        R["Calibrated Risk Tier (Low / Moderate / High)"]
        DB[(PostgreSQL Hospital Database)]
        Dash["Clinician & Patient Real-Time Views"]
    end

    T --> P_T --> F
    A --> P_A --> F
    V --> P_V --> F
    C --> P_C --> F

    T -.->|Question 10 / Self-Harm| S
    F --> D
    F --> R
    S --> R
    R --> DB
    R --> Dash
```

### Safety & Crisis Protocol
- **EPDS Question 10 Guardrail**: Any non-zero answer on Question 10 (*"The thought of harming myself has occurred to me"*) automatically triggers an emergency banner with direct toll-free helpline links to **Tele-MANAS (14416 / 1800-891-4416)** and local emergency services.
- **Zero Hallucination / Zero Override**: The crisis intercept is deterministic and coded into both Python backend and React frontend—it cannot be bypassed or downgraded by AI inferences.

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
postpartum-depression-screening/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI matrix (Backend + Frontend)
├── backend/
│   ├── database/                # SQLAlchemy connection pool, session, and declarative Base
│   ├── models/                  # Database models (User, Mother, Screening, Review, CarePlan)
│   ├── routers/                 # FastAPI API route controllers
│   ├── schemas/                 # Pydantic v2 request/response contracts
│   ├── services/                # Business logic (Auth, Gemini Voice Assistant, Clinical ML)
│   └── main.py                  # FastAPI application entrypoint & lifecycle
├── data/
│   ├── raw/                     # Raw survey datasets (excluded from git)
│   ├── processed/               # Processed feature matrices
│   └── questions.json           # Canonical 10-item EPDS questionnaire schema
├── pipelines/                   # Clinical, Audio, Text, and Video ML feature pipelines
├── src/
│   ├── auth/                    # Role-based JWT authentication services & guards
│   ├── components/              # Shared UI components (KpiCard, TopNav, Icons)
│   ├── dashboard/               # Clinician Command Dashboard screens (01–07)
│   ├── patient/                 # Patient Emotional Care Portal screens & context
│   │   ├── components/          # Patient icons, modals, and shared widgets
│   │   ├── context/             # PatientContext provider & PostgreSQL sync
│   │   ├── layout/              # Unified TopNav & blush shell layout
│   │   ├── pages/               # 10 Patient screens (Home, Medical History, Screening, etc.)
│   │   ├── services/            # Patient API client & Web Speech assistant service
│   │   └── styles/              # Design tokens, hero cards, and layout CSS
│   ├── App.jsx                  # Root application router & providers
│   └── main.jsx                 # React DOM mount point
├── tests/                       # Pytest unit & integration test suite (141 tests)
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
   git clone https://github.com/nishasss692/ppd.git
   cd ppd
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

4. **Initialize local database and launch FastAPI:**
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

Create a `.env` file in the project root:
```ini
# Environment
ENVIRONMENT=development
RANDOM_SEED=42
LOG_LEVEL=INFO

# API Server
API_HOST=0.0.0.0
API_PORT=8000

# PostgreSQL Database (Defaults to SQLite in CI or when unset)
DATABASE_URL=postgresql://postgres:password@localhost:5432/ppd_screening
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_ECHO=false

# JWT Authentication
JWT_SECRET_KEY=your_secure_random_jwt_secret_key_minimum_32_characters
JWT_EXPIRATION_HOURS=24

# Gemini Multilingual Voice Assistant (Optional; fallback runs offline)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_MAX_TOKENS=1000
```

---

## 7. Running the Test Suites

Both backend and frontend feature thorough automated test suites designed for zero regressions:

### Frontend Unit & Integration Tests (Vitest)
```bash
# Run all 95 Vitest unit and integration tests across dashboard and patient portal
npm test

# Run patient portal tests only
npx vitest run src/patient/ --run
```
> **Current Result**: 18 test files passed (18/18), 95 tests passed (95/95).

### Frontend Production Build
```bash
npm run build
```
> **Current Result**: Compiles cleanly with 0 TypeScript/ESBuild errors into `dist/`.

### Backend Test Suite (Pytest)
```bash
# Run the complete CI test suite (questions, audio, clinical, voice assistant, database, patient persistence)
pytest -v tests/test_questions.py tests/test_audio_service.py tests/test_clinical_numerical.py tests/test_voice_assistant.py tests/test_database.py tests/test_patient_persistence.py
```
> **Current Result**: 141 passed in 19 seconds (141/141).

---

## 8. Clinical Disclaimer & Safety Governance

> [!IMPORTANT]
> **RESEARCH PROTOTYPE NOTICE — NOT A MEDICAL DEVICE**  
> 1. **Assessment, Not Diagnosis**: MIORA and the Edinburgh Postnatal Depression Scale (EPDS) are clinical screening aids designed to quantify depressive risk and emotional distress. They **do not** formulate medical diagnoses, establish psychiatric etiology, or prescribe pharmacotherapy.  
> 2. **Clinical Decision Support**: All scores, acoustic features, and video analysis markers are supportive tools intended for review by licensed medical practitioners (e.g., obstetricians, perinatal psychiatrists, midwives, and clinical psychologists).  
> 3. **Emergency Situations**: In cases of acute psychiatric crisis, severe despair, or thoughts of self-harm, patients are immediately guided to accredited 24/7 crisis hotlines including **Tele-MANAS (14416 / 1800-891-4416)** or emergency emergency rooms.  
> 4. **Data Privacy**: All patient communications and medical history records are encrypted in transit and at rest in compliance with strict clinical confidentiality standards.

---

## 9. License

This repository is distributed under a **Research & Clinical Prototype License**. Designed for academic investigation, clinical research, and computational screening evaluation. Commercial exploitation or unsupervised clinical deployment without regulatory clearance is strictly prohibited.
