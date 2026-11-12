#!/usr/bin/env bash
# VVU estate — IVE server launcher (R59 pattern: never double-start).
#
# SERVING POSTURE (main-runner r25, 2026-09-30, routes-restructure round):
# the IVE app is a SERVER — output:'export' is retired (a static export
# cannot serve the card's POST sync endpoint, measured r24). One IVE server
# serves the card UI AND its sync endpoint, same origin — the card is final
# and syncs to location.origin + '/api/vvu/captures/sync'.
#
# ENV PINS — both REQUIRED for one-store-one-ledger (the IVE app has its
# own cwd, so the defaults would fork the store and dead-end the WORM bridge):
#   VVU_CARD_CAPTURES_DIR → this repo's db/   (shared capture store, one chain)
#   DATABASE_URL          → this repo's .env  (shared WORM ledger via Prisma)
# If the pins are wrong the route still responds but refs come back
# "unbridged" — that is the fail-closed shape, never silence.
#
# Usage: bash scripts/ive/serve.sh          # start on :3100 if not running
#        bash scripts/ive/serve.sh --check  # exit 0 + one line if healthy

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="${ROOT}/src/ive"
PORT=3100
URL="http://127.0.0.1:${PORT}/"

if ! curl -s -o /dev/null --max-time 2 "${URL}"; then
  if [[ "${1:-}" == "--check" ]]; then
    echo "IVE server NOT serving on :${PORT}"
    exit 1
  fi
  # Card artifact: the tracked canonical file becomes the served copy.
  # R161 law: the copy is runtime state (gitignored); the canonical source
  # is src/ive/card.html and is NEVER regenerated — only copied.
  cp "${APP_DIR}/card.html" "${APP_DIR}/public/card.html"
  cd "${APP_DIR}"
  export VVU_CARD_CAPTURES_DIR="${ROOT}/db"
  set -a; source "${ROOT}/.env"; set +a
  nohup npx next dev -p "${PORT}" > "${ROOT}/ive-dev.log" 2>&1 &
  echo "IVE server starting on :${PORT} (pid $!) — log: ive-dev.log"
else
  echo "IVE server already serving on :${PORT} — not double-started"
fi
