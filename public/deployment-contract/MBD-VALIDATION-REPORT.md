# MBD Real-Data Validation Report — ProofBridge Work Order, Deliverable 1

**Status: DELIVERED (with disclosed proxy labels and a plainly-stated, modest result).**
Run date: 2026-09-14. Executed by the ProofBridge build agent in the VVU workspace.

## 1. What was run

The central hypothesis under test: **does temporal ordering carry intent signal on
real event sequences** — the fraud specimen has only ever run on synthetic data.

- **Dataset**: `ai-lab/MBD-mini` (Sber AI Lab), the official reduced subset of
  `ai-lab/MBD` (paper arXiv:2409.17587), identical schema. Full `detail.tar.gz`
  is 38 GB; MBD-mini (2 GB) is the manageable path. Pinned revision
  `4b0d5b4c0b014e02af6c2e6b7b27851e6fb0d5c3`.
- **Selection**: `client_split` fold=0, `ORDER BY client_id LIMIT 2000` →
  **2,000 clients** (per the work order's "start with 2,000"). Selection
  fingerprint (sha256 of the client-id list):
  `3d684c...` — see `adapter-report.json` for the full digest.
- **Event sequences**: built per client from the **transaction (trx) + dialog +
  geo** tables (all three loaded; geo counted in the sequence statistics, the
  disclosed rule's observables are trx+dialog — see the adapter header).
- **Harness**: the FULL validation harness, unmodified in behavior. The runner
  (`scripts/mbd-validate.ts`) calls `runValidationOnSamples` — the same
  `evaluateWorld` code path as the synthetic reference: same deterministic
  parity split (even-index train / odd holdout over the time-ordered stream —
  the work order's "forward-walk split" is interpreted as *the same split the
  synthetic runs use*), same model ladder, same Tier-0 controls, same
  calibration, same SHA-256 audit chain. Control seed: 42.
- **Labels**: proxy APP-fraud labels from the disclosed rule, implemented in
  `proofbridge/adapters/mbd.py`. Because the referenced adapter did not exist
  in the surviving workspace and MBD's schema is anonymised (unsigned amounts,
  integer event codes with no codebook, typeless dialog rows), each rule
  observable is mapped to a **disclosed proxy**:
  - payment → every trx row (direction not expressible)
  - payee_add → counterparty `(dst_type11, dst_type12)` first seen for the
    client within the preceding 30 days
  - inbound contact → any dialog event in `[t−24h, t)` (before-side)
  - payment_review navigation → dialog events in `[t−2h, t)` (quiet-window proxy)
  - label = 1 iff recently-added payee AND contact-24h-before AND no-dialog-2h-before
- **Sample-field proxies** (disclosed): channel constant `"online"` (no channel
  dimension in MBD), `ringMerchant` 0, `propensity` = label (oracle diagnostic
  only), `gapDraw` real inter-trx gaps, `hour` native wall-clock hour, no
  timezone conversion.

**All results below are conditional on this proxy mapping. They are not claims
about real-bank fraud-detection performance.**

## 2. The run (actual numbers, verbatim from the run output)

Stream: **684,098 real transactions**, **222 positives (0.032%)** across 118
clients. Harness wall-time ≈ 5m40s. Full console output:
`evidence/mbd/run-summary.txt`; machine-readable results:
`evidence/mbd/validation-results.json`.

### Work-order-required numbers

| Required | Value |
|---|---|
| temporal AUC | **0.6511** |
| flat AUC (the work order says "flat GBM") | **0.5786** — note: the harness's `flat` rung is a nested-feature **logistic** model (the same instrument as the synthetic baseline), not a GBM |
| order-shuffle AUC | **0.6411** (Δ vs temporal = 0.0100) |
| positive-control Δ | **+0.4784** (placebo/null Δ = +0.0074) |
| FN reduction vs the B′ proxy at 5% FPR | **0.0526** (B′ FNR 0.8772 → temporal FNR 0.8246) |
| audit chain root hash | **`2a6beaf4be6d3297eae917a12f3a9e7ac52e664c4dd774f5921ca2625d68d95a`** (684,099 records, end-to-end re-verification valid) |

### Full ladder (holdout split)

| model | AUC | pAUC(0–0.1 FPR) | FNR @ 5% FPR |
|---|---|---|---|
| rules | 0.4428 | 0.0040 | 1.0000 |
| B′ | 0.5728 | 0.0107 | 0.8772 |
| flat | 0.5786 | 0.0089 | 0.9035 |
| **temporal** | **0.6511** | **0.0143** | **0.8246** |
| calibrated | 0.5000 | 0.0050 | 1.0000 |

### Tier-0 controls (each perturbation retrains the temporal model)

| control | AUC | Δ vs temporal |
|---|---|---|
| label-shuffle | 0.4936 | +0.1575 (collapses to chance → no label leak) |
| order-shuffle | 0.6411 | +0.0100 |
| timing-noise | 0.6510 | +0.0001 (75 s jitter is negligible at day-scale gaps — expected) |
| positive | 0.9784 | planted-signal Δ 0.4784 vs null 0.0074 (instrument works) |

## 3. Honest interpretation (read this before quoting any number)

1. **The temporal Δ is real in sign but modest and not conclusive.**
   Temporal beats flat by **+0.0724 AUC** (0.5786 → 0.6511). With 222
   positives (≈111 on the holdout), the AUC standard error is ≈ 0.05–0.06, so
   the Δ is ≈ 1.3σ — **suggestive, not statistically conclusive** at this
   sample size. The work order asked for the honest number; this is it.
2. **The order-shuffle Δ is near zero (0.0100) — stated plainly, as the work
   order requires.** On synthetic data, order-shuffling degraded the temporal
   AUC by 0.138; on MBD it degrades it by only 0.010. That means most of the
   temporal model's advantage on this data comes from stream-derived features
   that **survive** timeline re-laying (burst/velocity/graph structure), not
   from fine-grained event ordering. The strict "temporal ordering carries
   intent signal" reading is **weakly supported at best** under this proxy
   labeling.
3. **The calibration layer degenerates.** The cross-fitted isotonic maps
   nearly everything to the base rate at 0.032% prevalence (calibrated AUC
   0.5000) — a known isotonic behavior at extreme class sparsity. The
   synthetic world's calibration WARN does not transfer: on MBD the
   calibrated rung provides no discrimination. Reported as-is.
4. **The operating point is harsh.** FNR @ 5% FPR is high across the whole
   ladder (0.82–1.00): 111 holdout positives against 342,049 holdout
   negatives. The FN reduction vs B′ (5.26 points) is the honest delta at
   that budget.
5. **The instrument itself checks out.** Label-shuffle collapses to chance
   (no label leak); the positive control recovers a planted signal (Δ 0.4784)
   while the placebo does not (0.0074); the chain re-verifies end-to-end.
6. **Everything is proxy-conditional.** A different disclosed mapping of the
   rule (e.g. after-side contact, tighter payee age, typed dialogs) would
   produce different numbers. The proxies are printed in the adapter header
   and in the genesis record of the chain itself.

## 4. Reproducibility

```bash
# 1. download (2 GB; full MBD detail is 38 GB — MBD-mini is the official
#    reduced subset, same schema, revision 4b0d5b4c0b014e02af6c2e6b7b27851e6fb0d5c3)
curl -L -o detail.tar.gz \
  "https://huggingface.co/datasets/ai-lab/MBD-mini/resolve/main/detail.tar.gz"
curl -L -o client_split.tar.gz \
  "https://huggingface.co/datasets/ai-lab/MBD-mini/resolve/main/client_split.tar.gz"
tar -xzf detail.tar.gz --wildcards "detail/trx/fold=0/*" "detail/dialog/fold=0/*" "detail/geo/fold=0/*"
tar -xzf client_split.tar.gz

# 2. adapter: build the real-data sample stream + proxy labels
python3 proofbridge/adapters/mbd.py --data <extracted dir> --out out \
  --clients 2000 --fold 0
#   -> out/samples.json (sha256 c2a6276b8da7e6a26d5d6443b09031446281732f6e
#      3f9100fad679079b827ef995) + out/adapter-report.json

# 3. full harness (same evaluateWorld path as the synthetic reference)
bun run scripts/mbd-validate.ts out/samples.json out/adapter-report.json \
  evidence/mbd
#   -> chain root 2a6beaf4be6d3297eae917a12f3a9e7ac52e664c4dd774f5921c...
```

**Determinism proofs captured this round:**
- adapter rerun → `out2/samples.json` **byte-identical** to `out/samples.json`
  (independently regenerated, `cmp` clean; identical sha256).
- full harness rerun (`evidence/mbd-rerun/`) → **byte-identical
  `validation-results.json`**, identical chain root
  `2a6beaf4be6d3297…`, from the independently regenerated samples file.
- **synthetic baseline stability**: after the additive `runValidationOnSamples`
  seam refactor, `scripts/test-harness.ts` still reproduces the synthetic
  reference root `bd4673596aebfcfb…` @ 451 records (captured in
  `evidence/mbd/gate-a-stability-after-seam.txt`) — the specimen's behavior is
  unchanged; only an external-data entry point was added.

## 5. Deviations from the brief (disclosed)

1. **MBD-mini instead of full MBD** — the full `detail.tar.gz` is 38 GB; the
   work order itself said to limit scope if the full download is heavy.
   MBD-mini is the same authors' official reduced subset with identical schema
   (10% of full MBD's clients; fold=0 alone carries 20,032 clients, of which
   the deterministic first 2,000 were selected).
2. **`proofbridge/adapters/mbd.py` did not exist in this workspace** — the
   work order references it as "already in the codebase", but the surviving
   krypte artifact (the tracked zip) contains only TypeScript. The adapter was
   written fresh this round, implementing the disclosed rule with the proxy
   mapping documented above.
3. **"Flat GBM"** — the harness's flat rung is a logistic model (nested
   feature sets); the harness is the mandated instrument, so the flat number
   reported is the harness's flat rung, labelled as logistic.
4. **"Forward-walk split"** — interpreted as the same deterministic split the
   harness already uses (parity: even-index train, odd holdout over the
   time-ordered stream), which is what "the same split already used on
   synthetic data" requires.
5. **Resource note** — the full-scale run required pausing the VVU dev server
   (4 GB RAM box); both runs executed with the server stopped and it was
   restarted immediately after. No results were affected.
