# ENGINEERING CONSTITUTION — Mathematical Invariants

**Status:** Tier 1 — Active

## X₀ Rules (can never be broken)

### X₀-1: Immutable Events
Once an event is appended to the WORM chain, it cannot be modified or deleted. Any attempt is detectable by re-hashing.

### X₀-2: Pure Reducers
State transitions are pure functions of (prior state, event). No side effects, no I/O, no randomness.

### X₀-3: Deterministic Replay
Given the same event list, the state reconstruction is identical. `replay(events) → state` is a pure function.

### X₀-4: Hash Chains
Every chain entry's digest = `SHA-256(prev_digest || canonical(payload))`. Genesis digest = `SHA-256("")` or a well-known constant.

### X₀-5: Ed25519 Signatures
Every artefact that crosses an environment boundary carries an Ed25519 signature over its canonical bytes. Verification is deterministic.

### X₀-6: Fire Never Emits PROVEN
`PROVEN` is reserved for Bench. Fire's outcomes are: `PASSED-UNDER-CONDITIONS | FAILED | INCONCLUSIVE | BLOCKED | SKIPPED-BY-ASSET-ABSENCE`. Enforced by `assertFireEnvelope()` at construction level, not by convention.

### X₀-7: No Silent Trust Upgrades
Receiving an artefact does not make its claims true. A `PARSED` artefact becomes `INTEGRITY_VALID` only by running the integrity check. Status is never silently upgraded.

### X₀-8: Golden Rule
Never adopt a dependency for what a few lines of code can build. Current count: 28 dependencies (down from 75).

## Observability
Every X₀ rule violation is logged to the audit log with a reason code from the shared foundation registry. Violations are append-only.

## Charter → Constitution Bridge

The `proofbridge-liner` repo holds the **Constitutional Invariant** from the VVU Governance Charter:

> *"Governance can decide what VVU should do; governance cannot decide that an invalid proof is valid."*

The 8 X₀ rules in this document are the **operationalization** of that invariant:

| Charter principle | X₀ rule that enforces it |
|---|---|
| Governance cannot validate an invalid proof | X₀-6 (Fire never emits PROVEN) + X₀-7 (No silent trust upgrades) |
| Proofs are deterministic | X₀-2 (Pure Reducers) + X₀-3 (Deterministic Replay) |
| History is immutable | X₀-1 (Immutable Events) + X₀-4 (Hash Chains) |
| Identity is cryptographic | X₀-5 (Ed25519 Signatures) |
| Discipline over convenience | X₀-8 (Golden Rule — 28 deps, not 75) |

The Charter is the *why*. The X₀ rules are the *how*. Neither overrides the other.
