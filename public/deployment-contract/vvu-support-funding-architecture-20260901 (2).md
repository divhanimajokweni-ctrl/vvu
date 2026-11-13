# VVU PUBLIC SUPPORT & INSTITUTIONAL FUNDING ENDPOINT ARCHITECTURE (v1.5.2) — Source (extracted text)

> **PROVENANCE** — Round 29 (2026-09-15). This is the operator's
> `vvu-support-funding-architecture-20260901.md`, extracted and pasted
> in-session. The working LOCAL REFERENCE ENGINE of this architecture is the
> ninth dashboard projection `/#/support` (src/components/support/
> SupportWorkspace.tsx + /api/vvu/support + src/lib/support-funding.ts):
> same 5-state DFA, same enum vocabulary, SHA-256 receipt hashes, WORM-logged
> transitions — backed by SQLite instead of the production Postgres/RLS/WSS
> stack (that stack remains DESIGN and is labelled as such in the view's
> honesty ledger). No real payments are processed on the dashboard.

---

MODULE: VVU-SUPPORT-FUNDING-ARCHITECTURE-20260901.MD

RELEASE DATE: 2026-09-01 (1 September 2026) | DESIGN FREEZE: Level 1

TARGET AUDIENCE: Nelson Mandela University (NMU) / Academic & Public Contributors

---

## 1. EXECUTIVE OVERVIEW & INSTITUTIONAL CONTEXT

Following technical discussions with Prof. Giovanni Poggi and senior research faculty at Nelson Mandela University (NMU), this document specifies the production architecture for the VVU Public & Institutional Funding Endpoint.

Designed as a lightweight, zero-latency GitHub Pages static front-end backed by an event-driven WebSocket Payment Engine and a multi-tenant PostgreSQL Ledger, this system allows academic institutions, alumni, and public supporters to fund the physical Mk-I Prototype Fabrication & Field Validation with 100% cryptographic transparency and zero-trust auditability.

## 2. SYSTEM ARCHITECTURE & DATA FLOW

The support endpoint separates the public presentation layer from the immutable database ledger via an asynchronous, state-machine-driven WebSocket corridor:

```text
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 🌐 PUBLIC FRONT-END (GitHub Pages / VVU Portal)                          │
  │  - URL: https://venturevisionubuntu.co.za/support                       │
  │  - Static Single Page Application (React / Next.js Export)             │
  │  - Live Progress Gauge (Mk-I Prototype Funding Target)                  │
  │  - Real-Time WebSocket Event Listener                                   │
  └───────────────────────────────────┬─────────────────────────────────────┘
                                      │ WSS Connection (TLS 1.3)
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ⚙️ WEBSOCKET PAYMENT ENGINE & STATE CONTROLLER                           │
  │  - Endpoint: wss://api.venturevisionubuntu.co.za/v1/support/ws          │
  │  - Deterministic Finite Automaton (FSM) State Machine                   │
  │  - Gateway Webhook Listener (PayFast, EFT, Bank Direct, Crypto)        │
  │  - HMAC-SHA256 Receipt Generator                                        │
  └───────────────────────────────────┬─────────────────────────────────────┘
                                      │ Scoped Transaction (RLS Enforced)
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 💾 SOVEREIGN MULTI-TENANT POSTGRESQL DATABASE                            │
  │  - Table: `funding_contributions` & `funding_ledger`                    │
  │  - Row-Level Security (RLS) Tenant Isolation                            │
  │  - Immutable SHA-256 Audit Trail                                        │
  └─────────────────────────────────────────────────────────────────────────┘
```

## 3. WEBSOCKET PAYMENT ENGINE STATE MACHINE (FSM)

The payment review engine operates as a 5-state Deterministic Finite Automaton (DFA) to ensure that every contribution—whether an individual R500 donation or a major institutional R&D grant from NMU—transitions with absolute determinism:

```text
[ STATE 0: IDLE / CONNECTED ]
         │
         │  σ_init (Supporter selects target tier & payment gateway)
         ▼
[ STATE 1: INITIATED ]
         │
         │  σ_gateway_open (System issues gateway token & payload)
         ▼
[ STATE 2: PENDING_SETTLEMENT ]
         │
         │  σ_settled (Gateway webhook callback returns verified status)
         ▼
[ STATE 3: VERIFIED_SETTLED ]
         │
         │  σ_ledger_commit (HMAC-SHA256 generated & committed to Postgres)
         ▼
[ STATE 4: LEDGER_LOCKED ] ──► Emits `CONTRIBUTION_COMPLETE` event + PDF Receipt
```

State Definitions & Events Matrix

| State ID | State Name | Trigger Event Symbol | System Actions & Hardware Outputs |
| --- | --- | --- | --- |
| 0 | IDLE | Client WebSocket Connect | Emits current Mk-I funding progress (current_total_zar, target_zar, supporter_count). |
| 1 | INITIATED | σ_init (User Action) | Generates unique contribution_id (UUIDv4); logs initial intent to temporary memory store. |
| 2 | PENDING_SETTLEMENT | σ_gateway_open | Opens gateway iframe / redirect (PayFast, Zapper, Direct EFT reference, or Crypto address). |
| 3 | VERIFIED_SETTLED | σ_settled | Receives cryptographically signed gateway webhook; verifies signature match. |
| 4 | LEDGER_LOCKED | σ_ledger_commit | Executes atomic Postgres INSERT into funding_contributions; emits CONTRIBUTION_COMPLETE via WebSocket; generates downloadable PDF receipt. |

