/**
 * Full-screen printer status HUD for printer.html.
 *
 * Reads a structured model from printer-source.js via getPrinterStatusModel()
 * and paints it into the static skeleton in printer.html: a print-preview
 * panel, a circular progress ring, nozzle/bed temperature gauges, status pill,
 * ETA, and material chips. No text-parsing — everything comes from the model.
 */
const RING_RADIUS = 42;
const GAUGE_RADIUS = 40;
const GAUGE_SWEEP_DEG = 270;

const ringCircumference = 2 * Math.PI * RING_RADIUS;
const gaugeLength = (GAUGE_SWEEP_DEG / 360) * 2 * Math.PI * GAUGE_RADIUS;

const STATE_KINDS = [
  "loading",
  "printing",
  "paused",
  "idle",
  "finished",
  "attention",
  "error",
  "offline",
  "unknown",
];

const hud = document.getElementById("printer-hud");

function q(sel) {
  return hud ? hud.querySelector(sel) : null;
}

const els = hud
  ? {
      panel: q(".phud__panel"),
      name: q(".phud__name"),
      stateLabel: q(".phud__state-label"),
      state: q(".phud__state"),
      etaValue: q(".phud__eta-value"),
      etaLabel: q(".phud__eta-label"),
      previewImg: q(".phud__preview-img"),
      previewFallback: q(".phud__preview-fallback"),
      fileName: q(".phud__file-name"),
      ringFill: q(".phud__ring-fill"),
      ringPct: q(".phud__ring-pct"),
      ringSub: q(".phud__ring-sub"),
      nozzleFill: q(".phud__gauge--nozzle .phud__gauge-fill"),
      nozzleValue: q(".phud__gauge--nozzle .phud__gauge-value"),
      nozzleTarget: q(".phud__gauge--nozzle .phud__gauge-target"),
      nozzleFig: q(".phud__gauge--nozzle"),
      bedFill: q(".phud__gauge--bed .phud__gauge-fill"),
      bedValue: q(".phud__gauge--bed .phud__gauge-value"),
      bedTarget: q(".phud__gauge--bed .phud__gauge-target"),
      bedFig: q(".phud__gauge--bed"),
      chips: q(".phud__chips"),
      errors: q(".phud__errors"),
    }
  : null;

let lastPreviewKey = "";

function initSvgGeometry() {
  if (!els) return;
  if (els.ringFill) {
    els.ringFill.style.strokeDasharray = "0 " + ringCircumference;
  }
  [els.nozzleFill, els.bedFill].forEach(function (fill) {
    if (fill) fill.style.strokeDasharray = "0 " + gaugeLength;
  });
}

function setRing(pct) {
  if (!els.ringFill) return;
  const dash = (clamp(pct, 0, 100) / 100) * ringCircumference;
  els.ringFill.style.strokeDasharray = dash + " " + ringCircumference;
}

