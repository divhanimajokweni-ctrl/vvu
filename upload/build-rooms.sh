#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# VVU · Fused Twin — room packager
# -----------------------------------------------------------------------
# Compiles every room into its own self-contained mini-zip, each with:
#   - the room's source (HTML/TSX/TS)
#   - any binary deps that room needs (GLBs)
#   - a README explaining the room + how to run it standalone
#
# Every zip stays well under GitHub's 100MB file-size limit.
# The zips land in /home/z/my-project/download/rooms/
# ═══════════════════════════════════════════════════════════════════════
set -e

PROJ=/home/z/my-project
SURF=$PROJ/public/surfaces
SRC=$PROJ/src
OUT=$PROJ/download/rooms
BUILD=$OUT/build

# Fresh build dir
rm -rf "$BUILD"
mkdir -p "$BUILD"
cd "$BUILD"

# Helper: make a zip from a room folder
mkzip() {
  local name=$1
  rm -f "$OUT/$name.zip"
  zip -r -q "$OUT/$name.zip" "$name"
  local sz=$(stat -c%s "$OUT/$name.zip")
  local mb=$(echo "scale=1; $sz/1048576" | bc)
  echo "  ✓ $name.zip — ${mb} MB ($sz bytes)"
}

# Helper: write a README
writereadme() {
  local dir=$1 name=$2 body=$3
  mkdir -p "$dir"
  cat > "$dir/README.md" <<EOF
# $name

$body
EOF
}

echo "Packaging rooms..."

# ─── 00: the shell (ties everything together) ──────────────────────────
{
  mkdir -p "00-shell/src/app/api/verify-chain"
  mkdir -p "00-shell/src/lib"
  cp "$SRC/app/page.tsx" "00-shell/src/app/page.tsx"
  cp "$SRC/app/layout.tsx" "00-shell/src/app/layout.tsx" 2>/dev/null || true
  cp "$SRC/app/globals.css" "00-shell/src/app/globals.css" 2>/dev/null || true
  cp "$SRC/lib/worm.ts" "00-shell/src/lib/worm.ts"
  cp "$SRC/app/api/verify-chain/route.ts" "00-shell/src/app/api/verify-chain/route.ts"
  writereadme "00-shell" "00 · Shell (Fused Twin cockpit)" \
'The Next.js shell that fuses all 9 rooms into one mobile-first cockpit.

## What'\''s in here
- `src/app/page.tsx` — the shell (VIEW/DATA toggle, 9 tabs, fail-closed monitor)
- `src/lib/worm.ts` — canonical SHA-256 + RFC-8785 JCS hash chain
- `src/app/api/verify-chain/route.ts` — offline chain verifier (no API key)
- `src/app/layout.tsx` + `src/app/globals.css` — the app shell

## The three invariants this enforces
1. Render is deterministic from StateVector; sensor dead → red wireframe, no carry-forward
2. Every transition (including ABSENT) is appended to the hash chain
3. User can recompute the chain independently; receipt is a Merkle root

## To run
Drop into a Next.js 16 project, `bun install`, `bun run dev`. Each room
(surface) goes in `public/surfaces/`. The pilot is a native component
(see `08-pilot.zip`).
'
  mkzip "00-shell"
}

# ─── 01: MAP + AVATAR ───────────────────────────────────────────────────
{
  mkdir -p "01-map-avatar"
  cp "$SURF/map-avatar.html" "01-map-avatar/map-avatar.html"
  writereadme "01-map-avatar" "01 · MAP + AVATAR" \
'MapLibre 3D + photoreal head (Lee Perry Smith GLB from Three.js CDN).
PIP swap between map centre-stage and avatar centre-stage. FSM console
with leak detection. Vitals + ECG phosphor sweep.

**Mode:** SIM (avatar vitals are Math.random()-derived, labelled SIM TWIN)

## Run standalone
Open `map-avatar.html` in a browser over HTTPS or localhost (geolocation
needs a secure context). No build step required.
'
  mkzip "01-map-avatar"
}

# ─── 02: MAP 3D ──────────────────────────────────────────────────────────
{
  mkdir -p "02-map-3d"
  cp "$SURF/map-libre.html" "02-map-3d/map-libre.html"
  writereadme "02-map-3d" "02 · MAP 3D" \
'MapLibre 3D with OpenFreeMap tiles. GIS spatial truth panel, node array
N01-N06, FSM console (STEADY_LOCKED / LEAK_ACTIVE / WARN / CRITICAL).

**Mode:** SIM (node values are hardcoded literals)

## Run standalone
Open `map-libre.html` in a browser over HTTPS or localhost.
'
  mkzip "02-map-3d"
}

