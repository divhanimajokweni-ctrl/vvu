# How an alert becomes a receipt

> Drafted r48, 2026-09-30, from the estate's own measured pipeline — every
> file, function and number below exists in the tree and can be checked.
> Plain language throughout. Publishing is the operator's step; this
> document is the draft to publish.

## The cast, in plain words

**An alert** is a reading that steps out of the normal state: a sound
where there should be silence (a leak), or heat where there should be
cool (a struggling pump unit). In this estate it can also be a field
capture arriving from the phone card.

**A receipt** is a row in the estate's ledger that proves the thing
happened. The estate's own law: anything not in a receipt did not
happen.

**The WORM ledger** is the book those receipts live in. WORM means
Write Once, Read Many: rows go in, rows never change. Every row is
welded to the one before it by a hash — a short fingerprint computed
from the row's contents plus the previous row's fingerprint. Change one
letter anywhere in history and every fingerprint after it stops
matching, and the check names the exact row where the break starts.

## Step by step

### 1. The edge speaks

A node sends its reading to `POST /api/vvu/telemetry`:
node id, flow rate (L/s), pressure head (m), whether the acoustic
sensor hears something wrong, and the pump unit's temperature (°C).
A reading missing its required fields is refused with a 422 that names
what is missing. Nothing vague gets in the door.
(`src/app/api/vvu/telemetry/route.ts`)

### 2. Physics checks the reading before anything is stored

`validateTelemetry` (`src/lib/vvu-telemetry.ts`) runs two gates:

- **Wave celerity.** A speed is estimated from the pressure head and
  flow the Joukowsky way. It must sit inside the SANS safe harbour of
  200–1,400 m/s. Outside that band, the reading is refused and the
  refusal names the exact number.
- **Heat.** At 65 °C the system throttles the pump unit
  (THERMAL_THROTTLE). At 85 °C it fails closed — the reading is
  refused and the lockdown is named.

An abnormal sound with normal physics raises LEAK_ACTIVE. A reading
that passes both gates is accepted, and the acceptance message ends
with the words "WORM-bound" — meaning: this is going into the book.

### 3. The reading is stored — and only real events are welded in

The accepted reading lands in the telemetry log, scoped to the
Gqeberha tenant. Then one decision: if the system state is
STEADY_STATE_LOCKED — everything normal — no ledger row is written.
The ledger is for events, not for noise. Any other state (LEAK_ACTIVE,
THERMAL_THROTTLE, FAIL_CLOSED) writes a row that names the node, the
flow, the head and the estimated celerity. (route.ts, lines 46–53.)

### 4. The weld

`appendWormEvent` (`src/lib/vvu-ledger.ts`) does one thing, carefully:

- read the current tip of the chain;
- the new row's sequence number is tip + 1;
- the new row's fingerprint is SHA-256 over: previous fingerprint,
  sequence number, source, event, details, timestamp;
- the row stores both its own fingerprint and the previous one.

If two writers race for the same sequence number, the database
refuses the second one (a unique-constraint error), the writer
re-reads the tip and tries again on the next free number — up to five
attempts. Nobody's event is dropped, and nobody's event is
overwritten. There is no delete and no update anywhere in this code.

### 5. The field's own path — the card

The Field OS Card queues captures on the phone, offline, then posts
them in batches to `POST /api/vvu/captures/sync`:

- **Idempotent.** Sending the same capture twice is safe — the second
  copy comes back marked duplicate and the phone drops it.
- **Partial accept is the honest contract.** Bad captures are named in
  `rejected[]` with a reason; the good ones in the same batch still
  land.
- **The bridge.** Every accepted batch is also welded into the main
  ledger as its own row (source CARD_SYNC, event
  CARD_CAPTURES_SYNCED) naming the card, how many were new,
  duplicates, rejected, and the capture store's own chain head. If the
  bridge fails, the answer says `bridged: false` — reported, never
  hidden, and it does not undo the accepted sync.

The capture store keeps its own hash chain the same way the main
ledger does — a chain within a chain. (`src/lib/card-captures.ts`)

### 6. Anyone can check the whole chain, any time

- `GET /api/vvu/captures/sync` answers with the capture store's count,
  head fingerprint, last-received time and chainValid — recomputed
  over the full store on every single response. Measured at this
  draft's writing: count 13, head `f679f12e…`, chainValid true.
- The main ledger's `verifyChain()` walks every row from genesis,
  recomputing every fingerprint; one mismatch names the exact
  sequence number where the chain broke.
- The ledger also exists as a plain file (`docs/data/ledger.jsonl`,
  725 rows) that was re-hashed with an independent Python script
  before export — the chain checks out outside the app, not just
  inside it.

A broken chain is never served as if it were fine: the integrity
recompute runs before the answer, so a corrupt store answers with the
failure, not with a lie.

## What this chain guarantees — and what it does not

**It guarantees:** once a receipt is in the book, it cannot be quietly
changed — any edit breaks every fingerprint after it, and the check
names the break point. Concurrent writers cannot drop or overwrite
each other. Nothing is served after integrity fails.

**It does not guarantee:** that the readings are true. The pipeline
proves a reading was received and passed the physics gates — not that
the water main was actually leaking. The telemetry in this estate is
simulated: a service on port 3003 generates it, and there is no live
SCADA ingestion path anywhere in the stack. Every surface that states
its provenance says so. A receipt proves what was received; the world
beyond the sensor is somebody's pilot to measure.

## Check it yourself

One command, no trust required:

```
curl -s http://127.0.0.1:3000/api/vvu/captures/sync
```

You should see `chainValid: true` and a count. Then read
`src/lib/vvu-ledger.ts` — 144 lines, no delete, no update, one hash
formula. The proof is in the shape of the code, and it fits on one
screen.
