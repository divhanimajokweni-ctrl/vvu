# RULINGS.md — operator rulings, verbatim

Recorded by the main runner, 2026-09-30, from the operator's live
message (trace `1a0efb98fb125351`). Pasted as-is, per instruction.
These rulings bind every round and every session on this box. The
round-start collision check below is part of the round protocol from
now on.

---

## 1. Double-delivery collision rule

```
Collision rule: single-builder, verify-only second.

The session that owns the active build task is the builder. Any other
session that receives the same pivot becomes verify-only — it reads,
tests, and reports, but does not write to the same paths.

If a second session finds a real defect, it writes a report, not a
commit. The builder fixes it. No two sessions write to the same file
in the same round.

Collision already occurred twice. From now: on every round start,
check worklog tail for a same-round entry from another session. If
present, switch to verify-only and say so in your entry.
```

## 2. Sweep attribution rule

```
Sweep rule: accept-and-ledger.

The auto-commit sweep captured in-progress work twice. Content was
intact both times. Do not fight the sweep. If the sweep commits your
files before you do:

- Note it in the worklog entry: "committed by sweep <sha>, content
  verified intact, no loss."
- Do not re-commit, do not amend, do not rebase.
- Continue.

Age-gating or manifest-scoping the sweep is a separate work item.
Note it, do not implement it this round.
```

## 3. Route decision — B

```
Route decision: B.

Re-target the IVE route.ts to the main app's existing db/prisma
export and the existing vvu-ledger sha256 chain. Do not build a new
WORMChain class. Do not wire to localhost:8787 — that service is not
running.

If the main app's db export doesn't fit the route's needs, report
exactly what's missing. Do not invent it. Do not fall back to C
without reporting first.
```

---

Landed under this ruling set (same day, main-runner round r21):
route B implemented in `src/ive/app/api/vvu/captures/sync/route.ts`;
measured OutreachTarget mismatch reported, nothing invented; the
localhost:8787 WORM client (`src/ive/lib/worm.ts`) left in place as
SPEC-ONLY and now unreferenced by any route.

---

## 4. Round lock holder mode amendment (r32)

Recorded by the main runner, 2026-09-30, from the operator's deliverable
pack (deep-dive message, this session). The operator's text verbatim:

```
### AMENDMENT: ROUND LOCK HOLDER MODE (r31)
**Original Ruling:** The round lock is held by a `nohup` process.
**Problem:** The sandbox session reaper kills `nohup` processes when the
parent shell exits. This results in a "dead-pid lock" that provides no
mutual exclusion.
**Amended Ruling:** The round lock MUST be held using `daemonize.py`.
**Command:**
python3 /home/z/my-project/.zscripts/daemonize.py \
  --cwd /home/z/my-project \
  --pidfile /home/z/my-project/.zscripts/lock.pid \
  --log /home/z/my-project/.zscripts/lock.log \
  -- bash -c 'echo "LOCK HELD"; sleep 3600'

Verification: ps -p $(cat .zscripts/lock.pid) must show a live process.
```

