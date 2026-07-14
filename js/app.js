/* ============================================================
   Personal Financial Planning Scenario Planner — logic
   Plain JavaScript, no libraries. Everything runs in the
   browser; nothing is stored or transmitted.

   Sections:
   1. Scenario presets & example data
   2. Reading & validating inputs
   3. The projection math (the heart of the app)
   4. Rendering results, comparison table, data table
   5. Chart drawing (plain <canvas>)
   6. Tooltips, buttons, event wiring
   ============================================================ */

"use strict";

/* ---------- 1. Scenario presets & example data ---------- */

// Assumption presets for the three scenarios (percent per year).
// These are illustrative round numbers, not predictions.
const SCENARIO_PRESETS = {
  conservative: { investmentReturn: 4.5, incomeGrowth: 2.0, inflationRate: 3.0 },
  moderate:     { investmentReturn: 6.0, incomeGrowth: 3.0, inflationRate: 2.5 },
  optimistic:   { investmentReturn: 7.5, incomeGrowth: 4.0, inflationRate: 2.0 },
};

const SCENARIO_LABELS = {
  conservative: "Conservative",
  moderate: "Moderate",
  optimistic: "Optimistic",
};

// Chart line colors — keep in sync with the CSS custom properties.
const SCENARIO_COLORS = {
  conservative: "#b45309",
  moderate: "#2563eb",
  optimistic: "#15803d",
};

// Default values shown when the page loads (also used by "Reset").
const DEFAULT_INPUTS = {
  currentAge: 30,
  retirementAge: 65,
  annualIncome: 70000,
  currentSavings: 40000,
  monthlyContribution: 1200,
  annualExpenses: 48000,
  retirementSpending: 36000,
  majorExpenseAmount: 30000,
  majorExpenseAge: 40,
};

// A second worked example: a mid-career household saving for college.
const EXAMPLE_INPUTS = {
  currentAge: 45,
  retirementAge: 67,
  annualIncome: 95000,
  currentSavings: 220000,
  monthlyContribution: 900,
  annualExpenses: 62000,
  retirementSpending: 50000,
  majorExpenseAmount: 60000,
  majorExpenseAge: 52,
};

// We project everyone's plan out to this age.
const PLAN_END_AGE = 95;

// The "4% rule" of thumb: a nest egg of ~25x first-year spending.
const TARGET_MULTIPLE = 25;

// The user may tweak assumptions; edits are remembered per scenario.
const scenarioAssumptions = {
  conservative: { ...SCENARIO_PRESETS.conservative },
  moderate: { ...SCENARIO_PRESETS.moderate },
  optimistic: { ...SCENARIO_PRESETS.optimistic },
};

let activeScenario = "moderate";

/* ---------- 2. Reading & validating inputs ---------- */

const $ = (id) => document.getElementById(id);

const INPUT_IDS = [
  "currentAge", "retirementAge", "annualIncome", "currentSavings",
  "monthlyContribution", "annualExpenses", "retirementSpending",
  "majorExpenseAmount", "majorExpenseAge",
  "investmentReturn", "incomeGrowth", "inflationRate",
];

// Per-field rules: min/max and a friendly message.
const RULES = {
  currentAge:          { min: 16,  max: 99,  label: "Current age" },
  retirementAge:       { min: 17,  max: 100, label: "Retirement age" },
  annualIncome:        { min: 0,   max: 1e8, label: "Annual income" },
  currentSavings:      { min: 0,   max: 1e9, label: "Current savings" },
  monthlyContribution: { min: 0,   max: 1e7, label: "Monthly contribution" },
  annualExpenses:      { min: 0,   max: 1e8, label: "Annual expenses" },
  retirementSpending:  { min: 0,   max: 1e8, label: "Retirement spending" },
  majorExpenseAmount:  { min: 0,   max: 1e9, label: "Major expense amount" },
  majorExpenseAge:     { min: 16,  max: 100, label: "Major expense age" },
  investmentReturn:    { min: -20, max: 30,  label: "Investment return" },
  incomeGrowth:        { min: -10, max: 30,  label: "Income growth" },
  inflationRate:       { min: -5,  max: 30,  label: "Inflation rate" },
};

