# AANCHAL — Stage 1 Research Documentation & Methodology Review

> [!IMPORTANT]
> **RESEARCH METHODOLOGY NOTICE**:
> AANCHAL is an experimental research prototype for multimodal Postpartum Depression (PPD) screening, not a clinical diagnostic system.
> All Stage 1 behavioral modalities (synthetic maternal narratives, synthetic vocal acoustics, and synthetic facial/motion dynamics) are computational engineering fixtures.
> This document formalizes the rigorous methodological audit, terminology corrections, and validation constraints established during the Stage 1 review.

---

## Executive Summary

A comprehensive documentation and methodology correction pass was conducted across the AANCHAL Stage 1 multimodal research codebase. All unsupported clinical claims, premature assertions of probability calibration, and diagnostic phenotyping labels have been systematically retracted. 

Key outcomes of this review:
1. **Terminology Re-Alignment**: All references to model predictions have been corrected from "calibrated probability" to **"uncalibrated multimodal research risk score"**. Cross-modal divergence has been renamed from clinical "phenotypes/concealment" to **"cross-modal algorithmic disagreement flag"**.
2. **Empirical Modality Performance Context**: The three-modality learned stacking model achieves a holdout ROC-AUC of **0.6852** [95% CI: 0.591, 0.765] compared to **0.6762** [95% CI: 0.585, 0.754] for text alone. This marginal difference ($\Delta = +0.0090$) with heavily overlapping bootstrap confidence intervals **does not establish meaningful statistical or clinical improvement over narrative text alone**.
3. **Synthetic Data Provenance Disclosure**: Synthetic text and audio datasets were generated using conditioning on clinical survey covariates (sleep disruption, domestic support, motherhood feelings) that correlate with EPDS depression. Therefore, their predictive power reflects indirect survey correlations rather than naturalistic psychiatric biomarkers.
4. **Participant Index Association Analysis**: An empirical audit confirmed a weak negative correlation ($r = -0.0941, p = 0.0077$) between survey enrollment order and EPDS status in the raw cohort, but verified that the pseudo-random number generator (PRNG) thoroughly whitens the seed index. Generated video features show zero correlation with participant index beyond random chance (5.9% of features at $\alpha=0.05$), confirming video acts as an authentic, uncoupled negative control.

---

## 1. Files Reviewed

The following files across the repository were audited for unsupported clinical claims, terminology inaccuracies, and methodological validity:

| File Path | Description | Audit Status |
| :--- | :--- | :---: |
| `reports/AANCHAL_THREE_MODALITY_FUSION_EXPERIMENT_REPORT.md` | Primary Stage 1 multimodal benchmark report | **Corrected** |
| `reports/AANCHAL_THREE_MODALITY_ARCHITECTURE_AUDIT.md` | Pre-implementation architecture audit report | **Corrected** |
| `artifacts/three_modality_fusion/three_modality_fusion_report.md` | Generated markdown experiment summary | **Corrected** |
| `pipelines/three_modality_fusion/train_three_modality_fusion.py` | Fusion training and report-generation engine | **Corrected** |
| `reports/AANCHAL_STAGE1_RELIABILITY_AUDIT.md` | Prior post-fusion reliability audit | **Reviewed** |
| `pipelines/synthetic_text/generator.py` | Synthetic maternal narrative text generator | **Audited (Read-Only)** |
| `pipelines/synthetic_audio/generator.py` | Synthetic speech acoustic feature generator | **Audited (Read-Only)** |
| `pipelines/synthetic_video/generator_v2.py` | Synthetic video feature trajectory generator | **Audited (Read-Only)** |
| `data/processed/Numerical/train_test_split_manifest.csv` | Canonical split manifest (640 train / 160 test) | **Audited (Read-Only)** |

---

## 2. Terminology Corrections Made

The following rigorous substitutions were applied across all active research reports and generator documentation:

