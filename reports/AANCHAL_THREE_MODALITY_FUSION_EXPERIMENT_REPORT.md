# AANCHAL — Stage 1 Three-Modality Behavioral Fusion Experiment Report

> [!IMPORTANT]
> **SCIENTIFIC INTEGRITY NOTICE & RESEARCH LIMITATIONS**:
> AANCHAL is an experimental postpartum depression (PPD) screening research prototype, not a diagnostic system.
> All behavioral modalities evaluated in Stage 1 (synthetic maternal narrative vignettes, synthetic vocal acoustics, and synthetic facial/motion dynamics) are computational research engineering representations. Video features act as an empirical negative control.
> Clinical numerical demographic/obstetric survey features and EPDS questionnaire items were **strictly excluded** from Stage 1. Results do not demonstrate clinical diagnostic efficacy.

---

## Executive Summary

Phase 1 (Video Baseline Optimization) and Phase 2 (Three-Modality Late Fusion) of the AANCHAL multimodal redesign have been fully implemented, validated, and evaluated.

1. **Video Baseline Optimization**: `pipelines/video_model/train_baselines.py` was optimized by implementing in-memory caching of the 220 pooled summary statistics. Instead of opening and reading 8,640 `.npy` files across the 6 model/ablation configurations, tensors are loaded once and transformed in memory. Runtime dropped from combinatorial latency to deterministic execution, producing **100% numerically identical metrics** to historical benchmarks.
2. **Strict Modality Boundary Enforcement**: The primary Stage 1 fusion space contains **ONLY** Text, Audio, and Video predictions. Clinical numerical features and EPDS questionnaire items were completely excluded.
3. **Leak-Free Late Fusion**: Meta-classifiers were trained strictly on the 640 Out-Of-Fold (OOF) cross-validation predictions. Holdout labels from the 160 frozen test participants were used exclusively for final evaluation with 1,000 bootstrap confidence intervals.
4. **Key Finding**: 
   - **Marginal Multimodal Gain Over Text Alone**: The three-modality learned stacking model achieves a holdout ROC-AUC of **0.6852** [95% CI: 0.591, 0.765] compared to **0.6762** [95% CI: 0.585, 0.754] for text alone. This marginal difference ($\Delta = +0.0090$) with heavily overlapping bootstrap confidence intervals demonstrates that multimodal fusion does not establish meaningful statistical or clinical improvement over narrative text alone on this benchmark.
   - **Synthetic Conditioning Context**: The text narrative model's performance reflects indirect conditioning on 13 clinical survey covariates (sleep disruption, domestic support, etc.), and audio reflects conditioning on 5 survey covariates. Video was generated from an AR(1) process seeded only by participant index and acts as an empirical negative control (ROC-AUC: 0.4854).
   - **Noise Dilution in Equal Weighting**: In equal-weight fusion ($1/3$ each), uninformative video signals dilute the predictive text signal (ROC-AUC drops from $0.6762$ to $0.5587$). In contrast, a learned stacking meta-classifier automatically assigns high weight to text ($\beta_{\text{text}} \approx +3.05$), moderate weight to audio ($\beta_{\text{audio}} \approx +0.47$), and suppresses video ($\beta_{\text{video}} \approx -0.02 \to 0.00$), preventing performance degradation.
   - **Output Terminology & Thresholds**: Fusion model predictions are **uncalibrated multimodal research risk scores** (not calibrated probabilities). The classification threshold of $0.50$ is an arbitrary engineering default cut-off, not a clinically calibrated threshold. Disagreement between modalities is a **cross-modal algorithmic disagreement flag**, not a diagnostic phenotype.

---

## 1. Modality Comparison & Benchmark Evaluation (Holdout Test Cohort, N=160)

