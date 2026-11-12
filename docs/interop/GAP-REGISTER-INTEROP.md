# GAP REGISTER — INTEROP AND MOUNT — 15 October 2026

**Ref:** VVU-INT-GAP-2026-001
**Question answered:** the five environments are separate files, each with its own store. What is still missing before they interoperate through the VVU-SF-2026-001 envelope and mount under one PWA shell with an orchestrator, without depending on the main app?

Tier labels per VVU-GLOSS-2026-001: **Reality** = observed in this session. **Architecture** = specified, not run. **Hypothesis** = untested.

## 0. Inputs and what could not be checked

| Item | State |
|---|---|
| FORGE, BENCH, FIRE, FIELD, PRESS `.html` (5) | PRESENT. Read and executed in jsdom 26. |
| VVU-SF-2026-001, VVU-GLOSS-2026-001, envelope schema | PRESENT. Read in full. |
| Main repository (`redesigned-no123`) | **UNREACHABLE.** Only a pasted README was supplied. Its "42/42 CF-INT", "28 deps", "assertFireEnvelope()" and mini-service claims are **DOCUMENTED, not observed**. Nothing here depends on it. |
| A real browser, installed PWA, real IndexedDB, real BroadcastChannel hosting | **ABSENT.** jsdom has none of these. Every hosted-mode and installability statement below is Architecture or Hypothesis. |

## 1. Verdict

Each environment works alone (Reality: all five boot with no script error and export). They did **not** interoperate: none could import anything, three never emitted an envelope, and the two that did emitted envelopes no receiver could accept. They now do, through a bundle that mounts without a host. What remains is mostly decisions and in-app consumption, listed in §5 and §6.

## 2. Defects found in the uploaded environments (Reality; line numbers are in the originals)

| ID | Where | Defect | Effect | State |
|---|---|---|---|---|
| E-01 | BENCH 785, FORGE 227 | `artefact_id` is `uid('art')` = `Math.random` text, not an RFC 9562 v4 UUID | every envelope from Forge and Bench fails the schema (CF-01/04); collision-prone | **patched (P1)** |
| E-02 | BENCH 849, 856 | signs the hex string, not the 32 raw digest bytes (SF §4.3, CF-11) | no conforming receiver verifies it | **patched (P2)** |
| E-03 | BENCH 852 | adds `integrity.anchor`; schema permits only `digest, signature, chain_ref` | every receipt fails the schema (CF-02) | **patched (P3)**, stub id now in `chain_ref` as `stub:…` |
| E-04 | BENCH 505 | signing seed is the fixed formula `(i*7+3)&0xff`, identical on every install, stored in plaintext | the key authenticates nothing; anyone can forge a Bench signature | **patched for new keys (P4)**. **Existing stores keep the old key and must be rotated: not done** |
| E-05 | BENCH 322, 343 | Ed25519 `reduceLE` reads 32 of 64 hash bytes, and `S` is reduced mod p instead of mod L | **no Bench signature verified under any verifier, including Bench's own** (checked against Node/OpenSSL) | **patched (P5)**; patched signing verifies under OpenSSL |
| E-06 | BENCH 831–833 | `SIGNATURE`, `INCLUSION_PROOF`, `ANCHOR` checks are constants `PASS`; SIGNATURE is recorded before signing happens | a receipt can read `PROVEN` having performed none of the three checks. This breaks Zero Fabrication | **not patched** (needs real checks; changes outcomes) |
| E-07 | FORGE 238, 484, 722 | `tier_tag` and `surface` set at envelope top level | fails SF §2.1 (CF-02) | not patched; adapter re-wraps on export, original id and digest kept in `content.legacy_*` |
| E-08 | FORGE 726, 1028; FIELD 550, 724; PRESS 1055; FIRE 1302 | exports named `package_version: "1.0"` but are not SF §8 packages: no `package_digest`, extra top-level keys, no `artefacts[]` envelopes (Fire emits a raw run) | not importable by anything | covered by dock export; native buttons unchanged |
| E-09 | FIELD 292 | `sensor_state` uses `OK`; SF requires `NOMINAL \| DEGRADED \| FAULT \| UNKNOWN`. No `location` | FIELD observations invalid as SF `observation` | adapter maps `OK→NOMINAL`, `location:null` plus a limitation |
| E-10 | PRESS 282–293, 540–556 | receipts are seeded constants or typed by hand; the "digest" of an imported receipt is `sha256(id + outcome)` | Press cannot link a real receipt, and the digest it shows is fabricated | **not patched** (needs a Press UI change, §5 item 2) |
| E-11 | FORGE 250 vs SF §5 | Forge's forbidden-status list includes `INTEGRITY_VALID` and `REJECTED`, yet any environment that *receives* an artefact must record those | Forge cannot act as a receiver without contradicting itself | decision D-INT-04 |
| E-12 | all five | no import path; no `failure_declaration`; no manifest or service worker; state in `localStorage` (≈5 MB, synchronous, unreachable from Workers) | not mountable or installable; CF-31 unmet | bundle adds import, declarations, manifests, workers, IndexedDB interop store |

