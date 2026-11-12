# VVU VOCABULARY GLOSSARY

**Ref:** VVU-GLOSS-2026-001
**Version:** 1.0
**Date:** 15 October 2026
**Status:** Architecture (specified, not implemented)
**Parent:** VVU-SF-2026-001 (Shared Foundation)
**Governs:** Forge · Bench · Fire · Field · Press

---

## 0. Why this document exists

Three environments each produce a word meaning "we checked and it held." They are not synonyms.

Bench's **PROVEN**, Fire's **PASSED-UNDER-CONDITIONS**, and Field's **VALIDATED_BY_RECEIVER** make three different claims under three different conditions. Any one of them read as another produces a false statement in a publication — the exact failure mode the Oracle Boundary exists to prevent.

This document pins the words. Where any other estate document disagrees, this one governs. Every environment prompt should carry the line: *Vocabulary governed by VVU-GLOSS-2026-001.*

---

## 1. Tier labels

| Label | Means | Evidence required |
|---|---|---|
| **Reality** | Observed. It happened and a record exists. | Signed artefact, commit, test report, measurement |
| **Architecture** | Specified. Designed, not built. | Written spec, design record |
| **Hypothesis** | Under test. Protocol exists, results pending. | Protocol + pending results |
| **Vision** | Intent. Stated as intent. | Statement of intent |

**Superseded labels — do not use:** `Tier 1 / 2 / 3 / 4` as used in the estate mindmap (Branch 9) and implied in VVU-SF-2026-001 §0.

| Old | New |
|---|---|
| Tier 1 — observed | **Reality** |
| Tier 2 — specified | **Architecture** |
| Tier 3 — hypothesis | **Hypothesis** |
| Tier 4 — vision | **Vision** |

Every artefact's `tier_tag` uses these four words. No numeric tier appears in any output.

---

## 2. Five vocabularies, five layers

The estate runs **five distinct status vocabularies**. They describe different things and must never be merged. This is the single largest drift risk in the estate, because all five contain words like "valid", "verified", and "accepted."

| # | Vocabulary | Owner | Describes | Values |
|---|---|---|---|---|
| **V1** | **Envelope status** | VVU-SF-2026-001 §5 | Processing state of the artefact *object* | `DRAFT` `IMPORTED` `PARSED` `INTEGRITY_VALID` `VERIFIED` `REJECTED` `BLOCKED` `EXPIRED` `SUPERSEDED` `WITHDRAWN` |
| **V2** | **Bench import status** | Bench | The receiving path for any incoming artefact | `IMPORTED` `PARSED` `INTEGRITY_VALID` `VERIFIED` `REJECTED` |
| **V3** | **Bench outcome** | Bench | The *finding* of a verification | `PROVEN` `INCONCLUSIVE` `NOT_PROVEN` `BLOCKED` |
| **V4** | **Fire outcome** | Fire | The *finding* of a test case | `PASSED-UNDER-CONDITIONS` `FAILED` `INCONCLUSIVE` `BLOCKED` `SKIPPED-BY-ASSET-ABSENCE` |
| **V5** | **Field delivery status** | Field | Transport state of an *observation* | `RECORDED_LOCALLY` `QUEUED_FOR_EXPORT` `TRANSMITTED` `ACCEPTED_BY_RECEIVER` `VALIDATED_BY_RECEIVER` |

**V1 is the coarsest and is the only one written into `envelope.status`.** V2 is a subset of V1 used on the receive path. V3–V5 live inside `content` and are never written to `envelope.status`.

---

## 3. The three outcome words

| Word | Env | Asserts | Does **not** assert | Envelope status it may carry |
|---|---|---|---|---|
| **PROVEN** | Bench | The specified evidence supports the specified claim under the named policy. | That the claim is true in the world. That the sensor was honest. That unlisted checks ran. | `VERIFIED` |
| **PASSED-UNDER-CONDITIONS** | Fire | No failure observed on the registered inputs under the stated conditions. | Safety. Correctness on other inputs. That the target is good. | `INTEGRITY_VALID` at most. **Never `VERIFIED`.** |
| **VALIDATED_BY_RECEIVER** | Field | The receiver issued a record acknowledging this `observation_id`. | Bench `VERIFIED`. That the reading was true. That calibration was valid. | `PARSED` at most. **Never `VERIFIED`.** |

