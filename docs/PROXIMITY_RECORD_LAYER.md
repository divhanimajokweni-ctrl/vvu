# PROXIMITY RECORD LAYER — the four-step record pipeline demo

**View:** `#/records` (alias `#/proximity`) · **Runs locally. No cloud. No beacons.**
**Round 60** · status: BUILT, browser-verified · endpoints under `/api/proximity/*`

The record layer in one sentence: **the pipeline is real, the tamper proof rewrites
stored bytes and pinpoints the break, the sealer reuses the estate's proven kernel
rather than forking a second hasher, and the honest limits go in the brief.**

---

## The four steps

| Step | What it is | Where it lives |
| ---- | ---------- | -------------- |
| 1 · CONTRACT | `vvu.proximity.scan.v1` — integer-only, unit-suffixed, closed-world | `src/server/proximity/contract.ts` |
| 2 · GOVERNANCE GATE | explicit ALLOW / REFUSE before the sealer; refused scans are recorded but never sealed | `src/server/proximity/pipeline.ts` |
| 3 · SEAL | the estate's ONE kernel (`WormSealIndex` + canonical JCS bytes, stored at seal time) on the new stream `proximity.gqeberha.v1` | `src/server/safegrid/{canonical,worm-chain}.ts` — reused verbatim |
| 4 · VERIFY | re-hash the STORED bytes; per-record status; the break pinpointed (`BROKEN at proximity#N`) | `src/server/proximity/verify.ts` |

## The three decisions worth keeping

1. **One seal kernel, not a second hasher.** The proximity stream is a new `streamId`
   in the same `worm_seal_index` table, sealed by the same `appendIfAbsent`, the same
   domain separation (`VVU-WORM-v1`), the same linking rule (per-stream genesis = 64
   zeros). When the pilot scales, nothing about the sealer changes.
2. **Stored canonical bytes, not re-serialization at verify time.** The sealer stores
   the exact JCS bytes it hashed; every future verifier hashes THOSE bytes. A JSON
   library upgrade cannot make history stop verifying.
3. **The kernel rejected the float, and the contract was corrected.** `distance_m`
   (float) is refused with its own violation code (`DISTANCE_M_FORBIDDEN`);
   `distance_cm` (integer) is the contract. `risk_milli 821 ≡ RISK 0.821`. The
   canonicalizer was NOT widened — the kernel is right, the input is wrong. The live
   regression probe runs on every audit.

## The boundary (the strongest sentence, now in code)

> Production sources are never mutable — only the simulator partition is demoable.

Enforced as a **stored column read at tamper time** — not a runtime flag. The tamper
path loads the record, reads `proximity_records.source`, and refuses anything that is
not `'simulator'` with `403 PRODUCTION_IMMUTABLE`. There is no flag whose bug becomes
a hole in the demo. The audit endpoint **proves it live**: it attempts the tamper
against the first sealed production record and records the refusal.

## The two pre-send checks — results

**Contract audit** (`GET /api/proximity/audit` → fields table):

| field         | kind  | unit  | range              | verdict |
| ------------- | ----- | ----- | ------------------ | ------- |
| `distance_cm` | int   | cm    | 1..10000           | PASS    |
| `rssi_dbm`    | int   | dBm   | -100..-1           | PASS    |
| `battery_mv`  | int   | mV    | 2500..5000         | PASS    |
| `dwell_ms`    | int   | ms    | 0..600000          | PASS    |
| `risk_milli`  | int   | milli | 0..1000            | PASS    |
| `subject_id`  | str   | —     | `^[a-z0-9-]{2,32}$` | PASS (non-numeric) |
| `source`      | enum  | —     | simulator\|production | PASS (non-numeric — the partition key) |
| `occurred_at` | time  | —     | RFC3339-ms-Z       | PASS (informational) |

Float-rejection probe: `distance_m: 0.45` → **refused** (`DISTANCE_M_FORBIDDEN`). No
float field exists in the contract.

**Simulator/production boundary:** enforced in code (see above); live probe returns
`403 PRODUCTION_IMMUTABLE` against a sealed production record. VERIFIED.

## The governance gate + the suppression decision

Gate (before the sealer):

