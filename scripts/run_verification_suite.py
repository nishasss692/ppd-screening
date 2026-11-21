"""Orchestrate end-to-end verification across FastAPI backend and PostgreSQL database.

Starts the FastAPI server on 127.0.0.1:8000 in a daemon thread, waits for health readiness,
runs verify_patient_integration.py and demo_verification.py, and reports consolidated results.
"""

import os
import sys
import time
import threading
import uvicorn
import requests

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath("."))

from backend.main import app
import scripts.verify_patient_integration as verify_patient
import scripts.demo_verification as verify_demo


def start_server():
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="warning",
        loop="asyncio",
    )
    server = uvicorn.Server(config)
    server.run()


def main():
    print("=" * 66)
    print("STARTING E2E BACKEND & DATABASE VERIFICATION RUNNER")
    print("=" * 66)

    # Start server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait for server to become responsive
    ready = False
    for attempt in range(25):
        time.sleep(0.5)
        try:
            r = requests.get("http://127.0.0.1:8000/", timeout=1)
            if r.status_code == 200:
                ready = True
                print(f"FastAPI server ready on http://127.0.0.1:8000 (attempt {attempt+1})")
                break
        except Exception:
            pass

    if not ready:
        print("ERROR: FastAPI server failed to start within timeout.")
        sys.exit(1)

    print("\n" + "=" * 66)
    print("STAGE 1: RUNNING verify_patient_integration.py")
    print("=" * 66)
    os.environ["BASE_URL"] = "http://127.0.0.1:8000"
    try:
        verify_patient.run_checks()
    except Exception as e:
        print(f"Exception during verify_patient_integration: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 66)
    print("STAGE 2: RUNNING demo_verification.py")
    print("=" * 66)
    verify_demo.BASE_URL = "http://127.0.0.1:8000"
    try:
        verify_demo.main()
    except Exception as e:
        print(f"Exception during demo_verification: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 66)
    print("E2E VERIFICATION RUNNER COMPLETE")
    print("=" * 66)


if __name__ == "__main__":
    main()
