# PROVENANCE — the ProofBridge Fraud Specimen

> Public boundary document for the **proofbridge-liner** repository (the
> frozen, public, single-domain Fraud reference specimen — per the approved
> liner/krypt split: *liner proves, krypt generalizes*).
>
> Prepared 2026-09-13 from the verified workspace state (development worklog
> Tasks 20 / 22-a; canonical artifact zip md5
> `01562c14cc1c85fa7b1228dcee77b78a`).

## 1. What this specimen is

A **single-domain Fraud validation implementation**: an executable, seeded,
deterministic harness — model scoring ladder (rules → B′ → flat → temporal →
temporal-calibrated), Tier-0 controls, behavioural P1–P4 checks, isotonic
calibration with ECE/Brier evaluation, and a SHA-256 append-only audit chain
with end-to-end re-verification — plus the dashboard that renders its
evidence.

It is a **reference specimen**: the instrument the cross-domain substrate
experiment is measured against. It is not a fraud-detection product.

## 2. Data provenance — synthetic, and that is the point

All validation data is **synthetic**, generated in-process by a seeded PRNG
(mulberry32). The documented baseline uses **seed 42, n = 450**.

- The specimen demonstrates the **instrument**: does the ladder discriminate,
  do the controls catch leakage, does the chain verify, is execution
  deterministic.
- It does **not** demonstrate real-world fraud efficacy — see
  `NOT_CLAIMED.md`.

## 3. Artifact lineage (read before quoting any number)

| | ORIGINAL artifact | REBUILD-19-c |
|---|---|---|
| commits | `ea7aaa0` + `56c9076` | `cfbb1a5` + `da4421d` |
| harness chain root | `e36d9b4d…` | `bd4673596aebfcfb…` |
| fraud seal root | `b2ee7c31…` | `2d8b92751c52…` |
| hydraulic seal root | `68694f62…` | `bba4ca1f106a…` |
| artifact bytes | **unavailable** | **available** (tracked zip) |
| status | **historical provenance only** | **current verified artifact** |

The original was destroyed at a session boundary (2026-09-12 23:43 UTC) and
is not reproducible. The rebuild is a **new experiment with new roots** —
user-authorised, labelled, never presented as the original.

**Rule:** the original roots are historical claims only. They are never
regenerated, substituted, or represented as belonging to the rebuild. The
rebuild has its own identity.

## 4. Current verified baseline (seed 42, n 450) — REBUILD-19-c

| Metric | Value |
|---|---|
| temporal AUC (holdout) | 0.8437 |
| FNR @ 5% FPR | 0.4103 (the honest miss rate — reported as WARN) |
| ECE raw → calibrated | 0.1085 → 0.0831 |
| pAUC (0–0.1 FPR) temporal vs flat | 2.07× |
| label-shuffle control | AUC collapses to 0.5150 → no label leak |
| order-shuffle control | AUC degrades 0.8437 → 0.7053 → temporal signal is real |
| timing-noise control | AUC 0.8437 → 0.8539 → robust to clock noise |
| positive control | planted-signal Δ 0.4731 vs placebo −0.0298 |
| audit chain | 451 records (1 genesis + 450), valid, root `bd467359…` |
| determinism | rerun → identical metrics + identical root |

Through the substrate (same tree): fraud vertical **WARN 8/9** (13 receipts,
seal root `2d8b9275…`), hydraulic vertical **PASS 8/8** (11 receipts, root
`bba4ca1f…`). Gates A–D all PASS, purity scan clean.

## 5. How to verify (no trust required)

```bash
bun install
bun run scripts/test-harness.ts   # baseline + chain + determinism
bun run scripts/verify-gates.ts   # Gates A–D
```

Determinism means anyone, anywhere, gets the same roots from the same tree.

## 6. Incident record (why a rebuild exists at all)

- **2026-09-12 23:43 UTC** — session boundary dropped gitignored paths; the
  original repository and zip were lost. The loss was documented before any
  replacement existed; recovery was left to an explicit user decision.
- **2026-09-13** — the user authorised a labelled rebuild (option b). It was
  rebuilt from the documented recipe with two-commit discipline: the
  specimen (`src/lib/validation/`) is **byte-identical across both commits**
  (verified by blob hash at rebuild time). The zip is **tracked in git** so
  the loss class cannot recur.
- **2026-09-13 (later)** — a second boundary dropped the rebuild’s local
  git-history layer. The tracked zip survived (md5 verified), the tree was
  re-extracted, and **all gates re-verified with identical roots** —
  deterministic reproduction. The git-history layer is re-created, as a new
  labelled generation, only when needed for push.

## 7. Operator facts

Entity facts (legal name, registration numbers, province, B-BBEE status,
contact) are **operator-maintained** and are never asserted by this
repository or its code. See the capability dossier for where they live.
