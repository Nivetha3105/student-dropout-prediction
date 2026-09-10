"""
app/interventions.py — Intervention logging and outcome tracking
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Intervention, Student, User, AuditLog

interventions_bp = Blueprint("interventions", __name__)

VALID_OUTCOMES = {"pending", "improved", "no_change", "dropped"}
VALID_ACTIONS = {
    "Counseling Session",
    "Academic Support",
    "Fee Waiver / Extension",
    "Family Contact",
    "Attendance Warning",
    "Mentorship Assignment",
    "Medical Referral",
    "Scholarship Assistance",
    "Other",
}


def log_action(user_id, action, entity_type=None, entity_id=None, details=None):
    entry = AuditLog(
        user_id=user_id, action=action,
        entity_type=entity_type, entity_id=entity_id,
        details=details, ip_address=request.remote_addr,
    )
    db.session.add(entry)


@interventions_bp.route("", methods=["GET"])
@jwt_required()
def list_interventions():
    student_id = request.args.get("student_id", type=int)
    outcome = request.args.get("outcome")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = Intervention.query
    if student_id:
        query = query.filter_by(student_id=student_id)
    if outcome:
        query = query.filter_by(outcome_status=outcome)

    query = query.order_by(Intervention.date.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "interventions": [i.to_dict() for i in paginated.items],
        "total": paginated.total,
        "page": page,
        "pages": paginated.pages,
    }), 200


@interventions_bp.route("", methods=["POST"])
@jwt_required()
def create_intervention():
    current_id = int(get_jwt_identity())
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["student_id", "action_taken"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"Missing field: {f}"}), 400

    student = Student.query.get_or_404(data["student_id"])

    follow_up = None
    if data.get("follow_up_date"):
        try:
            follow_up = datetime.fromisoformat(data["follow_up_date"])
        except (ValueError, TypeError):
            follow_up = None

    intervention = Intervention(
        student_id=student.id,
        faculty_id=current_id,
        action_taken=data["action_taken"],
        notes=data.get("notes", ""),
        outcome_status=data.get("outcome_status", "pending"),
        follow_up_date=follow_up,
    )
    db.session.add(intervention)
    db.session.flush()
    log_action(current_id, f"LOG_INTERVENTION: {student.roll_number} — {data['action_taken']}", "intervention", intervention.id)
    db.session.commit()

    return jsonify({
        "message": "Intervention logged",
        "intervention": intervention.to_dict(),
    }), 201


@interventions_bp.route("/<int:intervention_id>", methods=["PATCH"])
@jwt_required()
def update_intervention(intervention_id):
    current_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_id)
    intervention = Intervention.query.get_or_404(intervention_id)

    # Only the creating faculty or admin can update
    if intervention.faculty_id != current_id and current_user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}

    if "outcome_status" in data:
        if data["outcome_status"] not in VALID_OUTCOMES:
            return jsonify({"error": f"Invalid outcome. Must be one of: {VALID_OUTCOMES}"}), 400
        intervention.outcome_status = data["outcome_status"]

    if "notes" in data:
        intervention.notes = data["notes"]
    if "action_taken" in data:
        intervention.action_taken = data["action_taken"]
    if "follow_up_date" in data:
        try:
            intervention.follow_up_date = datetime.fromisoformat(data["follow_up_date"])
        except (ValueError, TypeError):
            pass

    log_action(current_id, f"UPDATE_INTERVENTION: {intervention_id} → {intervention.outcome_status}", "intervention", intervention_id)
    db.session.commit()

    return jsonify({"message": "Intervention updated", "intervention": intervention.to_dict()}), 200


@interventions_bp.route("/<int:intervention_id>", methods=["DELETE"])
@jwt_required()
def delete_intervention(intervention_id):
    current_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_id)
    intervention = Intervention.query.get_or_404(intervention_id)

    if intervention.faculty_id != current_id and current_user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    db.session.delete(intervention)
    log_action(current_id, f"DELETE_INTERVENTION: {intervention_id}", "intervention", intervention_id)
    db.session.commit()
    return jsonify({"message": "Intervention deleted"}), 200
