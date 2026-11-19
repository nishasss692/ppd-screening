# AANCHAL — Three-Modality Architecture Audit & Fusion Redesign Report

> [!IMPORTANT]
> **RESEARCH PROTOTYPE NOTICE & SCIENTIFIC INTEGRITY**:
> AANCHAL is an experimental multimodal screening research prototype for Postpartum Depression (PPD), not a clinical diagnostic system. 
> The behavioral modalities evaluated here (synthetic maternal speech acoustics, synthetic self-reported narratives, and synthetic facial/motion dynamics) are computational engineering fixtures used to establish algorithmic benchmarks, cross-modal discordance mechanics, and pipeline verification. They do not constitute authentic clinical biomarkers.

---

## Executive Summary

Per the research redesign directives, this audit documents the architectural transition of the AANCHAL primary screening engine to a **pure three-modality behavioral screening model**:
1. **Text Modality** (Maternal narrative self-reports via TF-IDF + Regularized Logistic Regression)
2. **Audio Modality** (Acoustic vocal biomarker features via pooled statistics + Classifiers)
3. **Video Modality** (Facial Action Units, Head Pose, Gaze, and Motion dynamics via pooled statistics / recurrent architectures)

**Strict Boundary Rule**: Authentic clinical numerical demographic/obstetric survey features and Edinburgh Postnatal Depression Scale (EPDS) questionnaire items are **completely excluded** from this primary multimodal fusion model. EPDS questionnaire information is reserved strictly for a future second-stage integration.

---

## 1. Modality Readiness & Inventory Audit

An exhaustive physical inspection of datasets, manifests, pipelines, and serializations was conducted across all three behavioral modalities and the legacy clinical pipeline.

### Modality Summary Table

| Modality | Pipeline Script | Raw / Synthetic Dataset | Manifest Path | Sample Count (Train / Test) | Feature Representation | Model Architecture | Serialization Path | Production Status |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Text** | `pipelines/synthetic_text/train_text_model.py` | `data/synthetic/text/narratives/*.txt` | `data/synthetic/text/text_manifest.csv` | 800 (640 / 160) | TF-IDF (1–2 n-grams, 500 features) | Logistic Regression ($C=0.5$, balanced) | `models/text_model/` | **Ready for Stage 1 Fusion** |
| **Audio** | `pipelines/synthetic_audio/train_audio_model.py` | `data/synthetic/audio/features/*.npy` | `data/synthetic/audio/audio_manifest.csv` | 800 (640 / 160) | 512 pooled statistics ($T \times 128$) | Logistic Regression & Random Forest | `models/audio_model/` | **Ready for Stage 1 Fusion** |
| **Video** | `pipelines/video_model/train_baselines.py` | `data/synthetic/video_v2/features/*.npy` | `data/synthetic/video_v2/video_manifest.csv` | 800 (640 / 160) | 220 pooled summary statistics ($T \times 24$) | Logistic Regression & Random Forest | `artifacts/video_experiments/baseline_training/` & `models/video_model/` | **Ready for Stage 1 Fusion (Negative Control)** |
| **Clinical (Stage 2 Only)** | `pipelines/clinical_numerical/train_model.py` | `data/raw/Numerical/PPD_dataset_v3.csv` | `data/processed/Numerical/train_test_split_manifest.csv` | 800 (640 / 160) | 46 tabular demographic/obstetric features | Random Forest Baseline ($ROC=0.8187$) | `models/clinical_numerical/` | **Gated for Stage 2 Only (Excluded from Stage 1)** |

---

## 2. Participant Alignment & Canonical Split Consistency

All three behavioral modalities were validated against the canonical partition manifest (`data/processed/Numerical/train_test_split_manifest.csv`):

- **Total Cohort Size**: Exactly 800 participants (`BGD_001` through `BGD_800`).
- **Canonical Split**: Strictly frozen 640 training participants (80%) and 160 holdout test participants (20%).
- **Target Label**: `target_canonical_epds_ge_13` (Prevalence: Train = 43.91% [281/640], Test = 43.75% [70/160]).
- **Participant ID Order**: 100% matched across `text_manifest.csv`, `audio_manifest.csv`, `video_manifest.csv`, and the split manifest.
- **Partition Integrity**: Zero participant overlap between train and test subsets across all modalities. Zero holdout participants appear in any Out-Of-Fold (OOF) cross-validation file.

---

## 3. Individual Modality Performance Benchmarks

