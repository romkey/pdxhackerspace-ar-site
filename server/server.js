/**
 * Backend proxy for Home Assistant printer status.
 *
 * Listens on 127.0.0.1 only — nginx fronts this and is the only thing that
 * talks to it. We keep the HA bearer token here, on the server, so it never
 * reaches the browser.
 *
 * Endpoints
 *   GET /api/health           → { ok: true, printers: <count> }
 *   GET /api/printers         → { printers: [{ id, name }] }
 *   GET /api/printer/:id      → aggregated status for the printer
 *
 * Env vars
 *   HA_BASE_URL                e.g. http://homeassistant.local:8123
 *   HA_TOKEN                   long-lived access token
 *   PRINTER_<N>_NAME           display name (N starts at 0)
 *   PRINTER_<N>_SENSOR_PREFIX  HA entity prefix (e.g. sensor.prusa_mk4)
 *   BACKEND_PORT               loopback port to listen on (default 3001)
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = parseInt(process.env.BACKEND_PORT, 10) || 3001;
const HA_BASE_URL = (process.env.HA_BASE_URL || '').replace(/\/+$/, '');
const HA_TOKEN = process.env.HA_TOKEN || '';
const HA_TIMEOUT_MS = parseInt(process.env.HA_TIMEOUT_MS, 10) || 8000;

// Per printer, we look up these fields by appending the suffix to the
// configured sensor prefix. Anything missing is recorded under `errors`
// so the frontend can decide what to surface.
const SENSOR_FIELDS = [
  ['progress', 'progress'],
  ['print_state', 'print_state'],
  ['print_finish', 'print_finish'],
  ['print_time_remaining', 'print_time_remaining'],
  ['filename', 'filename'],
  ['material', 'material'],
  ['nozzle_temperature', 'nozzle_temperature'],
  ['nozzle_target_temperature', 'nozzle_target_temperature'],
  ['nozzle_diameter', 'nozzle_diameter'],
  ['heatbed_temperature', 'heatbed_temperature'],
  ['heatbed_target_temperature', 'heatbed_target_temperature'],
];

function loadPrinters() {
  const printers = [];
  for (let i = 0; i < 32; i++) {
    const name = process.env[`PRINTER_${i}_NAME`];
    const prefix = process.env[`PRINTER_${i}_SENSOR_PREFIX`];
    if (!name && !prefix) continue;
    printers.push({
      id: i,
      name: name || `Printer ${i}`,
      prefix: prefix || '',
    });
  }
  return printers;
}

const PRINTERS = loadPrinters();

function fetchHAState(entityId) {
  return new Promise((resolve, reject) => {
    if (!HA_BASE_URL) {
      reject(new Error('HA_BASE_URL is not configured'));
      return;
    }
    if (!HA_TOKEN) {
      reject(new Error('HA_TOKEN is not configured'));
      return;
    }

    let url;
    try {
      url = new URL(`/api/states/${encodeURIComponent(entityId)}`, HA_BASE_URL);
    } catch (err) {
      reject(new Error(`Invalid HA_BASE_URL ${HA_BASE_URL}: ${err.message}`));
      return;
    }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          Authorization: `Bearer ${HA_TOKEN}`,
          Accept: 'application/json',
          'User-Agent': 'ar-site-printer-backend',
        },
        timeout: HA_TIMEOUT_MS,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(new Error(`Invalid JSON from HA: ${err.message}`));
            }
          } else if (res.statusCode === 404) {
            // Entity doesn't exist; treat as missing rather than fatal.
            resolve(null);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error(`HA auth failed (HTTP ${res.statusCode})`));
          } else {
            reject(
              new Error(
                `HA HTTP ${res.statusCode}: ${body.slice(0, 200) || '(empty body)'}`
              )
            );
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`HA request failed: ${err.message}`));
    });
    req.on('timeout', () => {
      req.destroy(new Error(`HA request timed out after ${HA_TIMEOUT_MS}ms`));
    });
    req.end();
  });
}

async function getPrinterStatus(printer) {
  const result = {
    id: printer.id,
    name: printer.name,
    prefix: printer.prefix,
    sensors: {},
    errors: {},
    fetchedAt: new Date().toISOString(),
  };

  if (!printer.prefix) {
    result.errors._global = 'No sensor prefix configured for this printer';
    return result;
  }

  await Promise.all(
    SENSOR_FIELDS.map(async ([field, suffix]) => {
      const entityId = `${printer.prefix}_${suffix}`;
      try {
        const state = await fetchHAState(entityId);
        if (state) {
          result.sensors[field] = {
            entity_id: state.entity_id,
            state: state.state,
            attributes: state.attributes || {},
            last_updated: state.last_updated,
          };
        }
      } catch (err) {
        result.errors[field] = err.message;
      }
    })
  );

  return result;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '';

    if (req.method === 'GET' && url === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        printers: PRINTERS.length,
        ha_configured: Boolean(HA_BASE_URL && HA_TOKEN),
      });
      return;
    }

    if (req.method === 'GET' && url === '/api/printers') {
      sendJson(res, 200, {
        printers: PRINTERS.map(({ id, name }) => ({ id, name })),
      });
      return;
    }

    const m = /^\/api\/printer\/(\d+)$/.exec(url);
    if (req.method === 'GET' && m) {
      const id = parseInt(m[1], 10);
      const printer = PRINTERS.find((p) => p.id === id);
      if (!printer) {
        sendJson(res, 404, {
          error: `No printer configured with id ${id}`,
          configured: PRINTERS.map(({ id, name }) => ({ id, name })),
        });
        return;
      }
      const status = await getPrinterStatus(printer);
      sendJson(res, 200, status);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('printer-backend unhandled error', err);
    sendJson(res, 500, { error: err.message || String(err) });
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`printer-backend listening on 127.0.0.1:${PORT}`);
  console.log(
    `  HA_BASE_URL=${HA_BASE_URL || '(not set)'} ha_token=${HA_TOKEN ? 'set' : 'unset'}`
  );
  if (PRINTERS.length === 0) {
    console.log('  no printers configured (set PRINTER_0_NAME, PRINTER_0_SENSOR_PREFIX)');
  } else {
    for (const p of PRINTERS) {
      console.log(`  printer ${p.id}: ${p.name} (prefix: ${p.prefix || '(none)'})`);
    }
  }
});
