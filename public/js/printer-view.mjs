/**
 * Pure view-model helpers for the printer status HUD (printer.html).
 *
 * Takes the raw `/api/printer/<id>` payload (the structure produced by
 * server/app.js getPrinterStatus) and turns it into a structured model the
 * HUD can render directly — numbers, fractions for gauges, formatted labels.
 *
 * No DOM access here so it can be unit-tested under Node.
 */

export const NOZZLE_MAX_C = 300;
export const BED_MAX_C = 120;

/** Map a raw print_state string to a normalized kind + label. */
export function classifyState(raw, progress) {
  if (raw == null || raw === "") {
    if (Number(progress) >= 100) return { kind: "finished", label: "Finished" };
    return { kind: "unknown", label: "Unknown" };
  }
  const lower = String(raw).toLowerCase();
  const label = titleCase(String(raw).replace(/_/g, " "));

  if (/(error|fault|stopped|cancell)/.test(lower)) {
    return { kind: "error", label };
  }
  if (/(attention|warn)/.test(lower)) return { kind: "attention", label };
  if (/(offline|unavailable|disconnect)/.test(lower)) {
    return { kind: "offline", label };
  }
  if (/(pause)/.test(lower)) return { kind: "paused", label };
  if (/(finish|complete|done)/.test(lower)) {
    return { kind: "finished", label };
  }
  if (/(print|busy|running)/.test(lower)) return { kind: "printing", label };
  if (Number(progress) >= 100) return { kind: "finished", label };
  if (/(idle|ready|operational|standby|stopped|stop|off)/.test(lower)) {
    return { kind: "idle", label };
  }
  return { kind: "unknown", label };
}

export function titleCase(s) {
  return String(s).replace(/\w\S*/g, function (word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function toNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function roundNum(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

/** Percentage (0..100) of `current` against a max, for gauge fills. */
export function tempPct(current, max) {
  const n = toNumber(current);
  if (n == null || !(max > 0)) return 0;
  return clamp((n / max) * 100, 0, 100);
}

export function progressPct(value) {
  const n = toNumber(value);
  if (n == null) return 0;
  return clamp(n, 0, 100);
}

function sensor(status, field) {
  const s = status && status.sensors && status.sensors[field];
  if (!s) return null;
  if (s.state === "unknown" || s.state === "unavailable") return null;
  return s;
}

function sensorValue(status, field) {
  const s = sensor(status, field);
  return s ? s.state : null;
}

function unitOf(status, field, fallback) {
  const s = sensor(status, field);
  const u = s && s.attributes && s.attributes.unit_of_measurement;
  return u || fallback || "";
}

export function basename(name) {
  if (!name) return null;
  const parts = String(name).split(/[\\/]/);
  return parts[parts.length - 1] || String(name);
}

export function formatRemaining(value) {
  if (value == null) return null;
  const raw = String(value);
  const n = Number(value);
  if (Number.isFinite(n) && /^\d+(\.\d+)?$/.test(raw)) {
    const total = Math.max(0, Math.round(n));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) return h + "h " + m + "m";
    if (m > 0) return m + "m";
    return total + "s";
  }
  return raw;
}

export function formatFinishTime(value, now = new Date()) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(/\s/g, "");
  if (sameDay) return time;
  const day = d.toLocaleDateString([], {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
  return day + " " + time;
}

function buildTemp(status, currentField, targetField, max) {
  const current = toNumber(sensorValue(status, currentField));
  const target = toNumber(sensorValue(status, targetField));
  if (current == null && target == null) return null;
  const unit = unitOf(status, currentField, "°C");
  const heating = target != null && target > 0 && current != null && current < target - 2;
  const atTarget =
    target != null && target > 0 && current != null && Math.abs(current - target) <= 2;
  return {
    current,
    target,
    unit,
    pct: tempPct(current, max),
    targetPct: target != null ? tempPct(target, max) : null,
    heating,
    atTarget,
    active: target != null && target > 0,
  };
}

/**
 * @param {object} status raw /api/printer/<id> payload
 * @param {Date} [now]
 */
export function buildPrinterModel(status, now = new Date()) {
  status = status || {};
  const progressValue = toNumber(sensorValue(status, "progress"));
  const stateRaw = sensorValue(status, "print_state");
  const state = classifyState(stateRaw, progressValue);

  const filenameRaw = sensorValue(status, "filename");
  const remainingText = formatRemaining(sensorValue(status, "print_time_remaining"));
  const finishText = formatFinishTime(sensorValue(status, "print_finish"), now);

  const nozzle = buildTemp(
    status,
    "nozzle_temperature",
    "nozzle_target_temperature",
    NOZZLE_MAX_C
  );
  const bed = buildTemp(
    status,
    "heatbed_temperature",
    "heatbed_target_temperature",
    BED_MAX_C
  );

  const material = sensorValue(status, "material");
  const nozzleDiaRaw = sensorValue(status, "nozzle_diameter");
  const nozzleDiameter =
    nozzleDiaRaw != null
      ? roundNum(nozzleDiaRaw, 2) + (unitOf(status, "nozzle_diameter", "mm") || "mm")
      : null;

  const errors = Object.keys(status.errors || {})
    .filter(function (k) {
      return k !== "preview";
    })
    .map(function (k) {
      return status.errors[k];
    });

  const hasData =
    progressValue != null ||
    stateRaw != null ||
    filenameRaw != null ||
    nozzle != null ||
    bed != null;

  const isPrinting = state.kind === "printing" || state.kind === "paused";

  return {
    id: status.id,
    name: status.name || (status.id != null ? "Printer " + status.id : "Printer"),
    fetchedAt: status.fetchedAt || null,
    hasData,
    state,
    isPrinting,
    progress: {
      value: progressValue,
      pct: progressPct(progressValue),
      text: progressValue != null ? roundNum(progressValue, 1) + "%" : null,
    },
    filename: filenameRaw
      ? { raw: String(filenameRaw), display: basename(filenameRaw) }
      : null,
    remainingText,
    finishText,
    eta: finishText || remainingText || null,
    material: material ? String(material) : null,
    nozzleDiameter,
    nozzle,
    bed,
    preview: {
      available: Boolean(status.preview && status.preview.available),
    },
    errors,
    prefix: status.prefix || null,
    ariaSummary: buildAriaSummary(status.name, state, progressValue, finishText, remainingText),
  };
}

function buildAriaSummary(name, state, progress, finishText, remainingText) {
  const parts = [name || "Printer", state.label];
  if (progress != null) parts.push(roundNum(progress, 0) + "% complete");
  const eta = finishText || remainingText;
  if (eta) parts.push("done " + eta);
  return parts.join(", ");
}

/** Build an offline/error model when the fetch itself failed. */
export function buildErrorModel(name, reason, endpoint) {
  return {
    id: null,
    name: name || "Printer",
    fetchedAt: null,
    hasData: false,
    state: { kind: "offline", label: "Status unavailable" },
    isPrinting: false,
    progress: { value: null, pct: 0, text: null },
    filename: null,
    remainingText: null,
    finishText: null,
    eta: null,
    material: null,
    nozzleDiameter: null,
    nozzle: null,
    bed: null,
    preview: { available: false },
    errors: reason ? [reason] : [],
    endpoint: endpoint || null,
    prefix: null,
    ariaSummary: (name || "Printer") + ", status unavailable",
  };
}
