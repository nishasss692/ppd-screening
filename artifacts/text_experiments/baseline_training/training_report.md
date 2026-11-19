# Supervised Text-Based PPD Classification Baseline Report

## 1. Executive Summary & Scientific Provenance
- **Modality:** Text (Synthetic Maternal Narratives)
- **Architecture:** `TfidfVectorizer` (1–2 grams, max 1000 features, sublinear TF) + `LogisticRegression` ($L_2$, $C=0.5$, balanced)
- **Target Label:** `target_canonical_epds_ge_13` (Binary: 1 = EPDS $\ge 13$ High Risk, 0 = Low Risk)
- **Cohort:** 800 participants (640 Train / 160 Untouched Holdout Test)
- **Date Trained (UTC):** `2026-11-19T12:33:58.937932+00:00`
- **Random Seed:** `42`

> [!IMPORTANT]
> **Scientific Integrity & Modality Disclaimer:**
> The original clinical survey in Bangladesh collected structured numerical/categorical data, but **did not record authentic patient interview transcripts, audio files, or clinical intake notes**.
> The narrative text inputs in `data/synthetic/text/narratives/` are **fictional contextual vignettes** conditioned on 13 non-target demographic and domestic survey covariates.
> The binary classification target is **authentic clinical ground truth** derived from the administered 10-item EPDS instruments.
> This model learns statistical associations between the simulated maternal domestic context and clinical screening risk. It does **not** reflect authentic patient vocabulary or clinical language patterns and does not constitute a clinically validated diagnostic device.

---

## 2. 5-Fold Cross-Validation Performance ($N=640$ Training Cohort)

Vectorization was fit strictly inside each fold to ensure zero feature leakage across partitions.

| Metric | Fold Mean $\pm$ SD | Overall Out-of-Fold ($N=640$) |
| :--- | :--- | :--- |
| **ROC-AUC** | **0.6402 $\pm$ 0.0219** | **0.6386** |
| **PR-AUC** | 0.5735 $\pm$ 0.0371 | 0.5600 |
| **Balanced Accuracy** | 0.5983 $\pm$ 0.0249 | 0.5985 |
| **Accuracy** | 0.6016 $\pm$ 0.0257 | 0.6016 |
| **Sensitivity (Recall)** | 0.5728 $\pm$ 0.0449 | 0.5730 |
| **Specificity** | 0.6239 $\pm$ 0.0477 | 0.6240 |
| **Precision** | 0.5449 $\pm$ 0.0276 | 0.5439 |
| **F1 Score** | 0.5575 $\pm$ 0.0294 | 0.5581 |
| **Brier Score** | 0.2361 $\pm$ 0.0037 | 0.2361 |

### Out-of-Fold Confusion Matrix ($N=640$)
- **True Negatives (TN):** 224
- **False Positives (FP):** 135
- **False Negatives (FN):** 120
- **True Positives (TP):** 161

---

## 3. Single-Shot Holdout Test Performance ($N=160$ Untouched Cohort)

Evaluated exactly once on the untouched holdout test partition (90 Negative, 70 Positive).

| Metric | Point Estimate | 95% Bootstrap Confidence Interval |
| :--- | :--- | :--- |
| **ROC-AUC** | **0.6760** | **[0.5870, 0.7572]** |
| **PR-AUC** | **0.6233** | [0.5120, 0.7431] |
| **Balanced Accuracy** | **0.6254** | [0.5454, 0.6998] |
| **Accuracy** | 0.6250 | - |
| **Sensitivity** | 0.6286 (44/70) | - |
| **Specificity** | 0.6222 (56/90) | - |
| **Precision** | 0.5641 | - |
| **F1 Score** | **0.5946** | [0.4933, 0.6839] |
| **Brier Score** | 0.2295 | - |

### Holdout Confusion Matrix ($N=160$)
| | Predicted Negative (0) | Predicted Positive (1) |
| :--- | :--- | :--- |
| **Actual Negative (0)** | **56** (TN) | 34 (FP) |
| **Actual Positive (1)** | 26 (FN) | **44** (TP) |

### Detailed Classification Report (Holdout Test)
```
               precision    recall  f1-score   support

 Low Risk (0)     0.6829    0.6222    0.6512        90
High Risk (1)     0.5641    0.6286    0.5946        70

     accuracy                         0.6250       160
    macro avg     0.6235    0.6254    0.6229       160
 weighted avg     0.6309    0.6250    0.6264       160

```

---

## 4. Top Learned TF-IDF Vocabulary Features

### Indicators Associated with Elevated PPD Risk (Positive Coefficients)
| Feature (N-Gram) | Logistic Weight |
| :--- | :--- |
| `independently` | +0.4732 |
| `infrequent` | +0.4730 |
| `extended` | +0.4675 |
| `largely` | +0.4030 |
| `relaxation` | +0.3602 |
| `adequate` | +0.3502 |
| `other` | +0.3475 |
| `an extended` | +0.3320 |
| `extended joint` | +0.3320 |
| `while managing` | +0.3178 |

### Indicators Associated with Low PPD Risk (Negative Coefficients)
| Feature (N-Gram) | Logistic Weight |
| :--- | :--- |
| `daily household` | -0.5092 |
| `postpartum` | -0.4895 |
| `at` | -0.4327 |
| `young baby` | -0.3952 |
| `trusted` | -0.3831 |
| `of age` | -0.3714 |
| `substantial` | -0.3593 |
| `with trusted` | -0.3423 |
| `age the` | -0.3323 |
| `the management` | -0.3225 |

---

## 5. Artifact Manifest & Multimodal Fusion Readiness
The following production artifacts have been generated in `models/text_model/`:
- `text_pipeline.joblib`: Serialized end-to-end `Pipeline([('tfidf', ...), ('classifier', ...)])`
- `tfidf_vectorizer.joblib`: Standalone fitted vectorizer (1000 features)
- `logistic_regression.joblib`: Standalone fitted classifier
- `oof_predictions.csv`: 640 training participants $	imes$ out-of-fold probability vectors
- `test_predictions.csv`: 160 holdout test participants $	imes$ single-shot holdout prediction vectors
- `metrics_summary.json`: Machine-readable performance metrics and bootstrap CIs

**Multimodal Fusion Milestone:** With the completion of this text classification baseline, all four modalities (Clinical Numerical, Video Facial Dynamics, Audio Acoustics, and Maternal Narrative Text) now generate aligned out-of-fold probability vectors across all 800 participants for four-modality late fusion integration.