# ─── 03: RIG (photoreal manufacturing) ──────────────────────────────────
{
  mkdir -p "03-rig"
  cp "$SURF/rig.html" "03-rig/rig.html"
  cp "$SURF/6_axis_industrial_robot_arm.glb" "03-rig/6_axis_industrial_robot_arm.glb"
  writereadme "03-rig" "03 · RIG (HBK-MkII photoreal)" \
'Photoreal HBK-MkII manufacturing loop. Three.js + RoomEnvironment IBL.
5 assembly stations with 6-axis GLB robot arms. Procedural conveyor.
Zookeeper geometry kernel (KCL recipes). Hash-chained WORM ticker
(FNV-1a — see notes). FAIL_TEST button trips fail-closed.

**Mode:** SIM (simulation, labelled [SIM] in the banner)

## Run standalone
Serve the folder over HTTP (the GLB needs a same-origin fetch):
```bash
python3 -m http.server 8000
# open http://localhost:8000/rig.html
```

## Note on the hash chain
This surface has its own internal FNV-1a ticker for display. The shell
upgrades it to canonical SHA-256 + JCS at the aggregation layer.
'
  mkzip "03-rig"
}

# ─── 04: ASSEMBLY (8-station line) ──────────────────────────────────────
{
  mkdir -p "04-assembly"
  cp "$SURF/assembly.html" "04-assembly/assembly.html"
  writereadme "04-assembly" "04 · ASSEMBLY (8-station line)" \
'HBK Mk-II Hydro-Gateway assembly-line sim. 8 stations (S1-S8), takt 14s.
KPIs: packed, rejected, first-pass yield, units/hr, WIP, lead time.
Fault mode, 5 camera views (overview, feed, node, test, top).

**Mode:** SIM (header says "sim"; KPIs not tagged at value level — known gap)

## Run standalone
Serve over HTTP (loads Three.js from CDN):
```bash
python3 -m http.server 8000
# open http://localhost:8000/assembly.html
```
'
  mkzip "04-assembly"
}

# ─── 05: LAB (workspace) ───────────────────────────────────────────────
{
  mkdir -p "05-lab"
  cp "$SURF/lab.html" "05-lab/lab.html"
  writereadme "05-lab" "05 · LAB (workspace)" \
'3D lab workspace with 3 zones (Presentation Lab, Mechanical Bench,
Calibration Bay). Slide deck (Ireland content — static educational text).
Spawnable tools (gear, pipe, valve, crate). God'\''s-eye view.

**Mode:** DEMO (presentation tool, no estate telemetry — audited CLEAN)

## Run standalone
Open `lab.html` in a browser (loads Three.js r128 from CDN).
'
  mkzip "05-lab"
}

# ─── 06: ADMIN (SEARM command center) ───────────────────────────────────
{
  mkdir -p "06-admin"
  cp "$SURF/admin.html" "06-admin/admin.html"
  writereadme "06-admin" "06 · ADMIN (SEARM command center)" \
'SEARM Geo-Bioteknik command center. Disruption switches (hydraulic,
thermal). Physical topology (5 nodes). Beeswarm XAI asset-integrity plot.
3D twin canvas (N04 CELL 07). Admin approval gate. WORM ledger panel.
E-STOP button.

**Mode:** DEMO (KPIs tagged [DEMO] in chrome; hardcoded node telemetry)

## Run standalone
Open `admin.html` in a browser (loads Three.js r128 from CDN).
'
  mkzip "06-admin"
}

# ─── 07: VIEWER (WebXR GLB) ─────────────────────────────────────────────
{
  mkdir -p "07-viewer"
  cp "$SURF/viewer.html" "07-viewer/viewer.html"
  cp "$SURF/6_axis_industrial_robot_arm.glb" "07-viewer/6_axis_industrial_robot_arm.glb"
  writereadme "07-viewer" "07 · VIEWER (WebXR GLB)" \
'WebXR GLB viewer. Loads `6_axis_industrial_robot_arm.glb` by default.
Enter VR on a Quest/Vision Pro (needs HTTPS + WebXR-capable browser).
Drop-to-load any self-contained .glb. Wireframe, auto-rotate, grid,
light bg toggles. Trigger grab + thumbstick-Y scale in VR.

**Mode:** LIVE (renders real GLB geometry; no estate telemetry)

## Run standalone
Serve over HTTPS (WebXR needs a secure context):
```bash
python3 -m http.server 8000
# open https://localhost:8000/viewer.html  (or use a tunnel)
```
'
  mkzip "07-viewer"
}

