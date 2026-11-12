#!/bin/bash
# VVU dev server watchdog — restarts the Next.js dev server when it dies.
# The sandbox OOM-kills next-server after ~10-40s. This watchdog detects
# the death and restarts within 5 seconds.
#
# Usage: nohup setsid bash .zscripts/watchdog.sh &
#
# To stop: pkill -f "watchdog.sh"

PROJECT_DIR="/home/z/my-project"
PID_FILE="$PROJECT_DIR/.zscripts/dev.pid"
LOG_FILE="$PROJECT_DIR/dev.log"
MAX_OLD_SPACE=768  # MB — moderate limit; the Turbopack cache flag (next.config.ts)
                  # is the real fix, this is a backstop

start_dev() {
  # Kill any stale next processes
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 1

  # Start with memory limit + webpack (lower memory than turbopack)
  cd "$PROJECT_DIR"
  NODE_OPTIONS="--max-old-space-size=$MAX_OLD_SPACE" nohup bun run dev > "$LOG_FILE" 2>&1 < /dev/null &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  disown "$pid" 2>/dev/null || true
  echo "[watchdog] started dev server (PID $pid, max-old-space=${MAX_OLD_SPACE}MB)"
}

check_dev() {
  # Check if the process is alive AND responding
  local pid
  pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi
  # Also check HTTP
  if ! curl -s --connect-timeout 2 --max-time 3 http://localhost:3000/ > /dev/null 2>&1; then
    return 1
  fi
  return 0
}

echo "[watchdog] started at $(date)"
echo "[watchdog] checking every 5 seconds. PID file: $PID_FILE"

# Initial start
start_dev
sleep 8

# Watch loop
while true; do
  if ! check_dev; then
    echo "[watchdog] $(date): dev server down — restarting..."
    start_dev
    sleep 8
  fi
  sleep 5
done
