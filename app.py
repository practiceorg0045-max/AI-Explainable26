
from flask import Flask, request, jsonify
from flask_cors import CORS

from explain import explain_prediction

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "project": "EduLens",
        "status": "API is running"
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Valid JSON input is required."
        }), 400

    limits = {
        "study_hours": (0, 10),
        "attendance": (0, 100),
        "previous_score": (0, 100),
        "assignment_score": (0, 100),
        "sleep_hours": (0, 24),
    }

    student = {}

    for field, (minimum, maximum) in limits.items():
        try:
            value = float(data[field])
        except (KeyError, TypeError, ValueError):
            return jsonify({
                "error": f"Please provide a valid number for {field}."
            }), 400

        if not minimum <= value <= maximum:
            return jsonify({
                "error": f"{field} must be between {minimum} and {maximum}."
            }), 400

        student[field] = value

    try:
        result = explain_prediction(student)
        marks = result["predicted_marks"]

        if marks >= 80:
            performance = "Excellent"
        elif marks >= 60:
            performance = "Good"
        elif marks >= 40:
            performance = "Average"
        else:
            performance = "Needs Improvement"

        suggestions = []

        if student["study_hours"] < 3:
            suggestions.append(
                "Try setting aside more focused study time each day."
            )

        if student["attendance"] < 75:
            suggestions.append(
                "Improve class attendance to stay consistent with lessons."
            )

        if student["previous_score"] < 60:
            suggestions.append(
                "Review previous topics and practise weak areas regularly."
            )

        if student["assignment_score"] < 60:
            suggestions.append(
                "Spend more time practising and completing assignments."
            )

        if student["sleep_hours"] < 7:
            suggestions.append(
                "Aim for a consistent sleep routine to support learning."
            )

        if not suggestions:
            suggestions.append(
                "Keep up your current habits and review your progress regularly."
            )

        return jsonify({
            "predicted_marks": marks,
            "performance": performance,
            "suggestions": suggestions,
            "shap": result["shap"],
            "lime": result["lime"],
            "model_note": (
                "Demonstration model trained on synthetic data; "
                "predictions are not validated on real student records."
            )
        })

    except Exception:
        app.logger.exception("Prediction failed")
        return jsonify({
            "error": "Prediction failed. Check the server terminal for details."
        }), 500


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
