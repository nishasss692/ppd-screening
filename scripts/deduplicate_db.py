"""Database deduplication script for MIORA PostgreSQL database.

Eliminates:
1. Automated test user accounts (patient_%@example.com, mother_voice_%@example.com, test_mother_%@miora.health)
2. Duplicate test mother entities (Priya Sharma duplicates, Ananya Sen duplicates, Fatima Zahra duplicates)
3. Duplicate test screenings (identical score 15 test screenings, identical score 24 screenings)
4. Duplicate screenings for Amara K. Wilson (keeps distinct clinical sessions with score progression)
5. Duplicate care plans (keeps single active care plan for Amara)
"""

import os
from sqlalchemy import text, select, func
from backend.database.connection import get_db_context
from backend.models.user import User
from backend.models.mother import Mother
from backend.models.screening import Screening
from backend.models.care_plan import CarePlan
from backend.models.clinical_review import ClinicalReview

def run_deduplication():
    with get_db_context() as db:
        print("--- Starting PostgreSQL Deduplication ---")
        
        # 1. Identify test mother IDs
        test_emails = [
            "patient_%@example.com",
            "mother_voice_%@example.com",
            "test_mother_%@miora.health",
        ]
        
        # Find test users
        test_user_ids = []
        for pattern in test_emails:
            users = db.query(User).filter(User.email.like(pattern)).all()
            for u in users:
                test_user_ids.append(u.id)
        
        # Find test mothers
        test_mother_ids = []
        for pattern in test_emails:
            mothers = db.query(Mother).filter(Mother.email.like(pattern)).all()
            for m in mothers:
                test_mother_ids.append(m.id)
                
        print(f"Found {len(test_user_ids)} test users and {len(test_mother_ids)} test mothers to clean up.")
        
        # 2. Delete dependent records for test mothers
        if test_mother_ids:
            # Delete clinical reviews
            db.query(ClinicalReview).filter(ClinicalReview.mother_id.in_(test_mother_ids)).delete(synchronize_session=False)
            # Delete care plans
            db.query(CarePlan).filter(CarePlan.mother_id.in_(test_mother_ids)).delete(synchronize_session=False)
            # Delete screenings
            deleted_test_screenings = db.query(Screening).filter(Screening.mother_id.in_(test_mother_ids)).delete(synchronize_session=False)
            print(f"Deleted {deleted_test_screenings} screenings associated with test mothers.")
            
            # Unlink and delete test users
            if test_user_ids:
                deleted_users = db.query(User).filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)
                print(f"Deleted {deleted_users} test users.")
                
            # Delete test mothers
            deleted_mothers = db.query(Mother).filter(Mother.id.in_(test_mother_ids)).delete(synchronize_session=False)
            print(f"Deleted {deleted_mothers} test mother records.")
            
        # 3. Deduplicate duplicate screenings for legitimate mothers (e.g. Amara K. Wilson)
        canonical_mothers = db.query(Mother).all()
        for mother in canonical_mothers:
            screenings = (
                db.query(Screening)
                .filter(Screening.mother_id == mother.id)
                .order_by(Screening.created_at.desc())
                .all()
            )
            
            seen_scores_and_times = set()
            keep_screenings = []
            duplicate_screenings = []
            
            for s in screenings:
                # Group screenings submitted with identical score on the same day/session
                date_key = s.screening_date.strftime("%Y-%m-%d %H") if s.screening_date else ""
                key = (s.total_score, date_key)
                if key in seen_scores_and_times:
                    duplicate_screenings.append(s.id)
                else:
                    seen_scores_and_times.add(key)
                    keep_screenings.append(s)
            
            if duplicate_screenings:
                print(f"Mother '{mother.name}' has {len(duplicate_screenings)} duplicate screening sessions. Deleting duplicates...")
                # Delete care plans or reviews attached to duplicates
                db.query(CarePlan).filter(CarePlan.screening_id.in_(duplicate_screenings)).delete(synchronize_session=False)
                db.query(ClinicalReview).filter(ClinicalReview.screening_id.in_(duplicate_screenings)).delete(synchronize_session=False)
                deleted_s = db.query(Screening).filter(Screening.id.in_(duplicate_screenings)).delete(synchronize_session=False)
                print(f"Removed {deleted_s} duplicate screenings for {mother.name}.")
                
            # 4. Deduplicate care plans for this mother
            care_plans = (
                db.query(CarePlan)
                .filter(CarePlan.mother_id == mother.id)
                .order_by(CarePlan.created_at.desc())
                .all()
            )
            if len(care_plans) > 1:
                # Keep the latest care plan
                surplus_plans = [cp.id for cp in care_plans[1:]]
                db.query(CarePlan).filter(CarePlan.id.in_(surplus_plans)).delete(synchronize_session=False)
                print(f"Deduplicated care plans: kept 1, deleted {len(surplus_plans)} surplus care plans.")
                
        db.commit()
        
        # Summary verification
        remaining_mothers = db.query(Mother).all()
        remaining_screenings = db.query(Screening).all()
        remaining_users = db.query(User).all()
        
        print("\n--- Deduplication Complete ---")
        print(f"Remaining Users ({len(remaining_users)}):")
        for u in remaining_users:
            print(f"  {u.email} ({u.role})")
        print(f"Remaining Mothers ({len(remaining_mothers)}):")
        for m in remaining_mothers:
            print(f"  {m.name} <{m.email}> (ID: {m.id})")
        print(f"Remaining Screenings ({len(remaining_screenings)}):")
        for s in remaining_screenings:
            print(f"  Score: {s.total_score} | Risk: {s.risk_classification} | Date: {s.screening_date}")

if __name__ == "__main__":
    run_deduplication()
