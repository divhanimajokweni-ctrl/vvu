# ProofBridge Field Demo · Sensor Mesh (:3007)

**Catalogue status: DEMONSTRATION** (§3 vocabulary, TEMPLATE_QR_BRIDGE v1.1.0).
A laptop runs this tiny local server; guests scan a QR code with their phones;
their phones become sensor nodes — camera, mic, GPS, motion, battery; the
dashboard shows all of them live. Everything is hash-chained. Nothing leaves
the room.

## The three files (+ the runner)

| Spec file | Here | Note |
|---|---|---|
| 1. Server (one file) | `index.ts` | **Honest deviation:** the one-page spec said Python/FastAPI; this environment's service contract mandates Bun mini-services. Same behaviour, same endpoints, zero npm deps at runtime. |
| 2. Phone page | `public/join.html` | Single self-contained HTML file. Permissions on tap. Each sensor on a 1s timer. STOP SHARING button. |
| 3. Dashboard | `public/dashboard.html` | Single self-contained HTML file. One card per phone, one row per channel. Missing sensor → **UNDEFINED**, never a guess. |
| Journal | `chain.ts` + `data/journal.jsonl` | Every reading appended to a SHA-256 hash-chained file. `/verify` walks the chain and returns valid or break-at-seq. |

## Run it

```bash
bun run dev            # server on :3007 — prints local IPs + a terminal QR
bun run demo-agent     # optional: honest QA node (SIM badge) that runs all demo beats
bun run crosscheck     # QR encoder proof: 24/24 jsQR round-trip decodes (dev-only dep)
```

- Dashboard: `http://localhost:3007/` (LAN) or `/mesh-demo?XTransformPort=3007` (gateway)
- Phone page: `http://<laptop-ip>:3007/join` (LAN) or `/mesh-demo/join?XTransformPort=3007`
- Verify: `/verify` · State: `/state` · Health: `/health`

The **dashboard's QR** (left panel) is derived from the origin the dashboard
was opened from — through the gateway it encodes the gateway URL, on the LAN
it encodes the laptop IP. The **terminal QR** at startup is for bare-LAN room
demos. Both render locally (`qr.ts` — byte mode, EC-M, V1–V10, mask penalty
eval; proven by jsQR round-trip in `tests/crosscheck.ts`).

## The demo beats, in order

1. Guests scan the QR → cards appear on the big screen.
2. Cover your phone camera → CAMERA flips to **UNDEFINED** in ≤5 s
   (luma < 4 ⇒ no usable image ⇒ no reading is fabricated; the measured luma
   rides along in the reason). Shows it never fabricates.
3. A guest taps STOP → their card disappears, `node.leave` is journaled.
   Revocation is immediate.
4. Open `/verify` → the chain walks from genesis, entries counted, head hash
   recomputed. Shows the receipts are real.

## One gotcha (from the spec)

iPhone motion sensors need HTTPS. On a bare laptop LAN that means the
self-signed-cert dance (one tap to accept). Through this environment's gateway
the page is already HTTPS, so motion permission works directly.

## Honest labels

- **SIMULATED · QA AGENT** badge on the dashboard for `demo-agent` nodes.
- Channels go `UNDEFINED` with the exact reason (`PERMISSION_DENIED`,
  `LENS_COVERED`, `NO_SENSOR`, `NO_FIX`, `UNSUPPORTED`, `STALE_6S`, …) —
  values are never invented, frozen values never keep rendering as live.
- The 5 s staleness rule is enforced server-side, not just client-side.

## Rail boundary & security posture (TEMPLATE_QR_BRIDGE v1.1.0)

- §15: **this is the field-demo sensor mesh — a separate rail.** The QR
  bridge pairing rail lives at `:3005`; its template is
  `ProofBridge/TEMPLATE_QR_BRIDGE.md`.
- §1 discipline inherited anyway: the QR here carries a plain **join URL — a
  reference, never a secret**. No token, no key, no identity in the payload.
- §8: the QR renders **locally** (`qr.ts` → SVG). No api.qrserver.com, no CDN.
- §9: every endpoint sends `X-Robots-Tag: noindex, nofollow`; both pages carry
  `<meta name="robots" content="noindex, nofollow">`; `/mesh-demo` is excluded
  in the host `robots.txt`.
- Zero outbound network calls in the server or either page (grep it).
