#!/usr/bin/env bash
# scripts/round.lock.sh — ROUND LOCK (mutual exclusion for cron rounds).
#
# Operator ruling 2026-09-30 (trace 1a0efd24754be67d): every cron round
# (Job 424531 main-runner AND Job 424617 health-monitor) must hold this
# lock for the duration of its work. One writer at a time. The
# collision era (four logged collisions, two of them git-checkout
# clobbers of in-flight writes) ends here.
#
# USAGE — three patterns:
#
#   1. Wrapper (a whole round body under the lock):
#        bash scripts/round.lock.sh with <command...>
#      Acquires (or skips: prints "round skipped: lock held", exit 0),
#      runs the command, releases on exit (trap EXIT INT TERM).
#
#   2. Source (shell entry points):
#        source scripts/round.lock.sh
#        if ! acquire_lock; then echo "round skipped: lock held"; exit 0; fi
#        trap release_lock EXIT INT TERM
#        # ... round body ...
#
#   3. Agent rounds (one round, many discrete shell calls) — HOLDER MODE.
#      r32 amendment (RULINGS.md §4): nohup holders are reaped by this
#      sandbox's session reaper (holders 7625/11951/9815, three
#      independent confirmations) — daemonize.py's double-fork is the
#      only verified survivor:
#        python3 .zscripts/daemonize.py --cwd <repo-root> \
#          --pidfile .zscripts/lock.pid --log .zscripts/lock-holder.log \
#          -- bash scripts/round.lock.sh with sleep 1200
#        bash scripts/round.lock.sh status      # confirm held · alive
#        # ... round work in any number of calls ...
#        bash scripts/round.lock.sh release     # kills holder, removes lock
#
# CLI: acquire | release | status | with <cmd...> | --force-release
#   acquire          — exit 0 if acquired (incl. stale/hung reclaim),
#                      exit 1 if held (caller decides to skip)
#   release          — kill the holder process (if any), remove the lock
#   status           — print holder pid / liveness / age (never fails)
#   with CMD...      — wrapper pattern; skip is exit 0
#   --force-release  — manual unlock (operator's documented flag name)
#
# SEMANTICS (per the ruling):
#   · lock  = mkdir .round-lock/ at the repo root (atomic on one fs)
#   · holder pid + UTC start written inside; .round-lock/ is gitignored
#   · stale lock (pid dead / pid file empty)  → reclaim
#   · hung round (> 1200s ≙ 20 min)           → kill holder, reclaim
#   · IMPLEMENTATION DELTAS vs the ruling's pseudocode (correctness
#     fixes, named honestly): (a) reclaim's rm+mkdir is race-guarded —
#     a lost mkdir race returns "held", never a false acquired; (b)
#     release_lock kills a DIFFERENT live holder and waits for its
#     death before rm -rf, so a stale holder's exit-trap can never
#     delete a successor's lock; (c) the lock dir is anchored to the
#     repo root (script location), not the caller's cwd.

set -uo pipefail

LOCK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_DIR="${VVU_ROUND_LOCK_DIR:-$LOCK_ROOT/.round-lock}"
HUNG_AFTER_SECONDS="${VVU_ROUND_HUNG_AFTER:-1200}"

_now()   { date -u +%Y-%m-%dT%H:%M:%SZ; }
_epoch() { date -u +%s; }

_write_holder() {
  echo "$$" > "$LOCK_DIR/pid"
  _now > "$LOCK_DIR/started"
}

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    _write_holder
    echo "LOCK ACQUIRED by pid $$ at $(_now)"
    return 0
  fi

  local holder_pid started
  holder_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  started="$(cat "$LOCK_DIR/started" 2>/dev/null || true)"

  # Stale: no pid recorded, or pid not alive → reclaim.
  if [ -z "$holder_pid" ] || ! kill -0 "$holder_pid" 2>/dev/null; then
    echo "STALE LOCK (pid ${holder_pid:-none} dead) — reclaiming"
    rm -rf "$LOCK_DIR"
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      _write_holder
      echo "LOCK ACQUIRED by pid $$ at $(_now)"
      return 0
    fi
    echo "LOCK HELD (reclaimed by another waiter first)"
    return 1
  fi

  # Hung: live holder older than the limit → kill, reclaim.
  if [ -n "$started" ]; then
    local started_epoch age
    started_epoch="$(date -u -d "$started" +%s 2>/dev/null || echo 0)"
    age=$(( $(_epoch) - started_epoch ))
    if [ "$age" -gt "$HUNG_AFTER_SECONDS" ]; then
      echo "HUNG ROUND (pid $holder_pid, ${age}s) — killing, reclaiming"
      kill -9 "$holder_pid" 2>/dev/null || true
      rm -rf "$LOCK_DIR"
      if mkdir "$LOCK_DIR" 2>/dev/null; then
        _write_holder
        echo "LOCK ACQUIRED by pid $$ at $(_now)"
        return 0
      fi
      echo "LOCK HELD (reclaimed by another waiter first)"
      return 1
    fi
  fi

  echo "LOCK HELD by pid $holder_pid since ${started:-unknown}"
  return 1
}

release_lock() {
  [ -d "$LOCK_DIR" ] || return 0
  local holder
  holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  # Kill a different live holder (agent pattern: the holder is a
  # dedicated sleep process). Never kill ourselves — the EXIT trap runs
  # INSIDE the holder. Wait for death so the holder's own trap fires
  # before the directory is removed, and can never delete a
  # successor's lock.
  if [ -n "$holder" ] && [ "$holder" != "$$" ]; then
    kill -9 "$holder" 2>/dev/null || true
    local i
    for i in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$holder" 2>/dev/null || break
      sleep 0.1
    done
  fi
  rm -rf "$LOCK_DIR"
  echo "LOCK RELEASED"
}

status_lock() {
  if [ ! -d "$LOCK_DIR" ]; then
    echo "LOCK: free"
    return 0
  fi
  local holder started age started_epoch alive
  holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  started="$(cat "$LOCK_DIR/started" 2>/dev/null || true)"
  age="unknown"
  if [ -n "$started" ]; then
    started_epoch="$(date -u -d "$started" +%s 2>/dev/null || echo 0)"
    age=$(( $(_epoch) - started_epoch ))
  fi
  alive="dead"
  if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then alive="alive"; fi
  echo "LOCK: held · pid ${holder:-none} ($alive) · since ${started:-unknown} · age ${age}s"
}

# ─── CLI ────────────────────────────────────────────────────────────────────
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -e
  case "${1:-}" in
    acquire)
      acquire_lock
      ;;
    release | force-release | --force-release)
      release_lock
      ;;
    status)
      status_lock
      ;;
    with)
      shift
      if ! acquire_lock; then
        echo "[$(_now)] round skipped: lock held"
        exit 0
      fi
      trap release_lock EXIT INT TERM
      "$@"
      ;;
    *)
      echo "usage: $0 {acquire|release|status|with <cmd...>|--force-release}" >&2
      echo "  source this file for acquire_lock/release_lock/status_lock" >&2
      exit 64
      ;;
  esac
fi
