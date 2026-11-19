# AANCHAL – Multimodal Dataset Restoration, Generation & Readiness Report

**Repository Path:** `d:\ppd-screening-1`  
**Execution Date:** November 19, 2026  
**Auditor / Engineer:** Antigravity AI – Senior Full-Stack & Clinical ML Systems  
**Report Type:** Phase 2 Pipeline Restoration, Multimodal Generation & Training Readiness Audit  
**Operating Compliance:** Strict Read-Only Verification (No source code or model architectures modified; no commits/pushes)

---

> [!IMPORTANT]
> **Clinical Provenance & Research Benchmark Notice:**  
> AANCHAL is an experimental research prototype for postpartum depression (PPD) screening.
> The **Clinical / Numerical** dataset is derived from an authentic, de-identified clinical survey of $N=800$ postnatal women in Bangladesh.
> The **Audio**, **Video**, and **Text** datasets generated in this phase are clinically conditioned synthetic engineering fixtures designed solely to stress-test multimodal pipeline integration, sequence ingestion, and late-fusion benchmarking. They do **not** represent authentic patient audio recordings, facial videos, or psychiatric interviews, and must never be cited as clinically validated diagnostic biomarkers.

---

## 1. Executive Summary

All phases of the Phase 2 mandate have been systematically executed in strict sequence:

1. **Phase 1 (Clinical File Verification):**  
   All three required clinical files (`PPD_dataset_v3.csv`, `ppd_modeling_matrix.csv`, and `train_test_split_manifest.csv`) were physically verified on disk. All 800 participants are de-identified (`BGD_001` through `BGD_800`), with 0 duplicate rows, zero ID collision, and exact 640/160 train/test partition balance (351 positive, 449 negative).
2. **Phase 2 (Clinical Pipeline Restoration):**  
   The clinical data loading and preprocessing suite (`pipelines/clinical_numerical/data_loader.py` and `preprocessor.py`) was verified against the uploaded datasets. All 8 automated unit/integration tests in `tests/test_clinical_numerical.py` passed with $100\%$ success. The pre-trained clinical models in `models/clinical_numerical/` remain preserved and untouched.
3. **Phase 3 (Synthetic Dataset Generation):**  
   The three canonical multimodal generators were executed in the prescribed order:
   - **Audio:** `pipelines/synthetic_audio/generator.py` $\rightarrow$ Produced `audio_manifest.csv` and 800 `.npy` temporal embedding tensors ($T \times 128$).
   - **Video:** `pipelines/synthetic_video/generator_v2.py` $\rightarrow$ Produced `video_manifest.csv` and 800 `.npy` Action Unit / kinematic feature tensors ($T \times 24$).
   - **Text:** `pipelines/synthetic_text/generator.py` $\rightarrow$ Produced `text_manifest.csv` and 800 contextual narrative files (`.txt`).
4. **Phase 4 (Dataset Validation):**  
   An exhaustive validation suite verified all 800 files per modality: 0 missing, 0 corrupted, 100% ID alignment, 100% split alignment, 0 target leakage, and zero physiological bound violations.
5. **Phase 5 (Training Readiness Inspection):**  
   - `train_audio_model.py` and `train_text_model.py` imported successfully and are **100% ready for training**.
   - The video baseline script (`train_baselines.py`) is currently blocked by an unnecessary PyTorch import in `pipelines/video_model/dataset.py`. A lightweight fallback pattern was identified to unblock Scikit-Learn baseline training without PyTorch.

---

## 2. Phase 1: Clinical Dataset Verification Results

All three primary clinical files were inspected using automated data verification scripts:

| File Location | Size on Disk | Row Count | Column Count | Unique Participant IDs | Missing Values | Duplicate Rows |
|---|---|---|---|---|---|---|
| `data/raw/Numerical/PPD_dataset_v3.csv` | 483,135 bytes | 800 | 70 | 800 (`sr` 1 to 800) | 4,312 | 0 |
| `data/processed/Numerical/ppd_modeling_matrix.csv` | 233,677 bytes | 800 | 47 | 800 | 4,313 | 0 |
| `data/processed/Numerical/train_test_split_manifest.csv` | 19,698 bytes | 800 | 5 | 800 (`BGD_001` - `BGD_800`) | 0 | 0 |

