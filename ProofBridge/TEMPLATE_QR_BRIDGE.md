# ProofBridge QR Bridge — Build Instruction Template v1.1.0

Read this whole file before writing code. Do not skip sections. Do not improvise on security.

---

## 0. What you are building

A QR-based device onboarding bridge. The user points a phone at a QR code on the operator's screen. The phone becomes a bound device on the local runner. The whole exchange produces one receipt.

That is the entire product. There is nothing else. If your implementation ships extra, you have broken the spec.

---

## 1. The one rule that overrides every other rule

The QR is not a secret. The QR is a reference to a secret the server holds.

If you find yourself putting any of these into the QR payload — stop:

· an API key
· a payment token
· an activation key
· a bearer token
· a private key
· a password
· a shared TOTP secret
· a Vercel secret
· a database credential
· a permanent device identity

The QR carries five things and only five things:

```
{
  "v": 2,
  "type": "proofbridge_ephemeral_pairing_ref",
  "ref": "<opaque server-generated ID>",
  "op":  "<operation the token authorizes>",
  "iat": <issued-at unix seconds>,
  "exp": <expiry unix seconds>,
  "single_use": true,
  "scoped_to": "<allowed operation>",
  "tier": "<product/access tier>"
}
```

Nothing else. Ever.

---

## 2. The six-state lifecycle

Every pairing reference moves through these states, on the server, not on the client:

```
UNPAID → PENDING → PAID → AUTHORIZED → REDEEMED
                                   ↘ EXPIRED
                                   ↘ REVOKED
                                   ↘ FAILED
```

The client never declares a state. The server decides. If the client posts {"paid": true}, the server ignores it. The payment rail is authoritative. This is the only line in this document that must survive any code review, refactor, or rewrite.

---

## 3. The seven allowed catalogue statuses

If you are labelling a surface (a page, a plugin, a rail), you use exactly one of these words and no other:

```
ASSEMBLY READY
DOCUMENTED
DEMONSTRATION
VERIFIED
PILOT AVAILABLE
UNVERIFIED
BLOCKED
```

Do not use VERIFIED or QUALITY PASS unless there is a hash, a commit SHA, or a signed receipt attached. If the evidence is missing, the status is UNVERIFIED or BLOCKED. Not "almost done." Not "basically ready." Those two phrases are forbidden in this build.

---

## 4. The onboarding flow — one path, no shortcuts

```
1. Client (operator UI) requests a new pairing token:
     POST /pairing-token
     { operation, tier }
   Server responds:
     { ref, op, iat, exp, ttl_seconds, single_use }
   Server writes a WORM event:
     event_type: "pairing.token.issued"
     payload: { ref_hash, operation, tier, exp }

2. Client renders QR from the payload.

3. Phone scans QR → opens deep link → sends to server:
     POST /pairing-redeem
     { ref, device_pubkey, device_label }

4. Server:
     a. Validates ref exists, not expired, not already redeemed, not revoked.
     b. Checks payment/access state for the tier.
     c. Checks the requesting device is not already bound.
     d. Binds device_pubkey to the ref's operation.
     e. Issues a device-scoped session credential.
     f. Writes WORM events:
          "pairing.token.validated"
          "device.credential.issued"
          "onboarding.receipt"
     g. Returns the receipt.

5. Client displays receipt to the user.
```

There is no sixth step. There is no "trust me" path. There is no "skip validation in dev."

---

## 5. The receipt

Every successful onboarding returns one receipt. It contains exactly these fields and no others:

```
{
  "operation_id": "...",
  "timestamp": "...",
  "product_or_access_tier": "...",
  "payment_or_access_decision": "AUTHORIZED",
  "device_identity": "<pubkey fingerprint>",
  "verification_state": "VERIFIED",
  "receipt_hash": "<sha256 of the canonical receipt body>"
}
```

No payment credentials. No secret values. No bearer tokens. No PII beyond the device fingerprint.

The receipt is the only thing the user takes away. Everything else dies at redemption.

---

## 6. Expiry and single-use — non-negotiable

· TTL: between 30 seconds and 300 seconds. Never longer.
· Single-use: after REDEEMED, the ref is dead. Replay attempts return REPLAY_REJECTED. Not "invalid token." The exact reason.
· Revocation: the operator can revoke any outstanding ref at any time. Revocation writes a WORM event.
· No re-issue of an existing ref. Every pairing is a new ref. Every time.

---

## 7. The device binding

· The phone generates its own keypair. Ed25519 preferred. WebCrypto when available.
· The public key is sent to the server only during redemption.
· The server binds device_pubkey → operation + tier + expiry.
· The private key never leaves the phone.
· If a phone has no WebCrypto (older Android browser), the plugin labels the device HMAC-ONLY-DEVICE and the server treats it at a lower trust tier. It is not refused. It is labelled.
· FIELD-09 is not a shared secret. If it appears as a device label, the server generates a fresh device identity and binds the credential to that. Never use FIELD-09 as a password.

---

## 8. What the QR must never do

· It must not grant unrestricted payment access.
· It must not survive across devices.
· It must not be re-scannable after redemption.
· It must not be photographed and reused.
· It must not encode a web URL that auto-fetches from a third-party service at render time.