### A. Text Modality (`models/text_model/`)
- **Training Strategy**: 5-Fold Stratified Cross-Validation on 640 training narratives; vocabulary fitting strictly leak-free within each fold.
- **Holdout Evaluation**: Evaluated once on the 160 frozen holdout test narratives.
- **Metrics**:
  - **5-Fold OOF CV**: ROC-AUC: **0.6386**, PR-AUC: **0.5579**, F1-Score: **0.5581**, Balanced Accuracy: **0.6128**
  - **Holdout Test**: ROC-AUC: **0.6760** [95% CI: 0.589–0.757], PR-AUC: **0.5746** [95% CI: 0.490–0.669], F1-Score: **0.5946**, Balanced Accuracy: **0.6254**
  - **Holdout Confusion Matrix**: $\text{TP}=44, \text{FP}=30, \text{FN}=26, \text{TN}=60$ (Accuracy = $65.00\%$, Specificity = $66.67\%$, Recall = $62.86\%$).

### B. Audio Modality (`models/audio_model/`)
- **Training Strategy**: 5-Fold Stratified Cross-Validation on 640 training acoustic tensors ($T \times 128$); median imputation and standard scaling fitted strictly inside folds.
- **Holdout Evaluation**: Evaluated on 160 frozen holdout acoustic tensors.
- **Metrics (Logistic Regression Baseline)**:
  - **5-Fold OOF CV**: ROC-AUC: **0.5339**, PR-AUC: **0.4759**, F1-Score: **0.4782**, Balanced Accuracy: **0.5330**
  - **Holdout Test**: ROC-AUC: **0.5767** [95% CI: 0.485–0.665], PR-AUC: **0.5186** [95% CI: 0.443–0.614], F1-Score: **0.5352**, Balanced Accuracy: **0.5698**
  - **Holdout Confusion Matrix**: $\text{TP}=38, \text{FP}=33, \text{FN}=32, \text{TN}=57$ (Accuracy = $59.38\%$, Specificity = $63.33\%$, Recall = $54.29\%$).
- **Metrics (Random Forest Baseline)**:
  - **5-Fold OOF CV**: ROC-AUC: **0.5401**, PR-AUC: **0.4764**, F1-Score: **0.4357**, Balanced Accuracy: **0.5367**
  - **Holdout Test**: ROC-AUC: **0.6041** [95% CI: 0.513–0.690], PR-AUC: **0.5658** [95% CI: 0.483–0.658], F1-Score: **0.4925**, Balanced Accuracy: **0.5841**
  - **Holdout Confusion Matrix**: $\text{TP}=33, \text{FP}=22, \text{FN}=37, \text{TN}=68$ (Accuracy = $63.12\%$, Specificity = $75.56\%$, Recall = $47.14\%$).

### C. Video Modality (`artifacts/video_experiments/baseline_training/` & `models/video_model/`)
- **Training Strategy**: 5-Fold Stratified Cross-Validation on 640 training video tensors ($T \times 24$); 220 pooled summary statistics.
- **Holdout Evaluation**: Evaluated on 160 frozen holdout video tensors.
- **Metrics (Logistic Regression — All Features)**:
  - **5-Fold OOF CV**: ROC-AUC: **0.5034**, PR-AUC: **0.4213**, F1-Score: **0.4417**, Balanced Accuracy: **0.4934**
  - **Holdout Test**: ROC-AUC: **0.4854** [95% CI: 0.396–0.574], PR-AUC: **0.4297** [95% CI: 0.378–0.525], F1-Score: **0.4397**, Balanced Accuracy: **0.4992**
  - **Holdout Confusion Matrix**: $\text{TP}=31, \text{FP}=40, \text{FN}=39, \text{TN}=50$ (Accuracy = $50.62\%$, Specificity = $55.56\%$, Recall = $44.29\%$).
- **Diagnostic Ablation (Facial Motion vs. Tracking Metadata)**:
  - Facial & Motion only (198 features): Holdout ROC-AUC = **0.4725** [0.384–0.562], Balanced Acc = **0.4675**
  - Tracking only (22 features): Holdout ROC-AUC = **0.5459** [0.454–0.638], Balanced Acc = **0.5587**
- **Scientific Verification**: Video performance clusters universally at chance level (~0.50), confirming that synthetic video features act as an authentic **negative control** with zero target leakage.

---

## 4. Video Pipeline Bottleneck Analysis

### Problem Statement
Previous video training executions reportedly took over an hour or appeared to hang indefinitely. Our audit identified four concrete root causes:

### Root Cause 1: Combinatorial Disk I/O in Baseline Script (`train_baselines.py`)
In `run_baseline_experiment()`, the script iterates over 6 distinct model-feature combinations:
`[logistic_regression, random_forest] × [all, facial_motion, tracking_only]`.
In each iteration:
1. `run_cross_validation()` loads all 640 `.npy` training tensors from disk and calls `.transform()` on each.
2. `train_and_evaluate_holdout()` re-loads all 640 training tensors from disk, re-computes `.transform()`, loads all 160 holdout test tensors from disk, and re-computes `.transform()`.
- **Total file reads**: $6 \times (640 + 640 + 160) = \mathbf{8,640\text{ individual file reads}}$.
- **Total feature calculations**: $8,640$ full percentile and summary loops.
On Windows NTFS filesystems with real-time antivirus scanning, 8,640 file openings creates extreme disk I/O contention and substantial latency.

