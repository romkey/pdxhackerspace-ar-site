# AR Site

[![CI](https://github.com/romkey/ar-site/actions/workflows/ci.yml/badge.svg)](https://github.com/romkey/ar-site/actions/workflows/ci.yml)
[![Docker](https://github.com/romkey/ar-site/actions/workflows/docker.yml/badge.svg)](https://github.com/romkey/ar-site/actions/workflows/docker.yml)

A minimal web augmented reality app using [AR.js](https://ar-js-org.github.io/AR.js-Docs/) and [A-Frame](https://aframe.io/).

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000` on your computer, or `http://<your-lan-ip>:3000` on your phone (same Wi‑Fi).

## Docker

Published image (GitHub Container Registry):

```bash
docker pull ghcr.io/romkey/ar-site:latest
docker run --rm -p 3000:80 --env-file .env ghcr.io/romkey/ar-site:latest
```

Replace `romkey/ar-site` with your fork's `owner/repo` if needed. Tags: `latest` tracks `main`; semver tags like `v1.2.3` are published on release tags.

Build locally:

```bash
cp .env.example .env   # edit values; HA_TOKEN etc.
docker compose up --build
```

Same URLs as above (`http://localhost:3000`). The image serves `public/` with nginx. For phone camera access over the network you still need HTTPS in front of the container (reverse proxy or tunnel), not plain HTTP.

### Configuration via `.env`

All runtime configuration (calendar feed URL, Home Assistant credentials, printer definitions) lives in a `.env` file next to `docker-compose.yml`. The file is gitignored — copy `.env.example` to `.env` and edit it. If `.env` is missing the stack still boots with built-in defaults; the printer page will simply report that Home Assistant isn't configured until you fill in the values.

## Wall clock AR (QR + Hiro poster)

This is the main flow: a QR code opens the AR page; a **Hiro marker** on the same poster tells the camera where to draw the clock on the wall.

1. `npm start` and open [poster.html](http://localhost:3000/poster.html) on your computer.
2. Set **Public URL** to something your phone can reach (e.g. `https://192.168.1.x:3000` with HTTPS, or your deployed domain).
3. Print the poster and mount it on a wall (QR on top, Hiro marker below).
4. Scan the QR code on your phone → opens [wall-clock.html](http://localhost:3000/wall-clock.html).
5. Allow camera access, then point at the Hiro marker. The current time updates every second while you watch.

The clock is rendered by `public/js/wall-display.js`. Add more rows later with `registerWallLine(() => '72°F')` (or async fetches) before the scene loads.

## Events dashboard AR

[events.html](http://localhost:3000/events.html) is a second AR experience that overlays the next few upcoming events from an iCalendar feed on a Hiro marker. Open it on your phone, point at the marker, and you'll see the live time plus a configurable number of upcoming events.

### Configuration

The feed is configured at runtime from environment variables. The Docker image renders both `public/js/config.js` (the browser-side config object) and `/etc/nginx/conf.d/default.conf` (which proxies the upstream feed) at container start:

| Variable | Default | Purpose |
|----------|---------|---------|
| `CALENDAR_ICS_URL` | `https://events.pdxhackerspace.org/calendar.ics` | Upstream iCalendar feed; nginx proxies it. |
| `CALENDAR_BROWSER_URL` | `/feed/calendar.ics` | URL the browser fetches. Defaults to the same-origin proxy so CORS is never an issue; override with an absolute URL to bypass the proxy. |
| `CALENDAR_EVENT_COUNT` | `3` | Number of upcoming events to display. |

Set them in `.env`:

```bash
CALENDAR_ICS_URL=https://example.com/my.ics
CALENDAR_EVENT_COUNT=3
```

Or override on the command line: `CALENDAR_ICS_URL=… docker compose up --build`.

### Why a proxy?

The browser's `fetch` only sees a response body when the upstream sends `Access-Control-Allow-Origin`. Many calendar feeds (including PDX Hackerspace's) don't, so a direct cross-origin fetch from the AR page would connect but the browser would refuse to expose the response to JS. The Docker image side-steps this by proxying the feed at `/feed/calendar.ics` with `Access-Control-Allow-Origin: *` added by nginx, so the page fetches a same-origin URL.

For local `npm start` there is no proxy, so the events page only works against a CORS-enabled feed. Override the URL on the fly with `?calendar=<url>` on the AR page, or edit `public/js/config.js`.

### Simple marker demo

[marker-based.html](http://localhost:3000/marker-based.html) — blue cube + “Hello AR” on a Hiro marker.

## Printer status AR (Home Assistant)

[printer.html](http://localhost:3000/printer.html) overlays live Prusa printer status — name, file, progress, ETA, material, nozzle, hot end and bed temperatures — on **hex-badge AR anchors** stuck to each printer. The data comes from a Home Assistant instance (the [PrusaLink](https://www.home-assistant.io/integrations/prusalink/) integration exposes those sensors).

### Why a backend?

The HA REST API requires a long-lived bearer token, which must never reach the browser. The Docker image runs a small Node service on `127.0.0.1:3001` that holds the token and fetches sensor states; nginx exposes it as `/api/printer/<id>`. The browser only ever sees printer names and sanitized status JSON.

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `HA_BASE_URL` | `http://homeassistant.local:8123` | Base URL of your Home Assistant instance. |
| `HA_TOKEN` | _(unset)_ | [Long-lived access token](https://www.home-assistant.io/docs/authentication/#your-account-profile). Required. |
| `PRINTER_REFRESH_SECONDS` | `10` | Browser polling interval. |
| `PRINTER_<N>_NAME` | _(unset)_ | Display name for printer N (start at 0). |
| `PRINTER_<N>_SENSOR_PREFIX` | _(unset)_ | HA entity prefix; the backend appends `_progress`, `_filename`, `_nozzle_temperature`, etc. |

For a PrusaLink device named `prusa_mk4`, use `PRINTER_0_SENSOR_PREFIX=sensor.prusa_mk4`. The backend looks up the following suffixes per printer and gracefully ignores any that don't exist:

`_progress`, `_print_state`, `_print_finish`, `_print_time_remaining`, `_filename`, `_material`, `_nozzle_temperature`, `_nozzle_target_temperature`, `_nozzle_diameter`, `_heatbed_temperature`, `_heatbed_target_temperature`.

### Multiple printers

Configure up to seven printers with env vars (`PRINTER_0_NAME`, `PRINTER_0_SENSOR_PREFIX`, … through `PRINTER_6_*`). Each printer gets a unique **hex anchor label** (`anchor-0` … `anchor-6`); pointing the camera at a label loads that printer's status automatically.

1. Open [marker-labels.html](http://localhost:3000/marker-labels.html) and print the sheet on matte label stock (default **23 mm** square).
2. Stick `anchor-0` on printer 0, `anchor-1` on printer 1, and so on.
3. Open [printer.html](http://localhost:3000/printer.html) on your phone and point at a label.

You can still override the default printer at page load with `?printer=<id>` for testing without a label.

### Failure surface

If the backend can't reach Home Assistant or a sensor is missing, the AR overlay shows the printer name plus the failure reason (`HTTP 401`, `auth failed`, `connect ECONNREFUSED`, etc.) and the requested endpoint, so you can debug from the camera view without devtools.

## HTTPS (required on phones over the network)

Browsers only allow `getUserMedia` on secure origins. `localhost` is fine on a laptop; testing from a phone via your LAN IP usually needs HTTPS.

Generate a local cert (one-time):

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

Then:

```bash
npm run start:https
```

Visit `https://<your-lan-ip>:3000` on your phone and accept the self-signed certificate warning.

## AR.js modes (pick one build)

AR.js ships separate builds — use only what you need:

| Mode | Use case | A-Frame build |
|------|----------|----------------|
| **Marker** | Track printed markers (Hiro, custom patterns) | `aframe-ar.js` |
| **Image (NFT)** | Track a photo / poster | `aframe-ar-nft.js` |
| **Location** | GPS anchors in the real world | `aframe-ar-nft.js` + `gps-*` components |

This project starts with **marker-based** AR because it needs no GPS and no custom image descriptors.

### Hex-badge anchors (custom pattern markers)

This project uses a shared **hex outline + unique glyph** scheme for AR anchors. Markers live in `markers/` at the repo root and are generated with:

```bash
npm run markers
```

This reads glyph definitions from `scripts/markers/glyphs.mjs` and writes printable PNGs, AR.js `.patt` pattern files, and `markers/manifest.json`. Edit `MARKER_CONFIG.sizeMm` in `glyphs.mjs` if you change label size (and update the matching `size=` attribute on `<a-marker>` elements).

For local dev, `public/markers` is a symlink to `../markers` so `npm start` serves them at `/markers/…`. Docker copies `markers/` into the image directly.

Each anchor is named `anchor-<id>` so the same scheme works for printers today and other AR experiences later — map an anchor id to whatever content you need in each page's `data-*` attributes.

For pages still using Hiro markers (wall clock, events), see the [AR.js pattern marker tool](https://ar-js-org.github.io/AR.js/three.js/examples/marker-training/examples/generator.html) or reuse anchors from the manifest.

## Next steps

- [AR.js documentation](https://ar-js-org.github.io/AR.js-Docs/)
- [A-Frame primitives & components](https://aframe.io/docs/1.6.0/introduction/)
- For stronger **image tracking**, consider [MindAR](https://github.com/hiukim/mind-ar-js) (AR.js still leads for markers + location-based AR).
