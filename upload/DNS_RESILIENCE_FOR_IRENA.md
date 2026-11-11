# DNS RESILIENCE — CORRECTED RUNBOOK FOR IRENA (v1.1)

```
For:      Irena — verified operator
From:     Mihle — divh@venturevisionubuntu.co.za
Review:   Super Z (GLM) — engineering audit of the v1.0 draft BEFORE execution
Date:     2026-09-18
Status:   v1.1 — SUPERSEDES the v1.0 draft of 2026-09-17. Do not execute v1.0.
Context:  Huntress Ebook p16 — no single piece of infrastructure is
          load-bearing, because it's all cheap enough to replace.
Doctrine: If it looks perfect, it's spoofed. The v1.0 draft looked perfect.
          Audit found 11 defects — 2 critical, 3 high. All corrected below.
Invariant: computed gates · stubbed gates flagged · strong = suspicious
```

---

## ERRATA — defects found in the v1.0 draft

| ID | Sev | Defect in v1.0 | Correction in v1.1 |
|----|-----|----------------|--------------------|
| C1 | CRITICAL | Middleware matched `host.includes('venturevisionubuntu')` for ENTERPRISE before checking study — `study-fallback.venturevisionubuntu.co.za` was routed to the **enterprise** app | Ordered classification: study matched FIRST; enterprise is the default. `src/middleware.ts` v1.1 |
| C2 | CRITICAL | Fallback hostnames never added in Vercel → Project → Domains. Vercel routes by Host header; an unclaimed hostname = 404 no matter what DNS says. Also `[UNVERIFIED]` whether a VVU-owned Vercel project exists at all | Step 2a verifies/creates the project; Step 2b claims apex, www, both `-fallback` hostnames |
| C3 | HIGH | `curl -H "Host: enterprise..."` against the fallback URL — the Host override routes the request BACK to primary; test defeats itself. No negative control either | Step 5: curl fallback URLs directly; negative control added (primary MUST fail during the drill) |
| C4 | HIGH | "Page Rules: if enterprise-fallback down → redirect to enterprise" — inverted direction AND Page Rules match URL patterns, they cannot health-check origins (that is paid Load Balancing) | Deleted. Real failover = TTL 300 + Irena's <5 min CNAME switch + Mihle's bookmarks |
| C5 | HIGH | Orange-clouding every record makes the fallback share the Cloudflare proxy layer — a second single point of failure (the exact p16 sin) | Step 3.7: `*-fallback` records stay GREY (DNS only), permanently |
| C6 | MEDIUM | "Cloudflare cache covers Vercel down" — static assets yes; `POST /api/propagate` is NEVER cached. Also, post-NS-move "HostAfrica DNS down" stops being a scenario at all (delegation bypasses it) | Claim corrected — the design is stronger than v1.0 said, but stated truthfully |
| C7 | MEDIUM | Orange-cloud before Vercel verifies the domain → certificate issuance blocked → 526 errors under Full (Strict). NS names `lara/robert` were examples, not the real pair. `/etc/hosts` drill stops working once records are proxied | Step 3 reordered: grey → verify in Vercel → then orange; SSL = Full (Strict); drill runs BEFORE proxying |
| C8 | MEDIUM | `HOSTAFRICA_API_KEY` parked in Vercel ENV — nothing in the app reads it; a parked API key is a parked session (Huntress p14) | Removed from Vercel; lives ONLY in Irena's local env for the failover script |
| C9 | LOW | `NEXT_PUBLIC_*` values are inlined at BUILD time — setting them changes nothing until redeploy | Step 4 note: redeploy after saving ENV |
| C10 | LOW | Primary TTL 3600 vs "<5 min CNAME switch" — resolvers cache the old target for an hour | Primary TTL cut to 300 (verify panel honors it) |
| C11 | INFO | Fallback serves the same CODE, not necessarily the same STATE — THE LYNX lesson: shared code ≠ shared business | Step 5.7: compare ledger tails across doors, not just contentHash |

---

## What already exists in the repo (build on this — do not rebuild)

