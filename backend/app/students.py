"""
app/students.py — Student CRUD + bulk CSV import
"""
import csv
import io
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from app import db
from app.models import Student, User, AuditLog, Prediction

students_bp = Blueprint("students", __name__)

VALID_INCOME = {"low", "mid", "high"}


def log_action(user_id, action, entity_type=None, entity_id=None, details=None):
    entry = AuditLog(
        user_id=user_id, action=action,
        entity_type=entity_type, entity_id=entity_id,
        details=details, ip_address=request.remote_addr,
    )
    db.session.add(entry)


@students_bp.route("", methods=["GET"])
@jwt_required()
def list_students():
    department = request.args.get("department")
    year = request.args.get("year", type=int)
    risk_level = request.args.get("risk_level")
    search = request.args.get("search", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    sort_by = request.args.get("sort_by", "name")
    order = request.args.get("order", "asc")

    query = Student.query

    if department:
        query = query.filter_by(department=department)
    if year:
        query = query.filter_by(year=year)
    if search:
        query = query.filter(
            db.or_(
                Student.name.ilike(f"%{search}%"),
                Student.roll_number.ilike(f"%{search}%"),
            )
        )

    if risk_level:
        latest_pred_subq = (
            db.session.query(
                Prediction.student_id,
                func.max(Prediction.predicted_at).label("max_at"),
            )
            .group_by(Prediction.student_id)
            .subquery()
        )
        latest = (
            db.session.query(Prediction.student_id, Prediction.risk_level)
            .join(
                latest_pred_subq,
                (Prediction.student_id == latest_pred_subq.c.student_id) &
                (Prediction.predicted_at == latest_pred_subq.c.max_at),
            )
            .subquery()
        )
        query = query.join(latest, Student.id == latest.c.student_id).filter(
            latest.c.risk_level == risk_level
        )

    # Sorting
    sort_col = getattr(Student, sort_by, Student.name)
    if order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    results = [s.to_dict(include_latest=True) for s in paginated.items]

    return jsonify({
        "students": results,
        "total": paginated.total,
        "page": page,
        "per_page": per_page,
        "pages": paginated.pages,
    }), 200


@students_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    student = Student.query.get_or_404(student_id)
    data = student.to_dict(include_latest=False)
    data["predictions"] = [p.to_dict() for p in student.predictions.limit(20)]
    data["interventions"] = [i.to_dict() for i in student.interventions.limit(20)]
    latest = student.predictions.first()
    data["latest_prediction"] = latest.to_dict() if latest else None
    return jsonify(data), 200


@students_bp.route("", methods=["POST"])
@jwt_required()
def create_student():
    current_id = int(get_jwt_identity())
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["name", "roll_number", "department", "year"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"Missing field: {f}"}), 400

    if Student.query.filter_by(roll_number=data["roll_number"]).first():
        return jsonify({"error": "Roll number already exists"}), 409

    student = Student(
        name=data["name"],
        roll_number=data["roll_number"],
        email=data.get("email"),
        department=data["department"],
        year=int(data["year"]),
        attendance_pct=float(data.get("attendance_pct", 75.0)),
        backlogs=int(data.get("backlogs", 0)),
        grade_trend=float(data.get("grade_trend", 0.0)),
        fee_delay_days=int(data.get("fee_delay_days", 0)),
        family_income_bracket=data.get("family_income_bracket", "mid"),
        extracurricular=bool(data.get("extracurricular", True)),
        attendance_trend_3m=float(data.get("attendance_trend_3m", 0.0)),
    )
    db.session.add(student)
    db.session.flush()
    log_action(current_id, f"CREATE_STUDENT: {student.roll_number}", "student", student.id)
    db.session.commit()

    # Auto-predict newly created students
    try:
        from ml.predict import predict_student as ml_predict
        import json as json_lib
        result = ml_predict(student.to_feature_dict())
        pred = Prediction(
            student_id=student.id,
            risk_level=result["risk_level"],
            risk_score=result["risk_score"],
            top_factors_json=json_lib.dumps(result["top_factors"]),
            probabilities_json=json_lib.dumps(result.get("probabilities", {})),
            triggered_by="manual",
        )
        db.session.add(pred)
        db.session.commit()
    except Exception:
        pass

    return jsonify({"message": "Student created", "student": student.to_dict()}), 201


