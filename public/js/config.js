/**
 * Runtime configuration for AR pages.
 *
 * This file is shipped with sensible defaults for `npm start` (static serve).
 * In the Docker image it is regenerated at container start by `envsubst`
 * from `config.template.js` using environment variables.
 *
 * Optional URL override for quick testing: append `?calendar=<url>` to any AR
 * page; the events source picks it up before this file's default takes effect.
 */
window.AR_CONFIG = window.AR_CONFIG || {};
window.AR_CONFIG.calendarUrl =
  window.AR_CONFIG.calendarUrl ||
  "https://events.pdxhackerspace.org/calendar.ics";
window.AR_CONFIG.eventCount = window.AR_CONFIG.eventCount || 3;
window.AR_CONFIG.printerRefreshSeconds =
  window.AR_CONFIG.printerRefreshSeconds || 10;
// Populated by config.template.js at container start; empty in dev means
// the printer page falls back to "no printers configured".
window.AR_CONFIG.printers = window.AR_CONFIG.printers || [];
