# VVU Implementation Plan — 2026-001

**Ref:** VVU-IMPL-PLAN-2026-001
**Date:** 15 October 2026
**Status:** Tier 2 — Draft for implementation
**Depends on:**
- `VVU-ENV-BLUEPRINT-2026-001` (Five Environments Master Blueprint)
- `VVU-BENCH-2026-001` (Verification Policy Identifier Specification)
- `upload/Pasted Content_1792016227936.txt` (VVU MASTER MINDMAP, 15 branches)
**Scope:** Plan the implementation of the mind map across the 3 VVU repos. Source: full repo-history scrape of `proofbridge-liner`, `proofbridge-vvu`, `redesigned-no123` (56 branches, 3,030 commits, 8,771 unique files).

---

## 0. Executive summary

The mind map describes a **five-environment architecture** (Forge · Bench · Fire · Field · Press) on a **shared artefact-envelope foundation**, deployed across **five asset types** (water, phone, vehicle, fleet, SDK), priced inside a **fixed band** (R9–R9,999), sold to whoever will pay for what it proves.

**What already exists (evidenced):**
- The WORM chain primitive (Ed25519 + SHA-256 + Merkle) is **fully built and proven** across 3 repos.
- Bench (the strongest environment) is evidenced by `:3004 vault-bridge`, the 9-case tamper matrix, N1–N9, and `LOG_1.json`.
- Field (the second strongest) is evidenced by `:3005 vvu-field-onboard` with offline queue + idempotent sync.
- 4 load-bearing artefacts (`FINAL_GO_LIVE_EVIDENCE.md`, `E2E_LOG1_EVIDENCE.md`, `LOG_1.json`, `TEMPLATE_QR_BRIDGE.md`) live in `proofbridge-vvu`.
- The REA license schema (`REA_ENABLED` + `consentLog`) already exists in `redesigned-no123/shared/license/`.