These files are IN the repo you deploy; they are the corrected implementations:

- `src/middleware.ts` — **v1.1** host router. Fixes C1. Stamps `x-vvu-host`, `x-vvu-domain`, `x-vvu-fallback`, `x-vvu-operator` on every response so routing is verified by behavior, not DNS records.
- `src/app/api/propagate/route.ts` — the door the drill knocks on. v1.0 curled an endpoint that existed nowhere.
  - `GET` → `{ ok, manifest.unified_pages, contentHash, footer }` — zero writes; same contentHash from two different doors = same code + same config (the inline proof).
  - `POST` valid 11-field payload → `201 { contentHash, receiptHash, utc_ts, host }` + ONE line appended to `data/propagate-ledger.jsonl`.
  - `POST` invalid → `400 { error: field_gate_rejected, rejected_fields, writes: 0 }` — proof of life that pollutes nothing. Note: `utc_ts` is an i64-ns decimal STRING on the wire (a JS number cannot safely hold nanosecond epochs — anything past `9007199254740991` is exactly the kind of silent corruption this gate exists to catch).
  - Honesty note: the JSONL ledger is real WORM-style append ONLY on the persistent unified server (`bun .next/standalone/server.js`). On serverless the write is ephemeral — do not call it WORM there. And a receiptHash exists only on a real POST — a GET returning a "receipt" would be fabrication.

---

## STEP 0 — Harden FIRST, then identify (order changed from v1.0)

The NS move in Step 3 transfers DNS control. Lock every account BEFORE that transfer, not after (Huntress p15 — if the mailbox is compromised, the attacker inherits whatever the DNS move hands over):

1. Enable 2FA on: HostAfrica, Cloudflare, Vercel, Gmail — in that order.
2. Then, at HostAfrica → Domains → venturevisionubuntu.co.za → DNS Management, add the identity anchor (unchanged from v1.0):

```
Type: TXT, Name: @,      Value: v=spf1 include:_spf.hostafrica.co.za ~all,  TTL: 3600
Type: TXT, Name: _irena, Value: irena-2026-09-17-verified-operator-ive-v1.0.0, TTL: 3600
```

This is your identity anchor — proves you control DNS, same job an Ed25519 key does in IVE.

## STEP 1 — Primary path (kept; TTL corrected per C10)

```
Type: CNAME, Name: enterprise, Value: cname.space-z.ai, TTL: 300
Type: CNAME, Name: study,      Value: cname.space-z.ai, TTL: 300
Type: CNAME, Name: www,        Value: cname.space-z.ai, TTL: 300
```

TTL was 3600 in v1.0 — that caches the z.ai mapping for an hour and kills the "<5 min switch" play. If the HostAfrica panel rounds 300 back up `[UNDEFINED]`, record what it actually saved.

## STEP 2 — Fallback path (TWO missing sub-steps restored — C2)

**2a. Verify the fallback has something to fall back TO. `[UNVERIFIED]`**

Vercel dashboard → irena@venturevisionubuntu.co.za → does a VVU-owned project exist with a production deployment of the unified-server repo? The primary path rides z.ai's platform — if there is no VVU-owned deployment, every record below is decorative:

```bash
# from the repo root, if the project does not exist yet:
bun install && bun run build
bunx vercel --prod      # claims a <project>.vercel.app URL under VVU's account
```

**2b. Claim the hostnames in Vercel (was entirely missing from v1.0).**

Vercel → Project → Settings → Domains → add, one by one:

```
venturevisionubuntu.co.za
www.venturevisionubuntu.co.za
enterprise-fallback.venturevisionubuntu.co.za
study-fallback.venturevisionubuntu.co.za
```

Vercel routes by Host header — an unclaimed hostname returns Vercel's 404 regardless of DNS. Note: Vercel domains are unique across accounts; `enterprise`/`study` are already claimed via the z.ai platform and cannot be double-claimed — which is exactly why the fallback uses NEW hostnames. If the apex was previously claimed by the z.ai platform, remove it there first, then claim it here.

