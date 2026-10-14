
/* =========================================
   EDULENS — FRONTEND FUNCTIONALITY
   ========================================= */

// Local Flask API. Change this URL when your backend is hosted.
const API_URL = "https://edulens-api-tqge.onrender.com";

const form = document.getElementById("predictionForm");
const button = document.getElementById("predictButton");

const fields = [
  "study_hours",
  "attendance",
  "previous_score",
  "assignment_score",
  "sleep_hours"
];

const limits = {
  study_hours: [0, 10],
  attendance: [0, 100],
  previous_score: [0, 100],
  assignment_score: [0, 100],
  sleep_hours: [0, 24]
};

/* =========================================
   PREDICTION FORM
   ========================================= */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const student = {};

  for (const name of fields) {
    const input = document.getElementById(name);
    const value = Number(input.value);

    if (input.value.trim() === "" || !Number.isFinite(value)) {
      showMessage("Please enter a valid value in every field.", true);
      input.focus();
      return;
    }

    const [minimum, maximum] = limits[name];

    if (value < minimum || value > maximum) {
      showMessage(
        `${getFieldLabel(name)} must be between ${minimum} and ${maximum}.`,
        true
      );
      input.focus();
      return;
    }

    student[name] = value;
  }

  setLoading(true);
  showMessage("Calculating your prediction and explanations...", false);

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(student)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "The prediction could not be generated."
      );
    }

    renderPrediction(result);
    renderSuggestions(result.suggestions || []);

    renderExplanation(
      "shapChart",
      result.shap,
      "SHAP explanation data was not returned by the backend."
    );

    renderExplanation(
      "limeChart",
      result.lime,
      "LIME explanation data was not returned by the backend."
    );

    showMessage(
      result.model_note || "Prediction generated successfully.",
      false
    );
  } catch (error) {
    const connectionError =
      error instanceof TypeError ||
      error.message.toLowerCase().includes("failed to fetch");

    showMessage(
      connectionError
        ? "Unable to connect to the backend. Make sure Flask is running at http://127.0.0.1:5000."
        : error.message,
      true
    );
  } finally {
    setLoading(false);
  }
});

/* =========================================
   FORM HELPERS
   ========================================= */

function getFieldLabel(name) {
  const labels = {
    study_hours: "Daily study hours",
    attendance: "Attendance",
    previous_score: "Previous exam score",
    assignment_score: "Assignment score",
    sleep_hours: "Daily sleep"
  };

  return labels[name] || name;
}

function setLoading(isLoading) {
  button.disabled = isLoading;

  button.innerHTML = isLoading
    ? '<span aria-hidden="true">⏳</span> Calculating...'
    : '<span aria-hidden="true">✳</span> Predict performance <span class="button-arrow" aria-hidden="true">→</span>';
}

/* =========================================
   PREDICTION RESULTS
   ========================================= */

function renderPrediction(result) {
  const score = Number(result.predicted_marks);

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("The backend returned an invalid predicted score.");
  }

  const roundedScore = Math.round(score * 10) / 10;

  document.getElementById("score").textContent =
    roundedScore.toFixed(1);

  document.getElementById("scorePercent").textContent =
    `${roundedScore.toFixed(1)}%`;

  const progress = document.getElementById("scoreBar");
  progress.style.width = `${roundedScore}%`;
  progress.setAttribute("aria-valuenow", String(roundedScore));

  document.getElementById("category").textContent =
    result.performance || "Prediction ready";

  const badge = document.getElementById("resultBadge");
  badge.textContent = "Prediction ready";
  badge.classList.add("ready");
}

/* =========================================
   RECOMMENDATIONS
   ========================================= */

function renderSuggestions(suggestions) {
  const list = document.getElementById("suggestions");
  list.replaceChildren();

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    addListItem(
      list,
      "No specific recommendations are available for this prediction."
    );
    return;
  }

  suggestions.forEach((suggestion) => {
    addListItem(list, String(suggestion));
  });
}

function addListItem(list, text) {
  const item = document.createElement("li");
  item.textContent = text;
  list.appendChild(item);
}

/* =========================================
   SHAP AND LIME EXPLANATIONS
   ========================================= */

function renderExplanation(containerId, explanation, emptyMessage) {
  const container = document.getElementById(containerId);
  container.replaceChildren();

  if (!Array.isArray(explanation) || explanation.length === 0) {
    showEmpty(container, emptyMessage);
    return;
  }

  const rows = explanation
    .map((item) => ({
      feature: String(item.feature ?? "Feature"),
      value: Number(
        item.contribution ?? item.weight ?? item.value
      )
    }))
    .filter((item) => Number.isFinite(item.value))
    .slice(0, 8);

  if (rows.length === 0) {
    showEmpty(container, "No valid explanation values were returned.");
    return;
  }

  // Display the strongest contributions first.
  rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const maxValue = Math.max(
    ...rows.map((row) => Math.abs(row.value)),
    0.000001
  );

  rows.forEach((row) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-row";

    const label = document.createElement("div");
    label.className = "chart-label";

    const featureName = document.createElement("span");
    featureName.textContent = row.feature.replaceAll("_", " ");

    const contribution = document.createElement("span");
    contribution.className = "chart-value";
    contribution.textContent =
      `${row.value > 0 ? "+" : ""}${row.value.toFixed(3)}`;

    label.append(featureName, contribution);

    const track = document.createElement("div");
    track.className = "bar-track";

    const bar = document.createElement("div");
    bar.className = `bar ${row.value >= 0 ? "positive" : "negative"}`;

    const width = Math.abs(row.value) / maxValue * 100;
    bar.style.width = `${Math.max(width, 1)}%`;

    track.appendChild(bar);
    wrapper.append(label, track);
    container.appendChild(wrapper);
  });
}

function showEmpty(container, message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const icon = document.createElement("span");
  icon.className = "empty-icon";
  icon.textContent = "⌁";

  const heading = document.createElement("strong");
  heading.textContent = "Explanation unavailable";

  const detail = document.createElement("p");
  detail.textContent = message;

  empty.append(icon, heading, detail);
  container.appendChild(empty);
}

/* =========================================
   STATUS MESSAGES
   ========================================= */

function showMessage(message, isError) {
  const element = document.getElementById("resultMessage");

  element.textContent = message;
  element.style.color = isError ? "var(--negative)" : "";
}

/* =========================================
   LIGHT AND DARK MODE
   ========================================= */

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.body.dataset.theme = isDark ? "dark" : "light";

  themeIcon.textContent = isDark ? "☀" : "☾";
  themeLabel.textContent = isDark ? "Light mode" : "Dark mode";

  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );

  themeToggle.setAttribute("aria-pressed", String(isDark));
}

function getSavedTheme() {
  try {
    const saved = localStorage.getItem("edulens-theme");

    if (saved === "dark" || saved === "light") {
      return saved;
    }
  } catch (error) {
    // Storage may be unavailable in some browsing environments.
  }

  return "light";
}

applyTheme(getSavedTheme());

themeToggle.addEventListener("click", () => {
  const nextTheme =
    document.body.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);

  try {
    localStorage.setItem("edulens-theme", nextTheme);
  } catch (error) {
    // Theme switching still works without persistent storage.
  }
});
