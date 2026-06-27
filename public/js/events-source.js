/**
 * Fetches an iCalendar feed and exposes the next N upcoming events
 * to the wall-display renderer as additional lines.
 *
 * Reads from window.AR_CONFIG.calendarUrl (override via ?calendar=<url>).
 * Refreshes every 5 minutes. Failures are surfaced as a single line.
 */
(function () {
  const VERSION = "v2";
  const REFRESH_MS = 5 * 60 * 1000;

  const params = new URLSearchParams(location.search);
  const overrideUrl = params.get("calendar");
  const config = window.AR_CONFIG || {};
  const url = overrideUrl || config.calendarUrl;
  const count = Math.max(1, parseInt(config.eventCount, 10) || 3);

  console.log("events-source", VERSION, "url:", url, "count:", count);

  function shortUrl(u) {
    try {
      const parsed = new URL(u, location.href);
      return parsed.pathname.length > 1
        ? parsed.host + parsed.pathname
        : parsed.host || parsed.pathname;
    } catch {
      return String(u);
    }
  }

  let cachedLines = url
    ? ["Loading…", shortUrl(url)]
    : ["No calendar URL configured."];

  function unescapeText(value) {
    return value
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  function parseICS(text) {
    // RFC 5545 line unfolding: CRLF followed by space/tab continues the line.
    const unfolded = text.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);

    const events = [];
    let current = null;

    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        current = {};
      } else if (line === "END:VEVENT") {
        if (current) events.push(current);
        current = null;
      } else if (current) {
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        const propWithParams = line.slice(0, idx);
        const value = line.slice(idx + 1);
        const propName = propWithParams.split(";")[0].toUpperCase();
        current[propName] = unescapeText(value);
      }
    }

    return events;
  }

  function parseICSDate(value) {
    if (!value) return null;
    // Forms: 20260527, 20260527T183000, 20260527T183000Z
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
      value.trim()
    );
    if (!m) return null;
    const [, y, mo, d, hh, mm, ss, z] = m;
    if (z) {
      return new Date(
        Date.UTC(+y, +mo - 1, +d, +hh || 0, +mm || 0, +ss || 0)
      );
    }
    return new Date(+y, +mo - 1, +d, +hh || 0, +mm || 0, +ss || 0);
  }

  function formatWhen(date) {
    const now = new Date();
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const timeStr = date
      .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      .replace(/\s/g, "");

    if (sameDay(date, now)) return "Today " + timeStr;
    if (sameDay(date, tomorrow)) return "Tomorrow " + timeStr;

    const dayStr = date.toLocaleDateString([], {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
    return dayStr + " " + timeStr;
  }

  function truncate(s, max) {
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function buildLines(events) {
    const now = Date.now();
    const upcoming = events
      .map(function (ev) {
        return { start: parseICSDate(ev.DTSTART), summary: ev.SUMMARY || "(untitled)" };
      })
      .filter(function (ev) {
        return ev.start && ev.start.getTime() >= now;
      })
      .sort(function (a, b) {
        return a.start - b.start;
      })
      .slice(0, count);

    if (upcoming.length === 0) {
      return ["No upcoming events."];
    }

    return upcoming.map(function (ev) {
      return formatWhen(ev.start) + " · " + truncate(ev.summary, 32);
    });
  }

  function refresh() {
    if (!url) {
      cachedLines = ["No calendar URL configured."];
      return;
    }
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        const events = parseICS(text);
        cachedLines = buildLines(events);
      })
      .catch(function (err) {
        console.error("events-source fetch failed", url, err);
        // Surface enough detail on the AR display to diagnose without devtools:
        // status code if we got a response, otherwise the error name (e.g.
        // TypeError for CORS / network failure).
        const reason =
          (err && err.message) || (err && err.name) || "unknown error";
        cachedLines = ["Events unavailable", reason, shortUrl(url)];
      });
  }

  function arEventsProvider() {
    // wall-display joins providers with newlines; returning an array of lines
    // would be flattened by .join, so we return them joined directly.
    return cachedLines.join("\n");
  }

  if (typeof window.registerWallLine === "function") {
    window.registerWallLine(arEventsProvider);
  } else {
    // wall-display not loaded yet; queue registration for once it is.
    window.addEventListener("load", function () {
      if (typeof window.registerWallLine === "function") {
        window.registerWallLine(arEventsProvider);
      }
    });
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
})();
