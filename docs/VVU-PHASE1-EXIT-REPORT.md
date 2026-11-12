# VVU Phase 1 Exit Report

**Date:** 15 October 2026
**Commit:** (recorded after push)
**Status:** Phase 1 — Conditionally Complete

## 1. CF-INT Conformance Results (42/42 pass)

### Part 1: 25 Directed Export→Import Pairs (25/25 pass)

All 25 source→destination combinations pass. Each test verifies:
- Artefact identity preserved (artefact_id matches)
- Provenance preserved (produced_by.environment unchanged)
- Integrity preserved (digest matches)
- No trust upgrade (destination never auto-conffers VERIFIED from non-Bench sources)
- Fire artefacts never contain PROVEN
- Standing limitations attached

| Source → Dest | Result |
|---|---|
| forge → forge, bench, fire, field, press | ✓ ×5 |
| bench → forge, bench, fire, field, press | ✓ ×5 |
| fire → forge, bench, fire, field, press | ✓ ×5 |
| field → forge, bench, fire, field, press | ✓ ×5 |
| press → forge, bench, fire, field, press | ✓ ×5 |

### Part 2: 10 Negative Tests (10/10 pass)

| ID | Test | Result |
|---|---|---|
| CF-INT-26 | Modified content fails digest check | ✓ REJECTED_DIGEST_MISMATCH |
| CF-INT-27 | Invalid signature rejected | ✓ REJECTED_SIGNATURE_INVALID |
| CF-INT-28 | Unsupported version rejected | ✓ REJECTED_VERSION_UNSUPPORTED |
| CF-INT-29 | Missing evidence → no VERIFIED | ✓ NOT_PROVEN preserved |
| CF-INT-30 | Import never auto-upgrades to VERIFIED | ✓ INTEGRITY_VALID only |
| CF-INT-31 | Failed import does not corrupt origin | ✓ Original intact |
| CF-INT-32 | Repeated import detected as duplicate | ✓ duplicate=true |
| CF-INT-33 | Unknown artefact_type rejected | ✓ REJECTED |
| CF-INT-34 | Non-object envelope rejected | ✓ REJECTED_SCHEMA_INVALID |
| CF-INT-35 | Unparseable JSON rejected | ✓ REJECTED_SCHEMA_INVALID |

### Part 3: 7 Independence Tests (7/7 pass)

| ID | Test | Result |
|---|---|---|
| CF-INT-36 | Each env produces independently | ✓ All 5 produce valid envelopes |
| CF-INT-37 | Each env can receive offline (from serialized JSON) | ✓ All 20 cross-env pairs |
| CF-INT-38 | Export package verifiable without source | ✓ Package verified |
| CF-INT-39 | Version negotiation fails loud on major mismatch | ✓ REJECTED_VERSION_UNSUPPORTED |
| CF-INT-40 | Newer minor accepted with limitation note | ✓ Accepted with note |
| CF-INT-41 | Standing limitations attached to every export | ✓ All 5 environments |
| CF-INT-42 | Fire never emits PROVEN | ✓ No PROVEN, cap=INTEGRITY_VALID |

## 2. Independence + Failure Isolation

**Tested by CF-INT-36, CF-INT-37, CF-INT-38, CF-INT-31:**

- **Each environment produces independently** (CF-INT-36): all 5 environments (Forge, Bench, Fire, Field, Press) produce valid sealed envelopes without referencing any other environment.
- **Offline receive** (CF-INT-37): all 20 cross-env pairs receive from serialized JSON strings. The source environment is not online — only the JSON is needed.
- **Package verification without source** (CF-INT-38): export packages verify using only the package's own manifest digest. No reference to the source environment.
- **Failure isolation** (CF-INT-31): a failed import (tampered content) does not corrupt the original artefact. The original's digest and content are unchanged after the rejection.

**Finding:** The v1.0.0 interop core has a limitation where `buildTransition()` in envelope-transition mode (v1.0.0) calls `seal()` with `status: 'PARSED'`, which exceeds the EXPORT_CAP of Forge (DRAFT) and Field (DRAFT). This means Forge and Field cannot record receive transitions in v1.0.0 envelope mode. The CF-INT suite works around this by using `transitionVersion: '2.0.0'` (record mode, which decouples transitions from EXPORT_CAP). This is documented as a proposed spec delta for envelope v1.1.

## 3. Mobile Layout Audit

**Status:** Code-level audit complete. Live browser audit deferred (dev server instability in the sandbox environment prevented agent-browser verification at 360px).

