
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "explainable_ai_history_v3";
const THEME_KEY = "explainable_ai_theme_v3";

const featureConfig = [
  {
    id: "attendance",
    label: "Attendance",
    reference: 75,
    weight: 0.15
  },
  {
    id: "previous",
    label: "Previous marks",
    reference: 60,
    weight: 0.40
  },
  {
    id: "study",
    label: "Study hours",
    reference: 3,
    weight: 3.00
  },
  {
    id: "assignment",
    label: "Assignment marks",
    reference: 60,
    weight: 0.20
  },
  {
    id: "sleep",
    label: "Sleep hours",
    reference: 7,
    weight: 1.00
  },
  {
    id: "participation",
    label: "Participation",
    reference: 60,
    weight: 0.10
  }
];

let toastTimeout;

/* Read locally saved prediction records. */
function getHistory() {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/* Save a maximum of 50 records in this browser. */
function saveHistory(items) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, 50))
    );

    return true;
  } catch {
    showToast("Browser storage is unavailable. The result may not be saved.");
    return false;
  }
}

/* Display a temporary notification. */
function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/* Read the student inputs. */
function getStudentInputs() {
  const values = {};

  for (const feature of featureConfig) {
    values[feature.id] = Number($(feature.id).value);
  }

  return values;
}

/*
  SCORE CALCULATION

  This is a predefined weighted formula.
  It is not a trained Random Forest or XGBoost model.
  The weights are illustrative and have not been learned
  from a validated student-performance dataset.
*/
function calculateScore(values) {
  const score =
    0.15 * values.attendance +
    0.40 * values.previous +
    3.00 * values.study +
    0.20 * values.assignment +
    1.00 * values.sleep +
    0.10 * values.participation -
    19.18;

  const boundedScore = Math.max(
    0,
    Math.min(100, score)
  );

  return Math.round(boundedScore);
}

/*
  FEATURE CONTRIBUTIONS

  Each contribution shows the difference between the
  input value and its reference value multiplied by
  the formula weight.

  These are formula contributions, not SHAP values.
*/
function calculateContributions(values) {
  return featureConfig.map(feature => ({
    label: feature.label,
    value:
      feature.weight *
      (values[feature.id] - feature.reference)
  }));
}

/* Categorize the estimated score. */
function getCategory(score) {
  if (score >= 80) {
    return {
      label: "Excellent",
      message: "A strong estimated academic outcome."
    };
  }

  if (score >= 65) {
    return {
      label: "Good",
      message: "A positive estimated academic outcome."
    };
  }

  if (score >= 50) {
    return {
      label: "Average",
      message: "There may be opportunities for further improvement."
    };
  }

  return {
    label: "Needs Support",
    message: "Consider reviewing learning needs and support options."
  };
}

/* Generate suggestions based on the entered values. */
function getSuggestions(values, score) {
  const suggestions = [];

  if (values.attendance < 75) {
    suggestions.push(
      "Discuss attendance barriers and explore ways to improve class participation."
    );
  }

  if (values.previous < 60) {
    suggestions.push(
      "Review earlier examination mistakes and prepare a focused revision plan."
    );
  }

  if (values.study < 3) {
    suggestions.push(
      "Try a consistent, manageable daily study schedule with short breaks."
    );
  }

  if (values.assignment < 60) {
    suggestions.push(
      "Review assignment feedback and practise the topics that need more attention."
    );
  }

  if (values.sleep < 7) {
    suggestions.push(
      "Consider a regular sleep routine that supports adequate rest."
    );
  }

  if (values.participation < 60) {
    suggestions.push(
      "Explore ways to ask questions and participate more comfortably in class."
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Maintain consistent study habits and review progress regularly."
    );

    suggestions.push(
      "Set a realistic learning goal and discuss feedback with a teacher."
    );
  }

  if (score < 50) {
    suggestions.unshift(
      "Discuss the student's individual learning needs with a teacher before choosing interventions."
    );
  }

  return suggestions.slice(0, 5);
}

