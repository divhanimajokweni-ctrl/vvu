# B2B PILOT INTEGRATION — READINESS PLAYBOOK

**STATUS: DRAFT — REVIEW REQUIRED (feeds legal review; commercial terms cross-reference TERMS-OF-SERVICE.md schedules).**
Prepared: 2026-09-16 · target: pilot-readiness plans complete for the weekend's follow-ups

---

## 0. The gate before every pilot

No pilot starts without, in order:

1. **Consent record** (CONSENT-RECORD-SPEC.md) — no money without it
2. **Signed SOW** when ≥ R50k (one page: deliverable, date, price, payment terms, acceptance criteria)
3. **Payment per discipline** (50% upfront over R25k; subscriptions in advance)
4. **Named human counterpart** on the customer side — a pilot without a named owner is a demo, not a pilot

## 1. PILOT-CRYPTO — Crypto exchange detection pilot

**Price path**: PC-01 Discovery (R15k, 1 week) → PC-02 Pilot (R50k, 6 weeks) → PC-03 Monitoring (R5k/month) + PC-04/05 usage

**Readiness checklist**
- [ ] Compliance lead named (the five Day-1 drafts are already written — see `#/commercial`)
- [ ] Discovery week booked; R15k credited against the pilot if signed within 30 days
- [ ] 10 monitored addresses + 50-screen allowance agreed in writing
- [ ] Receipt delivery format agreed: SHA-256 receipt per screen, third-party verification path
- [ ] NDA signed before any customer data is discussed
- [ ] 6-week schedule locked: W1 discovery → W2–5 monitoring → W6 evidence report
- [ ] Exit criteria stated in the SOW: evidence report delivered, continue/cancel decision, no lock-in

**Integration surface** (what the customer side must provide)
- Address list + screening volume estimate; alert delivery channel (email/API); their dispute/audit process (receipts slot into it)

**What we prove**: every screening decision carries a tamper-evident receipt that survives audit and dispute — the differentiator vs score-only vendors.

## 2. PILOT-BANK — Bank / fraud sequence-anomaly pilot

**Price path**: PC-12 (R500k–R2M, integration-dependent)

**Readiness checklist**
- [ ] Warm intro secured — fraud team, not procurement cold-call
- [ ] Harness JSON (CAPITEC_R1B_SEQUENCE_ANOMALY_001) + one-page summary delivered under NDA
- [ ] 30-min call held; integration surface mapped
- [ ] Discovery scoping complete: data room, security review, test environment, timeline
- [ ] Success criteria defined in the SOW (sequence-anomaly detection in their pipeline)
- [ ] Evidence-layer demo delivered: receipt per screening decision

**Integration surface**
- Test environment access; fraud-pipeline data contract; their security review process and timeline; incident escalation contacts

**Honest limits to state upfront**: the harness proves the pattern is detectable; their integration proves it works at their volumes. The pilot is priced for exactly that work.

## 3. PILOT-IVE — IVE Workspace deployment

**Price path**: PC-06 Professional (R3k/month/workspace) / PC-07 Enterprise (R10k+/month)

**Readiness checklist**
- [ ] Workspace provisioned per customer; per-workspace pricing confirmed
- [ ] Onboarding + training session delivered (the M0 posture: operators inspect evidence, never trust screens)
- [ ] Subscription paid in advance
- [ ] Support + complaints channels live **before handover** (COMPLAINTS-PROCEDURE.md provisioning)
- [ ] Data export path demonstrated to the customer (lock-in is not the business model)

## 4. PILOT-WATER — Water infrastructure feasibility

**Price path**: PC-10 Study (R50k–R150k) → PC-11 Pilot (R250k–R1M site/scoped)

**Readiness checklist**
- [ ] Municipality named + stakeholder map (NMBM / Cape Town / Johannesburg Water)
- [ ] Feasibility scope agreed: data sources, site access, timeline
- [ ] Study sells first — the sensor network is the pilot's problem, not the study's
- [ ] Municipal procurement path identified (CSD registration feeds this — operator action)
- [ ] Study deliverable defined: findings + prioritized leak-detection plan with evidence

## 5. Cross-pilot operating rules

- The **operating sweep** covers every live pilot: monitoring, evidence, and escalation per `#/ops`.
- **Incidents** on a pilot go: sweep → exception → operator's phone-format notification → logged → remediated → receipted.
- **Every pilot ends with an evidence report** — including what the pilot did NOT establish. That report is the marketing asset for the next one.
- **No pilot scope change without a signed variation.** Scope creep is the pilot-killer; the SOW is the shield.

## 6. Current state (honest)

- 0 pilots running — 0 customers. These are **readiness plans**, not a pipeline of record.
- The five Day-1 email drafts (Luno, VALR, Standard Bank, FNB, Discovery) map to PILOT-CRYPTO ×2 and PILOT-BANK ×3 — sending them is the operator's weekend.

---

*END OF DRAFT — REVIEW REQUIRED.*
