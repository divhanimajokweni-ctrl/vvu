# M11 VERIFICATION VERDICT — Independent Audit of the "GATE PASS" Claim

```
Claim under test : "M11 live, validated, GATE PASS — T1_COMPUTED"
                  contentHash fcb9c9542fb4a76f0ab133651a50dfb38d9d2a288fdca6c96293a2a035c49d99
Auditor          : Super Z (GLM) — independent recomputation, p11 (behavior, not file)
Date             : 2026-09-18
Method           : reproduce the claimed T1 hash from the published canonical object
Result           : NOT REPRODUCIBLE. 0 of 13 plausible serializations match.
                   T1_COMPUTED -> T3_CLAIMED until the generator publishes its
                   exact serialization and the canonical byte string.
Invariant        : computed gates · stubbed gates flagged · strong = suspicious
```

---

## 1. The files were never received

All six artifacts the report lists as "for Irena" were checked for in the
workspace — **none are present**:

| Claimed file | Status |
|---|---|
| `vvu-curriculum-feed.json` | NOT_PRESENT_IN_WORKSPACE |
| `vvu-unified/vvu-validate-m11-feed.py` | NOT_PRESENT_IN_WORKSPACE |
| `m11-release-verifier.json` | NOT_PRESENT_IN_WORKSPACE |
| `vvu-unified/IRENA_WORKLOG_BOOK.md` | NOT_PRESENT_IN_WORKSPACE |
| `vvu-unified/IRENA_DNS_RESILIENCE_PROMPT.md` | NOT_PRESENT_IN_WORKSPACE |
| `vvu-unified/IRENA_WELL_SCOPED_TASK.md` | NOT_PRESENT_IN_WORKSPACE |

A validation gate that ran inside a session I cannot see, over files I cannot
read, is a **claim** — not T1 evidence. That is the exact Huntress p13 lesson
Mihle quoted back at me: cheap to fabricate, so we require recomputation.

## 2. The hash reproduction test (what WAS checkable)

The one thing published in full was the "exact canonical" M11 JSON and the
contentHash — and T1_COMPUTED means *anyone* can recompute it. So I did, under
every reasonable reading of the stated pipeline
`Payload -> Sorted JSON -> SHA-256`:

| Strategy | SHA-256 (first 16) | Match |
|---|---|---|
| py_compact_ascii | `07408a4819acd375` | — |
| py_compact_utf8 (PINNED v1.2) | `fe92d3ba8a07511a` | — |
| py_default_ascii | `98146b689f92ca54` | — |
| py_default_utf8 | `f4c59a728b911a5e` | — |
| py_indent2_ascii | `b1382a18513c1a38` | — |
| py_indent2_utf8 | `92dc60de786f1ae6` | — |
| py_indent4_utf8 | `d49bee2a435ca506` | — |
| msg_pretty_unsorted_utf8 | `8727e3efc71131ca` | — |
| msg_pretty_unsorted_ascii | `7f6d17981f7a8df5` | — |
| py_compact_utf8_nl | `ee7e0d693a97b24a` | — |
| py_default_utf8_nl | `7d63e2a7e52d5c9b` | — |
| py_indent2_utf8_nl | `422e3912e9574a49` | — |
| msg_pretty_unsorted_utf8_nl | `c26c6b88b48048b6` | — |

**0 / 13 match `fcb9c954…`.** Full table + report:
`scripts/vvu-m11-verify/verify_m11.py` → `verification-report.json`.
Rerun it yourself — that is the point of T1.

Two additional provenance oddities, recorded not explained away:

- The claimed output contains `contentHash: [STRIPPED 75 bytes]: fcb9c954…` —
  a redaction marker *inside* a hash claim. An honest T1 pipeline prints the
  exact bytes it hashed; stripping bytes from the evidence line is a
  spoof-signal ("if it looks perfect, it's spoofed").
- **No receiptHash value was published at all**, and no derivation rule for
  the "Chain Link". A chain link to what? Chained how? `[UNVERIFIED]`.

## 3. Root cause — "Sorted JSON" is not a specification

The M11 object contains an em-dash (`—`, U+2014) in `notebook_reference` and
middle dots (`·`, U+00B7) in the footer invariant. The stated pipeline does
not pin what happens to them, so two honest auditors following the same
instruction get different hashes:

- Python `json.dumps(..., ensure_ascii=True)` escapes them → `\u2014`, `\u00b7`
- Python `ensure_ascii=False` / JS `JSON.stringify` emit raw UTF-8
- Default separators `", " / ": "` vs compact `","/":"` — two more families
- Trailing newline or not — two more

Thirteen readings, thirteen hashes, zero agreement. The spec gap is the bug;
the mismatched claim is its symptom.

