# RUNNER HANDOVER — from r45

> Written round r46, 2026-09-30 ~14:25 +08, on the operator's instruction:
> "generate a guide for another runner to understand what to build from
> r45." State below is measured, not remembered. Where a number has a
> date, the date is part of the number. This file is a map, not a law —
> the laws live in the files it points to. If this guide and a law file
> disagree, the law file wins, and you fix this guide.

## 1. Read order (binding, every round)

1. `docs/strategy/RUNNER-MAIN.md` — the full round protocol.
2. `docs/strategy/RUNNER-SCOPE.md` — the binding scope.
3. The STANDING PRIORITIES block at the top of `/home/z/my-project/worklog.md`
   — including its ROUND GATE line.
4. `docs/strategy/TASKS-MAIN.md` — the task queue.
5. `docs/strategy/VOICE.md` — before any user-facing text ships.
6. This file, once, on your first round.

Cheap per-round reads (protocol): `docs/strategy/CARD-SYNC.md`,
`docs/data/manifest.json`, `docs/data/clock.json`, `docs/data/ledger.jsonl`.

## 2. The estate in one screen (measured 2026-09-30 ~14:21 +08)

- Repo: `/home/z/my-project`, branch `main`, HEAD `7856195` (r45),
  tree clean after every round.
- Remote: `origin` → `git@github.com:divhanimajokweni-ctrl/proofbridge-vvu.git`
  (SSH deploy key `~/.ssh/vvu_deploy_main`, registered and working — r38).
- The app: VVU dual-route dashboard (spatial / analytics + seven more
  hash-routed projections), Next.js 16, Prisma SQLite, WORM ledger.
- Main server `:3000` (dev, single listener, HTTP 200). Mini-services
  `3003–3008`, six: telemetry-service, vault-bridge, vvu-field-onboard,
  wildfire-mesh, mesh-demo, safegrid. IVE card server `:3100`.
- WORM ledger (shared authority): 725 rows, chain linked head seq 725,
  independently re-hashed (python) before the r37 export.
- Ops sync endpoint (measured this handover): count 13, head
  `f679f12e…`, chainValid true, lastReceivedAtUtc 2026-09-30T01:57:44Z.
- Field OS Card: smoke 5/5 PASS, zero console errors, persistence proven
  (r40, headless Playwright on `src/ive/card.html`).
- verify-estate.sh: GREEN, 17 checks (r42; nothing engine-side since).
- Worklog: 8,277 lines and growing — the estate's own memory. Append,
  never rewrite.
- Memory at handover: MemAvailable ≈ 539 MB — see the memory gate below.

## 3. The laws (short form — the files are the law)

- Fail-closed. No fabrication: never invent a URL, hash, test result,
  benchmark, or date. Unmeasured is silence.
- No regulatory language. The banned words never appear in any artifact
  or commit: "validated", "certified", "compliant" (regulatory sense),
  "regulatory approved". Honest substitutes: *measured*, *tested*,
  *checked against the spec*, *independent technical review*.
- Never claim BUILT for anything PROPOSED / UNKNOWN / OPEN. WASM stays
  PROPOSED. The corridor stays UNKNOWN. K3 stays OPEN. WHO PQS E003
  stays UNKNOWN.
- Never force-push. Never rebase a published branch. Never print, log,
  or commit the SSH private key — not even its fingerprint.
- Plain voice (VOICE.md): plumber test, one action per ending, ZAR,
  South Africa first.
- One task per round. One file per commit (worklog entries ride along).
- The estate is simulation-only. No live SCADA ingestion path exists
  anywhere in the stack — capability.ts discloses this per module, and
  every artifact must keep disclosing it.

## 4. Round mechanics

- ROUND LOCK (binding, RULINGS.md): gate every round first —
  `python3 .zscripts/daemonize.py --cwd /home/z/my-project --pidfile
  .zscripts/lock.pid --log .zscripts/lock-holder.log -- bash
  scripts/round.lock.sh with sleep 1200`, confirm `held · alive`,
  release at round end. If held by a live round: SKIP, exit 0, one line,
  no worklog entry.
