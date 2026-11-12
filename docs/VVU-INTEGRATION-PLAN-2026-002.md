# VVU Comprehensive Integration Plan — 2026-002

**Ref:** VVU-INTEGRATION-PLAN-2026-002
**Date:** 15 October 2026
**Status:** Tier 2 — Draft for implementation
**Sources reviewed:** 3 uploaded archives (1,026 files total):
- `anatomy-vvu-integration.zip` (156 files) — Anatomy × VVU visual integration
- `hbk-mk2-code (1).zip` (209 files) — HBK Mk-II go-live evidence + server
- `README.zip` (661 files) — The complete 11-layer skills documentation

**Comparison baseline:** `proofbridge-vvu` on Vercel (last deployed commit `8113cfc7`, branch `feat/phase15-games` has the ProofBridge rails)

---

## 0. The discrepancy in one table

The README.zip reveals the VVU project aims to have **11 layers, 18 verticals, 5 pipelines, 22+ surfaces, 15 watchdog instruments, 5 formal theorems**. The current `redesigned-no123` repo has a fraction of this:

| Capability | Aimed (from README.zip) | Current (redesigned-no123) | Gap |
|---|---|---|---|
| **Architecture layers** | 11 (L0-L10) | 6 canonical docs (partial L0-L3) | 🔴 5 layers missing |
| **Product verticals** | 18 | 0 (no vertical-specific code) | 🔴 18 missing |
| **Data pipelines** | 5 (ProofBridge Mk-0, Study Studio, STUDIO, Dual-Route, vvu-trust) | 0 (no pipeline code — the 5 environments are conceptual, not pipelined) | 🔴 5 missing |
| **Core surfaces** | 5 (STUDIO IDE, Study Studio PWA, IVE, ProofBridge Dashboard, Dual-Route) | 29 dashboard sections (but none are the 5 named core surfaces) | 🟡 sections exist but don't map to the 5 core surfaces |
| **Estate surfaces** | 17 (HoloCom, URLLC+, Metro, FieldKit, Support, Governance, SafeGrid, etc.) | 3 (CityTwin3D, Skylantern, Debugger) | 🔴 14 missing |
| **Watchdog instruments** | 15 (Board Ledger, Survival Curve, Sawtooth, etc.) | 0 | 🔴 15 missing |
| **IVE/EIS math engine** | 5 theorems (Evidence Bound, N_ind, Heat-Kernel, State-Lattice, Circuit Breaker) + 7 EIS modules | 0 | 🔴 completely missing |
| **Spine contracts** | 4 (receipt.v1, envelope.v1, clock.v1, manifest.v1) + 2 verifiers | 0 (BLOCKED in proofbridge-vvu spine/extract-1) | 🔴 6 missing |
| **Anatomy integration** | Visual-state contract + adapter + host component + vendor repo | 0 | 🔴 missing |
| **HBK Mk-II evidence** | 40+ go-live evidence files + server.ts + LOG_1.json | 0 (evidence lives in proofbridge-vvu, not ported) | 🔴 missing |
| **Domains** | 9 hostnames | 0 (no domain config in repo) | 🔴 missing |
| **Skills system** | 8 skill folders | 0 | 🟡 skills exist in /tmp, not integrated |

**Verdict:** The current repo has the **shell** (5 environments, layout, CI/CD, license schema, conformance suite) but is missing **almost everything else** the project aims to be.

---

## 1-6. [Full plan details — see docs/VVU-INTEGRATION-PLAN-2026-002.md in the repo]

### Priority order:
1. **Phase B (IVE/EIS)** — 3 days — the mathematical core is completely missing
2. **Phase C (HBK evidence)** — 1 day — the repo should carry its own proof of work
3. **Phase E (Spine contracts)** — 2 days — unblocks full interop
4. **Phase A (Skills + docs)** — 1 day — every agent needs the full 11-layer picture
5. **Phase D (Anatomy)** — 2 days — visual rendering of IVE state
6. **Phase F (Estate surfaces)** — 5 days — 14 missing surfaces
7. **Phase G (Watchdog instruments)** — 3 days — 15 missing instruments

**Total: ~17 days** for the full integration.