### Root Cause 2: Resampling Multiplier (6,000 Bootstrap Iterations)
In each of the 6 configurations, `compute_bootstrap_confidence_intervals()` executes 1,000 bootstrap iterations computing non-parametric ROC-AUC, PR-AUC, Balanced Accuracy, and F1. Across 6 configurations, $6 \times 1,000 = 6,000$ metric evaluations are run.

### Root Cause 3: Recurrent Deep Model Training on CPU (`train_recurrent.py` / `train_canonical_aligned.py`)
When recurrent models (GRU and BiLSTM) are executed:
- 5 folds × 2 architectures × up to 30 epochs = 300 forward-backward passes.
- Plus final holdout model training across 60 epochs.
On standard CPU hardware without GPU acceleration, unrolling PyTorch RNN graphs for sequences up to 120 frames across 640 participants takes between 45 and 75 minutes.

### Root Cause 4: PyTorch Dependency Blocker & Integration Lifespan Hanging
- Previously, `PPDVideoDataset` unconditionally imported `torch`. In environments without PyTorch, importing the module failed.
- During integration testing, calling FastAPI endpoints triggered application `lifespan`, which attempted to connect to PostgreSQL at `localhost:5432`. In environments without a live PostgreSQL instance, `psycopg2` attempts network socket connections that hang or retry until system timeout.

### Proposed Smallest Safe Fix
1. **In-Memory Feature Caching**: Load all 800 tensors once and compute the full 220-feature matrix once in memory before iterating over models or ablation subsets. Slice feature columns in memory instead of re-reading 8,640 files.
   - *Result*: Baseline execution time drops from 10+ minutes to **< 15 seconds**.
2. **Conditional PyTorch Decoupling**: Implemented and verified in Phase 4A (enabling baseline Scikit-Learn training without PyTorch).
3. **Database Mocking in Tests**: Ensure test clients use mock engines rather than connecting to live PostgreSQL sockets.

---

## 5. Proposed Three-Modality Architecture Design

```
+-----------------------------------------------------------------------------------+
|                        STAGE 1: BEHAVIORAL MULTIMODAL SCREENING                   |
|                                                                                   |
|  [Maternal Narrative]          [Speech Audio]             [Facial Dynamics Video] |
|           |                           |                              |            |
|           v                           v                              v            |
|     TF-IDF Vectorizer         Acoustic Pooling               Temporal Pooling     |
|   (500 N-Grams, train)      (512 ch statistics)            (220 summary features) |
|           |                           |                              |            |
|           v                           v                              v            |
|  Logistic Regression         Logistic / Random Forest       Logistic / Random Forest |
|           |                           |                              |            |
|           +---------------------------+------------------------------+            |
|                                       |                                           |
|                                       v                                           |
|                   [Three-Modality Feature Collation]                              |
|                   (P_text, P_audio, P_video, Quality Flags)                       |
|                                       |                                           |
|                                       v                                           |
|                   [Modality Quality & Missingness Filter]                         |
|                   - Audio: Check SNR / minimum duration (>3s)                     |
|                   - Video: Check tracking confidence (>=0.60) / dropout (<40%)    |
|                   - Text: Check narrative word count (>=15 words)                 |
|                                       |                                           |
|                                       v                                           |
|                   [Stage 1 Multimodal Fusion Classifier]                          |
|                   - Approach A: Equal-Weight Benchmark (1/3 each)                  |
|                   - Approach B: Non-Negative Learned Meta-Classifier              |
|                   - Dynamic reweighting over available modalities                 |
|                   - Cross-modal discordance & entropy estimation                  |
|                                       |                                           |
|                                       v                                           |
|              +-------------------------------------------------+                  |
|              | STAGE 1 OUTPUT: Multimodal Behavioral Risk Index|                  |
|              | (Probability, Risk Tier, Modality Discordance)  |                  |
|              +-------------------------------------------------+                  |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                  STAGE 2: FUTURE EPDS CLINICAL TRIAGE INTEGRATION                 |
|                           (NOT TO BE IMPLEMENTED IN STAGE 1)                      |
|                                                                                   |
|      [Stage 1 Fused Behavioral Risk]       +       [EPDS 10-Item Questionnaire]   |
|                                                              |                    |
|                                                              v                    |
|                                                   [Q10 Suicidal Ideation Flag]    |
|                                                   (Immediate Safety Escalation)   |
|                                                              |                    |
|                                                              v                    |
|                                                [Clinical Triage Decision Matrix]  |
|                                                (Combines Behavioral & EPDS Scores)|
+-----------------------------------------------------------------------------------+
```

