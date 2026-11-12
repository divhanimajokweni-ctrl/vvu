# VVU EARTH TECH — Client Component Matrix

> Contract-first. One backend, many consumer cores.
> This document is the source of truth for every VVU client and the
> contract each one implements. Integrators must read this BEFORE forking.

## Contract discipline (BPB-inspired)

BPB Worker Panel hands every client one URL that resolves to a per-client
rendered config. VVU adopts the same pattern (no proxy code, only the
pattern): every licensee receives **one edge-rendered signed license URL**
— `GET /api/license/:orgId/edge` — which returns the per-org license
bundle (signature + publicKeyPem + verification recipe + matrix). The
licensee curls this URL once on boot and verifies its own license offline.

**One backend, many consumer cores.** Third-party integrators must NOT
fork the VVU runtime. They implement the contract described here against
the dashboard's API surface and the mini-services' Socket.IO / HTTP
endpoints. Forking breaks signature verification, audit logging, and the
revocation model (revocation = Ed25519 key rotation: a new keypair
invalidates all prior signatures).

## Matrix

| Client       | Protocol     | Port  | Version | Auth model                | Audit log          |
| ------------ | ------------ | ----- | ------- | ------------------------- | ------------------ |
| epd-cli      | HTTP         | 3031  | 1.0.0+  | none (localhost-only)     | stderr + JSON out  |
| event-bus    | Socket.IO    | 3032  | 1.0.0+  | none (subscribe by type)  | in-memory ring     |
| worm-nest    | Socket.IO    | 3003  | 1.0.0+  | none (observe-only)       | WORM chain on disk |
| debugger     | HTTP + SSE   | 3098  | 1.0.0+  | none (observe-only, I5)   | WORM chain + .sessions/ |
| dashboard    | HTTP (Next)  | 3000  | 1.4.0+  | session cookie (NextAuth) | /api/audit append-only |
| rea          | HTTP + SSE   | 3034  | 0.1.0 (planned) | signed collector certs | sealed pointer events to debugger |

> Note on worm-nest: the deployed `mini-services/worm-nest/index.ts`
> listens on port **3003**. The dashboard UI references 3033 in some
> places — that is a known doc/code drift to be reconciled. The
> contract matrix records the actual deployed port.

## epd-cli (port 3031)

Epistemic Policy Definition validator. CLI + HTTP mini-service.

- `POST /run` — canonical contract: `{ command, source?, state?, current?, proposed?, index?, strict? }` → `{ ok, diagnostics, invariants, … }`. The simplified `/validate { source } → { ok, errors[], invariants }` shape is the validation subset.
- `GET /health` → `{ ok, service, port, version }`
- `GET /samples` → list of bundled `.epd` sample policies
- Cross-port access: `POST /api/run?XTransformPort=3031`
- Version compatibility: 1.0.0+
- Auth: none (localhost-only; Caddy gateway enforces port forwarding)
- Audit: stdout/stderr + structured JSON returned in the response body

## event-bus (port 3032, Socket.IO)

Real-time broadcast of runtime events.

- Connect: `io("/?XTransformPort=3032", { transports: ["websocket"] })`
- Server-emitted events: `transition`, `violation`, `merge`, `shadow`, `shard` (all wrapped under the `event` channel with a `type` discriminator)
- Client-emitted: `subscribe` (string[] of types), `push` (test event)
- Server greetings: `history` (last 50 events on connect), `ack` (per push)
- Version: 1.0.0+
- Auth: none (subscribe filter only)
- Audit: in-memory ring buffer (1000 events, last-50 replay on connect)

## worm-nest (port 3003, Socket.IO)

Witness-Oriented Replicated Memory chain — append-only evidence store.

- Connect: `io("/?XTransformPort=3003", { transports: ["websocket"] })`
- Server-emitted: `snapshot`, `evidence`, `worm`, `chain-head`, `eis`
- Version: 1.0.0+
- Auth: none (observe-only; writes happen server-side)
- Audit: WORM chain on disk, Merkle-rooted, tamper-evident

## debugger (port 3098, HTTP + SSE)

The epistemic microscope. Observe-only (I5 — no write path into product runtime).

- `POST /session/start` → `{ ok, sessionId, genesis, head }`
- `POST /session/:id/event` → `{ ok, event }` (append one event)
- `POST /session/:id/events` → batch append (≤500)
- `POST /session/:id/close` → close session with reason
- `GET  /session/:id` → `{ ok, session, events, head, totalCount }`
- `GET  /session/:id/verify` → WORM chain integrity check
- `GET  /session/:id/replay` → pure-function replay over event list (I3)
- `POST /diff` → `{ a, b }` → holistic session diff (I4)
- `GET  /sessions` → list all sessions
- `GET  /stream` → SSE live tail (optional `?sessionId=` filter)
- `GET  /healthz` → service health
- Version: 1.0.0+
- Auth: none (observe-only, localhost-only)
- Audit: per-session WORM chain + `.sessions/` disk store; merkleRoot exposed

## dashboard (port 3000, Next.js)

Control-plane UI + API gateway. All endpoints are relative paths; cross-port
requests use `?XTransformPort=<port>`.

- `GET  /api/stats` — global KPIs
- `GET  /api/policies` / `POST /api/policies` — policy CRUD
- `GET  /api/license` — bulk license list with `edgeUrls` map (one per org)
- `GET  /api/license/:orgId/edge` — **edge-rendered signed license URL** (BPB pattern)
- `POST /api/license/:orgId/verify` — server-side Ed25519 verification helper
- `GET  /api/audit` — append-only audit log
- (…see `/api/dev/docs/api-reference` for the full list)
- Version: 1.4.0+
- Auth: NextAuth.js v4 session cookie (workspace routes); public read on stats/license
- Audit: `/api/audit` is append-only; license reads log to audit at debug level

## rea (port 3034, planned)

Reverse-Engineering Agent — observe-only. Writes artifacts to
`mini-services/rea/artifacts/`, emits sealed pointer events to the
debugger. No write path into the product runtime (inherits debugger's I5).

- Status: planned (0.1.0)
- Protocol: HTTP + SSE
- Auth: signed collector certs (planned)
- Audit: sealed pointer events forwarded to debugger; local artifact store

## Integrator checklist

1. Read this matrix end-to-end. Do NOT fork the runtime.
2. Pick the contract(s) you consume (epd-cli for validation, event-bus for
   live transitions, worm-nest for evidence, debugger for replay/diff).
3. Use `?XTransformPort=<port>` for cross-port requests — never direct
   `localhost:<port>` URLs.
4. For license verification: curl your org's `/api/license/:orgId/edge`
   URL, follow the 6-step verification recipe, cache the bundle for up
   to 5 minutes (`Cache-Control: max-age=300`).
5. For revocation: the issuer rotates the Ed25519 keypair. Your cached
   bundle's `publicKeyPem` will stop verifying new signatures — re-fetch
   the edge URL to get the new key. No DB mutation, no per-client state.
