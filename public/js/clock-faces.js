/**
 * Clock face math and SVG markup for wall-clock.html.
 * Pure functions — safe to import from Node tests and the browser.
 */

export const CLOCK_FACE_IDS = ["analog", "digital", "orbit"];

export const CLOCK_FACE_LABELS = {
  analog: "Neon dial",
  digital: "Terminal",
  orbit: "Orbit",
};

/** @param {unknown} id */
export function normalizeClockFace(id) {
  return CLOCK_FACE_IDS.includes(id) ? id : CLOCK_FACE_IDS[0];
}

/**
 * @param {Date} date
 * @returns {{ second: number, minute: number, hour: number }}
 */
export function getHandAngles(date) {
  const ms = date.getMilliseconds();
  const second = date.getSeconds() + ms / 1000;
  const minute = date.getMinutes() + second / 60;
  const hour = (date.getHours() % 12) + minute / 60;

  return {
    second: second * 6,
    minute: minute * 6,
    hour: hour * 30,
  };
}

/**
 * @param {number} value
 * @returns {string}
 */
export function pad2(value) {
  return String(value).padStart(2, "0");
}

/**
 * @param {Date} date
 */
export function getTimeParts(date) {
  const hours24 = date.getHours();
  return {
    hours24,
    hours12: hours24 % 12 || 12,
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    ampm: hours24 >= 12 ? "PM" : "AM",
  };
}

/**
 * @param {Date} date
 */
export function formatDigitalTime(date) {
  const parts = getTimeParts(date);
  return `${pad2(parts.hours24)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
}

/**
 * @param {number} angleDeg
 * @param {number} length
 * @param {number} [width=1]
 */
export function handLine(angleDeg, length, width = 1) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const x2 = 50 + Math.cos(rad) * length;
  const y2 = 50 + Math.sin(rad) * length;
  return `<line x1="50" y1="50" x2="${x2.toFixed(2)}" y2="${y2.toFixed(
    2
  )}" stroke-width="${width}" stroke-linecap="round"/>`;
}

/**
 * @param {Date} date
 */
export function buildAnalogSvg(date) {
  const angles = getHandAngles(date);
  const ticks = Array.from({ length: 60 }, (_, index) => {
    const angle = index * 6 - 90;
    const rad = (angle * Math.PI) / 180;
    const outer = 46;
    const inner = index % 5 === 0 ? 41 : 43.5;
    const x1 = 50 + Math.cos(rad) * inner;
    const y1 = 50 + Math.sin(rad) * inner;
    const x2 = 50 + Math.cos(rad) * outer;
    const y2 = 50 + Math.sin(rad) * outer;
    const strokeWidth = index % 5 === 0 ? 1.6 : 0.7;
    const opacity = index % 5 === 0 ? 0.95 : 0.45;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(
      2
    )}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(
      2
    )}" stroke-width="${strokeWidth}" stroke="currentColor" opacity="${opacity}"/>`;
  }).join("");

  return `<svg class="clock-analog__svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
    <defs>
      <filter id="clock-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.35"/>
    ${ticks}
    <g class="clock-analog__hour" stroke="#ff2d95" filter="url(#clock-glow)">
      ${handLine(angles.hour, 24, 3.2)}
    </g>
    <g class="clock-analog__minute" stroke="#00e5ff" filter="url(#clock-glow)">
      ${handLine(angles.minute, 34, 2.2)}
    </g>
    <g class="clock-analog__second" stroke="#ffffff" filter="url(#clock-glow)">
      ${handLine(angles.second, 38, 0.9)}
    </g>
    <circle cx="50" cy="50" r="2.2" fill="#ffffff"/>
  </svg>`;
}

/**
 * @param {Date} date
 */
export function buildOrbitSvg(date) {
  const angles = getHandAngles(date);
  const parts = getTimeParts(date);
  const hourMarkers = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 1;
    const angle = hour * 30 - 90;
    const rad = (angle * Math.PI) / 180;
    const radius = 38;
    const x = 50 + Math.cos(rad) * radius;
    const y = 50 + Math.sin(rad) * radius;
    const active = hour === parts.hours12;
    const r = active ? 3.4 : 2;
    const fill = active ? "#ffb703" : "currentColor";
    const opacity = active ? 1 : 0.35;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(
      2
    )}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
  }).join("");

  const minuteArc = describeArc(50, 50, 30, -90, angles.minute - 90);
  const secondOrbitRadius = 44;
  const secondRad = ((angles.second - 90) * Math.PI) / 180;
  const sx = 50 + Math.cos(secondRad) * secondOrbitRadius;
  const sy = 50 + Math.sin(secondRad) * secondOrbitRadius;

  return `<svg class="clock-orbit__svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.25"/>
    ${hourMarkers}
    <path d="${minuteArc}" fill="none" stroke="#fb5607" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
    <circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(
    2
  )}" r="2.5" fill="#06d6a0"/>
    <text x="50" y="52" text-anchor="middle" dominant-baseline="middle" class="clock-orbit__label">
      ${pad2(parts.hours12)}:${pad2(parts.minutes)}
    </text>
  </svg>`;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} startAngle
 * @param {number} endAngle
 */
export function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const sweep = endAngle - startAngle <= 0 ? 0 : 1;
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    "M",
    cx,
    cy,
    "L",
    start.x.toFixed(2),
    start.y.toFixed(2),
    "A",
    radius,
    radius,
    0,
    largeArc,
    sweep,
    end.x.toFixed(2),
    end.y.toFixed(2),
    "Z",
  ].join(" ");
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} angleDeg
 */
export function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}
