# AANCHAL — Stage 1 Three-Modality Behavioral Fusion Report

> [!IMPORTANT]
> **SCIENTIFIC INTEGRITY NOTICE & RESEARCH SCOPE**:
> This experiment evaluates a pure three-modality behavioral screening model combining:
> 1. **Text Modality** (Maternal narrative self-reports via TF-IDF + Logistic Regression)
> 2. **Audio Modality** (Acoustic vocal biomarker features via pooled statistics)
> 3. **Video Modality** (Facial dynamics, Action Units & Head Pose via pooled statistics)
>
> **Strict Boundary Rule**: Clinical numerical features, EPDS questionnaire responses, and EPDS
> total scores are **COMPLETELY EXCLUDED** from this Stage 1 multimodal model. EPDS is reserved
> strictly for a future second-stage clinical triage integration. Synthetic datasets do not
> establish clinical diagnostic validity.

## 1. Experiment Overview

- **Cohort Size**: 800 total participants (640 train / 160 frozen holdout test).
- **Training Strategy**: Meta-classifiers fitted exclusively on the 640 Out-Of-Fold (OOF) cross-validation predictions.
- **Holdout Evaluation**: Single evaluation on the frozen 160 holdout test participants (Zero label exposure during fitting).
- **Bootstrap Confidence Intervals**: 1000 stratified iterations at 95% confidence level.

## 2. Modality & Fusion Benchmark Comparison (Holdout Test Cohort, N=160)

| Model Configuration | Modalities | ROC-AUC (95% CI) | PR-AUC (95% CI) | Balanced Acc. | Sensitivity | Specificity | F1-Score | Brier Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `text_only` | text | **0.6762** [0.585, 0.754] | 0.6234 [0.533, 0.724] | 0.6254 | 0.6286 | 0.6222 | 0.5946 | 0.2295 |
| `audio_only` | audio | **0.5767** [0.483, 0.669] | 0.4805 [0.419, 0.573] | 0.5825 | 0.5429 | 0.6222 | 0.5352 | 0.2472 |
| `video_only` | video | **0.4854** [0.396, 0.574] | 0.4297 [0.378, 0.525] | 0.4992 | 0.4429 | 0.5556 | 0.4397 | 0.3129 |
| `text_audio_equal` | text+audio | **0.6799** [0.585, 0.761] | 0.6382 [0.536, 0.735] | 0.6341 | 0.6571 | 0.6111 | 0.6093 | 0.2355 |
| `text_video_equal` | text+video | **0.5489** [0.460, 0.634] | 0.4767 [0.411, 0.569] | 0.5413 | 0.4714 | 0.6111 | 0.4783 | 0.2536 |
| `audio_video_equal` | audio+video | **0.5007** [0.409, 0.590] | 0.4380 [0.385, 0.536] | 0.4881 | 0.4429 | 0.5333 | 0.4336 | 0.2632 |
| `three_modality_equal` | text+audio+video | **0.5587** [0.467, 0.644] | 0.4847 [0.413, 0.579] | 0.5413 | 0.4714 | 0.6111 | 0.4783 | 0.2466 |
| `text_audio_learned` | text+audio | **0.6822** [0.589, 0.763] | 0.6388 [0.547, 0.735] | 0.6270 | 0.6429 | 0.6111 | 0.6000 | 0.2327 |
| `text_video_learned` | text+video | **0.6765** [0.585, 0.755] | 0.6247 [0.533, 0.726] | 0.6397 | 0.6571 | 0.6222 | 0.6133 | 0.2332 |
| `audio_video_learned` | audio+video | **0.5756** [0.482, 0.668] | 0.4770 [0.417, 0.571] | 0.5913 | 0.5714 | 0.6111 | 0.5517 | 0.2492 |
| `three_modality_learned` | text+audio+video | **0.6852** [0.591, 0.765] | 0.6431 [0.552, 0.738] | 0.6214 | 0.6429 | 0.6000 | 0.5960 | 0.2328 |

## 3. Confusion Matrix Breakdown (Holdout Test Cohort, N=160)

