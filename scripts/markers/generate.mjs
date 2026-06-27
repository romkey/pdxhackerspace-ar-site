#!/usr/bin/env node
/**
 * Generate hex-badge AR.js pattern markers (PNG + .patt + manifest).
 *
 * Run: npm run markers
 * Output: markers/ (repo root)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ANCHOR_GLYPHS, MARKER_CONFIG } from "./glyphs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "markers");

/**
 * Encode a square inner image into an ARToolKit .patt string.
 * Mirrors @ar-js-org/marker-creator (4 orientations, BGR channel order).
 * @param {Buffer} innerPng
 */
async function encodePattern(innerPng) {
  /** AR.js samples 0°, -90°, -180°, -270° (same as 0, 270, 180, 90 CW). */
  const rotations = [0, 270, 180, 90];
  let pattern = "";

  for (let ri = 0; ri < rotations.length; ri++) {
    const { data } = await sharp(innerPng)
      .rotate(rotations[ri], { background: { r: 255, g: 255, b: 255 } })
      .resize(16, 16, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (ri > 0) pattern += "\n";

    for (let channel = 2; channel >= 0; channel--) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (x > 0) pattern += " ";
          const offset = (y * 16 + x) * 3 + channel;
          pattern += String(data[offset]).padStart(3, "0");
        }
        pattern += "\n";
      }
    }
  }

  return pattern;
}

/**
 * Compose the full printable marker (white margin, black border, inner art).
 * Layout matches @ar-js-org/marker-creator buildFullMarker().
 * @param {Buffer} innerPng
 * @param {number} pattRatio
 * @param {number} size
 */
async function buildFullMarker(innerPng, pattRatio, size) {
  const whiteMargin = 0.1;
  const blackMargin = (1 - 2 * whiteMargin) * ((1 - pattRatio) / 2);
  const innerMargin = whiteMargin + blackMargin;
  const innerPx = Math.round(size * (1 - 2 * innerMargin));
  const borderPx = Math.round(size * whiteMargin);
  const blackPx = Math.round(size * (1 - 2 * whiteMargin));

  const innerResized = await sharp(innerPng)
    .resize(innerPx, innerPx, { fit: "fill" })
    .png()
    .toBuffer();

  const blackBorder = await sharp({
    create: {
      width: blackPx,
      height: blackPx,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

  const whiteInner = await sharp({
    create: {
      width: innerPx,
      height: innerPx,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: innerResized, left: 0, top: 0 }])
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: blackBorder, left: borderPx, top: borderPx },
      { input: whiteInner, left: Math.round(size * innerMargin), top: Math.round(size * innerMargin) },
    ])
    .png()
    .toBuffer();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const { patternRatio, outputPx, sizeMm } = MARKER_CONFIG;
  const manifest = {
    version: 1,
    scheme: "hex-badge",
    sizeMm,
    patternRatio,
    sizeMeters: sizeMm / 1000,
    markers: [],
  };

  for (const glyph of ANCHOR_GLYPHS) {
    const base = `anchor-${glyph.id}`;
    const innerPng = await sharp(Buffer.from(glyph.svg)).png().toBuffer();
    const fullPng = await buildFullMarker(innerPng, patternRatio, outputPx);
    const patt = await encodePattern(innerPng);

    await fs.writeFile(path.join(OUT_DIR, `${base}-inner.png`), innerPng);
    await fs.writeFile(path.join(OUT_DIR, `${base}.png`), fullPng);
    await fs.writeFile(path.join(OUT_DIR, `${base}.patt`), patt);

    manifest.markers.push({
      id: glyph.id,
      slug: base,
      name: glyph.name,
      image: `${base}.png`,
      pattern: `${base}.patt`,
      glyph: glyph.name.toLowerCase(),
    });

    console.log(`  ${base}  (${glyph.name})`);
  }

  await fs.writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  console.log(`\nWrote ${manifest.markers.length} markers to markers/`);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
