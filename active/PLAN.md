# Active Plan — Fire Adversarial Environment (Tier-2)

**Status:** Ready for Mino Review (human gate)
**Trace:** VVU-IMPLEMENTATION-PLAN-2026-001 §5.1 · VVU-SHELL-INTEROP-PLAN-2026-001 §Phase-1
**Branch:** `feature/fire-adversarial-environment` (Tier-2 — specified, awaiting implementation)
**Token Budget:** ~8 turns
**Date:** 15 October 2026

---

## 1. Business Intent

The VVU mission is trusted-decision infrastructure: five independently operable environments (Forge/Bench/Fire/Field/Press) that interoperate through a shared envelope. Fire is the adversarial testing environment — its job is to challenge claims, models, and pipelines under hostile conditions.

**Fire is currently the weakest environment.** The uploaded `FIRE.html` (1,583 lines) has:
- A working WORM chain tamper matrix (9 cases)
- A working governance test suite (N1–N9)
- Fire-R1 (envelope) + Fire-R2 (pre-registration chain) patches applied
- 2 pre-existing self-test failures (DELIBERATE FAILURE + Counterexample reproducible) due to a logic mismatch between TAMPER-MODIFIED and vulnerable-v0.9

The interop bundle (uploaded `files1.zip` → `vvu-interop/`) adds:
- 5 mounted environment builds (`dist/{forge,bench,fire,field,press}/`)
- Interop core (`core/vvu-core.js` — 569 lines, JCS + SHA-256 + Ed25519 + envelope + receive pipeline)
- Mount adapter + dock + worker + service worker
- Gap register identifying 12 defects (E-01 through E-12) + 10 spec defects (D-INT-01 through D-INT-10)
- Conformance suite (24 tests in `tests/run-conformance.js`)

**This plan integrates the interop bundle into `redesigned-no123` and fixes the 2 pre-existing Fire self-test failures.**

## 2. User Story

**As the founder**, I need Fire to be a genuine adversarial testing environment that:
1. Runs the 9-case tamper matrix + N1–N9 governance tests + 12 QR bridge tests
2. Emits conformant envelopes (not the non-conformant native exports from E-08)
3. Never emits PROVEN (X₀-6, enforced by `assertFireEnvelope()`)
4. Mounts under the shell as an independent PWA at `/fire/`
5. Imports envelopes from Forge/Bench/Field/Press and challenges them
6. Preserves counterexamples for regression

**So that** Fire can independently challenge any artefact without requiring the other four environments to be available, and its test reports are consumable by Bench and Press through the shared envelope.

## 3. Acceptance Criteria (behavioral & testable)

| # | Criterion | Verification |
|---|---|---|
| AC-1 | Fire's self-test suite passes ALL tests (0 failures, was 2) | Run self-test in browser; verify "all N passed" |
| AC-2 | Fire emits conformant envelopes (artefact_id is RFC 9562 v4 UUID, signature over raw digest bytes, no `integrity.anchor`) | CF-INT-11..15 pass (Fire → all 5 envs) |
| AC-3 | Fire never emits PROVEN | `assertFireEnvelope()` rejects PROVEN content by construction; CF-INT-42 passes |
| AC-4 | Fire mounts as standalone PWA at `/fire/` with own manifest + SW + icons | `dist/fire/` exists with `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` |
| AC-5 | Fire imports envelopes from all 4 other environments | CF-INT-11,13,14,15 (Forge→Fire, Bench→Fire, Field→Fire, Press→Fire) pass |
| AC-6 | Fire preserves counterexamples for regression | Counterexample store survives page reload (localStorage persistence) |
| AC-7 | Fire's pre-registration chain (F9/F10/F11) refuses cases without threat model + scope + authorisation | CF-INT-29 style negative test: case without threat → BLOCKED with reasons |

## 4. Affected Files (exact paths & nature of changes)

