# ProofBridge — E2E LOG 1 EVIDENCE (Log 1 Clean Build + Rule Wiring + Automatic DH)

**Run:** 2026-09-16T01:47:25.377Z · **Runner devID:** `dev_6977e62cbbff4fa4` (sandbox test identity, operator-brief-authorized — **not an operator key**)
**Authority:** operator brief — E2E Runner Brief: Log 1 Clean Build + Rule Wiring + Automatic DH
**Regime:** ledger-enforced governance — this run supersedes all prior governance prose.

## Honest estate status (unchanged, carried into the baseline)

| Component | Status |
| --- | --- |
| Android bridge | **BLOCKED** — no real-phone verification in this sandbox (operator gate: install plugin → scan QR → ANDROID_LIVE_BRIDGE_VERIFICATION_RUNNER.md) |
| Anchor target | **STUBBED** — relay self-declares `stub:*` (Base/Arbitrum calldata vs Trillian is the operator decision) |
| Regulatory file | **REVIEW REQUIRED** — no FSCA/FIC documentary evidence in the repo |
| Public deployment | **BLOCKED** — domain unregistered |

## Phase 0 — pre-conditions (verify, do not act)

- PASS — health Next :3000: HTTP 200
- PASS — health vault-bridge :3004: HTTP 200
- PASS — health field-onboard :3005: HTTP 200
- PASS — /api/integrity MATCH (key routing files): runningHash 0f8d26bf5364aaf7…
- PASS — bridge receipts chain valid: 133 receipts · root 7e1b55c27b916042…
- PASS — field receipts chain valid: 99 receipts · root 1eee2721d7d26a7a…
- PASS — bridge WORM file independent recompute: 133 entries · merkle 7c75d79b501e3bb2…
- PASS — field WORM file independent recompute: 99 entries · merkle 637326ac135c6d12…

## Phase 1 — LOG 1: clean build baseline

- Canonical tree: git HEAD `7e52b6f4fe74c269b20040664aa4a4920913bef4` · tree `770e7d50aa4ba8fad993aa86f7740d4c539727f4` · 3 dirty file(s) recorded honestly: M db/custom.db,  M tests/e2e-log1/run-e2e.ts, ?? output/task42_e2elog1_report.json
- Chain heads at baseline: bridge 133 receipts (root `7e1b55c27b91604289f94e0c…`, merkle `7c75d79b501e3bb27c4d744e…`) · field 99 receipts (root `1eee2721d7d26a7ab9e7d986…`, merkle `637326ac135c6d1245ae9834…`) — both INDEPENDENTLY recomputed from the WORM files.
- Next.js integrity: **MATCH** (runningHash `0f8d26bf5364aaf796819d5f…`)
- Submission: JCS-canonical payload (`canonicalize()`, RFC 8785 subset — key sort, no whitespace, safe integers), Ed25519 signature by `dev_6977e62cbbff4fa4`, POST `/api/bridge/take`.
- **Receipt:** wormSeq **2** · merkleLeaf `11968da8b94b56b621de48f18b19727360b3265d58af921327bea3c5741320d2` · chainRoot `11968da8b94b56b621de48f18b19727360b3265d58af921327bea3c5741320d2` · merkleRoot `07ff55349ef5265210533a87e0c52c60a03ff0f7573f73535f1b2d1163778739`
- Independent verification: ledger file re-read · chain recomputed from genesis · entry 2 hash matches · merkle inclusion proof verified (5 siblings → root match) · service root cross-checked.
- Artifact: `ProofBridge/LOG_1.json` (signed payload + receipt + verification).

- PASS — git HEAD captured: 7e52b6f4fe74c269… (+3 dirty, recorded)
- PASS — runner devID registered (scope operate): dev_6977e62cbbff4fa4
- PASS — LOG_1 submitted to control plane (/api/bridge/take): pre-run ledger 1 entries · HTTP 200
- PASS — LOG_1: ledger chain valid from genesis: checked 2 · head 11968da8b94b56b6…
- PASS — LOG_1: entry 2 == receipt merkleLeaf: log.baseline · 11968da8b94b56b6…
- PASS — LOG_1: merkle root recomputed from file == receipt: 07ff55349ef52652…
- PASS — LOG_1: chain head == receipt chainRoot: 11968da8b94b56b6…
- PASS — LOG_1: merkle inclusion proof verifies: 1 siblings → root match
- PASS — ProofBridge/LOG_1.json written: sha256 67e4f9a7b09e80a5…
- PASS — LOG_1 artifact git-committed (tree snapshot): 3be4fe7b2086845f…

