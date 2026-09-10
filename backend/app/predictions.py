"""
app/predictions.py — ML prediction routes
"""
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Student, Prediction, User, AuditLog, Notification

predictions_bp = Blueprint("predictions", __name__)


def log_action(user_id, action, entity_type=None, entity_id=None, details=None):
    entry = AuditLog(
        user_id=user_id, action=action,
        entity_type=entity_type, entity_id=entity_id,
        details=details, ip_address=request.remote_addr,
    )
    db.session.add(entry)


def _notify_high_risk(student, result, all_faculty):
    """Create in-app notifications for all faculty when a student goes High risk."""
    for faculty in all_faculty:
        notif = Notification(
            user_id=faculty.id,
            title=f"⚠️ High Risk Alert: {student.name}",
            message=(
                f"{student.name} ({student.roll_number}) has been classified as HIGH RISK "
                f"(score: {result['risk_score']:.0f}/100). "
                f"Immediate intervention recommended."
            ),
            type="danger",
            related_student_id=student.id,
        )
        db.session.add(notif)


@predictions_bp.route("/<int:student_id>", methods=["POST"])
@jwt_required()
def predict_student(student_id):
    current_id = int(get_jwt_identity())
    student = Student.query.get_or_404(student_id)

    from ml.predict import predict_student as ml_predict
    result = ml_predict(student.to_feature_dict())

    # Check if risk level changed to High (notify)
    previous = student.predictions.first()
    prev_level = previous.risk_level if previous else None

    prediction = Prediction(
        student_id=student.id,
        risk_level=result["risk_level"],
        risk_score=result["risk_score"],
        top_factors_json=json.dumps(result["top_factors"]),
        probabilities_json=json.dumps(result.get("probabilities", {})),
        triggered_by="manual",
    )
    db.session.add(prediction)

    # Fire notification if newly High risk
    if result["risk_level"] == "High" and prev_level != "High":
        faculty_list = User.query.filter(
            User.role.in_(["admin", "faculty"]),
            User.is_active == True
        ).all()
        _notify_high_risk(student, result, faculty_list)

    log_action(current_id, f"PREDICT: {student.roll_number} → {result['risk_level']}", "prediction", student.id)
    db.session.commit()

    return jsonify({
        "message": "Prediction complete",
        "prediction": prediction.to_dict(),
        "student": student.to_dict(include_latest=False),
    }), 200


@predictions_bp.route("/batch", methods=["POST"])
@jwt_required()
def predict_batch():
    current_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_id)

    data = request.get_json() or {}
    student_ids = data.get("student_ids")  # Optional: specific IDs, else all

    if student_ids:
        students = Student.query.filter(Student.id.in_(student_ids)).all()
    else:
        students = Student.query.all()

    from ml.predict import predict_student as ml_predict
    results = []
    errors = []

    faculty_list = User.query.filter(
        User.role.in_(["admin", "faculty"]),
        User.is_active == True
    ).all()

    for student in students:
        try:
            result = ml_predict(student.to_feature_dict())
            previous = student.predictions.first()
            prev_level = previous.risk_level if previous else None

            prediction = Prediction(
                student_id=student.id,
                risk_level=result["risk_level"],
                risk_score=result["risk_score"],
                top_factors_json=json.dumps(result["top_factors"]),
                probabilities_json=json.dumps(result.get("probabilities", {})),
                triggered_by="batch",
            )
            db.session.add(prediction)

            if result["risk_level"] == "High" and prev_level != "High":
                _notify_high_risk(student, result, faculty_list)

            results.append({
                "student_id": student.id,
                "student_name": student.name,
                "risk_level": result["risk_level"],
                "risk_score": result["risk_score"],
            })
        except Exception as e:
            errors.append({"student_id": student.id, "error": str(e)})

    log_action(current_id, f"BATCH_PREDICT: {len(results)} students", "prediction")
    db.session.commit()

    return jsonify({
        "message": f"Batch complete: {len(results)} predictions, {len(errors)} errors",
        "results": results,
        "errors": errors,
    }), 200