If your implementation uses api.qrserver.com or any external QR renderer at runtime — stop. Render the QR locally. The QR contains a reference; the render call must not leak the reference to a third party.

---

## 9. SEO and indexing

Index:

· The product description page.
· The documentation page.
· The pricing page.

Do not index:

· Token endpoints (/pairing-token).
· Redemption endpoints (/pairing-redeem).
· Private onboarding state pages.
· Payment callbacks.
· Internal diagnostics.
· Any URL that appears inside the QR.

Every one of the "do not index" items must be marked noindex, nofollow in HTML and excluded in robots.txt on the server.

---

## 10. Ubuntu contribution boundary

If the tier is R5 or R10:

· The contribution may unlock the explicitly-defined Ubuntu participation path.
· It must not be represented as purchasing regulated financial services.
· The receipt must record contribution and access as two separate fields.
· Never merge them.

If a regulator asks, the code must make the separation obvious in one grep.

---

## 11. Credential disclosure procedure

If any public artifact (image, screenshot, HTML, PDF, repo) contains a live credential:

1. Identify the artifact. Record its path.
2. Preserve it privately for provenance. Do not delete.
3. Mark it NOT FOR PUBLICATION.
4. Record the secret name only. Never the value.
5. Rotate the credential. Immediately.
6. Do not reproduce the value in any commit, chat, or document.
7. Do not index or publish the artifact.
8. Verify the replacement credential before declaring the rail secure.
9. Write a WORM event: key.disclosed.compromised with the secret name and rotation timestamp.

This procedure is not advisory. It is the first thing you do, before anything else, if a disclosure is found.

---

## 12. File contract

Every implementation ships exactly these files:

```
proofbridge-qr-bridge/
├── manifest.json       # Obsidian plugin manifest (if Obsidian client)
├── main.js             # Plugin logic + QR render + redemption
├── README.md           # Points to this template
├── SECURITY_LOCK.md    # Verbatim copy of §1–§8 of this template
└── versions.json       # Obsidian version map (or equivalent)
```

For a browser client, substitute manifest.json for index.html and keep the other four. Same shape. Same rules.

Do not add files. If you need a new file, you need a new spec. Come back to this template first.

---

## 13. Hashes and provenance

Every released version of the bridge carries:

· SHA-256 of the built artifact — recorded in the release notes.
· Git commit SHA — the exact commit that produced the artifact.
· The template version — which version of this document was in force.
· The test run log — the adversarial tests the artifact passed.

If any of the four is missing, the release is UNVERIFIED. It does not ship.

---

## 14. Adversarial tests — mandatory before release

Every build passes these, in order, or it does not ship:

| # | Test | Expected |
|---|------|----------|
| 1 | Replay a redeemed ref | REPLAY_REJECTED |
| 2 | Redeem an expired ref | EXPIRED |
| 3 | Redeem a revoked ref | REVOKED |
| 4 | Client posts {"paid": true} without server state | Ignored; server state wins |
| 5 | Two devices race the same ref | One REDEEMED, one REPLAY_REJECTED |
| 6 | Two concurrent writes to the receipt chain | Serialized, no duplicates |
| 7 | Truncated POST body | REJECTED_MALFORMED |
| 8 | Missing device_pubkey | REJECTED_MISSING_PUBKEY |
| 9 | Wrong tier for operation | REJECTED_TIER_MISMATCH |
| 10 | Device already bound | REJECTED_ALREADY_BOUND |
| 11 | Server restarts mid-flow | Ref survives, chain head intact |
| 12 | Network drops after QR, before redeem | Ref expires cleanly, no orphan state |

Pass = 12/12. Any failure = no release. Log the failure, fix, re-run the full suite, not just the failed test.

---

## 15. What this template does not cover

Explicitly out of scope. Do not add these to a build from this template:

· Payment processing. That is a separate rail.
· Anchor writes to any chain. That is a separate rail.
· LLM tooling. That is a separate rail.
· The 72-hour pipeline. That is a separate rail.
· The field demo sensor mesh. That is a separate rail.

This template covers the QR only. If you want to add a rail, add a new template. Do not extend this one.

---

## 16. Handoff checklist

Before you hand your build to the next person, confirm:

☐ This template was read in full.
☐ No secret appeared in the QR payload. Ever.
☐ The client never declares payment state.
☐ Every catalogue status uses the allowed vocabulary.
☐ Every receipt contains the seven required fields and no others.
☐ TTL is between 30 and 300 seconds.
☐ Every ref is single-use.
☐ All 12 adversarial tests passed and were logged.
☐ The four provenance items (§13) are attached.
☐ Credential disclosure procedure (§11) has been re-read and is understood.
☐ No files outside the §12 contract were added.
☐ The six rail boundaries in §15 were respected.

If any box is unchecked, the build is not ready. It stays UNVERIFIED.

---

## 17. The one-line summary

QR = reference. Server = authority. Receipt = truth. Nothing else.

If a future builder remembers only one thing from this template, it is that line.

---

That is the template. Give it to the builder first, every time, before they open an editor. Everything else follows from it. If the builder asks "what about X?", the answer is: read §15. If X is not in §15, it is in scope. If it is, it is another template.
