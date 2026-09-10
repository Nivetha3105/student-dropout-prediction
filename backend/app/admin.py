"""
app/admin.py — Admin-only routes: user management, model retraining, audit log
"""
import os
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, AuditLog

admin_bp = Blueprint("admin", __name__)


def require_admin():
    current_id = int(get_jwt_identity())
    user = User.query.get_or_404(current_id)
    if user.role != "admin":
        return None, jsonify({"error": "Admin access required"}), 403
    return user, None, None


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    user, err, code = require_admin()
    if err:
        return err, code

    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def deactivate_user(user_id):
    user, err, code = require_admin()
    if err:
        return err, code

    target = User.query.get_or_404(user_id)
    if target.id == int(get_jwt_identity()):
        return jsonify({"error": "Cannot deactivate yourself"}), 400

    target.is_active = False
    db.session.add(AuditLog(
        user_id=int(get_jwt_identity()),
        action=f"DEACTIVATE_USER: {target.email}",
        entity_type="user",
        entity_id=user_id,
        ip_address=request.remote_addr,
    ))
    db.session.commit()
    return jsonify({"message": f"User {target.email} deactivated"}), 200


@admin_bp.route("/retrain", methods=["POST"])
@jwt_required()
def retrain_model():
    """
    Admin uploads a new CSV and triggers model retraining.
    The new model replaces the existing one.
    """
    user, err, code = require_admin()
    if err:
        return err, code

    import pandas as pd
    import subprocess
    import sys

    if "file" in request.files:
        f = request.files["file"]
        if not f.filename.endswith(".csv"):
            return jsonify({"error": "Only CSV files are accepted"}), 400

        import io
        content = f.read().decode("utf-8-sig")
        df = pd.read_csv(io.StringIO(content))

        models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
        os.makedirs(models_dir, exist_ok=True)
        df.to_csv(os.path.join(models_dir, "students_data.csv"), index=False)

    # Re-run training script
    train_script = os.path.join(os.path.dirname(__file__), "..", "ml", "train_model.py")
    backend_dir = os.path.join(os.path.dirname(__file__), "..")

    try:
        result = subprocess.run(
            [sys.executable, train_script],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            return jsonify({"error": "Training failed", "details": result.stderr}), 500

        # Reload model in current process
        from ml.predict import load_model
        load_model()

        # Read metrics
        metrics_path = os.path.join(os.path.dirname(__file__), "..", "models", "model_metrics.json")
        metrics = {}
        if os.path.exists(metrics_path):
            with open(metrics_path) as mf:
                metrics = json.load(mf)

        db.session.add(AuditLog(
            user_id=int(get_jwt_identity()),
            action="MODEL_RETRAIN",
            entity_type="model",
            ip_address=request.remote_addr,
        ))
        db.session.commit()

        return jsonify({
            "message": "Model retrained successfully",
            "metrics": metrics,
            "output": result.stdout[-2000:],  # last 2000 chars of output
        }), 200

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Training timed out (>5 minutes)"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/audit-log", methods=["GET"])
@jwt_required()
def audit_log():
    user, err, code = require_admin()
    if err:
        return err, code

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    entity_type = request.args.get("entity_type")

    query = AuditLog.query
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    query = query.order_by(AuditLog.timestamp.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "logs": [l.to_dict() for l in paginated.items],
        "total": paginated.total,
        "page": page,
        "pages": paginated.pages,
    }), 200


@admin_bp.route("/model-metrics", methods=["GET"])
@jwt_required()
def model_metrics():
    metrics_path = os.path.join(os.path.dirname(__file__), "..", "models", "model_metrics.json")
    if not os.path.exists(metrics_path):
        return jsonify({"error": "No model metrics found. Train the model first."}), 404
    with open(metrics_path) as f:
        metrics = json.load(f)
    return jsonify(metrics), 200
