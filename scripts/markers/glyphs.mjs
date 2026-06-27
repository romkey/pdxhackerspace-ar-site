/**
 * Anchor glyphs for AR.js pattern markers.
 *
 * Each glyph is rotationally asymmetric (looks different at 0/90/180/270°),
 * which ARToolKit requires for reliable pose estimation. Glyphs are drawn
 * large on a white square inner canvas; buildFullMarker() adds the black
 * border frame when composing the printable marker.
 *
 * Used by scripts/markers/generate.mjs. Output: markers/anchor-<id>.*
 */

/** @typedef {{ id: string; name: string; svg: string; usage?: string; sizeMm?: number }} AnchorGlyph */

const SIZE = 512;

/**
 * @param {string} body Inner SVG markup (paths/shapes), drawn in black on white.
 * @returns {string}
 */
function innerSvg(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
  ${body}
</svg>`;
}

/** @type {AnchorGlyph[]} */
export const ANCHOR_GLYPHS = [
  {
    id: "0",
    name: "Triangle",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <polygon points="256,48 448,464 64,464" fill="#000000"/>
    `),
  },
  {
    id: "1",
    name: "Arrow",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <polygon points="448,256 288,128 288,192 64,192 64,320 288,320 288,384" fill="#000000"/>
    `),
  },
  {
    id: "2",
    name: "Orbit",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <circle cx="256" cy="280" r="120" fill="none" stroke="#000000" stroke-width="44"/>
      <circle cx="360" cy="136" r="40" fill="#000000"/>
    `),
  },
  {
    id: "3",
    name: "Corner",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <path d="M 48 464 L 48 176 L 336 176 L 336 272 L 144 272 L 144 464 Z" fill="#000000"/>
    `),
  },
  {
    id: "4",
    name: "Slash",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <rect x="216" y="48" width="48" height="416" rx="6" transform="rotate(-35 256 256)" fill="#000000"/>
      <circle cx="392" cy="120" r="44" fill="#000000"/>
    `),
  },
  {
    id: "5",
    name: "Fork",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <rect x="48" y="232" width="416" height="48" fill="#000000"/>
      <rect x="232" y="48" width="48" height="416" fill="#000000"/>
      <rect x="360" y="120" width="48" height="272" fill="#000000"/>
    `),
  },
  {
    id: "6",
    name: "Crescent",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <path d="M 400 256 A 128 128 0 1 1 400 255.8 Z" fill="#000000"/>
      <circle cx="280" cy="256" r="100" fill="#ffffff"/>
    `),
  },
  {
    id: "clock",
    name: "Clock",
    usage: "wall-clock",
    sizeMm: 60,
    svg: innerSvg(`
      <circle cx="256" cy="256" r="144" fill="none" stroke="#000000" stroke-width="36"/>
      <line x1="256" y1="256" x2="192" y2="144" stroke="#000000" stroke-width="40" stroke-linecap="round"/>
      <line x1="256" y1="256" x2="360" y2="320" stroke="#000000" stroke-width="24" stroke-linecap="round"/>
      <circle cx="256" cy="256" r="16" fill="#000000"/>
    `),
  },
  {
    id: "events",
    name: "Calendar",
    usage: "events",
    sizeMm: 60,
    svg: innerSvg(`
      <rect x="64" y="48" width="384" height="416" rx="12" fill="none" stroke="#000000" stroke-width="32"/>
      <rect x="64" y="48" width="384" height="96" fill="#000000"/>
      <rect x="88" y="168" width="96" height="88" fill="#000000"/>
      <rect x="208" y="168" width="96" height="88" fill="none" stroke="#000000" stroke-width="20"/>
      <rect x="328" y="168" width="96" height="88" fill="none" stroke="#000000" stroke-width="20"/>
      <rect x="88" y="280" width="96" height="88" fill="none" stroke="#000000" stroke-width="20"/>
      <rect x="208" y="280" width="96" height="88" fill="none" stroke="#000000" stroke-width="20"/>
      <rect x="328" y="280" width="96" height="88" fill="none" stroke="#000000" stroke-width="20"/>
    `),
  },
];

export const MARKER_CONFIG = {
  /** Physical print size (mm) — used in HTML size= attribute and print CSS. */
  sizeMm: 23,
  /** Inner pattern area vs full marker (higher = larger glyph, thinner black border). */
  patternRatio: 0.72,
  /** Output pixel size for printable PNG markers. */
  outputPx: 1024,
};
