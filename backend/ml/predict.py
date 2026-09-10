"""
predict.py
Inference helpers. The model, label encoder, and feature columns
are loaded once at application startup.
"""
import os
import sys
import json
import joblib
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

# Lazy-loaded globals (populated by load_model())
_model = None
_label_encoder = None
_feature_columns = None
_shap_explainer = None

INCOME_MAP = {"low": 0, "mid": 1, "high": 2}

FEATURE_DESCRIPTIONS = {
    "attendance_pct": lambda v: (
        f"Critically low attendance at {v:.0f}%" if v < 50
        else f"Attendance dropped to {v:.0f}% (below threshold)" if v < 65
        else f"Attendance at {v:.0f}% — borderline" if v < 75
        else f"Attendance is {v:.0f}%"
    ),
    "backlogs": lambda v: (
        "No pending backlogs" if v == 0
        else f"1 pending backlog" if v == 1
        else f"{int(v)} pending backlogs"
    ),
    "grade_trend": lambda v: (
        "Grades sharply declining this semester" if v < -1.0
        else "Grades showing a downward trend" if v < -0.3
        else "Grades improving this semester" if v > 0.5
        else "Grades relatively stable"
    ),
    "fee_delay_days": lambda v: (
        "Fee payments are on time" if v < 5
        else f"Fee payment delayed by {int(v)} days" if v < 20
        else f"Fee significantly overdue — {int(v)} days" if v < 45
        else f"Fee critically overdue ({int(v)} days)"
    ),
    "family_income_encoded": lambda v: (
        "Family income: Low (financial stress likely)" if v == 0
        else "Family income: Middle" if v == 1
        else "Family income: High"
    ),
    "extracurricular": lambda v: (
        "Active in extracurricular activities" if v
        else "Not participating in extracurricular activities"
    ),
    "attendance_trend_3m": lambda v: (
        f"Attendance fell sharply by {abs(v):.1f}% over last 3 months" if v < -15
        else f"Attendance trending down ({v:+.1f}% over 3 months)" if v < -5
        else f"Attendance recovering ({v:+.1f}% over 3 months)" if v > 5
        else f"Attendance trend stable ({v:+.1f}%)"
    ),
}

FEATURE_DISPLAY_NAMES = {
    "attendance_pct": "Attendance %",
    "backlogs": "Backlogs",
    "grade_trend": "Grade Trend",
    "fee_delay_days": "Fee Delay",
    "family_income_encoded": "Family Income",
    "extracurricular": "Extracurricular",
    "attendance_trend_3m": "Attendance Trend (3M)",
}

# Risk contribution direction: +1 means higher value → higher risk
RISK_DIRECTION = {
    "attendance_pct": -1,         # lower attendance = higher risk
    "backlogs": 1,
    "grade_trend": -1,            # lower (declining) grade = higher risk
    "fee_delay_days": 1,
    "family_income_encoded": -1,  # lower income = higher risk
    "extracurricular": -1,        # not participating = higher risk
    "attendance_trend_3m": -1,    # downward trend = higher risk
}


def load_model():
    """Load model artifacts from disk. Called once at app startup."""
    global _model, _label_encoder, _feature_columns, _shap_explainer

    model_path = os.path.join(MODELS_DIR, "dropout_model.joblib")
    le_path = os.path.join(MODELS_DIR, "label_encoder.joblib")
    fc_path = os.path.join(MODELS_DIR, "feature_columns.json")
    shap_path = os.path.join(MODELS_DIR, "shap_explainer.joblib")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model not found at {model_path}. "
            "Run 'python ml/train_model.py' first."
        )

    _model = joblib.load(model_path)
    _label_encoder = joblib.load(le_path)
    with open(fc_path) as f:
        _feature_columns = json.load(f)

    if os.path.exists(shap_path):
        try:
            _shap_explainer = joblib.load(shap_path)
        except Exception:
            _shap_explainer = None

    print(f"[ML] Model loaded. Classes: {_label_encoder.classes_}")
    return _model


def _encode_student(student_dict):
    """Convert a student dict into the feature vector expected by the model."""
    income_raw = student_dict.get("family_income_bracket", "mid")
    income_enc = INCOME_MAP.get(income_raw, 1)

    features = {
        "attendance_pct": float(student_dict.get("attendance_pct", 75.0)),
        "backlogs": float(student_dict.get("backlogs", 0)),
        "grade_trend": float(student_dict.get("grade_trend", 0.0)),
        "fee_delay_days": float(student_dict.get("fee_delay_days", 0)),
        "family_income_encoded": float(income_enc),
        "extracurricular": float(student_dict.get("extracurricular", 1)),
        "attendance_trend_3m": float(student_dict.get("attendance_trend_3m", 0.0)),
    }

    return features, features


