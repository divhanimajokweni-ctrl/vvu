# VVU Shell Contract — 2026-001

**Ref:** VVU-SHELL-2026-001
**Date:** 15 October 2026
**Status:** Tier 2 — Draft for implementation (Phase 1)
**Depends on:** VVU-ENV-BLUEPRINT-2026-001, VVU-BENCH-2026-001, VVU-SF-2026-001

## §1 MOUNT

An environment registers with the roof via a manifest.

```json
{
  "id": "forge",
  "version": "1.0.0",
  "entry": "/forge/index.html",
  "scope": ["create", "draft", "model"],
  "artefact_types": ["claim", "model", "learning_submission", "experimental_record"],
  "stores": ["forge.working", "forge.drafts"],
  "worker": { "src": "/forge/worker.js", "kind": "module" }
}
```

**Rules:**
- `id` is one of: `forge | bench | fire | field | press`. Fixed set.
- `version` is semver. Mismatch at mount → `REJECTED_VERSION_UNSUPPORTED`.
- `entry` is a URL/path to the environment's entry point.
- `scope[]` declares what the environment handles.
- `artefact_types[]` is a subset of the envelope v1.1 enum (append-only).
- `stores[]` are store names the environment owns. The roof never touches them.
- `worker.src` is same-origin. Cross-origin workers are rejected.

## §2 COMMAND BUS

Shell → environment commands. Envelope-shaped.

```json
{
  "kind": "ui.command",
  "command": "SWITCH",
  "target": "fire",
  "payload": {},
  "timestamp": "2026-10-15T..."
}
```

**Commands:** `UNIFY | SPLIT | PIN | SWITCH | TOGGLE | WORKSPACE | EXPORT | IMPORT | FOCUS`

**Rules:**
- Commands are dispatched by the shell's CommandBus to the target environment's handler.
- Environments subscribe via `commandBus.subscribe(envId, handler)`.
- Unknown commands are logged and dropped (never silently coerced).
- The command log is bounded (last 100 entries) for debugging.

## §3 HOTKEY REGISTRY

Single capture-phase `keydown` listener in the shell. Table of binding → command → scope.

| Combo | Command | Scope |
|---|---|---|
| Ctrl+Alt+1 | FOCUS | forge |
| Ctrl+Alt+2 | FOCUS | bench |
| Ctrl+Alt+3 | FOCUS | fire |
| Ctrl+Alt+4 | FOCUS | field |
| Ctrl+Alt+5 | FOCUS | press |
| Ctrl+Alt+U | UNIFY | global |
| Ctrl+Alt+S | SPLIT | global |
| Ctrl+Alt+P | PIN | global |
| Ctrl+Alt+W | WORKSPACE | global |
| Ctrl+Alt+C | EXPORT | global (clipboard copy) |
| Ctrl+Alt+V | IMPORT | global (clipboard paste) |
| Ctrl+Alt+X | EXPORT | global (clipboard cut) |
| Ctrl+K | TOGGLE | global (palette) |

**Rules:**
- NO Fn-chords (Fn is invisible to the OS/browser).
- Remappable via `hotkeyRegistry.remap(oldCombo, newCombo)`.
- Palette (Ctrl+K) is the always-available fallback.
- Single listener, capture phase, prevents default on match.

## §4 CLIPBOARD CHANNEL

Async Clipboard API, gated behind user gesture. Payload is an envelope, not raw text.

```typescript
clipboard.copy(envelope: Envelope): Promise<void>
clipboard.paste(): Promise<ImportResult>
```

**Rules:**
- Never writes raw text — always `application/json` with envelope shape.
- `paste()` validates the envelope before returning. Invalid → `ImportResult` with reason code.
- Falls back to textarea-based copy/paste if Clipboard API is unavailable.
- The envelope's `integrity.digest` is re-verified on paste (detects clipboard tampering).

## §5 WORKER MODEL

One worker per environment. Same-origin. `postMessage` with typed schema.

```typescript
workerSupervisor.spawn(envId, workerSrc): WorkerHandle
workerSupervisor.postMessage(envId, message: WorkerInbound): void
workerSupervisor.terminate(envId): void
```

