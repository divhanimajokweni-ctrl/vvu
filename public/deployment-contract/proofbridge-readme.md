# ProofBridge Validation Dashboard

> **HISTORICAL DOCUMENT (2026-09-13).** This is the README of the ORIGINAL
> krypte artifact (commits `ea7aaa0` + `56c9076`) — destroyed at the session
> boundary of 2026-09-12 23:43 UTC, kept here as its record. The CURRENT
> artifact is the user-authorised **labelled rebuild** (worklog Task 22-a,
> commits `cfbb1a5` + `da4421d`, zip `download/proofbridge-krypte-main.zip`,
> tracked in this repo). The rebuild ships its own README with the NEW
> baseline (temporal AUC 0.8437, harness root `bd467359…`, fraud seal
> `2d8b9275…`, hydraulic seal `bba4ca1f…`). The numbers below are the
> ORIGINAL's and are not reproducible from any surviving tree.

A Next.js 16 + TypeScript dashboard that **executes** the ProofBridge
fraud-model validation harness and renders the evidence: model ladder,
Tier-0 controls, behavioural fidelity, calibration, operational band, and a
SHA-256 append-only audit chain.

> This is the ProofBridge codebase. As of the substrate experiment it
> contains **two domains running through one shared verification
> substrate** (fraud + hydraulic). The deeper abstractions — generic
> Claim / ProofObligation / Evidence types, a formal TrustState, an IVE
> runtime — remain **deliberately unbuilt**: they will be formalised only
> if they emerge from evidence, not because a diagram says so. See
> [Substrate experiment](#substrate-experiment-gates-a--d).

## What is actually implemented

The harness (`src/lib/validation/harness.ts`) is not a mock. It contains
executable, deterministic (seeded) implementations of:

- Model scoring ladder: rules → B′ → flat → temporal → temporal-calibrated
- ROC AUC and partial AUC (0–0.1 FPR band)
- FNR @ 5% FPR operating point
- Tier-0 controls: label-shuffle, order-shuffle, timing-noise, positive control
- Isotonic-style calibration with ECE / Brier evaluation
- KS distance, Wasserstein distance, Spearman correlation, circular statistics
- P1–P4 behavioural checks (burst, velocity, graph, drift)
- SHA-256 audit-chain construction (`hash_i = SHA-256(prev ‖ tag ‖ payload)`)
  with end-to-end chain re-verification
- Deterministic seeded execution (`mulberry32` PRNG — same seed, same numbers)

`POST /api/validate` invokes `runValidation({ seed, n })` for real.
`POST /api/explain` produces an LLM-written decision memo from the results
(z-ai-web-dev-sdk, server-side only, with a local fallback).

`POST /api/verify` runs either vertical through the shared substrate:

```bash
curl -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  -d '{"seed":42,"vertical":"hydraulic"}'
```

Returns adjudicated checks, worst-verdict summary, canonical receipts and
a sealed per-vertical SHA-256 chain for each vertical (default: both).

## Run

```bash
bun install
bun run dev          # http://localhost:3000
```

Then in the UI: **Run harness** (seed + n), or directly:

```bash
curl -X POST http://localhost:3000/api/validate \
  -H 'content-type: application/json' -d '{"seed":42,"n":450}'
```

Headless harness baseline (no server needed):

```bash
bun run scripts/test-harness.ts
```

Substrate gate evidence (Gates A–D, no server needed):

```bash
bun run scripts/verify-gates.ts
```

## Baseline (seed 42, n 450) — captured from this exact tree

| Metric                     | Value |
| -------------------------- | ----- |
| temporal AUC               | 0.881 |
| temporal FNR @ 5% FPR      | 0.643 |
| label-shuffle AUC          | 0.536 (collapses → no label leak) |
| order-shuffle AUC          | 0.602 (degrades → temporal signal is real) |
| timing-noise AUC           | 0.849 |
| positive control Δ / null  | 0.361 / 0.001 |
| ECE raw → calibrated       | 0.176 → 0.009 |
| pAUC temporal vs flat      | 0.0307 vs 0.0136 (2.26×) |
| audit chain                | 450 records, valid, root `e36d9b4dabe3e8d8…` |
| determinism                | repeat run → identical AUC + root hash |

## Substrate experiment (Gates A–D)

The five primitives were **not** all encoded up front. The first substrate
version extracts only what already existed implicitly in `harness.ts`:

```text
VerificationOutcome   — an adjudicated domain check
ControlVerdict        — an adjudicated instrument-sanity check
Receipt               — an append-only, hash-chained evidence record
```

Implementation (TypeScript, in this repo — no second language):

```text
src/lib/verification/
├── types.ts        domain-neutral contracts (CheckSpec band language)
├── substrate.ts    adjudicate · aggregate · buildChain · runVertical
└── verticals/
    ├── fraud.ts      adapter around the UNTOUCHED harness
    └── hydraulic.ts  deterministic water-network harness
```

Gate results (`bun run scripts/verify-gates.ts`):

| Gate | Evidence | Result |
|---|---|---|
| A — reference specimen | baseline reproduced, chain verifies, determinism holds (seed 42 root `e36d9b4d…`) | **PASS** |
| B — extraction | fraud adapter verdicts ≡ the dashboard's own `derive.ts` verdicts on live output, across 5 seeds; harness + dashboard source untouched | **PASS** |
| C — second domain | hydraulic vertical: 4 Tier-0 controls + 4 outcomes, chain verifies, deterministic | **PASS** |
| D — proof | mechanical purity scan (no vertical vocabulary in `types.ts`/`substrate.ts`), canonical receipt shape for both, one `runVertical` code path, independent chains | **PASS** |

Seed-42 snapshot through the substrate:

| Vertical | Verdict | Chain |
|---|---|---|
| fraud | WARN 8/9 (the honest FNR@5%FPR finding, identical to the dashboard) | 16 records, valid, root `b2ee7c31…` |
| hydraulic | PASS 8/8 (min peak pressure 42.3 m, max velocity 2.32 m/s, mass balance exact) | 13 records, valid, root `68694f62…` |

Layering: the fraud adapter commits the harness's own internal chain root
as a receipt, so the substrate chain seals the domain chain — receipts all
the way down.

The substrate was promoted **only because** both verticals ran through it
unchanged. If a third vertical forces domain semantics into
`substrate.ts`, the purity gate will fail and the substrate must be
reworked, not decorated.

## Maturity

| Component                  | Status                          |
| -------------------------- | ------------------------------- |
| Fraud verification (TS)    | **Implemented**                 |
| Tier-0 controls            | **Implemented**                 |
| Model ladder / calibration | **Implemented**                 |
| Audit chain + re-verify    | **Implemented**                 |
| Vertical interface         | **Implemented** (Vertical / VerticalRun) |
| Hydraulic vertical         | **Implemented** (deterministic, seeded) |
| Cross-domain substrate     | **Demonstrated** (Gates A–D passing) |
| Generic Claim / Obligation / Evidence | Not formalised — will emerge from evidence or not at all |
| Formal TrustState         | Not formalised — derive from fraud∩hydraulic state needs first |
| IVE runtime               | **Out of scope** for this experiment |

### Next direction (still evidence-first)

1. Keep the fraud harness as the reference specimen — still untouched.
2. Watch whether Claim / Obligation / Evidence naturally emerge from the
   two running verticals; formalise only then.
3. Compare what state the fraud run produces vs what the hydraulic run
   needs; formalise a TrustState only from that intersection.
4. IVE becomes relevant only as an executor/viewer after the substrate has
   earned existence — it is explicitly **not** an acceptance criterion here.

## Provenance

Initial publish of the workspace in which this dashboard was built, with
workspace-local files (`.env`, local db, sandbox scripts, agent notes,
tool transcripts) removed. Development history and design decisions are
recorded in `worklog.md`. No secrets were present in the source tree.

The substrate experiment commit adds only new files under
`src/lib/verification/`, `src/app/api/verify/`, and `scripts/verify-gates.ts`;
`src/lib/validation/` (the reference specimen) is byte-identical to the
initial publish.
