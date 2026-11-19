# AANCHAL – Audio & Text Baseline Model Training & Evaluation Report

**Repository Path:** `d:\ppd-screening-1`  
**Execution Date:** November 19, 2026  
**Auditor / ML Engineer:** Antigravity AI – Senior Clinical Machine Learning Systems  
**Phase:** Phase 3 – Baseline Training & Evaluation for Audio and Text Modalities  
**Operating Compliance:** Strict Experimental Discipline (Video models untouched, clinical models preserved, zero data leakage, separate artifact isolation)

---

> [!IMPORTANT]
> **Scientific Integrity & Modality Provenance Disclaimer:**  
> The **Audio** and **Text** datasets evaluated herein are **clinically conditioned synthetic simulations** generated as engineering benchmarks for multimodal integration testing.
> - The primary maternal clinical cohort collected in Bangladesh ($N=800$) consists strictly of numerical and categorical survey responses; **no physical voice recordings or qualitative patient interview transcripts were recorded in the study**.
> - The binary target (`target_canonical_epds_ge_13`) represents authentic clinical ground truth from the administered 10-item EPDS questionnaires.
> - **Clinical Validity Warning:** These models learn statistical associations between simulated domestic/acoustic covariates and clinical screening risk. They do **not** reflect authentic patient voice acoustics or spontaneous maternal speech patterns. **Under no circumstances should these models be represented as clinically validated diagnostic tools or standalone depression screeners.**

---

## 1. Executive Summary

Baseline supervised machine learning models for the **Audio (Acoustic Summary Features)** and **Text (Contextual Vignettes)** modalities were trained and evaluated following rigorous, leak-free methodological protocols:

1. **Pre-Training Verification:**  
   Both datasets were verified for exact alignment with the authoritative 800-participant canonical split manifest (`data/processed/Numerical/train_test_split_manifest.csv`). Zero train/test overlap exists. Predictors strictly exclude participant IDs, filenames, split indicators, and target labels.
2. **Audio Pipeline Execution (`pipelines/synthetic_audio/train_audio_model.py`):**  
   - Trained **Logistic Regression** ($L_2$, $C=0.1$, balanced) and **Random Forest** ($100$ trees, max depth $4$) on the 7 physiological acoustic summary features.
   - Evaluated using 5-fold Stratified Cross-Validation on the 640 training participants and single-shot evaluation on the 160 untouched holdout participants with 1000-sample non-parametric bootstrap $95\%$ confidence intervals.
   - Holdout ROC-AUC: **$0.5767$** (Logistic Regression, $95\%$ CI: $[0.4832, 0.6600]$) and **$0.6041$** (Random Forest, $95\%$ CI: $[0.5100, 0.6845]$).
3. **Text Pipeline Execution (`pipelines/synthetic_text/train_text_model.py`):**  
   - Trained an end-to-end `Pipeline([('tfidf', TfidfVectorizer(ngram_range=(1,2), min_df=3, max_features=1000)), ('classifier', LogisticRegression(C=0.5, balanced))])`.
   - Feature extraction (TF-IDF vocabulary) was fitted strictly inside cross-validation folds and exclusively on training narratives.
   - Holdout ROC-AUC: **$0.6760$** ($95\%$ CI: $[0.5870, 0.7572]$), Holdout F1-score: **$0.5946$**, Balanced Accuracy: **$0.6254$**.
4. **Artifact Isolation:**  
   Models, scalers, vectorizers, out-of-fold predictions, holdout predictions, and evaluation metrics were serialized in production paths (`models/audio_model/`, `models/text_model/`) and mirrored into dedicated experimental tracking archives (`artifacts/audio_experiments/baseline_training/`, `artifacts/text_experiments/baseline_training/`) without overwriting any pre-existing files.

---

## 2. PART A – Audio Baseline Model Training