function setFieldError(id, message) {
  const input = $(id);
  const err = $("err-" + id);
  if (err) err.textContent = message || "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

// Read all inputs, validate them, and show inline messages.
// Returns { values, valid }.
function readInputs() {
  const values = {};
  let valid = true;

  for (const id of INPUT_IDS) {
    const raw = $(id).value.trim();
    const num = Number(raw);
    const rule = RULES[id];

    if (raw === "" || !Number.isFinite(num)) {
      setFieldError(id, "Please enter a number.");
      valid = false;
      values[id] = NaN;
    } else if (num < rule.min || num > rule.max) {
      setFieldError(id, `${rule.label} should be between ${rule.min} and ${rule.max}.`);
      valid = false;
      values[id] = num;
    } else {
      setFieldError(id, "");
      values[id] = num;
    }
  }

  // Cross-field checks (only if the individual fields look OK).
  if (valid) {
    if (values.retirementAge <= values.currentAge) {
      setFieldError("retirementAge", "Retirement age must be greater than your current age.");
      valid = false;
    }
    if (values.majorExpenseAmount > 0 && values.majorExpenseAge < values.currentAge) {
      setFieldError("majorExpenseAge", "The major expense age can't be before your current age.");
      valid = false;
    }
  }

  return { values, valid };
}

/* ---------- 3. The projection math ---------- */

/**
 * Project a plan year by year from the current age to PLAN_END_AGE.
 *
 * Simplified model, applied once per year:
 *  - Before retirement: balance grows by the investment return,
 *    then a year's contributions are added. Contributions grow
 *    each year at the income growth rate.
 *  - The major expense (if any) is inflated from today's dollars
 *    and subtracted in the year it occurs.
 *  - From retirement onward: balance grows by the investment
 *    return and one year of spending is withdrawn. Spending
 *    starts at the retirement-spending input (today's dollars)
 *    inflated to the retirement year, then rises with inflation.
 *  - The balance is floored at $0 (no borrowing).
 *
 * Returns the year-by-year points plus the headline numbers.
 */
function project(v, assumptions) {
  const r = assumptions.investmentReturn / 100; // investment return
  const g = assumptions.incomeGrowth / 100;     // income (contribution) growth
  const i = assumptions.inflationRate / 100;    // inflation

  const hasExpense = v.majorExpenseAmount > 0;

  let balance = v.currentSavings;
  let yearlyContribution = v.monthlyContribution * 12;

  const points = [{ age: v.currentAge, balance }];

  let atRetirement = null;      // balance at retirement age
  let afterExpense = null;      // balance right after the major expense
  let depletedAge = null;       // first age the money runs out (if ever)

  // First-year retirement spending: today's dollars inflated to retirement.
  const yearsToRetirement = v.retirementAge - v.currentAge;
  const firstYearSpending = v.retirementSpending * Math.pow(1 + i, yearsToRetirement);

  let spending = firstYearSpending;

  for (let age = v.currentAge + 1; age <= PLAN_END_AGE; age++) {
    // Growth on last year's balance.
    balance *= (1 + r);

    if (age <= v.retirementAge) {
      // Still working: add this year's contributions.
      balance += yearlyContribution;
      yearlyContribution *= (1 + g);
    } else {
      // Retired: withdraw this year's spending (rising with inflation).
      balance -= spending;
      spending *= (1 + i);
    }

    // One-time major expense, inflated from today to the year it occurs.
    if (hasExpense && age === v.majorExpenseAge) {
      const inflated = v.majorExpenseAmount * Math.pow(1 + i, age - v.currentAge);
      balance -= inflated;
      afterExpense = Math.max(0, balance);
    }

    // No borrowing: floor at zero and remember when the money ran out.
    if (balance <= 0) {
      balance = 0;
      if (depletedAge === null) depletedAge = age;
    }

    if (age === v.retirementAge) atRetirement = balance;

    points.push({ age, balance });
  }

  // Edge case: expense happens "now" (at the current age) — apply immediately.
  if (hasExpense && v.majorExpenseAge === v.currentAge) {
    // Recompute simply: subtract from the starting balance and re-run.
    const adjusted = { ...v, currentSavings: Math.max(0, v.currentSavings - v.majorExpenseAmount), majorExpenseAmount: 0 };
    const rerun = project(adjusted, assumptions);
    rerun.afterExpense = adjusted.currentSavings;
    return rerun;
  }

  const target = firstYearSpending * TARGET_MULTIPLE;
  const gap = atRetirement - target;

  return { points, atRetirement, afterExpense, firstYearSpending, target, gap, depletedAge, hasExpense };
}

/* ---------- 4. Rendering results ---------- */

const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

function money(n) {
  return fmtUSD.format(Math.round(n));
}

// Compact money for chart axis labels: $250k, $1.2M.
function moneyShort(n) {
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + Math.round(n);
}

function renderResults(results, v) {
  const active = results[activeScenario];

  $("res-atRetirement").textContent = money(active.atRetirement);
  $("res-afterExpense").textContent = active.hasExpense && active.afterExpense !== null
    ? money(active.afterExpense)
    : "No major expense";
  $("res-firstYearSpending").textContent = money(active.firstYearSpending) + "/yr";

  const gapEl = $("res-gap");
  gapEl.textContent = (active.gap >= 0 ? "+" : "−") + money(Math.abs(active.gap));
  gapEl.style.color = active.gap >= 0 ? "var(--good)" : "var(--bad)";

  // Verdict banner: compare savings at retirement to the 25x target,
  // and also check whether the money actually lasts to PLAN_END_AGE.
  const verdict = $("verdict");
  const ratio = active.target > 0 ? active.atRetirement / active.target : Infinity;
  const lasts = active.depletedAge === null || active.depletedAge > PLAN_END_AGE;

  let cls, msg;
  if (ratio >= 1 && lasts) {
    cls = "good";
    msg = `✅ <strong>Looking on track.</strong> Under the ${SCENARIO_LABELS[activeScenario]} scenario, your projected savings at age ${v.retirementAge} (${money(active.atRetirement)}) meet the rule-of-thumb target of ${money(active.target)} (25× first-year spending), and the money lasts past age ${PLAN_END_AGE}.`;
  } else if (ratio >= 0.75) {
    cls = "warn";
    msg = `⚠️ <strong>Close, but there may be a gap.</strong> Projected savings at age ${v.retirementAge} are ${money(active.atRetirement)}, about ${Math.round(ratio * 100)}% of the ${money(active.target)} rule-of-thumb target.` +
      (active.depletedAge ? ` In this projection the money runs out around age ${active.depletedAge}.` : "");
  } else {
    cls = "bad";
    msg = `❗ <strong>This plan looks off track.</strong> Projected savings at age ${v.retirementAge} are ${money(active.atRetirement)}, versus a rule-of-thumb target of ${money(active.target)}.` +
      (active.depletedAge ? ` In this projection the money runs out around age ${active.depletedAge}.` : "") +
      ` Consider saving more, retiring later, or planning lower retirement spending.`;
  }
  verdict.className = "verdict " + cls;
  verdict.innerHTML = msg;

  // A small context line comparing spending plans.
  const spendRatio = v.annualExpenses > 0 ? Math.round((v.retirementSpending / v.annualExpenses) * 100) : null;
  $("res-detail").textContent = spendRatio !== null
    ? `Your planned retirement spending (${money(v.retirementSpending)}/yr today) is about ${spendRatio}% of your current expenses (${money(v.annualExpenses)}/yr). Many planners suggest 70–80% as a starting point. Target uses the 4% rule: 25 × first-year spending.`
    : "";
}

function renderComparison(results) {
  const rows = [
    ["Investment return", (s) => scenarioAssumptions[s].investmentReturn + "%"],
    ["Income growth", (s) => scenarioAssumptions[s].incomeGrowth + "%"],
    ["Inflation", (s) => scenarioAssumptions[s].inflationRate + "%"],
    ["Savings at retirement", (s) => money(results[s].atRetirement)],
    ["First-year retirement spending", (s) => money(results[s].firstYearSpending)],
    ["Rule-of-thumb target (25×)", (s) => money(results[s].target)],
    ["Gap / surplus", (s) => (results[s].gap >= 0 ? "+" : "−") + money(Math.abs(results[s].gap))],
    ["Money lasts until", (s) => results[s].depletedAge ? "age " + results[s].depletedAge : "age " + PLAN_END_AGE + "+"],
  ];

  const tbody = $("comparison-table").querySelector("tbody");
  tbody.innerHTML = "";
  for (const [label, fn] of rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    tr.appendChild(th);
    for (const s of ["conservative", "moderate", "optimistic"]) {
      const td = document.createElement("td");
      td.textContent = fn(s);
      if (label === "Gap / surplus") {
        td.style.color = results[s].gap >= 0 ? "var(--good)" : "var(--bad)";
        td.style.fontWeight = "600";
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// Accessible alternative to the chart: savings by age, every 5 years.
function renderDataTable(results) {
  const tbody = $("data-table").querySelector("tbody");
  tbody.innerHTML = "";
  const ages = results.moderate.points.map((p) => p.age);

  ages.forEach((age, idx) => {
    const isLast = idx === ages.length - 1;
    if (age % 5 !== 0 && !isLast && idx !== 0) return; // show every 5 years + endpoints
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = age;
    tr.appendChild(th);
    for (const s of ["conservative", "moderate", "optimistic"]) {
      const td = document.createElement("td");
      td.textContent = money(results[s].points[idx].balance);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

/* ---------- 5. Chart drawing (plain canvas) ---------- */

function drawChart(results, v) {
  const canvas = $("chart");
  const wrap = canvas.parentElement;

  // Handle high-DPI screens so lines stay crisp.
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = wrap.clientWidth - 16; // minus padding
  const cssHeight = 320;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { top: 16, right: 16, bottom: 34, left: 62 };
  const plotW = cssWidth - pad.left - pad.right;
  const plotH = cssHeight - pad.top - pad.bottom;
  if (plotW <= 0 || plotH <= 0) return;

  const series = ["conservative", "moderate", "optimistic"];
  const minAge = v.currentAge;
  const maxAge = PLAN_END_AGE;
  let maxBal = 0;
  for (const s of series) {
    for (const p of results[s].points) maxBal = Math.max(maxBal, p.balance);
  }
  if (maxBal <= 0) maxBal = 1;

  // Round the axis top up to a "nice" number (1, 2, 2.5, or 5 × a power
  // of ten) so gridline labels read cleanly ($500k, $1M, ... not $5.2M).
  const rawStep = (maxBal * 1.05) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceStep = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep);
  maxBal = niceStep * 5;

  const x = (age) => pad.left + ((age - minAge) / (maxAge - minAge)) * plotW;
  const y = (bal) => pad.top + plotH - (bal / maxBal) * plotH;

  // --- gridlines & y-axis labels (5 steps) ---
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let t = 0; t <= 5; t++) {
    const val = (maxBal / 5) * t;
    const yy = y(val);
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + plotW, yy);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(moneyShort(val), pad.left - 8, yy);
  }

  // --- x-axis labels (ages, ~every 10 years) ---
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const span = maxAge - minAge;
  const step = span > 50 ? 15 : span > 25 ? 10 : 5;
  const narrow = plotW < 420; // shorter labels on small screens
  for (let age = Math.ceil(minAge / step) * step; age <= maxAge; age += step) {
    ctx.fillText(narrow ? String(age) : "Age " + age, x(age), pad.top + plotH + 8);
  }
  if (narrow) {
    ctx.textAlign = "left";
    ctx.fillText("Age →", pad.left, pad.top + plotH + 22);
  }

  // --- vertical marker at retirement age ---
  ctx.strokeStyle = "#9ca3af";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x(v.retirementAge), pad.top);
  ctx.lineTo(x(v.retirementAge), pad.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#6b7280";
  ctx.textAlign = x(v.retirementAge) > cssWidth - 90 ? "right" : "left";
  ctx.textBaseline = "top";
  ctx.fillText("Retire", x(v.retirementAge) + (ctx.textAlign === "left" ? 5 : -5), pad.top);

  // --- the three scenario lines (active one drawn thicker, on top) ---
  const ordered = series.filter((s) => s !== activeScenario).concat(activeScenario);
  for (const s of ordered) {
    ctx.beginPath();
    results[s].points.forEach((p, idx) => {
      const px = x(p.age);
      const py = y(p.balance);
      if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = SCENARIO_COLORS[s];
    ctx.lineWidth = s === activeScenario ? 3 : 1.75;
    ctx.globalAlpha = s === activeScenario ? 1 : 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- legend (HTML, so screen readers & printing behave well) ---
  const legend = $("chart-legend");
  legend.innerHTML = series.map((s) =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${SCENARIO_COLORS[s]}"></span>` +
    `${SCENARIO_LABELS[s]}${s === activeScenario ? " (selected)" : ""}</span>`
  ).join("");
}

/* ---------- 6. Recalculate + event wiring ---------- */

// Recompute all three scenarios and refresh every part of the page.
function recalculate() {
  const { values, valid } = readInputs();
  if (!valid) return; // keep the last good results on screen while the user types

  // Save the (possibly edited) assumption fields into the active scenario.
  scenarioAssumptions[activeScenario] = {
    investmentReturn: values.investmentReturn,
    incomeGrowth: values.incomeGrowth,
    inflationRate: values.inflationRate,
  };

  const results = {};
  for (const s of ["conservative", "moderate", "optimistic"]) {
    results[s] = project(values, scenarioAssumptions[s]);
  }

  renderResults(results, values);
  renderComparison(results);
  renderDataTable(results);
  drawChart(results, values);
}

// Fill the assumption inputs from the active scenario's stored values.
function loadAssumptionFields() {
  const a = scenarioAssumptions[activeScenario];
  $("investmentReturn").value = a.investmentReturn;
  $("incomeGrowth").value = a.incomeGrowth;
  $("inflationRate").value = a.inflationRate;

  const preset = SCENARIO_PRESETS[activeScenario];
  const customized = ["investmentReturn", "incomeGrowth", "inflationRate"]
    .some((k) => a[k] !== preset[k]);
  $("assumption-note").innerHTML =
    `Using <strong>${SCENARIO_LABELS[activeScenario]}</strong> assumptions` +
    (customized ? " (customized by you)." : ".");
}

function setInputs(data) {
  for (const [id, val] of Object.entries(data)) {
    if ($(id)) $(id).value = val;
  }
}

function resetPlanner() {
  setInputs(DEFAULT_INPUTS);
  for (const s of Object.keys(SCENARIO_PRESETS)) {
    scenarioAssumptions[s] = { ...SCENARIO_PRESETS[s] };
  }
  activeScenario = "moderate";
  document.querySelector('input[name="scenario"][value="moderate"]').checked = true;
  loadAssumptionFields();
  recalculate();
}

function init() {
  // Recalculate on any input change (typing included).
  $("planner-form").addEventListener("input", recalculate);
  $("planner-form").addEventListener("submit", (e) => e.preventDefault());

  // Scenario switching.
  document.querySelectorAll('input[name="scenario"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      activeScenario = radio.value;
      loadAssumptionFields();
      recalculate();
    });
  });

  // Toolbar buttons.
  $("btn-reset").addEventListener("click", resetPlanner);
  $("btn-example").addEventListener("click", () => {
    setInputs(EXAMPLE_INPUTS);
    recalculate();
  });
  $("btn-print").addEventListener("click", () => window.print());

  // Tooltips: hover/focus is handled by CSS; clicks (and taps on
  // touch screens) toggle them, Escape or clicking elsewhere closes.
  document.querySelectorAll(".tip").forEach((tip) => {
    tip.addEventListener("click", (e) => {
      e.preventDefault();
      const wasOpen = tip.classList.contains("tip-open");
      document.querySelectorAll(".tip-open").forEach((t) => t.classList.remove("tip-open"));
      if (!wasOpen) tip.classList.add("tip-open");
    });
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".tip")) {
      document.querySelectorAll(".tip-open").forEach((t) => t.classList.remove("tip-open"));
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".tip-open").forEach((t) => t.classList.remove("tip-open"));
    }
  });

  // Redraw the chart when the window is resized (debounced).
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(recalculate, 150);
  });

  // Open the collapsible sections automatically when printing.
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
  });

  loadAssumptionFields();
  recalculate();
}

// Only wire up the page when running in a browser.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

// Expose the pure math for testing in Node (ignored by browsers).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { project, SCENARIO_PRESETS, DEFAULT_INPUTS, EXAMPLE_INPUTS };
}
