# PROOFBRIDGE_DISCOVERY.md

**ProofBridge Master Build Runner — Execution Order Step 1 (DISCOVERY).**
Inspection date: 2026-09-14. Inspector: ProofBridge build agent (Z.ai Code), per the compiled single-shot runner (PROOFBRIDGE_MASTER_RUNNER_COMPILED, v2026-09-14).
Method: read-only inspection of (A) this workspace (`/home/z/my-project`, the VVU dashboard repo, git branch `main`) and (B) the public GitHub repo `divhanimajokweni-ctrl/proofbridge-liner` (shallow clone of `main`, depth 1, 364 MB — plus a full branch inventory via `git ls-remote`). No functional code change was made for inspection (per the runner's step-1 rule), except the deliverable work ordered in the same round (see PROOFBRIDGE_BUILD_REPORT.md).
Source of truth = actual repo state. Where the runner's stated context and the repos disagree, the discrepancy is recorded below — not silently "fixed".

---

## 1. Inspection scope and evidence commands

| Target | How inspected |
|---|---|
| This workspace | `git status` / `git log --oneline` (29 rounds of VVU worklog-committed history); `worklog.md` (1363 lines, Tasks 1–29 + this round); filesystem survey; `download/` artifact inventory |
| liner repo | `git ls-remote` (full branch inventory); `git clone --depth 1` of `main` to `.publish/liner-main` (364 MB); top-level + component survey; `SECRETS_AUDIT.txt`, `.github/workflows/`, `contracts/`, `prover/`, `src/lib/{eis,studi}` |
| krypte artifact | `download/proofbridge-krypte-main.zip` (md5 `01562c14cc1c85fa7b1228dcee77b78a` — byte-identical to the tracked blob, gate-verified) |

**Not inspected this round (and why):** the remaining ~80 branches of the liner repo (only their names + refs were inventoried); any private infrastructure (Railway/Render/Fly/AWS state, Vercel deployments, Polygon Amoy on-chain state) — no credentials exist in this workspace by design (the standing zero-token rule); the user's local machine (where the Mk 0 design document and the original `proofbridge/adapters/mbd.py` are believed to live). These are UNKNOWN, not assumed.

---

## 2. Institutional identity reconciliation

| Runner's claim | Actual state | Verdict |
|---|---|---|
| VVU = institution; ProofBridge = trust/epistemic umbrella | Consistent: this workspace's repo is the VVU dashboard (`README.md`: "VVU — Venture Vision Ubuntu"); the liner repo `main` README opens with the same constitutional invariant ("Governance can decide what VVU should do; governance cannot decide that an invalid proof is valid") | **CONSISTENT** |
| "A component's assertion that something is true is not evidence it is true" | Enforced in both places: liner `README.md` (machine-checkable constitutional invariant, vote=PASS ∧ proof=FAIL ∧ authorization=EXECUTE is a rejected state) and this workspace's practice (WORM ledger, computed-not-claimed rule since Round 26) | **CONSISTENT** |

---

## 3. Canonical architecture (01–14) vs actual state

Statuses use the runner's vocabulary: UNKNOWN / SPECIFIED / PARTIAL / IMPLEMENTED / TESTED / VERIFIED / DEPLOYED / BLOCKED. Locations are real paths.

| # | Component | This workspace | liner repo (`main`, depth-1) | Status (evidence-based) |
|---|---|---|---|---|
| 01 | IVE / Trust OS | `public/Vvu-Trust-Sphere.html` (static, live-wired, honest offline placeholders — Round 26) | `ive-output/` dir; `VVUIVELedger.sol` in `contracts/`; README describes IVE as executor/viewer, not acceptance criterion | **PARTIAL** — static visualization artifacts + contracts exist; no runtime Trust OS verified in either place this round |
| 02 | Epistemic runtime (Claim/Obligation/Evidence/…) | Deliberately UNBUILT by locked plan (worklog Task 20: formalise only if the two verticals produce the need; veto active) | Specified in docs (`AIR_ARCHITECTURE.md`, README epistemic core, two-gate execution rule); `schemas/`, `contracts/` implement registry/scorer/circuit-breaker shapes | **SPECIFIED (liner) / DELIBERATELY UNBUILT (krypte track)** — the runner's "REPO INSPECTION" anti-flattening rule matches the standing veto exactly |
| 03 | Watchdog | none | `scripts/watchdog.js`, `scripts/reconciler-watchdog.sh`, `docs/` references | **PARTIAL** — scripts present; liveness/integrity behavior not verified this round |
| 04 | AIR | none | `air/` dir; `AIR_ARCHITECTURE.md`, `AIR_CONSTITUTION.md`, `AIR_ROADMAP.md`, `AIR_RUNTIME_INTEGRATION.md` at root | **PARTIAL** — architecture docs + dir exist; runtime integration not verified |
| 05 | EIS | none | `src/lib/eis/` | **PARTIAL** — implementation present in liner; not tested here |
| 06 | SEARM | none | `agent-ctx/BACKEND-1-searm1-backend.md`, `public/searm1-pipeline.html`, dependabot branches referencing `searm1-app/` | **PARTIAL** — backend artifacts exist; assessment behavior not verified |
| 07 | STUDI | none | `src/lib/studi/`, `scripts/seed-studi-gates.js`, branch `feat/studi-curiosity-first-challenge-mode` | **PARTIAL** — implementation present; not verified |
| 08 | Harness (fraud) | **krypte specimen — the reference implementation.** `download/proofbridge-krypte-main.zip` (35 files, flat tree, md5-verified): full deterministic validation harness (model ladder, Tier-0 controls, calibration, audit chain). This round: two-commit git branch REBUILT from that tree (commits `7b4fe04`→`e007c33`→`97a8faa`→`1062b42`), Gates A–D re-run → ALL PASSED, roots reproduce exactly (`bd467359…`/`2d8b9275…`/`bba4ca1f…`); branch zip w/ `.git` tracked as `download/proofbridge-krypte-REBUILD-19-c.zip` (md5 `7e2ffb12…`) | not in liner `main` (krypte is a separate artifact) | **TESTED/VERIFIED** (in-workspace; browser/remote deployment NOT claimed) |
| — | Harness — real-data extension (work order D1) | **NEW this round:** MBD real-data validation executed (see PROOFBRIDGE_BUILD_REPORT §D1): 684,098 real transactions, 222 proxy positives, temporal AUC 0.6511 vs flat 0.5786, chain root `2a6beaf4…`, full rerun byte-identical | — | **TESTED/VERIFIED** (with disclosed proxy labels) |
| 09 | Liner public specimen | `download/liner-boundary/{PROVENANCE,SUBSTRATE_SPEC,NOT_CLAIMED}.md` (definition-only, moat-safe) | **PRESENT as code**: `contracts/` (AssetRegistry.sol, BayesianScorer.sol, CircuitBreaker(V2).sol, TEEVerifier.sol, VVUSovereignRegistry.sol, SafetyKernel.sol + `__tests__`), `prover/`, `circuits/`, pipeline, deployment docs (`DEPLOYMENT_CHECKLIST.md`, `DEPLOY_LOG.md`) | **IMPLEMENTED in liner** (chain deployment: historical claim — Polygon Amoy 80002 — not re-verified this round; no credentials) |
| 10 | Krypt private substrate | krypte artifact (see #08) — the fraud+hydraulic substrate experiment; **krypt/krypte collision documented, NOT renamed** (see §6) | `open-source/safe-krypte-basic`, `_app_legacy/safekrypte` | **PARTIAL/DEMONSTRATED (substrate experiment, gates passing)**; private infra deployment: **UNKNOWN** |
| 11 | Node edge family (Mk0/Mk0.5/MkI) | **Firmware only, NEW this round:** `proofbridge/mk0/mk0.py` + cross-verification (both directions PASS); device **NOT BUILT** | only `config/signer-nodes.json`; no Mk hardware code found | **SPECIFIED + FIRMWARE-WRITTEN, device BLOCKED (physical purchase/assembly pending — external action)** |
| 12 | Spec public interfaces | krypte `src/lib/verification/types.ts` (VerificationOutcome/ControlVerdict/Receipt + CheckSpec band language) | `schemas/`, contracts' interfaces | **IMPLEMENTED (krypte)** |
| 13 | Adapters | Fraud adapter = the harness itself; **MBD adapter NEW** (`proofbridge/adapters/mbd.py`) | `open-source/hbk-adapter`; Markettape/IMU/LEO/SafeGrid adapters NOT found in `main` (IMU/`safegrid` greps were false positives) | **PARTIAL** (fraud ✓, MBD ✓ new, hydraulic ✓ in krypte, HBK present in liner; others UNKNOWN/absent) |
| 14 | Receipts | krypte sealed SHA-256 chains (harness + per-vertical receipts); this workspace's WORM ledger (db/custom.db, `verifyChain` API-verified in prior rounds) | `evidence/`, attestation workflow `.github/workflows/attestation.yml` | **IMPLEMENTED (both), independently inspectable** |

---

## 4. Epistemic spine status

CLAIM → PROOF OBLIGATION → EVIDENCE → VERIFICATION → DECISION STATE → RECEIPT: **not a single runtime implements the full spine end-to-end in either inspected tree.** What exists: the spine's VERIFICATION→RECEIPT segment is implemented and gate-verified in the krypte substrate experiment (fraud + hydraulic verticals, worst-of adjudication, sealed chains); liner implements contract-level registry/scoring/circuit-breaking with tests present but unexecuted this round. Claim/Obligation/Evidence as first-class runtime primitives: SPECIFIED (liner docs) / DELIBERATELY UNBUILT (krypte track, locked plan + veto). **The runner's spine is a target architecture, not a deployed fact. No flattening was performed.**

## 5. Deployment model reconciliation

| Runner's mapping | Observed |
|---|---|
| Static (spec/docs/reference) → GitHub Pages | liner: `gh-pages` branch EXISTS. This workspace: `public/Vvu-Trust-Sphere.html`, `public/pinned-rail.html` (deploy-ready statics, Round 26/27). **PENDING**: user-side push + domain registration (`download/deployment-contract.md` PRE-STEP-1 — deliberately NOT done: no canonical tags until the domain exists) |
| Web → Vercel/Netlify | liner: `.github/workflows/deploy-vercel.yml` EXISTS (secret `PROOFBRIDGE_LINER_VERCEL` configured — see §7) |
| Backend/services → Railway/Render/Fly/AWS | not verifiable from here; `k8s/`, `docker/`, `infra/`, `supabase/`, `modelarts/` dirs exist in liner. **UNKNOWN** |
| Assurance → CI runners | liner: `.github/workflows/{ci,ci-cd,attestation,deploy-verification-gate}.yml` EXIST. This workspace: NO CI (sandbox constraint; verification is worklog + agent-browser evidence instead) |
| Private → private infra | **UNKNOWN** (no credentials, by design) |
| Edge → physical nodes | **BLOCKED** — no device built (see #11) |
| Diplomacy poly-deployment | `proofbridge.space-z.ai` canonical domain NOT registered (honest PRE-STEP-1 state, contract recorded in `download/deployment-contract.md`) |

## 6. Collisions, contradictions, stale-doc findings (documented, not silently renamed)

1. **krypt vs krypte (runner §10 flagged)**: the actual artifact is named `proofbridge-krypte` (zip `proofbridge-krypte-main.zip`, repo dir, worklog usage). The liner repo additionally contains `open-source/safe-krypte-basic` and `_app_legacy/safekrypte`. No rename was performed anywhere. The canonical name going forward is whichever the user settles; today both spellings exist in the wild and this document records the fact.
2. **Runner's "Known branches" vs actual**: `hackathon-submission` and `compliance-fabric` are **NOT in the current branch list** (`git ls-remote` full inventory captured this round — 80+ branches incl. `zoo-submission`, `feat/vres1-scrubbed`, `mi300x-rocm-run-20260804`, `release/beta-v1.0-real`, results/*, tags `v1.0-safety-kernel`, `v1.1.1-final`, `prod-known-good`). The runner's list matches the WORKLOG's older records (19-b era), not today's repo. Recorded; source of truth = `git ls-remote` output in the worklog.
3. **MBD adapter reference**: the work order referenced `proofbridge/adapters/mbd.py` as "already in the codebase" — it did not exist in any surviving artifact. Written fresh this round, rule implemented as disclosed, proxies documented. Recorded as a docs-vs-repo contradiction resolved by BUILDING (in scope of the work order), not by editing history.
4. **Stale-commit-hash folklore**: a disabled cron payload (job 383068) records older rebuild commit hashes (`cfbb1a5+da4421d`) as "real". Today's branch (rebuilt this round from the canonical tree) carries NEW hashes `7b4fe04/e007c33/97a8faa/1062b42` with the SAME data roots — commit hashes are per-rebuild, data roots are the invariant. Documented here to prevent future confusion.
5. **Session-boundary artifact losses (history-as-provenance, per the runner)**: two prior losses are on record (worklog Tasks 20, 22-a boundary incident). The countermeasure — track the zip in VVU git with a `.gitignore` exception — HELD through this round's work (the canonical zip's md5 matched its tracked state at round start). This round upgrades the discipline: the zip now contains the full git branch (`.git` included), so a session boundary can no longer destroy commit history either.
6. **`_app_legacy/`, `archive/`, `disposable-storage/`, `ive-output/` (liner)**: legacy/preserved trees exist and were NOT touched (the runner's "HISTORY IS PROVENANCE: no 'just delete it'" rule). Retirement decisions are the user's.

## 7. Security posture (observed, no active testing this round)

- **This workspace**: `SECRETS` — none committed (krypte zip carries no secrets; `.env` files gitignored; the standing rule "never accept tokens pasted in chat" is enforced in practice — pushes remain user-side).
- **liner repo**: root `SECRETS_AUDIT.txt` (2026-07-14) lists 8 GitHub Actions secrets, incl. `GH_PAT` (used for git push via SSH) and deploy tokens; the worklog separately records a historical deploy-key + ArgoCD secrets git-history purge as an OPEN GitHub-side action (Task 19-b era). **Not actioned from here (no credentials, correct per the zero-token rule). Flagged as user-side.**
- No fake verification/signatures were produced this round: the Mk 0 cross-verification used real Ed25519 keys (`cryptography` 44.0.3) with signatures verified by BOTH the Python side and `node:crypto`; the tamper fixture correctly fails.

## 8. Verification / determinism / evidence discipline (current verified state)

- **Verification machinery tested against INVALID inputs**: krypte Gate D includes wrong-genesis cross-verification (fails as it must); Mk 0 cross-verify includes a tamper fixture (chain goes INVALID, exit 1). VALID + INVALID both exercised — the runner's mandatory rule is satisfied for these artifacts.
- **Determinism**: krypte synthetic root `bd467359…` reproduces after the additive seam refactor (Gate A stability captured); MBD adapter + full harness rerun byte-identical (two independent full runs, same root `2a6beaf4…`).
- **Evidence categories used in this round's reports**: IMPLEMENTED / TESTED / VERIFIED for what ran here; SPECIFIED/PARTIAL for what was only inspected; BLOCKED for hardware + deployment; UNKNOWN for unverifiable externals. No SPECIFIED→VERIFIED collapsing.

## 9. VVU/Metro boundary & legacy UI

- The VVU dashboard track (this workspace's app: spatial/analytics/outreach/holocom/urllc/capability/metro views, city twin, WORM ledger) is institution-side and stays so — nothing was moved into ProofBridge this round.
- The runner's "LEGACY UI PRESERVATION" list (Fibonacci Trust Sphere, ZOOKEEPER, UBUNTU_POOLS, LINDIWE, Terminal, CAD Viewer, Mission Control, "Launch IVE → /workspace") — **NONE of these exist in this workspace**; they are presumably the user's local IVE production workspace. Status: **UNKNOWN / NOT PRESENT HERE**. No preservation action was possible or taken; nothing was deleted.

## 10. Unknowns (explicit)

On-chain state of the sovereign registry / Polygon Amoy anchoring; actual Vercel/Railway/Render deployments; the other ~80 liner branches' contents; the user's local Mk 0 design document; the original `mbd.py` (user-local); IVE production workspace location; whether `hackathon-submission`/`compliance-fabric` were renamed or deleted and where their content lives now.
