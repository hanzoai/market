#!/usr/bin/env bash
# bash (not /bin/sh → dash): the teardown below uses `wait -n`, a bash builtin.
# Under dash it fails immediately with "wait: Illegal option -n" and the
# container exits 2. oven/bun:1 ships bash at /usr/bin/bash.
set -e

# Hanzo Market — web + API only.
#
# Hanzo Base runs as a SEPARATE sidecar container in the same pod (see
# k8s/deployment.yaml) and is reachable over loopback at $BASE_URL. The app
# authenticates to it as a service principal via IAM client_credentials
# (api/src/db/index.ts). Do NOT start Base here; that responsibility belongs
# to the sidecar so each process has one job and one lifecycle.

echo "Hanzo Market starting (web + API; Base is the sidecar at ${BASE_URL:-http://127.0.0.1:8090})..."

# API server (Hono → Base SDK)
echo "Starting API server on port ${PORT:-3001}..."
BASE_URL="${BASE_URL:-http://127.0.0.1:8090}" \
PORT="${PORT:-3001}" bun run /app/api/dist/index.js &
API_PID=$!

# Web server (Nitro reads PORT for its listen port)
echo "Starting web server on port ${WEB_PORT:-3000}..."
PORT="${WEB_PORT:-3000}" bun run /app/.output/server/index.mjs &
WEB_PID=$!

# If either process exits, tear down the other and propagate the exit code so
# the container restarts cleanly rather than running half-up.
wait -n
EXIT_CODE=$?
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit "$EXIT_CODE"