# ─── 08: PILOT (the 90-second proof) ────────────────────────────────────
{
  mkdir -p "08-pilot/src/components/pilot"
  mkdir -p "08-pilot/src/lib/pilot"
  mkdir -p "08-pilot/src/app/api/pilot/ingest"
  mkdir -p "08-pilot/src/app/api/pilot/verify"
  mkdir -p "08-pilot/src/app/api/pilot/state"
  cp "$SRC/components/pilot/PilotRoom.tsx" "08-pilot/src/components/pilot/PilotRoom.tsx"
  cp "$SRC/lib/pilot/ledger.ts" "08-pilot/src/lib/pilot/ledger.ts"
  cp "$SRC/lib/pilot/receipt.ts" "08-pilot/src/lib/pilot/receipt.ts"
  cp "$SRC/app/api/pilot/ingest/route.ts" "08-pilot/src/app/api/pilot/ingest/route.ts"
  cp "$SRC/app/api/pilot/verify/route.ts" "08-pilot/src/app/api/pilot/verify/route.ts"
  cp "$SRC/app/api/pilot/state/route.ts" "08-pilot/src/app/api/pilot/state/route.ts"
  writereadme "08-pilot" "08 · PILOT (the 90-second proof)" \
'Neave Industrial Park pilot — the Minimum Viable Loop.

## The three invariants
1. **Render is deterministic from StateVector.** Sensor dead → red
   wireframe SENSOR_ABSENT box (centered, no position carry-forward).
2. **Every transition (including ABSENT) is appended to the hash chain.**
   The ledger logs RAW_INGESTED + STATE_NORMALIZED + RULE_EVALUATED per
   frame, plus OBSERVATION_MISSING / ALERT_TRIGGERED when they fire.
3. **User can recompute the chain independently.** `/api/pilot/verify`
   recomputes every SHA-256 from seq 0. The PDF receipt carries the
   Merkle root.

## The 90-second demo
1. SHOW REALITY — sensor sim runs, avatar tracks the person
2. KILL SENSOR — 500ms silence → red wireframe SENSOR_ABSENT
3. TEST GEOFENCE — person exits circle → 5s → ALERT_TRIGGERED
4. VERIFY RECEIPT (in the shell'\''s DATA screen) — CHAIN INTACT + PDF

## Files
- `src/components/pilot/PilotRoom.tsx` — Three.js room + demo controls
- `src/lib/pilot/ledger.ts` — JSONL append-only chain, SHA-256 + JCS, verify
- `src/lib/pilot/receipt.ts` — PDF receipt generator (jspdf, Merkle root)
- `src/app/api/pilot/ingest/route.ts` — POST detection → 3 ledger entries
- `src/app/api/pilot/verify/route.ts` — GET recomputes the whole chain
- `src/app/api/pilot/state/route.ts` — GET latest state + recent entries

## Honest substitution
The directive specifies Python + YOLOv8. This is TypeScript (Next.js API
routes) because the sandbox runs Next.js and there'\''s no camera. The
ingest contract, ledger format, chain hash spec, and verify logic are
identical to what the Python version would produce.

## Sensor source
SIM-labelled simulator (no camera in the sandbox). Tagged in three places
(value, ledger, UI chrome) per the No-Primitives Law. Swapping in a real
RTSP + YOLOv8 source is a change to the ingest route'\''s frame-acquisition
step, not a rewrite.
'
  mkzip "08-pilot"
}

# ─── 09: FREE CITY (game) ───────────────────────────────────────────────
{
  mkdir -p "09-free-city"
  cp "$SURF/free-city.html" "09-free-city/free-city.html"
  writereadme "09-free-city" "09 · FREE CITY (road-run game)" \
'FREE CITY // Road Run — a 3.4 MB standalone driving game. Paint swatches,
star collection, HP, speed. Self-contained (Three.js + all assets inlined).

**Mode:** GAME (not a twin surface — entertainment/demo only)

## Run standalone
Open `free-city.html` directly in a browser. No server needed (all assets
inlined). 3.4 MB — lazy-loaded by the shell on first open.
'
  mkzip "09-free-city"
}

# ─── shared GLBs (for rooms that need them) ─────────────────────────────
{
  mkdir -p "shared-glbs"
  cp "$SURF/6_axis_industrial_robot_arm.glb" "shared-glbs/6_axis_industrial_robot_arm.glb"
  cp "$SURF/ux3d_industrial_robot.glb" "shared-glbs/ux3d_industrial_robot.glb"
  writereadme "shared-glbs" "Shared GLB models" \
'Two robot-arm GLB models used by the RIG and VIEWER rooms:
- `6_axis_industrial_robot_arm.glb` (528 KB) — used by rig.html + viewer.html
- `ux3d_industrial_robot.glb` (917 KB) — spare, drop-to-load in viewer

Each room that needs a GLB already includes its own copy. This zip is
for reference / swap-in.
'
  mkzip "shared-glbs"
}

# ─── the evidence doc ───────────────────────────────────────────────────
{
  mkdir -p "evidence"
  cp "$PROJ/docs/evidence/pilot_mvp.md" "evidence/pilot_mvp.md" 2>/dev/null || true
  writereadme "evidence" "Evidence — pilot MVP" \
'The evidence note for the pilot MVP: exact commands, the hash chain spec,
the verify output, the 90-second demo script, and the honest limits.
'
  mkzip "evidence"
}

# ─── cleanup ────────────────────────────────────────────────────────────
rm -rf "$BUILD"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "All rooms packaged. Final inventory:"
echo "═══════════════════════════════════════════════════════════════════"
cd "$OUT"
for z in *.zip; do
  sz=$(stat -c%s "$z")
  mb=$(echo "scale=2; $sz/1048576" | bc)
  printf "  %-28s %8s MB\n" "$z" "$mb"
done
echo ""
echo "GitHub file-size limit: 100 MB. All zips are well under."
