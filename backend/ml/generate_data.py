"""
generate_data.py
Generates a realistic synthetic dataset of student records for training the
dropout prediction model. The risk label is derived from weighted business
rules plus injected noise to prevent a trivially perfect model.
"""
import numpy as np
import pandas as pd
import json
import os

np.random.seed(42)
N = 1500  # number of synthetic students

def generate_dataset(n=N, save_path=None):
    departments = ["CSE", "ECE", "ME", "CE", "MBA", "BCA", "Commerce", "Physics"]
    years = [1, 2, 3, 4]
    income_brackets = ["low", "mid", "high"]

    data = []
    for i in range(n):
        dept = np.random.choice(departments)
        year = np.random.choice(years)
        income = np.random.choice(income_brackets, p=[0.35, 0.45, 0.20])

        # Attendance: lower for at-risk students
        attendance_pct = np.clip(np.random.normal(72, 18), 30, 100)

        # Backlogs: correlated with low attendance
        backlogs_base = max(0, int(np.random.normal(1.5 - attendance_pct / 60, 1.5)))
        backlogs = min(backlogs_base, 10)

        # Grade trend: -2 (sharply declining) to +2 (improving)
        grade_trend = np.clip(np.random.normal(0, 1), -2, 2)

        # Fee delay in days
        fee_delay = max(0, int(np.random.exponential(15)))
        if income == "low":
            fee_delay = max(0, int(np.random.exponential(35)))
        elif income == "high":
            fee_delay = max(0, int(np.random.exponential(5)))

        # Extracurricular participation
        extracurricular = int(np.random.choice([0, 1], p=[0.4, 0.6]))

        # Attendance trend over last 3 months (percentage points change)
        if attendance_pct < 50:
            att_trend_3m = np.clip(np.random.normal(-12, 8), -35, 5)
        elif attendance_pct > 80:
            att_trend_3m = np.clip(np.random.normal(3, 5), -10, 20)
        else:
            att_trend_3m = np.clip(np.random.normal(-3, 8), -25, 15)

        # Compute raw risk score (weighted rule-based)
        risk_score = 0.0
        risk_score += (100 - attendance_pct) * 0.35  # attendance weight
        risk_score += backlogs * 5.0                  # each backlog adds 5 pts
        risk_score += max(0, fee_delay - 10) * 0.3   # fee delay weight
        risk_score += (-grade_trend) * 4.0            # declining grade adds
        risk_score += (0 if extracurricular else 3)   # no EC participation
        risk_score += (-att_trend_3m) * 0.5           # downward trend adds
        if income == "low":
            risk_score += 5.0
        elif income == "high":
            risk_score -= 3.0

        # Inject noise
        risk_score += np.random.normal(0, 5)
        risk_score = max(0, risk_score)

        # Assign label
        if risk_score >= 45:
            risk_level = "High"
        elif risk_score >= 22:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        data.append({
            "student_id": i + 1,
            "name": f"Student_{i+1:04d}",
            "roll_number": f"ROLL{(i+1):05d}",
            "department": dept,
            "year": year,
            "attendance_pct": round(attendance_pct, 2),
            "backlogs": int(backlogs),
            "grade_trend": round(grade_trend, 3),
            "fee_delay_days": int(min(fee_delay, 120)),
            "family_income_bracket": income,
            "extracurricular": int(extracurricular),
            "attendance_trend_3m": round(att_trend_3m, 2),
            "risk_level": risk_level,
        })

    df = pd.DataFrame(data)

    if save_path:
        df.to_csv(save_path, index=False)
        print(f"Saved {n} records to {save_path}")
        print("Risk distribution:")
        print(df["risk_level"].value_counts())

    return df


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(out_dir, exist_ok=True)
    df = generate_dataset(save_path=os.path.join(out_dir, "students_data.csv"))
    print(df.head())