function setGauge(fill, pct) {
  if (!fill) return;
  const dash = (clamp(pct, 0, 100) / 100) * gaugeLength;
  fill.style.strokeDasharray = dash + " " + gaugeLength;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fmtTemp(temp) {
  if (!temp || temp.current == null) return "—";
  return Math.round(temp.current) + (temp.unit || "°C");
}

function fmtTarget(temp) {
  if (!temp || temp.target == null || !(temp.target > 0)) return "";
  return "→ " + Math.round(temp.target) + (temp.unit || "°C");
}

function renderPreview(model) {
  if (!els.previewImg || !els.previewFallback) return;
  const available = model.preview && model.preview.available && model.id != null;
  if (available) {
    const key = model.id + ":" + (model.fetchedAt || "");
    if (key !== lastPreviewKey) {
      lastPreviewKey = key;
      els.previewImg.src =
        "/api/printer/" +
        encodeURIComponent(model.id) +
        "/preview?ts=" +
        encodeURIComponent(model.fetchedAt || Date.now());
    }
    els.previewImg.hidden = false;
    els.previewFallback.hidden = true;
  } else {
    lastPreviewKey = "";
    els.previewImg.hidden = true;
    els.previewImg.removeAttribute("src");
    els.previewFallback.hidden = false;
  }
}

function renderChips(model) {
  if (!els.chips) return;
  els.chips.innerHTML = "";
  const chips = [];
  if (model.material) chips.push({ label: "Material", value: model.material });
  if (model.nozzleDiameter) {
    chips.push({ label: "Nozzle", value: model.nozzleDiameter });
  }
  if (model.remainingText && model.finishText) {
    chips.push({ label: "Remaining", value: model.remainingText });
  }
  chips.forEach(function (chip) {
    const li = document.createElement("li");
    li.className = "phud__chip";
    const label = document.createElement("span");
    label.className = "phud__chip-label";
    label.textContent = chip.label;
    const value = document.createElement("span");
    value.className = "phud__chip-value";
    value.textContent = chip.value;
    li.appendChild(label);
    li.appendChild(value);
    els.chips.appendChild(li);
  });
  els.chips.hidden = chips.length === 0;
}

function renderErrors(model) {
  if (!els.errors) return;
  els.errors.innerHTML = "";
  const messages = (model.errors || []).slice(0, 3);
  if (model.endpoint) messages.push("endpoint: " + model.endpoint);
  if (!model.hasData && messages.length === 0 && model.prefix) {
    messages.push("prefix: " + model.prefix);
  }
  messages.forEach(function (msg) {
    const li = document.createElement("li");
    li.className = "phud__error";
    li.textContent = msg;
    els.errors.appendChild(li);
  });
  els.errors.hidden = messages.length === 0;
}

function render() {
  if (!els || typeof window.getPrinterStatusModel !== "function") return;
  const model = window.getPrinterStatusModel();
  if (!model) return;

  els.name.textContent = model.name;
  if (model.ariaSummary) hud.setAttribute("aria-label", model.ariaSummary);

  const kind = (model.state && model.state.kind) || "unknown";
  els.stateLabel.textContent = (model.state && model.state.label) || "—";
  STATE_KINDS.forEach(function (k) {
    els.state.classList.toggle("is-" + k, k === kind);
    if (els.panel) els.panel.classList.toggle("is-" + k, k === kind);
  });

  els.etaValue.textContent = model.eta || "—";

  setRing(model.progress.pct);
  els.ringPct.textContent =
    model.progress.value != null ? Math.round(model.progress.value) + "%" : "—";
  els.ringSub.textContent = (model.state && model.state.label) || "";

  setGauge(els.nozzleFill, model.nozzle ? model.nozzle.pct : 0);
  els.nozzleValue.textContent = fmtTemp(model.nozzle);
  els.nozzleTarget.textContent = fmtTarget(model.nozzle);
  if (els.nozzleFig) {
    els.nozzleFig.classList.toggle(
      "is-heating",
      Boolean(model.nozzle && model.nozzle.heating)
    );
    els.nozzleFig.classList.toggle(
      "is-attarget",
      Boolean(model.nozzle && model.nozzle.atTarget)
    );
  }

  setGauge(els.bedFill, model.bed ? model.bed.pct : 0);
  els.bedValue.textContent = fmtTemp(model.bed);
  els.bedTarget.textContent = fmtTarget(model.bed);
  if (els.bedFig) {
    els.bedFig.classList.toggle(
      "is-heating",
      Boolean(model.bed && model.bed.heating)
    );
    els.bedFig.classList.toggle(
      "is-attarget",
      Boolean(model.bed && model.bed.atTarget)
    );
  }

  els.fileName.textContent = model.filename ? model.filename.display : "No active file";

  renderPreview(model);
  renderChips(model);
  renderErrors(model);
}

window.setPrinterHudVisible = function (visible) {
  if (hud) hud.classList.toggle("is-visible", !!visible);
};

if (hud) {
  initSvgGeometry();
  setInterval(render, 250);
  render();
}
