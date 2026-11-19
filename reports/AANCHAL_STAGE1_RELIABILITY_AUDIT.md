# AANCHAL — Stage 1 Post-Fusion Reliability & Methodology Audit

> [!IMPORTANT]
> **RESEARCH PROTOTYPE NOTICE & SCIENTIFIC INTEGRITY**:
> AANCHAL is an experimental multimodal screening research prototype for Postpartum Depression (PPD), not a diagnostic device.
> All behavioral modalities evaluated in Stage 1 (synthetic maternal narrative vignettes, synthetic speech acoustics, and synthetic facial/motion dynamics) are computational engineering fixtures.
> This read-only audit critically examines synthetic dataset provenance, potential label leakage, evaluation mechanics, video negative-control dynamics, probability calibration, and metric interpretations.

---

## Executive Summary

Following the implementation of the three-modality behavioral fusion pipeline (`pipelines/three_modality_fusion/train_three_modality_fusion.py`), a comprehensive read-only audit was conducted across the data generators, training workflows, evaluation metrics, and reporting terminology.

### Key Audit Findings:
1. **Evaluation Mechanics Are Genuinely Leak-Free**: Out-of-fold cross-validation predictions for all 640 training participants were produced with strict fold isolation. Zero holdout participants (160 test participants) were exposed during base model fitting, meta-classifier training, or feature selection.
2. **Indirect Covariate Conditioning in Text and Audio**: While explicit EPDS items and target labels were strictly excluded from generation, both the text and audio generators used non-target clinical survey variables (sleep disruption, social support, feelings about motherhood) that correlate with EPDS depression. The observed predictive power of Text (ROC-AUC ~0.676) and Audio (ROC-AUC ~0.577) largely reflects these underlying survey correlations rather than naturalistic behavioral biomarkers.
3. **Video Modality Operates as a Pure Negative Control**: The video generator was derived solely from an autoregressive AR(1) process seeded by participant index with zero survey covariate conditioning. Statistical tests on all 220 video features confirmed zero class separation ($p < 0.05$ in only 1 of 220 features, below chance expectation). The video baseline ROC-AUC of 0.4854 and near-zero meta-classifier weight ($\beta_{\text{video}} \approx -0.0238$) mathematically confirm its role as an authentic negative control.
4. **Calibration Terminology Requires Correction**: The fusion model output was described as "calibrated", but no empirical calibration method (e.g. Platt scaling or isotonic regression) was applied. In fact, `class_weight="balanced"` shifted intercept parameters away from true empirical prevalence.
5. **Discordance Must Not Be Clinically Over-Interpreted**: Disagreement between modal probabilities ($\Delta_{\max} \ge 0.25$) is an engineering metric of algorithmic divergence. Attributing discrepancies to human psychological concepts like "concealment" or "somatic depression" is scientifically ungrounded for synthetic data.

---

## 1. Synthetic Dataset Provenance and Label Leakage

All three synthetic generators were inspected in detail to determine the exact mathematical process used to synthesize samples.

```
+----------------------------------------------------------------------------------------------------+
|                                    SYNTHETIC DATASET PROVENANCE                                    |
|                                                                                                    |
|  [Clinical Modeling Matrix]                                                                        |
|  (46 Tabular Survey Features)                                                                      |
|           |                                                                                        |
|           +---> 13 Non-Target Survey Covariates ---> [Text Generator]  ---> Template Narratives    |
|           |     (Sleep, Support, Infant, Parity)     (Vignettes)            (ROC-AUC: 0.6762)      |
|           |                                                                                        |
|           +---> 5 Non-Target Survey Covariates  ---> [Audio Generator] ---> Shifted Acoustics      |
|           |     (Age, Sleep, Support, Motherhood)    (Linear Mean Shift)    (ROC-AUC: 0.5767)      |
|           |                                                                                        |
|           X--- NO CLINICAL COVARIATES ACCESSED ----> [Video Generator] ---> Pure Synthetic Noise   |
|                 (Zero Conditioning, RNG Seed Only)   (AR(1) Kinematics)     (ROC-AUC: 0.4854)      |
+----------------------------------------------------------------------------------------------------+
```

### Detailed Generator Analysis

| Modality | Generator Script | Input Data Accessed | Conditioning Mechanism | Direct Target Leakage? | Indirect Covariate Leakage? |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Text** | `pipelines/synthetic_text/generator.py` | 13 survey columns from `ppd_modeling_matrix.csv` | Template sentence selection based on survey categories (`Need for Support`, `Relax/sleep when asleep`, etc.) | **NO** (EPDS & targets prohibited) | **YES** (Survey covariates correlate with depression) |
| **Audio** | `pipelines/synthetic_audio/generator.py` | 5 survey columns from `ppd_modeling_matrix.csv` | Linear conditional mean shift: $\mu_i = \mu_0 + x_i W$ (`motherhood_feeling`, `sleep_disruption`, etc.) | **NO** (EPDS & targets prohibited) | **YES** (Shift weights reflect survey correlations) |
| **Video** | `pipelines/synthetic_video/generator_v2.py` | `participant_sr` (integer index 1..800) and random seed | Pure AR(1) autoregressive motion simulation with AU covariance; zero clinical data accessed | **NO** (Zero target access) | **NO** (Zero covariate access; pure negative control) |

