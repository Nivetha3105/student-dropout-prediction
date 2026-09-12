"""
app/ai.py — GenAI Query Assistant routes
"""
import os
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import google.generativeai as genai
from sqlalchemy import func

from app import db
from app.models import Student, Prediction

ai_bp = Blueprint("ai", __name__)

@ai_bp.route("/query", methods=["POST"])
@jwt_required()
def query_assistant():
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY is not configured on the server."}), 503

    genai.configure(api_key=GEMINI_API_KEY)

    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' field."}), 400

    user_query = data["query"]

    try:
        # 1. Gather context from DB
        # Get total students
        total_students = Student.query.count()
        
        # Get risk distribution
        latest_pred_subq = (
            db.session.query(
                Prediction.student_id,
                func.max(Prediction.predicted_at).label("max_at"),
            )
            .group_by(Prediction.student_id)
            .subquery()
        )
        
        risk_dist_query = (
            db.session.query(Prediction.risk_level, func.count(Prediction.id))
            .join(
                latest_pred_subq,
                (Prediction.student_id == latest_pred_subq.c.student_id) &
                (Prediction.predicted_at == latest_pred_subq.c.max_at),
            )
            .group_by(Prediction.risk_level)
            .all()
        )
        risk_dist = {row[0]: row[1] for row in risk_dist_query}

        # Get recent High risk students
        high_risk_query = (
            db.session.query(Student.name, Student.department, Student.year, Prediction.risk_score)
            .join(Prediction, Student.id == Prediction.student_id)
            .join(
                latest_pred_subq,
                (Prediction.student_id == latest_pred_subq.c.student_id) &
                (Prediction.predicted_at == latest_pred_subq.c.max_at),
            )
            .filter(Prediction.risk_level == "High")
            .order_by(Prediction.risk_score.desc())
            .limit(10)
            .all()
        )
        high_risk_students = [
            {"name": r[0], "department": r[1], "year": r[2], "risk_score": r[3]}
            for r in high_risk_query
        ]

        # Get department distribution
        dept_dist_query = (
            db.session.query(Student.department, func.count(Student.id))
            .group_by(Student.department)
            .all()
        )
        dept_dist = {row[0]: row[1] for row in dept_dist_query}

        context = {
            "total_students": total_students,
            "risk_distribution": risk_dist,
            "department_distribution": dept_dist,
            "top_high_risk_students": high_risk_students,
        }

        # 2. Prepare the prompt for Gemini
        system_instruction = (
            "You are an AI assistant for a student dropout prediction system. "
            "Your goal is to answer questions from faculty members about the current student data. "
            "Use the provided JSON context representing the current database state to answer accurately. "
            "If the answer is not available in the context, politely inform the user that you don't have that specific data. "
            "Keep your answers concise, professional, and well-formatted."
        )
        
        prompt = (
            f"{system_instruction}\n\n"
            f"=== CURRENT DATABASE CONTEXT ===\n"
            f"{json.dumps(context, indent=2)}\n\n"
            f"=== USER QUERY ===\n"
            f"{user_query}"
        )

        # 3. Call Gemini API
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        return jsonify({"response": response.text}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate AI response: {str(e)}"}), 500
