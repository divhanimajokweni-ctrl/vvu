#!/usr/bin/env bash
# scripts/sweep_age_gate.sh — r32 (operator deliverable 5) — SWEEP AGE GATE.
#
# The operator's ruling draft: "Only sweeps commits younger than 24 hours
# to prevent stale churn." The auto-commit sweep actor ("Z User" cron
# commits — d59500b, f22c88b, e305126) commits tree drift whenever it
# fires; on a quiet repo that means runtime churn (latency-memory.json,
# pidfiles, pycache, rotated logs) gets committed with nothing new worth
# preserving. This gate reads the repo's LATEST COMMIT age: older than
# the limit → the sweep should not run.
#
# USAGE:
#   bash scripts/sweep_age_gate.sh                # gate only: SKIP or PROCEED
#   bash scripts/sweep_age_gate.sh -- <cmd...>    # gate + exec on PROCEED
#
# EXIT CODES:
#   0  SKIP    — the sweep's correct action is "do nothing" (this is a
#                successful gate result, per the operator's draft)
#   0  PROCEED — and with `-- <cmd...>`, the command's own exit code is
#                preserved via exec
#   1  FAIL-CLOSED — the repo/git is unreadable; never sweep on doubt
#
# BOUNDARY (named, the operator's design): the gate reads COMMIT age, not
# working-tree dirt — a stale-committed repo with fresh untracked files
# still passes. Wiring this gate into the platform-side sweep actor is
# the OPERATOR's step (the sweep is not box-owned; no crontab, no
# systemd unit on this box runs it).
#
# ENV: VVU_SWEEP_AGE_LIMIT_S overrides the freshness limit (default 86400).
set -euo pipefail

REPO="/home/z/my-project"
AGE_LIMIT_SECONDS="${VVU_SWEEP_AGE_LIMIT_S:-$((24 * 3600))}"

cd "$REPO"
LATEST_COMMIT_EPOCH="$(git log -1 --format=%ct 2>/dev/null)" || {
  echo "SWEEP AGE GATE: FAIL-CLOSED — git unreadable at $REPO; do not sweep on doubt."
  exit 1
}
[ -n "$LATEST_COMMIT_EPOCH" ] || {
  echo "SWEEP AGE GATE: FAIL-CLOSED — no commits readable at $REPO; do not sweep on doubt."
  exit 1
}

NOW="$(date +%s)"
AGE="$((NOW - LATEST_COMMIT_EPOCH))"

if [ "$AGE" -gt "$AGE_LIMIT_SECONDS" ]; then
  echo "SWEEP AGE GATE: SKIP — latest commit is ${AGE}s old (limit ${AGE_LIMIT_SECONDS}s)."
  exit 0
fi

echo "SWEEP AGE GATE: PROCEED — latest commit is ${AGE}s old (limit ${AGE_LIMIT_SECONDS}s)."
if [ "${1:-}" = "--" ]; then
  shift
  exec "$@"
fi