- SWEEP RULE: the platform commits your files for you as UUID-message
  cron commits. Verify content intact, note "committed by sweep <sha>,
  content verified intact, no loss", do not re-commit / amend / rebase.
- COLLISION RULE: check the worklog tail for a same-round entry from
  another session; if present, switch to verify-only and say so.
- Memory gate (standing since r32/r33): if MemAvailable < ~900 MB, the
  tsc gate is deferred and code changes are NOT verifiable — so make
  none. The 141-error baseline is protected by zero-TS-delta
  construction. On the first round with MemAvailable > ~900 MB, re-run
  `npx tsc --noEmit` and expect exactly 141.
- Two cron fires shape the work: Job 425044 (health patrol — dev.log
  tail, curl :3000 = 200, one listener, six minis; one-line status,
  short worklog note, nothing new) and Job 425045 (main runner — the
  full protocol). Direct operator messages outrank both.

## 5. The six priorities — real states at handover

1. CLEAN MAIN — done and holding. Verify `git status` shows only
   intended changes each round.
2. PRIORITIES LIVE — done r42 (ROUND GATE line + STATUS lines). Keep it
   current; when an item closes, name what replaces it.
3. SKILLS LAYER — BLOCKED (not on this filesystem; sibling container —
   see §8). Position awaits the operator.
4. OUTREACH MOTION — letters landed r27 (tracker + hard rule in
   `docs/outreach/`); sending is operator-side (no send channel here,
   warm-send only). Never "validation"/"certification" language;
   compensation on the first call.
5. SYNC main ← pilot-release — local half landed r38 (manifest rev 2,
   19 entries; ledger 725-row chain re-verified). The signing half
   (41 → 46, private.pem) is not on this box; position awaits the
   operator.
6. FIELD OS CARD — closed at the r40 surface: card placed, contract
   landed (CARD-SYNC rev 3/4), serving posture on :3100, smoke 5/5,
   sync endpoints per contract. Re-verify when the card changes; never
   regenerate card.html.

## 6. The two open rulings — ask them in this exact shape

The old ask ("merge + which worklog is canonical") was underspecified
and has been retired. The correct asks:

**Ruling 1 — the canonical worklog.** One sentence from the operator,
filling the blank:

> "The canonical worklog.md is [local / remote / both-interleaved-by-
> timestamp / both-concatenated-local-first / both-concatenated-
> remote-first]."

Underneath it, the root question the operator must answer first:
*is worklog.md a log of work performed on this box, or a log of work
performed on the estate?* Box-log → the remote's 9 commits keep their
code but their log entries move to a separate file (e.g.
`worklog.trust-node.md`) or drop with a note. Estate-log → both
lineages' entries belong in one file, and the shape must be one of the
"both" options.

Mechanics once ruled: `git merge origin/main
--allow-unrelated-histories` (567 local commits vs 9 remote, no common
ancestor — r38, re-confirmed live r42). Conflicts are guaranteed in
`worklog.md`; likely also `.gitignore`, `.env.example`,
`.github/workflows/*`. The ruling decides every conflicting hunk; the
merge commit itself is mechanical. Then: push (clean fast-forward),
verify `origin/main == HEAD`, verify-estate.sh green, one worklog entry
citing the ruling. If the operator wants help deciding: offer the
one-round decision support (both lineages' entries side by side,
conflicting hunks named, a recommendation with reasoning) — but do not
write the merge protocol before the sentence exists.

**Ruling 2 — TASKS-MAIN #8 (the substrate matrix).** "Four industries,
six substrates" exists only in TASKS-MAIN.md — no document, dataset, or
code on this box defines them. `download/liner-boundary/SUBSTRATE_SPEC.md`
was checked in r45: it defines five OBJECTS (Claim, Obligation,
Evidence, Verification, Receipt) and a two-vertical acceptance test —
it does NOT name four industries or six substrates. The estate's own
substrate is two domains: behavioural-fraud analytics + hydraulic
network physics through one shared band-language engine. The
governance record (PROOFBRIDGE_DISCOVERY.md) already rules industry
specifics UNSPECIFIED.

