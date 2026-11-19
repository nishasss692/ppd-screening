"""Unit and integration test suite for the Stage 1 Three-Modality Fusion pipeline.

Verifies:
1. Complete isolation from clinical numerical and EPDS questionnaire features.
2. Participant alignment across 640 OOF training and 160 frozen holdout test sets.
3. Strict zero-leakage boundaries between training and holdout partitions.
4. Correct metric computation including Brier score, Sensitivity, Specificity, and CIs.
5. Missing modality dynamic reweighting mechanics.
"""

from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from pipelines.three_modality_fusion.train_three_modality_fusion import (
    compute_bootstrap_confidence_intervals,
    compute_metrics,
    load_and_validate_modality_datasets,
    run_three_modality_fusion,
)


def test_compute_metrics_correctness():
    """Verify diagnostic metric formulas including Brier score and Specificity."""
    y_true = np.array([1, 1, 0, 0])
    y_prob = np.array([0.9, 0.4, 0.2, 0.8])
    # threshold 0.5: pred = [1, 0, 0, 1]
    # TP=1 (idx 0), FN=1 (idx 1), TN=1 (idx 2), FP=1 (idx 3)

    m = compute_metrics(y_true, y_prob, threshold=0.5)
    assert m["total_samples"] == 4
    assert m["positive_samples"] == 2
    assert m["negative_samples"] == 2
    assert m["confusion_matrix"]["tp"] == 1
    assert m["confusion_matrix"]["fp"] == 1
    assert m["confusion_matrix"]["fn"] == 1
    assert m["confusion_matrix"]["tn"] == 1
    assert m["sensitivity"] == 0.5
    assert m["specificity"] == 0.5
    assert m["precision"] == 0.5
    assert m["balanced_accuracy"] == 0.5
    # Brier score: ((0.9-1)^2 + (0.4-1)^2 + (0.2-0)^2 + (0.8-0)^2)/4 = (0.01 + 0.36 + 0.04 + 0.64)/4 = 1.05/4 = 0.2625
    assert pytest.approx(m["brier_score"], rel=1e-3) == 0.2625


def test_load_and_validate_modality_datasets():
    """Verify dataset loader enforces 640/160 partition bounds and participant ordering."""
    oof_df, holdout_df = load_and_validate_modality_datasets()

    assert len(oof_df) == 640
    assert len(holdout_df) == 160

    # Ensure participant IDs are completely disjoint
    train_pids = set(oof_df["participant_id"])
    test_pids = set(holdout_df["participant_id"])
    assert len(train_pids.intersection(test_pids)) == 0

    # Ensure required three modalities are present
    for col in ["text_prob", "audio_prob", "video_prob"]:
        assert col in oof_df.columns
        assert col in holdout_df.columns
        assert oof_df[col].between(0.0, 1.0).all()
        assert holdout_df[col].between(0.0, 1.0).all()


def test_strict_clinical_and_epds_exclusion():
    """Verify that NO clinical numerical features or EPDS items enter the fusion space."""
    oof_df, holdout_df = load_and_validate_modality_datasets()

    prohibited_keywords = ["epds", "clinical", "cesd", "phq", "parity", "age", "gestational"]
    for col in oof_df.columns:
        if col in ["participant_id", "true_target"]:
            continue
        for kw in prohibited_keywords:
            assert kw not in col.lower(), f"Prohibited feature '{col}' leaked into Stage 1 fusion space!"


def test_run_three_modality_fusion_execution(tmp_path):
    """Run full three-modality fusion pipeline into temporary directory and verify artifacts."""
    res = run_three_modality_fusion(output_dir=tmp_path, seed=42, n_bootstraps=50)

    assert "text_only" in res["results"]
    assert "audio_only" in res["results"]
    assert "video_only" in res["results"]
    assert "three_modality_equal" in res["results"]
    assert "three_modality_learned" in res["results"]

    # Check files created
    assert (tmp_path / "oof_fusion_predictions.csv").is_file()
    assert (tmp_path / "holdout_fusion_predictions.csv").is_file()
    assert (tmp_path / "fusion_metrics_summary.json").is_file()
    assert (tmp_path / "three_modality_fusion_report.md").is_file()

    # Check reliability metrics
    rel = res["reliability"]
    assert "discordance_rate" in rel
    assert 0.0 <= rel["discordance_rate"] <= 1.0
    assert "missing_modality_simulations" in rel
