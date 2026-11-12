# PROOFBRIDGE — FINAL GO-LIVE EVIDENCE (ONE RUN)

DATE: 2026-09-15T22:49:36.111Z
SOURCE COMMIT: cd7d785d97b881f8f1ee6240c6b23d857fbd766b
RUNNER: tests/go-live/run-golive.ts (bun) · all checks executed THIS run, none copied

## BUILD / RUNNER INTEGRITY (§4)

| surface | runningHash | diskHash | MATCH |
|---|---|---|---|
| :3000 Next dev (node v24.19.0) | eaa6e9164b6246f467ede0a0fdf0d2b6527dd2b6d5bc6a6384915c0aad91149b | eaa6e9164b6246f467ede0a0fdf0d2b6527dd2b6d5bc6a6384915c0aad91149b | YES |
| :3004 vault-bridge (v24.3.0) | 87c2ef106a4477d97587be5e9f3f2091091d529722260995719fc4ac6cb8213e | 87c2ef106a4477d97587be5e9f3f2091091d529722260995719fc4ac6cb8213e | YES |
| :3005 vvu-field (v24.3.0) | 8bb8e3eb3831777b454e9cb0fd2365dbead0ce7a671bc3826177fe43c74fe632 | 8bb8e3eb3831777b454e9cb0fd2365dbead0ce7a671bc3826177fe43c74fe632 | YES |

SOURCE TREE HASH (first-party files, 161 files): 265308593dea4d4dc2d203c5519a37a9d6f9b96454be42a0a67227d231054b3b
Stale-module detector: negative proof executed (fresh=YES, post-edit=NO on an ephemeral copy).

## SECURITY (§1)

NO EXPOSED CREDENTIAL DEMONSTRATED THIS RUN — in-memory device secrets by construction; no key material found in scanned first-party files; remaining UNKNOWNs are operator-held artifacts
Full inventory (no secret values printed): output/task40_security_inventory.json
SafeKrypte/ProofBridge-Krypt zip preserved unopened (security root, operator-held).

## RECEIPTS (§2)

:3004 — 125 receipts, chain VALID from genesis, merkleRoot b8b416f4f5bae1036735fb229a1339b17d582d488a4ca96f16f7e54bd0d1807d
:3005 — 97 receipts, chain VALID from genesis, merkleRoot b1cd5b8ad9de795ed7e60fa213b4e7d042b26cddacc76c8f4e3f7cefc2001700
9-case tamper matrix (modified/deleted/reordered/duplicate/wrong-prev/wrong-seq/stale/concurrent): ALL DETECTED (PASS)

## ANCHOR (§3)

STATUS: STUBBED — external leg NOT LIVE.
Hybrid implemented: local append-only hash chain (LIVE) + periodic RFC-6962 Merkle-root anchoring every 10 appends / 120 s (relay sees the ROOT HASH ONLY). The relay (/api/anchor) self-declares `stub:*` txRefs — no real chain write has happened. Merkle math independently recomputed by the runner (match).

## ANDROID BRIDGE (§5)

BRIDGE STATUS: BLOCKED — no real phone reachable from this sandbox (operator gate)
Nine-step gate (authenticated connection, vault identity, list, search, read, create, write, read-back, SHA256 verify): ALL PASS IN LOOPBACK — ephemeral instance running the same production source; labelled PROTOTYPE, not LIVE.
The REAL phone gate is the operator's: install obsidian-plugin/proofbridge-(field-|vault-)bridge, scan the QR, run ANDROID_LIVE_BRIDGE_VERIFICATION_RUNNER.md.

## OBSIDIAN WRITE SAFETY (§6)

ALL CASES PASS (fail-closed semantics proven) — protocol: READ → HASH BEFORE → COMPARE → WRITE → READ BACK → HASH AFTER → RECEIPT. Blind overwrite refused; SOURCE_CHANGED fail-closed; provenance (op, target, payload hash, ts, actor) in every receipt.

## POPIA / DATA BOUNDARY (§7)

Receipts are metadata-only (structural check PASS). Paying-tier PII payloads dropped fail-closed at the live-socket boundary (not receipted). Leak scan of receipts + logs: see output report. Vault content never persists bridge-side.

## ADVERSARIAL RESULTS (§8)

This run: 14 checks — 14 PASS.
Standing suites re-run after the Task 40 changes: tests/vault-bridge (20/20 + 2 new §6 checks) and tests/vvu-field (33/33, concurrency test upgraded to fail-closed semantics).

## PUBLIC SURFACE RESULTS (§9)

| surface | route | health | auth boundary | verdict |
|---|---|---|---|---|
| VVU Command dashboard | / (hash projections) | 200 | n/a (proxy routes) | GREEN (engineering) |
| Vault bridge | :3004 + #/bridge | 200 | 401 on unauth agent probes | GREEN (engineering) |
| Field onboarding | :3005 + #/field | 200 | 401 on unauth agent probes | GREEN (engineering) |

Details: output/task40_surfaces.json. Browser QA evidence: output/task40_*.png.

## FINANCIAL-SERVICES REGULATORY EVIDENCE (§10)

VERDICT: REGULATORY REVIEW REQUIRED.
No FSCA authorisation, FIC registration, AML/CFT programme, sanctions-screening, transaction-monitoring, complaints, fit-and-proper or client-money controls are evidenced anywhere in this repository. Engineering green does NOT authorise regulated financial services (FSCA FAIS; FIC Act as applicable). See output/task40_golive_report.json §regulatory for the full checklist.

## KNOWN LIMITATIONS

- Android bridge unverified on a real phone (the only LIVE gate this estate cannot clear from the sandbox).
- External anchor stubbed; ZK attestation stubbed; :3005 tier plumbing absent by scope.
- POPIA guard is shallow (top-level keys) by design — documented fail-closed direction.
- Bridge device store is memory-only (re-pair after restart — by design, receipted).
- Pilot-grade symmetric device secrets over gateway TLS — not hardware-backed keys.
- Sandbox preview origin — no production hosting, no independent infrastructure.

## BLOCKERS

1. ANDROID BRIDGE: no real phone in this sandbox — operator must install the plugin + scan the QR + run ANDROID_LIVE_BRIDGE_VERIFICATION_RUNNER.md
2. ANCHOR: external relay is a stub — select + fund the real target (Base/Arbitrum calldata or Trillian CT log) before paying-tier production
3. REGULATORY: FSCA authorisation / FIC registration documentary evidence absent — REGULATORY REVIEW REQUIRED before any regulated financial-services activity
4. TIER PROVISIONING: tier selector UI + device-tier management are API-only (no pairing-flow UI yet)
5. :3005 FIELD RAIL: tier/anchor/POPIA plumbing not mirrored (Task 39 patch scoped to :3004)

## FINAL GATE (§12)

ENGINEERING GO-LIVE: BLOCKED (Android bridge LIVE is a hard gate item — §12)
Per §12 the Android bridge LIVE is a hard gate item — the estate is BLOCKED at the final gate until the operator's real-phone run passes. Every other engineering item this run can verify is recorded above with its actual result.

— generated by the ONE-RUN go-live runner; no simulated green; no mock green; no fixture green; no stale-module green.