## 3. Defects in the specifications

| ID | Document | Finding | Handling |
|---|---|---|---|
| D-INT-01 | SF §5.2 | An artefact exported as anything other than `DRAFT` (e.g. Bench `INTEGRITY_VALID`) has no legal first transition into `IMPORTED`; only `DRAFT → IMPORTED` exists | core records a flagged `receive_edge` transition. **Needs amendment** |
| D-INT-02 | SF §2.1 vs GLOSS §1 | GLOSS requires a `tier_tag` on every artefact; SF forbids extra top-level fields | 1.0.0: tier travels in `content.tier_tag`. 2.0.0 (proposed): required top-level field |
| D-INT-03 | SF §3.1 vs GLOSS §2–3 | SF says receipt `outcome ∈ VERIFIED\|…` and test case `result ∈ PASS\|FAIL\|BLOCKED\|NOT_RUN`; GLOSS says `PROVEN` and the five Fire outcomes | core follows GLOSS. **SF §3.1 needs amending** |
| D-INT-04 | SF §10 vs Forge | declarations require "distinguishes unavailable from negative" of every environment, including Forge, which has no dependency to be unavailable | declared as N/A in prose. Confirm or exempt |
| D-INT-05 | SF §3 header | says "seven", note says "ten plus a record", schema lists eleven | resolved by D-GLOSS-03 once applied |
| D-INT-06 | uploaded schema | the `verification_receipt ⇒ provenance.policy` rule sits inside `provenance`, where `artefact_type` does not exist, so it never fires | corrected in `schemas/vvu-envelope.1.0.0.corrected.schema.json`; core enforces it |
| D-INT-07 | SF §4.3 vs main README (X₀-5) | SF: signature **optional**. README: "every artefact crossing a boundary is signed" | not decided here. Core accepts both and records "unsigned" in the transition basis. If signing becomes mandatory, one line in `receive()` enforces it |
| D-INT-08 | main README vs Bench/Fire | README hash chain `SHA-256(prev_digest ‖ canonical(payload))`; Bench and Fire use `build\|seq\|prev\|payload_hash` | **UNVERIFIED** for main. Cannot be settled without its code |
| D-INT-09 | Field gaps | outage gap facts have no artefact type; the closed type list cannot carry them | gap interval copied into each affected observation's limitations. A proper type needs a minor version |
| D-INT-10 | filenames | `vvu-envelope_schema.json` uploaded; SF names `vvf-envelope.schema.json` | cosmetic; pick one |

## 4. What was built (Reality: files exist and ran)

| Piece | File | Role |
|---|---|---|
| Interop core | `core/vvu-core.js` | JCS (RFC 8785), SHA-256, Ed25519, envelope validate/seal, status machine, reason codes, receive pipeline in SF §4.5 order, transitions, §8 packages, version negotiation, failure-declaration check. Never assigns `VERIFIED` |
| Interop store | `core/vvu-store.js` | per-environment IndexedDB `vvu.<env>.interop`; append-only artefacts, transitions, rejections; memory fallback reported by `backend()` |
| Adapters | `core/vvu-adapters.js` | native ↔ envelope for all five; never raises status, never turns SYNTHETIC into device evidence, writes every shortfall into `limitations` |
| Mount adapter | `mount/vvu-mount.js` | handshake with 600 ms standalone fallback, bus protocol |
| Dock | `mount/vvu-dock.js` | in-page export / import / keys / inbox panel; imported text via `textContent` |
| Worker, SW | `mount/vvu-worker.js`, `mount/sw.template.js` | off-thread verify; scoped, own-cache service worker |
| Build | `tools/build-mounted.js` | `dist/<env>/` for all five + `mount-descriptor.json`. Nine asserted patches (fails if text is not found exactly once) and a syntax gate on every inline script |
| Contract | `VVU-MOUNT-2026-001.md` | what a sub-app promises, what any host may rely on |
| Schemas | `schemas/` | corrected 1.0.0, proposed 2.0.0, §8 package |
| Declarations | `declarations/*.json` | five §10 failure declarations, labelled **DECLARED, not executed** |

## 5. Still missing: things that need code or an app change

