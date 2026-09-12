"""
app/__init__.py — Flask application factory
"""
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()

from sqlalchemy import event
from sqlalchemy.engine import Engine


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass


def create_app(config_name=None):
    app = Flask(__name__)

    # Load config
    from config import config
    env = config_name or os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config.get(env, config["default"]))

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    # Load ML model
    from ml.predict import load_model
    try:
        load_model()
    except FileNotFoundError as e:
        print(f"[WARN] {e}")
        print("[WARN] Run 'python ml/train_model.py' to generate the model.")

    # Register blueprints
    from app.auth import auth_bp
    from app.students import students_bp
    from app.predictions import predictions_bp
    from app.interventions import interventions_bp
    from app.analytics import analytics_bp
    from app.admin import admin_bp
    from app.reports import reports_bp
    from app.notifications import notifications_bp
    from app.ai import ai_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(predictions_bp, url_prefix="/api/predict")
    app.register_blueprint(interventions_bp, url_prefix="/api/interventions")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")

    # Create tables
    with app.app_context():
        db.create_all()

    @app.route("/api/health")
    def health():
        return {"status": "ok", "version": "1.0.0"}

    return app