### Tree fingerprints (sha256, first-16)

- `src/app/page.tsx` — `1c12fbd6c4563c90…`
- `src/app/layout.tsx` — `0fc927b9113196ce…`
- `src/lib/proofbridge/jcs.ts` — `885410cbb4895bc5…`
- `src/lib/proofbridge/governance.ts` — `cd4b1db8d84c972a…`
- `src/lib/proofbridge/merkle.ts` — `e065e6a41fe6c792…`
- `src/lib/proofbridge/tier.ts` — `ab0dcfb6bb79f068…`
- `src/app/api/bridge/take/route.ts` — `62255406e8039227…`
- `src/app/api/bridge/dev/route.ts` — `20b3cf66e018d4c2…`
- `src/app/api/bridge/governance/route.ts` — `047495e3b5d36098…`
- `mini-services/vault-bridge/index.ts` — `3e45354a8da57436…`
- `runner.sh` — `bb07b8d3f21ddb58…`
- `tests/e2e-log1/run-e2e.ts` — `477ddbcadaaf2b1f…`

## Phase 2 — rule wiring (LOGS 2–7)

Each rule is a signed `rule.wired` take by the runner devID (authority: the operator brief — never claimed as an operator signature). A rule enforces from the moment its ledger event exists; a rule with no ledger event is not a rule.

| Log | Rule | Ledger state |
| --- | --- | --- |
| LOG_2 | VVU-devID Mandatory — all takes carry a signed devID; no ID = no scope | **WIRED** @ wormSeq 3 (2026-09-16T01:47:25.575Z) |
| LOG_3 | LogID Ledger Adherence — unsubmitted responses are null and void; only chain-verified takes count | **WIRED** @ wormSeq 4 (2026-09-16T01:47:25.579Z) |
| LOG_4 | Automatic DH + Warning — violations trigger immediate disciplinary hold (revocation) and a formal warning | **WIRED** @ wormSeq 5 (2026-09-16T01:47:25.583Z) |
| LOG_5 | Session-Identity Enforcement — sessions are not accounts; authority requires valid credentials, not assertions | **WIRED** @ wormSeq 6 (2026-09-16T01:47:25.586Z) |
| LOG_6 | Scope Ladder — propose (lowest) through admin (operator-only), enforced at the control plane | **WIRED** @ wormSeq 7 (2026-09-16T01:47:25.589Z) |
| LOG_7 | QR-as-Role-Grant — QR is bootstrap only; credentials define scope; expiry/revocation terminates authority | **WIRED** @ wormSeq 8 (2026-09-16T01:47:25.595Z) |