1. **Bench real checks (E-06).** Compute `SIGNATURE`, `INCLUSION_PROOF`, `ANCHOR` instead of asserting them. Until then Bench can emit `PROVEN` having done three checks by constant. This is the most serious open item.
2. **In-app consumption of the inbox.** The dock stores imported artefacts, but Press's receipt list, Bench's claim list and Forge's remediation view do not read `vvu.<env>.interop`. Interop works at the file/dock level, not yet inside each app's own workflow. Patch point in Press: replace the hand-typed receipt form (PRESS 540–556) with a read of the inbox via `receiptFromEnvelope`.
3. **Bench key rotation (E-04/E-05).** Existing installs hold the forgeable key. Needs rotate, publish the new public key, and mark old receipts "signed with a compromised key".
4. **Status-transition record export** (SF §5.5). Transitions are stored locally and sealed, but nothing exports or displays them; a receiver's history is invisible in the UI.
5. **Supersession / expiry / withdrawal UI.** The state machine supports them (CF-21 passes); no screen triggers them.
6. **Native export buttons** still emit non-conformant files (E-08). Rewire them to the dock path or remove them.
7. **Signing in the other four.** Only Bench holds a key. Fire, Field, Forge and Press export unsigned (valid under SF, unsigned under main's stated rule).
8. **Key distribution.** File-based keyring works; a host-published directory (`keys.get`) is specified, untested.
9. **Real-browser verification:** installability (manifest + icons + SW), IndexedDB path, BroadcastChannel hosted mode, offline reload, `file://` open. jsdom cannot show any of these.
10. **CF-30 and CF-32** (each environment completes its job with all others unreachable; Field queue survives restart): need a browser harness. Fire should own it.
11. **Declarations unexecuted.** CF-31 checks the flags, not the claims behind them.

## 6. Still missing: decisions that are yours

| # | Decision | Default taken in this bundle |
|---|---|---|
| 1 | Accept GLOSS amendments as envelope **2.0.0** (breaking: removes two statuses and a type, per SF §12) | bundle emits and accepts **1.0.0**; 2.0.0 profile is implemented and tested but off |
| 2 | Signing mandatory or optional (D-INT-07) | optional |
| 3 | Forge as receiver (E-11, D-INT-04) | Forge-as-receiver records transitions as a receiver view; Forge-authored artefacts stay `PROPOSED/DRAFT` |
| 4 | `receive_edge` amendment (D-INT-01) | flagged, accepted |
| 5 | Main's hash-chain formula vs Bench/Fire (D-INT-08) | untouched |
| 6 | Bench external anchor target (Base/Arbitrum vs Trillian) | still stub, still self-declared |
| 7 | Field live-phone verification | still your gate, still BLOCKED |

## 7. Test evidence (Reality)

| Suite | Result | Notes |
|---|---|---|
| `tests/run-conformance.js` | **30 pass, 0 fail, 2 not run** of 32 | CF-01..29 and CF-31 run; CF-30, CF-32 NOT_RUN (need browsers) |
| Interop matrix | **12 pass, 0 fail** | only bytes cross (`stringify → parse → receiver`); includes tamper, wrong key, missing key, over-cap status, v2 profile |
| `tests/e2e-jsdom.js` | **0 fail** | real patched pages: all five boot with the dock; Bench's own verify flow produces a receipt; its signature verifies under an independent Ed25519; a fresh Press page imports it as `INTEGRITY_VALID`, rejects it with `REJECTED_SIGNATURE_UNRESOLVED` when the key is absent, never reports `VERIFIED`; Field/Fire/Forge/Press seeded stores export packages an independent receiver accepts |
| `tests/bench-ed25519-check.js` | original Bench fails both own and OpenSSL verification; patched passes both | E-05 evidence |
| Core primitives | SHA-256, Ed25519 and RFC 8785 key order agree with Node | |

Fixes made to my own work during testing: `receive()` mis-coded a missing `envelope_version` as an unsupported version; `seal()` stopped Forge/Field from writing the PARSED transition records they need as receivers; the Bench display patch produced a syntax error (caught by jsdom, then a syntax gate added to the build).

## 8. Assumptions

- Operator id is typed once per environment and stored locally; there is no identity provider.
- Fire's `summary.result` is `FAILED` if any case failed, `PASSED-UNDER-CONDITIONS` only if every case ran and passed, otherwise `INCONCLUSIVE`. Fire does not define this.
- Envelope status exported by a producer is capped per environment (Forge/Field `DRAFT`, Fire/Press `INTEGRITY_VALID`, Bench up to `VERIFIED` only for a `PROVEN` receipt); receivers never rely on it.
- "Mount under one roof" is delivered as a descriptor plus a contract, because the orchestrator was not visible. Nothing in `dist/` calls it.
