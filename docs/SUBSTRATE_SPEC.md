# SUBSTRATE SPEC — the five-object vocabulary

> Public boundary document for the **proofbridge-liner** repository.
>
> **Definition-only.** This document defines semantics and contracts. It
> intentionally contains **no algorithms, no internal scoring machinery, no
> production schemas, no deployment topology, and no client-specific
> evidence handling**. The substrate implementation is not part of this
> repository; this spec is the public statement of what the vocabulary
> *means*, so the specimen's boundary is understandable without the moat.

## 0. Formalisation status (honest, per object)

| Object | Status |
|---|---|
| **Verification** | Implemented in the substrate experiment (adjudication semantics §1) |
| **Receipt** | Implemented (append-only, hash-linked, re-verifiable records) |
| **Claim** | **Not formalised** — will emerge from running verticals, or not at all |
| **Obligation** | **Not formalised** — same rule |
| **Evidence** | **Not formalised** — same rule |

The claim/obligation/evidence layer is deliberately unbuilt: it gets
formalised only if two materially different domains running through one
substrate force it into existence. A diagram is not evidence.

## 1. The five objects

**Claim** — an assertion a party makes that can be adjudicated. A claim
names a subject, a predicate, and a reference to the evidence that would
settle it. A claim carries no truth value of its own; it is a question
posed to the verification layer.

**Obligation** — the declared standard a claim is held to: which checks must
run, in which direction, and at which band boundaries a verdict is
PASS / WARN / FAIL. Obligations are declarative — they state thresholds,
never procedures.

**Evidence** — the adjudicable material a domain produces: measured values
with units, plus instrument-sanity measurements about how those values were
obtained. Evidence is committed to the record; it is never evaluated in
place.

**Verification** — the act of adjudicating evidence against an obligation.
Each check resolves to exactly one verdict:

- **PASS** — the band was met,
- **WARN** — a finding, not a broken instrument,
- **FAIL** — the band was missed,

under **two-tier floors**: a check with a `pass`-floor escalates any
non-PASS to FAIL for the whole run (a barely-sane instrument is not a
usable instrument); a check with a `warn`-floor lets a WARN stand as a
recorded finding.

**Receipt** — the immutable record that a verification happened. Receipts
are append-only and hash-linked (each entry commits to its predecessor),
independently re-verifiable end-to-end, and **layerable**: a run may seal
the root of a lower chain inside its own. Receipts are the only
authoritative statement of what was verified — anything not in a receipt
did not happen.

## 2. The vertical contract

A domain (a **vertical**) supplies:

1. a set of **outcome checks** — declarative: identity, value, unit,
   direction, band boundaries, floor;
2. a set of **instrument-sanity control checks** — same shape; controls
   police the instrument, not the domain;
3. an **evidence payload** to commit;
4. optionally, the root of a lower chain to seal (layering).

The substrate guarantees, in return:

1. **Adjudication** — outcome and control checks are adjudicated by the
   same code path, for every vertical;
2. **Aggregation** — a worst-verdict run summary with escalation
   accounting;
3. **Canonical receipts** — one receipt shape for every vertical, each
   chain anchored to that vertical's own genesis;
4. **Purity** — the substrate core carries zero domain vocabulary. This is
   enforced mechanically: a word-boundary scan over the substrate's
   contracts fails the gate if any domain token appears.

## 3. The decisive acceptance test

Two materially different domains run through the same substrate. If the
core must grow per-domain variants — `FraudReceipt`, `HydraulicReceipt`,
`FraudVerificationResult`, … — the abstraction has failed and the substrate
must be **reworked, not decorated**. Domain-specific mathematics stays
inside the vertical; the verification lifecycle stays shared.

## 4. Out of scope (by design)

- **TrustState** — will be formalised, if at all, only from the state
  intersection of two running verticals.
- **IVE** (executor/viewer runtime) — explicitly not an acceptance
  criterion; relevant only after the substrate has earned existence.
- Any production schema, scoring algorithm, or deployment detail.