### Potential Sources of Circularity and Leakage
1. **Template-Covariate Binding (Text)**: Because template paragraphs were selected based on whether a mother reported sleep difficulties or low support in the clinical survey, the TF-IDF model simply learns to identify phrases like `"struggles to rest"` or `"elevated domestic support needs"`. The text model is essentially a linguistic translation of the tabular survey data.
2. **Acoustic Covariate Shift (Audio)**: Shifting acoustic feature distributions using survey variables (`happy/neutral/sad` motherhood feelings, sleep disruption) causes higher jitter and lower speaking rate in mothers with higher survey risk. The acoustic model is therefore predicting survey-induced shifts rather than organic acoustic biomarkers.
3. **Absence of Leakage in Video**: The video pipeline confirms that when clinical covariates are completely omitted, machine-learning models achieve chance-level performance (ROC-AUC ~0.49). This proves that the feature extraction pipeline does not artificially fabricate predictive signal where none exists.

---

## 2. Fusion Evaluation Integrity

An end-to-end trace of data partitions, cross-validation folds, and evaluation code was conducted:

| Audit Check | Status | Verification Evidence |
| :--- | :---: | :--- |
| **Participant Separation** | **PASS** | Split manifest strictly partitions 640 train (`BGD_001`..`BGD_640`) and 160 holdout test (`BGD_641`..`BGD_800`). Zero overlap: $\text{Train} \cap \text{Test} = \emptyset$. |
| **Genuinely Out-Of-Fold Base Predictions** | **PASS** | Text, Audio, and Video OOF files were generated via 5-Fold Stratified CV. Each training participant was evaluated strictly when in the validation fold of an estimator trained on the other 4 folds (512 participants). |
| **Holdout Label Isolation** | **PASS** | Test labels were never accessed during base model fitting, meta-classifier training, feature selection, or probability thresholding. |
| **Identical Test Cohort Across Comparisons** | **PASS** | All 11 model configurations in `train_three_modality_fusion.py` evaluated the exact same 160 participants in identical row order. |
| **Bootstrap Confidence Intervals** | **PASS** | Non-parametric stratified bootstrap resampling (1,000 iterations) separates positive and negative samples, preserving class prevalence in each resample. Percentile intervals computed at 2.5% and 97.5%. |

---

## 3. Video Modality Investigation

The video-only baseline achieved a holdout ROC-AUC of **0.4854** [95% CI: 0.396–0.574] and PR-AUC of **0.4297** (prevalence = 43.75%), with a meta-classifier weight of $\beta_{\text{video}} \approx -0.0238$.

### Statistical Examination of 220 Video Features ($N=640$ Training Cohort)
To determine why the video model showed near-chance performance, two-sample Welch's t-tests were conducted between Class 0 and Class 1 across all 220 extracted statistical summary features:

- **Features with $p < 0.05$**: **1 / 220 (0.45%)**
- **Features with $p < 0.01$**: **0 / 220 (0.00%)**
- **Theoretical Expected by Chance ($\alpha=0.05$)**: **11.0 features**
- **Theoretical Expected by Chance ($\alpha=0.01$)**: **2.2 features**
- **Feature Variance**: Mean variance = $3.934$ (ranging from $0.000$ to $461.66$ for sequence length and movement energy).

### Findings on Video Modality:
1. **Meaningful Internal Variation**: Video features are not degenerate or constant. They exhibit realistic temporal dynamics, autoregressive persistence, and physiological covariance (AU synergies, head pose coupling, and gaze stability).
2. **Zero Class Separation**: The number of features showing statistically significant differences between depressed and non-depressed participants (1 of 220) is lower than what would occur purely by random chance.
3. **Pipeline Correctness**: The feature extraction logic (temporal pooling, quantile extraction, masked tracking filtering) executes correctly without numerical errors or NaNs.
4. **Authentic Negative Control**: Because the synthetic video generator accessed zero clinical covariates or target variables, it behaves as an empirical negative control. The meta-classifier correctly assigned it a near-zero coefficient ($\beta \approx -0.02$), validating that the stacking model suppresses uninformative modalities.

---

## 4. Calibration and Threshold Audit

### Audit of Probability Outputs
The previous report referred to the multimodal fusion output as "calibrated". The audit evaluated the mathematical formulation used in `train_three_modality_fusion.py`:

1. **Equal-Weight Fusion**:
   $$P_{\text{equal}} = \frac{p_{\text{text}} + p_{\text{audio}} + p_{\text{video}}}{3}$$
   The arithmetic mean of three uncalibrated probabilities is not a calibrated posterior probability.
