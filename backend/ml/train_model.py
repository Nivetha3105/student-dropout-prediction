"""
train_model.py
Trains a Random Forest classifier on the synthetic student dataset.
Computes SHAP values for explainability, evaluates model performance,
and saves model artifacts to the models/ directory.
"""
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score, precision_score, recall_score, f1_score
)

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.generate_data import generate_dataset

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLUMNS = [
    "attendance_pct",
    "backlogs",
    "grade_trend",
    "fee_delay_days",
    "family_income_encoded",
    "extracurricular",
    "attendance_trend_3m",
]

FEATURE_DISPLAY_NAMES = {
    "attendance_pct": "Attendance Percentage",
    "backlogs": "Number of Backlogs",
    "grade_trend": "Grade Trend",
    "fee_delay_days": "Fee Payment Delay (days)",
    "family_income_encoded": "Family Income Level",
    "extracurricular": "Extracurricular Participation",
    "attendance_trend_3m": "Attendance Trend (Last 3 Months)",
}

FEATURE_DESCRIPTIONS = {
    "attendance_pct": {
        "low": "Attendance has dropped significantly ({val:.0f}%)",
        "high": "Attendance is critically low ({val:.0f}%)",
        "neutral": "Attendance is {val:.0f}%",
    },
    "backlogs": "Has {val} pending backlog(s) in current subjects",
    "grade_trend": {
        "declining": "Grades are declining (trend: {val:.2f})",
        "improving": "Grades are improving (trend: {val:.2f})",
        "stable": "Grades are stable",
    },
    "fee_delay_days": "Fee payment delayed by {val} days",
    "family_income_encoded": "Family income is in the lower bracket",
    "extracurricular": "Not participating in extracurricular activities",
    "attendance_trend_3m": "Attendance dropped {val_abs:.1f}% over last 3 months",
}


def encode_features(df):
    """Encode categorical columns and return a copy with numeric features."""
    df = df.copy()
    income_map = {"low": 0, "mid": 1, "high": 2}
    df["family_income_encoded"] = df["family_income_bracket"].map(income_map)
    return df


def get_human_explanation(feature_name, value, importance_rank):
    """Generate a human-readable explanation for a feature's contribution."""
    if feature_name == "attendance_pct":
        if value < 50:
            return f"Critically low attendance at {value:.0f}%"
        elif value < 65:
            return f"Attendance dropped to {value:.0f}% (below required threshold)"
        elif value < 75:
            return f"Attendance at {value:.0f}% — borderline"
        else:
            return f"Attendance at {value:.0f}%"

    elif feature_name == "backlogs":
        if value == 0:
            return "No pending backlogs"
        elif value == 1:
            return "1 pending backlog in current subjects"
        else:
            return f"{int(value)} pending backlogs"

    elif feature_name == "grade_trend":
        if value < -1.0:
            return "Grades sharply declining this semester"
        elif value < -0.3:
            return "Grades showing a downward trend"
        elif value > 0.5:
            return "Grades improving this semester"
        else:
            return "Grades relatively stable"

    elif feature_name == "fee_delay_days":
        if value < 5:
            return "Fee payments are on time"
        elif value < 20:
            return f"Fee payment delayed by {int(value)} days"
        elif value < 45:
            return f"Fee significantly overdue by {int(value)} days"
        else:
            return f"Fee critically overdue ({int(value)} days)"

    elif feature_name == "family_income_encoded":
        labels = {0: "Low (financial stress likely)", 1: "Middle", 2: "High"}
        return f"Family income: {labels.get(int(value), 'Unknown')}"

    elif feature_name == "extracurricular":
        return "Active in extracurriculars" if value else "Not participating in extracurricular activities"

    elif feature_name == "attendance_trend_3m":
        if value < -15:
            return f"Attendance fell sharply by {abs(value):.1f}% over last 3 months"
        elif value < -5:
            return f"Attendance trending downward ({value:+.1f}% over last 3 months)"
        elif value > 5:
            return f"Attendance recovering ({value:+.1f}% over last 3 months)"
        else:
            return f"Attendance trend stable ({value:+.1f}%)"

    return f"{feature_name}: {value}"