### Target Column & Canonical Class Distribution:
- **Target Variable:** `target_canonical_epds_ge_13` (in manifest) / `EPDS_high_risk_screening_threshold` (in matrix).
- **Full Cohort ($N=800$):**
  - High Depression Risk (Class 1, EPDS $\ge 13$): **351 participants (43.875%)**
  - Low/Normal Risk (Class 0, EPDS $< 13$): **449 participants (56.125%)**
- **Canonical Split Partition Verification:**
  - **Training Partition ($N=640$):** 281 Positive ($43.91\%$), 359 Negative ($56.09\%$).
  - **Holdout Test Partition ($N=160$):** 70 Positive ($43.75\%$), 90 Negative ($56.25\%$).
  - **Partition Overlap:** $\text{Train} \cap \text{Holdout} = \emptyset$ (Zero participant leakage).

### Privacy & Provenance Verification:
- All direct patient identifiers (names, addresses, national identification numbers, phone numbers) are completely absent.
- Participants are indexed strictly by anonymous alphanumeric codes (`BGD_001` to `BGD_800`).
- No sensitive personal or medical data is exposed in log traces.

---

## 3. Phase 2: Clinical Pipeline Restoration & Test Results

The uploaded datasets were tested against the existing clinical loader (`pipelines/clinical_numerical/data_loader.py`):
```
load_clinical_data() SUCCEEDED:
  X_train: (640, 46) predictors (2 continuous, 44 categorical)
  y_train: (640,) binary targets (sum = 281)
  X_test:  (160, 46) predictors (2 continuous, 44 categorical)
  y_test:  (160,) binary targets (sum = 70)
  man_train: (640, 5) metadata columns
  man_test:  (160, 5) metadata columns
```

### Automated Test Execution (`pytest tests/test_clinical_numerical.py -v`):
- `test_dataset_loading_and_dimensions` **PASSED** [12%]
- `test_strict_target_isolation` **PASSED** [25%]
- `test_train_test_split_separation_and_balance` **PASSED** [37%]
- `test_missing_value_handling_and_no_leakage` **PASSED** [50%]
- `test_reproducibility_of_preprocessing` **PASSED** [62%]
- `test_metric_computation_and_bootstrap_ci` **PASSED** [75%]
- `test_baseline_models_training_and_inference` **PASSED** [87%]
- `test_unified_pipeline_lifecycle_and_single_prediction` **PASSED** [100%]

**Result:** **8 Passed in 3.96s** (Zero failures). Preprocessing is confirmed leak-free and fitted exclusively on training data. The existing clinical models (`random_forest.joblib`, `preprocessor.joblib`, etc.) remain intact.

---

## 4. Phase 3: Multimodal Generation Execution Results

The three canonical generators were executed in the required sequence:

```
Step 1: Audio Generator (pipelines/synthetic_audio/generator.py)
  ├── Output Manifest: data/synthetic/audio/audio_manifest.csv (800 rows)
  ├── Output Features: data/synthetic/audio/features/ (800 individual .npy files)
  └── Execution Time: ~9.5s

Step 2: Video V2 Generator (pipelines/synthetic_video/generator_v2.py)
  ├── Output Manifest: data/synthetic/video_v2/video_manifest.csv (800 rows)
  ├── Output Features: data/synthetic/video_v2/features/ (800 individual .npy files)
  └── Execution Time: ~11.2s

Step 3: Text Narrative Generator (pipelines/synthetic_text/generator.py)
  ├── Output Manifest: data/synthetic/text/text_manifest.csv (800 rows)
  ├── Output Narratives: data/synthetic/text/narratives/ (800 individual .txt files)
  └── Execution Time: ~8.8s
```

---

## 5. Phase 4: Generated Dataset Validation

An automated verification script inspected all generated records across disk storage:

### 5.1 Audio Modality Validation
- **Manifest File:** `data/synthetic/audio/audio_manifest.csv` (800 rows, 14 columns).
- **Participant Alignment:** Exactly 800 unique IDs (`BGD_001` through `BGD_800`), perfectly aligned with clinical split order.
- **Partition Distribution:** 640 Train (281 Positive, 359 Negative), 160 Holdout Test (70 Positive, 90 Negative).
- **Feature Tensor Verification:**
  - 800 `.npy` files verified on disk in `data/synthetic/audio/features/`.
  - Corrupted or missing files: **0**.
  - Tensor Dimensions: $(T, 128)$ float32, with temporal length $T \in [30, 90]$ frames.