### 2.1 Pre-Execution Dataset & Leakage Audit
- **Manifest:** `data/synthetic/audio/audio_manifest.csv` ($800$ rows, 14 columns).
- **Features Verified:** Exactly 7 physiological summary scalars (`f0_mean_hz`, `f0_std_hz`, `jitter_local_percent`, `shimmer_local_percent`, `hnr_db`, `speech_rate_syllables_per_sec`, `pause_ratio`).
- **Feature Bounds:** $100\%$ of values fall strictly within physiological ranges (`ACOUSTIC_FEATURE_BOUNDS`); zero NaN, null, or infinite values.
- **Leakage Prevention:**
  - $X$ strictly isolates the 7 acoustic features. Participant ID (`participant_id`), split flag (`split_partition`), and target (`target_canonical_epds_ge_13`) are excluded from model inputs.
  - In cross-validation, `StandardScaler` is fitted exclusively on $X_{\text{train\_fold}}$ and applied to $X_{\text{val\_fold}}$.
  - For holdout evaluation, `final_scaler` is fitted exclusively on the 640 training participants.
  - Zero participant overlap between training and test sets ($\text{Train} \cap \text{Holdout} = \emptyset$).

### 2.2 Audio Training Configuration
- **Dataset Partition:** 640 Training (281 Positive, 359 Negative), 160 Holdout Test (70 Positive, 90 Negative).
- **Random Seed:** $42$ (Deterministic split, cross-validation, and bootstrap).
- **Algorithms Evaluated:**
  1. `LogisticRegression(penalty='l2', C=0.1, solver='lbfgs', class_weight='balanced', max_iter=1000, random_state=42)`
  2. `RandomForestClassifier(n_estimators=100, max_depth=4, min_samples_leaf=3, class_weight='balanced', random_state=42)`

---

## 3. PART B – Text Baseline Model Training

### 3.1 Pre-Execution Dataset & Leakage Audit
- **Manifest:** `data/synthetic/text/text_manifest.csv` ($800$ rows, 13 columns).
- **Narratives Verified:** 800 individual text files in `data/synthetic/text/narratives/{participant_id}.txt`.
- **Content Inspection:** Word counts range between 120 and 147 words (mean: $133.3$ words).
- **Shortcut & Leakage Elimination:**
  - None of the text files contain participant identifiers (`BGD_xxx`), filenames, or target labels.
  - Clinical diagnostic terms (*"depressed"*, *"suicide"*, *"EPDS"*, *"hopeless"*, *"score"*) are completely banned and absent.
  - Narratives describe domestic context (parity, living arrangements, domestic support, infant feeding and sleep).
- **Preprocessing Isolation:**
  - `TfidfVectorizer` is fitted strictly on training texts inside each cross-validation fold.
  - Holdout vectorizer is fitted exclusively on the 640 training texts and applied to the 160 holdout texts.

### 3.2 Text Training Configuration
- **Dataset Partition:** 640 Training (281 Positive, 359 Negative), 160 Holdout Test (70 Positive, 90 Negative).
- **Random Seed:** $42$.
- **TF-IDF Parameters:** N-gram range: $(1, 2)$, sublinear term frequency: `True`, min document frequency: $3$, max vocabulary features: $1,000$.
- **Classifier Parameters:** `LogisticRegression(penalty='l2', C=0.5, solver='lbfgs', class_weight='balanced', max_iter=1000, random_state=42)`.

---

## 4. PART C – Comprehensive Evaluation Metrics

### 4.1 Audio Modality Performance Table

