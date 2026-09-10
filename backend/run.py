"""
run.py — Flask entry point and DB seed
"""
import os
import sys

# Ensure backend dir is in path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models import User, Student, Prediction
import json


def seed_database(app):
    """Seed initial data if the database is empty."""
    with app.app_context():
        # Create default admin
        if not User.query.filter_by(email="admin@dropout.edu").first():
            admin = User(name="System Admin", email="admin@dropout.edu", role="admin")
            admin.set_password("admin123")
            db.session.add(admin)
            print("[SEED] Created admin user: admin@dropout.edu / admin123")

        # Create sample faculty
        if not User.query.filter_by(email="faculty@dropout.edu").first():
            faculty = User(
                name="Dr. Priya Sharma",
                email="faculty@dropout.edu",
                role="faculty",
                department="CSE",
            )
            faculty.set_password("faculty123")
            db.session.add(faculty)
            print("[SEED] Created faculty user: faculty@dropout.edu / faculty123")

        db.session.commit()

        # Seed 30 sample students if none exist
        if Student.query.count() == 0:
            import random
            random.seed(99)
            departments = ["CSE", "ECE", "ME", "CE", "MBA", "BCA"]
            names = [
                "Aarav Patel", "Diya Sharma", "Rohan Mehta", "Ananya Iyer",
                "Karthik Nair", "Sneha Reddy", "Amit Kumar", "Priya Singh",
                "Rahul Gupta", "Nisha Joshi", "Arjun Verma", "Kavita Rao",
                "Varun Pillai", "Meera Bhat", "Siddharth Jain", "Pooja Desai",
                "Aditya Choudhary", "Lakshmi Menon", "Vijay Krishnan", "Tanvi Shah",
                "Harsh Agarwal", "Riya Pandey", "Nikhil Tiwari", "Shweta More",
                "Deepak Sahu", "Anjali Mishra", "Sachin Yadav", "Pallavi Patil",
                "Mohit Bhatt", "Sunita Jha",
            ]
            for i, name in enumerate(names):
                roll = f"2024{departments[i % len(departments)][:2]}{(i+1):03d}"
                dept = departments[i % len(departments)]
                att = round(random.uniform(38, 98), 1)
                backlogs = max(0, int(random.gauss(2 - att / 50, 1.5)))
                student = Student(
                    name=name,
                    roll_number=roll,
                    email=f"{name.lower().replace(' ', '.')}@college.edu",
                    department=dept,
                    year=random.choice([1, 2, 3, 4]),
                    attendance_pct=att,
                    backlogs=min(backlogs, 8),
                    grade_trend=round(random.uniform(-2, 2), 2),
                    fee_delay_days=max(0, int(random.expovariate(0.05))),
                    family_income_bracket=random.choice(["low", "low", "mid", "mid", "high"]),
                    extracurricular=random.choice([True, True, False]),
                    attendance_trend_3m=round(random.uniform(-25, 15), 1),
                )
                db.session.add(student)

            db.session.commit()
            print(f"[SEED] Created {len(names)} sample students")

            # Run predictions for seeded students
            try:
                from ml.predict import predict_student, load_model
                load_model()
                students = Student.query.all()
                for s in students:
                    result = predict_student(s.to_feature_dict())
                    pred = Prediction(
                        student_id=s.id,
                        risk_level=result["risk_level"],
                        risk_score=result["risk_score"],
                        top_factors_json=json.dumps(result["top_factors"]),
                        probabilities_json=json.dumps(result.get("probabilities", {})),
                        triggered_by="seed",
                    )
                    db.session.add(pred)
                db.session.commit()
                print(f"[SEED] Ran predictions for {len(students)} students")
            except Exception as e:
                print(f"[SEED] Could not run predictions: {e}")


if __name__ == "__main__":
    flask_env = os.environ.get("FLASK_ENV", "development")
    app = create_app(flask_env)

    seed_database(app)

    port = int(os.environ.get("PORT", 5000))
    debug = flask_env == "development"
    print(f"\n[SERVER] Starting on http://localhost:{port} (debug={debug})")
    app.run(host="0.0.0.0", port=port, debug=debug)
