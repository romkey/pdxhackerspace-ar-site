'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  loadPrinters,
  derivePreviewEntity,
  resolveEntityPicture,
  getPrinterStatus,
  createApp,
} = require('../server/app');

function mockFetch(states) {
  return async function fetchHAState(entityId) {
    if (Object.prototype.hasOwnProperty.call(states, entityId)) {
      return states[entityId];
    }
    return null;
  };
}

function request(app, url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = { method, url };
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers;
      },
      end(body) {
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: body ? JSON.parse(body) : null,
        });
      },
    };

    Promise.resolve(app(req, res)).catch(reject);
  });
}

// Like request() but returns the raw (unparsed) body, for binary routes.
function rawRequest(app, url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = { method, url };
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers;
      },
      end(body) {
        resolve({ status: this.statusCode, headers: this.headers, body });
      },
    };

    Promise.resolve(app(req, res)).catch(reject);
  });
}

describe('loadPrinters', () => {
  it('loads sequential printer env vars', () => {
    const printers = loadPrinters({
      PRINTER_0_NAME: 'Alpha',
      PRINTER_0_SENSOR_PREFIX: 'sensor.alpha',
      PRINTER_1_NAME: 'Beta',
      PRINTER_1_SENSOR_PREFIX: 'sensor.beta',
    });

    assert.equal(printers.length, 2);
    assert.deepEqual(printers[0], {
      id: 0,
      name: 'Alpha',
      prefix: 'sensor.alpha',
      preview: 'camera.alpha',
    });
    assert.deepEqual(printers[1], {
      id: 1,
      name: 'Beta',
      prefix: 'sensor.beta',
      preview: 'camera.beta',
    });
  });

  it('defaults missing name or prefix', () => {
    const printers = loadPrinters({
      PRINTER_0_NAME: 'Solo',
      PRINTER_2_SENSOR_PREFIX: 'sensor.two',
    });

    assert.equal(printers.length, 2);
    assert.equal(printers[0].name, 'Solo');
    assert.equal(printers[0].prefix, '');
    assert.equal(printers[1].id, 2);
    assert.equal(printers[1].name, 'Printer 2');
  });

  it('derives a camera preview entity from the sensor prefix', () => {
    const printers = loadPrinters({
      PRINTER_0_NAME: 'Prusa',
      PRINTER_0_SENSOR_PREFIX: 'sensor.prusa',
    });
    assert.equal(printers[0].preview, 'camera.prusa');
  });

  it('honors an explicit preview entity and allows disabling', () => {
    const printers = loadPrinters({
      PRINTER_0_SENSOR_PREFIX: 'sensor.prusa',
      PRINTER_0_PREVIEW_ENTITY: 'camera.custom',
      PRINTER_1_SENSOR_PREFIX: 'sensor.xl',
      PRINTER_1_PREVIEW_ENTITY: '',
    });
    assert.equal(printers[0].preview, 'camera.custom');
    assert.equal(printers[1].preview, '');
  });
});

describe('derivePreviewEntity', () => {
  it('maps sensor.* to camera.*', () => {
    assert.equal(derivePreviewEntity('sensor.prusa'), 'camera.prusa');
  });

  it('returns empty for non-sensor or missing prefixes', () => {
    assert.equal(derivePreviewEntity('binary_sensor.x'), '');
    assert.equal(derivePreviewEntity(''), '');
  });
});

describe('resolveEntityPicture', () => {
  it('extracts entity_picture from a camera state', () => {
    assert.equal(
      resolveEntityPicture({ attributes: { entity_picture: '/p.png' } }),
      '/p.png'
    );
  });

  it('returns null when missing', () => {
    assert.equal(resolveEntityPicture({ attributes: {} }), null);
    assert.equal(resolveEntityPicture(null), null);
  });
});