| Configuration | Modalities Included | Fusion Strategy | ROC-AUC (95% CI) | PR-AUC (95% CI) | Balanced Acc. | Sensitivity (Recall) | Specificity | F1-Score | Brier Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`text_only`** | Text | Single Baseline | 0.6762 [0.585, 0.754] | 0.6234 [0.533, 0.724] | 0.6254 | 0.6286 | 0.6222 | 0.5946 | 0.2295 |
| **`audio_only`** | Audio | Single Baseline | 0.5767 [0.483, 0.669] | 0.4805 [0.419, 0.573] | 0.5825 | 0.5429 | 0.6222 | 0.5352 | 0.2472 |
| **`video_only`** | Video | Single Baseline | 0.4854 [0.396, 0.574] | 0.4297 [0.378, 0.525] | 0.4992 | 0.4429 | 0.5556 | 0.4397 | 0.3129 |
| **`text_audio_equal`** | Text + Audio | Equal Weight ($0.50 / 0.50$) | 0.6799 [0.585, 0.761] | 0.6382 [0.536, 0.735] | 0.6341 | 0.6571 | 0.6111 | 0.6093 | 0.2355 |
| **`text_video_equal`** | Text + Video | Equal Weight ($0.50 / 0.50$) | 0.5489 [0.460, 0.634] | 0.4767 [0.411, 0.569] | 0.5413 | 0.4714 | 0.6111 | 0.4783 | 0.2536 |
| **`audio_video_equal`**| Audio + Video | Equal Weight ($0.50 / 0.50$) | 0.5007 [0.409, 0.590] | 0.4380 [0.385, 0.536] | 0.4881 | 0.4429 | 0.5333 | 0.4336 | 0.2632 |
| **`three_modality_equal`**| Text+Audio+Video | Equal Weight ($0.33 / 0.33 / 0.33$) | 0.5587 [0.467, 0.644] | 0.4847 [0.413, 0.579] | 0.5413 | 0.4714 | 0.6111 | 0.4783 | 0.2466 |
| **`text_audio_learned`** | Text + Audio | Learned Stacking | 0.6822 [0.589, 0.763] | 0.6388 [0.547, 0.735] | 0.6270 | 0.6429 | 0.6111 | 0.6000 | 0.2327 |
| **`text_video_learned`** | Text + Video | Learned Stacking | 0.6765 [0.585, 0.755] | 0.6247 [0.533, 0.726] | 0.6397 | 0.6571 | 0.6222 | 0.6133 | 0.2332 |
| **`audio_video_learned`**| Audio + Video | Learned Stacking | 0.5756 [0.482, 0.668] | 0.4770 [0.417, 0.571] | 0.5913 | 0.5714 | 0.6111 | 0.5517 | 0.2492 |
| **`three_modality_learned`**| Text+Audio+Video | Learned Stacking | **0.6852** [0.591, 0.765] | **0.6431** [0.552, 0.738] | 0.6214 | 0.6429 | 0.6000 | 0.5960 | **0.2328** |

---

## 2. Confusion Matrices (Holdout Test Cohort, N=160)

| Configuration | True Positive (TP) | False Positive (FP) | False Negative (FN) | True Negative (TN) | Accuracy | Correct / Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `text_only` | 44 | 34 | 26 | 56 | 62.50% | 100 / 160 |
| `audio_only` | 38 | 34 | 32 | 56 | 58.75% | 94 / 160 |
| `video_only` | 31 | 40 | 39 | 50 | 50.62% | 81 / 160 |
| `text_audio_equal` | 46 | 35 | 24 | 55 | 63.12% | 101 / 160 |
| `text_video_equal` | 33 | 35 | 37 | 55 | 55.00% | 88 / 160 |
| `audio_video_equal` | 31 | 42 | 39 | 48 | 49.38% | 79 / 160 |
| `three_modality_equal` | 33 | 35 | 37 | 55 | 55.00% | 88 / 160 |
| `text_audio_learned` | 45 | 35 | 25 | 55 | 62.50% | 100 / 160 |
| `text_video_learned` | 46 | 34 | 24 | 56 | 63.75% | 102 / 160 |
| `audio_video_learned` | 40 | 35 | 30 | 55 | 59.38% | 95 / 160 |
| `three_modality_learned` | 45 | 36 | 25 | 54 | 61.88% | 99 / 160 |

---

## 3. Learned Stacking Weights & Interpretation

The meta-classifier was trained with an L2 regularized Logistic Regression ($C=1.0$, balanced) on the 640 Out-Of-Fold predictions:

