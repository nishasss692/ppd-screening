"""PDF Report Generation Service for Patient EPDS Screening sessions.

Generates professional clinical summary reports using ReportLab with clean typography,
score summaries, safety alerts, and item breakdowns.
"""

from datetime import datetime
import io
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_patient_screening_pdf(
    patient_name: str,
    patient_id: str,
    screening_date: datetime,
    total_score: int,
    risk_classification: str,
    q10_safety_alert: bool,
    submitted_answers: Dict[str, Any],
    item_scores: Dict[str, int],
    questions: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[str] = None,
    screening_id: Optional[str] = None,
    postpartum_week: Optional[int] = None,
    multimodal_summary: Optional[Dict[str, Any]] = None,
    clinical_review: Optional[Dict[str, Any]] = None,
    care_plan: Optional[Dict[str, Any]] = None,
    clinical_profile: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Generate a comprehensive clinical PDF report for the entire screening session."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_color = colors.HexColor("#be185d")  # Miora Rose
    brand_dark = colors.HexColor("#1e293b")
    text_muted = colors.HexColor("#64748b")
    card_bg = colors.HexColor("#fdf2f8")
    border_color = colors.HexColor("#fbcfe8")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=brand_color,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=text_muted,
        spaceAfter=12,
    )
    heading2_style = ParagraphStyle(
        "Heading2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=brand_dark,
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=brand_dark,
    )
    bold_style = ParagraphStyle(
        "BodyBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    alert_style = ParagraphStyle(
        "Alert",
        parent=body_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#b91c1c"),
    )

    story = []

    # 1. Header
    story.append(Paragraph("AANCHAL · Maternal Emotional Intelligence", title_style))
    story.append(Paragraph("Comprehensive Maternal Screening Report (Multimodal AI, Clinical Profile, Clinician Review &amp; EPDS)", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_color, spaceAfter=14))

    # 2. Patient & Session Meta Table
    formatted_date = screening_date.strftime("%d %B %Y at %I:%M %p UTC")
    week_label = f"Week {postpartum_week}" if postpartum_week is not None else "Not specified"
    meta_data = [
        [
            Paragraph("<b>Patient Name:</b>", body_style),
            Paragraph(patient_name, body_style),
            Paragraph("<b>Patient ID:</b>", body_style),
            Paragraph(patient_id, body_style),
        ],
        [
            Paragraph("<b>Screening Date:</b>", body_style),
            Paragraph(formatted_date, body_style),
            Paragraph("<b>Postpartum Week:</b>", body_style),
            Paragraph(week_label, body_style),
        ],
        [
            Paragraph("<b>Session ID:</b>", body_style),
            Paragraph(str(screening_id or "Latest Session"), body_style),
            Paragraph("<b>Instruments:</b>", body_style),
            Paragraph("Multimodal AI + Clinical + 10-Item EPDS", body_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[1.3 * inch, 2.3 * inch, 1.2 * inch, 2.2 * inch])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # 3. Overall Result & Risk Assessment Box
    risk_label = risk_classification.title()
    if risk_classification.lower() == "high":
        risk_color = colors.HexColor("#b91c1c")
        risk_desc = "Probable Depression (High Risk). Clinical follow-up strongly recommended."
    elif risk_classification.lower() == "moderate":
        risk_color = colors.HexColor("#d97706")
        risk_desc = "Possible Depression (Moderate Risk). Clinical monitoring and emotional support advised."
    else:
        risk_color = colors.HexColor("#15803d")
        risk_desc = "Low Likelihood of Depressive Illness. Routine postpartum recovery pathway."

    risk_badge = Paragraph(f"<font color='{risk_color.hexval()}'><b>{risk_label} ({total_score}/30)</b></font>", bold_style)
    q10_text = (
        "<font color='#b91c1c'><b>TRIGGERED · Affirmative response to self-harm ideation item. Immediate clinical evaluation required.</b></font>"
        if q10_safety_alert
        else "<font color='#15803d'>Negative · No active self-harm ideation reported.</font>"
    )

    summary_data = [
        [Paragraph("<b>EPDS Total Score:</b>", body_style), Paragraph(f"<b>{total_score}</b> of 30 possible points", bold_style)],
        [Paragraph("<b>Clinical Risk Tier:</b>", body_style), risk_badge],
        [Paragraph("<b>Risk Interpretation:</b>", body_style), Paragraph(risk_desc, body_style)],
        [Paragraph("<b>Question 10 Safety Alert:</b>", body_style), Paragraph(q10_text, body_style)],
    ]
    summary_table = Table(summary_data, colWidths=[1.9 * inch, 5.1 * inch])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                ("BOX", (0, 0), (-1, -1), 1.0, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # 3B. Multimodal AI Screening Breakdown
    mm = multimodal_summary or {}
    modality_status = mm.get("modality_status") or {}
    if mm or modality_status:
        story.append(Paragraph("Multimodal AI Screening &amp; Modality Breakdown", heading2_style))

        def _fmt_score(val: Any, status_val: Optional[str]) -> str:
            if isinstance(val, (int, float)):
                return f"{round(float(val) * 100)}% ({float(val):.4f})"
            if status_val == "not_requested":
                return "Not requested"
            if status_val == "unavailable":
                return "Unavailable"
            return status_val.replace("_", " ").title() if status_val else "Not recorded"

        fusion_score_str = _fmt_score(mm.get("fusion_score"), mm.get("fusion_status"))
        fusion_method = (mm.get("fusion_method") or "None").replace("_", " ").title()
        disagreement_str = "Detected (clinician review advised)" if mm.get("disagreement_flag") else "No significant divergence"

        mm_rows = [
            [Paragraph("<b>Screening Component</b>", bold_style), Paragraph("<b>Status</b>", bold_style), Paragraph("<b>Score / Outcome</b>", bold_style)],
            [Paragraph("Clinical Numerical Model (46 Features)", body_style), Paragraph(str(modality_status.get("clinical", "not_requested")).replace("_", " ").title(), body_style), Paragraph(_fmt_score(mm.get("clinical_score"), modality_status.get("clinical")), body_style)],
            [Paragraph("Narrative Text Model (TF-IDF + LR)", body_style), Paragraph(str(modality_status.get("text", "not_requested")).replace("_", " ").title(), body_style), Paragraph(_fmt_score(mm.get("text_score"), modality_status.get("text")), body_style)],
            [Paragraph("Acoustic Voice Model", body_style), Paragraph(str(modality_status.get("audio", "not_requested")).replace("_", " ").title(), body_style), Paragraph(_fmt_score(mm.get("audio_score"), modality_status.get("audio")), body_style)],
            [Paragraph("Facial / Video Model", body_style), Paragraph(str(modality_status.get("video", "not_requested")).replace("_", " ").title(), body_style), Paragraph(_fmt_score(mm.get("video_score"), modality_status.get("video")), body_style)],
            [Paragraph(f"Multimodal Fusion ({fusion_method})", bold_style), Paragraph(str(mm.get("fusion_status") or "not_available").replace("_", " ").title(), bold_style), Paragraph(fusion_score_str, bold_style)],
            [Paragraph("Cross-Modal Disagreement", body_style), Paragraph("Checked", body_style), Paragraph(disagreement_str, body_style)],
        ]
        mm_table = Table(mm_rows, colWidths=[2.8 * inch, 1.6 * inch, 2.6 * inch])
        mm_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 7),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(mm_table)
        story.append(Spacer(1, 14))

    # 3C. Clinician Finalized Review & Care Plan
    if clinical_review or care_plan:
        story.append(Paragraph("Clinician Finalized Assessment &amp; Care Plan", heading2_style))
        rev_rows = []
        if clinical_review:
            rev_rows.append([Paragraph("<b>Reviewing Clinician:</b>", body_style), Paragraph(str(clinical_review.get("clinician_name") or "Assigned Clinician"), body_style)])
            if clinical_review.get("final_risk_classification"):
                rev_rows.append([Paragraph("<b>Final Risk Classification:</b>", body_style), Paragraph(str(clinical_review["final_risk_classification"]).title() + " Risk", bold_style)])
            if clinical_review.get("review_status"):
                rev_rows.append([Paragraph("<b>Review Decision:</b>", body_style), Paragraph(str(clinical_review["review_status"]).title(), body_style)])
            if clinical_review.get("clinical_notes"):
                rev_rows.append([Paragraph("<b>Clinician Notes:</b>", body_style), Paragraph(str(clinical_review["clinical_notes"]), body_style)])
        if care_plan:
            focus = str(care_plan.get("intervention_type") or "Supportive Care").replace("_", " ").title()
            priority = str(care_plan.get("priority") or "Routine").title()
            rev_rows.append([Paragraph("<b>Care Focus &amp; Priority:</b>", body_style), Paragraph(f"{focus} ({priority} priority)", body_style)])
            if care_plan.get("scheduled_followup_date"):
                rev_rows.append([Paragraph("<b>Scheduled Follow-up:</b>", body_style), Paragraph(str(care_plan["scheduled_followup_date"]), body_style)])
            if care_plan.get("notes"):
                rev_rows.append([Paragraph("<b>Care Plan Guidance:</b>", body_style), Paragraph(str(care_plan["notes"]), body_style)])

        if rev_rows:
            rev_table = Table(rev_rows, colWidths=[1.9 * inch, 5.1 * inch])
            rev_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff9fb")),
                        ("BOX", (0, 0), (-1, -1), 0.75, border_color),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            story.append(rev_table)
            story.append(Spacer(1, 14))

    # 3D. Maternal Clinical & Psychosocial Context
    if clinical_profile and isinstance(clinical_profile, dict):
        highlight_keys = [
            ("Age", "Maternal Age"),
            ("Residence", "Residence"),
            ("Mode of delivery", "Delivery Mode"),
            ("Feeling about motherhood", "Feeling About Motherhood"),
            ("Relationship with husband", "Partner Relationship"),
            ("Recieved Support", "Support Received"),
            ("Need for Support", "Support Needed"),
            ("Depression before pregnancy (PHQ2)", "Pre-Pregnancy Depression"),
        ]
        profile_rows = [
            [Paragraph(f"<b>{label}:</b>", body_style), Paragraph(str(clinical_profile[k]), body_style)]
            for k, label in highlight_keys
            if k in clinical_profile and clinical_profile[k] not in (None, "", "Missing")
        ]
        if profile_rows:
            story.append(Paragraph("Maternal Clinical &amp; Psychosocial Context", heading2_style))
            prof_table = Table(profile_rows, colWidths=[2.2 * inch, 4.8 * inch])
            prof_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            story.append(prof_table)
            story.append(Spacer(1, 14))

    # 4. Item Breakdown
    story.append(Paragraph("EPDS 10-Item Response Breakdown", heading2_style))

    # Default questions text if not provided
    default_q_texts = {
        "epds_1": "I have been able to laugh and see the funny side of things",
        "epds_2": "I have looked forward with enjoyment to things",
        "epds_3": "I have blamed myself unnecessarily when things went wrong",
        "epds_4": "I have been anxious or worried for no good reason",
        "epds_5": "I have felt scared or panicky for no very good reason",
        "epds_6": "Things have been getting on top of me",
        "epds_7": "I have been so unhappy that I have had difficulty sleeping",
        "epds_8": "I have felt sad or miserable",
        "epds_9": "I have been so unhappy that I have been crying",
        "epds_10": "The thought of harming myself has occurred to me",
    }
    q_map = {}
    if questions:
        for q in questions:
            q_map[q.get("id")] = q.get("question")

    rows = [[
        Paragraph("<b>#</b>", bold_style),
        Paragraph("<b>Question</b>", bold_style),
        Paragraph("<b>Response Recorded</b>", bold_style),
        Paragraph("<b>Score</b>", bold_style),
    ]]

    for i in range(1, 11):
        qid_legacy = f"epds_{i}"
        qid_canonical = f"EPDS_Q{i:02d}"
        q_text = q_map.get(qid_canonical) or q_map.get(qid_legacy) or default_q_texts.get(qid_legacy, f"EPDS Question {i}")
        score_val = item_scores.get(qid_canonical, item_scores.get(qid_legacy, 0))

        # Submitted answer details
        ans_info = submitted_answers.get(qid_canonical) or submitted_answers.get(qid_legacy) or {}
        if isinstance(ans_info, dict):
            raw_text = ans_info.get("raw_response") or f"Option index {ans_info.get('selected_index', 0)}"
        else:
            raw_text = str(ans_info)

        score_para = alert_style if (i == 10 and score_val > 0) else body_style
        rows.append([
            Paragraph(str(i), body_style),
            Paragraph(q_text, body_style),
            Paragraph(raw_text, body_style),
            Paragraph(f"{score_val} / 3", score_para),
        ])

    breakdown_table = Table(rows, colWidths=[0.35 * inch, 3.45 * inch, 2.4 * inch, 0.8 * inch])
    breakdown_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(breakdown_table)
    story.append(Spacer(1, 14))

    # 5. Clinical Recommendations & Disclaimer
    if notes:
        story.append(Paragraph("Clinical Session Notes", heading2_style))
        story.append(Paragraph(notes, body_style))
        story.append(Spacer(1, 10))

    disclaimer_text = (
        "<b>Notice & Confidentiality:</b> This document contains confidential medical information intended exclusively "
        "for the named patient and designated clinical healthcare team. The Edinburgh Postnatal Depression Scale (EPDS) "
        "is a clinical screening aid and does not constitute a standalone diagnostic evaluation. If you are experiencing "
        "severe distress, contact Tele-MANAS (14416 / 1800 891 4416) or national emergency services immediately."
    )
    story.append(Paragraph(disclaimer_text, subtitle_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