def _shap_row_for_class(shap_vals, predicted_class_idx, n_features):
    """Normalize SHAP output across shap 0.4x–0.5x APIs to a 1D feature vector."""
    values = shap_vals.values if hasattr(shap_vals, "values") else shap_vals
    if isinstance(values, list):
        row = np.array(values[predicted_class_idx])
        return row[0] if row.ndim > 1 else row

    arr = np.array(values)
    if arr.ndim == 3:
        # (n_samples, n_features, n_classes)
        if arr.shape[1] == n_features:
            return arr[0, :, predicted_class_idx]
        # (n_classes, n_samples, n_features)
        if arr.shape[2] == n_features:
            return arr[predicted_class_idx, 0, :]
    if arr.ndim == 2:
        if arr.shape[1] == n_features:
            return arr[0]
        if arr.shape[0] == n_features:
            return arr[:, predicted_class_idx] if arr.shape[1] > 1 else arr[:, 0]
    if arr.ndim == 1 and arr.shape[0] == n_features:
        return arr
    raise ValueError(f"Unexpected SHAP shape: {arr.shape}")


def _get_top_factors(feature_values_dict, predicted_class_idx, n=3):
    """
    Compute top contributing factors for a prediction.
    Uses SHAP if available, otherwise falls back to feature importance
    weighted by risk direction and feature value.
    """
    top_factors = []

    if _shap_explainer is not None:
        try:
            import pandas as pd
            fv = pd.DataFrame([feature_values_dict])[_feature_columns]
            shap_vals = _shap_explainer.shap_values(fv)
            class_shap = _shap_row_for_class(shap_vals, predicted_class_idx, len(_feature_columns))
            indexed = sorted(
                enumerate(class_shap), key=lambda x: abs(x[1]), reverse=True
            )
            for feat_idx, shap_val in indexed[:n]:
                feat_name = _feature_columns[feat_idx]
                val = feature_values_dict[feat_name]
                top_factors.append({
                    "feature": feat_name,
                    "display_name": FEATURE_DISPLAY_NAMES.get(feat_name, feat_name),
                    "value": round(val, 3),
                    "shap_value": round(float(shap_val), 4),
                    "impact": "increases_risk" if shap_val > 0 else "decreases_risk",
                    "explanation": FEATURE_DESCRIPTIONS[feat_name](val),
                })
            return top_factors
        except Exception:
            pass  # Fall through to importance-based

    # Fallback: feature importance × risk direction × normalized value
    importances = _model.feature_importances_
    scores = []
    for i, col in enumerate(_feature_columns):
        val = feature_values_dict[col]
        direction = RISK_DIRECTION.get(col, 1)
        # Normalize value roughly
        normalized = val / 100.0 if col == "attendance_pct" else val / 10.0
        score = importances[i] * abs(normalized * direction)
        scores.append((i, col, score, direction * normalized > 0))

    scores.sort(key=lambda x: x[2], reverse=True)
    for i, col, score, increases_risk in scores[:n]:
        val = feature_values_dict[col]
        top_factors.append({
            "feature": col,
            "display_name": FEATURE_DISPLAY_NAMES.get(col, col),
            "value": round(val, 3),
            "shap_value": round(score, 4),
            "impact": "increases_risk" if increases_risk else "decreases_risk",
            "explanation": FEATURE_DESCRIPTIONS[col](val),
        })

    return top_factors


def predict_student(student_dict):
    """
    Run the dropout risk prediction for a single student.

    Args:
        student_dict: dict with student feature fields

    Returns:
        dict: {risk_level, risk_score, top_factors}
    """
    if _model is None:
        load_model()

    feature_values, _ = _encode_student(student_dict)
    import pandas as pd
    X = pd.DataFrame([feature_values])[_feature_columns]

    proba = _model.predict_proba(X)[0]  # probabilities for each class
    pred_idx = int(np.argmax(proba))
    risk_level = _label_encoder.inverse_transform([pred_idx])[0]

    # Risk score: probability of being High risk (index of "High" in sorted classes)
    classes = list(_label_encoder.classes_)  # ['High', 'Low', 'Medium']
    high_idx = classes.index("High")
    medium_idx = classes.index("Medium")
    # Composite risk score 0-100: High prob × 100 + Medium prob × 50
    risk_score = round(proba[high_idx] * 100 + proba[medium_idx] * 50, 1)
    risk_score = min(100.0, risk_score)

    top_factors = _get_top_factors(feature_values, pred_idx, n=3)

    return {
        "risk_level": risk_level,
        "risk_score": risk_score,
        "top_factors": top_factors,
        "probabilities": {cls: round(float(proba[i]), 4) for i, cls in enumerate(classes)},
    }


if __name__ == "__main__":
    load_model()
    test_student = {
        "attendance_pct": 42.0,
        "backlogs": 4,
        "grade_trend": -1.5,
        "fee_delay_days": 60,
        "family_income_bracket": "low",
        "extracurricular": 0,
        "attendance_trend_3m": -20.0,
    }
    result = predict_student(test_student)
    import json
    print(json.dumps(result, indent=2))