$$\text{logit}(P_{\text{fused}}) = \beta_0 + \beta_{\text{text}} p_{\text{text}} + \beta_{\text{audio}} p_{\text{audio}} + \beta_{\text{video}} p_{\text{video}}$$

### Estimated Coefficients:
- $\beta_0\text{ (Intercept)} = -1.7393$
- $\beta_{\text{text}} = \mathbf{+3.0511}$ (Strong positive weight reflecting genuine text narrative discrimination)
- $\beta_{\text{audio}} = \mathbf{+0.4718}$ (Moderate positive weight capturing acoustic prosodic indicators)
- $\beta_{\text{video}} = \mathbf{-0.0238} \approx 0.00$ (Effectively zero weight, safely suppressing the negative-control video noise)

**Core Scientific Takeaway**: The meta-classifier learned without supervision of the test set that synthetic video features offer zero predictive information, successfully filtering out noise that severely degrades the Equal-Weight model.

---

## 4. Reliability, Cross-Modal Discordance & Missing Modality Fallback

### A. Cross-Modal Disagreement
- **Discordance Definition**: Maximum absolute discrepancy between modal probabilities: $\Delta_{\max} = \max_{i, j} |p_i - p_j| \ge 0.25$.
- **Observed Discordance Rate**: **51.9%** (83 of 160 holdout test mothers exhibited significant inter-modality disagreement).
- **Mean Cross-Modal Spread**: $0.2651$ across all three channels.
- **Uncertainty Impact**:
  - **Concordant Mothers (N=77)**: Balanced Accuracy = **0.6098**, F1 = **0.5714**, Brier Score = **0.2370**.
  - **Discordant Mothers (N=83)**: Balanced Accuracy = **0.4800**, F1 = **0.3824**, Brier Score = **0.2556**.
  - *Methodological Implication*: Algorithmic disagreement indicates that independent modality models produced diverging risk estimates, providing an engineering flag of predictive uncertainty. It does NOT represent a clinical diagnosis or patient behavioral phenomenon.

### B. Missing Modality Dynamic Reweighting
When any modality is unavailable due to quality rejection (e.g. poor lighting, background noise, short narrative):
1. **Video Missing (Text + Audio available)**: ROC-AUC = **0.6822**, Balanced Acc = **0.6270**, F1 = **0.6000**. No performance loss compared to the full model.
2. **Audio Missing (Text + Video available)**: ROC-AUC = **0.6765**, Balanced Acc = **0.6397**, F1 = **0.6133**. Robust due to text signal dominance.
3. **Text Missing (Audio + Video available)**: ROC-AUC = **0.5756**, Balanced Acc = **0.5913**, F1 = **0.5517**. Demonstrates that text narrative is the primary anchor of the behavioral model.

---

## 5. EPDS Second-Stage Integration Architecture (Future Milestone)

```
========================================================================================
STAGE 1: THREE-MODALITY BEHAVIORAL MODEL (COMPLETED)
Inputs: [Maternal Narrative Text] + [Speech Audio] + [Facial Dynamics Video]
Output: Uncalibrated multimodal research risk score P_fused in [0.0, 1.0] 
        + Cross-modal algorithmic disagreement flag
========================================================================================
                                      |
                                      v
========================================================================================
STAGE 2: CLINICIAN-FACING COMBINED TRIAGE INFORMATION (FUTURE MILESTONE)
Inputs: P_fused (Stage 1) + 10-Item EPDS Questionnaire Responses (Self-Reported Survey)
========================================================================================
   |
   +---> [CRITICAL SAFETY ESCALATION]: EPDS Q10 (Self-Harm / Suicidal Ideation) > 0
   |     Triggers immediate clinical safety alert and crisis handoff, bypassing all ML.
   |
   +---> [TWO-AXIS CLINICAL TRIAGE MATRIX (RESEARCH HEURISTIC)]:
         - High Behavioral Risk (P_fused >= 0.50) + High EPDS (>= 13):
           Concordant High Risk -> Priority Clinical Evaluation.
         - Discordant Risk (Discrepancy between P_fused and EPDS):
           Algorithmic Disagreement -> Clinician-Guided Multi-Source Investigation.
         - Low Behavioral Risk (P_fused < 0.50) + Low EPDS (< 13):
           Concordant Low Risk Baseline -> Routine Postnatal Care.
```

