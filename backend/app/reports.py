"""
app/reports.py — PDF report generation per student using ReportLab
"""
import json
import os
from datetime import datetime
from flask import Blueprint, Response
from flask_jwt_extended import jwt_required
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
from app.models import Student

reports_bp = Blueprint("reports", __name__)

RISK_COLORS = {
    "High": colors.HexColor("#EF4444"),
    "Medium": colors.HexColor("#F59E0B"),
    "Low": colors.HexColor("#22C55E"),
    "Unknown": colors.HexColor("#6B7280"),
}


@reports_bp.route("/<int:student_id>/pdf", methods=["GET"])
@jwt_required()
def generate_pdf(student_id):
    student = Student.query.get_or_404(student_id)
    latest_pred = student.predictions.first()
    interventions = list(student.interventions.limit(10))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header ────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"],
        fontSize=22, textColor=colors.HexColor("#1E293B"),
        spaceAfter=6,
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"],
        fontSize=11, textColor=colors.HexColor("#64748B"),
        spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "Label", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#94A3B8"),
        fontName="Helvetica",
    )
    value_style = ParagraphStyle(
        "Value", parent=styles["Normal"],
        fontSize=11, textColor=colors.HexColor("#1E293B"),
        fontName="Helvetica-Bold",
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#334155"),
        fontName="Helvetica-Bold",
        spaceBefore=16, spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#475569"),
        leading=16,
    )

    story.append(Paragraph("Student Risk Assessment Report", title_style))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}",
        sub_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 0.4 * cm))

    # ── Student Info ───────────────────────────────────────────
    story.append(Paragraph("Student Information", section_style))

    info_data = [
        [Paragraph("Name", label_style), Paragraph(student.name, value_style),
         Paragraph("Roll Number", label_style), Paragraph(student.roll_number, value_style)],
        [Paragraph("Department", label_style), Paragraph(student.department, value_style),
         Paragraph("Year", label_style), Paragraph(str(student.year), value_style)],
        [Paragraph("Attendance", label_style), Paragraph(f"{student.attendance_pct:.1f}%", value_style),
         Paragraph("Backlogs", label_style), Paragraph(str(student.backlogs), value_style)],
        [Paragraph("Fee Delay", label_style), Paragraph(f"{student.fee_delay_days} days", value_style),
         Paragraph("Income Bracket", label_style), Paragraph(student.family_income_bracket.title(), value_style)],
    ]

    info_table = Table(info_data, colWidths=[3 * cm, 5.5 * cm, 3.5 * cm, 5.5 * cm])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.4 * cm))

    # ── Risk Assessment ────────────────────────────────────────
    story.append(Paragraph("Risk Assessment", section_style))

    if latest_pred:
        risk_level = latest_pred.risk_level
        risk_color = RISK_COLORS.get(risk_level, colors.gray)

        risk_data = [
            [
                Paragraph(f"Risk Level: {risk_level}", ParagraphStyle(
                    "RiskLevel", parent=styles["Normal"],
                    fontSize=16, textColor=risk_color, fontName="Helvetica-Bold"
                )),
                Paragraph(f"Risk Score: {latest_pred.risk_score:.0f}/100", ParagraphStyle(
                    "RiskScore", parent=styles["Normal"],
                    fontSize=14, textColor=colors.HexColor("#1E293B"), fontName="Helvetica-Bold"
                )),
                Paragraph(
                    f"Assessed: {latest_pred.predicted_at.strftime('%d %b %Y') if latest_pred.predicted_at else 'N/A'}",
                    body_style
                ),
            ]
        ]
        risk_table = Table(risk_data, colWidths=[6 * cm, 5 * cm, 6.5 * cm])
        risk_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("BOX", (0, 0), (-1, -1), 1.5, risk_color),
            ("ROUNDEDCORNERS", [4]),
        ]))
        story.append(risk_table)
        story.append(Spacer(1, 0.3 * cm))

        # Top Factors
        top_factors = latest_pred.top_factors
        if top_factors:
            story.append(Paragraph("Key Risk Factors", ParagraphStyle(
                "KRF", parent=styles["Heading3"],
                fontSize=11, textColor=colors.HexColor("#475569"),
                spaceBefore=10, spaceAfter=6,
            )))
            for i, factor in enumerate(top_factors, 1):
                impact_color = colors.HexColor("#EF4444") if factor.get("impact") == "increases_risk" else colors.HexColor("#22C55E")
                factor_text = f"{i}. {factor.get('explanation', factor.get('display_name', ''))}"
                story.append(Paragraph(f"● {factor_text}", ParagraphStyle(
                    f"Factor{i}", parent=styles["Normal"],
                    fontSize=10, textColor=colors.HexColor("#334155"),
                    leftIndent=12, spaceAfter=4,
                )))
    else:
        story.append(Paragraph("No prediction has been run for this student yet.", body_style))

    story.append(Spacer(1, 0.4 * cm))

    # ── Intervention History ───────────────────────────────────
    story.append(Paragraph("Intervention History", section_style))

    if interventions:
        int_headers = [
            Paragraph("Date", label_style),
            Paragraph("Action", label_style),
            Paragraph("Faculty", label_style),
            Paragraph("Outcome", label_style),
        ]
        int_data = [int_headers]
        for iv in interventions:
            outcome_color = {
                "improved": colors.HexColor("#22C55E"),
                "dropped": colors.HexColor("#EF4444"),
                "no_change": colors.HexColor("#F59E0B"),
                "pending": colors.HexColor("#6B7280"),
            }.get(iv.outcome_status, colors.HexColor("#6B7280"))

            int_data.append([
                Paragraph(iv.date.strftime("%d %b %Y") if iv.date else "—", body_style),
                Paragraph(iv.action_taken, body_style),
                Paragraph(iv.faculty.name if iv.faculty else "—", body_style),
                Paragraph(iv.outcome_status.title(), ParagraphStyle(
                    "OutcomeCell", parent=styles["Normal"],
                    fontSize=10, textColor=outcome_color, fontName="Helvetica-Bold"
                )),
            ])

        int_table = Table(int_data, colWidths=[3 * cm, 6 * cm, 4.5 * cm, 4 * cm])
        int_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ]))
        story.append(int_table)
    else:
        story.append(Paragraph("No interventions recorded for this student.", body_style))

    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "This report is generated automatically by the Dropout Prediction System. "
        "It is intended for faculty use only and should be treated as confidential.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                       textColor=colors.HexColor("#94A3B8"), alignment=TA_CENTER)
    ))

    doc.build(story)
    buffer.seek(0)

    filename = f"risk_report_{student.roll_number}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        buffer.getvalue(),
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@reports_bp.route("/high-risk/pdf", methods=["GET"])
@jwt_required()
def generate_high_risk_pdf():
    from app import db
    from app.models import Prediction
    from sqlalchemy import func

    latest_pred_subq = (
        db.session.query(
            Prediction.student_id,
            func.max(Prediction.predicted_at).label("max_at"),
        )
        .group_by(Prediction.student_id)
        .subquery()
    )

    high_risk_students = (
        Student.query.join(Prediction, Student.id == Prediction.student_id)
        .join(
            latest_pred_subq,
            (Prediction.student_id == latest_pred_subq.c.student_id) &
            (Prediction.predicted_at == latest_pred_subq.c.max_at),
        )
        .filter(Prediction.risk_level == "High")
        .order_by(Prediction.risk_score.desc())
        .all()
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        "Title", parent=styles["Title"],
        fontSize=22, textColor=colors.HexColor("#1E293B"),
        spaceAfter=6,
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"],
        fontSize=11, textColor=colors.HexColor("#64748B"),
        spaceAfter=12,
    )
    label_style = ParagraphStyle(
        "Label", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#94A3B8"),
        fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#334155"),
    )

    story.append(Paragraph("High-Risk Students Report", title_style))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')} | Total High-Risk Students: {len(high_risk_students)}",
        sub_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 0.4 * cm))

    if high_risk_students:
        table_data = [[
            Paragraph("Name", label_style),
            Paragraph("Roll No", label_style),
            Paragraph("Dept", label_style),
            Paragraph("Score", label_style),
            Paragraph("Top Factors", label_style)
        ]]

        for s in high_risk_students:
            lp = s.latest_prediction
            factors = "; ".join([f["display_name"] for f in lp.top_factors]) if lp.top_factors else ""
            table_data.append([
                Paragraph(s.name, body_style),
                Paragraph(s.roll_number, body_style),
                Paragraph(s.department, body_style),
                Paragraph(f"{lp.risk_score:.0f}", body_style),
                Paragraph(factors, body_style),
            ])

        table = Table(table_data, colWidths=[4*cm, 2.5*cm, 2*cm, 2*cm, 6.5*cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No high-risk students found.", body_style))

    doc.build(story)
    buffer.seek(0)

    filename = f"high_risk_report_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        buffer.getvalue(),
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