| Evaluation Stage | Metric | Logistic Regression | Random Forest |
| :--- | :--- | :--- | :--- |
| **5-Fold Cross-Validation**<br>($N=640$ Training Cohort) | **ROC-AUC (Fold Mean $\pm$ SD)** | **0.5387 $\pm$ 0.0435** | **0.5120 $\pm$ 0.0364** |
| | PR-AUC (Fold Mean $\pm$ SD) | 0.4789 $\pm$ 0.0461 | 0.4435 $\pm$ 0.0402 |
| | Accuracy (Fold Mean $\pm$ SD) | 0.5406 $\pm$ 0.0471 | 0.5094 $\pm$ 0.0210 |
| | Balanced Accuracy (Fold Mean $\pm$ SD) | 0.5342 $\pm$ 0.0440 | 0.5057 $\pm$ 0.0232 |
| | Sensitivity (Fold Mean $\pm$ SD) | 0.4842 $\pm$ 0.0763 | 0.4770 $\pm$ 0.0767 |
| | Specificity (Fold Mean $\pm$ SD) | 0.5843 $\pm$ 0.0381 | 0.5345 $\pm$ 0.0827 |
| | Precision (Fold Mean $\pm$ SD) | 0.4795 $\pm$ 0.0526 | 0.4503 $\pm$ 0.0287 |
| | F1-Score (Fold Mean $\pm$ SD) | 0.4789 $\pm$ 0.0583 | 0.4578 $\pm$ 0.0471 |
| | Brier Score (Fold Mean $\pm$ SD) | 0.2504 $\pm$ 0.0076 | 0.2505 $\pm$ 0.0041 |
| **Pooled Out-of-Fold**<br>($N=640$ Training Cohort) | **Overall OOF ROC-AUC** | **0.5363** | **0.5055** |
| | Overall OOF PR-AUC | 0.4764 | 0.4390 |
| | Overall OOF Accuracy | 0.5406 | 0.5094 |
| | Overall OOF Balanced Accuracy | 0.5343 | 0.5058 |
| | Overall OOF F1-Score | 0.4806 | 0.4590 |
| **Holdout Test Evaluation**<br>($N=160$ Untouched Cohort) | **ROC-AUC (Point Estimate)** | **0.5767** | **0.6041** |
| | **95% Bootstrap CI [ROC-AUC]** | **[0.4832, 0.6600]** | **[0.5100, 0.6845]** |
| | PR-AUC (Point Estimate) | 0.4804 | 0.5073 |
| | 95% Bootstrap CI [PR-AUC] | [0.3807, 0.5898] | [0.3957, 0.6279] |
| | Accuracy | 0.5875 ($94 / 160$) | 0.5750 ($92 / 160$) |
| | Balanced Accuracy | 0.5825 | 0.5635 |
| | 95% Bootstrap CI [Balanced Acc] | [0.5048, 0.6587] | [0.4881, 0.6389] |
| | Sensitivity (Recall) | 0.5429 ($38 / 70$) | 0.4714 ($33 / 70$) |
| | Specificity | 0.6222 ($56 / 90$) | 0.6556 ($59 / 90$) |
| | Precision | 0.5278 ($38 / 72$) | 0.5156 ($33 / 64$) |
| | **F1-Score (Point Estimate)** | **0.5352** | **0.4925** |
| | 95% Bootstrap CI [F1-Score] | [0.4286, 0.6329] | [0.3667, 0.6027] |
| | Brier Score | 0.2472 | 0.2442 |

#### Audio Holdout Confusion Matrices ($N=160$):
- **Logistic Regression:**
  ```
                         Actual Non-Depressed (0)    Actual Depressed (1)
  Predicted Negative (0):           56 (TN)                     32 (FN)
  Predicted Positive (1):           34 (FP)                     38 (TP)
  ```
- **Random Forest:**
  ```
                         Actual Non-Depressed (0)    Actual Depressed (1)
  Predicted Negative (0):           59 (TN)                     37 (FN)
  Predicted Positive (1):           31 (FP)                     33 (TP)
  ```

---

### 4.2 Text Modality Performance Table

| Evaluation Stage | Metric | TF-IDF + Logistic Regression Baseline |
| :--- | :--- | :--- |
| **5-Fold Cross-Validation**<br>($N=640$ Training Cohort) | **ROC-AUC (Fold Mean $\pm$ SD)** | **0.6402 $\pm$ 0.0219** (Range: $[0.6120, 0.6720]$) |
| | PR-AUC (Fold Mean $\pm$ SD) | 0.5617 $\pm$ 0.0354 |
| | Accuracy (Fold Mean $\pm$ SD) | 0.6062 $\pm$ 0.0270 |
| | Balanced Accuracy (Fold Mean $\pm$ SD) | 0.6033 $\pm$ 0.0280 |
| | Sensitivity (Recall) (Fold Mean $\pm$ SD) | 0.5765 $\pm$ 0.0469 |
| | Specificity (Fold Mean $\pm$ SD) | 0.6300 $\pm$ 0.0543 |
| | Precision (Fold Mean $\pm$ SD) | 0.5501 $\pm$ 0.0306 |
| | F1-Score (Fold Mean $\pm$ SD) | 0.5619 $\pm$ 0.0321 |
| | Brier Score (Fold Mean $\pm$ SD) | 0.2356 $\pm$ 0.0079 |
| **Pooled Out-of-Fold**<br>($N=640$ Training Cohort) | **Overall OOF ROC-AUC** | **0.6385** |
| | Overall OOF PR-AUC | 0.5583 |
| | Overall OOF Accuracy | 0.6062 |
| | Overall OOF Balanced Accuracy | 0.6033 |
| | Overall OOF F1-Score | 0.5625 |
| **Holdout Test Evaluation**<br>($N=160$ Untouched Cohort) | **ROC-AUC (Point Estimate)** | **0.6760** |
| | **95% Bootstrap CI [ROC-AUC]** | **[0.5870, 0.7572]** |
| | PR-AUC (Point Estimate) | 0.6233 |
| | 95% Bootstrap CI [PR-AUC] | [0.5057, 0.7410] |
| | Accuracy | 0.6250 ($100 / 160$) |
| | Balanced Accuracy | 0.6254 |
| | 95% Bootstrap CI [Balanced Acc] | [0.5484, 0.7048] |
| | Sensitivity (Recall) | 0.6286 ($44 / 70$) |
| | Specificity | 0.6222 ($56 / 90$) |
| | Precision | 0.5641 ($44 / 78$) |
| | **F1-Score (Point Estimate)** | **0.5946** |
| | 95% Bootstrap CI [F1-Score] | [0.4901, 0.6883] |
| | Brier Score | 0.2295 |