### Shared words, per vocabulary

| Word | V1 envelope | V3 Bench | V4 Fire | Meaning |
|---|---|---|---|---|
| `INCONCLUSIVE` | ✗ | ✓ | ✓ | Checked; evidence insufficient to decide. Requires reason code + non-empty `limitations`. |
| `NOT_PROVEN` | ✗ | ✓ | ✗ | A mandatory policy condition was unsatisfied. **Not** "false." |
| `BLOCKED` | ✓ | ✓ | ✓ | Could not run. Dependency unavailable, input missing, scope unauthorised. **Never a negative result.** |
| `FAILED` | ✗ | ✗ | ✓ | Observed behaviour violated the registered expectation. Counterexample attached. |
| `SKIPPED-BY-ASSET-ABSENCE` | ✗ | ✗ | ✓ | Case asset missing at inventory time. Not a pass, not a fail. |
| `REJECTED` | ✓ | ✗ | ✗ | Processing failure. Terminal. Distinct from `NOT_PROVEN`. |
| `VERIFIED` | ✓ | — | — | Strongest envelope status. Requires a policy check. Never assigned by an integrity check or a version match. |

---

## 4. The mapping rule

> **An artefact's envelope status never encodes its finding.**

The finding lives in `content`, on the artefact that *performed* the check. The envelope status describes the artefact *object* — is it intact, signed, parseable, superseded.

| Artefact | `content` finding | `envelope.status` |
|---|---|---|
| `test_report`, all cases FAILED | `summary.result: FAILED` | `INTEGRITY_VALID` — the report is intact; it is the **target** that failed |
| `verification_receipt`, outcome INCONCLUSIVE | `outcome: INCONCLUSIVE` | `INTEGRITY_VALID` — the receipt is a valid record of an inconclusive check |
| `observation`, sensor FAULT | `sensor_state: FAULT` | `INTEGRITY_VALID` — the observation is a valid record of a faulty reading |
| `publication`, linked receipt INCONCLUSIVE | `referenced_artefacts[].outcome` | `INTEGRITY_VALID` — the publication is intact; the claim it represents is not established |

**Consequence:** a consumer reading only `envelope.status` learns nothing about whether anything passed. It must read `content`. This is deliberate. A summary that collapses the two is the failure the Oracle Boundary warns about.

### Field delivery status → envelope status

| Field delivery | Envelope equivalent |
|---|---|
| `RECORDED_LOCALLY` | `DRAFT` |
| `QUEUED_FOR_EXPORT` | `DRAFT` |
| `TRANSMITTED` | `IMPORTED` |
| `ACCEPTED_BY_RECEIVER` | `PARSED` |
| `VALIDATED_BY_RECEIVER` | `PARSED` — **not** `VERIFIED` |

Field's five statuses are a finer-grained transport view. They collapse upward into V1; they never replace it.

---

## 5. Banned words and permitted replacements

These four never appear in any estate output, including drafts, subject lines, log messages, and code comments:

**unassailable · fully operational · production-ready · certified**

| Instead of | Write |
|---|---|
| "unassailable" | "checked against the spec" |
| "fully operational" | "measured" / "tested" |
| "production-ready" | "tested under stated conditions" |
| "certified" | "independently reviewed" |

---

## 6. Defects found in VVU-SF-2026-001

Building this glossary exposed three defects in the shared foundation specification. Each is recorded here with the required amendment. None is silently corrected.

### D-GLOSS-01 — Tier labels undefined, two sets in circulation