### Clarification on Target Leakage Prevention
The primary target in the AANCHAL repository is:
$$\text{target\_canonical\_epds\_ge\_13} = \mathbb{I}(\text{EPDS Total Score} \ge 13)$$
Using individual EPDS items or the EPDS total score as predictors against this target creates **circular target leakage**. 
Therefore, Stage 2 does not use EPDS items as statistical inputs to predict `target_canonical_epds_ge_13`. If a second-stage machine learning model is developed in future work, an **independently established clinical outcome** (e.g. DSM-5 Structured Clinical Interview for Depression [SCID-5] by a licensed psychiatrist) is strictly required as the ground truth.

---

## 6. Verification & Test Suite Summary

- `tests/test_video_model_baselines.py`: **8/8 PASSED** (39.47s). Verified fold separation, zero preprocessing leakage, OOF coverage, holdout isolation, reproducibility, ablation dimensions, bootstrap CIs, and artifact integrity.
- `tests/test_three_modality_fusion.py`: **4/4 PASSED** (32.01s). Verified metric computation, Brier score, sensitivity, specificity, 640/160 partition bounds, strict exclusion of clinical/EPDS keywords, and full execution into temporary directories.
- `pipelines/three_modality_fusion/train_three_modality_fusion.py`: **COMPLETED** (1000 bootstrap iterations). All prediction CSVs, models, and JSON summaries persisted.

---

## 7. Inventory of Modified & Created Files

### Modified Existing Files
1. `pipelines/video_model/train_baselines.py`: Added in-memory tensor caching to extract the 220 pooled summary statistics once, slicing subsets directly in memory across configurations.
2. `pipelines/video_model/dataset.py`: Implemented conditional PyTorch fallback class so baseline Scikit-Learn pipelines load without PyTorch.
3. `pipelines/video_model/preprocessing.py`: Added optional PyTorch guards in `VideoFeatureNormalizer`, `pad_collate_fn`, and `masked_temporal_pooling`.
4. `pipelines/video_model/models/__init__.py`: Wrapped PyTorch deep model imports in conditional guards.
5. `pipelines/video_model/models/statistical_baseline.py`: Added conditional PyTorch guards in `extract_single`.
6. `tests/test_video_model_baselines.py`: Replaced unconditional `pytest.importorskip("torch")` with optional import to enable baseline test execution without PyTorch.

### Newly Created Files
1. `pipelines/three_modality_fusion/__init__.py`: Package initialization for the three-modality fusion pipeline.
2. `pipelines/three_modality_fusion/train_three_modality_fusion.py`: Primary Stage 1 late fusion training script supporting equal-weight, learned stacking, reliability, discordance, and missing modality evaluation.
3. `tests/test_three_modality_fusion.py`: Dedicated unit and integration test suite for Stage 1 three-modality fusion.
4. `artifacts/three_modality_fusion/oof_fusion_predictions.csv`: 640 Out-Of-Fold predictions across all 11 model configurations.
5. `artifacts/three_modality_fusion/holdout_fusion_predictions.csv`: 160 frozen holdout test predictions.
6. `artifacts/three_modality_fusion/fusion_metrics_summary.json`: Complete JSON summary of all metrics, confusion matrices, weights, and bootstrap CIs.
7. `artifacts/three_modality_fusion/three_modality_fusion_report.md`: Markdown summary of fusion results.
8. `artifacts/three_modality_fusion/meta_classifier_*.joblib`: Serialized meta-classifier models for each modality combination.
9. `reports/AANCHAL_THREE_MODALITY_ARCHITECTURE_AUDIT.md`: Pre-implementation architectural audit report.
10. `reports/AANCHAL_THREE_MODALITY_FUSION_EXPERIMENT_REPORT.md`: Final experiment and benchmark report.

---
*Report generated for AANCHAL Research Prototype Multimodal Redesign.*