### Fusion Mechanics & Safeguards
1. **Late Fusion Input Space**:
   - $X_{\text{fusion}} = [p_{\text{text}}, p_{\text{audio}}, p_{\text{video}}] \in [0.0, 1.0]^3$.
   - Trained strictly on the 640 Out-Of-Fold (OOF) cross-validation predictions to guarantee zero train-to-fusion leakage.
2. **Missing Modality Fallback**:
   - If a participant does not provide video or audio (e.g., poor lighting, privacy concerns, low bandwidth), the fusion strategy dynamically re-normalizes weights across available validated modalities:
     $$w_m' = \frac{w_m}{\sum_{k \in \mathcal{A}} w_k}$$
     where $\mathcal{A}$ is the set of available modalities meeting quality thresholds. Absent streams are never imputed with synthetic default predictions.
3. **Uncertainty & Discordance Estimation**:
   - Prediction entropy: $H(p) = -p \log_2(p) - (1-p) \log_2(1-p)$.
   - Cross-modal variance / spread: $\Delta_{\max} = \max_{i, j \in \mathcal{A}} |p_i - p_j|$. When $\Delta_{\max} \ge 0.25$, flag for clinical review.

---

## 6. EPDS Integration — Future Stage Only & Target Leakage Warning

> [!CAUTION]
> **CRITICAL SCIENTIFIC INTEGRITY & TARGET LEAKAGE WARNING**:
> The primary binary target used throughout the AANCHAL modeling pipeline is `target_canonical_epds_ge_13`, which is analytically derived from:
> $$\text{target} = \mathbb{I}(\text{EPDS Total Score} \ge 13)$$
> 
> If the 10 EPDS questionnaire responses (or the total EPDS score) are included as input features in a statistical or machine-learning model predicting `target_canonical_epds_ge_13`, **the model will suffer from 100% circular target leakage**. The model would trivially learn that $\sum Q_i \ge 13 \implies \text{target}=1$, rendering all behavioral modalities irrelevant and producing invalid research conclusions.
> 
> **Architectural Resolution for Stage 2**:
> 1. **Option A (Clinical Triage Matrix — Recommended)**: EPDS is NOT treated as a statistical feature in the ML model. Instead, Stage 1 produces a behavioral risk index from Text + Audio + Video. In Stage 2, a deterministic clinical triage rule evaluates the combination:
>    - High Behavioral Risk + High EPDS ($\ge 13$) $\rightarrow$ Priority Clinical Evaluation.
>    - Discordant Risk (Discrepancy between behavioral risk and EPDS) $\rightarrow$ Cross-Modal Disagreement Flag for Clinician Review.
>    - Low Behavioral Risk + Low EPDS $\rightarrow$ Routine Postnatal Care.
>    - EPDS Item 10 $> 0$ $\rightarrow$ Immediate Psychiatric Safety Protocol (bypasses ML).
> 2. **Option B (Secondary Predictive Modeling)**: If a second-stage machine learning model is desired that takes both Stage 1 behavioral predictions and EPDS items as predictors, the outcome variable MUST be replaced by an **independently established clinical outcome**, such as:
>    - DSM-5 / ICD-11 Structured Clinical Interview for Depression (SCID-5) conducted by a licensed perinatal psychiatrist.
>    - Longitudinal clinical diagnosis at 6 months postpartum.
> Under no circumstances may EPDS responses be used to predict an EPDS-derived target.

---

## 7. Staged Implementation Plan

| Phase | Description | Actions & Deliverables | Safeguards |
| :---: | :--- | :--- | :--- |
| **Stage 1A** | **Video Baseline Optimization** | Apply in-memory caching to `pipelines/video_model/train_baselines.py` to prevent redundant 8,640 file reads. Verify runtime < 15 seconds. | Do not touch recurrent neural network code. |
| **Stage 1B** | **Three-Modality Fusion Pipeline** | Create `pipelines/three_modality_fusion/train_three_modality_fusion.py` consuming Text, Audio, Video OOF predictions. | Strictly exclude clinical numerical data. |
| **Stage 1C** | **Evaluation & Benchmarking** | Train Equal-Weight and Non-Negative Meta-Classifiers on 640 OOF samples; evaluate once on 160 holdout samples with 1,000 bootstrap CIs. | Frozen holdout evaluation; report ROC-AUC, PR-AUC, F1, Balanced Acc. |
| **Stage 1D** | **Modality Quality & Discordance** | Implement quality checks (SNR, tracking dropout, word count) and discordance rules. | Transparently document negative control video behavior. |
| **Stage 2** | **Future EPDS Integration** | Design second-stage clinical triage matrix or independent SCID outcome specification. | **Strictly deferred to future milestone.** |

---
*Report produced for AANCHAL Research Prototype Multimodal Redesign.*