/*
  Draw a horizontal feature-contribution chart.

  Both explanation views use the formula's contributions.
  Neither view runs the SHAP or LIME algorithms.
*/
function renderBars(targetId, contributions) {
  const target = $(targetId);

  target.replaceChildren();

  const sorted = [...contributions].sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value)
  );

  const maxValue = Math.max(
    1,
    ...sorted.map(item => Math.abs(item.value))
  );

  for (const item of sorted) {
    const row = document.createElement("div");
    row.className = "bar-item";

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = item.label;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");

    fill.className =
      "bar-fill " +
      (item.value >= 0 ? "positive" : "negative");

    const width = Math.max(
      3,
      (Math.abs(item.value) / maxValue) * 100
    );

    fill.style.width = `${width}%`;

    track.appendChild(fill);

    const value = document.createElement("span");
    value.className = "bar-value";

    value.textContent =
      `${item.value >= 0 ? "+" : "−"}${Math.abs(item.value).toFixed(1)}`;

    row.append(label, track, value);
    target.appendChild(row);
  }
}

/* Display the prediction, chart values and recommendations. */
function renderPrediction(result) {
  $("emptyState").hidden = true;
  $("predictionOutput").hidden = false;

  $("resultName").textContent =
    `Student: ${result.name}`;

  $("scoreValue").textContent = result.score;
  $("resultCategory").textContent = result.category;
  $("resultMessage").textContent = result.message;

  $("resultPanel").querySelector(".status-pill").textContent =
    "Prediction generated";

  let ringColor;

  if (result.score >= 65) {
    ringColor = "var(--green)";
  } else if (result.score >= 50) {
    ringColor = "var(--orange)";
  } else {
    ringColor = "var(--red)";
  }

  $("scoreRing").style.background =
    `conic-gradient(${ringColor} ${result.score}%, var(--surface2) ${result.score}%)`;

  /* Render personalized suggestions safely. */
  const suggestionList = $("suggestions");
  suggestionList.replaceChildren();

  for (const suggestion of result.suggestions) {
    const li = document.createElement("li");
    li.textContent = suggestion;
    suggestionList.appendChild(li);
  }

  /* Render feature contributions in both explanation views. */
  renderBars("shapChart", result.contributions);
  renderBars("limeChart", result.contributions);

  /* Explain the largest positive and negative contributions. */
  const positive = [...result.contributions]
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const negative = [...result.contributions]
    .filter(item => item.value < 0)
    .sort((a, b) => a.value - b.value);

  let explanation =
    "The charts show how the predefined scoring formula responds to the entered student information.";

  if (positive.length && negative.length) {
    explanation =
      `${positive[0].label} raises the calculated score the most relative to its reference value, while ${negative[0].label} lowers it the most. These are formula effects, not causal findings or calculated SHAP/LIME values.`;
  } else if (positive.length) {
    explanation =
      `${positive[0].label} raises the calculated score the most relative to its reference value. No feature has a negative contribution relative to its reference value in this calculation.`;
  } else if (negative.length) {
    explanation =
      `${negative[0].label} lowers the calculated score the most relative to its reference value. No feature has a positive contribution relative to its reference value in this calculation.`;
  }

  $("explanationText").textContent = explanation;
}

/* Display saved records in the history table. */
function renderHistory() {
  const history = getHistory();

  $("historyCount").textContent = history.length;

  const body = $("historyBody");
  body.replaceChildren();

  if (history.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.className = "history-empty";
    cell.textContent = "No predictions saved yet.";

    row.appendChild(cell);
    body.appendChild(row);

    return;
  }

  for (const item of history) {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = item.name;

    const score = document.createElement("td");
    score.textContent = `${item.score}/100`;

    const category = document.createElement("td");
    const tag = document.createElement("span");

    tag.className = "category-tag";
    tag.textContent = item.category;

    category.appendChild(tag);

    const date = document.createElement("td");
    const parsedDate = new Date(item.date);

    date.textContent = Number.isNaN(parsedDate.getTime())
      ? "Unknown"
      : parsedDate.toLocaleString();

    row.append(name, score, category, date);
    body.appendChild(row);
  }
}