**2c. DNS records at HostAfrica (grey-cloud — proxying comes later, Step 3):**

```
Type: CNAME, Name: enterprise-fallback, Value: <exact value Vercel's Domains page shows — typically cname.vercel-dns.com>, TTL: 300
Type: CNAME, Name: study-fallback,      Value: <same>, TTL: 300
Type: A,      Name: @,                  Value: 76.76.21.21 (documented Vercel anycast IP — confirm against the Vercel Domains page), TTL: 300
```

If HostAfrica offers ALIAS/ANAME at the root you may use `ALIAS @ → cname.vercel-dns.com`; the plain A record is the safe default.

## STEP 3 — Cloudflare (REORDERED per C7: grey → verify → orange)

1. Create the Cloudflare account — 2FA on it FIRST (done in Step 0; re-verify).
2. Add site `venturevisionubuntu.co.za` → Cloudflare imports existing records. **Check the import** — confirm every record landed, especially `_irena` TXT and the SPF (p11: watch behavior, not file).
3. Change nameservers at HostAfrica to the pair **Cloudflare assigns this account** (the `lara`/`robert` pair in v1.0 was an example — use what the dashboard shows).
4. SSL/TLS → **Full (Strict)**. Never Flexible — Flexible is plaintext between Cloudflare and origin, a downgrade the students would flag.
5. Keep every record GREY (DNS only) initially. Confirm Vercel → Domains shows **Valid Configuration** for apex, www, and both fallbacks.
6. THEN orange-cloud ONLY: `@`, `www`, `enterprise`, `study` — CDN + DDoS for the primary doors.
7. **KEEP `enterprise-fallback` and `study-fallback` GREY permanently (C5).** An orange-clouded fallback shares the Cloudflare layer and stops being an independent path. Orange-clouding everything re-creates a single load-bearing piece — the exact p16 sin this runbook exists to remove.
8. **DELETED from v1.0** (C4): the "Page Rules: if enterprise-fallback down → redirect to enterprise" line. Page Rules match URL patterns; they cannot health-check origins (that is Cloudflare Load Balancing, paid) — and the direction was inverted anyway. The real failover: TTL 300 + your <5 min CNAME switch + Mihle's bookmarks.
9. Cache truth (C6): Cloudflare caches static assets and serves cached HTML via Always Online when an origin is down — but `POST /api/propagate` is NEVER cached. The fallback for dynamic evidence is the direct-to-Vercel CNAME, not the cache. And once NS are live at Cloudflare, "HostAfrica DNS down" stops being a scenario at all — resolution bypasses HostAfrica entirely. Stronger than v1.0 claimed; stated correctly here.

## STEP 4 — Stack wiring: ENV vars + middleware v1.1

Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_PRIMARY_DOMAIN=venturevisionubuntu.co.za
NEXT_PUBLIC_FALLBACK_DOMAIN=enterprise-fallback.venturevisionubuntu.co.za
NEXT_PUBLIC_CNAME_TARGET=cname.space-z.ai
IVE_FOOTER=computed gates · stubbed gates flagged · strong = suspicious
IRINA_OPERATOR_TXT=irena-2026-09-17-verified
UNIFIED_PAGES=/,/support,/study/knowledge-base,/api/propagate
```

Notes:
- **REMOVED `HOSTAFRICA_API_KEY`** (C8) — nothing in the app reads it; a parked API key is a parked session (p14). Keep it ONLY in your local env for your failover script.
- `NEXT_PUBLIC_*` values are inlined at BUILD time (C9) — **redeploy after saving** or the app keeps serving old values.
- Middleware and route handlers read server-side vars WITHOUT the `NEXT_PUBLIC_` prefix.
- `UNIFIED_PAGES` drives the `GET /api/propagate` manifest — set it to the deployment's real page list (the value above matches DEPLOY_FOR_IRENA.md; adjust if the layout differs).

`src/middleware.ts` v1.1 — already in the repo; if deploying from a copy, paste this exact file:

```ts
import { NextRequest, NextResponse } from "next/server";

