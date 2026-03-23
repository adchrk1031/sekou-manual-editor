#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="4310"
URL="http://localhost:${PORT}/presentation"
LOG_FILE="${ROOT_DIR}/.presentation-dev.log"
PID_FILE="${ROOT_DIR}/.presentation-dev.pid"

cd "$ROOT_DIR"

is_server_up() {
  curl -fsS "$URL" >/dev/null 2>&1
}

open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
  elif command -v start >/dev/null 2>&1; then
    start "$URL"
  else
    echo "ブラウザで以下を開いてください: $URL"
  fi
}

if is_server_up; then
  echo "Presentation server is already running."
  open_url
  exit 0
fi

echo "Starting presentation server on port ${PORT}..."
nohup npm run dev -- --port "$PORT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

for _ in $(seq 1 60); do
  if is_server_up; then
    echo "Presentation is ready: $URL"
    open_url
    exit 0
  fi
  sleep 1
done

echo "サーバー起動待機がタイムアウトしました。ログを確認してください: $LOG_FILE"
exit 1
