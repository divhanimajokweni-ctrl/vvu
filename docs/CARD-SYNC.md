<!-- vvu.authority.card-sync.v1 · version 2026-09-30 · revision 4
     last_written_by: main-runner · last_written_at_utc: 2026-09-30T01:40:00Z
     note: One card. One sync contract. This file describes what is BUILT and
     MEASURED on this box. Every write is ledgered in the worklog. Do not
     hand-edit without a worklog entry stating the reason.
     rev 2: GET gained an additive, optional ?recent=N param (display
     surfaces); the status shape without it is unchanged.
     rev 3: THE CARD IS FINAL, THE SERVER ADAPTS (operator ruling trace
     1a0efd24754be67d). The card half is FILLED below — the card's real
     envelope, measured from the real card.html (landed f0eecfe) — is the
     canonical contract of the IVE production sync endpoint. The store
     persists the card's fields verbatim (snake_case, never stripped); its
     chain hash extends backward-compatibly.
     rev 4: SERVING POSTURE (routes-restructure round r25) — the IVE app
     is a SERVER. output:'export' is retired (Next 15 refuses route
     handlers under a static export, measured r24); the IVE Next server
     serves the card UI and its sync endpoint SAME-ORIGIN on one port;
     trailingSlash:false makes the card's exact no-slash sync URL the
     zero-redirect path. The contract shapes below are UNCHANGED by
     rev 4 — only the serving posture moved. -->

# CARD-SYNC.md — the Field OS Card sync contract

The card is the front door. It captures contacts offline in the field,
queues them on the phone, and syncs them to the estate when a connection
exists. This file is the contract between the card and the server.

**Status: BOTH HALVES BUILT and measured. Server half (main-app ops
endpoint): commit `9fc47c3`, 2026-09-30. Card half: card.html landed
2026-09-30 (`f0eecfe`); its send code is measured below and implemented
in the IVE sync endpoint (this round).**

Two endpoints, one store, one ledger:

- **IVE sync endpoint** — `src/ive/app/api/vvu/captures/sync/route.ts` —
  the card's PRODUCTION endpoint. Speaks the card's envelope exactly
  (section below). This is the contract the phone in the field runs
  against; the card is final, the server adapts.
- **Main-app ops endpoint** — `src/app/api/vvu/captures/sync/route.ts` —
  the ops/dashboard batch contract (sections "The sync envelope (POST)"
  and "The response (POST)" below). UNCHANGED by rev 3 — do not adapt it
  to the card.
- Both write the same store (`db/card-captures.jsonl`, one SHA-256
  chain) and bridge to the same WORM ledger.

## Serving posture (rev 4 — BUILT, r25)

The IVE app is a **server**, not a static export. `output: 'export'` is
retired: Next 15 refuses route handlers under a static export (measured
live, r24), and the card is final — it syncs SAME-ORIGIN to
`location.origin + '/api/vvu/captures/sync'` (card.html send code,
measured), so one IVE server must serve both the card UI and its sync
endpoint. Consequences, all measured:

- **One server, one origin** — the IVE Next server (estate port **3100**,
  `scripts/ive/serve.sh`, R59 never-double-start pattern) serves the card
  at `/card.html` and the sync endpoint at `/api/vvu/captures/sync`. No
  CORS, no second deployment target, no dual-contract collision with the
  main app (different origin entirely — :3000).
- **Card artifact** — the tracked canonical `src/ive/card.html` is the
  only source of truth; `serve.sh` copies it to `src/ive/public/card.html`
  (gitignored runtime state, R161 law) for same-origin serving. The card
  is never regenerated; the copy is never hand-edited.
- **`trailingSlash: false`** — the card's exact sync URL has NO trailing
  slash; its form is the canonical zero-redirect path (the server adapts
  to the card, not the reverse). The r24-measured 308-redirect dance
  (POST `/sync` → 308 → `/sync/`) is eliminated at the source.
- **Env pins are mandatory** — the IVE server runs in its own cwd, so
  `serve.sh` exports `VVU_CARD_CAPTURES_DIR=<repo>/db` (one store) and
  sources `DATABASE_URL` from the repo `.env` (one WORM ledger via the
  main app's Prisma client, route B). With the pins correct, refs are
  real WORM seqs; without them the route still answers fail-closed with
  `ref: "unbridged"` — never silence.
- **The static `out/` export is retired** — it stays on disk as stale
  runtime state (gitignored) and is no longer produced. The smoke test's
  default card path is now the tracked canonical file itself.
- The main app's ops endpoint on :3000 is UNTOUCHED by rev 4 (git diff
  on that path stays empty).

