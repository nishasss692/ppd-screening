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
    multimodal_scores: Optional[Dict[str, Any]] = None,
    clinical_prediction: Optional[Dict[str, Any]] = None,
    discordance_flag: bool = False,
) -> bytes:
    """Generate a clinical PDF report for an EPDS screening session and return bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
        title="AANCHAL Maternal Emotional Intelligence Screening Report",
        author="AANCHAL Clinical System",
        pageCompression=0,
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
    story.append(Paragraph("Clinical Screening Report · Edinburgh Postnatal Depression Scale (EPDS)", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_color, spaceAfter=14))

    # 2. Patient & Session Meta Table
    formatted_date = screening_date.strftime("%d %B %Y at %I:%M %p UTC")
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
            Paragraph("<b>Instrument:</b>", body_style),
            Paragraph("10-Item EPDS (Canonical)", body_style),
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

    # 3b. AI Multimodal & Combined Risk Assessment (when available)
    mm = multimodal_scores if isinstance(multimodal_scores, dict) else {}
    cp = clinical_prediction if isinstance(clinical_prediction, dict) else {}
    if mm or cp or discordance_flag:
        story.append(Paragraph("AI Multimodal & Combined Risk Assessment", heading2_style))
        mm_rows = []
        text_score = mm.get("text_risk") or mm.get("text") or mm.get("text_score")
        voice_score = mm.get("voice_risk") or mm.get("audio_risk") or mm.get("voice") or mm.get("audio")
        video_score = mm.get("video_risk") or mm.get("video")
        combined_prob = cp.get("predicted_risk_probability") or mm.get("combined_risk") or mm.get("fusion_score")
        combined_tier = cp.get("predicted_risk_label") or cp.get("risk_level") or risk_label
        disc_score = mm.get("discordance_score")
        disc_level = mm.get("discordance_level") or ("Notable Difference" if discordance_flag else "Aligned")

        if text_score is not None:
            mm_rows.append([Paragraph("<b>Narrative / Text Risk:</b>", body_style), Paragraph(f"{float(text_score):.2f}" if isinstance(text_score, (int, float)) else str(text_score), body_style)])
        if voice_score is not None:
            mm_rows.append([Paragraph("<b>Voice / Acoustic Risk:</b>", body_style), Paragraph(f"{float(voice_score):.2f}" if isinstance(voice_score, (int, float)) else str(voice_score), body_style)])
        if video_score is not None:
            mm_rows.append([Paragraph("<b>Facial / Video Risk:</b>", body_style), Paragraph(f"{float(video_score):.2f}" if isinstance(video_score, (int, float)) else str(video_score), body_style)])
        if combined_prob is not None:
            pct = f"{float(combined_prob) * 100:.1f}%" if isinstance(combined_prob, (int, float)) and float(combined_prob) <= 1.0 else f"{combined_prob}"
            mm_rows.append([Paragraph("<b>Combined Risk Assessment:</b>", body_style), Paragraph(f"{combined_tier} ({pct})", bold_style)])
        else:
            mm_rows.append([Paragraph("<b>Combined Risk Assessment:</b>", body_style), Paragraph(f"{risk_label} Risk", bold_style)])

        disc_text = f"{disc_level}" + (f" (Score: {float(disc_score):.2f})" if isinstance(disc_score, (int, float)) else "")
        mm_rows.append([Paragraph("<b>Modality Discordance:</b>", body_style), Paragraph(disc_text, body_style)])

        mm_table = Table(mm_rows, colWidths=[2.1 * inch, 4.9 * inch])
        mm_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#e2e8f0")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(mm_table)
        story.append(Spacer(1, 14))

    # 4. Item Breakdown
    story.append(Paragraph("Item Response Breakdown", heading2_style))

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
        qid = f"epds_{i}"
        q_text = q_map.get(qid) or default_q_texts.get(qid, f"EPDS Question {i}")
        score_val = item_scores.get(qid, 0)

        # Submitted answer details
        ans_info = submitted_answers.get(qid, {})
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
