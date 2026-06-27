/**
 * Hex-badge anchor glyphs for AR.js pattern markers.
 *
 * Each glyph is rotationally asymmetric (looks different at 0/90/180/270°),
 * which ARToolKit requires for reliable pose estimation. The hex outline is
 * shared hackerspace branding; the inner glyph distinguishes anchors.
 *
 * Used by scripts/markers/generate.mjs. Output: markers/anchor-<id>.*
 * so the same scheme works for printers, tools, rooms, etc.
 */

/** @typedef {{ id: string; name: string; svg: string; usage?: string; sizeMm?: number }} AnchorGlyph */

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2;
const HEX_R = 210;
const STROKE = 28;

/**
 * Regular hexagon with a vertex at the top, centered on the canvas.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} [stroke]
 */
export function hexOutline(cx, cy, r, stroke = STROKE) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="#ffffff" stroke="#000000" stroke-width="${stroke}" stroke-linejoin="round"/>`;
}

/**
 * @param {string} body Inner SVG markup (paths/shapes), drawn in black on white.
 * @returns {string}
 */
function innerSvg(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
  ${hexOutline(CX, CY, HEX_R)}
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
      <polygon points="256,150 330,340 182,340" fill="#000000"/>
    `),
  },
  {
    id: "1",
    name: "Arrow",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <polygon points="300,256 210,190 210,225 160,225 160,287 210,287 210,322" fill="#000000"/>
    `),
  },
  {
    id: "2",
    name: "Orbit",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <circle cx="256" cy="268" r="72" fill="none" stroke="#000000" stroke-width="36"/>
      <circle cx="318" cy="210" r="28" fill="#000000"/>
    `),
  },
  {
    id: "3",
    name: "Corner",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <path d="M 170 340 L 170 220 L 290 220 L 290 270 L 220 270 L 220 340 Z" fill="#000000"/>
    `),
  },
  {
    id: "4",
    name: "Slash",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <rect x="188" y="188" width="36" height="180" rx="4" transform="rotate(-35 256 256)" fill="#000000"/>
      <circle cx="330" cy="182" r="32" fill="#000000"/>
    `),
  },
  {
    id: "5",
    name: "Fork",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <rect x="170" y="232" width="180" height="36" fill="#000000"/>
      <rect x="232" y="170" width="36" height="180" fill="#000000"/>
      <rect x="300" y="200" width="36" height="120" fill="#000000"/>
    `),
  },
  {
    id: "6",
    name: "Crescent",
    usage: "printer",
    sizeMm: 23,
    svg: innerSvg(`
      <path d="M 320 256 A 80 80 0 1 1 320 255.9 Z" fill="#000000"/>
      <circle cx="268" cy="256" r="62" fill="#ffffff"/>
    `),
  },
  {
    id: "clock",
    name: "Clock",
    usage: "wall-clock",
    sizeMm: 60,
    svg: innerSvg(`
      <circle cx="256" cy="256" r="88" fill="none" stroke="#000000" stroke-width="26"/>
      <line x1="256" y1="256" x2="218" y2="192" stroke="#000000" stroke-width="30" stroke-linecap="round"/>
      <line x1="256" y1="256" x2="318" y2="288" stroke="#000000" stroke-width="18" stroke-linecap="round"/>
      <circle cx="256" cy="256" r="12" fill="#000000"/>
    `),
  },
  {
    id: "events",
    name: "Calendar",
    usage: "events",
    sizeMm: 60,
    svg: innerSvg(`
      <rect x="168" y="158" width="176" height="196" rx="10" fill="none" stroke="#000000" stroke-width="26"/>
      <rect x="168" y="158" width="176" height="52" fill="#000000"/>
      <rect x="188" y="228" width="52" height="48" fill="#000000"/>
      <rect x="248" y="228" width="52" height="48" fill="none" stroke="#000000" stroke-width="14"/>
      <rect x="188" y="284" width="52" height="48" fill="none" stroke="#000000" stroke-width="14"/>
      <rect x="248" y="284" width="52" height="48" fill="none" stroke="#000000" stroke-width="14"/>
    `),
  },
];

export const MARKER_CONFIG = {
  /** Physical print size (mm) — used in HTML size= attribute and print CSS. */
  sizeMm: 23,
  /** Inner pattern area ratio (matches AR.js marker-creator default). */
  patternRatio: 0.5,
  /** Output pixel size for printable PNG markers. */
  outputPx: 1024,
};
