'use strict';

const http = require('http');
const { createApp, loadPrinters } = require('./app');

const PORT = parseInt(process.env.BACKEND_PORT, 10) || 3001;
const HA_BASE_URL = (process.env.HA_BASE_URL || '').replace(/\/+$/, '');
const HA_TOKEN = process.env.HA_TOKEN || '';
const PRINTERS = loadPrinters();

const server = http.createServer(createApp());

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