| Prior Unsubstantiated Terminology | Corrected Scientific Terminology | Methodological Rationale |
| :--- | :--- | :--- |
| **"Calibrated Probability"** | **"Uncalibrated multimodal research risk score"** | No empirical post-hoc calibration (Platt scaling or isotonic regression) was applied. In fact, `class_weight="balanced"` in the logistic meta-classifier artificially distorted intercept parameters away from true empirical cohort prevalence. |
| **"Somatic Depression / Concealment Phenotype"** | **"Cross-modal algorithmic disagreement flag"** | Differences between synthetic algorithmic outputs ($\Delta_{\max} \ge 0.25$) reflect numerical divergence between models, not human psychological concealment or clinical depressive subtypes. |
| **"High Confidence Positive"** | **"Concordant High-Risk Model Output"** | "Confidence" erroneously implied clinical certainty; concordant model output simply indicates mathematical agreement across classifiers. |
| **"Clinically Validated 0.50 Threshold"** | **"Arbitrary default engineering threshold (0.50)"** | $0.50$ is a standard symmetric binary classification cut-off. In clinical screening, operating thresholds must be calibrated to high-sensitivity clinical targets ($\ge 85\%$). |
| **"Behavioral Dissonance"** | **"Cross-modal algorithmic divergence / variance"** | Replaced clinical psychology terminology with standard statistical machine-learning descriptors. |

---

## 3. Unsupported Claims Identified & Retracted

1. **Claim of Clinical Efficacy from Synthetic Benchmarks**: Prior descriptions implied that achieving ROC-AUC $\approx 0.685$ demonstrated the viability of automated multimodal PPD screening. **Retracted**: These benchmarks evaluate pipeline mechanics and tensor integration. Because synthetic text and audio were conditioned on survey covariates, they cannot establish real-world clinical screening validity.
2. **Claim that Multimodal Fusion Outperformed Text Narrative**: Prior summaries highlighted the three-modality learned stacking model as superior to single modalities. **Retracted**: The learned fusion ROC-AUC of $0.6852$ is only $+0.0090$ higher than text alone ($0.6762$), with completely overlapping 95% bootstrap confidence intervals ($[0.591, 0.765]$ vs. $[0.585, 0.754]$). On this synthetic benchmark, multimodal fusion does not provide meaningful improvement over narrative text alone.
3. **Claim of Behavioral Concealment**: Prior triage matrices labeled cases where self-report was high but audio/video was low as "patient concealment". **Retracted**: In synthetic data, video is pure noise and audio is weakly shifted. Disagreements arise from synthetic generation parameters and model errors, not maternal psychology.

---

## 4. Participant-Index Association Audit

To investigate whether participant ordering in the dataset could introduce subtle target leakage into the synthetic video modality, an empirical statistical analysis was conducted on `data/processed/Numerical/train_test_split_manifest.csv` ($N=800$):

### A. Raw Enrollment Order vs. Target Label
A bivariate analysis was performed comparing numeric participant index (`numeric_id`, 1 to 800) with `target_canonical_epds_ge_13`:

- **All Cohort ($N=800$)**:
  - Class 0 (Non-depressed, EPDS < 13): Mean index = **419.71** ($\text{std} = 236.35$)
  - Class 1 (Depressed, EPDS $\ge 13$): Mean index = **375.92** ($\text{std} = 221.41$)
  - Pearson correlation: $r = -0.0941$ ($p = 0.0077$)
  - Spearman rank correlation: $\rho = -0.0941$ ($p = 0.0077$)
  - Welch's two-sample t-test: $t = 2.693, p = 0.0073$
  - Mann-Whitney U test: $p = 0.0078$
- **Training Cohort ($N=640$)**: Pearson $r = -0.0843$ ($p = 0.0329$)
- **Holdout Test Cohort ($N=160$)**: Pearson $r = -0.1341$ ($p = 0.0909$)

