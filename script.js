
"use strict";

const HISTORY_KEY = "edulens_history_v3";
const THEME_KEY = "edulens_theme_v1";

const form = document.getElementById("studentForm");
const errorBox = document.getElementById("error");
const predictBtn = document.getElementById("predictBtn");

const featureInfo = [
  { key: "previous", name: "Previous exam score" },
  { key: "assignment", name: "Assignment score" },
  { key: "study", name: "Daily study hours" },
  { key: "attendance", name: "Attendance" },
  { key: "sleep", name: "Daily sleep hours" }
];

function getInputs() {
  const values = {};

  const limits = {
    study: [0, 10],
    attendance: [0, 100],
    previous: [0, 100],
    assignment: [0, 100],
    sleep: [0, 24]
  };

  for (const [key, [min, max]] of Object.entries(limits)) {
    const input = document.getElementById(key);

    if (input.value.trim() === "") {
      throw new Error("Please fill in all five student details.");
    }

    const value = Number(input.value);

    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`Please enter a valid ${key} value between ${min} and ${max}.`);
    }

    values[key] = value;
  }

  return values;
}

/*
  Transparent browser-side scoring formula.
  This is a rule-based estimate, not a trained machine-learning model.
*/
function calculateScore(v) {
  const raw =
    0.80 * v.previous +
    0.15 * v.assignment +
    0.12 * v.attendance +
    1.50 * v.study +
    0.80 * v.sleep -
    19.18;

  return Math.max(0, Math.min(100, raw));
}

function getCategory(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

function getSuggestions(v, score) {
  const suggestions = [];

  if (v.study < 2) {
    suggestions.push("Create a consistent daily study schedule and gradually increase focused study time.");
  } else if (v.study < 4) {
    suggestions.push("Try structured study sessions with short breaks to improve concentration.");
  } else {
    suggestions.push("Maintain your study routine and use practice questions to reinforce learning.");
  }

  if (v.attendance < 75) {
    suggestions.push("Improve class attendance and review any missed lessons.");
  } else {
    suggestions.push("Maintain regular attendance and participate actively in class.");
  }

  if (v.previous < 50) {
    suggestions.push("Review foundational topics and practice questions from previous examinations.");
  }

  if (v.assignment < 60) {
    suggestions.push("Review assignment feedback and work on accuracy, completeness, and deadlines.");
  }

  if (v.sleep < 7) {
    suggestions.push("Consider a consistent sleep schedule that allows sufficient rest.");
  } else if (v.sleep > 9) {
    suggestions.push("Review your daily routine and sleep quality if excessive sleep is affecting study time.");
  }

  if (score >= 80) {
    suggestions.push("Challenge yourself with advanced problems and continue tracking progress.");
  }

  return suggestions.slice(0, 5);
}

/*
  Feature contributions are computed from the formula above.
  They are not outputs from the SHAP or LIME algorithms.
*/
function calculateContributions(v) {
  const contributions = [
    { name: "Previous exam score", value: 0.80 * (v.previous - 50) },
    { name: "Assignment score", value: 0.15 * (v.assignment - 50) },
    { name: "Daily study hours", value: 1.50 * (v.study - 4) },
    { name: "Attendance", value: 0.12 * (v.attendance - 70) },
    { name: "Daily sleep hours", value: 0.80 * (v.sleep - 7) }
  ];

  return contributions;
}

function renderChart(elementId, items) {
  const element = document.getElementById(elementId);
  const maxValue = Math.max(...items.map(item => Math.abs(item.value)), 0.001);

  element.classList.remove("empty-chart");

  element.innerHTML = [...items]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .map(item => {
      const positive = item.value >= 0;
      const width = Math.max(2, Math.abs(item.value) / maxValue * 100);

      return `
        <div class="chart-row">
          <div class="chart-header">
            <span>${escapeHTML(item.name)}</span>
            <strong style="color:var(--${positive ? "green" : "red"})">
              ${positive ? "+" : ""}${item.value.toFixed(2)}
            </strong>
          </div>
          <div class="chart-track">
            <div class="chart-bar ${positive ? "positive" : "negative"}"
                 style="width:${width}%"></div>
          </div>
        </div>
      `;
    }).join("");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function readHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(data) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data.slice(0, 50)));
  } catch (_) {
    errorBox.textContent = "Browser storage is unavailable. This result may not be saved.";
    errorBox.hidden = false;
  }
}

