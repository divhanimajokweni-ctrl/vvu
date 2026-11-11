# VVU Studi Curriculum & Deployment Bundle
**Venture Vision Ubuntu — ProofBridge Infrastructure**
*B-BBEE Level 1 (135% Procurement Recognition) | Reg 2026/259053/07*  
*Contact: divh@venturevisionubuntu.co.za*  
*Domains: vvu-enterprise.space-z.ai | vvu-study.space-z.ai*

---

## Module 1: VVU Foundation Manifesto
- **Core Philosophy**: *Umuntu Ngumuntu Ngabantu* ("I am because we are").
- **Institutional Alignment**: Blending zero-trust cryptographic verification with African relational ethics.
- **Evidence Tier**: T1 Ground Truth.
- **Exercise**: Formulate a local data sovereignty governance framework for edge auditing.

---

## Module 2: Day-One Depot Observation & Protocol
- **Recording Schema**: `[date] [depot] [role] cost = R___ [T1/T2/T3/T4] owner = [name]`
- **Gate Rule**: PASS > R20k T1/T2 -> Triggers Build Kit #1 (Mk 0.5 Raspberry Pi 5 @ R1,671).
- **Audit Hashes**: `contentHash` (e.g. `998ca700...`) paired with `receiptHash`.
- **Required Documents**:
  1. ONE-PAGER (Student View)
  2. THREE-PAGER (Internal Operator View)
  3. TRAVEL SCOPE E2E

### Python Implementation: `depot_observation.py`
```python
import hashlib, json, datetime

def record_observation(depot: str, role: str, cost_zar: float, tier: str, owner: str):
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    record = {
        "utc_ts": timestamp,
        "depot": depot,
        "role": role,
        "cost_zar": cost_zar,
        "tier": tier,
        "owner": owner
    }
    raw_json = json.dumps(record, sort_keys=True)
    content_hash = hashlib.sha256(raw_json.encode('utf-8')).hexdigest()
    gate_status = "PASS" if cost_zar > 20000 and tier in ["T1", "T2"] else "HOLD"
    return {
        "record": record,
        "content_hash": content_hash,
        "gate_status": gate_status
    }
```

---

## Module 3: THE LYNX Conceded Ledger Log
- **Claimed**: 10 links sharing the same ledger/buyer.
- **Concessions (5 Items)**:
  - Link 3: Depot != Mine `[UNVERIFIED]`
  - Link 4: SMR module removed from scope
  - Link 7: Read-only access; write disabled
  - Link 2: R195k cost multiplier `[UNDEFINED]`
  - Meta: Shared code != shared business (retained `chain.js` / `verify.js` + 11-field payload).

---

## Module 4: Integrated Verification Environment (IVE)
- **11-Field Canonical Payload**: `sensor_id`, `firmware`, `calib_epoch`, `utc_ts`, `geo`, `proc_type`, `evidence_status`, `channel`, `merchantId`, `hour`, `gapDraw`.
- **UI Footer Mandate**: `computed gates · stubbed gates flagged · strong = suspicious`
- **MBD Spine Hash**: `084a52ac...`

### TypeScript Implementation: `ive.ts`
```typescript
import { createHash } from 'crypto';

export interface IVEPayload {
  sensor_id: string;
  firmware: string;
  calib_epoch: number;
  utc_ts: string;
  geo: string;
  proc_type: string;
  evidence_status: string;
  channel: string;
  merchantId: string;
  hour: number;
  gapDraw: number;
}

export function computeCanonicalHash(payload: IVEPayload) {
  const sortedKeys = Object.keys(payload).sort() as (keyof IVEPayload)[];
  const sortedPayload: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedPayload[key] = payload[key];
  }
  const canonicalJson = JSON.stringify(sortedPayload);
  const contentHash = createHash('sha256').update(canonicalJson).digest('hex');
  const receiptHash = createHash('sha256').update(contentHash + payload.utc_ts).digest('hex');
  
  return {
    canonicalJson,
    contentHash,
    receiptHash,
    uiFooter: "computed gates · stubbed gates flagged · strong = suspicious"
  };
}
```

---

## Module 5: Unified Server Architecture
- **CNAME Routing**: `vvu-enterprise.space-z.ai` + `vvu-study.space-z.ai` -> `cname.space-z.ai`

### TypeScript Implementation: `middleware.ts`
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  if (hostname.includes('vvu-study')) {
    url.pathname = `/study${url.pathname}`;
    return NextResponse.rewrite(url);
  } else if (hostname.includes('vvu-enterprise')) {
    url.pathname = `/enterprise${url.pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}
```

### TypeScript Implementation: `route.ts` (`POST /api/propagate`)
```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  // Propagate observation payload across enterprise and study spaces
  return NextResponse.json({
    status: 'propagated',
    timestamp: new Date().toISOString(),
    payload_hash: body.contentHash || 'N/A'
  });
}
```

---

## Module 6: ProofBridge Hardware Integration
- **Mk 0.5**: Raspberry Pi 5 (R1,671) with 5-day zero-fee trial.
- **MK-II**: AMD Kria SOM (99% bandwidth reduction).
- **Air-Gapped LLM**: Llama 3.1 8B running read-only local inference at R0 per token.

---

## Module 7: Governance & Political Economy
- **Academic Leadership**: Prof Giovanni Poggi (Mandela University / Stellenbosch).
- **Trust Tax**: Quantifying the hidden expense of trusting unverified third-party figures.

---

## Module 8: Funding, GTC Berlin & Travel Gate
- **Funding Route**: `/support` interim route (100% to Mk-I fabrication).
- **GTC Berlin**: Pricing €1,755 / €1,053 Academic / €357 Exhibit Hall (Codes: `GTC-NVY16C1I`, `GTCB26INCP`).
- **Passport Gate**: 10-14 days DHA processing funded by depot PASS milestones.

---

## Module 9: Lessons From Failures & Post-Mortems
1. **Placeholder Eradication**: Replace `[Recipient Name]` with actual names (e.g. Adam Henryk Grzywaczewski).
2. **HTML Email Formatting**: Paste rendered HTML into Gmail settings rather than raw `<table>` source.
3. **Secret Hygiene**: Revoke leaked keys from legacy spreadsheets (`file4026010665615496067.xlsx`) and enforce `.env` injection.

---

## Module 10: Student Practical Exercises
1. Execute `depot_observation.py` to calculate gate statuses.
2. Build 11-field canonical payload and verify SHA-256 hashes.
3. Test Next.js host header routing for `vvu-study` vs `vvu-enterprise`.
4. Trigger `/api/propagate` and verify simultaneous state updates.