*Finding*: In the raw survey dataset, participant enrollment order has a small, statistically significant negative association with EPDS status ($r \approx -0.09$). Participants enrolled earlier in the survey had a slightly higher prevalence of depressive symptoms.

### B. Impact on Synthetic Video Generation
In `pipelines/synthetic_video/generator_v2.py`, single sequences are generated by seeding NumPy's generator:
```python
rng = np.random.default_rng(self.seed * 10000 + participant_sr)
```
To verify whether the pseudo-random number generator (PRNG) leaked this index association into the extracted video features, correlation tests were run between all 220 video features and `participant_sr`:
- **Correlation with Index at $p < 0.05$**: **13 / 220 features (5.9%)**
- **Correlation with Index at $p < 0.01$**: **2 / 220 features (0.9%)**
- **Expected by Pure Random Chance ($\alpha=0.05$)**: **11.0 features (5.0%)**
- **Expected by Pure Random Chance ($\alpha=0.01$)**: **2.2 features (1.0%)**

*Conclusion*: The PRNG thoroughly whitens the seed index. The proportion of video features correlating with participant order (5.9% at $\alpha=0.05$) perfectly matches the 5.0% expected by random chance. The video model cannot exploit participant ordering, confirming that the video baseline functions as an authentic, uncoupled negative control.

---

## 5. Remaining Methodological Limitations

1. **Synthetic Covariate Conditioning**: Text narratives and acoustic features were derived by conditioning on non-target survey covariates (sleep disruption, social support, infant age) from `ppd_modeling_matrix.csv`. Consequently, model evaluation tests the recovery of survey covariate correlations, not authentic vocal prosody or open-ended maternal language.
2. **Video Channel Inactivity**: Because video is an unconditioned negative control, it contributes zero predictive value. In an equal-weight model, it acts as an unmitigated noise source, degrading holdout ROC-AUC by $-0.1175$.
3. **Probability Calibration Absence**:
   - The meta-classifier uses `LogisticRegression(class_weight="balanced")`.
   - Balanced weighting artificially shifts the sigmoid intercept $\beta_0$ to equalize class weights, producing risk scores that do not reflect the true population prevalence.
   - The scores are monotonic ranking values, not calibrated Bayesian probabilities.
4. **Marginal Multimodal Utility**: Across all combinations, the addition of audio and video to text yields a negligible improvement of $+0.0090$ in ROC-AUC ($0.6762 \to 0.6852$), with overlapping 95% bootstrap confidence intervals.

---

## 6. Recommended Next Steps for Real-Data Validation

When authentic maternal screening data becomes available, the following methodological steps are required:

1. **Independent Diagnostic Ground Truth**:
   - The primary outcome must NOT be derived from self-reported EPDS cut-offs.
   - Ground truth labels must be established through independent, structured psychiatric diagnostic interviews (e.g. SCID-5 for DSM-5 Major Depressive Episode) administered by licensed clinical evaluators blinded to screening inputs.
2. **Empirical Probability Calibration**:
   - Fit post-hoc calibration models (Platt scaling or isotonic regression) exclusively on out-of-fold validation subsets without artificial class rebalancing.
   - Evaluate calibration using Brier score decomposition, Expected Calibration Error (ECE), and reliability curves.
3. **Clinical Decision Curve Analysis (DCA)**:
   - Establish decision thresholds based on clinical utility curves rather than $0.50$.
   - Quantify net benefit across a range of clinical threshold probabilities ($p_t \in [0.10, 0.40]$) representing the relative cost of false negatives vs. unnecessary follow-up evaluations.
4. **Algorithmic Disagreement Protocol**:
   - Frame inter-modality discrepancy ($\Delta_{\max} \ge 0.25$) as a data-quality and model uncertainty alert prompting clinician verification, rather than attributing clinical intent to the patient.

---
*Report formally prepared for AANCHAL Research Documentation Integrity Pass.*