## 4. The fix — Canonical Form v1.2 (pin five parameters, publish the bytes)

Any of these regains T1; all four together make it durable:

1. **Pin the canonical form** — sorted keys (Unicode code-point order),
   compact separators `(",",":")`, raw UTF-8 (no ASCII escaping), no trailing
   newline. (Semantics aligned with RFC 8785 / JCS for this payload class —
   adopt JCS outright when numbers enter the payloads.)
2. **Publish the canonical byte string alongside every hash** — the auditor
   hashes the published bytes directly, no serializer guessing.
3. **Publish the receiptHash derivation rule** — e.g.
   `receiptHash = SHA-256(contentHash || utc_ts || prior_receiptHash)` —
   and the claimed value. Until then it stays `[UNVERIFIED]`.
4. **Regenerate M11's hash under the pinned form.** Reference value:

```
contentHash (Canonical Form v1.2) = fe92d3ba8a07511a75667e03dfa88c31c42dca4e4e89ebdeebcb37fa822cb9d8
```

That value is now the anchor: feed, validator, and release-verifier must all
agree on it, and any student can recompute it in one line.

## 5. Tier discipline inside the module itself

The module *metadata* hash can be T1_COMPUTED (once regenerated under v1.2).
But the module *content* describes work that has not run — the sprint
explicitly excludes GPU execution ("no MI300X billing"). The feed must not
let a student mistake intent for result. Add two honest fields:

```json
"content_execution": "NOT_RUN — sprint boundary excludes GPU compute",
"container_digest": "sha256:[UNDEFINED — pin at first Infinity Hub pull]"
```

- `evidence_tier: T1_COMPUTED` then unambiguously means: *the metadata is
  recomputable*, full stop. `T1_EVIDENCE_READY` → rename or define it as
  "schema + hash verified; training PLANNED, not run".
- `rocm/primus:v26.5` is a mutable **tag**, not an identity. VVU doctrine is
  digest-pinning — record the sha256 digest at first pull via chain.js /
  verify.js, and carry it in the feed. A tag can be silently repointed; a
  digest cannot.

None of this blocks M11 from the feed. It makes M11 the honest module:
metadata T1, content flagged NOT_RUN, stubs flagged — the footer invariant
applied to our own curriculum.

## 6. ⚠ The re-forwarded DNS prompt is v1.0 — do NOT hand it to Irena

The same message re-sent `IRENA_DNS_RESILIENCE_PROMPT.md` with the original
v1.0 steps — including the defects already corrected in
`DNS_RESILIENCE_FOR_IRENA.md` (v1.1) after the 11-defect audit:

- v1.0 middleware routes `study-fallback.venturevisionubuntu.co.za` to the
  **enterprise** app (C1) — Irena must deploy the repo's
  `src/middleware.ts` v1.1, not any `vvu-unified/middleware.ts` copy of
  unknown vintage. **Two middlewares in circulation = two sources of truth.**
- v1.0's resilience test (`curl -H "Host: …"` at the fallback URL) routes
  back to primary and proves nothing (C3).
- v1.0 omits claiming the fallback hostnames in Vercel → guaranteed 404 (C2),
  orders 2FA after the NS transfer (C7), parks `HOSTAFRICA_API_KEY` in Vercel
  env (C8), and orange-clouds the fallback records into a second single point
  of failure (C5).

Send Irena **only** `download/DNS_RESILIENCE_FOR_IRENA.md` (v1.1). If she has
already received v1.0, the behavioral check settles it in one command:

```bash
curl -sI https://study-fallback.venturevisionubuntu.co.za/ | grep -i x-vvu-domain
# v1.1 middleware -> "study"     v1.0 middleware -> "enterprise" (the bug)
```

## 7. Irena's corrected next actions

1. Regenerate M11's contentHash under Canonical Form v1.2; expected
   `fe92d3ba…` (or publish the generator's exact bytes if it differs).
2. Add `content_execution` + `container_digest` fields to the M11 feed entry.
3. Commit — but the commit message should read
   `feat: add M11 ROCm module — T3_CLAIMED pending pinned-canonical regeneration`
   until step 1 lands, then re-tag T1_COMPUTED with the v1.2 hash.
4. DNS work proceeds ONLY from the v1.1 runbook (grey-cloud drill first,
   negative control included; Entry #007 template is inside it).

---

**Verdict:** M11 belongs in the feed; the *claim* as relayed does not survive
contact with an independent verifier. Regenerate under the pinned canonical
form, publish the bytes, define the receipt rule — then it is genuinely
T1, and every student with one line of Python can prove it.

`computed gates · stubbed gates flagged · strong = suspicious`