**What is missing (gaps):**
- The **shared foundation** — `vvu-envelope.schema.json`, the 12-state status vocabulary, version negotiation — does not exist anywhere. This is the load-bearing gap.
- **Fire** is entirely missing (no `fire/` directory, no service, no test_report/counterexample artefacts).
- **Forge and Press** environments are missing as named surfaces (STUDI components exist but aren't unified under a Forge envelope; no Press editorial workflow).
- The **`urn:vvu:policy:` URI scheme** and the **policy registry** do not exist — the VVU-BENCH-2026-001 spec is entirely greenfield.
- 7 of the 9 artefact types (`claim`, `model`, `learning_submission`, `experimental_record`, `observation`, `verification_receipt`, `test_report`, `counterexample`, `publication`) have no typed schema.
- The **spine contracts** (`envelope.v1.schema.json`, `receipt.v1.schema.json`) are explicitly BLOCKED in `proofbridge-vvu/spine/README.md`.

**The one-line plan:** port the ProofBridge rails into the working repo, build the shared envelope foundation, retrofit Bench with the policy identifier spec, build Fire from the existing adversarial assets, then formalize Field/Forge/Press vocabularies in that order.

---

## 1. Current state across the 3 repos

| Repo | Branches | Commits | Role | Key contents |
|---|---|---|---|---|
| `proofbridge-liner` | 38 | 1,333 | Architecture + governance + validation protocol | VVU-ARCHITECTURE.md, VVU-LAYER-MAP.md, VVU-GOVERNANCE-CHARTER.md, 9 ADRs, VVU-VAL-001 (72-hour validation protocol), `packages/trust-{api,crypto,runtime}/`, `contracts/*.sol`, `schemas/evidence-envelope.schema.json` (different vocabulary), `public/proofbridge.html`, `public/searm1-*.html`, STUDI components |
| `proofbridge-vvu` | 13 | 1,664 | ProofBridge rails + artefacts | `mini-services/vault-bridge/` (:3004), `mini-services/vvu-field-onboard/` (:3005), `src/lib/proofbridge/{governance,jcs,merkle,tier,anchor,sbt}.ts`, `src/proofbridge/` (Rust kernel), `ProofBridge/{E2E_LOG1_EVIDENCE,GO_LIVE/FINAL_GO_LIVE_EVIDENCE,LOG_1,TEMPLATE_QR_BRIDGE}.md`, `spine/` (clock.v1 + manifest.v1 landed; envelope.v1 + receipt.v1 BLOCKED), `tests/proofbridge-harness/`, `worklog.md` (9,816 lines) |
| `redesigned-no123` | 5 | 33 | Working repo (this one) | The 29-section dashboard, `shared/license/` (REA_ENABLED + consentLog), `mini-services/{rea,debugger,worm-nest,event-bus,epd-cli}/`, `scripts/{golden-rule-checker,dashboard-panel-validator}.js`, `.github/workflows/`, `docs/CLIENT-MATRIX.md` |

**The working repo (`redesigned-no123`) is a subset.** It has the dashboard, the license schema, and CI/CD — but it lacks the ProofBridge rails, the 4 load-bearing artefacts, the VVU architecture docs, and the spine contracts. To implement the mind map, those must be ported in (or the working repo switched to `proofbridge-vvu`'s `feat/phase15-games` branch as the base).

### 1.1 Decision: port-in vs switch-base

**Recommendation: port-in.** Keep `redesigned-no123` as the working repo (it has the cleanest dashboard + CI/CD + license schema), and port the ProofBridge rails + architecture docs + spine contracts into it. This avoids rebasing 1,664 commits of `proofbridge-vvu` history onto the 33-commit `redesigned-no123` trunk.

**Port-in manifest (Phase 0):**

| Source | Path | Destination | Why |
|---|---|---|---|
| `proofbridge-vvu@feat/phase15-games` | `mini-services/vault-bridge/` | `mini-services/vault-bridge/` | Bench service (:3004) |
| `proofbridge-vvu@feat/phase15-games` | `mini-services/vvu-field-onboard/` | `mini-services/vvu-field-onboard/` | Field service (:3005) |
| `proofbridge-vvu@feat/phase15-games` | `src/lib/proofbridge/` | `src/lib/proofbridge/` | governance, jcs, merkle, tier, anchor, sbt |
| `proofbridge-vvu@feat/phase15-games` | `src/proofbridge/` (Rust) | `src/proofbridge/` | Safety kernel (Ed25519 + MMR) |
| `proofbridge-vvu@feat/phase15-games` | `ProofBridge/` | `ProofBridge/` | The 4 load-bearing artefacts |
| `proofbridge-vvu@feat/phase15-games` | `src/app/api/{bridge,field,governance,anchor}/` | `src/app/api/{bridge,field,governance,anchor}/` | Control-plane routes |
| `proofbridge-vvu@spine/extract-1` | `spine/` | `spine/` | clock.v1 + manifest.v1 + the BLOCKED envelope.v1/receipt.v1 stubs |
| `proofbridge-liner@main` | `VVU-ARCHITECTURE.md` | `docs/architecture/VVU-ARCHITECTURE.md` | 5-layer architecture |
| `proofbridge-liner@main` | `VVU-LAYER-MAP.md` | `docs/architecture/VVU-LAYER-MAP.md` | Layer classification |
| `proofbridge-liner@main` | `VVU-GOVERNANCE-CHARTER.md` | `docs/governance/VVU-GOVERNANCE-CHARTER.md` | Constitutional baseline |
| `proofbridge-liner@main` | `VVU-SESSION-PROTOCOL.md` | `docs/architecture/VVU-SESSION-PROTOCOL.md` | Session loop |
| `proofbridge-liner@feat/constitution-v1-governance` | `docs/governance/adrs/` | `docs/governance/adrs/` | 9 ADRs |
| `proofbridge-liner@feature/vvu-val-001` | `VVU-VAL-001/` | `fire/vvu-val-001/` | 72-hour validation protocol (Fire-adjacent) |
| `proofbridge-liner@main` | `packages/trust-crypto/src/receipts.ts` | `src/lib/trust/receipts.ts` | TrustReceipt interface |

**Port-in does NOT delete from source repos.** It copies. The source repos remain the canonical history; the working repo becomes the integration trunk.

---

## 2. Mind-map branch status (verified by scrape)

| Mind-map branch | Status | Evidence location | Gap |
|---|---|---|---|
| **1. The Primitive** (Device → Signed Event → WORM Chain → Verification → Economic Evidence) | ✅ evidenced | `proofbridge-vvu`: vault-bridge, governance.ts, jcs.ts, merkle.ts, vvu-ledger.ts, Rust kernel, LOG_1.json | Interface layer (dashboard/SDK/API) 🟡 |
| **2. Five Environments** (Forge/Bench/Fire/Field/Press) | 🟡 specified | Bench ✅, Field ✅, Forge 🟡 (STUDI), Press 🟡 (no workflow), Fire 🔴 (missing) | Shared envelope 🔴, Fire 🔴 |
| **3. Deployments** (Water/Phone/Vehicle/Fleet/SDK) | ✅ evidenced | liner: `disposable-storage/VVU-Dashboard/deploy/`, vvu: `vvu-trust/android/`, `Caddyfile` | All 5 deployment types not separately implemented |
| **4. Witness Circle** (Self/Trusted/Open weights 1.0/0.6/0.3) | 🟡 specified | Nowhere implemented | Witness weight code, ring management 🔴 |
| **5. Hardware Ladder** (Phone/ESP32/Pi/OBD/Fleet) | 🟡 specified | vvu: `vvu-trust/android/`; liner: `feat/hbk-mk-ii-digital-twin` branch | Hardware-specific code for steps 1–4 🔴 |
| **6. Commercial Model** (R9–R9999 price book) | 🟡 specified | `redesigned-no123/shared/license/` has TIER_PRICING (Free/R5k/R25k/R100k) | Deployment-specific price book 🟡 |
| **7. Commercial Quest** (BYOD + Witness Circle) | 🟡 specified | vvu: `vvu-field-onboard` Ed25519 device binding | Witness Circle growth loop 🔴 |
| **8. Governance & Compliance** | ✅/🟡/🔴 | liner: VVU-GOVERNANCE-CHARTER, 9 ADRs; vvu: FINAL_GO_LIVE_EVIDENCE §10 | FSCA 🔴, entity name 🔴, address conflict 🔴 |
| **9. Tier Architecture** (Observed/Specified/Hypothesis/Vision) | ✅ evidenced | liner: VVU-LAYER-MAP.md, BUILD_REPORT.md | — |
| **10. TIA Preseed Application** | 🟡 specified | Nowhere in repos | 5 blockers 🔴 |
| **11. Alliance & Outreach** | 🟡 specified | liner: `VVU-VAL-001/outreach/`; vvu: prisma `OutreachTarget` models | Quad-Partite Alliance docs 🔴 |
| **12. Workspace & Operations** | 🟡 specified | Nowhere — `VVU-Masterpiece/` dir structure is mindmap-only | Physical workshop, 4-phase programme 🔴 |
| **13. Compounding Estate** | 🟡 specified | Nowhere — Estate Truth Register is mindmap-only | `VVU-Masterpiece/` directory 🔴 |
| **14. Critical Gaps** | 🔴 10 gaps | 6 of 10 confirmed in repos (Fire, repo state, anchor stub, Android bridge, FSCA, no customer) | 4 of 10 are operator-side |
| **15. Evidenced (Tier 1)** | ✅ | vvu: 4 load-bearing artefacts (FINAL_GO_LIVE_EVIDENCE, E2E_LOG1_EVIDENCE, LOG_1.json, TEMPLATE_QR_BRIDGE) | — |

---

## 3. The shared foundation (build order #1)

**Status:** 🔴 NOT STARTED. This is the load-bearing gap. Nothing else can be built consistently without it.

### 3.1 `vvu-envelope.schema.json`

**Location:** `schemas/vvu-envelope.schema.json` (new file in working repo)

**Shape (from VVU-ENV-BLUEPRINT-2026-001 §1.2):**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vvu:schema:envelope.v1",
  "title": "VVU Artefact Envelope v1.0",
  "type": "object",
  "required": ["envelope_version", "artefact_id", "artefact_type", "produced_by", "produced_at", "content", "provenance", "integrity", "status", "limitations"],
  "properties": {
    "envelope_version": { "const": "1.0" },
    "artefact_id": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
    "artefact_type": { "enum": ["claim", "model", "learning_submission", "experimental_record", "observation", "verification_receipt", "test_report", "counterexample", "publication"] },
    "produced_by": {
      "type": "object",
      "required": ["environment", "instance_id", "operator_id", "software_version"],
      "properties": {
        "environment": { "enum": ["forge", "bench", "fire", "field", "press"] },
        "instance_id": { "type": "string" },
        "operator_id": { "type": "string" },
        "software_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
      }
    },
    "produced_at": { "type": "string", "format": "date-time" },
    "content": { "type": "object" },
    "provenance": {
      "type": "object",
      "required": ["inputs"],
      "properties": {
        "inputs": { "type": "array", "items": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } },
        "policy": { "type": "string", "pattern": "^urn:vvu:policy:" },
        "configuration": { "type": "string" }
      }
    },
    "integrity": {
      "type": "object",
      "required": ["digest"],
      "properties": {
        "digest": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" },
        "signature": { "type": "string", "pattern": "^ed25519:[0-9A-Za-z+/=]+$" },
        "chain_ref": { "type": "string" }
      }
    },
    "status": { "$ref": "#/$defs/status" },
    "limitations": { "type": "array", "items": { "type": "string" } }
  },
  "$defs": {
    "status": {
      "enum": ["DRAFT", "IMPORTED", "PARSED", "INTEGRITY_VALID", "VERIFIED", "REJECTED", "INCONCLUSIVE", "NOT_PROVEN", "BLOCKED", "EXPIRED", "SUPERSEDED", "WITHDRAWN"]
    }
  }
}
```

**Validation rules (enforced by `if/then`):**
- `status: VERIFIED` requires `provenance.policy` to be present.
- `status: INCONCLUSIVE | NOT_PROVEN | BLOCKED` requires `limitations` to be non-empty.
- `integrity.signature` present ⇒ `produced_by.operator_id` must be the public-key fingerprint.

### 3.2 Status vocabulary (the 12-state enum)

**Location:** `src/lib/envelope/status.ts`

```typescript
export const STATUS = [
  "DRAFT",           // Created locally. Not yet exported.
  "IMPORTED",        // Received by a receiving environment. Structure not yet checked.
  "PARSED",          // Structure understood. Content not yet validated.
  "INTEGRITY_VALID", // Digest matches. Signature valid if present.
  "VERIFIED",        // Applicable verification policy satisfied.
  "REJECTED",        // Refused for a stated reason.
  "INCONCLUSIVE",    // Checked but the evidence does not establish the result.
  "NOT_PROVEN",      // Mandatory conditions not satisfied.
  "BLOCKED",         // A required operation could not proceed.
  "EXPIRED",         // Time-bounded validity has passed.
  "SUPERSEDED",      // A newer artefact replaces this one's authority.
  "WITHDRAWN",       // Producer has retracted it.
] as const;
export type Status = typeof STATUS[number];
```

**Status transition rules (state machine):**
- `DRAFT → IMPORTED` (export)
- `IMPORTED → PARSED` (parse)
- `PARSED → INTEGRITY_VALID | REJECTED` (integrity check)
- `INTEGRITY_VALID → VERIFIED | INCONCLUSIVE | NOT_PROVEN | BLOCKED` (policy check)
- `VERIFIED → EXPIRED | SUPERSEDED | WITHDRAWN` (lifecycle)
- `REJECTED` is terminal
- **Status is never silently upgraded.** A `PARSED` artefact becomes `INTEGRITY_VALID` only by running the integrity check.

### 3.3 Version negotiation contract

**Location:** `src/lib/envelope/version.ts`

- Every envelope declares `envelope_version`.
- Every receiving environment declares a `SUPPORTED_VERSIONS` set.
- On receive: parse `envelope_version`; if in supported set → accept; if newer minor within same major → accept with `status: IMPORTED` + limitation note; if newer major → reject with `REJECTED_VERSION_UNSUPPORTED`; if not in supported set → reject.

### 3.4 Chain client (unified)

**Location:** `src/lib/envelope/chain-client.ts`

- A single library that writes to and reads from the WORM ledger.
- Used by all 5 environments.
- Wraps the existing `vvu-ledger.ts` + `governance.ts` (WORM) + `vault-bridge` receipts + `vvu-field-onboard` receipts into one client.
- API: `append(env, artefact) → chain_ref`, `verify(chain_ref) → bool`, `replay(from_seq) → artefact[]`.

### 3.5 Failure-code registry

**Location:** `src/lib/envelope/failure-codes.ts`

```typescript
export const FAILURE_CODES = [
  "REJECTED_VERSION_UNSUPPORTED",
  "REJECTED_POLICY_UNRESOLVED",
  "REJECTED_POLICY_VERSION_UNSUPPORTED",
  "REJECTED_POLICY_STATUS",
  "REJECTED_POLICY_MALFORMED",
  "REJECTED_POLICY_OUTCOME_TOTALITY",
  "REJECTED_POLICY_CHECK_MISSING",
  "REJECTED_POLICY_IMMUTABILITY",
  "REJECTED_INTEGRITY_FAILURE",
  "REJECTED_SIGNATURE_INVALID",
  "REJECTED_DIGEST_MISMATCH",
  "REJECTED_CHAIN_BROKEN",
] as const;
```

Append-only. Never renumbered.

---

## 4. VVU-BENCH-2026-001 — Verification Policy Identifier Spec (build order #1b)

**Status:** 🔴 NOT STARTED. The `urn:vvu:policy:` URI scheme does not exist anywhere.

### 4.1 Policy identifier parser

**Location:** `src/lib/policy/identifier.ts`

- Grammar: `urn:vvu:policy:<category>:<name>@<MAJOR>.<MINOR>.<PATCH>`
- 9 categories: `verification | integrity | provenance | independence | consent | retention | field | fire | press`
- Name: `[a-z][a-z0-9-]{1,62}` (2–63 chars)
- Version: 3-part semver, no leading zeros, no pre-release, no build metadata
- Functions: `parsePolicyId(str) → { category, name, version } | Error`, `formatPolicyId(parts) → str`, `isValidPolicyId(str) → bool`
- Forbidden patterns: uppercase, underscores, 2-part versions, 4-part versions, non-standard categories, missing `urn:vvu:` prefix.

### 4.2 Policy document schema

**Location:** `schemas/vvu-policy-document.schema.json`

- Fields: `policy_id, title, description, category, effective_from, effective_to?, supersedes?, status, required_inputs, checks[], outcome_rules[], limitations_declaration`
- `status`: `DRAFT | ACTIVE | DEPRECATED | REVOKED`
- `checks[]`: each has `check_id, title, description, required, input_refs, procedure, parameters, on_missing_input`
- `outcome_rules[]`: each has `rule_id, condition, outcome, rationale`
- The 4 standard rules (§6.3) are enforced: BLOCKED on any required=BLOCKED, NOT_PROVEN on any required=FAIL, INCONCLUSIVE on any required=INCONCLUSIVE, PROVEN on all required=PASS.

### 4.3 Procedure registry

**Location:** `src/lib/policy/procedures.ts`

10 initial procedures (append-only):
- `digest.match` — recompute digest, compare
- `signature.verify` — Ed25519 verify over canonical bytes
- `field.present` — assert field exists and is non-empty
- `field.equal` — assert field equals a value
- `field.in_range` — assert numeric field within range
- `input.present` — assert upstream artefact is referenced
- `input.resolvable` — assert referenced artefact can be loaded
- `policy.applicable` — assert policy is effective at a timestamp
- `chain.link_valid` — assert chain reference resolves
- `witness.count` — assert number of independent witnesses ≥ min

### 4.4 Outcome evaluator

**Location:** `src/lib/policy/evaluator.ts`

- Input: policy document + check outcomes (map of `check_id → PASS|FAIL|INCONCLUSIVE|BLOCKED|NOT_APPLICABLE`)
- Evaluates `outcome_rules` in order, returns first match.
- Validates totality (every combination reaches exactly one outcome).
- Returns: `PROVEN | NOT_PROVEN | INCONCLUSIVE | BLOCKED` + the matched `rule_id` + `rationale`.

### 4.5 Policy registry (local, offline-first)

**Location:** `policies/` directory (new)

- Filenames: `urn_vvu_policy_<category>_<name>@<version>.json`
- Each file: a full policy document in envelope format (artefact_type: `policy` — extends the §1.3 type registry).
- Resolution order (§8.1): local registry → envelope-carried → `REJECTED_POLICY_UNRESOLVED`.
- **Never reaches the network** unless explicitly configured.

### 4.6 Initial seed policies

| Policy ID | What it checks | Used by |
|---|---|---|
| `urn:vvu:policy:verification:evidence-independence@1.0.0` | Two-witness rule (≥2 independent witnesses) | Bench (court-grade Tier R2) |
| `urn:vvu:policy:verification:chain-integrity@2.1.0` | WORM chain verifies from genesis | Bench |
| `urn:vvu:policy:integrity:signature-required@1.0.0` | Ed25519 signature present and valid | Bench |
| `urn:vvu:policy:provenance:complete-inputs@1.2.3` | All `required_inputs` are present and resolvable | Bench |
| `urn:vvu:policy:independence:two-witness@1.0.0` | Two independent device signatures | Bench |
| `urn:vvu:policy:consent:recorded@1.0.0` | Consent log entry exists for the target | REA plugin, Bench |
| `urn:vvu:policy:field:observation-shape@1.0.0` | Observation has value, unit, sensor_id, timestamp, calibration_state | Field |
| `urn:vvu:policy:fire:test-scope@1.0.0` | Test report has target, scope, cases, outcomes, limitations | Fire |
| `urn:vvu:policy:press:claim-attribution@1.0.0` | Publication has claim extractor output + receipt linkage | Press |

### 4.7 Conformance cases (CF-POL-01 through CF-POL-08)

**Location:** `fire/conformance/cf-pol-*.test.ts` (built when Fire lands — build order #2)

The 8 cases from VVU-BENCH-2026-001 §10:
1. Uppercase in policy ID → `REJECTED_POLICY_MALFORMED`
2. Non-standard category → `REJECTED_POLICY_MALFORMED`
3. Resolve ACTIVE policy offline → succeeds from local registry
4. Policy not in local registry → `REJECTED_POLICY_UNRESOLVED` (must not attempt network)
5. Verify against REVOKED policy → `REJECTED_POLICY_STATUS`
6. Outcome rules don't cover a combination → `REJECTED_POLICY_OUTCOME_TOTALITY`
7. Mutate a policy after VERIFIED receipt issued → `REJECTED_POLICY_IMMUTABILITY`
8. Receipt missing a `required: true` check → `REJECTED_POLICY_CHECK_MISSING`

---

## 5. The 5 environments (build order #2–#6)

### 5.1 Fire — Challenge (build order #2, first build priority)

**Status:** 🔴 MISSING. Assets exist to consume.

**Location:** `fire/` directory (new) + `mini-services/fire/` (new service, port 3036)

**Components to build:**

| Component | Path | Consumes |
|---|---|---|
| Threat model registry | `fire/registry/threats/` | VVU-VAL-001/docs/threat-model.md (port from liner) |
| Expected-behaviour registry | `fire/registry/expected/` | The 9-case tamper matrix, N1–N9, 12 QR tests |
| Test execution engine | `fire/engine/runner.ts` | `tests/proofbridge-harness/run-harness.ts` (port from vvu) |
| Counterexample preserver | `fire/engine/counterexample.ts` | Smallest reproduction of any failure |
| Report generator | `fire/engine/report.ts` | Produces `test_report` artefacts |
| Regression scheduler | `fire/engine/regression.ts` | Re-runs prior tests against new builds |

**API surface:**
- `POST /api/fire/test` — submit a target for testing
- `GET /api/fire/reports` — list prior reports
- `GET /api/fire/counterexamples` — list preserved failures
- `POST /api/fire/regression` — re-run against a new version

**Produces:** `test_report`, `counterexample` (2 new artefact types)
**Consumes:** `claim`, `model`, `verification_receipt`, `observation`, any artefact to be tested

**First assets to wire (existing, port-in):**
- 9-case tamper matrix from `FINAL_GO_LIVE_EVIDENCE.md`
- N1–N9 from `E2E_LOG1_EVIDENCE.md`
- 12 QR tests from `TEMPLATE_QR_BRIDGE.md`
- `tests/proofbridge-harness/Capitec_Fraud_Evidence_Harness.json`
- VVU-VAL-001 chaos scripts (`inject-{network,partition,security,storage}.sh`)

### 5.2 Forge — Create (build order #3, unification)

**Status:** 🟡 PARTLY BUILT. STUDI components exist in liner; no unified Forge surface.

**Location:** `forge/` directory (new) — wraps existing STUDI components

**Components:**

| Component | Path | Status |
|---|---|---|
| Plugin Creator Studio | `forge/plugin-creator-studio/` | 🔴 missing (HTML surface not found in any repo) |
| STUDI learning modules | `forge/studi/` | 🟡 exists as React .tsx in liner `src/components/studi/` — port in |
| Spreadsheet | `forge/spreadsheet/` | 🔴 missing (HTML surface not found) |
| Validation Dashboard | `forge/validation-dashboard/` | 🟡 closest is the existing 29-section dashboard — extract the harness runner |

**Produces:** `claim`, `model`, `learning_submission`, `experimental_record`, `validation_payload` (5 artefact types — all new)
**Consumes:** `test_report` (from Fire, for remediation), `verification_receipt` (from Bench, for reference)

**API surface:**
- `POST /api/forge/validate` — invokes the harness, returns validation payload (the mindmap's `POST /api/validate`)

### 5.3 Press — Communicate (build order #4)

**Status:** 🟡 PARTLY BUILT. No editorial workflow.

**Location:** `press/` directory (new) + `mini-services/press/` (new service, port 3037)

**Components to build:**

| Component | Path | Function |
|---|---|---|
| Claim extractor | `press/editor/claim-extractor.ts` | Separate observations from interpretations from conclusions |
| Receipt linker | `press/editor/receipt-linker.ts` | Import a Bench receipt, represent its scope accurately |
| Approval record | `press/editor/approval.ts` | Who approved, which version, when |
| Correction workflow | `press/editor/correction.ts` | Original preserved, correction linked, both accessible |
| Version preservation | `press/editor/versions.ts` | Every published version recoverable |

**API surface:**
- `POST /api/press/draft` — create a draft
- `POST /api/press/approve` — approve for release
- `POST /api/press/publish` — release
- `POST /api/press/correct` — publish a correction
- `GET /api/press/versions/{publication_id}` — version history

**Produces:** `publication` (1 new artefact type)
**Consumes:** any artefact referenced in the publication, especially `verification_receipt`

### 5.4 Field — Observe (build order #5, vocabulary formalization)

**Status:** ✅ SECOND STRONGEST. Service exists; vocabulary doesn't.

**Location:** `field/` directory (new, wraps `mini-services/vvu-field-onboard/`)

**What's already there (port from `proofbridge-vvu`):**
- `mini-services/vvu-field-onboard/index.ts` (615 lines, :3005, NODE_ID `FIELD-09`, PROTOCOL_ID `VVU-FIELD-ONBOARD-2026`)
- Offline queue, idempotent sync, signature capture, rejected[] list
- All 7 failure modes implemented

**What to add:**
- `observation` artefact type schema (value, unit, sensor_id, measurement_time, receipt_time, calibration_state, configuration_version, integrity)
- 5 status states: `recorded | queued | transmitted | accepted | validated`
- Observed-vs-inferred separation (Field records observations; Bench infers conclusions)
- `urn:vvu:policy:field:observation-shape@1.0.0` policy (from §4.6)

### 5.5 Bench — Verify (build order #6, vocabulary formalization)

**Status:** ✅ STRONGEST. Evidenced. Needs vocabulary formalization only.

**Location:** `bench/` directory (new, wraps `mini-services/vault-bridge/`)

**What's already there (port from `proofbridge-vvu`):**
- `mini-services/vault-bridge/index.ts` (977 lines, :3004)
- `src/lib/proofbridge/{governance,jcs,merkle,tier,anchor,sbt}.ts`
- `src/proofbridge/` Rust kernel (Ed25519 + MMR + fail-closed)
- `ProofBridge/{FINAL_GO_LIVE_EVIDENCE,E2E_LOG1_EVIDENCE,LOG_1,TEMPLATE_QR_BRIDGE}.md`
- All 4 failure modes implemented (chain integrity, missing evidence, adversarial input)

**What to add (the VVU-BENCH-2026-001 retrofit):**
- The `verification_receipt` artefact type (claim + policy + evidence_refs + checks + outcomes + overall_result + limitations + integrity)
- The policy registry directory (`policies/`)
- The outcome rules interpreter (from §4.4)
- The 7 new failure codes (from §3.5)
- Wire `provenance.policy` into the receipt's envelope
- Rename the informal vocabulary (VERIFIED/BLOCKED/INCONCLUSIVE) to the formal 12-state enum

---

## 6. Build order (phased delivery)

| Phase | What | Why this order | Effort | Depends on |
|---|---|---|---|---|
| **0** | Port-in the ProofBridge rails + architecture docs + spine contracts into the working repo | Nothing can be built without the rails in the working tree | 1 day | — |
| **1** | Shared foundation: `vvu-envelope.schema.json` + 12-state status vocabulary + version negotiation + chain client + failure codes | Nothing else can be built consistently without it (blueprint build order #1) | 3 days | Phase 0 |
| **1b** | VVU-BENCH-2026-001: policy identifier parser + policy document schema + procedure registry + outcome evaluator + 9 seed policies | Closes the last unresolved field in the envelope (`provenance.policy`) | 3 days | Phase 1 |
| **2** | Fire environment: threat model registry + expected-behaviour registry + test execution engine + counterexample preserver + report generator + regression scheduler | Missing entirely. Blocks Route B (Field→Fire) and Route C (Forge→Fire). Smallest build of the five. Consumes existing assets. (blueprint build order #2) | 5 days | Phase 1, 1b |
| **3** | Forge unification: wrap STUDI components + add claim/model/learning_submission/experimental_record artefact types + `POST /api/forge/validate` | Not a rebuild — a wrapper. (blueprint build order #3) | 3 days | Phase 1, 1b |
| **4** | Press editorial workflow: claim extractor + receipt linker + approval + correction + version preservation | Needed before any public claim is made. (blueprint build order #4) | 4 days | Phase 1, 1b |
| **5** | Field vocabulary formalization: observation schema + 5 status states + observed-vs-inferred separation | Low effort, high clarity. (blueprint build order #5) | 2 days | Phase 1 |
| **6** | Bench vocabulary formalization: rename only. Wire `provenance.policy` into receipts. Adopt the 12-state enum. | Vocabulary already exists in the code. (blueprint build order #6) | 2 days | Phase 1b |
| **7** | Interoperability demonstration (blueprint §4): Forge→Fire→Bench→Press→Field end-to-end test. Each environment completes its job without any other being online. | The first end-to-end test that proves the architecture works. | 2 days | Phase 2–6 |

**Total: ~25 days** for the full Five Environments architecture on the shared foundation.

---

## 7. Dependency graph (the mind map, visualized)

```
                    ┌─────────────────────────────────────┐
                    │      SHARED FOUNDATION (Phase 1)     │
                    │  envelope · statuses · version ·     │
                    │  chain client · failure codes        │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┴───────────────────┐
                    │   VVU-BENCH-2026-001 (Phase 1b)      │
                    │  policy ID · registry · evaluator ·  │
                    │  9 seed policies · 8 conformance     │
                    └─────────────────┬───────────────────┘
                                      │
            ┌─────────────┬───────────┼───────────┬─────────────┐
            │             │           │           │             │
         FORGE          BENCH        FIRE        FIELD         PRESS
        (Phase 3)      (Phase 6)   (Phase 2)   (Phase 5)    (Phase 4)
            │             │           │           │             │
            ▼             ▼           ▼           ▼             ▼
        claim       verification  test_report  observation   publication
        model         receipt     counterexample
        learning
        submission
        experimental
        record
            │             │           │           │             │
            └─────┬───────┴─────┬─────┘           │             │
                  │             │                 │             │
                  ▼             ▼                 │             │
               FIRE          PRESS               │             │
            (challenge)   (communicate)          │             │
                  │             │                 │             │
                  └─────────────┴─────────────────┴─────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   INTEROPERABILITY DEMO (Phase 7)    │
                    │  Forge→Fire→Bench→Press→Field        │
                    │  Each independent. Each exports.     │
                    └─────────────────────────────────────┘
