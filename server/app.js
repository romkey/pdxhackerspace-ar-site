'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

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

/**
 * Derive a default preview camera entity from a sensor prefix.
 * The HA PrusaLink integration exposes a `camera.<device>` thumbnail
 * alongside the `sensor.<device>_*` sensors, so `sensor.prusa` →
 * `camera.prusa` is a sensible default when no explicit entity is set.
 */
function derivePreviewEntity(prefix) {
  if (!prefix) return '';
  const m = /^sensor\.(.+)$/.exec(prefix);
  return m ? `camera.${m[1]}` : '';
}

function loadPrinters(env = process.env) {
  const printers = [];
  for (let i = 0; i < 32; i++) {
    const name = env[`PRINTER_${i}_NAME`];
    const prefix = env[`PRINTER_${i}_SENSOR_PREFIX`];
    if (!name && !prefix) continue;
    const explicitPreview = env[`PRINTER_${i}_PREVIEW_ENTITY`];
    printers.push({
      id: i,
      name: name || `Printer ${i}`,
      prefix: prefix || '',
      preview:
        explicitPreview != null
          ? explicitPreview
          : derivePreviewEntity(prefix || ''),
    });
  }
  return printers;
}

/** Pull the HA camera/image thumbnail URL out of an entity state. */
function resolveEntityPicture(state) {
  if (!state || !state.attributes) return null;
  const pic = state.attributes.entity_picture;
  return typeof pic === 'string' && pic.length > 0 ? pic : null;
}

function createFetchHAState(env = process.env) {
  const HA_BASE_URL = (env.HA_BASE_URL || '').replace(/\/+$/, '');
  const HA_TOKEN = env.HA_TOKEN || '';
  const HA_TIMEOUT_MS = parseInt(env.HA_TIMEOUT_MS, 10) || 8000;

  return function fetchHAState(entityId) {
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
  };
}

/**
 * Returns a function that fetches an arbitrary HA path (e.g. the relative
 * `entity_picture` camera-proxy URL) and resolves with the raw image bytes
 * plus content type. Used to proxy print-preview thumbnails to the browser
 * without ever exposing the HA token.
 */
function createFetchHABinary(env = process.env) {
  const HA_BASE_URL = (env.HA_BASE_URL || '').replace(/\/+$/, '');
  const HA_TOKEN = env.HA_TOKEN || '';
  const HA_TIMEOUT_MS = parseInt(env.HA_TIMEOUT_MS, 10) || 8000;

  return function fetchHABinary(haPath) {
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
        url = new URL(haPath, HA_BASE_URL);
      } catch (err) {
        reject(new Error(`Invalid preview URL ${haPath}: ${err.message}`));
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
            Accept: 'image/*',
            'User-Agent': 'ar-site-printer-backend',
          },
          timeout: HA_TIMEOUT_MS,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HA preview HTTP ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              contentType: res.headers['content-type'] || 'image/jpeg',
              body: Buffer.concat(chunks),
            });
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`HA preview request failed: ${err.message}`));
      });
      req.on('timeout', () => {
        req.destroy(new Error(`HA preview timed out after ${HA_TIMEOUT_MS}ms`));
      });
      req.end();
    });
  };
}

async function getPrinterStatus(printer, fetchHAState) {
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

  result.preview = { available: false };
  if (printer.preview) {
    result.preview.entity_id = printer.preview;
    try {
      const state = await fetchHAState(printer.preview);
      result.preview.available = Boolean(resolveEntityPicture(state));
    } catch (err) {
      result.errors.preview = err.message;
    }
  }

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

/**
 * @param {{ env?: NodeJS.ProcessEnv, printers?: Array<{id:number,name:string,prefix:string}>, fetchHAState?: Function }} [options]
 */
function createApp(options = {}) {
  const env = options.env || process.env;
  const printers = options.printers ?? loadPrinters(env);
  const fetchHAState = options.fetchHAState ?? createFetchHAState(env);
  const fetchHABinary = options.fetchHABinary ?? createFetchHABinary(env);
  const haConfigured = Boolean(
    options.haConfigured ?? ((env.HA_BASE_URL || '') && (env.HA_TOKEN || ''))
  );

  return async function handleRequest(req, res) {
    try {
      const url = req.url || '';

      if (req.method === 'GET' && url === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          printers: printers.length,
          ha_configured: haConfigured,
        });
        return;
      }

      if (req.method === 'GET' && url === '/api/printers') {
        sendJson(res, 200, {
          printers: printers.map(({ id, name }) => ({ id, name })),
        });
        return;
      }

      const preview = /^\/api\/printer\/(\d+)\/preview(?:\?.*)?$/.exec(url);
      if (req.method === 'GET' && preview) {
        const id = parseInt(preview[1], 10);
        const printer = printers.find((p) => p.id === id);
        if (!printer) {
          sendJson(res, 404, { error: `No printer configured with id ${id}` });
          return;
        }
        if (!printer.preview) {
          sendJson(res, 404, { error: 'No preview configured for this printer' });
          return;
        }
        try {
          const state = await fetchHAState(printer.preview);
          const picture = resolveEntityPicture(state);
          if (!picture) {
            sendJson(res, 404, { error: 'No preview image available' });
            return;
          }
          const image = await fetchHABinary(picture);
          res.writeHead(200, {
            'Content-Type': image.contentType,
            'Content-Length': image.body.length,
            'Cache-Control': 'no-store',
          });
          res.end(image.body);
        } catch (err) {
          sendJson(res, 502, { error: err.message || String(err) });
        }
        return;
      }

      const m = /^\/api\/printer\/(\d+)$/.exec(url);
      if (req.method === 'GET' && m) {
        const id = parseInt(m[1], 10);
        const printer = printers.find((p) => p.id === id);
        if (!printer) {
          sendJson(res, 404, {
            error: `No printer configured with id ${id}`,
            configured: printers.map(({ id, name }) => ({ id, name })),
          });
          return;
        }
        const status = await getPrinterStatus(printer, fetchHAState);
        sendJson(res, 200, status);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('printer-backend unhandled error', err);
      sendJson(res, 500, { error: err.message || String(err) });
    }
  };
}

module.exports = {
  SENSOR_FIELDS,
  loadPrinters,
  derivePreviewEntity,
  resolveEntityPicture,
  createFetchHAState,
  createFetchHABinary,
  getPrinterStatus,
  createApp,
  sendJson,
};
