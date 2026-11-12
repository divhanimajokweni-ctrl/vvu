# CONSENT RECORD SPEC — NO MONEY WITHOUT RECORDED CONSENT

**STATUS: DRAFT — REVIEW REQUIRED (legal review pending, manifest L7).**
Prepared: 2026-09-16 · Day 1 of commercial operations

---

## 1. The rule

> **No money is taken without recorded consent from the customer.**

Not verbal-only. Not "they seemed fine with it." Not "the email thread implies it." A payment without a consent record is a process failure — full stop, and it is treated as a Class-B complaint against us if it ever happens.

## 2. The consent record

Created **before** any payment is requested or taken:

| Field | Requirement |
|---|---|
| `customer` | Registered name + contact (entity or person) |
| `offer` | Price-card row id (PC-01…PC-16) + the written offer reference |
| `price` | The price and payment terms exactly as presented |
| `consentStatement` | What the customer explicitly agreed to (quote or reference the confirmation) |
| `consentMethod` | Signed SOW / written confirmation (email counts) / recorded acceptance |
| `sowRef` | SOW reference — **mandatory when price ≥ R50,000** |
| `recordedBy` | The operator who took the consent |
| `recordedAt` | UTC timestamp |
| `wormReceiptId` | The WORM receipt id of the consent event itself |

## 3. Storage and proof

- The consent event is written to the WORM ledger (source: `COMMERCIAL`, event: `CONSENT_RECORDED`, details: customer + offer + price + method).
- The WORM receipt makes the consent tamper-evident and independently verifiable — the same standard as every other evidence in the estate.
- The consent record links bidirectionally: the invoice references it; it references the SOW; the SOW references the price card row.

## 4. Enforcement points

1. **Before payment request**: no consent record → no invoice is issued.
2. **Invoicing**: the invoice carries the consent record id.
3. **Disputes**: a billing dispute (Class B) is resolved against the consent record — not memory.
4. **Subscription renewals**: paid in advance requires a consent record per billing period (renewal consent can be standing, but must have been explicit and revocable).

## 5. Refusal and withdrawal

- A customer may withdraw consent at any time before payment; withdrawal is recorded the same way (WORM event).
- After payment, the refund path follows the Terms of Service §8.
- **Consent is never inferred from silence.**

## 6. Current state (honest)

- 0 consents exist — 0 customers exist. This spec is **defined and awaiting first real use**.
- The record structure is ready; the first real consent event will exercise it end-to-end, and any friction found will be fixed as a process bug, not patched by skipping the record.

---

*END OF DRAFT — REVIEW REQUIRED.*
