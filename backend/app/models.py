"""
app/models.py — SQLAlchemy ORM models
Structured for easy migration from SQLite to PostgreSQL
"""
import json
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─────────────────────────────────────────
# User / Auth
# ─────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="faculty")  # admin / faculty / student
    department = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=utcnow)
    is_active = db.Column(db.Boolean, default=True)

    interventions = db.relationship("Intervention", back_populates="faculty", lazy="dynamic")
    audit_logs = db.relationship("AuditLog", back_populates="user", lazy="dynamic")
    notifications = db.relationship("Notification", back_populates="user", lazy="dynamic")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_active": self.is_active,
        }


# ─────────────────────────────────────────
# Students
# ─────────────────────────────────────────
class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    roll_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(200), unique=True)
    department = db.Column(db.String(80), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    attendance_pct = db.Column(db.Float, default=75.0)
    backlogs = db.Column(db.Integer, default=0)
    grade_trend = db.Column(db.Float, default=0.0)  # -2 to +2
    fee_delay_days = db.Column(db.Integer, default=0)
    family_income_bracket = db.Column(db.String(10), default="mid")  # low/mid/high
    extracurricular = db.Column(db.Boolean, default=True)
    attendance_trend_3m = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    created_at = db.Column(db.DateTime, default=utcnow)

    predictions = db.relationship("Prediction", back_populates="student",
                                   lazy="dynamic", order_by="Prediction.predicted_at.desc()",
                                   cascade="all, delete-orphan")
    interventions = db.relationship("Intervention", back_populates="student",
                                    lazy="dynamic", order_by="Intervention.date.desc()",
                                    cascade="all, delete-orphan")

    @property
    def latest_prediction(self):
        return self.predictions.first()

    def to_dict(self, include_latest=True):
        d = {
            "id": self.id,
            "name": self.name,
            "roll_number": self.roll_number,
            "email": self.email,
            "department": self.department,
            "year": self.year,
            "attendance_pct": self.attendance_pct,
            "backlogs": self.backlogs,
            "grade_trend": self.grade_trend,
            "fee_delay_days": self.fee_delay_days,
            "family_income_bracket": self.family_income_bracket,
            "extracurricular": self.extracurricular,
            "attendance_trend_3m": self.attendance_trend_3m,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_latest:
            lp = self.latest_prediction
            d["latest_prediction"] = lp.to_dict() if lp else None
        return d

    def to_feature_dict(self):
        return {
            "attendance_pct": self.attendance_pct,
            "backlogs": self.backlogs,
            "grade_trend": self.grade_trend,
            "fee_delay_days": self.fee_delay_days,
            "family_income_bracket": self.family_income_bracket,
            "extracurricular": int(self.extracurricular),
            "attendance_trend_3m": self.attendance_trend_3m,
        }


# ─────────────────────────────────────────
# Predictions
# ─────────────────────────────────────────
class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    risk_level = db.Column(db.String(10), nullable=False)  # High / Medium / Low
    risk_score = db.Column(db.Float, nullable=False)        # 0-100 composite
    top_factors_json = db.Column(db.Text)                   # JSON list of factor dicts
    probabilities_json = db.Column(db.Text)                 # JSON class probabilities
    predicted_at = db.Column(db.DateTime, default=utcnow, index=True)
    triggered_by = db.Column(db.String(20), default="manual")  # manual / batch / upload

    student = db.relationship("Student", back_populates="predictions")

    @property
    def top_factors(self):
        if self.top_factors_json:
            return json.loads(self.top_factors_json)
        return []

    @property
    def probabilities(self):
        if self.probabilities_json:
            return json.loads(self.probabilities_json)
        return {}

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "top_factors": self.top_factors,
            "probabilities": self.probabilities,
            "predicted_at": self.predicted_at.isoformat() if self.predicted_at else None,
            "triggered_by": self.triggered_by,
        }


# ─────────────────────────────────────────
# Interventions
# ─────────────────────────────────────────
class Intervention(db.Model):
    __tablename__ = "interventions"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action_taken = db.Column(db.String(80), nullable=False)  # category/type
    notes = db.Column(db.Text)
    date = db.Column(db.DateTime, default=utcnow)
    outcome_status = db.Column(db.String(20), default="pending")
    # pending / improved / no_change / dropped
    follow_up_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=utcnow)

    student = db.relationship("Student", back_populates="interventions")
    faculty = db.relationship("User", back_populates="interventions")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "faculty_id": self.faculty_id,
            "faculty_name": self.faculty.name if self.faculty else None,
            "action_taken": self.action_taken,
            "notes": self.notes,
            "date": self.date.isoformat() if self.date else None,
            "outcome_status": self.outcome_status,
            "follow_up_date": self.follow_up_date.isoformat() if self.follow_up_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ─────────────────────────────────────────
# Audit Log
# ─────────────────────────────────────────
class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(200), nullable=False)
    entity_type = db.Column(db.String(50))   # student / prediction / intervention / user
    entity_id = db.Column(db.Integer)
    details = db.Column(db.Text)             # JSON with extra context
    ip_address = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=utcnow, index=True)

    user = db.relationship("User", back_populates="audit_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else "System",
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


# ─────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────
class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text)
    type = db.Column(db.String(30), default="info")  # info / warning / danger
    related_student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="SET NULL"))
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=utcnow, index=True)

    user = db.relationship("User", back_populates="notifications")
    student = db.relationship("Student")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "related_student_id": self.related_student_id,
            "related_student_name": self.student.name if self.student else None,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