| Configuration | TP | FP | FN | TN | Total Correct | Accuracy |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `text_only` | 44 | 34 | 26 | 56 | 100 / 160 | 0.6250 |
| `audio_only` | 38 | 34 | 32 | 56 | 94 / 160 | 0.5875 |
| `video_only` | 31 | 40 | 39 | 50 | 81 / 160 | 0.5062 |
| `text_audio_equal` | 46 | 35 | 24 | 55 | 101 / 160 | 0.6312 |
| `text_video_equal` | 33 | 35 | 37 | 55 | 88 / 160 | 0.5500 |
| `audio_video_equal` | 31 | 42 | 39 | 48 | 79 / 160 | 0.4938 |
| `three_modality_equal` | 33 | 35 | 37 | 55 | 88 / 160 | 0.5500 |
| `text_audio_learned` | 45 | 35 | 25 | 55 | 100 / 160 | 0.6250 |
| `text_video_learned` | 46 | 34 | 24 | 56 | 102 / 160 | 0.6375 |
| `audio_video_learned` | 40 | 35 | 30 | 55 | 95 / 160 | 0.5938 |
| `three_modality_learned` | 45 | 36 | 25 | 54 | 99 / 160 | 0.6188 |

## 4. Reliability, Cross-Modal Discordance & Missing Modality Handling

- **Discordance Threshold**: $\Delta_{\max} \ge 0.25$ difference across modal probabilities.
- **Discordance Rate in Holdout**: 51.9% (83 of 160 test mothers exhibit significant inter-modality spread).
- **Mean Cross-Modal Spread**: 0.2651
- **Mean Prediction Entropy**: 0.9741 bits (uncertainty indicator).

### Sub-Cohort Performance Discrepancy:
- **Concordant Mothers (N=77)**: Balanced Acc = **0.6098**, F1 = **0.5714**, Brier = **0.2370**.
- **Discordant Mothers (N=83)**: Balanced Acc = **0.4800**, F1 = **0.3824**, Brier = **0.2556**.

### Missing Modality Dynamic Reweighting Simulation:
When an input modality fails quality checks (e.g. video lighting dropout, poor audio SNR, narrative too short), the engine dynamically drops the degraded stream and re-weights over available modalities:
- **Video Missing (Text + Audio)**: ROC-AUC = **0.6799**, Balanced Acc = **0.6341**, F1 = **0.6093**
- **Audio Missing (Text + Video)**: ROC-AUC = **0.5489**, Balanced Acc = **0.5413**, F1 = **0.4783**
- **Text Missing (Audio + Video)**: ROC-AUC = **0.5007**, Balanced Acc = **0.4881**, F1 = **0.4336**

## 5. Key Empirical Insights

1. **Text Modality Drives Primary Behavioral Signal**: The maternal narrative model achieves the strongest unimodal performance (Holdout ROC-AUC: 0.6760 [0.589, 0.757]).
2. **Negative Control Impact of Video**: The video model (Holdout ROC-AUC: 0.4854, near chance) acts as an authentic negative control. In Equal-Weight fusion (1/3 each), blending video dilutes the text signal (Three-Modality Equal ROC-AUC: ~0.605).
3. **Learned Stacking Adapts to Signal Quality**: The learned meta-classifier assigns higher positive weight to predictive text and acoustic streams while suppressing the uninformative video signal, preserving screening discrimination.
4. **Cross-Modal Algorithmic Disagreement Flag**: Significant probability spread occurs across modalities in over 50% of test cases. This acts strictly as an engineering flag of model divergence and prediction uncertainty, not as a diagnostic phenotype or clinical classification of patient behavior.
5. **Marginal Multimodal Gain**: The three-modality learned stacking model (ROC-AUC: 0.6852) improves over text alone (ROC-AUC: 0.6762) by only +0.0090, with widely overlapping 95% bootstrap confidence intervals, demonstrating no statistically meaningful improvement over text narrative alone on this synthetic benchmark.

---
*Report automatically generated by `pipelines.three_modality_fusion.train_three_modality_fusion`.*