- **G1 CONTRACT** — `validateScan` (fail-closed, closed-world, unknown fields refused)
- **G2 ENROLMENT** — `subject_id ∈ {vvu-003, vvu-017, vvu-042, vvu-108}`

Decision pass (on allowed scans, recorded with the record):

- **R3 SUPPRESS_ACTION** — `IF risk_milli > 820 (RISK > 0.820) → SUPPRESS ACTION`
- **R4 EXTENDED_DWELL** — `IF dwell_ms > 30000 (DWELL > 30.0 s) → FLAG`

Evidence is the scan; decisions are the gate. Refused scans land in the decision log
with their reason and `sealRef: null`.

## API surface

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/api/proximity/scan` | POST | steps 1+2+3: contract → gate → seal (violations 400; refusals 200 unsealed) |
| `/api/proximity/records` | GET | decision log + labeled counts (seeds the demo baseline on first read) |
| `/api/proximity/chain` | GET | sealed stream in position order + verification |
| `/api/proximity/verify` | POST/GET | step 4: the walker, per-record status |
| `/api/proximity/tamper` | POST | the one button — rewrite stored bytes (simulator only; 403 otherwise) |
| `/api/proximity/restore` | POST | rebuild the original bytes from the untampered record row |
| `/api/proximity/audit` | GET | contract audit + float probe + boundary probe, executed live |
| `/api/proximity/watchdog` | GET/POST | GET: pass history + alarm rail + scheduler state (GET also arms the sentinel). POST `enable` / `disable` / `run-now` |
| `/api/proximity/anchor` | GET/POST | GET: the continuity ledger (every anchor replayed against the live chain). POST: pin the current verified head (refused while BROKEN; idempotent on the same head) |
| `/api/proximity/anchor/bundle` | GET/POST | GET: export the anchor ledger as a hash-covered bundle (`vvu.anchor-bundle.v1`). POST: replay a received bundle against the live chain — its own sha256 first, then every anchor inside it |

## The sentinel — continuous verification + the tamper alarm rail (phase-two v0)

Verification that only runs when someone presses a button is a demo. The sentinel
makes it a system. Three layers, each catching what the one below cannot:

1. **The stored-bytes rule** (`verify.ts`) — re-hash the stored canonical bytes.
   Catches any byte altered after seal. Runs at every verification, scheduled or manual.
2. **The watchdog** (`src/server/proximity/watchdog.ts`) — a generation-stamped
   interval inside the Next.js process (estate pattern, `safegrid/worker.ts`;
   `PROXIMITY_WATCHDOG=off` is the kill switch, `PROXIMITY_WATCHDOG_INTERVAL_MS`
   the cadence, default 30 s). Every pass walks the chain; a VALID→BROKEN
   transition — or a shrinking head position (deletion) — raises an alarm onto
   `vvu-trust/chains/proximity-alarms.jsonl`, an APPEND-ONLY rail on disk that
   outlives the process. Alarms are evidence: never edited, never removed, only
   superseded by the restore that clears the fault. The same fault is not re-raised
   every interval (dedupe by break point + reason); a restart re-raises once —
   honest, because the chain is still broken under a fresh process.
3. **External head anchors** (`src/server/proximity/anchor.ts`) — the walker alone
   cannot see a full-file rewrite that re-links the entire chain consistently.
   Anchoring pins `(seq, position, record_hash)` for the VERIFIED VALID head to
   `vvu-trust/chains/proximity-heads.jsonl` — outside the database. Every
   continuity check replays each pin against the live chain: `OK` matches,
   `DRIFT` means history was rewritten after the pin, `MISSING` means records
   were removed. A broken chain is never anchored (the kernel does not make
   claims it has not checked); pinning the same head twice is idempotent.

Honest naming: the anchor store is LOCAL — the same role object storage or an
HSM-signed head plays in full phase two, minus the off-box guarantee. The entry
format does not change when the store moves. The operator arm/disarm toggle is
per-process; the alarm rail and the anchors are the durable parts.

## The anchor bundle — evidence that travels (off-box v0)

The heads file lives on the box it anchors; if the box goes, the pins go with
it. The bundle is the off-box step available today: `GET /api/proximity/anchor/bundle`
returns one self-describing JSON document — every anchor entry, the chain state
at export time, and a sha256 over all of it (computed over a fixed key order,
so any machine with any JSON tooling can recompute it). Carry it anywhere.
`POST` the same file back — or one received from elsewhere — and the kernel
runs two separate, both-visible checks: the bundle's own integrity (recompute
the hash; a `TAMPERED` bundle is refused as evidence, never silently accepted),
then every anchor inside it replayed against the LIVE chain (`OK` / `DRIFT` /
`MISSING` — the same replay as the local ledger). The bundle file format IS the
future object-storage object; nothing changes when the store moves off-box.

## Out-of-band dispatch — alarms that leave the box

The alarm rail is durable ON THIS BOX. If the box itself is what dies — or what
is being tampered with — nobody hears the alarm. Every alarm the sentinel raises
is therefore also POSTed, fire-and-forget and AFTER the rail line is durable, to
a configured webhook endpoint. Configuration comes from env
(`PROXIMITY_ALARM_WEBHOOK_URL` / `PROXIMITY_ALARM_WEBHOOK_SECRET`, takes
precedence) or `vvu-trust/chains/webhook-config.json` — re-read on every
dispatch, no restart needed. Payloads are HMAC-SHA256-signed
(`X-VVU-Alarm-Signature` + `X-VVU-Alarm-Timestamp`) when a secret is set; a
receiver can drop unsigned calls. Every attempt — ok or failed — lands on an
append-only delivery log at `vvu-trust/chains/proximity-webhook-deliveries.jsonl`
(host only, never the full URL). Alarms raised while unconfigured are counted as
SKIPPED — the honest gap is a number, not a shrug. A signed TEST dispatch proves
the path without raising anything.

Honest naming: the webhook is a NOTIFICATION rail, not evidence storage — the
JSONL alarm rail remains the evidence of record. The loopback demo sink
(`/api/proximity/webhook-sink`, same box) proves transport, signing, delivery
logging and latency end-to-end; it is NOT out-of-band in the adversarial sense.
The real story is the identical payload POSTed to a receiver the operator
controls elsewhere.

## The retry queue — a failed delivery is a debt

A failed alarm delivery is not a shrug, it is a queue. When an alarm's dispatch
fails (timeout, non-2xx, unreachable), the exact payload enters a durable retry
row at `vvu-trust/chains/proximity-webhook-retries.jsonl` — a restart does not
forget a debt. A 15s ticker re-attempts each pending row on a backoff ladder:
3 re-attempts at 30s → 2m → 8m. Every re-attempt lands on the SAME append-only
delivery log, marked `retry` with its attempt number, signed like the original.
A later success — including one forced by the operator's RETRY NOW — closes the
row as RESOLVED with the status code as the receipt. Rows whose retries are
exhausted stay visible as GIVEN UP: the honest gap does not delete itself. The
operator can force the next attempt early (RETRY NOW — it spends the ladder,
by design) or retire a row (DISMISS) when the target is known dead; both
actions are API-first (`retry-now` / `dismiss-retry`) and buttoned in the
watchdog tab. A pending row reads at a glance: state chip, attempt N/3, next
attempt timestamp, last error, an attempt ladder (one dot per attempt), and a
backoff progress bar computed from server-clock timestamps only.

## Honest limits (read before the pilot)

- **Tamper-evident, not yet tamper-proof against a full-file rewrite.** The demo
  rewrites stored bytes and the chain pinpoints the break; an attacker who rewrote
  bytes + digests + linkage together would evade a naive walker. The sentinel's
  external head anchors close exactly this gap at v0 (local store); off-box
  anchoring plus HSM-signed chain heads complete it — the bundle makes the pins
  portable today. Neither blocks a four-week pilot.
- **SQLite, single process.** The `event_id` PK and `(stream_id, position)` UNIQUE
  constraint are the cross-instance backstops; a two-instance deployment wants the
  pilot's Postgres port (the SQL is written to port).
- **Timestamps are informational.** Position is the only order.

## The message to the specialist

> Built the record layer demo. Four steps — contract, ingest with governance gate,
> seal to a hash chain, verify. Runs locally, no cloud, no beacons. One button
> rewrites a sealed record and the chain goes BROKEN at the exact record. Give it ten
> minutes. If it holds up, I'd like to talk about a four-week pilot.
