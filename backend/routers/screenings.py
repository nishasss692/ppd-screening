"""FastAPI Router for Screening Retrieval endpoints.

Exposes:
- GET /api/mothers/{mother_id}/screenings (screening history for a mother)
- GET /api/screenings/{screening_id} (retrieve individual screening by UUID)
"""

import logging
from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.database.base import utc_now
from backend.database.connection import get_db
from backend.models.mother import Mother
from backend.models.screening import Screening
from backend.schemas.handoff import ScreeningHandoffRequest, ScreeningHandoffResponse
from backend.schemas.patient_portal import (
    PatientScreeningSummaryResponse,
    ScreeningSubmissionSaveRequest,
)
from backend.schemas.screening import ScreeningResponse
from backend.services.audit_service import audit_service
from backend.services.patient_report_pdf import generate_patient_screening_pdf
from backend.services.questionnaire_service import questionnaire_service
from backend.services.screening_service import ScreeningService, screening_service


logger = logging.getLogger("ppd.routers.screenings")

router = APIRouter(tags=["Screenings"])


@router.get(
    "/api/screenings",
    response_model=List[ScreeningResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve all screening records across all mothers",
)
def list_screenings(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    service: ScreeningService = Depends(lambda: screening_service),
) -> List[ScreeningResponse]:
    """Retrieve all recent screening records across the clinic, newest first."""
    screenings = service.get_all_screenings(db, limit=limit, skip=skip)
    return [ScreeningResponse.model_validate(s) for s in screenings]


@router.post(
    "/api/mothers/{mother_id}/screenings",
    response_model=PatientScreeningSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an in-clinic screening session for a specific mother",
)
def submit_in_clinic_screening(
    mother_id: uuid.UUID,
    payload: ScreeningSubmissionSaveRequest,
    db: Session = Depends(get_db),
) -> PatientScreeningSummaryResponse:
    """Score EPDS + Clinical Random Forest + 4-modality results for an in-clinic patient screening."""
    from backend.routers.patients import persist_epds_screening_for_mother

    mother = db.get(Mother, mother_id)
    if not mother:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mother with ID '{mother_id}' was not found.",
        )
    return persist_epds_screening_for_mother(db=db, mother=mother, payload=payload)


@router.get(
    "/api/mothers/{mother_id}/screenings",
    response_model=List[ScreeningResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve screening history for a specific mother",
)
def get_mother_screenings(
    mother_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: ScreeningService = Depends(lambda: screening_service),
) -> List[ScreeningResponse]:
    """Retrieve all screening records belonging to a mother, newest first."""
    screenings = service.get_screenings_by_mother_id(db, mother_id)
    if screenings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mother with ID '{mother_id}' was not found.",
        )
    return [ScreeningResponse.model_validate(s) for s in screenings]


@router.get(
    "/api/screenings/{screening_id}",
    response_model=ScreeningResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve an individual screening by UUID",
)
def get_screening(
    screening_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: ScreeningService = Depends(lambda: screening_service),
) -> ScreeningResponse:
    """Retrieve details and multimodal results of a single screening event."""
    screening = service.get_screening_by_id(db, screening_id)
    if not screening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening with ID '{screening_id}' was not found.",
        )
    return ScreeningResponse.model_validate(screening)


@router.post(
    "/api/screenings/{screening_id}/handoff",
    response_model=ScreeningHandoffResponse,
    status_code=status.HTTP_200_OK,
    summary="Record clinical handoff event for a screening",
)
def handoff_screening(
    screening_id: uuid.UUID,
    payload: ScreeningHandoffRequest,
    request: Request,
    db: Session = Depends(get_db),
    service: ScreeningService = Depends(lambda: screening_service),
) -> ScreeningHandoffResponse:
    """Record clinical screening handoff in audit log while strictly preserving screening data.

    Guarantees:
    - Verifies the screening exists (404 if missing).
    - Preserves original screening scores, predictions, and EPDS Q10 safety alert.
    - Records an audit log event without storing raw clinical notes or patient narratives.
    - Makes no fraudulent claim of external emergency dispatch; returns RECORDED_IN_AUDIT_LOG.
    """
    screening = service.get_screening_by_id(db, screening_id)
    if not screening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening with ID '{screening_id}' was not found.",
        )

    client_ip = request.client.host if request.client else None
    handoff_time = utc_now()

    # Record event in audit log (strictly sanitized, no patient narratives)
    audit_service.record_event(
        db=db,
        action="screening_handoff",
        resource_type="screening",
        resource_id=str(screening.id),
        actor_id=payload.clinician_id,
        actor_role="clinician",
        details={
            "mother_id": str(screening.mother_id),
            "destination": payload.destination,
            "urgency": payload.urgency,
            "q10_safety_alert": screening.q10_safety_alert,
            "risk_classification": screening.risk_classification,
        },
        client_ip=client_ip,
    )
    db.commit()

    return ScreeningHandoffResponse(
        screening_id=screening.id,
        mother_id=screening.mother_id,
        destination=payload.destination,
        urgency=payload.urgency,
        q10_safety_alert_preserved=screening.q10_safety_alert,
        handoff_recorded_at=handoff_time,
        status="RECORDED_IN_AUDIT_LOG",
    )