```

**Routes (blueprint §1.7):**
- A: Field → Bench (observation for verification)
- B: Field → Fire (dataset for adversarial testing)
- C: Forge → Fire (model/claim for challenge)
- D: Bench → Press (receipt for publication)
- E: Press → Outside world (publication package)

---

## 8. Artefact type registry (the 9 types, with locations)

| Type | Produced by | Content schema location | Status |
|---|---|---|---|
| `claim` | Forge | `schemas/artefacts/claim.schema.json` | 🔴 new |
| `model` | Forge | `schemas/artefacts/model.schema.json` | 🔴 new |
| `learning_submission` | Forge | `schemas/artefacts/learning-submission.schema.json` | 🔴 new |
| `experimental_record` | Forge | `schemas/artefacts/experimental-record.schema.json` | 🔴 new |
| `observation` | Field | `schemas/artefacts/observation.schema.json` | 🔴 new |
| `verification_receipt` | Bench | `schemas/artefacts/verification-receipt.schema.json` | 🔴 new |
| `test_report` | Fire | `schemas/artefacts/test-report.schema.json` | 🔴 new |
| `counterexample` | Fire | `schemas/artefacts/counterexample.schema.json` | 🔴 new |
| `publication` | Press | `schemas/artefacts/publication.schema.json` | 🔴 new |
| `policy` | (meta — policies are artefacts too) | `schemas/artefacts/policy.schema.json` | 🔴 new (extends §4.2) |

All 10 schemas are new. All share the envelope from §3.1.

---

## 9. Repository strategy

### 9.1 Working repo: `redesigned-no123` (this one)

- Remains the integration trunk.
- Phase 0 port-in brings the ProofBridge rails + architecture docs + spine contracts into this repo.
- All new work (Phases 1–7) lands here on `main`.
- Push to `origin/main` after each phase.

### 9.2 Source repos (read-only for this plan)

- `proofbridge-liner` — remains the architecture/governance docs canonical source. Port-in copies, doesn't move.
- `proofbridge-vvu` — remains the ProofBridge rails canonical source. Port-in copies, doesn't move.
- Both source repos can be archived after Phase 0 port-in is verified.

### 9.3 Branch strategy for the working repo

- `main` — the integration trunk. All phases land here.
- `phase/<n>-<name>` — feature branches per phase (e.g. `phase/1-shared-foundation`).
- Each phase merges to `main` via PR after CI passes (lint + golden-rule + dashboard-validator + boundaries + type-check).
- The `.github/workflows/ci.yml` already runs on every push + PR.

### 9.4 Directory structure after Phase 7

```
redesigned-no123/
├── schemas/                          # NEW (Phase 1)
│   ├── vvu-envelope.schema.json
│   ├── vvu-policy-document.schema.json
│   └── artefacts/
│       ├── claim.schema.json
│       ├── model.schema.json
│       ├── learning-submission.schema.json
│       ├── experimental-record.schema.json
│       ├── observation.schema.json
│       ├── verification-receipt.schema.json
│       ├── test-report.schema.json
│       ├── counterexample.schema.json
│       ├── publication.schema.json
│       └── policy.schema.json
├── src/lib/
│   ├── envelope/                     # NEW (Phase 1)
│   │   ├── status.ts
│   │   ├── version.ts
│   │   ├── chain-client.ts
│   │   └── failure-codes.ts
│   ├── policy/                       # NEW (Phase 1b)
│   │   ├── identifier.ts
│   │   ├── procedures.ts
│   │   ├── evaluator.ts
│   │   └── registry.ts
│   ├── proofbridge/                  # PORTED (Phase 0)
│   │   ├── governance.ts
│   │   ├── jcs.ts
│   │   ├── merkle.ts
│   │   ├── tier.ts
│   │   ├── anchor.ts
│   │   └── sbt.ts
│   └── ...existing
├── policies/                         # NEW (Phase 1b) — the local policy registry
│   ├── urn_vvu_policy_verification_evidence-independence@1.0.0.json
│   ├── urn_vvu_policy_verification_chain-integrity@2.1.0.json
│   └── ...9 seed policies
├── forge/                            # NEW (Phase 3)
│   ├── plugin-creator-studio/
│   ├── studi/
│   ├── spreadsheet/
│   └── validation-dashboard/
├── bench/                            # NEW (Phase 6, wraps vault-bridge)
│   └── README.md
├── fire/                             # NEW (Phase 2)
│   ├── registry/
│   │   ├── threats/
│   │   └── expected/
│   ├── engine/
│   │   ├── runner.ts
│   │   ├── counterexample.ts
│   │   ├── report.ts
│   │   └── regression.ts
│   ├── conformance/
│   │   ├── cf-pol-01.test.ts
│   │   └── ...cf-pol-08.test.ts
│   └── vvu-val-001/                  # PORTED from liner (Phase 0)
├── field/                            # NEW (Phase 5, wraps vvu-field-onboard)
│   └── README.md
├── press/                            # NEW (Phase 4)
│   ├── editor/
│   │   ├── claim-extractor.ts
│   │   ├── receipt-linker.ts
│   │   ├── approval.ts
│   │   ├── correction.ts
│   │   └── versions.ts
│   └── README.md
├── mini-services/
│   ├── vault-bridge/                 # PORTED (Phase 0) — :3004 Bench
│   ├── vvu-field-onboard/            # PORTED (Phase 0) — :3005 Field
│   ├── fire/                         # NEW (Phase 2) — :3036 Fire
│   ├── press/                        # NEW (Phase 4) — :3037 Press
│   ├── rea/                          # existing — :3034
│   ├── debugger/                     # existing — :3098
│   ├── worm-nest/                    # existing — :3003
│   ├── event-bus/                    # existing — :3032
│   └── epd-cli/                      # existing — :3031
├── ProofBridge/                      # PORTED (Phase 0) — the 4 load-bearing artefacts
│   ├── E2E_LOG1_EVIDENCE.md
│   ├── GO_LIVE/FINAL_GO_LIVE_EVIDENCE.md
│   ├── LOG_1.json
│   └── TEMPLATE_QR_BRIDGE.md
├── spine/                            # PORTED (Phase 0) — the spine contracts
│   ├── contracts/
│   │   ├── clock.v1.schema.json      # landed
│   │   ├── manifest.v1.schema.json   # landed
│   │   ├── envelope.v1.schema.json   # was BLOCKED — Phase 1 fills this
│   │   └── receipt.v1.schema.json    # was BLOCKED — Phase 1b fills this
│   ├── verify/
│   └── docs/data/
├── docs/
│   ├── architecture/                 # PORTED (Phase 0)
│   │   ├── VVU-ARCHITECTURE.md
│   │   ├── VVU-LAYER-MAP.md
│   │   └── VVU-SESSION-PROTOCOL.md
│   ├── governance/                   # PORTED (Phase 0)
│   │   ├── VVU-GOVERNANCE-CHARTER.md
│   │   └── adrs/ADR-001..009.md
│   ├── VVU-ENV-BLUEPRINT-2026-001.md # NEW — commit the blueprint as a formal artefact
│   ├── VVU-BENCH-2026-001.md         # NEW — commit the policy spec as a formal artefact
│   ├── VVU-IMPLEMENTATION-PLAN-2026-001.md  # THIS FILE
│   └── CLIENT-MATRIX.md              # existing
├── shared/license/                   # existing (REA_ENABLED + consentLog)
└── ...existing (dashboard, CI/CD, etc.)
```

---

## 10. CI/CD integration

The existing `.github/workflows/ci.yml` runs 5 jobs on every push + PR:
- lint (0 errors required)
- golden-rule (must exit 0)
- dashboard-validator (must exit 0)
- boundaries (must exit 0)
- type-check (continue-on-error for now)

**Additions per phase:**

| Phase | CI addition |
|---|---|
| 1 | Add `envelope-validator` job: validate every `schemas/*.json` against JSON Schema draft 2020-12. Add `lint:envelopes` script. |
| 1b | Add `policy-validator` job: validate every `policies/*.json` against `vvu-policy-document.schema.json`. Add `lint:policies` script. |
| 2 | Add `fire-conformance` job: run CF-POL-01 through CF-POL-08. Must all pass. |
| 3–6 | Add `interoperability-demo` job: run the Phase 7 end-to-end test. |

The `.github/workflows/security-audit.yml` (weekly Monday cron) already runs `bun audit` + golden-rule + dashboard-validator. Add envelope-validator + policy-validator to the weekly audit.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Port-in brings in code that doesn't match the working repo's dependencies | Build breaks | Phase 0 port-in is selective (only the files in §1.1's manifest). Run `bun install` after each port. Lint after each port. |
| The 12-state status vocabulary conflicts with existing informal usage | Rename breaks things | Phase 6 (Bench vocabulary formalization) is last. The informal usage stays until then. The formal enum lives in `src/lib/envelope/status.ts` and is only adopted by new code. |
| The policy registry's offline-first rule conflicts with the existing anchor stub | Anchor can't reach network | The anchor stub (`src/lib/proofbridge/anchor.ts`) is already honestly labelled. The policy registry's offline-first rule applies to *policy resolution*, not to *receipt anchoring*. These are separate concerns. |
| The spine contracts (`envelope.v1`, `receipt.v1`) were BLOCKED because the source (`vvu_mk0.py`, `contracts/envelope.md`) doesn't exist | Phase 1 can't lift the shape | We're not lifting — we're writing the schema from the blueprint §1.2 spec. The BLOCKED note in `spine/README.md` is resolved by this plan. |
| Fire environment build is 5 days but the user needs it sooner | Schedule pressure | Fire consumes existing assets (9-case matrix, N1–N9, 12 QR tests, VVU-VAL-001 chaos). The first usable Fire is a thin wrapper around those assets — 2 days, not 5. The full 5-day build adds the regression scheduler + counterexample preserver. |
| The interoperability demo (Phase 7) reveals a route is broken | Demo fails | Each route is testable in isolation before the demo. The demo is the integration test, not the first test. |

---

## 12. Definition of done

The implementation is complete when all of the following are true:

1. **Shared foundation landed.** `schemas/vvu-envelope.schema.json` exists, validates, and is used by every artefact that crosses an environment boundary. The 12-state status vocabulary is the only status vocabulary in the codebase. Version negotiation is implemented. The chain client is unified.

2. **VVU-BENCH-2026-001 implemented.** The `urn:vvu:policy:` URI scheme parses and formats. 9 seed policies exist in `policies/`. The outcome evaluator produces `PROVEN | NOT_PROVEN | INCONCLUSIVE | BLOCKED` for every combination. The 8 conformance cases (CF-POL-01–08) pass.

3. **Fire environment operational.** `mini-services/fire/` runs on :3036. `POST /api/fire/test` accepts a target, runs tests, returns a `test_report`. The 9-case tamper matrix, N1–N9, and 12 QR tests are wired as Fire test cases. The regression scheduler re-runs them on every push.

4. **All 5 environments produce and consume their artefact types.** Forge produces `claim/model/learning_submission/experimental_record`. Bench produces `verification_receipt`. Fire produces `test_report/counterexample`. Field produces `observation`. Press produces `publication`. Every artefact carries a valid envelope.

5. **Interoperability demo passes.** The Phase 7 end-to-end test (Forge→Fire→Bench→Press→Field) completes with each environment offline-capable, every envelope valid, every status accurate, no silent trust upgrades.

6. **The 4 load-bearing artefacts are ported and referenced.** `FINAL_GO_LIVE_EVIDENCE.md`, `E2E_LOG1_EVIDENCE.md`, `LOG_1.json`, `TEMPLATE_QR_BRIDGE.md` live in `ProofBridge/` in the working repo and are linked from the dashboard.

7. **CI passes on all of the above.** `bun run lint` is 0 errors. Golden Rule, dashboard-validator, envelope-validator, policy-validator, fire-conformance all pass. The weekly security audit runs clean.

8. **The repo is pushed to `origin/main` on `redesigned-no123`.** The plan is synced.

---

## 13. What this plan does NOT do

- Does not build the Witness Circle (mind-map branch 4). That's a product feature, not an environment. It lands after the 5 environments are operational.
- Does not build the Hardware Ladder (mind-map branch 5). That's hardware procurement + firmware, not software. It lands after the Field environment is formalized.
- Does not resolve the operator-side gaps (entity name, address conflict, FSCA, quotations, WRC cycle). Those are outside repo scope.
- Does not build the TIA preseed application (mind-map branch 10). That's a grant application, not software.
- Does not build the `VVU-Masterpiece/` directory structure (mind-map branch 13). That's an estate organization decision, not an implementation task. The working repo's directory structure (§9.4) is the pragmatic equivalent.
- Does not adopt the BPB proxy stack. Per the earlier analysis, only the edge-rendered signed license URL + contract-first client matrix patterns were adopted. The proxy stack destroys the non-repudiation story.

---

## 14. Next action

**Phase 0: Port-in.** Clone `proofbridge-vvu@feat/phase15-games` and `proofbridge-liner@main` + `proofbridge-liner@feat/constitution-v1-governance` + `proofbridge-liner@feature/vvu-val-001` + `proofbridge-vvu@spine/extract-1` into `/tmp/scrape/` (already done by the scrape), then selectively copy the files in the §1.1 manifest into the working repo. Run `bun install` + `bun run lint` after each port. Commit per port-in batch. Push to `origin/main`.

**Phase 0 exit criteria:** the working repo has `mini-services/vault-bridge/`, `mini-services/vvu-field-onboard/`, `src/lib/proofbridge/`, `src/proofbridge/` (Rust), `ProofBridge/`, `spine/`, `docs/architecture/`, `docs/governance/`, and `fire/vvu-val-001/`. `bun run lint` is 0 errors. The dashboard still loads.

**Say the word and Phase 0 begins.**

---

*This plan is a Tier 2 artefact (specified, awaiting implementation). Every claim is sourced to the scrape report. Every gap is marked. Every phase has exit criteria. The build order is the blueprint's build order. The repo strategy is port-in, not switch-base.*
