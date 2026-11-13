# FIELD KIT: CAMPUS WALK — Source (extracted text)

> **PROVENANCE** — Round 29 (2026-09-15). This is the operator's `fieldkit.html`
> content, extracted to text and pasted in-session. The authoritative
> implementation is the eighth dashboard projection `/#/fieldkit`
> (src/components/fieldkit/FieldKitWorkspace.tsx + /api/vvu/fieldkit +
> src/lib/fieldkit.ts). No content was invented; the capture template became a
> working, persisted, WORM-logged form (the "people notes").

---

ProofBridge — Field Kit: Campus Walk

**Field Kit — ProofBridge Campus Walk**

Five-part field kit for lecturer conversations. Read between faculties; screenshot sections as needed.

## 1. The Leave-Behind

ProofBridge is a provenance-and-audit layer.

It records what happened in a system — a payment, a reading, a decision — as a cryptographic chain that any third party can verify without trusting the operator.

It does not detect lies. It makes it impossible to change the record after the fact. The bottleneck it removes is: "we can't prove what happened cheaply, portably, and across institutions that don't trust each other."

Show this. Don't explain it. Let them read it.

## 2. The Four Trust Bottlenecks

| Bottleneck | Plain meaning | Does ProofBridge help? |
| --- | --- | --- |
| Provenance | Where did this come from, and has it changed? | Yes — core strength. |
| Evidence capture | Was the ground truth recorded honestly? | Partially — catches tampering after the fact, can't stop a lying sensor. |
| Institutional trust | Do we trust who runs the system? | No — that's a governance problem, not a math problem. |
| Cost of verification | The check costs more than trusting. | Yes — one hash verify, microseconds. |

## 3. The Three Questions

**Q1** — "In your field, what's the single biggest thing people cannot verify that they wish they could?"

**Q2** — "When something goes wrong — a bad decision, a falsified record, a failure — how is it caught today, and who pays for that check?"

**Q3** — "If you had a system that made every step of that record tamper-evident and cheap to check — what would it have to prove to you, personally, before you'd trust it?"

Ask in this order. Write down every word of the Q3 answer.

## 4. The Capture Template

```
LECTURER: ________________________
FACULTY: _________________________
FIELD: ___________________________
DATE: ____________________________

Q1 — Biggest unverifiable thing:

Q2 — How failures are caught today / who pays:

Q3 — Their trust condition:
"I would trust this if _______________________"

DOMINANT BOTTLENECK (circle one):
provenance / evidence capture / institutional trust / cost of verification

WOULD THEY USE IT? (yes / no / maybe)

WHAT THEY OFFERED (lecture invite, intro, data, collaboration):

FOLLOW-UP ACTION:
```

## 5. The Faculty Map

| Faculty | Likely dominant bottleneck | What they'll probably say |
| --- | --- | --- |
| Law | Institutional trust | Chain of custody, evidence admissibility, "who signs the first link" |
| Medicine / Health Sciences | Evidence capture | Clinical trials, adverse events, "the sensor may lie" |
| Engineering | Provenance | Supply chains, component traceability, sensor calibration |
| Business / Commerce | Cost of verification | Audit fees, reconciliation overhead, "we already pay for this" |
| Humanities / Social Sciences | Institutional trust | Archival authenticity, contested narratives, "whose record is this?" |
| Computer Science | Provenance + cost | Distributed systems, trust assumptions, "why not X?" |
| Journalism / Media | Institutional trust | Source verification, "we can prove it wasn't edited, not that it's true" |
| Library / Information Science | Provenance | Archival integrity, chain of custody over long timespans |
| Environmental Science | Evidence capture | Sensor networks, water quality, calibration drift |
| Public Policy / Governance | Institutional trust + cost | Procurement, audit trails, "the check has to be affordable" |

## On the Horse Itself

You are carrying one paragraph (the leave-behind), one map (the taxonomy), and three questions.

The fraud harness, substrate, audit chain, dashboard, and R490 node are what you say if asked. They are not what you lead with.

The single most valuable thing to come back with is a stack of filled-in Q3 answers — the trust conditions lecturers name. Those are the design constraints for whatever ProofBridge becomes next.

## Before You Walk

Open your phone's camera. Photograph the faculty directory board if there is one. When you get back, you'll know exactly which faculties you hit and which you missed.