ESTATE INTEGRATION (named, r32): the working command pairs daemonize.py
with the lock script's own wrapper so the holder acquires the real lock
state (the operator's `bash -c` sketch holds a sleep, not the lock dir):

    python3 .zscripts/daemonize.py \
      --cwd /home/z/my-project \
      --pidfile .zscripts/lock.pid \
      --log .zscripts/lock-holder.log \
      -- bash scripts/round.lock.sh with sleep 1200
    bash scripts/round.lock.sh status   # must say: held · pid N (alive)

EMPIRICAL RECORD (three independent confirmations, r30 + r32 entries):
nohup holders 7625, 11951, 9815 were each SIGKILLed by the session
reaper within moments of the acquiring tool call ending — every one a
dead-pid lock. The daemonize double-fork is the only verified survivor
(holders 12036, 7906, 10410, 11963 held alive across tool calls; the
r32 round ran start-to-close under daemonize holders, including one
mid-round re-gate at expiry).

---

## 5. Lineage merge ruling — "A. Local wins" / "A, everywhere" (r59)

Recorded by the main runner, 2026-09-30 15:53 +08, from the operator's
direct message (main-runner session). The operator's text verbatim
(the closing line includes a stray "hj" — kept as-is, it is the
operator's own keystroke):

```
A. Local wins.

Next fire:

1. git fetch origin
2. git merge origin/main --allow-unrelated-histories
3. For every conflict in worklog.md: take local, discard remote.
4. For conflicts in any other file: stop and name them — I do not know
   if there are any, and I will not guess.
5. Commit the merge.
6. Push.
7. Verify: tree clean, verify-estate.sh GREEN, remote updated.

Ruling recorded: canonical worklog.md = local.

One flag before the fire, not a question: step 4 is where the merge
might not be mechanical. If worklog.md is the only conflict, the merge
is a single ruling and it executes cleanly. If other files conflict,
the fire stops and reports them, because A only ruled on worklog.md
and I will not extend that ruling to files you have not seen.

If you want the ruling to cover all conflicts ("local wins
everywhere"), say "A, everywhere" and step 4 disappears. If you want
it to cover only worklog.md, say nothing and the fire stops at the
first non-worklog conflict and reports. A everywherehj
```

READING (runner's, stated for audit): the operator set the terms —
say "A, everywhere" for all-conflicts-local, or say nothing for
worklog-only. The closing "A everywherehj" is them saying the phrase
('hj' a stray keystroke; the worklog-only alternative required
silence, and they spoke). Scope of the ruling: ALL merge conflicts →
local wins. Step 4 (stop-and-name) retired by the operator's own rule.

EXECUTED r59 (merge commit f565538): 16 add/add conflicts, all
resolved to local and verified byte-identical to pre-merge HEAD;
worklog.md was ABSENT in the remote tree (no worklog conflict —
local canonical by default); 40 remote-only files accepted as
additions per mechanical merge semantics (the ruling covers
conflicts; remote-only additions are not conflicts). Pushed:
origin/main == local HEAD, first successful push since r38/r42
rejections — their cause (unrelated lineage, no common ancestor) is
gone.

---

## 6. Push policy Shape A + substrate spec check — "Part 1 = A / Part 2 = C" (r63)

Operator message, 2026-09-30 ~16:42 +08 (arriving with the 16:42 patrol
fire; the operator also forwarded a six-move strategy read whose closing
build-vs-publish question was NOT answered by this ruling block — that
question remains open):

> Got it. Ruling recorded.
>
> Part 1 = A. Push policy: every round pushes automatically.
>
> Part 2 = C. Check download/liner-boundary/SUBSTRATE_SPEC.md first.
> If it names the four industries and six substrates, use those names.
> If it does not, delete the task.
>
> Both rulings go into the worklog on the next fire. Two consequences:
>
> 1. Push policy is now Shape A. The gate stays open. Every round that
>    lands a commit pushes it. The runner does not ask, does not wait,
>    does not leave commits sitting locally. If a round's commit is bad,
>    it is bad in public and gets fixed in public. That is the trade you
>    chose.
> 2. Next fire opens with the substrate check. One file read. Either the
>    names come from the spec and #8 becomes a drafting round, or the
>    task gets amended out of TASKS-MAIN.md. Either way, #8 stops
>    appearing in the standing-items list after the next fire.
>
> No further questions from me on either. The next fire executes both.

READING (runner's, stated for audit): two directives, both unconditional.
Part 1 formalizes the post-Ruling-1 behavior (r59 opened the gate; STEP 4
of RUNNER-MAIN.md already prescribes unconditional commit-and-push, so no
protocol edit was needed — this ruling makes the behavior standing
policy: push every round, never hold commits locally, failures fixed in
public). Part 2 is a conditional task disposition with the runner doing
the fact-finding: read the spec, report what it names, act on the
condition. The operator supplied the decision table; the runner supplies
only the measurement.

EXECUTED r63: SUBSTRATE_SPEC.md read in full (4,503 bytes, dated
2026-09-23). DETERMINATION: it does NOT name four industries and does
NOT name six substrates. It defines a five-object vocabulary (Claim,
Obligation, Evidence, Verification, Receipt) for ONE substrate
(proofbridge-liner), with the claim/obligation/evidence layer
deliberately unbuilt (§0: "Not formalised — will emerge from running
verticals, or not at all") and no industry named anywhere (§3's
`FraudReceipt`/`HydraulicReceipt` are failure-mode illustrations, not
industry picks). Condition branch: DELETE THE TASK. TASKS-MAIN.md #8
("Publish the substrate matrix. Four industries. Six substrates.
Honest flags.") removed this round. Numbering of #9–#15 left intact —
renumbering would break every historical reference to those numbers,
including in this file and the operator's own standing-items list.
