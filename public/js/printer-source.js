/**
 * Polls /api/printer/<id> and exposes a structured status model to the HUD.
 *
 * The backend (server/app.js) holds the Home Assistant token; this file only
 * knows the public endpoint. Multi-printer support is wired through
 * setActivePrinter() — call it (e.g. on markerFound) and the next refresh
 * pulls that printer's status. A `?printer=<id>` query string overrides the
 * default at page load.
 */
import { buildPrinterModel, buildErrorModel } from "./printer-view.js";

const VERSION = "v2";
const config = window.AR_CONFIG || {};
const REFRESH_MS =
  Math.max(2, parseInt(config.printerRefreshSeconds, 10) || 10) * 1000;
const KNOWN_PRINTERS = Array.isArray(config.printers) ? config.printers : [];

const params = new URLSearchParams(location.search);
const overrideId = parseInt(params.get("printer"), 10);
const defaultId = !Number.isNaN(overrideId)
  ? overrideId
  : KNOWN_PRINTERS.length > 0
  ? KNOWN_PRINTERS[0].id
  : 0;

let activePrinterId = defaultId;
let currentModel = loadingModel(activePrinterId);
let inFlight = null;

console.log(
  "printer-source",
  VERSION,
  "default:",
  activePrinterId,
  "known:",
  KNOWN_PRINTERS,
  "refresh:",
  REFRESH_MS + "ms"
);

function printerName(id) {
  const known = KNOWN_PRINTERS.find(function (p) {
    return p.id === id;
  });
  return known ? known.name : "Printer " + id;
}

function loadingModel(id) {
  const model = buildErrorModel(printerName(id), null, null);
  model.id = id;
  model.state = { kind: "loading", label: "Connecting…" };
  model.errors = [];
  return model;
}

function truncate(s, max) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function refresh() {
  if (inFlight) return;
  const id = activePrinterId;
  const url = "/api/printer/" + encodeURIComponent(id);
  inFlight = fetch(url, { cache: "no-store" })
    .then(function (res) {
      return res.text().then(function (text) {
        return { res: res, text: text };
      });
    })
    .then(function (out) {
      let body = null;
      try {
        body = out.text ? JSON.parse(out.text) : null;
      } catch (err) {
        throw new Error("Bad JSON from " + url + ": " + (err.message || err));
      }
      if (!out.res.ok) {
        const apiErr = (body && body.error) || "HTTP " + out.res.status;
        throw new Error(apiErr);
      }
      if (!body) throw new Error("Empty response from " + url);
      if (body.id !== id && activePrinterId !== id) return;
      currentModel = buildPrinterModel(body);
    })
    .catch(function (err) {
      console.error("printer-source fetch failed", url, err);
      const reason =
        (err && err.message) || (err && err.name) || "unknown error";
      const model = buildErrorModel(
        printerName(id),
        truncate(reason, 80),
        url
      );
      model.id = id;
      currentModel = model;
    })
    .then(function () {
      inFlight = null;
    });
}

window.getPrinterStatusModel = function () {
  return currentModel;
};

// Exposed so printer.html (or a future marker-routing layer) can switch which
// printer is being shown without reloading the page.
window.setActivePrinter = function (id) {
  const next = parseInt(id, 10);
  if (Number.isNaN(next) || next === activePrinterId) return;
  activePrinterId = next;
  currentModel = loadingModel(next);
  refresh();
};

refresh();
setInterval(refresh, REFRESH_MS);