---

## The endpoint

```
POST /api/vvu/captures/sync     — sync a batch of queued captures
GET  /api/vvu/captures/sync     — real status of the real store
```

## The sync envelope (POST)

```json
{
  "cardId": "card-demo-01",          // optional, ≤60 chars — the sending card
  "captures": [                       // 1–200 items per batch
    {
      "id": "cap-001",                // REQUIRED, ≤80 chars — card-generated,
                                      //   stable across re-sends (idempotency key)
      "kind": "CONTACT",              // optional: CONTACT | NOTE | REFERRAL
                                      //   (default CONTACT)
      "name": "Thandi M.",            // optional, ≤120
      "phone": "+27 82 555 0101",     // optional, ≤60
      "email": "thandi@example.co.za",// optional, ≤160
      "linkedin": "linkedin.com/in/t",// optional, ≤200
      "note": "met at plant room B",  // optional, ≤400
      "capturedAt": "2026-09-30T05:12:00.000Z"  // optional ISO-8601, card clock
    }
  ]
}
```

Rules (measured, not aspirational — each proven live on 2026-09-30):

- **At least one contact field** (name, phone, email or linkedin) — a
  capture with none is rejected with that reason.
- `capturedAt` must parse as ISO-8601 or the capture is rejected.
- The batch is **partially accepted**: invalid captures are named in
  `rejected[]` with reasons; valid ones land. One bad row never blocks
  the queue.
- Empty `captures` array → 422. Non-array → 422 with issue text.
  Broken JSON → 400. Batch > 200 → 422 (split the sync).

## The response (POST) — real shape from the live run

```json
{
  "success": true,
  "schema": "vvu.card-capture.v1",
  "accepted": [
    { "id": "cap-001", "seq": 1, "duplicate": false, "receivedAtUtc": "…" },
    { "id": "cap-001", "seq": 1, "duplicate": true,  "receivedAtUtc": "…" }
  ],
  "rejected": [
    { "id": null, "reason": "id: Invalid input: expected string, received undefined" }
  ],
  "count": 3,
  "head": "d1599294048b2e9d…",
  "chainValid": true,
  "worm": { "bridged": true, "seq": 374 }
}
```

- `accepted[].duplicate:true` means the capture was ALREADY in the chain
  (its original seq is returned). The card may drop it from its offline
  queue. **Re-sync is safe and free** — the store never writes the same
  id twice; the head does not move on a pure-duplicate sync.
- `worm.bridged:true` with `seq` = the WORM ledger row recording this
  batch (`source: CARD_SYNC`, `event: CARD_CAPTURES_SYNCED`). The bridge
  is best-effort: if it fails the sync still stands and the response
  says `bridged:false`. Nothing is hidden.

## The status response (GET)

```json
{ "success": true, "schema": "vvu.card-capture.v1", "count": 3,
  "head": "d1599294…", "lastReceivedAtUtc": "…", "chainValid": true }
```

Real numbers from the real store — no cache, no stub.

Additive (rev 2), for display surfaces: `GET …/sync?recent=N` (N ≤ 20)
appends a `recent[]` array of the newest N stored capture records,
newest first. Without the param the response is exactly the shape
above — the §11 analytics panel uses `?recent=10`.

## The store and its chain (server side, BUILT)

- File: `db/card-captures.jsonl` — append-only, one JSON record per line.
  Untracked runtime state (R161 law — same as the live SQLite db). A
  deployment of the IVE endpoint pins the SHARED store via
  `VVU_CARD_CAPTURES_DIR` (default `process.cwd()/db` — the main app's
  behaviour is unchanged).
- Chain: SHA-256 over
  `prevHash|seq|id|cardId|kind|name|phone|email|linkedin|note|capturedAt|receivedAtUtc`
  (rev ≤ 2 law), PLUS appended segments `captured_at`, `company`,
  `cipc_reg`, `basis` — each ONLY when present, in that fixed order
  (rev 3). Records without the card fields hash exactly as before, so
  the existing chain stays valid untouched. Genesis
  `CARD-GENESIS-20260930-…`. Same law as the WORM ledger
  (`src/lib/vvu-ledger.ts`).
