import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { initTheme } from "./theme.js";
import { fmtMSS, fmtHMS, paceRange, computeTrainingPlan } from "./plan-engine.js";

initTheme();
renderNav("tools");
await requireAuth();
document.getElementById("app-content").hidden = false;

/* ── LOCK STATE (Yasso) ── */
const lockState = { 800: true, rec: true };
const LOCK_ICONS = {
  locked: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  unlocked: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>`,
};
function toggleLock(key) {
  lockState[key] = !lockState[key];
  const block = document.getElementById("block-" + key),
    lb = document.getElementById("lock-" + key),
    slider = document.getElementById("slider-" + key);
  if (lockState[key]) {
    block.classList.remove("is-unlocked");
    lb.classList.remove("is-unlocked");
    slider.disabled = true;
    lb.innerHTML = LOCK_ICONS.locked + (key === "800" ? " Locked to HM" : " Locked to 800 m");
    updateYasso(parseInt(document.getElementById("hm-slider").value));
  } else {
    block.classList.add("is-unlocked");
    lb.classList.add("is-unlocked");
    slider.disabled = false;
    lb.innerHTML = LOCK_ICONS.unlocked + " Unlocked";
  }
}
document.getElementById("lock-800").addEventListener("click", () => toggleLock("800"));
document.getElementById("lock-rec").addEventListener("click", () => toggleLock("rec"));

/* ── YASSO ── */
let goalReps = 10;
function buildRepList(repSec) {
  const maxReps = goalReps,
    startReps = Math.min(4, maxReps),
    steps = [];
  for (let r = startReps; r <= maxReps; r++) steps.push(r);
  const repData = [];
  if (maxReps <= 4) {
    repData.push([maxReps, "Week 1", "ready"]);
  } else {
    const total = maxReps - startReps + 1;
    steps.forEach((r, i) => {
      const week = i === 0 ? "Week 1" : i === total - 1 ? "Week " + total + "+" : "Week " + (i + 1);
      const pct = i / (total - 1);
      const type = pct < 0.35 ? "building" : pct < 0.7 ? "progressing" : "ready";
      repData.push([r, week, type]);
    });
  }
  const list = document.getElementById("rep-list");
  list.innerHTML = "";
  repData.forEach(([reps, week, type]) => {
    const pct = Math.round((reps / maxReps) * 100);
    const bc = type === "building" ? "badge-building" : type === "progressing" ? "badge-progressing" : "badge-ready";
    const row = document.createElement("div");
    row.className = "rep-row";
    row.innerHTML = `<div class="rep-num">${reps}</div><span class="rep-week">${week}</span><div class="rep-bar-wrap"><div class="rep-bar" style="width:${pct}%"></div></div><span class="rep-time">${fmtMSS(repSec)} ×${reps}</span><span class="badge ${bc}">${type}</span>`;
    list.appendChild(row);
  });
}
function getRepSec() {
  return lockState["800"] ? (parseInt(document.getElementById("hm-slider").value) * 60) / 60 : parseInt(document.getElementById("slider-800").value);
}
function getRecSec() {
  return lockState["rec"] ? getRepSec() : parseInt(document.getElementById("slider-rec").value);
}
function updateYasso(hmMin) {
  const repSec = lockState["800"] ? (hmMin * 60) / 60 : getRepSec();
  const recSec = lockState["rec"] ? repSec : getRecSec();
  document.getElementById("hm-display").textContent = fmtHMS(hmMin);
  document.getElementById("slider-display").textContent = fmtHMS(hmMin);
  document.getElementById("target-800").textContent = fmtMSS(repSec);
  document.getElementById("recovery-time").textContent = fmtMSS(recSec);
  document.getElementById("reps-display").textContent = goalReps;
  document.getElementById("km-pace").textContent = fmtMSS(repSec / 0.8);
  if (lockState["800"]) {
    document.getElementById("slider-800").value = repSec;
    document.getElementById("val-800").textContent = fmtMSS(repSec);
  }
  if (lockState["rec"]) {
    document.getElementById("slider-rec").value = recSec;
    document.getElementById("val-rec").textContent = fmtMSS(recSec);
  }
  const warmCool = 25 * 60,
    sessionSec = warmCool + goalReps * repSec + (goalReps - 1) * recSec,
    distKm = Math.round((2 + goalReps * 0.8 + (goalReps - 1) * 0.3) * 10) / 10;
  document.getElementById("session-dur").textContent = "~" + Math.round(sessionSec / 60) + " min";
  document.getElementById("session-dist").textContent = "~" + distKm + " km";
  buildRepList(repSec);
}
function updateReps() {
  goalReps = parseInt(document.getElementById("slider-reps").value);
  document.getElementById("val-reps").textContent = goalReps;
  updateYasso(parseInt(document.getElementById("hm-slider").value));
}
document.getElementById("hm-slider").addEventListener("input", (e) => updateYasso(parseInt(e.target.value)));
document.getElementById("slider-reps").addEventListener("input", updateReps);
document.getElementById("slider-800").addEventListener("input", (e) => {
  const sec = parseInt(e.target.value);
  document.getElementById("val-800").textContent = fmtMSS(sec);
  document.getElementById("target-800").textContent = fmtMSS(sec);
  document.getElementById("km-pace").textContent = fmtMSS(sec / 0.8);
  if (lockState["rec"]) {
    document.getElementById("slider-rec").value = sec;
    document.getElementById("val-rec").textContent = fmtMSS(sec);
    document.getElementById("recovery-time").textContent = fmtMSS(sec);
  }
  buildRepList(sec);
});
document.getElementById("slider-rec").addEventListener("input", (e) => {
  const sec = parseInt(e.target.value);
  document.getElementById("val-rec").textContent = fmtMSS(sec);
  document.getElementById("recovery-time").textContent = fmtMSS(sec);
  const repSec = getRepSec(),
    sessionSec = 25 * 60 + goalReps * repSec + (goalReps - 1) * sec;
  document.getElementById("session-dur").textContent = "~" + Math.round(sessionSec / 60) + " min";
});
updateYasso(110);

/* ── PACE CALC ── */
function calcPace() {
  const h = parseInt(document.getElementById("pace-h").value) || 0,
    m = parseInt(document.getElementById("pace-m").value) || 0,
    s = parseInt(document.getElementById("pace-s").value) || 0,
    dist = parseFloat(document.getElementById("pace-dist").value),
    totalSec = h * 3600 + m * 60 + s;
  if (!totalSec || !dist) return;
  const paceKm = totalSec / dist,
    paceMile = paceKm * 1.60934,
    split5k = paceKm * 5;
  document.getElementById("pace-result").textContent = fmtMSS(paceKm);
  document.getElementById("pace-mile").textContent = fmtMSS(paceMile);
  document.getElementById("pace-5k-split").textContent = fmtMSS(split5k);
}
["pace-h", "pace-m", "pace-s"].forEach((id) => document.getElementById(id).addEventListener("input", calcPace));
document.getElementById("pace-dist").addEventListener("change", calcPace);
calcPace();

/* ── HR ZONES ── */
const zones = [
  { name: "Z1 Recovery", pct: [50, 60], color: "#4dd9c0" },
  { name: "Z2 Aerobic", pct: [60, 70], color: "#4da6ff" },
  { name: "Z3 Tempo", pct: [70, 80], color: "#7b8eff" },
  { name: "Z4 Threshold", pct: [80, 90], color: "#f0a35a" },
  { name: "Z5 VO2 max", pct: [90, 100], color: "#f07a5a" },
];
function calcZones() {
  const maxHR = parseInt(document.getElementById("hr-slider").value);
  document.getElementById("hr-display").textContent = maxHR + " bpm";
  const list = document.getElementById("zone-list");
  list.innerHTML = "";
  zones.forEach((z) => {
    const lo = Math.round((maxHR * z.pct[0]) / 100),
      hi = Math.round((maxHR * z.pct[1]) / 100),
      barW = (z.pct[1] - z.pct[0]) * 2,
      barOff = (z.pct[0] - 50) * 2;
    const row = document.createElement("div");
    row.className = "zone-row";
    row.innerHTML = `<span class="zone-name">${z.name}</span><div class="zone-bar-outer"><div class="zone-bar-inner" style="width:${barW}%;margin-left:${barOff}%;background:${z.color}"></div></div><span class="zone-range" style="color:${z.color}">${lo}–${hi} bpm</span>`;
    list.appendChild(row);
  });
}
document.getElementById("hr-slider").addEventListener("input", calcZones);
calcZones();

/* ── TRAINING PLANS (via plan-engine.js) — shared by 10k and half marathon tools ── */
const badgeMap = {
  easy: { cls: "tp-badge-easy", label: "Easy" },
  long: { cls: "tp-badge-long", label: "Long" },
  intervals: { cls: "tp-badge-intervals", label: "Intervals" },
  tempo: { cls: "tp-badge-tempo", label: "Threshold" },
  strength: { cls: "tp-badge-strength", label: "Strength" },
  race: { cls: "tp-badge-race", label: "Race" },
  rest: { cls: "tp-badge-rest", label: "Rest" },
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Renders one phase's week list. `overrides` maps week number -> a 7-entry array of
 * day labels (parallel to the week's Mon..Sun-ordered `days`), letting a run be moved
 * to a different day without changing what the session actually is. `onOverrideChange`
 * persists the overrides object after each edit.
 */
function renderWeeks(weeks, containerId, overrides, onOverrideChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  weeks.forEach((w, wi) => {
    const wId = containerId + "-w" + wi,
      dId = containerId + "-d" + wi,
      cId = containerId + "-c" + wi;
    const div = document.createElement("div");
    div.className = "tp-week-row";

    const override = overrides[w.week];
    const displayDays = w.days.map((day, i) => (override ? override[i] : day.d));
    // show rows in calendar order even though the swap only touches labels
    const order = w.days.map((_, i) => i).sort((a, b) => DAY_ORDER.indexOf(displayDays[a]) - DAY_ORDER.indexOf(displayDays[b]));

    const daysHtml = order
      .map((i) => {
        const day = w.days[i];
        const bm = badgeMap[day.t] || badgeMap.rest;
        const options = DAY_ORDER.map((d) => `<option value="${d}"${d === displayDays[i] ? " selected" : ""}>${d}</option>`).join("");
        return `<div class="tp-day-row" data-idx="${i}"><select class="tp-day-select" aria-label="Day">${options}</select><span class="tp-day-badge ${bm.cls}">${bm.label}</span><div class="tp-day-work${day.t === "rest" ? " is-rest" : ""}">${day.w}</div></div>`;
      })
      .join("");

    div.innerHTML = `<div class="tp-week-header" id="${wId}"><span class="tp-week-num">Week ${w.week}</span><span class="tp-week-focus">${w.focus}</span><span class="tp-week-km">${w.km}</span><span class="tp-week-chevron" id="${cId}">▶</span></div><div class="tp-week-detail" id="${dId}"><div class="tp-day-grid">${daysHtml}</div></div>`;
    container.appendChild(div);
    document.getElementById(wId).addEventListener("click", () => {
      const detail = document.getElementById(dId),
        chev = document.getElementById(cId);
      const open = detail.classList.toggle("open");
      chev.classList.toggle("open", open);
    });

    div.querySelectorAll(".tp-day-select").forEach((sel) => {
      sel.addEventListener("click", (e) => e.stopPropagation());
      sel.addEventListener("change", (e) => {
        const idx = parseInt(sel.closest(".tp-day-row").dataset.idx);
        const newDay = e.target.value;
        const current = (overrides[w.week] || w.days.map((d) => d.d)).slice();
        const swapIdx = current.indexOf(newDay);
        [current[idx], current[swapIdx]] = [newDay, current[idx]];
        overrides[w.week] = current;
        onOverrideChange();
        const wasOpen = document.getElementById(dId).classList.contains("open");
        renderWeeks(weeks, containerId, overrides, onOverrideChange);
        if (wasOpen) {
          document.getElementById(containerId + "-d" + wi).classList.add("open");
          document.getElementById(containerId + "-c" + wi).classList.add("open");
        }
      });
    });
  });
}

/**
 * Applies a default weekly schedule (which day each session type falls on) to a list
 * of weeks. Only meant for Base/Build/Sharpen weeks, which always carry exactly one
 * of each role — Taper (race week included) keeps its own fixed day layout since it's
 * anchored to race day. `schedule.strength` may be null/empty to drop it (turns into
 * a rest day) for someone doing their own strength work outside the plan.
 */
function remapWeekDays(weeksArr, schedule) {
  return weeksArr.map((w) => {
    const days = w.days.map((day) => ({ ...day }));
    if (!schedule.strength) {
      days.forEach((day) => {
        if (day.t === "strength") {
          day.t = "rest";
          day.w = "Rest — or your own strength session";
        }
      });
    }

    const used = new Set();
    const unassigned = [];
    days.forEach((day) => {
      const d = schedule[day.t];
      if (d) {
        day.d = d;
        used.add(d);
      } else {
        unassigned.push(day);
      }
    });
    const leftover = DAY_ORDER.filter((d) => !used.has(d));

    // a tune-up race day gets first pick of a weekend slot, if one's free
    unassigned.sort((a, b) => (a.t === "race" ? -1 : b.t === "race" ? 1 : 0));
    unassigned.forEach((day) => {
      let idx = day.t === "race" ? leftover.findIndex((d) => d === "Sat" || d === "Sun") : -1;
      if (idx === -1) idx = 0;
      day.d = leftover.splice(idx, 1)[0];
    });

    return { ...w, days };
  });
}

/**
 * Wires up one training-plan tool instance (sliders, tabs, week lists).
 * @param {string} idPrefix  "" for the 10k plan, "h-" for the half marathon plan
 * @param {number} distanceKm  race distance the plan is built for
 */
function initPlanTool(idPrefix, distanceKm, fmtTime) {
  const id = (s) => idPrefix + s;
  const tabsId = idPrefix ? idPrefix.replace(/-$/, "") + "TpPhaseTabs" : "tpPhaseTabs";
  const strengthTabsId = idPrefix ? idPrefix.replace(/-$/, "") + "StrengthSubTabs" : "strengthSubTabs";
  const stPrefix = idPrefix ? "hst" : "st";
  const tabButtons = [...document.getElementById(tabsId).querySelectorAll(".tp-phase-btn")];
  const panelIds = tabButtons.map((b) => b.dataset.tp);

  const scheduleBlock = document.getElementById(id("sl-schedule-block"));
  document.getElementById(id("sl-edit-schedule-btn")).addEventListener("click", () => {
    scheduleBlock.hidden = !scheduleBlock.hidden;
  });

  // Per-week day swaps (e.g. moving the long run off a busy Saturday), keyed by
  // absolute week number and kept across regenerations/reloads.
  const dayStorageKey = "rda-plan-days-" + (idPrefix || "10k");
  let dayOverrides;
  try {
    dayOverrides = JSON.parse(localStorage.getItem(dayStorageKey)) || {};
  } catch {
    dayOverrides = {};
  }
  function saveDayOverrides() {
    try {
      localStorage.setItem(dayStorageKey, JSON.stringify(dayOverrides));
    } catch {}
  }

  // Default weekly schedule — which day each session type falls on. Persisted like
  // the per-week overrides above; falls back to whatever the selects show in HTML.
  const scheduleSelects = { long: id("sl-day-long"), intervals: id("sl-day-intervals"), easy: id("sl-day-easy"), tempo: id("sl-day-tempo"), strength: id("sl-day-strength") };
  const scheduleStorageKey = "rda-plan-schedule-" + (idPrefix || "10k");
  let schedule;
  try {
    schedule = JSON.parse(localStorage.getItem(scheduleStorageKey));
  } catch {
    schedule = null;
  }
  if (!schedule) {
    schedule = {};
    Object.entries(scheduleSelects).forEach(([role, elId]) => (schedule[role] = document.getElementById(elId).value || null));
  } else {
    Object.entries(scheduleSelects).forEach(([role, elId]) => (document.getElementById(elId).value = schedule[role] || ""));
  }
  function saveSchedule() {
    try {
      localStorage.setItem(scheduleStorageKey, JSON.stringify(schedule));
    } catch {}
  }
  Object.entries(scheduleSelects).forEach(([role, elId]) => {
    document.getElementById(elId).addEventListener("change", (e) => {
      const newDay = e.target.value || null;
      if (newDay) {
        const conflictRole = Object.keys(schedule).find((r) => r !== role && schedule[r] === newDay);
        if (conflictRole) {
          schedule[conflictRole] = schedule[role];
          const conflictEl = document.getElementById(scheduleSelects[conflictRole]);
          conflictEl.value = schedule[conflictRole] || "";
        }
      }
      schedule[role] = newDay;
      saveSchedule();
      generatePlan();
    });
  });

  let planTarget = parseInt(document.getElementById(id("sl-target")).value),
    planCurrent = parseInt(document.getElementById(id("sl-current")).value),
    planWeeks = parseInt(document.getElementById(id("sl-weeks")).value);

  function generatePlan() {
    const plan = computeTrainingPlan(planTarget * 60, distanceKm, planCurrent * 60, planWeeks);
    const { paces, phaseInfo, weeks, tabLabels } = plan;

    document.getElementById(id("pm-race")).textContent = fmtMSS(paces.race);
    document.getElementById(id("pm-int")).textContent = fmtMSS(paces.intC);
    document.getElementById(id("pm-thresh")).textContent = fmtMSS(paces.thresh);
    document.getElementById(id("pm-easy")).textContent = fmtMSS(paces.easy);

    document.getElementById(id("ph0-easy")).textContent = paceRange(...phaseInfo.base.easy);
    document.getElementById(id("ph0-thresh")).textContent = paceRange(...phaseInfo.base.thresh);
    document.getElementById(id("ph0-int")).textContent = paceRange(...phaseInfo.base.int);
    document.getElementById(id("ph0-vol")).textContent = phaseInfo.base.vol;

    document.getElementById(id("ph1-easy")).textContent = paceRange(...phaseInfo.build.easy);
    document.getElementById(id("ph1-thresh")).textContent = paceRange(...phaseInfo.build.thresh);
    document.getElementById(id("ph1-int")).textContent = paceRange(...phaseInfo.build.int);
    document.getElementById(id("ph1-vol")).textContent = phaseInfo.build.vol;

    document.getElementById(id("ph2-easy")).textContent = paceRange(...phaseInfo.sharp.easy);
    document.getElementById(id("ph2-thresh")).textContent = paceRange(...phaseInfo.sharp.thresh);
    document.getElementById(id("ph2-int")).textContent = paceRange(...phaseInfo.sharp.int);
    document.getElementById(id("ph2-vol")).textContent = phaseInfo.sharp.vol;

    document.getElementById(id("ph3-easy")).textContent = paceRange(...phaseInfo.taper.easy);
    document.getElementById(id("ph3-strides")).textContent = "~" + fmtMSS(phaseInfo.taper.strides);
    document.getElementById(id("ph3-race")).textContent = fmtMSS(phaseInfo.taper.race);
    document.getElementById(id("ph3-vol")).textContent = phaseInfo.taper.vol;

    renderWeeks(remapWeekDays(weeks.base, schedule), id("tp-phase0-weeks"), dayOverrides, saveDayOverrides);
    renderWeeks(remapWeekDays(weeks.build, schedule), id("tp-phase1-weeks"), dayOverrides, saveDayOverrides);
    renderWeeks(remapWeekDays(weeks.sharp, schedule), id("tp-phase2-weeks"), dayOverrides, saveDayOverrides);
    renderWeeks(weeks.taper, id("tp-phase3-weeks"), dayOverrides, saveDayOverrides);

    const allLabels = [...tabLabels, "Strength", "Injury rules"];
    tabButtons.forEach((btn, i) => {
      if (allLabels[i]) btn.textContent = allLabels[i];
    });
  }

  document.getElementById(id("sl-target")).addEventListener("input", (e) => {
    planTarget = parseInt(e.target.value);
    document.getElementById(id("sv-target")).textContent = fmtTime(planTarget);
    generatePlan();
  });
  document.getElementById(id("sl-current")).addEventListener("input", (e) => {
    planCurrent = parseInt(e.target.value);
    document.getElementById(id("sv-current")).textContent = fmtTime(planCurrent);
    generatePlan();
  });
  document.getElementById(id("sl-weeks")).addEventListener("input", (e) => {
    planWeeks = parseInt(e.target.value);
    document.getElementById(id("sv-weeks")).textContent = planWeeks + " wks";
    generatePlan();
  });

  generatePlan();

  document.getElementById(tabsId).addEventListener("click", (e) => {
    const btn = e.target.closest(".tp-phase-btn");
    if (!btn) return;
    const target = btn.dataset.tp;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    panelIds.forEach((pid) => document.getElementById(pid).classList.toggle("active", pid === target));
  });

  document.getElementById(strengthTabsId).addEventListener("click", (e) => {
    const btn = e.target.closest(".tp-sub-btn");
    if (!btn) return;
    const target = btn.dataset.st;
    document.querySelectorAll("#" + strengthTabsId + " .tp-sub-btn").forEach((b) => b.classList.toggle("active", b === btn));
    [stPrefix + "A", stPrefix + "B", stPrefix + "C"].forEach((elId) => {
      document.getElementById(elId).style.display = elId === target ? "grid" : "none";
    });
  });
}

initPlanTool("", 10, (m) => m + ":00");
initPlanTool("h-", 21.0975, fmtHMS);

/* ── SUBNAV ── */
document.querySelectorAll(".tools-subnav a").forEach((a) => {
  a.addEventListener("click", function () {
    document.querySelectorAll(".tools-subnav a").forEach((x) => x.classList.remove("active"));
    this.classList.add("active");
  });
});
