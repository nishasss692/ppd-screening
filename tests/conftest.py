"""Global pytest configuration for MIORA CI and local test execution.

Handles:
1. Canonical EPDS questions fixture provisioning from backend/resources/questions.json
   if data/ was excluded from git distribution.
2. Graceful skipping of offline research dataset benchmarks when the 570MB data/ folder is absent.
3. Setting an in-memory or file-based SQLite database fallback for CI test runners.
"""

import os
import shutil
from pathlib import Path
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_DATA_PATH = PROJECT_ROOT / "data" / "questions.json"
BACKEND_QUESTIONS_PATH = PROJECT_ROOT / "backend" / "resources" / "questions.json"
OFFLINE_SPLIT_MANIFEST = PROJECT_ROOT / "data" / "processed" / "Numerical" / "train_test_split_manifest.csv"

# 1. Provision questions.json in data/ for tests if absent
if not QUESTIONS_DATA_PATH.exists() and BACKEND_QUESTIONS_PATH.exists():
    os.makedirs(PROJECT_ROOT / "data", exist_ok=True)
    shutil.copyfile(BACKEND_QUESTIONS_PATH, QUESTIONS_DATA_PATH)

# 2. Configure CI database fallback
if os.getenv("CI") or not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///./ci_test_database.db"


def pytest_collection_modifyitems(config, items):
    """Automatically skip tests that require offline research datasets if they are not present."""
    has_offline_dataset = OFFLINE_SPLIT_MANIFEST.exists()
    if has_offline_dataset:
        return

    skip_offline = pytest.mark.skip(
        reason="Offline research dataset files (570MB) excluded from Git distribution."
    )

    offline_file_indicators = [
        "test_synthetic_audio",
        "test_synthetic_text",
        "test_synthetic_video",
        "test_video_v3",
        "test_audio_model",
        "test_audio_experiment",
        "test_video_model",
        "test_real_video",
        "test_fusion",
        "test_phase_",
        "test_supabase_",
    ]

    for item in items:
        file_path_str = str(item.fspath).replace("\\", "/")
        if any(indicator in file_path_str for indicator in offline_file_indicators):
            item.add_marker(skip_offline)