- `chainValid` is recomputed over the full store on every response.
- Corrupt JSONL fails closed: the API returns 500 with the file name and
  line number. It never serves a chain it cannot verify.

## The card's production contract (IVE sync endpoint — CANONICAL, rev 3)

The card is final. A field phone cannot be redeployed every time the
server changes shape. This endpoint accepts the card's envelope exactly
as it sends it and returns exactly what the card expects — no
negotiation, no dual-contract, no coercion layer.

### Request (accepted exactly as the card sends it)

```
POST /api/vvu/captures/sync
x-sync-key: <optional>

{
  "schema": "vvu.captures.sync.v1",
  "writer": "field-card",
  "captured": [
    {
      "id": "string",
      "captured_at": "iso-8601",
      "name": "string",
      "phone": "string",
      "email": "string",
      "company": "string",
      "cipc_reg": "string",
      "notes": "string",
      "basis": "LEGITIMATE_INTEREST_FIRST_CONTACT" | "NONE"
    }
  ]
}
```

### Response success (exactly this shape)

```json
{ "accepted": ["id1", "id2"], "ref": "string" }
```

- `accepted` is an array of ID STRINGS (the card builds a Set from it
  and drops every queued row whose id appears).
- `ref` is the WORM bridge's seq as a string (rule 8). On a bridge
  failure the sync still stands and `ref` is `"unbridged"` — reported,
  never hidden, logged server-side.

### Response failure (exactly this shape, 4xx/5xx)

```json
{ "error": "string" }
```

### Rules (implemented 1:1 in the IVE route)

1. Unknown schema → 422 `{error}`.
2. Missing or non-array `captured` → 422 `{error}`. Empty array → 422
   too (fail-closed: an empty sync is a client bug).
3. Broken JSON → 400 `{error}`.
4. Idempotency: re-sync of an existing id → included in `accepted[]`,
   store unchanged. The card expects it in the array; it is never
   omitted.
5. The store persists `company`, `cipc_reg`, and `basis`. They are not
   optional and must not be stripped.
6. Field names in the store keep the card's snake_case (`captured_at`,
   `cipc_reg`). Never camelCased on write.
7. `x-sync-key` is checked only if `VVU_SYNC_KEY` is configured
   server-side; unconfigured = dev mode = accept. The key is never
   logged.
8. Every accepted batch bridges to the WORM ledger (source `CARD_SYNC`,
   event `CARD_CAPTURES_SYNCED`); the seq is the response `ref`.

Batch cap 200 (mirror of the ops endpoint's law) → 422 `{error}`. A
store-level rejection of any capture → 422 `{error}` naming the reason
(the success shape cannot express a partial accept); already-sealed ids
re-ack as duplicates on the card's retry, so nothing is written twice.

### What the card does (measured from the real card.html)

- Queues captures offline in localStorage; on sync it POSTs every
  un-synced row as `captured[]`.
- Builds a Set from `accepted[]` and marks those rows `synced_at`;
  records `reply.ref` as `sync_ref`.
- On any non-OK reply it reads `error` and keeps the queue intact for
  retry — safe because re-syncs are idempotent.
- Its signature layer still signs RELAY sends (key in the phone's
  localStorage; key taxonomy per RUNNER-MAIN.md). This endpoint does
  not verify a card signature because none has been defined for this
  hop; when the relay layer lands, its verification story goes here —
  not before.

---

## Smoke test

`scripts/verify/field_card_smoke.mjs` covers the CARD view against the
**tracked canonical `src/ive/card.html`** (default since r25; override
with `--card-path=` or `CARD_HTML_PATH`). Playwright is not in any
package.json on this box — run it only after that dependency decision is
made.

`scripts/verify/field_card_landing.mjs` (added r26 — worklog states the
reason) drives the REAL card served by the IVE server END TO END:
capture in the UI → the card's own send code over live HTTP (wire
envelope + reply captured) → shared store → WORM bridge (the ref IS the
seq) → main-app ops endpoint. Ten fail-closed assertions; results in
`/tmp/field_card_landing_results.json`.

## Change law

The card is the front door. Changes to this contract go through one
commit with the reason stated in the worklog. Never regenerate
card.html; never change accepted/rejected semantics without bumping
this file's revision and recording why.