@router.get(
    "/api/screenings/{screening_id}/report.pdf",
    summary="Download clinical PDF report for a screening (Clinician access)",
)
def download_clinician_screening_pdf(
    screening_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: ScreeningService = Depends(lambda: screening_service),
):
    """Generate and stream a clinical PDF report for a specific screening UUID."""
    screening = service.get_screening_by_id(db, screening_id)
    if not screening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening with ID '{screening_id}' was not found.",
        )

    mother = db.get(Mother, screening.mother_id)
    patient_name = mother.name if mother else f"Mother {str(screening.mother_id)[:8]}"
    patient_id_label = f"P-{str(screening.mother_id)[:8].upper()}"

    q_resp = questionnaire_service.get_questionnaire()
    questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in q_resp.questions]

    pdf_bytes = generate_patient_screening_pdf(
        patient_name=patient_name,
        patient_id=patient_id_label,
        screening_date=screening.screening_date,
        total_score=screening.total_score,
        risk_classification=screening.risk_classification,
        q10_safety_alert=screening.q10_safety_alert,
        submitted_answers=screening.submitted_answers or {},
        item_scores=screening.item_scores or {},
        questions=questions,
        notes=screening.notes,
    )

    filename = f"AANCHAL_Screening_Report_{screening.screening_date.strftime('%d%b%Y')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/api/screenings/{screening_id}/transcript.txt",
    summary="Download screening transcript TXT for a screening (Clinician access)",
)
def download_clinician_screening_txt(
    screening_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: ScreeningService = Depends(lambda: screening_service),
):
    """Generate and stream a structured clinical screening transcript."""
    screening = service.get_screening_by_id(db, screening_id)
    if not screening:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening with ID '{screening_id}' was not found.",
        )

    mother = db.get(Mother, screening.mother_id)
    patient_name = mother.name if mother else f"Mother {str(screening.mother_id)[:8]}"
    formatted_date = screening.screening_date.strftime("%d %B %Y at %I:%M %p UTC")

    lines = [
        "==================================================================",
        "AANCHAL — MATERNAL CLINICAL SCREENING REPORT",
        "==================================================================",
        f"Patient Name:    {patient_name}",
        f"Mother UUID:     {screening.mother_id}",
        f"Screening ID:    {screening.id}",
        f"Session Date:    {formatted_date}",
        f"EPDS Score:      {screening.total_score} / 30 ({screening.risk_classification.upper()} RISK)",
        f"Q10 Safety Flag: {'TRIGGERED (Self-harm ideation reported)' if screening.q10_safety_alert else 'Negative'}",
    ]

    if screening.clinical_model_prediction:
        cm = screening.clinical_model_prediction
        prob = cm.get("predicted_risk_probability")
        prob_str = f"{prob * 100:.1f}%" if isinstance(prob, (int, float)) else "N/A"
        lines.append(
            f"Clinical ML:     {cm.get('predicted_label', cm.get('risk_category', 'N/A'))} ({prob_str})"
        )

    lines.extend([
        "==================================================================",
        "",
        "EPDS ITEMIZED RESPONSES:",
    ])

    submitted = screening.submitted_answers or {}
    item_sc = screening.item_scores or {}
    q_resp = questionnaire_service.get_questionnaire()
    questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in q_resp.questions]
    q_dict = {q["id"]: q["question"] for q in questions}

    for i in range(1, 11):
        qid_canonical = f"EPDS_Q{i:02d}"
        q_text = q_dict.get(qid_canonical, f"EPDS Question {i}")
        ans_item = submitted.get(qid_canonical) or submitted.get(f"epds_{i}") or {}
        raw_val = ans_item.get("raw_response") if isinstance(ans_item, dict) else str(ans_item)
        sc = item_sc.get(qid_canonical, item_sc.get(f"epds_{i}", 0))
        lines.append(f"Q{i:02d}: {q_text}")
        lines.append(f"  Response: {raw_val or f'Option score {sc}'} (Score: {sc})")

    if screening.psychosocial_answers:
        lines.extend(["", "STAGE 2 PSYCHOSOCIAL CONTEXT:"])
        for k, v in screening.psychosocial_answers.items():
            lines.append(f"- {k.strip()}: {v}")

    lines.extend(["", "--- End of Clinical Screening Record ---"])
    content = "\n".join(lines).encode("utf-8")
    filename = f"AANCHAL_Screening_{screening.screening_date.strftime('%d%b%Y')}.txt"
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