function showResult(record) {
  document.getElementById("emptyResult").hidden = true;
  document.getElementById("result").hidden = false;

  document.getElementById("score").textContent = record.score.toFixed(1);
  document.getElementById("category").textContent = record.category;
  document.getElementById("resultMessage").textContent =
    "Calculated from the values entered for this assessment.";

  document.getElementById("scoreTrack").style.width = `${record.score}%`;
  document.getElementById("scoreRing").style.background =
    `conic-gradient(var(--accent) ${record.score * 3.6}deg, var(--border) 0deg)`;

  const suggestions = document.getElementById("suggestions");
  suggestions.innerHTML = record.suggestions.map(text => `
    <div class="suggestion">
      <span class="check">✓</span>
      <p>${escapeHTML(text)}</p>
    </div>
  `).join("");

  renderChart("shapChart", record.contributions);

  // Local linear contribution view, not actual LIME algorithm output.
  renderChart("limeChart", record.contributions.map(item => ({
    name: item.name,
    value: item.value * 0.85
  })));
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString();
}

function renderHistory() {
  const history = readHistory();
  const element = document.getElementById("history");

  if (!history.length) {
    element.innerHTML = '<p class="muted">No assessments recorded yet.</p>';
    return;
  }

  element.innerHTML = history.map(record => `
    <div class="history-row">
      <div>
        <h3>${escapeHTML(record.category)}</h3>
        <p>${escapeHTML(formatDate(record.date))}</p>
      </div>
      <div class="history-score">${Number(record.score).toFixed(1)}<span class="muted"> /100</span></div>
      <button type="button" class="view-btn" data-id="${escapeHTML(record.id)}">View result →</button>
    </div>
  `).join("");
}

function openHistory(id) {
  const record = readHistory().find(item => item.id === id);
  if (!record) return;

  const details = [
    ["Daily study hours", record.inputs.study],
    ["Attendance", `${record.inputs.attendance}%`],
    ["Previous exam score", record.inputs.previous],
    ["Assignment score", record.inputs.assignment],
    ["Daily sleep hours", record.inputs.sleep]
  ];

  document.getElementById("modalBody").innerHTML = `
    <p><strong>${Number(record.score).toFixed(1)} / 100</strong> — ${escapeHTML(record.category)}</p>
    <p class="muted">${escapeHTML(formatDate(record.date))}</p>
    <h3>Student details</h3>
    <div class="modal-grid">
      ${details.map(([label, value]) => `
        <div class="modal-item">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>
      `).join("")}
    </div>
    <h3>Suggested improvements</h3>
    <ul>${record.suggestions.map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
    <h3>Feature contributions</h3>
    <p class="muted">These values represent the site's rule-based calculation, not actual SHAP or LIME output.</p>
    <div id="modalChart" class="chart"></div>
  `;

  renderChart("modalChart", record.contributions);
  document.getElementById("modal").hidden = false;
}

form.addEventListener("submit", event => {
  event.preventDefault();
  errorBox.hidden = true;

  try {
    const inputs = getInputs();
    const score = calculateScore(inputs);
    const contributions = calculateContributions(inputs);

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      inputs,
      score,
      category: getCategory(score),
      suggestions: getSuggestions(inputs, score),
      contributions
    };

    showResult(record);

    const history = readHistory();
    history.unshift(record);
    saveHistory(history);
    renderHistory();

  } catch (error) {
    errorBox.textContent = error.message || "Please check the entered details.";
    errorBox.hidden = false;
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  form.reset();
  errorBox.hidden = true;
});

document.getElementById("history").addEventListener("click", event => {
  const button = event.target.closest("[data-id]");
  if (button) openHistory(button.dataset.id);
});

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!readHistory().length) return;

  if (confirm("Delete all previous assessments saved in this browser?")) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }
});

function closeModal() {
  document.getElementById("modal").hidden = true;
}

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("backdrop").addEventListener("click", closeModal);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

const themeBtn = document.getElementById("themeBtn");

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeBtn.textContent = theme === "light" ? "☾" : "☼";
}

applyTheme(localStorage.getItem(THEME_KEY) || "dark");

themeBtn.addEventListener("click", () => {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

renderHistory();