#### Text Holdout Confusion Matrix ($N=160$):
```
                       Actual Non-Depressed (0)    Actual Depressed (1)
Predicted Negative (0):           56 (TN)                     26 (FN)
Predicted Positive (1):           34 (FP)                     44 (TP)
```

#### Top Learned TF-IDF Features Associated with Screening Risk:
- **Elevated Risk Indicators (Positive Coefficients):**
  1. `support`: $+0.6589$
  2. `struggling`: $+0.5947$
  3. `restless`: $+0.5768$
  4. `overwhelmed`: $+0.5284$
  5. `sleep`: $+0.4871$
- **Low Risk Indicators (Negative Coefficients):**
  1. `well supported`: $-0.6241$
  2. `peaceful`: $-0.5823$
  3. `rested`: $-0.5471$
  4. `routine`: $-0.5012$
  5. `managing`: $-0.4689$

---

## 5. PART D – Methodological Interpretation & Clinical Reality

A strict distinction must be drawn between simulated benchmark performance and authentic clinical efficacy:

```
+--------------------------------------------------------------------------------------------------+
| CLINICAL VALIDITY & PROVENANCE BOUNDARY                                                          |
+-------------------------------------------------+------------------------------------------------+
| SYNTHETIC BENCHMARK FINDINGS                    | CLINICAL GROUND TRUTH REALITY                  |
+-------------------------------------------------+------------------------------------------------+
| Audio 7-Feature Baseline:                       | Cohort Acoustic Reality:                       |
| Holdout ROC-AUC = 0.5767 - 0.6041.               | Zero physical recordings exist in this cohort. |
| The model performs only slightly above random   | Voice pitch, jitter, and shimmer were derived  |
| chance (0.50), demonstrating that 7 summary     | from an AR(1) Gaussian noise model. These      |
| scalars lack strong discriminative capacity.    | metrics CANNOT detect true maternal dysphonia. |
+-------------------------------------------------+------------------------------------------------+
| Text TF-IDF Baseline:                           | Cohort Linguistic Reality:                     |
| Holdout ROC-AUC = 0.6760 (F1 = 0.5946).         | Zero patient transcripts or interviews exist.  |
| The model captures moderate statistical signal  | Narratives were assembled from demographic     |
| because grammatical templates were conditioned  | templates. Vocabulary weights reflect domestic |
| on non-target survey covariates (parity/sleep). | covariates, NOT authentic patient speech.      |
+-------------------------------------------------+------------------------------------------------+
| Multimodal Late Fusion Implication:             | Production Screening Rule:                     |
| In fusion experiments, uncalibrated synthetic   | Audio and Text models must remain designated   |
| streams dilute authentic clinical accuracy      | as experimental benchmarks (is_predictive=F).  |
| (-0.0258 ROC-AUC penalty on equal weights).     | Live screening relies 100% on Clinical RF.     |
+-------------------------------------------------+------------------------------------------------+
```

---

## 6. PART E – Serialized Artifact Inventory

All training outputs were serialized in their designated model directories and mirrored into experimental tracking folders:

### 6.1 Audio Model Artifacts
- **Primary Directory:** `models/audio_model/`
  - `logistic_regression.joblib` (2,109 bytes): Fitted Scikit-Learn Logistic Regression model.
  - `random_forest.joblib` (194,547 bytes): Fitted Scikit-Learn Random Forest model.
  - `scaler.joblib` (851 bytes): Fitted `StandardScaler` fitted on 640 training participants.
  - `oof_predictions.csv` (38,819 bytes): 640 training participant out-of-fold probability vectors.
  - `test_predictions.csv` (10,037 bytes): 160 holdout test participant prediction vectors.
  - `metrics_summary.json` (7,842 bytes): Machine-readable CV summaries, holdout metrics, and bootstrap CIs.
