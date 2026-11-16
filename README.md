# Postpartum Depression (PPD) Recognition Research Prototype
# MIORA — Postpartum Health & Clinical Intelligence Platform

[![CI Test Suite](https://github.com/navamishetty72/ppd-screening/actions/workflows/ci.yml/badge.svg)](https://github.com/navamishetty72/ppd-screening/actions)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![Pydantic v2](https://img.shields.io/badge/pydantic-v2.6+-green.svg)](https://docs.pydantic.dev/)
[![License: Research Only](https://img.shields.io/badge/license-Research%20Only-lightgrey.svg)]()
[![CI Test Suite](https://github.com/nishasss692/ppd/actions/workflows/ci.yml/badge.svg)](https://github.com/nishasss692/ppd/actions)
[![React 19](https://img.shields.io/badge/React-19.3-61dafb.svg?style=flat&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10--3.13](https://img.shields.io/badge/Python-3.10%20|%203.11%20|%203.12%20|%203.13-blue.svg?style=flat&logo=python)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20|%2018-336791.svg?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Vite 5](https://img.shields.io/badge/Vite-5.4-646cff.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-95%20Tests%20Passing-green.svg?style=flat&logo=vitest)](https://vitest.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-141%20Tests%20Passing-brightgreen.svg?style=flat&logo=pytest)](https://pytest.org/)
[![License: Research & Clinical Prototype](https://img.shields.io/badge/License-Research%20Prototype-lightgrey.svg)]()

A research-oriented, multimodal computational screening prototype for Postpartum Depression (PPD) combining real clinical survey data with clinically conditioned synthetic acoustic, linguistic, and visual feature representations.
> **MIORA** (*Maternal Intelligence & Outcome Review Architecture*) is a multimodal clinical screening and emotional well-being intelligence platform designed to assist healthcare professionals in identifying, monitoring, and evaluating risk for **Postpartum Depression (PPD)** after childbirth.

> [!IMPORTANT]
> **Developer Team Handoff Guide:**  
> The data foundation phase is complete across all four branches (clinical numerical + synthetic audio, text, and video). For the incoming developer implementing unimodal model training, evaluation, and multimodal late fusion, please refer to the complete handoff specification at:  
> [**Developer Handoff Guide (docs/TEAM_HANDOFF.md)**](docs/TEAM_HANDOFF.md).
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

## 1. Project Overview & Research Objectives
## 1. Platform Overview & Key Features

Postpartum Depression (PPD) affects an estimated 10% to 20% of childbearing women globally, with elevated prevalence and chronic underdiagnosis across low- and middle-income countries (LMICs). Clinical screening has traditionally relied on self-report questionnaires such as the Edinburgh Postnatal Depression Scale (EPDS) and Patient Health Questionnaire (PHQ-9). While effective when administered by trained personnel, these psychometric instruments are susceptible to recall bias, social stigma, transcription variability, and regional access barriers.
Postpartum Depression (PPD) affects an estimated 10% to 20% of childbearing women worldwide, often going underdiagnosed due to social stigma, clinic distance, and fear of judgment. Traditional screening relies on self-reported questionnaires like the **Edinburgh Postnatal Depression Scale (EPDS)**, which can be vulnerable to recall bias and conversational discomfort.

Recent machine learning research has proposed multimodal computational architectures that integrate acoustic, visual, and lexical biomarkers to support psychiatric assessment. However, genuine multimodal clinical datasets—simultaneously capturing audio, video, text, and structured clinical observations from postpartum patients—do not currently exist in the open research domain.
**MIORA** combines compassionate patient engagement with clinician-facing decision intelligence:
- **Conversational EPDS Screening**: Administers the validated 10-item EPDS through an empathetic AI voice dialogue rather than cold forms.
- **Mother-Controlled Audio & Visual Sensors**: Live video stream and microphone activation with full patient autonomy (microphone stays idle until clicked).
- **Multilingual Support (8 Indian Languages)**: Conversational check-ins in English, Hindi, Kannada, Tamil, Telugu, Malayalam, Bengali, and Marathi.
- **Deterministic Crisis Safety Intercept**: Immediate, zero-latency escalation to **Tele-MANAS (14416 / 1800-891-4416)** whenever Question 10 or distress markers indicate self-harm risk.
- **Cross-Modal Discordance Engine**: Identifies discrepancies between self-reported scores and behavioral acoustic/facial cues for clinical review.
- **Enterprise Persistence**: Real-time synchronization of patient records, screening sessions, consultation appointments, and care tasks with PostgreSQL.

This repository implements an **Architectural Integration Benchmark and Engineering Prototype** designed to:
- Establish a rigorous, leakage-free clinical baseline on verified postpartum survey data.
- Design a modular, decoupled four-branch multimodal architecture (`clinical_numerical`, `synthetic_audio`, `synthetic_text`, `synthetic_video`).
- Evaluate multimodal fusion mechanisms (early feature concatenation, late probability fusion, and hybrid cross-attention) under controlled simulated conditions.
- Implement robust integration contracts and defensive schema validation to prevent silent pipeline failures.

---

## 2. Research Boundaries & Ethical Considerations
## 2. Dual-Portal Architecture

> [!CAUTION]
> ### STRICT METHODOLOGICAL & CLINICAL DISCLAIMERS
> 1. **Research Prototype Only — Not for Clinical Diagnostic Use:** This system is an engineering research prototype designed to investigate multimodal fusion architectures and data integrity contracts. It has **NOT** undergone clinical trials, regulatory clearance, or clinical validation. It must **never** be used for medical diagnosis, clinical triage, or patient screening.
> 2. **Real Clinical Survey Data:** The clinical/numerical branch operates on 800 de-identified postpartum survey records collected in Bangladesh (canonical EPDS $\ge 13$ target; 351 positive, 449 negative). No identifying patient health information is retained or tracked in version control.
> 3. **Synthetic Modalities are Simulated Fixtures:** The Bangladeshi clinical dataset contains **zero** audio recordings, video sessions, or free-text narrative interviews. The acoustic, visual, and textual feature sets in this prototype are **simulated observations** generated from audited distributions and non-target clinical conditioning.
> 4. **Constructed Linkage for Architectural Benchmarking:** Synthetic records share participant identifiers with clinical records solely to test end-to-end data pipelines, multimodal tensor fusion, and defensive fallback contracts. This linkage is mathematically constructed; synthetic records do **not** represent real recordings or behavioral expressions of the surveyed women.
> 5. **No Synthetic Clinical Validity Claims:** Performance improvements observed on synthetic or semi-synthetic multimodal inputs evaluate pipeline robustness and fusion algorithms only. They **cannot and do not** demonstrate real-world clinical predictive efficacy.
> 6. **Zero Target Leakage:** EPDS questionnaire items (e.g., EPDS_1 through EPDS_10) and PHQ questions are strictly sequestered to derive ground truth labels and are excluded from clinical predictor sets and synthetic conditioning routines.
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

## 3. Four-Branch Multimodal Architecture
## 3. Multimodal Machine Learning & Safety Core

The prototype implements four independent modality pipelines converging into a late-fusion and decision layer:

```mermaid
flowchart TD
    subgraph Ingestion["1. Multi-Stream Ingestion Layer"]
        M1["Clinical Survey Record\n800 Real Records (Tabular)"]
        M2["Synthetic Audio Profile\n800 Conditioned Profiles (Acoustic)"]
        M3["Synthetic Text Profile\n800 Conditioned Records (NLP)"]
        M4["Synthetic Video Profile\n800 Conditioned Trajectories (AUs)"]
    subgraph Input["1. Maternal Input Streams"]
        T["Text / Conversational EPDS\n(10 Canonical Items, 0-30 Score)"]
        A["Voice & Acoustic Stream\n(F0, Jitter, Shimmer, HNR, Speech Rate)"]
        V["Live Video / Visual Stream\n(Facial Valence, Gaze, Action Units AU04/12/15)"]
        C["Clinical History & Survey\n(Obstetric Factors, Prior PPD, Support System)"]
    end

    subgraph Pipelines["2. Independent Modality Pipelines"]
        P1["Clinical Numerical Pipeline\n(Preprocessing, Imputation, Gradient Boosting)"]
        P2["Synthetic Audio Pipeline\n(F0, Formants, Jitter, Shimmer, HNR, MFCCs)"]
        P3["Synthetic Text Pipeline\n(Clinical Lexical Analysis, Sentiment, Token Models)"]
        P4["Synthetic Video Pipeline\n(OpenFace AUs, Facial Dynamics, Landmark Velocity)"]
    subgraph Processing["2. Independent Modality Inference"]
        P_T["Biomedical NER & Sentiment Classifier"]
        P_A["Acoustic Feature Extraction & Model"]
        P_V["Facial Dynamics & Affect Analyzer"]
        P_C["Gradient Boosted Clinical Risk Predictor"]
    end

    subgraph Contracts["3. Pydantic v2 Schema Validation"]
        C1["ClinicalOutputSchema\n(P(PPD), Feature Importance, Integrity)"]
        C2["AudioOutputSchema\n(Acoustic Risk Score, Quality, Snr)"]
        C3["TextOutputSchema\n(Lexical Risk Score, Sentiment, Risk Tokens)"]
        C4["VideoOutputSchema\n(Visual Risk Score, Confidence, Occlusion)"]
    subgraph Fusion["3. Cross-Modal Integration & Safety"]
        F["Multimodal Late Fusion Combiner\n(Confidence Weighting & Fallback Handling)"]
        D["Discordance Detection\n(Identifies Masked / Minimized Depression)"]
        S["Deterministic Emergency Safety Intercept\n(Tele-MANAS 14416 / 1800-891-4416 Hotline)"]
    end

    subgraph Fusion["4. Multimodal Fusion Engine"]
        F1["Late Fusion Combiner\nDynamic Confidence Weighting\nMissing Modality Graceful Fallback"]
        F2["Calibrated Multimodal PPD Risk Score [0.0, 1.0]\nUncertainty Estimation & Modality Attribution"]
    subgraph Output["4. Unified Clinical Output"]
        R["Calibrated Risk Tier (Low / Moderate / High)"]
        DB[(PostgreSQL Hospital Database)]
        Dash["Clinician & Patient Real-Time Views"]
    end

    M1 --> P1 --> C1 --> F1
    M2 --> P2 --> C2 --> F1
    M3 --> P3 --> C3 --> F1
    M4 --> P4 --> C4 --> F1
    F1 --> F2
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

### Modality Pipeline Specifications
### Safety & Crisis Protocol
- **EPDS Question 10 Guardrail**: Any non-zero answer on Question 10 (*"The thought of harming myself has occurred to me"*) automatically triggers an emergency banner with direct toll-free helpline links to **Tele-MANAS (14416 / 1800-891-4416)** and local emergency services.
- **Zero Hallucination / Zero Override**: The crisis intercept is deterministic and coded into both Python backend and React frontend—it cannot be bypassed or downgraded by AI inferences.

| Branch | Data Source | Features / Representations | Primary Models |
|---|---|---|---|
| **`clinical_numerical`** | 800 real postpartum survey records | Sociodemographic, obstetric history, marital/family support, healthcare access (48 non-target predictors) | LightGBM, XGBoost, Calibrated Logistic Regression |
| **`synthetic_audio`** | 800 clinically conditioned simulations | Acoustic parameters: F0 mean/std, jitter, shimmer, HNR, formants (F1–F3), pause ratio, MFCCs | Random Forest, 1D-CNN, MLP |
| **`synthetic_text`** | 800 clinically conditioned simulations | Simulated clinical interview responses, postpartum sentiment tokens, semantic embeddings | Transformer-based embeddings, TF-IDF + Logistic Regression |
| **`synthetic_video`** | 800 clinically conditioned simulations | Facial Action Units (AU04, AU12, AU15), head pose dynamics, gaze velocity, smile duration | Temporal Convolutional Network (TCN), BiLSTM, SVM |
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

## 4. Repository Structure
## 5. Repository Structure

```
PPD-Research/
│
├── README.md                      # Comprehensive project documentation
├── requirements.txt              # Core Python dependencies
├── .gitignore                    # Exclusion rules for private data, models, caches
├── .env.example                  # Environment configuration template
│
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
│   ├── raw/                      # Raw dataset placeholders and ingestion manifests
│   ├── processed/                # Audited, cleaned, and partitioned feature matrices
│   └── synthetic/                # Clinically conditioned synthetic multimodal fixtures
│
├── pipelines/
│   ├── clinical_numerical/       # Pipeline 1: Real clinical survey modeling
│   ├── synthetic_audio/          # Pipeline 2: Acoustic feature extraction and modeling
│   ├── synthetic_text/           # Pipeline 3: Clinical narrative and lexical modeling
│   └── synthetic_video/          # Pipeline 4: Facial Action Unit and visual modeling
│
├── fusion/                       # Multimodal fusion engines (early, late, hybrid)
├── evaluation/                   # Evaluation protocols, benchmark metrics, validation
├── backend/                      # FastAPI asynchronous inference service
├── frontend/                     # Research dashboard and multimodal visualization UI
├── tests/                        # Comprehensive unit, integration, and contract test suite
│
├── research/
│   ├── literature_review/        # Systematic reviews of multimodal PPD and depression literature
│   ├── methodology/              # Formal scientific protocols and generation logic
│   ├── evidence_gaps/            # Gap analysis between published claims and empirical evidence
│   └── risk_register/            # Clinical, algorithmic, and methodological risk registers
│
└── docs/                         # System architecture specifications and API contracts
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

## 5. Technology Stack
## 6. Local Development & Quickstart

- **Runtime & Language:** Python 3.11+
- **Machine Learning & Statistics:** `scikit-learn>=1.4.0`, `numpy>=1.26.0`, `pandas>=2.2.0`, `scipy>=1.12.0`
- **Data Validation & Typing:** `pydantic>=2.6.0`, `pydantic-settings>=2.2.0`
- **API & Serving:** `fastapi>=0.110.0`, `uvicorn[standard]>=0.28.0`
- **Testing & Quality Assurance:** `pytest>=8.0.0`, `pytest-cov>=4.1.0`
- **Acoustic & Vision Specifications:** Librosa-compatible schemas, OpenFace 2.2.0 AU definitions
### Prerequisites
- **Node.js**: v20.x or higher
- **Python**: v3.10, v3.11, v3.12, or v3.13
- **PostgreSQL**: v16+ (or SQLite fallback for offline development)
- **Git**

---

## 6. Installation & Environment Configuration
### Step 1: Backend Setup

### Prerequisites
- Python 3.11 or higher
- Git 2.30+
- Virtual environment tool (`venv` or `conda`)
1. **Clone the repository:**
   ```bash
   git clone https://github.com/nishasss692/ppd.git
   cd ppd
   ```

### Step 1: Clone the Repository
```bash
git clone https://github.com/navamishetty72/ppd-screening.git
cd ppd-screening
```
2. **Create and activate a Python virtual environment:**
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\Activate.ps1

### Step 2: Create and Activate Virtual Environment
```bash
# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1
   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```
3. **Install Python dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

### Step 3: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```
4. **Initialize local database and launch FastAPI:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Interactive Swagger documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs).

### Step 4: Configure Environment Variables
```bash
# Copy template configuration
cp .env.example .env
```
---

Review `.env` and adjust configuration variables as needed:
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

## 7. How to Run the Project
## 7. Running the Test Suites

### Running the Test Suite
Verify that all schemas, pipeline contracts, and test fixtures pass:
Both backend and frontend feature thorough automated test suites designed for zero regressions:

### Frontend Unit & Integration Tests (Vitest)
```bash
pytest tests/ -v
# Run all 95 Vitest unit and integration tests across dashboard and patient portal
npm test

# Run patient portal tests only
npx vitest run src/patient/ --run
```
> **Current Result**: 18 test files passed (18/18), 95 tests passed (95/95).

### Starting the FastAPI Inference Server
Launch the backend service in development mode:
### Frontend Production Build
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
npm run build
```
Interactive API documentation will be accessible at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
> **Current Result**: Compiles cleanly with 0 TypeScript/ESBuild errors into `dist/`.

### Inspecting Architecture Documentation
Detailed architectural blueprints, sequence diagrams, and mathematical formulation of the late fusion algorithm can be found in [`docs/architecture.md`](docs/architecture.md).
### Backend Test Suite (Pytest)
```bash
# Run the complete CI test suite (questions, audio, clinical, voice assistant, database, patient persistence)
pytest -v tests/test_questions.py tests/test_audio_service.py tests/test_clinical_numerical.py tests/test_voice_assistant.py tests/test_database.py tests/test_patient_persistence.py
```
> **Current Result**: 141 passed in 19 seconds (141/141).

---

## 8. Data Governance & Security
## 8. Clinical Disclaimer & Safety Governance

- **Strict `.gitignore` Enforcement:** Real patient data, large auxiliary feature directories (`Audio_feature/`, `Video_feature/`), trained weights (`.joblib`, `.pt`, `.onnx`), and environment credentials (`.env`) are strictly excluded from version control.
- **Reproducible Partitioning:** All train/validation/test splits use fixed pseudo-random seeds (`seed=42`) with stratification on the canonical binary EPDS label ($\ge 13$).
- **No Secret Storage:** No passwords, access tokens, or sensitive endpoint configurations are committed to this repository.
> [!IMPORTANT]
> **RESEARCH PROTOTYPE NOTICE — NOT A MEDICAL DEVICE**  
> 1. **Assessment, Not Diagnosis**: MIORA and the Edinburgh Postnatal Depression Scale (EPDS) are clinical screening aids designed to quantify depressive risk and emotional distress. They **do not** formulate medical diagnoses, establish psychiatric etiology, or prescribe pharmacotherapy.  
> 2. **Clinical Decision Support**: All scores, acoustic features, and video analysis markers are supportive tools intended for review by licensed medical practitioners (e.g., obstetricians, perinatal psychiatrists, midwives, and clinical psychologists).  
> 3. **Emergency Situations**: In cases of acute psychiatric crisis, severe despair, or thoughts of self-harm, patients are immediately guided to accredited 24/7 crisis hotlines including **Tele-MANAS (14416 / 1800-891-4416)** or emergency emergency rooms.  
> 4. **Data Privacy**: All patient communications and medical history records are encrypted in transit and at rest in compliance with strict clinical confidentiality standards.

---

## 9. Contributors & Research Citation
## 9. License

This prototype is developed for academic and computational research into multimodal psychiatric screening architectures.

If utilizing this repository structure or methodology in your research, please cite:
```bibtex
@misc{ppd_multimodal_prototype_2026,
  title={Postpartum Depression (PPD) Multimodal Recognition Research Prototype},
  author={Research Team},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/navamishetty72/ppd-screening}}
}
```

---

## 10. License

This repository is distributed under a **Research-Only License**. The code and schemas may be used for educational, scientific, and experimental evaluation purposes. Commercial exploitation, clinical diagnostic deployment, and unverified medical application are strictly prohibited.
This repository is distributed under a **Research & Clinical Prototype License**. Designed for academic investigation, clinical research, and computational screening evaluation. Commercial exploitation or unsupervised clinical deployment without regulatory clearance is strictly prohibited.
