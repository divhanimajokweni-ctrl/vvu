# NOT CLAIMED — read before quoting this specimen

> Public boundary document for the **proofbridge-liner** repository.
>
> The baseline in the README is an **instrument demonstration on synthetic
> data**. None of the following is claimed:

## This repository does NOT claim

1. **Real bank / payments performance.** No production transaction data was
   used, seen, or scored.
2. **Production fraud detection.** This is a validation instrument, not a
   detection system in deployment.
3. **Real-world generalization.** Seed-42 / n-450 synthetic data
   demonstrates the harness, not field efficacy.
4. **Regulatory approval** of any kind, in any jurisdiction.
5. **Independent certification or third-party audit.** Verification is
   self-run and reproducible — which is the point — but it is first-party.
6. **Deployment at any financial institution.** None has occurred.
7. **A completed cross-domain substrate in this repository.** The
   cross-domain substrate work (Claim / Obligation / Evidence
   generalisation, the hydraulic vertical) lives in the separate substrate
   repository. This repository is the single-domain Fraud specimen.
8. **Implemented Hydraulic verification here.** The hydraulic domain, where
   it exists, is a deterministic synthetic water-network model — no SCADA
   ingestion, no real telemetry, anywhere in the stack.
9. **Recovery of the original artifact.** The pre-2026-09-13 roots
   (`e36d9b4d…` / `b2ee7c31…` / `68694f62…`) are historical provenance for
   a tree that no longer exists. The current artifact is the labelled
   rebuild with its own roots — see `PROVENANCE.md`.

## What IS true

- The harness is **executable and deterministic** — same seed, same
  numbers, same roots, every run, for anyone.
- The audit chain **verifies end-to-end** and is independently
  reproducible with the documented commands.
- The Tier-0 controls (label-shuffle, order-shuffle, timing-noise,
  positive control) **execute for real**, and their verdicts are the honest
  ones — including the WARNs.
- The **honest finding** at the documented operating point:
  FNR @ 5% FPR = 0.4103 — reported as a WARN, not hidden.

## Quoting rule

If a number from this specimen appears anywhere outside its README tables,
it must carry its provenance line:

> *synthetic data, seed 42, n 450, REBUILD-19-c roots — instrument
> demonstration, not efficacy.*
