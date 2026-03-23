#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="${ROOT_DIR}/.presentation-dev.pid"
PORT="4310"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
    echo "Stopped process PID: $PID"
  fi
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  LISTEN_PIDS="$(lsof -ti TCP:${PORT} -sTCP:LISTEN || true)"
  if [[ -n "$LISTEN_PIDS" ]]; then
    echo "$LISTEN_PIDS" | xargs kill >/dev/null 2>&1 || true
    echo "Stopped listener(s) on port ${PORT}."
  fi
fi

echo "Presentation server stop command completed."
