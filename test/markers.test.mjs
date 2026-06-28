import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANCHOR_GLYPHS, MARKER_CONFIG } from '../scripts/markers/glyphs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MARKERS_DIR = path.join(ROOT, 'markers');

describe('anchor glyphs', () => {
  it('defines unique ids and glyph art', () => {
    const ids = new Set();
    for (const glyph of ANCHOR_GLYPHS) {
      assert.ok(glyph.id, `glyph missing id: ${glyph.name}`);
      assert.ok(!ids.has(glyph.id), `duplicate glyph id: ${glyph.id}`);
      ids.add(glyph.id);
      assert.match(glyph.svg, /<svg/);
    }
    assert.ok(ANCHOR_GLYPHS.length >= 9);
  });

  it('uses a high pattern ratio for larger inner art', () => {
    assert.ok(MARKER_CONFIG.patternRatio >= 0.65);
  });
});

describe('generated markers', () => {
  it('manifest lists every glyph with pattern files', () => {
    const manifestPath = path.join(MARKERS_DIR, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'run npm run markers first');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.scheme, 'anchor');
    assert.equal(manifest.markers.length, ANCHOR_GLYPHS.length);

    for (const entry of manifest.markers) {
      assert.ok(entry.slug.startsWith('anchor-'));
      assert.ok(entry.pattern.endsWith('.patt'));
      assert.ok(entry.image.endsWith('.png'));
      assert.ok(typeof entry.sizeMm === 'number');
      assert.ok(fs.existsSync(path.join(MARKERS_DIR, entry.pattern)));
      assert.ok(fs.existsSync(path.join(MARKERS_DIR, entry.image)));
    }
  });

  it('pattern files contain non-trivial encoded data', () => {
    for (const glyph of ANCHOR_GLYPHS) {
      const pattPath = path.join(MARKERS_DIR, `anchor-${glyph.id}.patt`);
      const patt = fs.readFileSync(pattPath, 'utf8');
      assert.ok(patt.length > 1000, `${glyph.id} patt looks empty`);
      assert.ok(/[^0\s]/.test(patt), `${glyph.id} patt is all zeros`);
    }
  });
});