| Path | Nature of change |
|---|---|
| `fire/FIRE.html` | **Fix** the 2 pre-existing self-test failures: TAMPER-MODIFIED vs vulnerable-v0.9 logic mismatch. The `vulnerable-v0.9` build skips `PREV_LINKAGE` but still checks `PAYLOAD_HASH`. TAMPER-MODIFIED edits the payload, so it IS detected → `PASSED-UNDER-CONDITIONS` not `FAILED`. Fix: either (a) change the test expectation to `PASSED-UNDER-CONDITIONS`, or (b) add a `TAMPER-PREV-HASH` case that vulnerable-v0.9 should miss. Option (b) is better — it tests the actual vulnerability. |
| `src/lib/interop/` | **Add** the interop bundle files: `vvu-core.js`, `vvu-store.js`, `vvu-adapters.js` (already placed from earlier upload). Verify they match the `files1.zip` versions (the earlier upload may be stale). |
| `public/fire/` | **Add** mounted Fire PWA build: `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `vvu-core.js`, `vvu-worker.js` from `dist/fire/` in the interop bundle. |
| `docs/VVU-MOUNT-2026-001.md` | **Add** the mount contract spec (from `files1.zip`). |
| `docs/GAP-REGISTER-INTEROP.md` | **Add** the gap register (from `files1.zip`). |
| `schemas/` | **Add** corrected envelope schemas: `vvu-envelope.1.0.0.corrected.schema.json`, `vvu-envelope.2.0.0.proposed.schema.json`, `vvu-export-package.schema.json` (from `files1.zip`). |
| `tests/conformance/cf-int-suite.mjs` | **Verify** the existing 42/42 suite still passes after integration. The interop bundle has its own `tests/run-conformance.js` (24 tests) — reconcile the two. |
| `fire/conformance/` | **Add** Fire-specific conformance: `cf-pol-01..08.test.ts` (the 8 policy conformance cases from VVU-BENCH-2026-001 §10). |

## 5. Test Assertions (concrete function→outcome pairs)

| ID | Function → Outcome |
|---|---|
| TA-1 | `runCase('vulnerable-v0.9', TAMPER_MODIFIED, 'self-test-seed')` → `outcome === 'PASSED-UNDER-CONDITIONS'` (not FAILED — the build detects payload edits) |
| TA-2 | `runCase('vulnerable-v0.9', TAMPER_PREV_HASH, 'self-test-seed')` → `outcome === 'FAILED'` (the build SKIPS prev_hash linkage, so it MISSES this tamper — this is the actual vulnerability) |
| TA-3 | `assertFireEnvelope(buildEnvelope('test_report', {note:'PROVEN safe'}, {}))` → throws `Error('Fire envelope content may not contain PROVEN')` |
| TA-4 | `authoriseCase('honest-v1', TAMPER_MODIFIED, null)` → `{ok: false, reasons: [{gap:'F11', detail:'no active authorisation'}]}` |
| TA-5 | `receive(produce('forge'), receiveCtx('fire'))` → `finalStatus === 'INTEGRITY_VALID'` (never VERIFIED — Fire can't auto-confer trust) |
| TA-6 | `produce('fire').limitations` → includes `'Fire does not emit PROVEN'` |
| TA-7 | Fire self-test suite → "all N passed" (0 failures, was 2) |

## 6. Compliance Gate

| Rule | Evidence |
|---|---|
| **HF-3** (Zero Fabrication — nothing presented as operational unless it is) | Fire's self-test includes a deliberate-failure case that MUST report FAILED + preserve a counterexample. If the self-test passes, it proves Fire reports failures honestly. The 2 pre-existing failures are honestly reported, not hidden. |
| **HF-4** (Voice Law — no banned words: unassailable, fully operational, production-ready, certified) | Fire's `voiceLawScan()` checks all generated report text. `BANNED = ['unassailable','fully operational','production-ready','certified']`. Self-test verifies 0 hits. |
| **X₀-6** (Fire never emits PROVEN) | `assertFireEnvelope()` enforces this at construction level. CF-INT-42 passes. |
| **X₀-7** (No silent trust upgrades) | Fire's `receive()` pipeline never assigns VERIFIED. CF-INT-30 passes. |
| **Golden Rule** (X₀-8) | The interop bundle is zero-dependency pure JS. No new deps added. |

## 7. Branch

`feature/fire-adversarial-environment` (Tier-2 — specified, awaiting implementation)

**Branch policy** (per AGENTS.md): create from `main`, push, open PR to `main`. CI must pass before merge.

## 8. Token Budget

~8 turns estimated:
1. Place interop bundle files in the repo (1 turn)
2. Fix the 2 pre-existing Fire self-test failures (1 turn)
3. Add mounted Fire PWA build to `public/fire/` (1 turn)
4. Add docs (mount contract + gap register) (1 turn)
5. Add schemas (1 turn)
6. Reconcile conformance suites (existing 42/42 + bundle's 24) (1 turn)
7. Run all CI gates + CF-INT (1 turn)
8. Push + open PR (1 turn)

## 9. Next Single Action (post-approval)

Create branch `feature/fire-adversarial-environment` from `main`, place the interop bundle, fix the 2 Fire self-test failures, run CI, push, open PR.

---

## Mino Review Checklist

1. ✅ Business Intent connects to VVU mission (Fire is the adversarial environment — X₀-6)
2. ✅ User Story matches investigation findings (gap register E-01..E-12 + 2 pre-existing failures)
3. ✅ Acceptance Criteria are behavioral & testable (7 criteria, each with verification method)
4. ✅ Affected Files specify exact paths & nature of changes (8 paths, each with change type)
5. ✅ Test Assertions are concrete function→outcome pairs (7 assertions)
6. ✅ Compliance Gate addresses HF-3, HF-4 with evidence (Zero Fabrication + Voice Law + X₀-6/X₀-7)
7. ✅ Branch is correct: `feature/fire-adversarial-environment` (Tier-2)
8. ✅ Token Budget is estimated (~8 turns)

---

## Mino Signature

**Approved by:** Divhani Majokweni (Mino) — 2026-10-15
**Approval token:** "bunx @sesori/bridge sesori-bridge Approved"

## Implementation Status

**Branch:** `feature/fire-adversarial-environment`
**Commit:** `33874a52`
**Pushed to:** `origin/feature/fire-adversarial-environment`

### Completed (turns 1-6 of ~8):
- ✅ Turn 1-5: Interop bundle placed (30 files: core, mount, schemas, declarations, docs, tests, tools, Fire PWA build)
- ✅ Turn 2: Fixed 2 pre-existing Fire self-test failures (TAMPER-MODIFIED → TAMPER-WRONG-PREV)
- ✅ Turn 6: Conformance suites reconciled (CF-INT 42/42 + interop bundle's 24 tests coexist)
- ✅ CI gates: lint 0 errors, tsc 0 errors, CF-INT 42/42, boundaries all pass

### PR link:
https://github.com/divhanimajokweni-ctrl/redesigned-no123/pull/new/feature/fire-adversarial-environment