/* Handle the student prediction form. */
$("studentForm").addEventListener("submit", event => {
  event.preventDefault();

  const form = $("studentForm");

  if (!form.reportValidity()) {
    return;
  }

  const name = $("studentName").value.trim();

  if (!name) {
    showToast("Please enter the student's name.");
    $("studentName").focus();
    return;
  }

  const values = getStudentInputs();

  const ranges = {
    attendance: [0, 100],
    previous: [0, 100],
    study: [0, 16],
    assignment: [0, 100],
    sleep: [0, 16],
    participation: [0, 100]
  };

  for (const [key, range] of Object.entries(ranges)) {
    const [min, max] = range;

    if (
      !Number.isFinite(values[key]) ||
      values[key] < min ||
      values[key] > max
    ) {
      showToast(`Please enter a valid value for ${key}.`);
      $(key).focus();
      return;
    }
  }

  const score = calculateScore(values);
  const categoryInfo = getCategory(score);
  const contributions = calculateContributions(values);

  const result = {
    name,
    values,
    score,
    category: categoryInfo.label,
    message: categoryInfo.message,
    contributions,
    suggestions: getSuggestions(values, score),
    date: new Date().toISOString()
  };

  renderPrediction(result);

  const history = getHistory();
  history.unshift(result);

  saveHistory(history);
  renderHistory();

  $("resultPanel").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  showToast("Student prediction generated successfully.");
});

/* Clear the form and reset the current result display. */
$("resetBtn").addEventListener("click", () => {
  setTimeout(() => {
    $("predictionOutput").hidden = true;
    $("emptyState").hidden = false;

    $("resultPanel").querySelector(".status-pill").textContent =
      "Awaiting input";

    $("scoreRing").style.background =
      "conic-gradient(var(--green) 0%, var(--surface2) 0%)";

    $("shapChart").replaceChildren();
    $("limeChart").replaceChildren();

    const shapEmpty = document.createElement("p");
    shapEmpty.className = "chart-empty";
    shapEmpty.textContent = "Generate a prediction to see the chart.";

    const limeEmpty = document.createElement("p");
    limeEmpty.className = "chart-empty";
    limeEmpty.textContent = "Generate a prediction to see the chart.";

    $("shapChart").appendChild(shapEmpty);
    $("limeChart").appendChild(limeEmpty);

    $("explanationText").textContent =
      "Submit a student profile to see which inputs raise or lower the calculated score relative to their reference values.";
  }, 0);
});

/* Delete locally saved prediction history. */
$("clearHistoryBtn").addEventListener("click", () => {
  if (getHistory().length === 0) {
    showToast("There is no history to clear.");
    return;
  }

  const confirmed = confirm(
    "Delete all saved prediction records from this browser?"
  );

  if (!confirmed) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showToast("Prediction history cleared.");
  } catch {
    showToast("Could not clear the saved history.");
  }
});

/* Export saved records as a CSV file. */
$("exportBtn").addEventListener("click", () => {
  const history = getHistory();

  if (history.length === 0) {
    showToast("Generate a prediction before exporting history.");
    return;
  }

  const columns = [
    "Student",
    "Estimated Score",
    "Category",
    "Date"
  ];

  const escapeCSV = value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const rows = history.map(item => [
    item.name,
    item.score,
    item.category,
    item.date
  ]);

  const csv = [columns, ...rows]
    .map(row => row.map(escapeCSV).join(","))
    .join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "student-performance-history.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast("CSV export prepared.");
});

/* Switch between dark and light themes. */
$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("light");

  const theme = document.body.classList.contains("light")
    ? "light"
    : "dark";

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    showToast("Theme changed for this session.");
  }
});

/* Restore the saved theme when the page loads. */
try {
  if (localStorage.getItem(THEME_KEY) === "light") {
    document.body.classList.add("light");
  }
} catch {
  // The default dark theme remains available.
}

/* Load the saved prediction history. */
renderHistory();
