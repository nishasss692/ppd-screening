"""FastAPI Router for EPDS Questionnaire endpoints.

Exposes GET /api/questionnaire/epds and POST /api/questionnaire/epds/submit.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.screening import Screening
from backend.models.user import User
from backend.schemas.questionnaire import (
    EPDSQuestionnaireResponse,
    EPDSSubmissionRequest,
    EPDSSubmissionResponse,
)
from backend.services.auth_service import get_optional_current_user
from backend.services.questionnaire_service import (
    EPDSQuestionnaireService,
    questionnaire_service,
)

logger = logging.getLogger("ppd.questionnaire")

router = APIRouter(prefix="/api/questionnaire", tags=["EPDS Questionnaire"])


@router.get("/epds", response_model=EPDSQuestionnaireResponse)
def get_epds_questionnaire(
    service: EPDSQuestionnaireService = Depends(lambda: questionnaire_service),
) -> EPDSQuestionnaireResponse:
    """Retrieve the full 10-item EPDS question bank, metadata, options, and guidance.

    Single source of truth: data/questions.json.
    """
    return service.get_questionnaire()


@router.post("/epds/submit", response_model=EPDSSubmissionResponse)
def submit_epds_questionnaire(
    submission: EPDSSubmissionRequest,
    service: EPDSQuestionnaireService = Depends(lambda: questionnaire_service),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_current_user),
) -> EPDSSubmissionResponse:
    """Validate completed questionnaire responses, calculate score, enforce Item 10 safety,
    and persist screening session to PostgreSQL when an authenticated patient is resolved."""
    result = service.calculate_score(submission)

    # If an authenticated patient submitted this, persist to PostgreSQL screenings table
    if user and user.mother_id:
        try:
            total = result.total_score
            risk_class = "high" if total >= 13 else ("moderate" if total >= 10 else "low")
            item_scores_map = {item.question_id: item.score for item in result.item_scores}
            submitted_answers_map = {
                item.question_id: {
                    "selected_index": getattr(item, "selected_option_index", getattr(item, "selected_index", 0)),
                    "score": item.score,
                    "question_number": item.question_number,
                }
                for item in result.item_scores
            }

            screening_record = Screening(
                mother_id=user.mother_id,
                instrument="EPDS",
                total_score=result.total_score,
                risk_classification=risk_class,
                q10_safety_alert=result.safety_alert.triggered,
                submitted_answers=submitted_answers_map,
                item_scores=item_scores_map,
                screening_status="completed",
                fusion_status="not_available",
                modality_status={"epds": "completed"},
                model_metadata={"scoring_version": "1.0", "engine": "canonical_epds"},
                multimodal_scores={"epds_score": result.total_score, "epds_classification": result.classification},
                notes=f"Sequential EPDS via AI Assistant. Score: {result.total_score}/30",
            )
            db.add(screening_record)
            db.commit()
            logger.info("Persisted EPDS screening to PostgreSQL: mother_id=%s, score=%d", user.mother_id, result.total_score)
        except Exception as exc:
            db.rollback()
            logger.error("Failed to persist EPDS screening to PostgreSQL: %s", exc)

    return result

