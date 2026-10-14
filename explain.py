
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from lime.lime_tabular import LimeTabularExplainer


# Project paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "student_model.pkl"
DATA_PATH = BASE_DIR / "data" / "student_data.csv"

# Load the trained model
saved_data = joblib.load(MODEL_PATH)
model = saved_data["model"]
FEATURES = saved_data["features"]

# Load the dataset used for training
dataset = pd.read_csv(DATA_PATH)
X = dataset[FEATURES]

# SHAP explainer
shap_explainer = shap.TreeExplainer(model)

# LIME explainer
lime_explainer = LimeTabularExplainer(
    training_data=X.to_numpy(),
    feature_names=FEATURES,
    mode="regression",
    discretize_continuous=True,
    random_state=42,
)


def explain_prediction(student_data):
    """
    Generate a prediction and SHAP/LIME explanations.

    student_data must be a dictionary containing all five features.
    """

    # Keep features in the correct order
    student = pd.DataFrame(
        [[float(student_data[feature]) for feature in FEATURES]],
        columns=FEATURES,
    )

    # Predict marks
    predicted_marks = float(model.predict(student)[0])
    predicted_marks = round(
        max(0.0, min(100.0, predicted_marks)), 2
    )

    # SHAP explanation
    shap_values = shap_explainer(student)
    contributions = np.asarray(shap_values.values)[0]

    shap_results = [
        {
            "feature": feature,
            "contribution": round(float(value), 3),
        }
        for feature, value in zip(FEATURES, contributions)
    ]

    shap_results.sort(
        key=lambda item: abs(item["contribution"]),
        reverse=True,
    )

 
    # LIME explanation
    lime_result = lime_explainer.explain_instance(
        data_row=student.iloc[0].to_numpy(),
        predict_fn=lambda values: model.predict(
            pd.DataFrame(values, columns=FEATURES)
        ),
        num_features=len(FEATURES),
    )

    lime_results = [
        {
            "feature": feature,
            "contribution": round(float(weight), 3),
        }
        for feature, weight in lime_result.as_list()
    ]

    lime_results.sort(
        key=lambda item: abs(item["contribution"]),
        reverse=True,
    )

    return {
        "predicted_marks": predicted_marks,
        "shap": shap_results,
        "lime": lime_results,
    }