- PASS — LOG_2 rule.wired take accepted: HTTP 200 
- PASS — LOG_2: ledger chain valid from genesis: checked 3 · head db81aa302148ee32…
- PASS — LOG_2: entry 3 == receipt merkleLeaf: rule.wired · db81aa302148ee32…
- PASS — LOG_2: merkle root recomputed from file == receipt: 879ada72c0829779…
- PASS — LOG_2: chain head == receipt chainRoot: db81aa302148ee32…
- PASS — LOG_2: merkle inclusion proof verifies: 2 siblings → root match
- PASS — LOG_2 ACTIVE on the ledger after wiring: wired at wormSeq 3
- PASS — LOG_3 rule.wired take accepted: HTTP 200 
- PASS — LOG_3: ledger chain valid from genesis: checked 4 · head 3ca796730f4f1d6e…
- PASS — LOG_3: entry 4 == receipt merkleLeaf: rule.wired · 3ca796730f4f1d6e…
- PASS — LOG_3: merkle root recomputed from file == receipt: 1f8f694cac09f9d5…
- PASS — LOG_3: chain head == receipt chainRoot: 3ca796730f4f1d6e…
- PASS — LOG_3: merkle inclusion proof verifies: 2 siblings → root match
- PASS — LOG_3 ACTIVE on the ledger after wiring: wired at wormSeq 4
- PASS — LOG_4 rule.wired take accepted: HTTP 200 
- PASS — LOG_4: ledger chain valid from genesis: checked 5 · head 7dbc48041b77ab21…
- PASS — LOG_4: entry 5 == receipt merkleLeaf: rule.wired · 7dbc48041b77ab21…
- PASS — LOG_4: merkle root recomputed from file == receipt: 946c6a8f0dc9eef8…
- PASS — LOG_4: chain head == receipt chainRoot: 7dbc48041b77ab21…
- PASS — LOG_4: merkle inclusion proof verifies: 3 siblings → root match
- PASS — LOG_4 ACTIVE on the ledger after wiring: wired at wormSeq 5
- PASS — LOG_5 rule.wired take accepted: HTTP 200 
- PASS — LOG_5: ledger chain valid from genesis: checked 6 · head fcdbdc24fbda4a3c…
- PASS — LOG_5: entry 6 == receipt merkleLeaf: rule.wired · fcdbdc24fbda4a3c…
- PASS — LOG_5: merkle root recomputed from file == receipt: 7b454e9321f00971…
- PASS — LOG_5: chain head == receipt chainRoot: fcdbdc24fbda4a3c…
- PASS — LOG_5: merkle inclusion proof verifies: 3 siblings → root match
- PASS — LOG_5 ACTIVE on the ledger after wiring: wired at wormSeq 6
- PASS — LOG_6 rule.wired take accepted: HTTP 200 
- PASS — LOG_6: ledger chain valid from genesis: checked 7 · head 2dc40002bfcecee9…
- PASS — LOG_6: entry 7 == receipt merkleLeaf: rule.wired · 2dc40002bfcecee9…
- PASS — LOG_6: merkle root recomputed from file == receipt: da4c5c22340ad6ba…
- PASS — LOG_6: chain head == receipt chainRoot: 2dc40002bfcecee9…
- PASS — LOG_6: merkle inclusion proof verifies: 3 siblings → root match
- PASS — LOG_6 ACTIVE on the ledger after wiring: wired at wormSeq 7
- PASS — LOG_7 rule.wired take accepted: HTTP 200 
- PASS — LOG_7: ledger chain valid from genesis: checked 8 · head 36e90ea7c59e5076…
- PASS — LOG_7: entry 8 == receipt merkleLeaf: rule.wired · 36e90ea7c59e5076…
- PASS — LOG_7: merkle root recomputed from file == receipt: 4fd9486e83b98dc4…
- PASS — LOG_7: chain head == receipt chainRoot: 36e90ea7c59e5076…
- PASS — LOG_7: merkle inclusion proof verifies: 3 siblings → root match
- PASS — LOG_7 ACTIVE on the ledger after wiring: wired at wormSeq 8

## Phase 3 — enforcement wiring (negative tests)

All tests executed THIS run against the live control plane (:3004). "DH" = automatic disciplinary hold: violation ledgered (formal warning) + devID revoked + DH event queued (unsigned until the operator mints the admin devID).

