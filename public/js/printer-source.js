/**
 * Polls /api/printer/<id> and feeds printer-status lines to wall-display.
 *
 * The backend (server/server.js) holds the Home Assistant token; this file
 * only knows the public endpoint. Multi-printer support is wired through
 * setActivePrinter() — call it (e.g. on markerFound) and the next refresh
 * pulls that printer's status. A `?printer=<id>` query string overrides the
 * default at page load.
 */
(function () {
  const VERSION = "v1";
  const config = window.AR_CONFIG || {};
  const REFRESH_MS = Math.max(2, parseInt(config.printerRefreshSeconds, 10) || 10) * 1000;
  const KNOWN_PRINTERS = Array.isArray(config.printers) ? config.printers : [];

  const params = new URLSearchParams(location.search);
  const overrideId = parseInt(params.get("printer"), 10);
  const defaultId = !Number.isNaN(overrideId)
    ? overrideId
    : KNOWN_PRINTERS.length > 0
    ? KNOWN_PRINTERS[0].id
    : 0;

  let activePrinterId = defaultId;
  let cachedLines = ["Loading printer status…"];
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

  function sensorState(status, field) {
    const sensor = status.sensors && status.sensors[field];
    if (!sensor) return null;
    if (sensor.state === "unknown" || sensor.state === "unavailable") return null;
    return sensor;
  }

  function sensorValue(status, field) {
    const s = sensorState(status, field);
    return s ? s.state : null;
  }

  function unitOf(status, field) {
    const s = sensorState(status, field);
    return s && s.attributes && s.attributes.unit_of_measurement
      ? s.attributes.unit_of_measurement
      : "";
  }

  function formatTemp(current, target, unit) {
    if (current == null && target == null) return null;
    const u = unit || "°C";
    const cur = current != null ? roundNum(current, 0) + u : "—";
    if (target != null && Number(target) > 0) {
      return cur + " → " + roundNum(target, 0) + u;
    }
    return cur;
  }

  function roundNum(v, digits) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(digits || 0);
  }

  function formatProgress(value) {
    if (value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return roundNum(n, 1) + "%";
  }

  function formatFinishTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const now = new Date();
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

  function formatRemaining(value) {
    if (value == null) return null;
    // HA exposes time-remaining as either seconds (number) or a duration
    // string like "1:23:45". Handle both.
    const n = Number(value);
    if (Number.isFinite(n) && /^\d+(\.\d+)?$/.test(String(value))) {
      const total = Math.max(0, Math.round(n));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      if (h > 0) return h + "h " + m + "m";
      return m + "m";
    }
    return String(value);
  }

  function truncate(s, max) {
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function buildLines(status) {
    const lines = [];

    lines.push(status.name || ("Printer " + status.id));

    const state = sensorValue(status, "print_state");
    const progress = formatProgress(sensorValue(status, "progress"));
    if (state || progress) {
      lines.push([state, progress].filter(Boolean).join(" · "));
    }

    const filename = sensorValue(status, "filename");
    if (filename) lines.push(truncate(String(filename), 36));

    const finishLabel =
      formatFinishTime(sensorValue(status, "print_finish")) ||
      formatRemaining(sensorValue(status, "print_time_remaining"));
    if (finishLabel) lines.push("Done: " + finishLabel);

    const material = sensorValue(status, "material");
    const nozzleDia = sensorValue(status, "nozzle_diameter");
    const nozzleParts = [];
    if (material) nozzleParts.push(String(material));
    if (nozzleDia) {
      const dUnit = unitOf(status, "nozzle_diameter") || "mm";
      nozzleParts.push(roundNum(nozzleDia, 2) + dUnit + " nozzle");
    }
    if (nozzleParts.length > 0) lines.push(nozzleParts.join(" · "));

    const nozzleUnit = unitOf(status, "nozzle_temperature") || "°C";
    const nozzleTemp = formatTemp(
      sensorValue(status, "nozzle_temperature"),
      sensorValue(status, "nozzle_target_temperature"),
      nozzleUnit
    );
    if (nozzleTemp) lines.push("Nozzle: " + nozzleTemp);

    const bedUnit = unitOf(status, "heatbed_temperature") || "°C";
    const bedTemp = formatTemp(
      sensorValue(status, "heatbed_temperature"),
      sensorValue(status, "heatbed_target_temperature"),
      bedUnit
    );
    if (bedTemp) lines.push("Bed: " + bedTemp);

    const errorMessages = Object.keys(status.errors || {})
      .map(function (k) {
        return k + ": " + status.errors[k];
      })
      .filter(Boolean);

    if (lines.length <= 1) {
      // Nothing besides the header — give the user diagnostics, not a blank
      // panel. Both an error map and an empty sensors map count as "broken".
      if (errorMessages.length > 0) {
        lines.push("No printer data");
        errorMessages.slice(0, 4).forEach(function (msg) {
          lines.push(truncate(msg, 60));
        });
      } else {
        lines.push("No printer data available");
        if (status.prefix) lines.push("prefix: " + status.prefix);
      }
    } else if (errorMessages.length > 0) {
      // Some fields succeeded, some didn't. Show one short hint so it's
      // obvious why a row is missing.
      lines.push(
        truncate(
          errorMessages.length +
            " sensor(s) unavailable: " +
            errorMessages[0],
          60
        )
      );
    }

    return lines;
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
          throw new Error(
            "Bad JSON from " + url + ": " + (err.message || err)
          );
        }
        if (!out.res.ok) {
          const apiErr = (body && body.error) || ("HTTP " + out.res.status);
          throw new Error(apiErr);
        }
        if (!body) throw new Error("Empty response from " + url);
        cachedLines = buildLines(body);
      })
      .catch(function (err) {
        console.error("printer-source fetch failed", url, err);
        const reason = (err && err.message) || (err && err.name) || "unknown error";
        const known = KNOWN_PRINTERS.find(function (p) {
          return p.id === id;
        });
        const header = known ? known.name : "Printer " + id;
        cachedLines = [
          header,
          "Status unavailable",
          truncate(reason, 60),
          "endpoint: " + url,
        ];
      })
      .then(function () {
        inFlight = null;
      });
  }

  function arPrinterProvider() {
    return cachedLines.join("\n");
  }

  window.getPrinterStatusLines = function () {
    return cachedLines.slice();
  };

  // Exposed so printer.html (or a future marker-routing layer) can switch
  // which printer is being shown without reloading the page.
  window.setActivePrinter = function (id) {
    const next = parseInt(id, 10);
    if (Number.isNaN(next) || next === activePrinterId) return;
    activePrinterId = next;
    cachedLines = ["Switching printer…"];
    refresh();
  };

  if (typeof window.registerWallLine === "function") {
    window.registerWallLine(arPrinterProvider);
  } else {
    window.addEventListener("load", function () {
      if (typeof window.registerWallLine === "function") {
        window.registerWallLine(arPrinterProvider);
      }
    });
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
})();
