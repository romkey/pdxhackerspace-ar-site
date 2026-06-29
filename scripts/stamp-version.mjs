#!/usr/bin/env node
/**
 * Write public/version.json from package.json's version.
 *
 * This file is what the site displays (footer + landing page) so you can
 * confirm at a glance which build is actually running — handy for catching
 * a Docker image that wasn't rebuilt/redeployed. It runs automatically on
 * `npm version` (see the "version" script) and again at Docker build time
 * (see the Dockerfile) so the served value always matches the image.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const outPath = path.join(ROOT, "public", "version.json");

fs.writeFileSync(
  outPath,
  JSON.stringify({ name: pkg.name, version: pkg.version }) + "\n"
);

console.log(`stamped public/version.json -> ${pkg.version}`);