| Test | Class | Expected | Actual |
| --- | --- | --- | --- |
| N1 | unsigned take (claimed registered devID, no signature) | 400 LOG_2 + violation ledgered + DH queued + devID revoked | HTTP 400 LOG_2 · dh=true |
| N2 | bad signature (valid devID, signature by another key) | 400 LOG_2 + DH | HTTP 400 LOG_2 · dh=true |
| N3 | unregistered devID (valid signature, never registered) | 403 LOG_2 (no ID = no scope) | HTTP 403 LOG_2 |
| N4+N5 | scope mismatch + session assertion (X-VVU-Session: admin, Cookie, assertedRole admin) | 403 LOG_6 — session grants NOTHING, scope from registry | HTTP 403 LOG_6 · dh=false |
| N5b | propose-scope dev takes a propose-level type | 200 (ladder floor works) | HTTP 200 wormSeq 16 |
| N6 | QR pairing token presented as take authority (signed-but-unregistered, then unsigned) | 403/400 — QR is bootstrap only, never take authority | signed-unreg HTTP 403 · unsigned HTTP 400 |
| N7 | expired devID (registered with 1.2s TTL, valid signature after expiry) | 403 LOG_7 (expiry terminates authority) | HTTP 403 LOG_7 |
| N8 | revoked devID (auto-DH'd by N1, now submits a VALID signed take) | 403 LOG_4 (disciplinary hold) | HTTP 403 LOG_4 |
| N9 | unsubmitted response presented as take authority (fabricated wormSeq 999999) | lookup 404 + take 400 LOG_3 + DH | lookup HTTP 404 · take HTTP 400 LOG_3 · dh=true |

### DH queue after the sweep (all QUEUED — operator handoff)

- `dh_e96c1cc69b22cca4` · dev_f4ca8a55eb38bb8d · LOG_2 · unsigned-take · **queued — awaiting operator admin devID (mint via QR action)**
- `dh_1e1537ec8934a0bc` · dev_793aafe73fe822aa · LOG_2 · bad-signature · **queued — awaiting operator admin devID (mint via QR action)**
- `dh_929d8387abaa525e` · dev_102677091ae70427 · LOG_2 · unsigned-take · **queued — awaiting operator admin devID (mint via QR action)**
- `dh_68cfa6ae25f0ba78` · dev_ca58d5858185a81a · LOG_3 · forged-authority · **queued — awaiting operator admin devID (mint via QR action)**

- PASS — N1 unsigned take rejected 400: HTTP 400
- PASS — N1 automatic DH fired (violation ledgered, devID revoked): dhQueue 0→1 · revoked 1
- PASS — N2 bad-signature take rejected 400: HTTP 400
- PASS — N2 automatic DH fired: dhQueue 1→2
- PASS — N3 unregistered devID rejected 403: HTTP 403
- PASS — N4/N5 scope mismatch + session assertion rejected 403: HTTP 403
- PASS — N5 scope came from the REGISTRY (no DH — mismatch is not forgery): no new DH events
- PASS — N5b propose-scope take accepted 200 (ladder floor honored): wormSeq 16
- PASS — N6 QR token cannot mint take authority: HTTP 403/400
- PASS — N7 expired devID rejected 403: HTTP 403
- PASS — N8 revoked devID rejected 403: HTTP 403
- PASS — N9 unsubmitted response is null and void (404 on lookup): HTTP 404
- PASS — N9 refSeq forgery rejected 400 + automatic DH: HTTP 400
- PASS — every DH event stays QUEUED (unsigned) — operator mint pending: 4 queued · 0 signed
- PASS — revoked devIDs are exactly the auto-DH victims: 4 revoked: dev_f4ca8a55eb38bb8d, dev_793aafe73fe822aa, dev_102677091ae70427, dev_ca58d5858185a81a
- PASS — enforcement.test transcript take ledgered: wormSeq 23

## Phase 4 — evidence pack (this document)

- Governance ledger final: 23 entries · head `4c953834f407a414445f0f1cfa9ee8bda6af23415aa4d173c9ac24ea58409cc7` · merkleRoot `ce65554f596ce08b9093c4cd1c633b483cf4404f531d62dda063b40c4c3b76d7` · chainValid `true` · rules wired 6/6 · DH queued 4 · revoked 4.
- Verification from genesis: **VALID** — 23 entries recomputed.
- This document's body sha256 (cited by LOG 8): recorded in the LOG 8 receipt below.

## Operator handoff (remaining, per the brief)

1. **Mint the operator admin devID** — the runner cannot and did not do this. It remains the operator's QR action. Until it exists, every DH event stays `queued` (unsigned) — visible at `GET /api/bridge/governance`.
2. **Define the DH cadence** — how often the queue is reviewed (daily / on-demand). The queue is on-chain and inspectable at any time.
3. **Confirm the DH definition** — this build implements DH as *revocation pending release* (disciplinary hold = authority terminated + queued event awaiting operator sign-off). If the operator's definition differs, the wiring is one ledger event away.

## Pre-run note (honesty)

The governance ledger is runtime state (`mini-services/vault-bridge/governance.json`, gitignored). Immediately before this run it was reset to empty after bring-up smoke tests (entries labelled `smoke: true`, made minutes earlier by the same operator-session build). LOG 1 is therefore the first official ledger entry. The runner itself deletes nothing; on re-run it records the pre-existing ledger state honestly.

## LOG 8 — evidence.close receipt (post-body)

- Cited body sha256: `7a976560aa1e9c2a5052ee0f91240442b594372417bfa017b60d0291b420348f`
- Receipt: wormSeq **24** · merkleLeaf `bb18de8d848799ca0dac3cf3dabb237c3ac59fdf9ef8c21b626f16cf8361dec1` · chainRoot `bb18de8d848799ca0dac3cf3dabb237c3ac59fdf9ef8c21b626f16cf8361dec1` · merkleRoot `67b252f4012f6f861823491fbe8b6685e3186c186e0e7c37a2006a5a6b058121` · ts 2026-09-16T01:47:27.265Z
