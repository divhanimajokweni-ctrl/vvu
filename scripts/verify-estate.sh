#!/usr/bin/env bash
# scripts/verify-estate.sh — the LIGHT standing estate probe.
#
# Named absent in r28 ("verify-estate.sh still absent, named") and
# inherited by every round since: the round protocol's VERIFY step says
# "bash scripts/verify-estate.sh → expect GREEN on the production box",
# but the script never existed. This closes that gap.
#
# SCOPE — what it checks (all read-only, seconds-cheap, memory-light so
# it can run EVERY round without tripping the guardian on an
# oversubscribed box — the memory wall is real: 195MB avail was measured
# in a QUIET window, r32):
#   1. main surface      :3000 → HTTP 200, exactly ONE listener
#   2. IVE card server   :3100 → HTTP 200
#   3. six mini-services 3003–3008 → any HTTP answer = alive
#      (3003/3008 root→404 = alive-no-route, the documented shape)
#   4. guardian          pidfile alive + status.json mode ARMED +
#                        lastPass fresh (< 120s at the 5s interval)
#   5. death watcher v2  pidfile alive (one watcher, the ONE WATCHER LAW)
#   6. shared authorities clock.json / manifest.json / ledger.jsonl
#                        readable; the ledger's chain LINKED (seq +1,
#                        prevHash ≡ prev row hash)
#
# SCOPE — what it deliberately does NOT do:
#   · tsc / eslint / battery / console gate — those are ROUND-GATE
#     checks, each a scan event on the memory wall; they stay in the
#     round protocol, not in a standing probe.
#   · ledger HASH recomputation (sha256 of the canonical row) — the
#     linkage check above catches breaks; the hash rule lives in
#     src/server/worm-store.ts and its recompute belongs to the deeper
#     gate tooling.
#
# Exit: 0 = every check green · 1 = named failures (fail-closed).
set -u

ROOT="/home/z/my-project"
cd "$ROOT" || { echo "FAIL repo root $ROOT unreadable"; exit 1; }

FAILS=0
CHECKS=0
pass() { CHECKS=$((CHECKS+1)); echo "PASS $1"; }
fail() { CHECKS=$((CHECKS+1)); FAILS=$((FAILS+1)); echo "FAIL $1"; }

# 1 — main surface
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3000/ 2>/dev/null)
[ "$code" = "200" ] && pass ":3000 HTTP 200" || fail ":3000 HTTP ${code:-none}"
listeners=$(ss -tln 2>/dev/null | grep -c ':3000 ')
[ "$listeners" = "1" ] && pass ":3000 exactly one listener" || fail ":3000 listeners=${listeners:-0}"

# 2 — IVE
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3100/ 2>/dev/null)
[ "$code" = "200" ] && pass ":3100 IVE HTTP 200" || fail ":3100 IVE HTTP ${code:-none}"

# 3 — minis (any HTTP answer = alive; 000 = dead)
for p in 3003 3004 3005 3006 3007 3008; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$p/" 2>/dev/null)
  if [ "$code" = "000" ] || [ -z "$code" ]; then
    fail ":$p mini dead (no HTTP answer)"
  elif [ "$code" = "404" ]; then
    pass ":$p mini alive-no-route (404, documented shape)"
  elif [ "$code" = "200" ]; then
    pass ":$p mini HTTP 200"
  else
    fail ":$p mini HTTP $code (up but unexpected)"
  fi
done

# 4 — guardian
gpid=""
[ -f .zscripts/guardian.pid ] && gpid=$(cat .zscripts/guardian.pid 2>/dev/null)
if [ -n "$gpid" ] && kill -0 "$gpid" 2>/dev/null; then
  pass "guardian pid $gpid alive"
else
  fail "guardian pid ${gpid:-<none>} NOT alive"
fi
gout=$(python3 - <<'PY'
import json, sys
from datetime import datetime, timezone
try:
    d = json.load(open("vvu-trust/guardian/status.json"))
except (OSError, ValueError):
    print("guardian status.json unreadable"); sys.exit(1)
mode = d.get("mode")
last = d.get("lastPassAtUtc")
fresh = False
if last:
    # the guardian's utcnow() emits "%Y-%m-%d %H:%M:%S UTC" (guardian.py
    # utcnow(); confirmed against the live status.json, r33) — accept the
    # ISO form too in case a future arm changes it.
    for fmt in ("%Y-%m-%d %H:%M:%S UTC", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            age = (datetime.now(timezone.utc) - datetime.strptime(last, fmt).replace(tzinfo=timezone.utc)).total_seconds()
            fresh = 0 <= age < 120
            break
        except ValueError:
            pass
if mode == "ARMED" and fresh:
    print("guardian ARMED, last pass fresh")
    sys.exit(0)
print(f"guardian mode={mode} lastPass={last} fresh={fresh}")
sys.exit(1)
PY
)
gexit=$?
[ "$gexit" -eq 0 ] && pass "$gout" || fail "$gout"

# 5 — death watcher
wpid=""
[ -f .zscripts/death-watcher.pid ] && wpid=$(cat .zscripts/death-watcher.pid 2>/dev/null)
if [ -n "$wpid" ] && kill -0 "$wpid" 2>/dev/null; then
  pass "death watcher pid $wpid alive"
else
  fail "death watcher pid ${wpid:-<none>} NOT alive"
fi

# 6 — shared authorities + ledger linkage
for f in docs/data/clock.json docs/data/manifest.json; do
  python3 -c "import json,sys; json.load(open('$f'))" 2>/dev/null \
    && pass "$f readable JSON" || fail "$f unreadable"
done
[ -s docs/data/ledger.jsonl ] && pass "ledger.jsonl present" || fail "ledger.jsonl missing/empty"
lout=$(python3 - <<'PY'
import json, sys
try:
    rows = [json.loads(l) for l in open("docs/data/ledger.jsonl") if l.strip()]
except (OSError, ValueError):
    print("ledger rows unreadable"); sys.exit(1)
for i in range(1, len(rows)):
    if rows[i].get("seq") != rows[i-1].get("seq", 0) + 1 or rows[i].get("prevHash") != rows[i-1].get("hash"):
        print(f"ledger chain BROKEN at row {i} (seq {rows[i].get('seq')})")
        sys.exit(1)
print(f"ledger chain linked ({len(rows)} rows, head seq {rows[-1].get('seq')})")
PY
)
lexit=$?
[ "$lexit" -eq 0 ] && pass "$lout" || fail "$lout"

# 7 — round lock tooling
[ -x scripts/round.lock.sh ] && pass "round.lock.sh present+executable" || fail "round.lock.sh missing"

if [ "$FAILS" -eq 0 ]; then
  echo "VERIFY-ESTATE: GREEN ($CHECKS checks)"
  exit 0
else
  echo "VERIFY-ESTATE: RED ($FAILS of $CHECKS checks failing — fail-closed)"
  exit 1
fi