const OPERATOR =
  process.env.IRINA_OPERATOR_TXT ?? "irena-2026-09-17-verified";

export function middleware(req: NextRequest) {
  const rawHost = req.headers.get("host") ?? "";
  const host = rawHost.replace(/:\d+$/, "").toLowerCase().trim();

  // Order is load-bearing (ERRATA C1): study matched FIRST, enterprise is
  // the DEFAULT — the v1.0 draft checked enterprise first, so
  // study-fallback.<primary> was mis-routed to the enterprise app.
  const isStudy = host.startsWith("study") || host.startsWith("vvu-study");
  const domain: "study" | "enterprise" = isStudy ? "study" : "enterprise";
  const isFallback = host.includes("fallback");

  const res = NextResponse.next();
  res.headers.set("x-vvu-host", host);
  res.headers.set("x-vvu-domain", domain);
  res.headers.set("x-vvu-fallback", isFallback ? "true" : "false");
  res.headers.set("x-vvu-operator", OPERATOR);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## STEP 5 — Resilience drill (corrected per C3; run BEFORE orange-clouding)

Once records are proxied, visitors resolve Cloudflare IPs and the `/etc/hosts` blackhole below no longer affects the primary path (C7) — run this drill with records still grey, or proxy temporarily off.

```bash
# 0) BASELINE — everything healthy before you break it:
curl -sS -m 10 https://enterprise.venturevisionubuntu.co.za/api/propagate

# 1) SIMULATE z.ai down (blackhole the shared CNAME target):
sudo sh -c 'echo "127.0.0.1 cname.space-z.ai" >> /etc/hosts'

# 2) NEGATIVE CONTROL — primary MUST fail. If it still answers, the
#    simulation is broken and nothing below proves anything:
curl -sS -m 10 -o /dev/null -w "primary: %{http_code}\n" \
  https://enterprise.venturevisionubuntu.co.za/api/propagate
# EXPECT: 000 / connection refused / timeout

# 3) FALLBACK DOORS — no -H "Host:" override (C3: the override routes you
#    back to primary; the Host header must match the URL):
curl -sS -m 10 -o /dev/null -w "enterprise-fallback: %{http_code}\n" \
  https://enterprise-fallback.venturevisionubuntu.co.za/api/propagate
curl -sS -m 10 -o /dev/null -w "study-fallback: %{http_code}\n" \
  https://study-fallback.venturevisionubuntu.co.za/api/propagate
# EXPECT: 200 (GET inline proof). 404 = hostname not claimed in Vercel (C2).
# Optional alive-check without writes:
curl -sS -m 10 -X POST -H 'content-type: application/json' -d '{}' \
  https://enterprise-fallback.venturevisionubuntu.co.za/api/propagate
# EXPECT: 400 field_gate_rejected — the 11-field gate proving it is alive,
# writing nothing to the ledger.

# 4) ROUTING CHECK — the v1.0 bug made this say "enterprise". v1.1 says study:
curl -sSI -m 10 https://study-fallback.venturevisionubuntu.co.za/ | grep -i x-vvu
# EXPECT: x-vvu-domain: study · x-vvu-fallback: true · x-vvu-operator: irena-...

# 5) INLINE — same code + config behind both fallback doors:
A=$(curl -sS -m 10 https://enterprise-fallback.venturevisionubuntu.co.za/api/propagate | jq -r .contentHash)
B=$(curl -sS -m 10 https://study-fallback.venturevisionubuntu.co.za/api/propagate | jq -r .contentHash)
[ "$A" = "$B" ] && echo "INLINE PASS: $A" || echo "INLINE FAIL"

# 6) CLEANUP:
sudo sed -i '/cname.space-z.ai/d' /etc/hosts        # Linux
sudo sed -i '' '/cname.space-z.ai/d' /etc/hosts     # macOS
```

**7) STATE CHECK (C11):** contentHash equality proves same code + config — NOT same data. Compare the last line of `data/propagate-ledger.jsonl` reachable via each door. If the doors write to separate ledgers, entries made via primary will not appear via fallback until state is shared. THE LYNX: shared code ≠ shared business — do not claim full inline on a contentHash alone.

