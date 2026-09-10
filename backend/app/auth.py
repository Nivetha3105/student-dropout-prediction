"""
app/auth.py — Authentication routes
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from app import db
from app.models import User, AuditLog

auth_bp = Blueprint("auth", __name__)


def log_action(user_id, action, entity_type=None, entity_id=None, details=None):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email, is_active=True).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user.id))
    log_action(user.id, "LOGIN")
    db.session.commit()

    return jsonify({
        "token": token,
        "user": user.to_dict(),
    }), 200


@auth_bp.route("/register", methods=["POST"])
@jwt_required()
def register():
    """Admin-only: create a new faculty or admin account."""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_user_id)

    if current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    required = ["name", "email", "password", "role"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing field: {field}"}), 400

    if User.query.filter_by(email=data["email"].lower()).first():
        return jsonify({"error": "Email already registered"}), 409

    if data["role"] not in ("admin", "faculty", "student"):
        return jsonify({"error": "Invalid role"}), 400

    user = User(
        name=data["name"],
        email=data["email"].strip().lower(),
        role=data["role"],
        department=data.get("department"),
    )
    user.set_password(data["password"])
    db.session.add(user)

    log_action(current_user_id, f"CREATE_USER: {data['email']}", "user")
    db.session.commit()

    return jsonify({"message": "User created", "user": user.to_dict()}), 201


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


@auth_bp.route("/users/<int:user_id>", methods=["PATCH"])
@jwt_required()
def update_user(user_id):
    current_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_id)
    target_user = User.query.get_or_404(user_id)

    # Can update own profile, or admin can update anyone
    if current_id != user_id and current_user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    if "name" in data:
        target_user.name = data["name"]
    if "department" in data:
        target_user.department = data["department"]
    if "is_active" in data and current_user.role == "admin":
        target_user.is_active = bool(data["is_active"])
    if "password" in data:
        target_user.set_password(data["password"])

    log_action(current_id, f"UPDATE_USER: {target_user.email}", "user", user_id)
    db.session.commit()

    return jsonify({"message": "Updated", "user": target_user.to_dict()}), 200
