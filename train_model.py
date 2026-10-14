
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split


# Project paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"

MODEL_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

FEATURES = [
    "study_hours",
    "attendance",
    "previous_score",
    "assignment_score",
    "sleep_hours",
]

RANDOM_STATE = 42


def generate_demo_data(number_of_students=1500):
    """Generate synthetic data for educational demonstration."""

    rng = np.random.default_rng(RANDOM_STATE)

    study_hours = rng.uniform(0, 10, number_of_students)
    attendance = rng.uniform(30, 100, number_of_students)
    previous_score = rng.uniform(20, 100, number_of_students)
    assignment_score = rng.uniform(20, 100, number_of_students)
    sleep_hours = rng.uniform(4, 10, number_of_students)

    # Illustrative relationship, not a validated educational formula.
    marks = (
        0.8 * previous_score
        + 1.5 * study_hours
        + 0.12 * attendance
        + 0.15 * assignment_score
        + 0.8 * sleep_hours
        - 20
        + rng.normal(0, 6, number_of_students)
    )

    marks = np.clip(marks, 0, 100)

    return pd.DataFrame({
        "study_hours": study_hours,
        "attendance": attendance,
        "previous_score": previous_score,
        "assignment_score": assignment_score,
        "sleep_hours": sleep_hours,
        "final_marks": marks,
    })


def main():
    print("Generating synthetic student dataset...")

    dataset = generate_demo_data()
    dataset.to_csv(DATA_DIR / "student_data.csv", index=False)

    X = dataset[FEATURES]
    y = dataset["final_marks"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_STATE,
    )

    print("Training Random Forest model...")

    model = RandomForestRegressor(
        n_estimators=150,
        min_samples_leaf=2,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    model_path = MODEL_DIR / "student_model.pkl"

    joblib.dump({
        "model": model,
        "features": FEATURES,
        "target": "final_marks",
    }, model_path)

    print("\nTraining completed!")
    print(f"Dataset rows: {len(dataset)}")
    print(f"Mean Absolute Error (MAE): {mae:.2f}")
    print(f"R-squared (R²): {r2:.3f}")
    print(f"Saved model: {model_path}")
    print("\nNote: These metrics use synthetic data only.")


if __name__ == "__main__":
    main()
