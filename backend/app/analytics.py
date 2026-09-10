"""
app/analytics.py — Summary statistics and trend data for the Analytics page
"""
from collections import defaultdict
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from app import db
from app.models import Student, Prediction, Intervention

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/summary", methods=["GET"])
@jwt_required()
def summary():
    total_students = Student.query.count()

    # Risk distribution from latest predictions
    risk_counts = {"High": 0, "Medium": 0, "Low": 0, "Unknown": 0}

    # Subquery: latest prediction per student
    latest_pred_subq = (
        db.session.query(
            Prediction.student_id,
            func.max(Prediction.predicted_at).label("max_at"),
        )
        .group_by(Prediction.student_id)
        .subquery()
    )
    latest_preds = (
        db.session.query(Prediction)
        .join(
            latest_pred_subq,
            (Prediction.student_id == latest_pred_subq.c.student_id) &
            (Prediction.predicted_at == latest_pred_subq.c.max_at),
        )
        .all()
    )

    predicted_ids = set()
    for p in latest_preds:
        risk_counts[p.risk_level] = risk_counts.get(p.risk_level, 0) + 1
        predicted_ids.add(p.student_id)
    risk_counts["Unknown"] = total_students - len(predicted_ids)

    # Interventions this month
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    interventions_this_month = Intervention.query.filter(
        Intervention.date >= month_start
    ).count()

    # Intervention success rate
    total_interventions = Intervention.query.count()
    successful = Intervention.query.filter_by(outcome_status="improved").count()
    success_rate = round((successful / total_interventions * 100), 1) if total_interventions > 0 else 0

    # Department-wise risk breakdown
    dept_risk = defaultdict(lambda: {"High": 0, "Medium": 0, "Low": 0})
    for p in latest_preds:
        student = Student.query.get(p.student_id)
        if student:
            dept_risk[student.department][p.risk_level] += 1

    dept_breakdown = [
        {
            "department": dept,
            "High": vals["High"],
            "Medium": vals["Medium"],
            "Low": vals["Low"],
            "total": vals["High"] + vals["Medium"] + vals["Low"],
        }
        for dept, vals in dept_risk.items()
    ]
    dept_breakdown.sort(key=lambda x: x["total"], reverse=True)

    # Intervention by action type and outcome
    action_outcomes = (
        db.session.query(
            Intervention.action_taken,
            Intervention.outcome_status,
            func.count(Intervention.id).label("count"),
        )
        .group_by(Intervention.action_taken, Intervention.outcome_status)
        .all()
    )
    action_summary = defaultdict(lambda: {"pending": 0, "improved": 0, "no_change": 0, "dropped": 0})
    for action, outcome, count in action_outcomes:
        action_summary[action][outcome] = count

    action_chart = [
        {
            "action": action,
            **vals,
            "total": sum(vals.values()),
        }
        for action, vals in action_summary.items()
    ]
    action_chart.sort(key=lambda x: x["total"], reverse=True)

    # Prediction trend over time (last 6 months)
    trend_data = []
    for i in range(5, -1, -1):
        month_date = now.replace(day=1) - timedelta(days=30 * i)
        m_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            next_month = month_date.replace(day=28) + timedelta(days=4)
            m_end = next_month.replace(day=1)
        else:
            m_end = now

        counts = {"High": 0, "Medium": 0, "Low": 0}
        preds = Prediction.query.filter(
            Prediction.predicted_at >= m_start,
            Prediction.predicted_at < m_end,
        ).all()
        for p in preds:
            counts[p.risk_level] = counts.get(p.risk_level, 0) + 1

        trend_data.append({
            "month": m_start.strftime("%b %Y"),
            **counts,
        })

    # Year-wise distribution
    year_dist = (
        db.session.query(Student.year, func.count(Student.id))
        .group_by(Student.year)
        .order_by(Student.year)
        .all()
    )

    return jsonify({
        "total_students": total_students,
        "risk_distribution": risk_counts,
        "interventions_this_month": interventions_this_month,
        "total_interventions": total_interventions,
        "success_rate": success_rate,
        "department_breakdown": dept_breakdown,
        "intervention_by_action": action_chart,
        "prediction_trend": trend_data,
        "year_distribution": [{"year": y, "count": c} for y, c in year_dist],
    }), 200
