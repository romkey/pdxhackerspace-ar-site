import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

describe("version stamp", () => {
  it("public/version.json matches package.json (run `npm run stamp-version`)", () => {
    const pkg = readJson("package.json");
    const stamped = readJson("public/version.json");
    assert.equal(
      stamped.version,
      pkg.version,
      "version.json is stale — regenerate with `npm run stamp-version`"
    );
  });

  it("the landing page and footer surface the version", () => {
    const index = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
    assert.match(index, /id="app-version"/);
    assert.match(index, /version\.json/);

    const footer = fs.readFileSync(
      path.join(ROOT, "public/js/site-footer.js"),
      "utf8"
    );
    assert.match(footer, /version\.json/);
  });

  it("anchor AR pages declare the 0.72 pattern ratio used to build markers", () => {
    const manifest = readJson("markers/manifest.json");
    assert.equal(manifest.patternRatio, 0.72);
    for (const page of ["wall-clock.html", "printer.html", "events.html"]) {
      const html = fs.readFileSync(path.join(ROOT, "public", page), "utf8");
      assert.match(
        html,
        /patternRatio:\s*0\.72/,
        `${page} must set patternRatio to match the generated markers`
      );
    }
  });
});