**Found in:** VVU-SF-2026-001 §0 ("Tier discipline applies to this document").
**Problem:** The specification invokes tier discipline without defining the labels. The estate mindmap uses `Tier 1–4`; the environment prompts use `Reality / Architecture / Hypothesis / Vision`. Two sets circulate and neither is authoritative.
**Amendment:** §0 of VVU-SF-2026-001 is amended to read: *"Tier labels are defined in VVU-GLOSS-2026-001 §1. The numeric labels are withdrawn."*
**Fixed by:** §1 of this document.

### D-GLOSS-02 — Two finding words occupy envelope status slots

**Found in:** VVU-SF-2026-001 §5.1 and §5.2.
**Problem:** `INCONCLUSIVE` and `NOT_PROVEN` are listed as envelope statuses reachable from `INTEGRITY_VALID`. They are *findings*, not processing states. Allowing them in the envelope invites a `test_report` or a `claim` to be relabelled `INCONCLUSIVE`, which erases the distinction between "this artefact is intact" and "this check was inconclusive." It also forces Fire's `FAILED` and `SKIPPED-BY-ASSET-ABSENCE` — which have no envelope slot at all — into an awkward position.
**Amendment:** §5.1 is amended to remove `INCONCLUSIVE` and `NOT_PROVEN` from the envelope vocabulary. They become Bench outcomes (V3), carried in `content.outcome`. The transition table in §5.2 loses the two rows `INTEGRITY_VALID → INCONCLUSIVE` and `INTEGRITY_VALID → NOT_PROVEN`. `BLOCKED` is retained in V1 because it describes a processing stall, not a finding.
**Consequence:** VVU-SF-2026-001 §5.4's requirement that `limitations` be non-empty for `INCONCLUSIVE`, `NOT_PROVEN`, and `BLOCKED` is retained, and now applies to the artefact whose `content` carries the finding.

### D-GLOSS-03 — `status_transition` occupies an artefact-type slot

**Found in:** VVU-SF-2026-001 §3 and the companion JSON Schema `enum`.
**Problem:** `status_transition` is listed alongside ten artefact types. It is a record, not an artefact type: it has no independent lifecycle, is never superseded, and its `provenance.inputs` is structurally always the single artefact it transitions. Consuming a type slot for it also forces every consumer to handle a "type" that is really an event.
**Amendment:** `status_transition` is removed from the `artefact_type` enum and defined as a standalone record format in §5.5, as that section already describes. The companion schema's enum drops the value; a separate `vvf-status-transition.schema.json` should be produced.
**Consequence:** the artefact type registry returns to ten types.

---

## 7. Confirmation requested on the Field fifth failure semantic

The Field prompt asks whether *sensor FAULT / calibration expired* is the correct fifth failure semantic, given that the source material lists only four situations (offline, service unavailable, recovery, handoff).

**Confirmed.** The four source situations are all **availability** semantics — they concern whether the environment can run. The fifth is a **data-quality** semantic — it concerns whether a captured value is trustworthy. They are different classes:

| Class | Concern | Example |
|---|---|---|
| Availability | Can Field keep working? | Offline, service down, power loss, restart |
| Data quality | Is this reading trustworthy? | Sensor FAULT, calibration EXPIRED |

Collapsing them would put a faulty reading and a network outage in the same bucket, and both would resolve to "record it and move on." They must not: an availability failure preserves a *good* reading for later delivery, while a data-quality failure preserves a *flagged* reading that must never be silently promoted to good. Keep it as the fifth.

---

## 8. Operator decisions — not resolvable here

These remain with the operator and are marked accordingly in the environment prompts:

| # | Decision | Marked as |
|---|---|---|
| 1 | Bench external anchor target: Base/Arbitrum calldata or Trillian CT log | `BLOCKED-WITH-REASON: operator decision` |
| 2 | Field live-phone verification | `BLOCKED: operator gate` |
| 3 | Build order across the five environments | Fire first, then Forge — unchanged |

---

*End of VVU-GLOSS-2026-001. Three amendments to VVU-SF-2026-001 are required and are recorded in §6 rather than applied silently.*