2. **Learned Stacking Fusion**:
   $$P_{\text{learned}} = \sigma\left(\beta_0 + \beta_{\text{text}} p_{\text{text}} + \beta_{\text{audio}} p_{\text{audio}} + \beta_{\text{video}} p_{\text{video}}\right)$$
   While standard logistic regression produces outputs in $(0, 1)$, **no post-hoc calibration method (such as Platt scaling, isotonic regression, or temperature scaling) was fitted**.
3. **Impact of `class_weight="balanced"`**:
   The meta-classifier was fitted with `class_weight="balanced"`. In Scikit-learn, balanced weighting scales sample losses inversely proportional to class frequencies:
   $$w_k = \frac{N}{2 N_k}$$
   This explicitly alters the intercept $\beta_0$, shifting predicted probabilities toward an artificial $50/50$ prior rather than reflecting the cohort's true empirical prevalence ($43.9\%$). Therefore, the probabilities are **uncalibrated risk scores**, not true posterior probabilities.
4. **Audit of 0.50 Threshold**:
   $0.50$ was used as an arbitrary default decision threshold. In clinical depression screening:
   - False negatives (missing a mother with severe PPD) carry higher clinical risk than false positives.
   - Operating thresholds must be calibrated to achieve specific target sensitivity (e.g. $\ge 80\%$ or $\ge 85\%$) based on clinical referral capacity.
   - **0.50 is NOT a clinically validated threshold**.

---

## 5. Discordance Interpretation Audit

In previous summaries, cross-modal disagreement ($\Delta_{\max} \ge 0.25$) was described using clinical terminology such as:
- *"Somatic depression phenotype"*
- *"Concealment phenotype"*
- *"Behavioral dissonance between self-report and facial affect"*

### Reliability Audit Ruling:
> [!CAUTION]
> **REMOVAL OF UNSUPPORTED CLINICAL CLAIMS**:
> All clinical diagnostic interpretations of discordance are **unsupported and scientifically invalid** in this context:
> 1. The datasets are synthetic engineering fixtures. A computer-generated text template or acoustic tensor cannot exhibit "concealment" or "somatic depressive phenotypes".
> 2. The video modality is random noise. Any discordance involving video is driven primarily by stochastic simulation artifacts, not patient psychology.
> 3. Numerical discordance ($\Delta_{\max}$) must be defined strictly as **algorithmic disagreement between independent model predictions**.
> 4. In research documentation and user interfaces, discordance must be presented as an **algorithmic uncertainty indicator** or **model divergence flag**, never as a patient diagnosis or psychological profiling.

---

## 6. Summary of Confirmed vs. Failed Checks

```
========================================================================================
CHECKLIST ITEM                                           STATUS   SEVERITY / FINDING
========================================================================================
1. Participant ID alignment across all manifests         PASS     100% matched (800 / 800)
2. Train / Holdout test partition isolation               PASS     Zero overlap (640 / 160)
3. Zero holdout leakage in OOF predictions                PASS     Genuinely out-of-fold
4. Exclusion of clinical survey & EPDS in Stage 1        PASS     Strictly behavioral only
5. Identical holdout test cohort across all models       PASS     Exact 160 test mothers
6. Stratified bootstrap CI computation                   PASS     1,000 iterations, 95% CIs
7. Video feature extraction implementation               PASS     Numerically correct
8. Video model negative-control validation               PASS     Near-chance (ROC: 0.4854)
9. Probability calibration of fusion model               FAIL     Uncalibrated (balanced prior)
10. Clinical validation of 0.50 threshold                FAIL     Arbitrary default threshold
11. Discordance clinical phenotyping claims              FAIL     Unjustified clinical claims
12. Independence of synthetic text/audio from survey     FAIL     Indirect covariate leakage
========================================================================================
```

---

## 7. Recommended Next Steps

1. **Update Report & Schema Terminology**:
   - Replace the term "calibrated probability" with **"uncalibrated multimodal risk score"**.
   - Replace "somatic concealment phenotype" with **"cross-modal algorithmic disagreement flag"**.
2. **Implement Post-Hoc Probability Calibration**:
   - Fit isotonic regression or Platt scaling on the 640 Out-Of-Fold predictions **without** `class_weight="balanced"` to generate true empirical posterior probabilities.
   - Plot calibration reliability diagrams (Brier score, expected calibration error).
3. **Conduct Sensitivity-Targeted Threshold Analysis**:
   - Rather than relying on an arbitrary $0.50$ threshold, calculate operating points at fixed clinical sensitivities:
     - High-Sensitivity Screening Threshold (Target: $\ge 85\%$ Sensitivity)
     - Balanced Operating Threshold (Youden's $J = \text{Sensitivity} + \text{Specificity} - 1$)
     - High-Specificity Referral Threshold (Target: $\ge 85\%$ Specificity)
4. **Document Synthetic Data Constraints in UI & API Contracts**:
   - Ensure backend API schemas (`FusionModalityResult`) report `model_discordance_detected` as an algorithmic variance metric, accompanied by clear research prototype disclaimers.

---
*Audit completed under strict read-only research protocol.*
