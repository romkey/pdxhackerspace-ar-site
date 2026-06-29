import {
  CLOCK_FACE_IDS,
  CLOCK_FACE_LABELS,
  normalizeClockFace,
  formatDigitalTime,
  getTimeParts,
  buildAnalogSvg,
  buildOrbitSvg,
} from "./clock-faces.js";

const STORAGE_KEY = "ar-site.wall-clock.face";

/** @type {HTMLElement | null} */
let root = null;
/** @type {HTMLElement | null} */
let picker = null;
/** @type {Record<string, HTMLElement>} */
const faceEls = {};

// localStorage access can throw (blocked storage, private/embedded contexts on
// some mobile browsers). Guarding it is critical: an unguarded throw here would
// kill the whole module before the marker/visibility wiring runs, leaving a
// blank screen even though everything else is fine.
function readStoredFace() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredFace(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota / blocked storage */
  }
}

let activeFace = normalizeClockFace(readStoredFace());

function init() {
  root = document.getElementById("wall-clock");
  picker = document.getElementById("wall-clock-picker");
  if (!root || !picker) return;

  // Wire up marker visibility FIRST so the overlay can appear even if any
  // later rendering step were to fail.
  bindMarker();

  CLOCK_FACE_IDS.forEach(function (id) {
    const el = root.querySelector(`.clock-face[data-face="${id}"]`);
    if (el) faceEls[id] = el;
  });

  buildPicker();
  setActiveFace(activeFace, { persist: false });
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
    writeStoredFace(activeFace);
  }

  tick();
}

function tick() {
  try {
    renderFaces();
  } catch (err) {
    if (typeof console !== "undefined") console.error("clock render failed", err);
  }
}

function renderFaces() {
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

  let shown = null;
  function apply(visible) {
    if (visible === shown) return;
    shown = visible;
    root.classList.toggle("is-visible", visible);
    if (hint) hint.classList.toggle("is-hidden", visible);
  }

  // markerFound / markerLost are the fast path, but AR.js fires them
  // inconsistently (and can drop them entirely on some devices). The marker
  // entity's object3D.visible is toggled every frame while it is tracked, so
  // poll that as the source of truth — this is what actually makes the clock
  // appear when the camera sees the anchor.
  marker.addEventListener("markerFound", function () {
    apply(true);
  });
  marker.addEventListener("markerLost", function () {
    apply(false);
  });

  function poll() {
    if (marker.object3D) apply(marker.object3D.visible === true);
    window.requestAnimationFrame(poll);
  }
  window.requestAnimationFrame(poll);
}

window.setWallClockVisible = function (visible) {
  if (root) root.classList.toggle("is-visible", !!visible);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