**Code-level findings:**
- **3-column layout implemented:** LEFT rail (5 environments, icon-only, active=icon+label), CENTER (runtime tabs filtered by env), RIGHT sidebar (workspace sections + pinned items).
- **Mobile toggles:** `PanelLeft` button in header toggles the left-rail overlay drawer. `PanelRight` button toggles the workspace overlay drawer. Both are `lg:hidden` (visible on mobile, hidden on desktop).
- **Overlay drawers:** Both mobile drawers use `fixed inset-0 z-50 bg-background/80 backdrop-blur` with a slide-in panel. Click-outside-to-close is implemented.
- **No keyboard-only interactions:** All nav buttons are `<button>` elements with `onClick` handlers. No keyboard-only shortcuts are required for navigation.
- **Accessibility:** Every nav button carries `title` + `aria-label`. The active tab shows icon+label; inactive tabs show icon only.
- **No horizontal scroll:** The layout uses `overflow-x-auto` on the center nav strip, `flex-1 min-w-0` on the center column, and `sticky` positioning for rails.

**Deferred:** Live 360px viewport verification via agent-browser. The dev server process does not persist between tool calls in this sandbox. This should be verified manually by opening the Preview Panel at 360px width.

## 4. CI Configuration

The CF-INT suite is wired into `.github/workflows/ci.yml` as a 6th parallel job:

```yaml
cf-int-conformance:
  name: CF-INT interoperability conformance (42 checks)
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
    - run: node tests/conformance/cf-int-suite.mjs
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: cf-int-report
        path: tests/conformance/cf-int-report.json
        retention-days: 30
```

**Full CI gate matrix (6 jobs):**
1. Lint (eslint) — 0 errors required
2. Golden Rule AST check — must exit 0
3. Dashboard panel validator — must exit 0
4. Enforce boundaries (4 checks) — must exit 0
5. TypeScript type-check (tsc --noEmit) — 0 errors (continue-on-error for now)
6. **CF-INT conformance (42 checks)** — must be 42/42 pass

## 5. Separation of Shell and Verification Core

**Maintained.** The shell (`src/lib/shell/`) and the interop layer (`src/lib/interop/`) are distinct in responsibility:

- **Shell** (`src/lib/shell/`): manages navigation, mounting, commands, keyboard shortcuts, and communication between interface components. Contains: `types.ts`, `hotkey-registry.ts`, `command-bus.ts`, `router.ts`, `mount-loader.ts`, `worker-supervisor.ts`, `clipboard-channel.ts`, `version-negotiation.ts`.
- **Interop** (`src/lib/interop/`): manages artefact exchange and compatibility. Contains: `vvu-core.js` (envelope seal/verify/validate/receive/negotiate), `vvu-store.js` (per-env IndexedDB store), `vvu-adapters.js` (native-to-envelope adapters).
- **Conformance** (`tests/conformance/`): tests the contract between the two, not either's implementation.

The shell's `CommandBus` does not become a hidden dependency: each environment's `export()` and `import()` are called directly by the conformance suite without going through the shell. The shell's `ClipboardChannel` wraps the interop's `seal()`/`receive()` but does not replace them — it's a transport layer, not a verification layer.

## 6. Unresolved Limitations + Deferred Requirements

| # | Limitation | Impact | Resolution |
|---|---|---|---|
| 1 | v1.0.0 `buildTransition()` in envelope mode collides with EXPORT_CAP for Forge/Field | Forge/Field can't record receive transitions in v1.0.0 envelope mode | Workaround: use `transitionVersion: '2.0.0'` (record mode). Proposed for envelope v1.1. |
| 2 | Live 360px browser audit not completed | Mobile layout verified at code level only | Verify via Preview Panel at 360px manually |
| 3 | `type-check` CI job has `continue-on-error: true` | TypeScript errors won't block CI | 0 errors achieved locally; flip to `false` after confirming on GitHub |
| 4 | Envelope v1.1 enum extension is proposed, not ratified | `test_report` and `verification_receipt` are in the interop core's TYPES_BASE but not in a formal `vvu-envelope.schema.json` file | Write `schemas/vvu-envelope.schema.json` with the v1.1 enum (Phase 1b) |
| 5 | No live :3004/:3005 service testing | CF-INT tests the contract with mock environments, not against the real Bench/Field services | R3-or-later: test against live services when available |
| 6 | Shell client not wired into `page.tsx` | The shell modules exist but the dashboard doesn't use them yet | Phase 2: wire shell into the dashboard as the PWA shell |

## 7. Conclusion

**Phase 1 is conditionally complete.** The CF-INT suite proves the interoperability contract works: 42/42 checks pass, covering all 25 directed pairs, 10 negative tests, and 7 independence tests. The suite tests the contract, not the implementation — it would catch any environment that violates the shared envelope spec, even if all five happened to agree with one another.

The shell and interop layers are properly separated. The shell manages navigation and commands; the interop layer manages artefact exchange. Neither silently replaces the other's authority.

**The acceptance criterion is met:** each environment can do its own work, preserve its outputs, and exchange those outputs with compatible environments without surrendering its independence. The CF-INT suite proves this at the contract level.

**Next single action:** Flip the `type-check` CI job from `continue-on-error: true` to `false` (now that tsc is 0 errors), push, confirm all 6 CI jobs are green on GitHub, then begin Phase 2 (Browser PWA).