- **Acoustic Summary Bounds Verification:**
  - `f0_mean_hz`: min $159.24$ Hz, max $272.94$ Hz (Bound: $[75.0, 500.0]$ Hz) $\rightarrow$ **0 out of bounds**.
  - `f0_std_hz`: min $8.00$ Hz, max $46.43$ Hz (Bound: $[2.0, 150.0]$ Hz) $\rightarrow$ **0 out of bounds**.
  - `jitter_local_percent`: min $0.20\%$, max $2.75\%$ (Bound: $[0.05, 10.0]\%$) $\rightarrow$ **0 out of bounds**.
  - `shimmer_local_percent`: min $1.00\%$, max $9.32\%$ (Bound: $[0.1, 25.0]\%$) $\rightarrow$ **0 out of bounds**.
  - `hnr_db`: min $8.47$ dB, max $27.38$ dB (Bound: $[-5.0, 40.0]$ dB) $\rightarrow$ **0 out of bounds**.
  - `speech_rate_syllables_per_sec`: min $1.80$, max $5.47$ (Bound: $[0.5, 10.0]$) $\rightarrow$ **0 out of bounds**.
  - `pause_ratio`: min $0.08$, max $0.47$ (Bound: $[0.0, 0.95]$) $\rightarrow$ **0 out of bounds**.
- **Provenance Tag:** `CLINICALLY_CONDITIONED_SYNTHETIC` present on all 800 records.

### 5.2 Video Modality Validation (V2 Trajectories)
- **Manifest File:** `data/synthetic/video_v2/video_manifest.csv` (800 rows, 13 columns).
- **Participant Alignment:** Exactly 800 unique IDs (`BGD_001` through `BGD_800`), perfectly aligned with clinical split order.
- **Partition Distribution:** 640 Train, 160 Holdout Test.
- **Feature Tensor Verification:**
  - 800 `.npy` files verified on disk in `data/synthetic/video_v2/features/`.
  - Corrupted or missing files: **0**.
  - Tensor Dimensions: $(T, 24)$ float32, with temporal length $T \in [45, 120]$ frames (mean: $81.7$ frames).
  - 24 channels cover: 14 Facial Action Units, 3 head pose, 2 eye gaze, 3 kinematic derivatives, 2 tracking metadata channels.
  - Dropout burst simulation: Mean burst count $= 1.37$ per participant, dropout rate mean $= 6.59\%$ (within $[3.0\%, 10.0\%]$ bounds).
- **Provenance Tag:** `SYNTHETIC_ABSTRACT_VIDEO_FEATURES_V2` present on all 800 records.

### 5.3 Text Modality Validation (Synthetic Contextual Narratives)
- **Manifest File:** `data/synthetic/text/text_manifest.csv` (800 rows, 13 columns).
- **Participant Alignment:** Exactly 800 unique IDs (`BGD_001` through `BGD_800`), perfectly aligned with clinical split order.
- **Partition Distribution:** 640 Train, 160 Holdout Test.
- **Narrative File Verification:**
  - 800 `.txt` files verified on disk in `data/synthetic/text/narratives/`.
  - Corrupted, missing, or excessively short ($<50$ words) files: **0**.
  - Word count: min $120$ words, max $147$ words, mean $133.3$ words.
  - Language: `en` (English standard narrative syntax).
- **Conditioning & Content Safety:** 
  - All narratives condition strictly on approved non-target domestic covariates (parity, living arrangement, support, infant sleep).
  - Prohibited clinical diagnostic keywords (*"depressed"*, *"suicide"*, *"EPDS"*, *"hopeless"*) are strictly absent from all generated texts.

---

## 6. Phase 5: Training Readiness Assessment & Blocker Analysis

The training scripts for all four modalities were audited for dependencies, execution health, and potential blockers:

