<!-- vvu.authority.voice.v1 · version 2026-09-30 · revision 1
     last_written_by: main-runner · last_written_at_utc: 2026-09-30T00:06:00Z
     note: One voice. Every user-facing word obeys this file. Codified from
     the estate's own standing rules (RUNNER-MAIN.md, TASKS-MAIN.md) — nothing
     invented here. Read VOICE.md before any user-facing text ships. -->

# VOICE.md — the estate's voice

Plain voice. Every word. The rules below are the estate's standing law,
collected into one place. They are not aspirational — they are already
binding in RUNNER-MAIN.md and TASKS-MAIN.md; this file is where they live
together.

---

## The plumber test

If a plumber cannot understand the sentence, rewrite the sentence.
Write for the person standing in a plant room with wet boots, not for
a committee. Short sentences. Everyday words. The reader gets one idea
per sentence and one action per ending.

## The rules

1. **Plain voice.** No jargon. Spell out what the thing does for the
   person in front of you. If a term must be used (WORM chain, hash),
   give it a one-line plain definition the first time.

2. **One action per ending.** Every page, letter or card view ends with
   exactly one next step. Not a menu. Not a list of options. One thing.

3. **Honest numbers only.** Real numbers from real measurements. If a
   number is not measured, it is not printed. There is no such thing as
   an approximate benchmark in this estate — there are measured values
   and silence.

4. **Never claim what is not built.** Nothing in PROPOSED, UNKNOWN or
   OPEN status is ever described as built, live or working. WASM stays
   PROPOSED. The corridor stays UNKNOWN. K3 stays OPEN. WHO PQS E003
   stays UNKNOWN.

5. **Banned words — never written, anywhere, in any artifact or commit:**
   - "validated"
   - "certified"
   - "compliant" / "compliance" (in the regulatory sense — describing a
     process as meeting a regulation)
   - "regulatory approved"

   The honest substitutes: *independent technical review*, *measured*,
   *tested*, *checked against the spec*.

6. **Independent review is independent.** Reviewers review. They never
   bless, approve or certify. Compensation is discussed on the first
   call, not the first email. No tool offer is ever used as an
   inducement to review.

7. **Fail-closed honesty.** If something breaks, say what broke. If a
   number is missing, say it is unmeasured. If a file is absent, name
   the file. Never smooth over, never invent, never fake a run.

8. **ZAR. South Africa first.** Money is rands. Names, places and
   examples are South African where any local choice exists
   (Gqeberha, not "a coastal city").

## Where these rules came from

- RUNNER-MAIN.md: the fail-closed rules, the banned-words list, the
  reviewer-independence rules, the no-fabrication law.
- TASKS-MAIN.md: "Plain voice. Plumber test. Every word. One action per
  ending. Not a menu. No jargon. No regulatory language. Fail-closed."

## When this file changes

Voice rules change through one commit with the reason stated in the
worklog. Every user-facing artifact (card, support page, letters,
articles) is checked against this file before it ships.