- **Experimental Mirror Archive:** `artifacts/audio_experiments/baseline_training/` (Complete duplicate archive).

### 6.2 Text Model Artifacts
- **Primary Directory:** `models/text_model/`
  - `text_pipeline.joblib` (42,658 bytes): End-to-end `Pipeline([('tfidf', ...), ('classifier', ...)])`.
  - `tfidf_vectorizer.joblib` (39,418 bytes): Fitted standalone vectorizer ($1,000$ features).
  - `logistic_regression.joblib` (3,312 bytes): Standalone fitted Logistic Regression classifier.
  - `oof_predictions.csv` (37,842 bytes): 640 training participant out-of-fold probability vectors.
  - `test_predictions.csv` (9,584 bytes): 160 holdout test participant prediction vectors.
  - `metrics_summary.json` (6,419 bytes): Machine-readable CV summaries, holdout metrics, and bootstrap CIs.
  - `training_report.md` (6,782 bytes): Automated markdown report with top positive/negative feature tables.
- **Experimental Mirror Archive:** `artifacts/text_experiments/baseline_training/` (Complete duplicate archive).

---

## 7. Comparative Performance Across All Trained Modalities

| Modality | Baseline Model Name | Status | CV ROC-AUC | Holdout ROC-AUC [95% CI] | Holdout F1 | Holdout Balanced Acc | Modality Provenance |
|---|---|---|---|---|---|---|---|
| **Clinical** | **Random Forest** | **Validated Production Baseline** | **0.8438 $\pm$ 0.0457** | **0.8187 [0.7518, 0.8820]** | **0.7397** | **0.7635** | **Authentic Human Clinical Cohort ($N=800$)** |
| Clinical | Logistic Regression | Secondary Comparator | 0.8381 $\pm$ 0.0487 | 0.8027 [0.7299, 0.8670] | 0.6939 | 0.7198 | Authentic Human Clinical Cohort ($N=800$) |
| Clinical | HistGradientBoosting | Secondary Comparator | 0.8297 $\pm$ 0.0477 | 0.8310 [0.7700, 0.8920] | 0.6950 | 0.7278 | Authentic Human Clinical Cohort ($N=800$) |
| **Text** | **TF-IDF + Logistic Reg.** | **Trained Benchmark Baseline** | **0.6402 $\pm$ 0.0219** | **0.6760 [0.5870, 0.7572]** | **0.5946** | **0.6254** | **Synthetic Fictional Narratives ($N=800$)** |
| **Audio** | **Random Forest** | **Trained Benchmark Baseline** | **0.5120 $\pm$ 0.0364** | **0.6041 [0.5100, 0.6845]** | **0.4925** | **0.5635** | **Clinically Conditioned Synthetic ($N=800$)** |
| Audio | Logistic Regression | Secondary Baseline | 0.5387 $\pm$ 0.0435 | 0.5767 [0.4832, 0.6600] | 0.5352 | 0.5825 | Clinically Conditioned Synthetic ($N=800$) |
| **Video** | Statistical / Recurrent | Not trained in this phase | N/A | N/A | N/A | N/A | Synthetic Action Unit Trajectories V2 |

---

## 8. Recommendations for Next Phase

1. **Unblock Video Baseline Training:**
   Apply the lightweight `try...except ImportError` fallback in `pipelines/video_model/dataset.py` to enable Scikit-Learn baseline training (`train_baselines.py`) on the 220 pooled summary statistics without requiring a PyTorch installation.
2. **Four-Modality Late Fusion Benchmarking:**
   Now that Clinical, Audio, and Text all have serialized models and participant-level out-of-fold probability vectors (`oof_predictions.csv`), execute late-fusion experiments to evaluate whether constrained stacking maintains clinical fidelity while suppressing synthetic behavioral noise.
3. **Preserve Production Gating:**
   Ensure `backend/services/audio_service.py` and `backend/ml/fusion_engine.py` continue to treat Audio and Text models as research benchmarks ($is\_predictive=False$) during live patient screening.

---
*Report generated strictly from verified repository executions, split manifests, serializations, and bootstrap confidence interval calculations.*
