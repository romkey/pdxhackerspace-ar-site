import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOCK_FACE_IDS,
  normalizeClockFace,
  getHandAngles,
  pad2,
  getTimeParts,
  formatDigitalTime,
  handLine,
  buildAnalogSvg,
  buildOrbitSvg,
  describeArc,
  polarToCartesian,
} from "../public/js/clock-faces.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("normalizeClockFace", () => {
  it("returns known face ids unchanged", () => {
    for (const id of CLOCK_FACE_IDS) {
      assert.equal(normalizeClockFace(id), id);
    }
  });

  it("falls back to the first face for unknown ids", () => {
    assert.equal(normalizeClockFace("nope"), CLOCK_FACE_IDS[0]);
    assert.equal(normalizeClockFace(null), CLOCK_FACE_IDS[0]);
  });
});

function localDate(hours, minutes, seconds, ms = 0) {
  return new Date(2026, 5, 28, hours, minutes, seconds, ms);
}

describe("getHandAngles", () => {
  it("maps noon to zero hour angle and upright minute/second", () => {
    const angles = getHandAngles(localDate(12, 0, 0));
    assert.equal(angles.hour, 0);
    assert.equal(angles.minute, 0);
    assert.equal(angles.second, 0);
  });

  it("includes fractional motion for smooth hands", () => {
    const angles = getHandAngles(localDate(3, 30, 15, 500));
    assert.ok(Math.abs(angles.second - 93) < 0.01);
    assert.ok(Math.abs(angles.minute - 181.55) < 0.01);
    assert.ok(Math.abs(angles.hour - 105.13) < 0.01);
  });
});

describe("time formatting", () => {
  it("pads single-digit values", () => {
    assert.equal(pad2(3), "03");
    assert.equal(pad2(12), "12");
  });

  it("extracts 12-hour parts and am/pm", () => {
    const morning = getTimeParts(localDate(9, 5, 7));
    assert.equal(morning.hours12, 9);
    assert.equal(morning.minutes, 5);
    assert.equal(morning.seconds, 7);
    assert.equal(morning.ampm, "AM");

    const evening = getTimeParts(localDate(21, 5, 7));
    assert.equal(evening.hours12, 9);
    assert.equal(evening.ampm, "PM");
    assert.equal(evening.hours24, 21);
  });

  it("formats digital time as HH:MM:SS", () => {
    assert.equal(formatDigitalTime(localDate(14, 32, 7)), "14:32:07");
  });
});

describe("svg helpers", () => {
  it("draws a hand line from center", () => {
    const line = handLine(0, 10, 2);
    assert.match(line, /<line x1="50" y1="50"/);
    assert.match(line, /stroke-width="2"/);
  });

  it("builds polar coordinates from degrees", () => {
    const point = polarToCartesian(50, 50, 10, 0);
    assert.ok(Math.abs(point.x - 50) < 0.001);
    assert.ok(Math.abs(point.y - 40) < 0.001);
  });

  it("describes an arc path", () => {
    const arc = describeArc(50, 50, 30, -90, 0);
    assert.match(arc, /^M 50 50 L/);
    assert.match(arc, / A 30 30 /);
  });

  it("renders analog and orbit markup", () => {
    const date = localDate(15, 45, 30);
    const analog = buildAnalogSvg(date);
    assert.match(analog, /clock-analog__svg/);
    assert.match(analog, /clock-analog__hour/);

    const orbit = buildOrbitSvg(date);
    assert.match(orbit, /clock-orbit__svg/);
    assert.match(orbit, /clock-orbit__label/);
  });
});

describe("wall clock page assets", () => {
  it("ships clock styles and scripts", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "public/css/wall-clock.css")));
    assert.ok(fs.existsSync(path.join(ROOT, "public/js/wall-clock.js")));
    assert.ok(fs.existsSync(path.join(ROOT, "public/js/clock-faces.js")));
  });

  it("wall-clock.html references the new clock UI", () => {
    const html = fs.readFileSync(
      path.join(ROOT, "public/wall-clock.html"),
      "utf8"
    );
    assert.match(html, /wall-clock\.css/);
    assert.match(html, /wall-clock\.js/);
    assert.match(html, /id="wall-clock"/);
    assert.match(html, /data-face="analog"/);
    assert.match(html, /data-face="digital"/);
    assert.match(html, /data-face="orbit"/);
  });

  it("wall-clock.js polls marker visibility (not just events)", () => {
    const js = fs.readFileSync(path.join(ROOT, "public/js/wall-clock.js"), "utf8");
    // Relying solely on markerFound/markerLost drops the overlay on some
    // devices; object3D.visible polling is the reliable trigger.
    assert.match(js, /object3D\.visible/);
    assert.match(js, /requestAnimationFrame/);
  });

  it("wall-clock.js guards localStorage so blocked storage can't blank it", () => {
    const js = fs.readFileSync(path.join(ROOT, "public/js/wall-clock.js"), "utf8");
    // An unguarded localStorage access throws on some mobile/embedded browsers,
    // which would kill the whole module before the marker wiring runs.
    assert.doesNotMatch(js, /^\s*let activeFace = normalizeClockFace\(\s*$/m);
    assert.match(js, /function readStoredFace/);
    assert.match(js, /catch\s*\{/);
  });
});
