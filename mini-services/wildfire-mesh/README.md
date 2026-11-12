# wildfire-mesh (:3006)

**VVU · Winter Pools · Wildfire Emergency View — backend service (Task 41-a).**
Operator-side (NOT demo) consent-gated emergency mesh for Cape Town co-op
members + fire officers, usable at 03:00 during an incident declaration.

- **Port**: `3006` (default; `WILDFIRE_PORT` env override).
- **Gateway contract**: the browser connects through the Caddy gateway on :81 —
  socket.io `io("/?XTransformPort=3006")` (engine.io path MUST be `/`), HTTP
  endpoints likewise (`/status?XTransformPort=3006`). HTTP routes are served
  through an `io.engine.use` middleware (repo-verified pattern from
  telemetry-service :3003 / vvu-field-onboard :3005).
- **FSM single source of truth**: `src/lib/wildfire-fsm.ts` (imported by
  relative path — same pattern as vvu-field-onboard ↔ proofbridge/merkle).
  Legal: NORMAL→WATCH→DECLARED→ESCALATED→STAND-DOWN→NORMAL, plus
  de-escalations WATCH→NORMAL, DECLARED→WATCH, ESCALATED→DECLARED.
- **Consent gate (hard)**: a member's field node is PRESENT only while their
  `wildfire.emergency.mesh` consent is granted. Revoked members are ABSENT
  from telemetry and the snapshot `nodes` list — never dimmed.

## Honesty labels

- Field nodes are **SIMULATED** (`sim:true` on every telemetry frame + node).
- Journal tier: **T0 · LOCAL_SOFTWARE_SHA256_CHAIN** — local software chain,
  **no external anchor** (no counter-signature, no blockchain).
- Estate-ledger mirroring (`/api/vvu/ledger`) is **NOT WIRED**; journal entries
  carry the ledger-ready WORM projection in `data.details`.
- `GET /verify` recomputes the whole chain from genesis — a REAL recompute,
  never a cached flag. A journal file that fails verification at boot is
  preserved as `data/journal.broken-<ts>.json` and a fresh genesis starts — a
  broken chain is never silently continued.

## HTTP endpoints (JSON, CORS `*`, OPTIONS handled)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/status` | `{ service, port, fsm:{state,at,actor}, members[], nodesPresent, journalHead, journalCount, tier, uptimeSec, startedAt }` |
| GET | `/journal?limit=100` | `{ entries[] (newest-first), head, count, tier }` |
| GET | `/verify` | `{ valid, count, head, tier, verifiedAt }` — full chain recompute |
| POST | `/fsm` | body `{ to, actor, reason }` → `{ ok, from, to, entry }`; illegal → `409 {error:'ILLEGAL_TRANSITION', from, to}`; unknown state → `400` |
| POST | `/consent` | body `{ memberId, grant, actor, reason? }` → `{ ok, member, entry }`; unknown member → `404` |
| GET | `/health` | `{ ok: true }` |
| GET | `/` | tiny honest landing (service + status snapshot) |

## Socket events

Server → client:
- `wildfire.snapshot` (on connect): `{ fsm, members, nodes (present-only), journalHead, journalCount, tier }`
- `wildfire.fsm`: `{ from, to, actor, reason, at, entry }`
- `wildfire.consent`: `{ memberId, callsign, grant, actor, at, entry }`
- `wildfire.journal` (every append): `{ entry, head, count }`
- `wildfire.telemetry` (every 4s, present nodes only): `{ memberId, callsign, col, row, windKph, tempC, batteryPct, at, sim:true }`

Client → server:
- `wildfire.fsm.request` `{ to, actor, reason }` — same validation as POST /fsm; illegal → `wildfire.error` `{scope:'fsm', message:'ILLEGAL_TRANSITION', from, to}`
- `wildfire.consent.request` `{ memberId, grant, actor, reason? }` — same as POST /consent; unknown member → `wildfire.error` `{scope:'consent', message:'UNKNOWN_MEMBER', memberId}`

## Journal (WORM discipline)

Append-only in-memory array, write-through persisted to `data/journal.json`
(loaded + verified at boot; restarts preserve the chain). Entry:
`{ seq, at, kind, data, prevHash, hash }` with
`hash = sha256(prevHash|seq|at|kind|JSON.stringify(data))`, genesis
`prevHash = 0…0` (64 zeros). Kinds: `GENESIS`, `fsm.seed`,
`wildfire.state.transition`, `wildfire.mesh.consent.grant`,
`wildfire.mesh.consent.revoke`, `mesh.node.telemetry`, `mesh.heartbeat`
(appended at most once per minute with `{presentNodes, windAvg}`).

## Run

```sh
cd mini-services/wildfire-mesh && bun install && bun run dev
```

Dependencies: `socket.io` 4.8.3 only (+ node builtins). No external services.
