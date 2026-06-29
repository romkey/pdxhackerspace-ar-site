import {
  CLOCK_FACE_IDS,
  CLOCK_FACE_LABELS,
  normalizeClockFace,
  formatDigitalTime,
  getTimeParts,
  buildAnalogSvg,
  buildOrbitSvg,
} from "./clock-faces.mjs";

const STORAGE_KEY = "ar-site.wall-clock.face";

/** @type {HTMLElement | null} */
let root = null;
/** @type {HTMLElement | null} */
let picker = null;
/** @type {Record<string, HTMLElement>} */
const faceEls = {};
/** @type {string} */
let activeFace = normalizeClockFace(
  typeof localStorage !== "undefined"
    ? localStorage.getItem(STORAGE_KEY)
    : null
);

function init() {
  root = document.getElementById("wall-clock");
  picker = document.getElementById("wall-clock-picker");
  if (!root || !picker) return;

  CLOCK_FACE_IDS.forEach(function (id) {
    const el = root.querySelector(`[data-face="${id}"]`);
    if (el) faceEls[id] = el;
  });

  buildPicker();
  setActiveFace(activeFace, { persist: false });
  bindMarker();
  tick();
  setInterval(tick, 250);
}

function buildPicker() {
  picker.innerHTML = "";
  picker.setAttribute("role", "tablist");
  picker.setAttribute("aria-label", "Clock style");

  CLOCK_FACE_IDS.forEach(function (id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wall-clock__picker-btn";
    btn.setAttribute("role", "tab");
    btn.dataset.face = id;
    btn.textContent = CLOCK_FACE_LABELS[id];
    btn.addEventListener("click", function () {
      setActiveFace(id);
    });
    picker.appendChild(btn);
  });
}

/**
 * @param {string} id
 * @param {{ persist?: boolean }} [options]
 */
function setActiveFace(id, options = {}) {
  activeFace = normalizeClockFace(id);

  CLOCK_FACE_IDS.forEach(function (faceId) {
    const el = faceEls[faceId];
    if (!el) return;
    const selected = faceId === activeFace;
    el.hidden = !selected;
  });

  picker.querySelectorAll(".wall-clock__picker-btn").forEach(function (btn) {
    const selected = btn.dataset.face === activeFace;
    btn.setAttribute("aria-selected", selected ? "true" : "false");
    btn.tabIndex = selected ? 0 : -1;
  });

  if (options.persist !== false) {
    try {
      localStorage.setItem(STORAGE_KEY, activeFace);
    } catch {
      /* ignore quota / private mode */
    }
  }

  tick();
}

function tick() {
  const now = new Date();

  const analog = faceEls.analog;
  if (analog) {
    analog.innerHTML = buildAnalogSvg(now);
  }

  const digital = faceEls.digital;
  if (digital) {
    const parts = getTimeParts(now);
    digital.innerHTML = `<p class="clock-digital__time" aria-hidden="true">${String(
      parts.hours24
    ).padStart(2, "0")}<span class="clock-digital__colon">:</span>${String(
      parts.minutes
    ).padStart(2, "0")}</p><p class="clock-digital__seconds">${String(
      parts.seconds
    ).padStart(2, "0")}</p>`;
    digital.setAttribute("aria-label", formatDigitalTime(now));
  }

  const orbit = faceEls.orbit;
  if (orbit) {
    orbit.innerHTML = buildOrbitSvg(now);
    orbit.setAttribute("aria-label", formatDigitalTime(now));
  }
}

function bindMarker() {
  const marker = document.querySelector("#clock-marker");
  const hint = document.querySelector("#hint");
  if (!marker) return;

  marker.addEventListener("markerFound", function () {
    root.classList.add("is-visible");
    if (hint) hint.classList.add("is-hidden");
  });

  marker.addEventListener("markerLost", function () {
    root.classList.remove("is-visible");
    if (hint) hint.classList.remove("is-hidden");
  });
}

window.setWallClockVisible = function (visible) {
  if (root) root.classList.toggle("is-visible", !!visible);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