@students_bp.route("/<int:student_id>", methods=["PATCH"])
@jwt_required()
def update_student(student_id):
    current_id = int(get_jwt_identity())
    student = Student.query.get_or_404(student_id)
    data = request.get_json() or {}

    fields = [
        "name", "email", "department", "year",
        "attendance_pct", "backlogs", "grade_trend",
        "fee_delay_days", "family_income_bracket",
        "extracurricular", "attendance_trend_3m",
    ]
    for field in fields:
        if field in data:
            setattr(student, field, data[field])

    log_action(current_id, f"UPDATE_STUDENT: {student.roll_number}", "student", student_id)
    db.session.commit()
    return jsonify({"message": "Updated", "student": student.to_dict()}), 200


@students_bp.route("/<int:student_id>", methods=["DELETE"])
@jwt_required()
def delete_student(student_id):
    current_id = int(get_jwt_identity())
    current_user = User.query.get_or_404(current_id)
    if current_user.role not in ("admin", "faculty"):
        return jsonify({"error": "Unauthorized"}), 403

    student = Student.query.get_or_404(student_id)
    name = student.name
    db.session.delete(student)
    log_action(current_id, f"DELETE_STUDENT: {name}", "student", student_id)
    db.session.commit()
    return jsonify({"message": "Student deleted"}), 200


@students_bp.route("/bulk", methods=["POST"])
@jwt_required()
def bulk_upload():
    current_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["file"]
    if not f.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are accepted"}), 400

    content = f.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))

    created = 0
    skipped = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):
        try:
            roll = row.get("roll_number", "").strip()
            if not roll:
                errors.append(f"Row {row_num}: missing roll_number")
                skipped += 1
                continue

            if Student.query.filter_by(roll_number=roll).first():
                skipped += 1
                continue

            income = row.get("family_income_bracket", "mid").strip().lower()
            if income not in VALID_INCOME:
                income = "mid"

            student = Student(
                name=row.get("name", f"Student {roll}").strip(),
                roll_number=roll,
                email=row.get("email", "").strip() or None,
                department=row.get("department", "General").strip(),
                year=int(row.get("year", 1)),
                attendance_pct=float(row.get("attendance_pct", 75)),
                backlogs=int(row.get("backlogs", 0)),
                grade_trend=float(row.get("grade_trend", 0)),
                fee_delay_days=int(row.get("fee_delay_days", 0)),
                family_income_bracket=income,
                extracurricular=str(row.get("extracurricular", "1")).strip() in ("1", "true", "True", "yes"),
                attendance_trend_3m=float(row.get("attendance_trend_3m", 0)),
            )
            db.session.add(student)
            created += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            skipped += 1

    log_action(current_id, f"BULK_UPLOAD: {created} students", "student")
    db.session.commit()

    predicted = 0
    if created:
        try:
            from ml.predict import predict_student as ml_predict
            import json
            for s in Student.query.all():
                if s.latest_prediction is None:
                    result = ml_predict(s.to_feature_dict())
                    db.session.add(Prediction(
                        student_id=s.id,
                        risk_level=result["risk_level"],
                        risk_score=result["risk_score"],
                        top_factors_json=json.dumps(result["top_factors"]),
                        probabilities_json=json.dumps(result.get("probabilities", {})),
                        triggered_by="upload",
                    ))
                    predicted += 1
            db.session.commit()
        except Exception:
            db.session.rollback()

    return jsonify({
        "message": f"Upload complete: {created} created, {skipped} skipped, {predicted} predicted",
        "created": created,
        "skipped": skipped,
        "predicted": predicted,
        "errors": errors[:20],
    }), 200


@students_bp.route("/export/csv", methods=["GET"])
@jwt_required()
def export_csv():
    from flask import Response
    students = Student.query.all()
    output = io.StringIO()
    fieldnames = [
        "id", "name", "roll_number", "email", "department", "year",
        "attendance_pct", "backlogs", "grade_trend", "fee_delay_days",
        "family_income_bracket", "extracurricular", "attendance_trend_3m",
        "risk_level", "risk_score",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for s in students:
        lp = s.latest_prediction
        row = {
            "id": s.id, "name": s.name, "roll_number": s.roll_number,
            "email": s.email or "", "department": s.department, "year": s.year,
            "attendance_pct": s.attendance_pct, "backlogs": s.backlogs,
            "grade_trend": s.grade_trend, "fee_delay_days": s.fee_delay_days,
            "family_income_bracket": s.family_income_bracket,
            "extracurricular": int(s.extracurricular),
            "attendance_trend_3m": s.attendance_trend_3m,
            "risk_level": lp.risk_level if lp else "",
            "risk_score": lp.risk_score if lp else "",
        }
        writer.writerow(row)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_export.csv"},
    )
