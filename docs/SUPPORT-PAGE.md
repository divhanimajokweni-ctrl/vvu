<!-- vvu.authority.support-page.v1 · version 2026-09-30 · revision 1
     last_written_by: main-runner · last_written_at_utc: 2026-09-30T00:06:00Z
     note: The support page spec — saved, not built (per TASKS-MAIN Today-2:
     "Do not build it yet. Just save it."). Facts below are measured from the
     real support-funding engine on this box. Everything unmeasured is
     TO_BE_FILLED — never invented. Money is ZAR. -->

# SUPPORT-PAGE.md — the public support page spec

One page. Plain voice. It says what VVU is building, what the money
buys, and takes exactly one action. The engine behind it already runs
on this box — the page is its front door.

**Status: SPEC SAVED. The page itself is not built (by instruction).
The funding engine beneath it is REAL and measured (see below).**

---

## What the page must do (in order, top to bottom)

1. **Say what VVU is, in one sentence a plumber understands.**
   Water infrastructure monitoring that shows its evidence — every
   alert becomes a receipt nobody can quietly rewrite.

2. **Say what the money buys.** The Mk-I allocation is real and
   measured from the funding engine (`src/lib/support-funding.ts`):
   - AMD Kria K26 SoM edge-AI compute hardware — 35%
   - TI PCM1864-Q1 high-precision acoustic ADCs — 25%
   - IP68 sealed enclosure & battery power core — 25%
   - Field calibration & Humewood beachfront test — 15%

3. **Show the honest layer table.** The funding engine publishes its
   own honesty list (`SUPPORT_HONESTY`): what is REAL (the 5-state
   payment engine, SHA-256 receipt hashes, the SQLite contribution
   ledger, WORM events on every transition), what is a LOCAL REFERENCE
   (the gateway webhook simulation), and what is DESIGN (the static
   front-end, the WSS corridor, multi-tenant PostgreSQL). The page
   shows this list as-is. No layer is ever dressed up as more than it
   is.

4. **Offer the contribution types that actually exist in the engine:**
   academic grant, institutional sponsor, alumni contribution, public
   donation.

5. **End with ONE action** — the support button. Not a menu.

## The engine the page talks to (measured, REAL, on this box)

- `src/app/api/vvu/support/route.ts` + `src/lib/support-funding.ts`
  implement the VVU PUBLIC SUPPORT & INSTITUTIONAL FUNDING ENDPOINT
  ARCHITECTURE v1.5.2 (2026-09-01, design freeze Level 1) as a local
  reference engine.
- Server-authoritative 5-state DFA: INITIATED → PENDING_SETTLEMENT →
  VERIFIED_SETTLED → LEDGER_LOCKED (immutable), FAILED. Illegal jumps
  are rejected with 409.
- Receipts: SHA-256 hashed server-side over the canonical receipt at
  ledger commit. UUIDv4 contribution IDs.
- Payment methods the engine models: PayFast, direct EFT reference,
  crypto address.
- Every transition is a WORM event in the estate ledger.

## Rules for the page (from VOICE.md and TASKS-MAIN.md)

- Plain voice. Plumber test. Every word.
- One action per ending. The support button is the only action.
- ZAR. Real numbers only — measured or absent.
- Never "validated", "certified", "compliant", "regulatory approved".
- The honesty table is shown, never trimmed.

## TO_BE_FILLED (unmeasured facts — the operator holds these)

- Funding target amount (ZAR): **TO_BE_FILLED** — no target figure
  exists anywhere on this box.
- Launch date: **TO_BE_FILLED**.
- Hosting: the architecture doc designates GitHub Pages static
  deploy at support.venturevisionubuntu.co.za — the domain is NOT yet
  registered (measured, per the engine's own DESIGN layer note).
- Real payment gateway credentials (PayFast merchant, EFT banking
  details, crypto addresses): **TO_BE_FILLED** — no real gateway keys
  exist on this box; the engine's gateway step is an operator-advanced
  simulation and the page must say so until real keys exist.
- Legal entity name and registration number for the footer:
  **TO_BE_FILLED**.

## Change law

This spec changes through one commit with the reason stated in the
worklog. When the page is built, it is built against this file — and
every TO_BE_FILLED that gets a value is named in the commit that
fills it.