## STEP 6 — Document in Worklog (Entry #007, corrected template)

```
[Entry #007 — 2026-09-18THH:MM:SSZ — Irena DNS Resilience]
utc_ts: <now>
claim: DNS fallback deployed — enterprise-fallback + study-fallback grey-cloud + Cloudflare proxy on primaries
obligation: 7 acceptance checks + negative control + 3 fallback curls + routing header check PASS
negative_control: primary returned 000 with cname.space-z.ai blackholed — the outage was real
routing_check: study-fallback served x-vvu-domain: study (v1.0 bug absent)
gate: PASS
contentHash: <from GET — code+config proof>
receiptHash: <from a valid POST — write proof; a GET cannot return one>
state: PROVEN
next_action: weekly curl drill + Cloudflare analytics review
unblocks: Mihle can access via venturevisionubuntu.co.za even when z.ai is down
```

## STEP 7 — Give Mihle access (no terminal)

Bookmarks:

```
https://venturevisionubuntu.co.za/                                    (apex — no z.ai in the path)
https://enterprise-fallback.venturevisionubuntu.co.za/support
https://study-fallback.venturevisionubuntu.co.za/study/knowledge-base
https://enterprise-fallback.venturevisionubuntu.co.za/api/propagate
```

The last bookmark opens plain JSON in the browser — `contentHash` + `footer` visible with zero terminal skill. (A `receiptHash` appears only after a real POST write — see Step 6.)

Screenshot of the DNS panel showing: enterprise/study CNAME → cname.space-z.ai (orange) · enterprise-fallback/study-fallback CNAME → Vercel (**grey**) · `@` A → 76.76.21.21 · `_irena` TXT → irena-2026-09-17-verified. Confirm: "Mihle can access via fallback even when z.ai down — drilled <date>".

## SECURITY NOTES — Huntress mapping (ordering fixed)

- **p11 — watch behavior, not file**: a DNS record that exists but doesn't route is a file. The drill IS the verification.
- **p14 — device code phishing / a key is a session**: old API key revoked BEFORE fallback work; `HOSTAFRICA_API_KEY` never parked in Vercel env — local only.
- **p15 — EvilTokens / mailbox compromise**: 2FA on HostAfrica + Cloudflare + Vercel + Gmail BEFORE the NS move — DNS control transfers with the nameservers; lock first, move second.
- **p17 — coordinated visibility**: Identity (`_irena` TXT), Users (Mihle, no terminal), Endpoints (primary vs fallback doors), Email & Workflow (mailbox rules when money is on the line).

## FINAL CHECK — we all inline even when z.ai down

- **Mihle (no terminal)** → bookmarks apex + fallback URLs → `contentHash` + footer in-browser.
- **Irena (terminal)** → controls DNS at Cloudflare post-move → can switch a CNAME target in <5 min at TTL 300.
- **Stack** → middleware v1.1 classifies host, stamps `x-vvu-*` headers → same app behind every door → the propagate gate proves it by behavior.
- **Honest caveat (C11)** → both doors serve the same CODE; whether they share STATE depends on the deployment's data layer. Compare ledger tails before claiming full inline.

## HONEST LIMITS — the register (do not silently resolve these)

- `[UNVERIFIED]` VVU-owned Vercel project with a production deployment exists — Step 2a gates everything below it.
- `[UNVERIFIED]` Shared state layer between primary and mirror deployments (C11).
- `[UNDEFINED]` HostAfrica minimum TTL — the panel may round 300 upward; record what it actually saved.
- **Accepted floor**: Vercel itself is one provider behind BOTH fallback doors and the apex. Repo + `vercel --prod` is the rebuild path — p16's answer: cheap to replace, therefore not load-bearing.

No single piece load-bearing. That's resilience — now actually true.

`computed gates · stubbed gates flagged · strong = suspicious`