def train():
    print("=" * 60)
    print("DROPOUT PREDICTION MODEL TRAINING")
    print("=" * 60)

    # 1. Load or generate data
    data_path = os.path.join(MODELS_DIR, "students_data.csv")
    if os.path.exists(data_path):
        print(f"Loading existing dataset from {data_path}")
        df = pd.read_csv(data_path)
    else:
        print("Generating synthetic dataset...")
        df = generate_dataset(save_path=data_path)

    print(f"Dataset size: {len(df)} records")
    print("Risk distribution:")
    print(df["risk_level"].value_counts())

    # 2. Feature engineering
    df = encode_features(df)
    X = df[FEATURE_COLUMNS].copy()
    y = df["risk_level"].copy()

    # 3. Encode labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    print(f"\nLabel classes: {le.classes_}")  # sorted alphabetically: High, Low, Medium

    # 4. Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    # 5. Train Random Forest
    print("\nTraining Random Forest classifier...")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    # 6. Evaluate
    y_pred = clf.predict(X_test)
    print("\n" + "=" * 40)
    print("EVALUATION RESULTS")
    print("=" * 40)
    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy:  {acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    # Cross-validation
    cv_scores = cross_val_score(clf, X, y_encoded, cv=StratifiedKFold(n_splits=5), scoring="accuracy")
    print(f"5-Fold CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    # Feature importances
    importances = clf.feature_importances_
    feat_imp = sorted(
        zip(FEATURE_COLUMNS, importances),
        key=lambda x: x[1], reverse=True
    )
    print("\nFeature Importances:")
    for feat, imp in feat_imp:
        print(f"  {FEATURE_DISPLAY_NAMES.get(feat, feat):40s}: {imp:.4f}")

    # 7. Compute SHAP values (using TreeExplainer — fast for Random Forest)
    print("\nComputing SHAP values...")
    try:
        import shap
        explainer = shap.TreeExplainer(clf)
        shap_values = explainer.shap_values(X_test)
        # shap_values shape: (n_classes, n_samples, n_features)
        # Save the explainer
        joblib.dump(explainer, os.path.join(MODELS_DIR, "shap_explainer.joblib"))
        print("SHAP explainer saved.")
        shap_available = True
    except Exception as e:
        print(f"SHAP computation failed (will use feature importance fallback): {e}")
        shap_available = False

    # 8. Save metrics summary
    metrics = {
        "accuracy": round(acc, 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "n_estimators": 200,
        "model_type": "RandomForestClassifier",
        "feature_importances": {f: round(float(i), 4) for f, i in feat_imp},
        "shap_available": shap_available,
        "label_classes": list(le.classes_),
        "precision": {
            cls: round(float(precision_score(y_test, y_pred, average=None)[i]), 4)
            for i, cls in enumerate(le.classes_)
        },
        "recall": {
            cls: round(float(recall_score(y_test, y_pred, average=None)[i]), 4)
            for i, cls in enumerate(le.classes_)
        },
        "f1": {
            cls: round(float(f1_score(y_test, y_pred, average=None)[i]), 4)
            for i, cls in enumerate(le.classes_)
        },
    }

    with open(os.path.join(MODELS_DIR, "model_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # 9. Save artifacts
    joblib.dump(clf, os.path.join(MODELS_DIR, "dropout_model.joblib"))
    joblib.dump(le, os.path.join(MODELS_DIR, "label_encoder.joblib"))
    with open(os.path.join(MODELS_DIR, "feature_columns.json"), "w") as f:
        json.dump(FEATURE_COLUMNS, f)
    with open(os.path.join(MODELS_DIR, "feature_display_names.json"), "w") as f:
        json.dump(FEATURE_DISPLAY_NAMES, f)

    print("\n" + "=" * 40)
    print("Model artifacts saved to:", MODELS_DIR)
    print("  - dropout_model.joblib")
    print("  - label_encoder.joblib")
    print("  - feature_columns.json")
    print("  - model_metrics.json")
    print("  - shap_explainer.joblib (if SHAP available)")
    print("=" * 40)

    return clf, le, metrics


if __name__ == "__main__":
    train()