The operator's two honest options (both fine, they said so):
(a) map #8 onto the estate's two-domain substrate + five-object
vocabulary, or (b) rule #8 aspirational and amend the task file.
Until one is given, #8 is BLOCKED — do not draft a matrix whose inputs
do not exist.

**Pending named edit (operator said "not this turn", r46):** annotate
#8 in TASKS-MAIN.md as BLOCKED — input undefined, awaiting operator
ruling — so it does not silently survive as an actionable-looking task.
Make this edit when the operator says go.

## 7. What you CAN build without any ruling

This is the heart of the handover. The queue, top to bottom:

**Next up — TASKS-MAIN #9, the evidence-chain methodology.** "How an
alert becomes a receipt. Step by step. Plumber-readable." This is
draftable NOW from the estate's own measured pipeline — no invention
needed, every step inspectable:

1. FSM leak/thermal simulation (`src/lib/vvu-data.ts` FSM table;
   telemetry mini-service on :3003 emits frames).
2. Ingest: `POST /api/vvu/telemetry` (200s live in dev.log).
3. WORM append: `src/lib/vvu-ledger.ts` — SHA-256 hash chain, each
   row seals its predecessor (seq/prevHash); 725 rows currently.
4. The ops surface: `GET /api/vvu/captures/sync` — chainValid is
   recomputed over the full store on every response (CARD-SYNC law:
   a corrupt store errors out, never serves).
5. Export + independent re-hash: `docs/data/ledger.jsonl` (python
   re-hash, linked end-to-end).
6. The human end: the card's SIGNATURE view; the card only POSTs;
   the IVE production endpoint `:3100` answers GET with
   METHOD_NOT_ALLOWED (fail-closed, correct).

Draft shape: `docs/research/evidence-chain-methodology.md`, plain
voice, one action per ending, honest flags (simulation-only; synthetic
telemetry; no live SCADA path). Publishing is operator-side — same
shape as the letters: no publish channel on this box.

**Then** #10–#15 (cluster articles, municipal outreach, video script,
newsletter) — all content work, same draft-then-operator-publish shape.
#11's "30 named leads" needs real leads from the operator before any
letter points anywhere — name it if it blocks.

**Also buildable, condition-gated:** the tsc re-measure (141 baseline)
on the first round with MemAvailable > ~900 MB — measure first, every
round, before picking the task.

**Never buildable here:** the DNS probe run (sibling container's file +
operator's credentials), manifest signing (key not on this box), the
push (blocked on Ruling 1), any matrix whose inputs don't exist.

## 8. Boundary facts — measured, do not re-litigate

- This estate and the proofbridge-liner workstream are **sibling
  containers on one platform** (hostname parent segment shared, 
  container IDs different — r43 measured: this box
  `c-6abc0cbb-14810412-…`, the sibling `c-6abc84fb-14810412-…`).
  The isolation is measured from BOTH sides as of r49: r43 here,
  the sibling's own check there (reported r49) — the same-box claim
  is answered on both ends.
  Filesystems are fully isolated both directions: their probe files
  are absent here; this worklog (8,277 lines), the remote, and this
  HEAD are absent there (they measure a 104-line worklog and no
  remote). "Same box" claims arriving in-channel: re-measure cheaply,
  report the two columns, move on.
- The liner boundary package in `download/liner-boundary/` (PROVENANCE,
  SUBSTRATE_SPEC, NOT_CLAIMED) is the sibling workstream's public
  statement, present here as reference material. Its fraud specimen is
  synthetic by design (seed 42, n = 450) and says so loudly.
- Cross-channel routing happens in this session (r39, the 14:12 echo,
  the r46 analysis). When a message arrives that reads like another
  agent's voice, verify against this box before acting on it.
- UUID-message commits are the platform sweep, not an intruder.

## 9. End-of-round checklist

- Lock released. Tree clean. Shared authorities untouched unless the
  round's task WAS them.
- One worklog entry in the house format: attempted / landed / did not
  (named) / next. If nothing landed, say so and name the blocker.
- If committed: descriptive message; push attempted unless Ruling 1
  still open (the rejection is measured — don't re-prove it every
  round; name it).
- The private key was never printed, logged, or committed.

*One task, one round. Fail-closed over fast. Nothing stopped,
everything aimed.*