**Rules:**
- Same-origin only. Origin allowlist enforced.
- `WorkerInbound` and `WorkerOutbound` are typed (derived from `vvu-envelope.schema.json`).
- Worker errors are caught + reported to the shell. The environment is notified.
- Falls back gracefully if Workers are unavailable (SSR, legacy browsers).

## §6 IMPORT/EXPORT PORT

Every environment exposes `export()` and `import(env)`.

```typescript
export(): Envelope
import(env: Envelope): ImportResult
```

**Rules:**
- `import()` MUST reject non-conforming envelopes with a reason code from the shared foundation registry.
- Never silently coerces. Never upgrades status.
- Reason codes: `REJECTED_DIGEST_MISMATCH`, `REJECTED_SIGNATURE_INVALID`, `REJECTED_VERSION_UNSUPPORTED`, `REJECTED_UNKNOWN_ARTEFACT_TYPE`, `REJECTED_POLICY_UNRESOLVED`, `REJECTED_POLICY_STATUS`, `REJECTED_MISSING_REQUIRED_FIELD`.
- `export()` MUST attach the environment's standing limitations.

## §7 VERSION NEGOTIATION

`envelope_version` handshake at mount. Mismatch fails loud.

```typescript
negotiate(incoming: string, supported: string[]): { ok: boolean; reason?: string }
```

**Rules:**
- Exact match → ok.
- Newer minor within same major → ok with limitation note.
- Newer major → reject. Do not guess.
- Unknown → reject.

## §8 STANDING LIMITATIONS

Each environment attaches its own `limitations[]` to every envelope it emits.

```typescript
const STANDING_LIMITATIONS: Record<EnvironmentId, string[]> = {
  forge: ['Forge produces drafts; verification is Bench\'s job.'],
  bench: ['Bench verifies against a policy; it does not observe the physical world.'],
  fire: ['Fire does not emit PROVEN.', 'PASSED-UNDER-CONDITIONS is not a safety claim.'],
  field: ['Field records observations; interpretation is Bench\'s job.'],
  press: ['Press communicates; it does not verify or challenge.'],
};
```

## Envelope v1.1 Enum Extension (proposed spec delta)

The Forge §4 enum lists 7 Forge-produced `artefact_type` values and 4 `source_surface` values. Fire's `test_report` and Bench's `verification_receipt` are **not** in that enum. This contract proposes envelope v1.1 with a cross-environment enum (append-only, never renumbered):

**`artefact_type` (v1.1):**
`claim | model | learning_submission | experimental_record | observation | verification_receipt | test_report | counterexample | publication | policy | fire_estate_export`

**`source_surface` (v1.1):**
`forge | bench | fire | field | press`

**Rule:** registry entries are append-only. New types require a new envelope minor version. Never renumber.

## Failure Code Registry (append-only)

| Code | Meaning |
|---|---|
| `REJECTED_VERSION_UNSUPPORTED` | Envelope version not in supported set |
| `REJECTED_POLICY_UNRESOLVED` | Policy ID could not be located locally |
| `REJECTED_POLICY_VERSION_UNSUPPORTED` | Policy version not supported |
| `REJECTED_POLICY_STATUS` | Policy is DRAFT or REVOKED |
| `REJECTED_POLICY_MALFORMED` | Policy document failed schema validation |
| `REJECTED_POLICY_OUTCOME_TOTALITY` | Outcome rules don't cover all combinations |
| `REJECTED_POLICY_CHECK_MISSING` | A required check did not appear in the receipt |
| `REJECTED_POLICY_IMMUTABILITY` | A policy used in a VERIFIED receipt has changed |
| `REJECTED_DIGEST_MISMATCH` | Envelope digest does not recompute |
| `REJECTED_SIGNATURE_INVALID` | Ed25519 signature verification failed |
| `REJECTED_CHAIN_BROKEN` | WORM chain integrity check failed |
| `REJECTED_UNKNOWN_ARTEFACT_TYPE` | artefact_type not in the v1.1 enum |
| `REJECTED_MISSING_REQUIRED_FIELD` | Envelope missing a required field |
