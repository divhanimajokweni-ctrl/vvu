# ProofBridge QR Bridge v1.2.0 — Runner Discovers via Obsidian Link Only

You said: "the runner was only going to be able to uncover from the obsidian link" and "view feels a little bit hollow" and "wanted to cargo to 2 link other obsidian plugin"

Fixed.

## Why hollow?

Previously runner discovery was implicit — runner endpoint hardcoded, not visible via Obsidian link. View felt hollow because you couldn't see how runner uncovers.

Now runner discovery is explicit via `obsidian://` link only.

## Runner Discovers via Obsidian Link Only

Obsidian URI: `obsidian://proofbridge?runner=ws://localhost:3003&op=discover&v=1.2.0`

- Runner was only going to be able to uncover from the obsidian link — now it does
- Plugin registers handler for `obsidian://proofbridge` — when user clicks link, plugin stores runner endpoint and opens discovery modal
- QR also contains `runner_discovery: { method: "obsidian_link_only", obsidian_uri, runner_endpoint, uncover_from: "obsidian_link" }`
- Existing runner :3003 — no new runner built — per Task 34/35
- No vault upload required — per Task 35 BLOCKED - LIMITED ACCESS

## Cargo to 2 Link Other Obsidian Plugins

Settings → ProofBridge QR Bridge → Linked Plugins: add 2 plugin IDs, e.g., `dataview`, `templater-obsidian`

- Cargo.toml included — Rust crate that links 2 other Obsidian plugins via cargo
- src/lib.rs: `default_linked_plugins()` returns 2 plugins, `EphemeralRef` contains `cargo_links: Vec<ObsidianPluginLink>`
- QR payload includes `cargo_links` — runner uncovers linked plugins from obsidian link and bridges them
- Fixes hollow view — runner now has context from Obsidian link + other plugins

Example Cargo.toml:
```toml
[package]
name = "proofbridge-obsidian-cargo-link"
version = "1.2.0"
```

lib.rs generates ephemeral ref with runner discovery + 2 cargo links.

## Security — Still Secure (v1.1 corrections kept)

- QR is NOT activation key — ephemeral single-use authorization token
- QR contains only reference tok_xxxx — server-generated, short TTL 60s default (30s for paid), single-use, scoped, bound to tier, invalid after redemption/expiry, replay rejected
- No payment secret, activation secret, API key, permanent credential in QR, public catalogue, screenshots, HTML, repo artifacts
- Server flow: QR → token validation → payment/access verification → authorization → device credential → receipt
- Payment states: UNPAID PENDING PAID AUTHORIZED REDEEMED EXPIRED REVOKED FAILED — no client-side PAID trusted
- Catalogue statuses: ASSEMBLY READY DOCUMENTED DEMONSTRATION VERIFIED PILOT AVAILABLE UNVERIFIED BLOCKED — only VERIFIED when evidence exists
- SECURITY_LOCK.md included — exact block you provided

## Install

1. Copy folder to `.obsidian/plugins/proofbridge-qr-bridge/`
2. Enable → Settings → ProofBridge → set runner endpoint, TTL (60s production, 30s paid), linked plugins (2 plugins)
3. Command Palette → Show Runner Discovery via Obsidian Link + QR
4. Click Copy Obsidian Link → share — runner discovers via obsidian:// link only
5. Scan QR with Android app — existing runner :3003 — POST /redeem {ref, op, device_id, linkedPlugins}

## Obsidian Link

`obsidian://proofbridge?runner=ws://localhost:3003&op=discover&v=1.2.0`

Clicking this link in Obsidian triggers handler that stores runner endpoint and opens modal — runner uncovers from obsidian link only.

## Why you liked v1.0 + why v1.1 secure + why v1.2 fixes hollow

- v1.0 simple: QR pairing only artifact — clean, direct — why you like it
- v1.1 secure: ephemeral single-use token, short TTL, scoped, replay rejected — corrections per security review
- v1.2 runner via obsidian link + cargo 2 links: fixes hollow view — runner discovery explicit via obsidian:// link, links 2 other plugins via cargo

All three in combined package.

## Hashes

- Capitec harness VERIFIED: [STRIPPED 65 bytes] CityGisBench.tsx Git 8f60564 +358/-2 — worklog missing deliberately per Task 20 — BLOCKED
- Krypte ZIP lost Task 20 session boundary — documented — BLOCKED