describe('getPrinterStatus', () => {
  it('returns sensor data from Home Assistant states', async () => {
    const printer = { id: 0, name: 'Prusa', prefix: 'sensor.prusa' };
    const fetchHAState = mockFetch({
      'sensor.prusa_progress': {
        entity_id: 'sensor.prusa_progress',
        state: '42.5',
        attributes: { unit_of_measurement: '%' },
        last_updated: '2026-01-01T00:00:00Z',
      },
      'sensor.prusa_print_state': {
        entity_id: 'sensor.prusa_print_state',
        state: 'printing',
        attributes: {},
        last_updated: '2026-01-01T00:00:00Z',
      },
    });

    const status = await getPrinterStatus(printer, fetchHAState);

    assert.equal(status.name, 'Prusa');
    assert.equal(status.sensors.progress.state, '42.5');
    assert.equal(status.sensors.print_state.state, 'printing');
    assert.deepEqual(status.errors, {});
  });

  it('records errors when HA fetch fails', async () => {
    const printer = { id: 0, name: 'Prusa', prefix: 'sensor.prusa' };
    const fetchHAState = async () => {
      throw new Error('HA auth failed (HTTP 401)');
    };

    const status = await getPrinterStatus(printer, fetchHAState);

    assert.ok(Object.keys(status.errors).length > 0);
    assert.match(status.errors.progress, /401/);
  });

  it('reports missing prefix without calling HA', async () => {
    let called = false;
    const fetchHAState = async () => {
      called = true;
      return null;
    };

    const status = await getPrinterStatus(
      { id: 0, name: 'Prusa', prefix: '' },
      fetchHAState
    );

    assert.equal(called, false);
    assert.match(status.errors._global, /prefix/i);
  });

  it('marks preview available when the camera has a thumbnail', async () => {
    const printer = {
      id: 0,
      name: 'Prusa',
      prefix: 'sensor.prusa',
      preview: 'camera.prusa',
    };
    const fetchHAState = mockFetch({
      'camera.prusa': {
        entity_id: 'camera.prusa',
        state: 'idle',
        attributes: { entity_picture: '/api/camera_proxy/camera.prusa?token=x' },
      },
    });

    const status = await getPrinterStatus(printer, fetchHAState);
    assert.equal(status.preview.available, true);
    assert.equal(status.preview.entity_id, 'camera.prusa');
  });

  it('reports preview unavailable without a thumbnail', async () => {
    const printer = {
      id: 0,
      name: 'Prusa',
      prefix: 'sensor.prusa',
      preview: 'camera.prusa',
    };
    const status = await getPrinterStatus(printer, mockFetch({}));
    assert.equal(status.preview.available, false);
  });
});

describe('createApp', () => {
  const printers = [
    { id: 0, name: 'Prusa', prefix: 'sensor.prusa' },
    { id: 1, name: 'XL', prefix: 'sensor.xl' },
  ];

  it('GET /api/health returns ok and printer count', async () => {
    const app = createApp({ printers, haConfigured: true });
    const res = await request(app, '/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.printers, 2);
    assert.equal(res.body.ha_configured, true);
  });

  it('GET /api/printers lists configured printers', async () => {
    const app = createApp({ printers });
    const res = await request(app, '/api/printers');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.printers, [
      { id: 0, name: 'Prusa' },
      { id: 1, name: 'XL' },
    ]);
  });

  it('GET /api/printer/:id returns aggregated status', async () => {
    const app = createApp({
      printers,
      fetchHAState: mockFetch({
        'sensor.prusa_filename': {
          entity_id: 'sensor.prusa_filename',
          state: 'benchy.gcode',
          attributes: {},
          last_updated: '2026-01-01T00:00:00Z',
        },
      }),
    });

    const res = await request(app, '/api/printer/0');

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 0);
    assert.equal(res.body.sensors.filename.state, 'benchy.gcode');
  });

  it('GET /api/printer/:id returns 404 for unknown printer', async () => {
    const app = createApp({ printers });
    const res = await request(app, '/api/printer/9');

    assert.equal(res.status, 404);
    assert.match(res.body.error, /No printer configured/);
    assert.equal(res.body.configured.length, 2);
  });

  it('returns 404 for unknown routes', async () => {
    const app = createApp({ printers });
    const res = await request(app, '/api/nope');

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not found');
  });

  it('GET /api/printer/:id/preview streams the proxied image', async () => {
    const app = createApp({
      printers: [
        { id: 0, name: 'Prusa', prefix: 'sensor.prusa', preview: 'camera.prusa' },
      ],
      fetchHAState: mockFetch({
        'camera.prusa': {
          entity_id: 'camera.prusa',
          state: 'idle',
          attributes: { entity_picture: '/api/camera_proxy/camera.prusa?token=x' },
        },
      }),
      fetchHABinary: async (path) => {
        assert.match(path, /camera_proxy/);
        return { contentType: 'image/png', body: Buffer.from('PNGDATA') };
      },
    });

    const res = await rawRequest(app, '/api/printer/0/preview');
    assert.equal(res.status, 200);
    assert.equal(res.headers['Content-Type'], 'image/png');
    assert.equal(res.body.toString(), 'PNGDATA');
  });

  it('GET /api/printer/:id/preview 404 when no preview configured', async () => {
    const app = createApp({
      printers: [{ id: 0, name: 'P', prefix: 'sensor.p', preview: '' }],
    });
    const res = await request(app, '/api/printer/0/preview');

    assert.equal(res.status, 404);
    assert.match(res.body.error, /No preview configured/);
  });

  it('GET /api/printer/:id/preview 404 when the camera has no image', async () => {
    const app = createApp({
      printers: [
        { id: 0, name: 'Prusa', prefix: 'sensor.prusa', preview: 'camera.prusa' },
      ],
      fetchHAState: mockFetch({}),
    });
    const res = await request(app, '/api/printer/0/preview');

    assert.equal(res.status, 404);
    assert.match(res.body.error, /No preview image/);
  });
});