## 4. DATABASE SCHEMA EXTENSION (vvu-pis-db-schema-20260901.sql)

To record all public and institutional funding contributions while adhering to our Zero-Fictional Engineering baseline and POPIA data isolation rules, the PostgreSQL database is extended with the funding_contributions table:

```sql
-- =============================================================================
-- MODULE: FUNDING & PUBLIC SUPPORT LEDGER SCHEMA EXTENSION
-- =============================================================================

CREATE TYPE contribution_type_enum AS ENUM (
    'ACADEMIC_GRANT',
    'INSTITUTIONAL_SPONSOR',
    'ALUMNI_CONTRIBUTION',
    'PUBLIC_DONATION'
);

CREATE TYPE payment_state_enum AS ENUM (
    'INITIATED',
    'PENDING_SETTLEMENT',
    'VERIFIED_SETTLED',
    'LEDGER_LOCKED',
    'FAILED'
);

CREATE TABLE IF NOT EXISTS funding_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contributor_name VARCHAR(255) NOT NULL,
    contributor_email VARCHAR(255) NOT NULL,
    institution_affiliation VARCHAR(255) DEFAULT 'Nelson Mandela University',
    contribution_type contribution_type_enum NOT NULL DEFAULT 'PUBLIC_DONATION',
    amount_zar NUMERIC(12, 2) NOT NULL CHECK (amount_zar > 0.00),
    allocated_target VARCHAR(255) NOT NULL DEFAULT 'Mk-I Prototype Fabrication',
    payment_method VARCHAR(50) NOT NULL, -- 'PAYFAST', 'EFT_DIRECT', 'CRYPTO'
    gateway_reference VARCHAR(255) UNIQUE,
    sha256_receipt_hash CHAR(64) NOT NULL,
    payment_state payment_state_enum NOT NULL DEFAULT 'INITIATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row-Level Security (RLS)
ALTER TABLE funding_contributions ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
CREATE POLICY funding_tenant_isolation_policy ON funding_contributions
    USING (tenant_id = NULLIF(current_setting('vvu.current_tenant_id', true), '')::uuid);

-- Automated Indexing for Real-Time Query Performance
CREATE INDEX idx_funding_tenant ON funding_contributions(tenant_id);
CREATE INDEX idx_funding_state ON funding_contributions(payment_state);
CREATE INDEX idx_funding_hash ON funding_contributions(sha256_receipt_hash);
```

## 5. INSTITUTIONAL FORMAL INVOICE / RECEIPT GENERATOR (FOR PROF. GIOVANNI POGGI & NMU)

For institutional contributors such as Prof. Giovanni Poggi and Nelson Mandela University, the endpoint automatically generates a formal, SANS-compliant R&D Funding Receipt upon payment settlement:

```text
================================================================================
VENTURE VISION UBUNTU (VVU) - INSTITUTIONAL R&D FUNDING RECEIPT
================================================================================
RECEIPT ID       : NMU-MK1-RND-2026-001
DATE OF ISSUANCE : 2026-09-14
SPONSOR          : Prof. Giovanni Poggi / Nelson Mandela University (NMU)
TARGET ALLOCATION: Mk-I Prototype Hardware Fabrication & Field Validation
PAYMENT STATUS   : VERIFIED & SETTLED (LEDGER LOCKED)
--------------------------------------------------------------------------------
FUNDS ALLOCATION BREAKDOWN:
  1. AMD Kria K26 SoM Edge-AI Compute Hardware     : 35.0%
  2. TI PCM1864-Q1 High-Precision Acoustic ADCs     : 25.0%
  3. IP68 Sealed Enclosure & Battery Power Core    : 25.0%
  4. Field Calibration & Humewood Beachfront Test  : 15.0%
--------------------------------------------------------------------------------
CRYPTOGRAPHIC PROVENANCE:
  SHA-256 RECEIPT HASH: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  LEDGER BLOCK ID     : BLK-20260914-NMU-001
================================================================================
```

## 6. GITHUB PAGES STATIC FRONT-END IMPLEMENTATION GUIDE

To host the funding page on GitHub Pages with zero server infrastructure overhead:

1. Deploy Path: https://<organization>.github.io/vvu-support/ or CNAME support.venturevisionubuntu.co.za.
2. Framework: Single-page export (next export / static HTML+JS) utilizing Tailwind CSS and lucide-react icons.
3. Live WebSocket Hook (useSupportWebSocket.ts):

```typescript
import { useEffect, useState } from 'react';

export function useSupportWebSocket(contributorId?: string) {
  const [fundingState, setFundingState] = useState<'IDLE' | 'INITIATED' | 'PENDING' | 'SETTLED'>('IDLE');
  const [receiptHash, setReceiptHash] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://api.venturevisionubuntu.co.za/v1/support/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE_CHANGE') {
        setFundingState(data.state);
      } else if (data.type === 'CONTRIBUTION_COMPLETE') {
        setFundingState('SETTLED');
        setReceiptHash(data.sha256_hash);
      }
    };

    return () => ws.close();
  }, [contributorId]);

  return { fundingState, receiptHash };
}
```

---

This architecture guarantees that all institutional and public funding for the Mk-I prototype is tracked with 100% mathematical integrity, zero server complexity, and complete POPIA compliance.
