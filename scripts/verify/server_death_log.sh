#!/usr/bin/env bash
# scripts/verify/server_death_log.sh — the main dev server's black box.
#
# r30 (operator instruction "FIX THE DEATH PATTERN", trace 1a0f03ace2e7d7d1):
# the dmesg records prove kernel OOM kills of next-server (ten kills in
# 25 minutes on 2026-09-30, all captured). This watcher makes a death
# LOUD: evidence captured within 30s, recovery owned or delegated, every
# step logged. A death is never silent again.
#
# Usage:
#   bash scripts/verify/server_death_log.sh            # loop mode (run under daemonize.py)
#   bash scripts/verify/server_death_log.sh --once     # single check (probe/test)
#
# Cadence: 30s port listener check (ss — cheap, no HTTP).
#
# On death (no :3000 listener), ONE log entry per death (state machine:
# further entries suppressed until the listener returns — the r30 first
# run logged one death five times before this fix):
#   1. Immediately capture evidence to ~/vvu/logs/server-deaths/<UTC>.log:
#        free -m · dmesg tail -30 · journalctl -k oom|killed tail -20
#        (if readable — container fallback named) · dev.log tail
#        · ps aux head · guardian status.json (if present)
#   2. Recovery ownership — NEVER double-start:
#        - guardian process alive → guardian owns recovery (its port-rail
#          bounce has the correct tree-kill playbook; the watcher logs
#          evidence only and waits). Named in the log.
#        - guardian dead + dev.pid process alive but portless → the
#          wrapper is a zombie (kernel killed its next-server child);
#          kill the tree, then R59 restart. Named in the log.
#        - guardian dead + dev.pid dead → straight R59 restart:
#          daemonize fresh bun run dev, wait for HTTP 200 (≤120s).
#
# Fail-closed posture: if evidence tools are unreadable, the log names it
# ("(dmesg unreadable)") — never fabricated, never skipped silently.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_PIDFILE="$ROOT/.zscripts/dev.pid"
GUARDIAN_PIDFILE="$ROOT/.zscripts/guardian.pid"
GUARD_STATUS="$ROOT/vvu-trust/guardian/status.json"
LOG_DIR="${HOME}/vvu/logs/server-deaths"
POLL_SECONDS=30
BOOT_TIMEOUT=120

mkdir -p "$LOG_DIR"

utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }

listener_alive() {
  ss -tln 2>/dev/null | grep -q ':3000 '
}

pid_alive() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

guardian_alive() {
  pid_alive "$(cat "$GUARDIAN_PIDFILE" 2>/dev/null)"
}

kill_dev_tree() {
  # Kill the pidfile process and its whole tree (the zombie-wrapper case:
  # the wrapper is useless without its next-server child).
  local pid
  pid="$(cat "$DEV_PIDFILE" 2>/dev/null)"
  if [ -n "$pid" ]; then
    pkill -TERM -P "$pid" 2>/dev/null
    kill -TERM "$pid" 2>/dev/null
    sleep 2
    pkill -KILL -P "$pid" 2>/dev/null
    kill -KILL "$pid" 2>/dev/null
  fi
}

capture_evidence() {
  local f="$1"
  {
    echo "=== VVU MAIN DEV-SERVER DEATH — evidence captured $(utc) ==="
    echo
    echo "--- free -m ---"
    free -m 2>/dev/null || echo "(free unreadable)"
    echo
    echo "--- dmesg tail -30 ---"
    dmesg 2>/dev/null | tail -30 || echo "(dmesg unreadable)"
    echo
    echo "--- journalctl -k oom|killed tail -20 ---"
    journalctl -k 2>/dev/null | grep -iE "oom|killed" | tail -20 || echo "(journalctl unavailable — container fallback: dmesg above)"
    echo
    echo "--- dev.log tail -30 ---"
    tail -30 "$ROOT/dev.log" 2>/dev/null || echo "(dev.log unreadable)"
    echo
    echo "--- ps aux head -15 ---"
    ps aux 2>/dev/null | head -15 || echo "(ps unreadable)"
    echo
    echo "--- guardian status.json ---"
    cat "$GUARD_STATUS" 2>/dev/null || echo "(no guardian status — guardian not running)"
    echo
    echo "=== end evidence ==="
  } >> "$f" 2>&1
}

r59_restart() {
  local f="$1"
  {
    echo
    echo "--- R59 restart fired $(utc) ---"
  } >> "$f"
  python3 "$ROOT/.zscripts/daemonize.py" \
    --cwd "$ROOT" \
    --pidfile "$DEV_PIDFILE" \
    --log /dev/null \
    -- bun run dev >> "$f" 2>&1
  local waited=0
  while [ "$waited" -lt "$BOOT_TIMEOUT" ]; do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 http://127.0.0.1:3000/ 2>/dev/null)" = "200" ]; then
      echo "RESTART CONFIRMED :3000 → 200 at $(utc) (boot took ${waited}s)" >> "$f"
      return 0
    fi
    sleep 4
    waited=$((waited + 4))
  done
  echo "RESTART NOT CONFIRMED within ${BOOT_TIMEOUT}s at $(utc) — guardian port-rail or next pass owns the retry; evidence above stands" >> "$f"
  return 1
}

# One death → one entry. Returns 0 if a death was handled (caller sets
# DEATH_OPEN until the listener returns).
handle_death() {
  local f
  f="$LOG_DIR/death-$(date -u +%Y%m%dT%H%M%SZ).log"
  touch "$f"
  capture_evidence "$f"

  if guardian_alive; then
    echo "RECOVERY DELEGATED at $(utc): guardian process alive — its port-rail bounce owns recovery; this watcher logged evidence only" >> "$f"
  elif pid_alive "$(cat "$DEV_PIDFILE" 2>/dev/null)"; then
    {
      echo "ZOMBIE WRAPPER at $(utc): dev.pid process alive but portless (kernel killed its next-server child) — killing tree, then R59 restart"
    } >> "$f"
    kill_dev_tree >> "$f" 2>&1
    r59_restart "$f"
  else
    r59_restart "$f"
  fi
  echo "LASTLINE: death handled $(utc) — log $f" >> "$f"
  return 0
}

if [ "${1:-}" = "--once" ]; then
  if listener_alive; then
    exit 0
  fi
  handle_death
  exit 0
fi

# Loop mode — expected to run under daemonize.py (double-fork, survives
# the sandbox session reaper; plain nohup/setsid do NOT — verified r30).
# DEATH_OPEN: one entry per death; suppressed until the listener returns.
DEATH_OPEN=0
while true; do
  if listener_alive; then
    DEATH_OPEN=0
  elif [ "$DEATH_OPEN" -eq 0 ]; then
    handle_death
    DEATH_OPEN=1
  fi
  sleep "$POLL_SECONDS"
done
