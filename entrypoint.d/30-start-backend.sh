#!/bin/sh
# Launch the printer-status backend as a background child of PID 1 (nginx).
# The nginx docker-entrypoint runs all /docker-entrypoint.d/*.sh scripts
# sequentially, then execs nginx; the node process keeps running because
# it's been backgrounded.
#
# We don't bother with a process supervisor: if node crashes, the printer
# page just shows fetch errors — the rest of the AR site keeps working.

set -eu

: "${BACKEND_PORT:=3001}"
export BACKEND_PORT

if [ ! -f /app/server.js ]; then
    echo "ar-site: /app/server.js missing, skipping printer backend"
    exit 0
fi

if ! command -v node >/dev/null 2>&1; then
    echo "ar-site: node not installed, skipping printer backend"
    exit 0
fi

mkdir -p /var/log
echo "ar-site: starting printer backend on 127.0.0.1:${BACKEND_PORT}"
nohup node /app/server.js >>/var/log/printer-backend.log 2>&1 &
