import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyState,
  toNumber,
  clamp,
  roundNum,
  tempPct,
  progressPct,
  basename,
  formatRemaining,
  formatFinishTime,
  buildPrinterModel,
  buildErrorModel,
} from "../public/js/printer-view.mjs";

function sensor(state, unit) {
  return { state: String(state), attributes: unit ? { unit_of_measurement: unit } : {} };
}

function printingStatus() {
  return {
    id: 0,
    name: "Prusa",
    fetchedAt: "2026-06-28T12:00:00.000Z",
    sensors: {
      progress: sensor("42.5", "%"),
      print_state: sensor("printing"),
      filename: sensor("/home/maker/benchy.bgcode"),
      print_time_remaining: sensor("3600"),
      nozzle_temperature: sensor("210", "°C"),
      nozzle_target_temperature: sensor("215"),
      heatbed_temperature: sensor("60"),
      heatbed_target_temperature: sensor("60"),
      material: sensor("PLA"),
      nozzle_diameter: sensor("0.4", "mm"),
    },
    errors: {},
    preview: { available: true },
  };
}

describe("classifyState", () => {
  it("recognizes printing and paused", () => {
    assert.equal(classifyState("printing").kind, "printing");
    assert.equal(classifyState("Paused").kind, "paused");
  });

  it("recognizes idle / finished / error", () => {
    assert.equal(classifyState("Operational", 0).kind, "idle");
    assert.equal(classifyState("error: thermal").kind, "error");
    assert.equal(classifyState("Finished").kind, "finished");
  });

  it("falls back on progress when state is blank", () => {
    assert.equal(classifyState("", 100).kind, "finished");
    assert.equal(classifyState(null, 50).kind, "unknown");
  });

  it("produces a human label", () => {
    assert.equal(classifyState("print_in_progress").label, "Print In Progress");
  });
});

describe("number + format helpers", () => {
  it("toNumber and clamp", () => {
    assert.equal(toNumber("12.5"), 12.5);
    assert.equal(toNumber("nope"), null);
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(clamp(-5, 0, 100), 0);
  });

  it("roundNum", () => {
    assert.equal(roundNum("3.14159", 2), 3.14);
    assert.equal(roundNum("oops"), null);
  });

  it("tempPct and progressPct clamp to range", () => {
    assert.equal(tempPct(150, 300), 50);
    assert.equal(tempPct(400, 300), 100);
    assert.equal(tempPct(null, 300), 0);
    assert.equal(progressPct(42.5), 42.5);
    assert.equal(progressPct(120), 100);
  });

  it("basename strips directories", () => {
    assert.equal(basename("/a/b/c.gcode"), "c.gcode");
    assert.equal(basename("file.bgcode"), "file.bgcode");
    assert.equal(basename(null), null);
  });

  it("formatRemaining handles seconds and passthrough", () => {
    assert.equal(formatRemaining("3600"), "1h 0m");
    assert.equal(formatRemaining("90"), "1m");
    assert.equal(formatRemaining("45"), "45s");
    assert.equal(formatRemaining("1:23:45"), "1:23:45");
    assert.equal(formatRemaining(null), null);
  });

  it("formatFinishTime returns same-day time and null for empty", () => {
    const now = new Date(2026, 5, 28, 10, 0, 0);
    const soon = new Date(2026, 5, 28, 14, 30, 0).toISOString();
    const result = formatFinishTime(soon, now);
    assert.ok(typeof result === "string" && result.length > 0);
    assert.equal(formatFinishTime(null, now), null);
  });
});

describe("buildPrinterModel (active print)", () => {
  const model = buildPrinterModel(printingStatus());

  it("classifies the print as printing", () => {
    assert.equal(model.state.kind, "printing");
    assert.equal(model.isPrinting, true);
  });

  it("exposes progress value, pct, and text", () => {
    assert.equal(model.progress.value, 42.5);
    assert.equal(model.progress.pct, 42.5);
    assert.equal(model.progress.text, "42.5%");
  });

  it("cleans the filename to a basename", () => {
    assert.equal(model.filename.display, "benchy.bgcode");
  });

  it("builds nozzle gauge with heating flag", () => {
    assert.equal(model.nozzle.pct, 70);
    assert.equal(model.nozzle.heating, true);
    assert.equal(model.nozzle.atTarget, false);
    assert.equal(model.nozzle.unit, "°C");
  });

  it("builds bed gauge at target", () => {
    assert.equal(model.bed.pct, 50);
    assert.equal(model.bed.atTarget, true);
    assert.equal(model.bed.heating, false);
  });

  it("surfaces material, nozzle diameter, eta, and preview", () => {
    assert.equal(model.material, "PLA");
    assert.equal(model.nozzleDiameter, "0.4mm");
    assert.equal(model.eta, "1h 0m");
    assert.equal(model.preview.available, true);
    assert.equal(model.hasData, true);
  });
});

describe("buildPrinterModel (empty / error)", () => {
  it("reports no data for an empty payload", () => {
    const model = buildPrinterModel({});
    assert.equal(model.hasData, false);
    assert.equal(model.state.kind, "unknown");
    assert.equal(model.progress.pct, 0);
    assert.equal(model.nozzle, null);
    assert.equal(model.bed, null);
    assert.equal(model.preview.available, false);
  });

  it("excludes preview errors from the visible error list", () => {
    const model = buildPrinterModel({
      sensors: { progress: sensor("10") },
      errors: { preview: "boom", progress: "nope" },
    });
    assert.deepEqual(model.errors, ["nope"]);
  });

  it("buildErrorModel yields an offline model", () => {
    const model = buildErrorModel("Prusa", "network down", "/api/printer/0");
    assert.equal(model.state.kind, "offline");
    assert.equal(model.hasData, false);
    assert.deepEqual(model.errors, ["network down"]);
    assert.equal(model.endpoint, "/api/printer/0");
  });
});