| Modality / Pipeline | Target Script | Dependency Requirements | Execution Health | Readiness Status |
|---|---|---|---|---|
| **Clinical Modality** | `pipelines/clinical_numerical/train.py` | `scikit-learn`, `numpy`, `pandas`, `joblib` | All dependencies installed; data loaded and verified. | **100% Ready for Training / Re-evaluation** |
| **Audio Modality** | `pipelines/synthetic_audio/train_audio_model.py` | `scikit-learn`, `numpy`, `pandas`, `joblib` | All dependencies installed; input manifest and split manifest present. | **100% Ready for Training** |
| **Text Modality** | `pipelines/synthetic_text/train_text_model.py` | `scikit-learn`, `numpy`, `pandas`, `joblib` | All dependencies installed; input narratives and split manifest present. | **100% Ready for Training** |
| **Video Modality** | `pipelines/video_model/train_baselines.py` | `scikit-learn`, `numpy`, `pandas`, `joblib` | **BLOCKED:** Unconditional `import torch` in `pipelines/video_model/dataset.py`. | **Requires Code Fix** (See Section 6.1) |
| **Video Deep Learning** | `pipelines/video_model/train_canonical_aligned.py` | `torch` (PyTorch) | **BLOCKED:** PyTorch is not installed in local environment. | **Requires PyTorch Installation** |

---

### 6.1 Video Pipeline Blocker Investigation & Proposed Solution

#### Root Cause Analysis:
In `pipelines/video_model/train_baselines.py`, the training script implements Scikit-Learn baselines (`LogisticRegression` and `RandomForestClassifier`) using 220 pooled summary statistics extracted via `ParticipantStatisticalFeatureExtractor`. **It does not perform any neural network or GPU tensor operations.**

However, line 33 of `train_baselines.py` imports:
```python
from pipelines.video_model.dataset import PPDVideoDataset
```
And inside `pipelines/video_model/dataset.py` (lines 18–19):
```python
import torch
from torch.utils.data import Dataset
```
Because `torch` is not installed in the Python environment, importing `dataset.py` immediately crashes with `ModuleNotFoundError: No module named 'torch'`.

#### Proposed Elegant Solution (When Approved):
In `pipelines/video_model/dataset.py`, wrap the PyTorch import in a graceful fallback:
```python
try:
    import torch
    from torch.utils.data import Dataset
    HAS_TORCH = True
except ImportError:
    torch = None
    HAS_TORCH = False
    class Dataset:
        """Dummy fallback base class when PyTorch is not installed."""
        pass
```
And inside `__getitem__`:
```python
if return_as_torch and HAS_TORCH and torch is not None:
    return torch.from_numpy(tensor).float(), target
return tensor, target
```
**Impact:** This single 6-line non-breaking adjustment enables `PPDVideoDataset` to load `.npy` arrays using standard NumPy. It completely unblocks `pipelines/video_model/train_baselines.py` without requiring a multi-gigabyte PyTorch installation.

---

## 7. Recommended Next Training Sequence

Now that all three synthetic multimodal datasets are generated, validated, and aligned with the canonical clinical split:

```
Step 1: Train Baseline Audio Classifier (Acoustic 7-Feature Baseline)
  ├── Script: pipelines/synthetic_audio/train_audio_model.py
  ├── Artifact Target: models/audio_model/ (logistic_regression.joblib, scaler.joblib)
  └── Evaluates 5-fold CV + 160 holdout test set with bootstrap CIs.

Step 2: Train Baseline Text Classifier (TF-IDF Narrative Baseline)
  ├── Script: pipelines/synthetic_text/train_text_model.py
  ├── Artifact Target: models/text_model/ (text_classifier.joblib, tfidf_vectorizer.joblib)
  └── Evaluates 5-fold CV + 160 holdout test set with bootstrap CIs.

Step 3: Unblock & Train Video Baseline Models (220 Pooled Feature Baselines)
  ├── Apply graceful PyTorch fallback in pipelines/video_model/dataset.py.
  ├── Script: pipelines/video_model/train_baselines.py
  ├── Artifact Target: artifacts/video_model/baselines/
  └── Evaluates 5-fold CV + 160 holdout test set across 3 feature subsets (All, Motion, Tracking).

Step 4: Independent Modality Evaluation & Multimodal Fusion Readiness
  ├── Validate that unimodal models achieve genuine positive predictive value before fusion.
  └── Maintain Clinical = 1.000 stacking weight to prevent signal dilution from synthetic streams.
```

---
*Report generated strictly from verified repository source code, split manifests, file system checks, and test executions.*
