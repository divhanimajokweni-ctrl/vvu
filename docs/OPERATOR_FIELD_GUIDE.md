# VVU / ProofBridge — Operator Field Guide · Cold Outreach to Private Security Firms

**Who carries this:** the founder/operator walking into private security firms — guarding, armed response, patrol, control-room operations.
**What it is:** the complete playbook — what you say, what you show, what you never claim, how their operators use the system daily, and what you capture before you leave.
**Canon:** every label, button, price and status quoted here is verbatim from the running application. If the app and this guide ever disagree, the app wins — check the surface.

---

## 0 · The positioning, in one paragraph (read this first)

A private security firm sells one product: **a record their clients can trust.**
Every patrol that was completed, every incident that was handled, every response
time that was met — the firm's entire commercial case rests on records that
clients, insurers and courts accept.

The problem: those records are editable. A paper occurrence book can be
rewritten. A WhatsApp photo has no proof of when it was taken. A guard app's
database can be corrected "administratively" after the fact — and everyone in
the industry knows it.

**VVU/ProofBridge is a provenance-and-audit layer.** It records what happened —
a patrol, an incident, a decision — as a cryptographic chain that any third
party can verify without trusting the security firm or the software vendor.

> It does not detect lies. It makes it impossible to change the record after
> the fact. The bottleneck it removes is: *"we can't prove what happened
> cheaply, portably, and across institutions that don't trust each other."*

That paragraph is the estate's own leave-behind, adapted word-for-word from
`src/lib/fieldkit.ts`. **Show this. Don't explain it. Let them read it.**

You are not selling guard tracking. You are not replacing their control-room
software. You are selling the audit layer that makes the records they already
produce **provable** — and a pilot that proves it on their own operations in
30 days.

---

# PART I — BEFORE THE WALK

## 1.1 What you carry

| Item | Why | Where it lives |
| --- | --- | --- |
| A phone with VVU installed as a PWA | The demo IS the product. Own icon, own window, works offline | `INSTALL` button in the header, or Share → Add to Home Screen |
| This guide, readable on the same phone | The meeting script + the honesty table, in your hand | `#/docs` → **FIELD GUIDE · SECURITY FIRMS** (served from this file) |
| The price card | The canonical commercial menu, verbatim | `#/docs` → **PRICE CARD (V2)** |
| A charged spare phone or tablet | Install the PWA on *their* device — the strongest 60 seconds of the meeting | — |
| The compliance pack | Terms, complaints procedure, consent spec, B2B pilot integration — draft, lawyer-pending, stated as such | `#/docs` → **COMPLIANCE PACK** |

Prep checklist (5 minutes, the night before or in the car):

1. Open the installed VVU app once — confirm the shell boots (header, panels, footer all render).
2. Put the device in airplane mode, reopen the app — confirm the offline shell still boots and telemetry honestly shows `RECONNECTING`. That's the load-shedding story, pre-proven.
3. Open `#/icsh` → tab `WORM LEDGER` — confirm the chain is healthy.
4. Close airplane mode.

## 1.2 The three questions you are there to ask

This is the estate's field kit (`#/fieldkit`) repurposed from the campus walk to
the security walk. Ask every decision-maker these three, capture every answer
before you leave (see PART VII):

1. **"What is the biggest thing in your operation you can't prove today?"**
   (You are fishing for: patrol completion, response times, incident reports,
   handover sequences, ammunition/fear-of-force records.)
2. **"When a record is wrong or missing, who catches it — and who pays?"**
   (You are fishing for: the client dispute, the insurance repudiation, the
   PSIRA complaint, the POPIA s72 penalty exposure.)
3. **"I would trust a system like this if it could ______."**
   (This is their trust condition. It becomes the pilot's acceptance test.
   Write down their exact words.)

## 1.3 The four trust bottlenecks — security-firm translation

The estate's four bottlenecks (`#/fieldkit` §2), translated:

| Bottleneck | Security-firm reality | Where VVU lands |
| --- | --- | --- |
| Provenance | "Who wrote this incident report, when, and did anyone touch it after?" | WORM ledger — append-only, SHA-256 chained |
| Evidence capture | Patrol photos and notes with no independent timestamp | Every captured event hash-chained at the moment of capture |
| Institutional trust | Client disputes: "your log says 03:10, my camera says 03:40" | A third party verifies the chain without trusting the firm |
| Cost of verification | Auditing a month of shift logs = days of supervisor time | `VERIFY CHAIN` recomputes the whole month in seconds |

---

# PART II — THE VISIT · 15-MINUTE SCRIPT

Timed. Every button label below is verbatim from the running app.

## 0:00–3:00 · OPEN — the paragraph, not the architecture

> Do not walk into a business saying "we have 94 green things." Walk in with
> three sentences.

The pitch (small firm — owner-operator, adapt to audience):

> "We build systems that give organizations **verifiable evidence** of
> important decisions and operations. I can show you a working demonstration
> and identify one process where this could reduce your risk."

Then **stop talking**. Hand them the phone with the leave-behind paragraph on
screen (`#/docs` → FIELD GUIDE → the paragraph is right at the top). Let them
read it. Count to ten.

Then the three questions (§1.2). Listen more than you talk. Whatever they name
as "the biggest thing we can't prove" — that is the demo target and the pilot
scope.

## 3:00–6:00 · INSTALL — on THEIR phone, in front of them

This is the moment that separates you from every "we have an app" vendor:
**no app store, no install fee, no MDM, works on the R800 guard phone and on
the director's iPhone.**

Say: *"Give me your phone for sixty seconds. I'm going to install our control
system on it — through the browser, no app store."*

Then run the real install path (this is the app's own instruction sheet,
verbatim):

- **Android · Chrome:** menu **⋮** → **Install app** → confirm.
- **iOS · Safari:** **Share** icon → scroll and tap **Add to Home Screen** →
  name it **VVU** → tap **Add**.
- **Desktop · Chrome/Edge:** install icon in the address bar.
- **Firefox:** no install prompt — the page still runs (say so plainly if asked).

The app is now on their home screen with the lime hex icon. Have them open it:
it launches **in its own window**, no browser chrome. (On the demo phone the
native install prompt fires from the header `INSTALL` button; on theirs, use
the manual steps above.)

If asked "is this in the app store?" — answer honestly: *"No. The web page is
the app. It installs from the browser on every platform — Android, iPhone,
Windows, Mac, Linux — and it works offline. An Android APK and a Windows
installer exist as CI artifacts, but the browser install is the path we lead
with because it works on every device in your company today."*

## 6:00–10:00 · THE PROOF — a record that cannot be quietly edited

Now prove the leave-behind paragraph. On your phone (or theirs — it's
installed now):

1. **Run the flywheel once.** Open `#/icsh` (the default view, or the PWA
   shortcut **Flywheel**), tab **PY FLYWHEEL** / **COST MATRIX** → press
   **RUN ×1**.
   The terminal prints, verbatim: `✓ COMPLETE — N cycles`, `⚓ WORM ANCHOR @
   seq N`, `✓ VERIFICATION PASSED — OK: N cycles`.
   Say: *"That was one recorded operating cycle. Every cycle ends with an
   anchor into an append-only ledger. Watch what the ledger says about
   itself."*
2. **Audit the ledger.** Tab **WORM LEDGER** → **RUN AUDIT**.
   The auditor walks the entire WORM chain and every cycle head, recomputing
   every hash. Say: *"The audit doesn't ask the software whether it's honest.
   It recomputes the mathematics. If any record had been edited after the
   fact, the chain is broken at that point and the audit fails loudly."*
3. **Show the receipts chain.** Open `#/receipts` → **VERIFY CHAIN** → the
   green banner reads `CHAIN VALID · CHECKED N FROM GENESIS`.
   The footer states the mechanic in one line: *"EVERY ROW hash =
   SHA-256(canonical fields + prevHash) · TAMPER IN ANY FIELD BREAKS THE
   CHAIN."*
4. **The tamper story** (tell, don't do): *"If someone opens the database
   behind this and changes one character in one incident record at 03:00 in
   the morning, the next verify fails at exactly that record. There is no
   'administrative correction' that doesn't leave proof that a correction
   happened. That's the whole product."*
5. **Hand them the ledger.** **EXPORT ledger.jsonl** — the raw ledger
   downloads as one JSON line per cycle. *"This file is the audit artifact.
   Your client, your insurer, or a court can verify it without our software,
   without our servers, and without trusting us."*

**Say the honest boundary out loud, now:** *"The chain is a local SHA-256
ledger. It is not anchored to an external blockchain — that's on the roadmap.
The tamper-evidence is real today; the third-party timestamp anchoring is the
next leg."* (See PART V — saying this first is why they'll believe everything
else.)

## 10:00–13:00 · THE FIELD STORY — guards, incidents, load-shedding

Three proofs, in descending order of "works today":

**a) The incident declaration (works today).** Open `#/wildfire`. This is a
wildfire scenario, but walk it as an incident-declaration template: the FSM
card shows the states `NORMAL → WATCH → DECLARED → ESCALATED → STAND-DOWN`,
and declaration is **armed two-step** — the operator arms, then declares. No
single accidental tap declares an incident. Every transition is WORM-logged.
Say: *"Replace 'wildfire' with 'armed response callout' and this is your
control-room declaration flow: who declared, when, on whose authority —
hash-chained as it happens."*
Honest label on screen (point at it): *"Field nodes are SIMULATED — every
telemetry frame carries `sim:true`."* The state machine, the two-step arming
and the journal are real; the sensor feed in this demo is simulated.

**b) The offline story (works today).** Say: *"Your guards work in basements,
plant rooms and dead zones. Verification is a local HMAC computation — it
works through load-shedding blackouts. The app shell itself runs offline."*
Then, if you pre-loaded the offline proof (§1.1 step 2), show the screenshot
or repeat it live: airplane mode → reopen → the shell boots, panels render,
telemetry honestly shows `RECONNECTING`.

**c) The phone pairing rail (prototype — say so).** Open `#/field`. Show the
QR pairing: *"A phone scans this QR once, and from then on every operation
that phone does — search, read, write — gets its own receipt in the chain."*
Point at the status line and read it **verbatim**:
**`BRIDGE STATUS: PROTOTYPE — UNVERIFIED ON REAL ANDROID · PROTOCOL TESTED ≠
MOBILE CLIENT TESTED ≠ LIVE BRIDGE TESTED`**.
Say: *"That's the current status, stated on the panel. The protocol and its
receipt chain are tested; pairing on real Android handsets is the next
validation step — that's exactly what a pilot with you would prove."*

If their operation is control-room centric, also show `#/watchdog` —
read-only rail health with **RECHECK NOW**, and the **DAYSHIFT** toggle in the
header (high-contrast mode for bright control rooms).

## 13:00–15:00 · CLOSE — POPIA, the offer, the capture

**a) The POPIA card** (it's on-screen in `#/icsh` → **SESSION LAB** → the
consent frame; quote the four lines):

- **s11 CONSENT** — consent recorded per enrolment (`JOIN_COMMITTED` on chain)
- **s10 DATA MINIMISATION** — the ledger stores hashes and minimal fields, never payloads
- **OFF-LINE** — verification is local HMAC-SHA1; works through load-shedding blackouts
- **s11(3) RIGHT TO REVOKE** — revocation honoured, on chain (`LOGIN_REJECTED`, session revoke)

Say the status plainly: *"POPIA compliance is designed in — consent, minimal
data, right to revoke are enforced in the protocol, and every one of those
events is itself auditable. Our own operator registration with the Information
Regulator is still in progress — I won't claim a registration we don't hold."*

**b) The offer** (verbatim from the price card; see PART VI):

> "The door-opener is a **30-day fixed-price pilot**: we pick one process you
> can't prove today — patrol completion, incident reports, handovers — and we
> make it tamper-evident, end to end. Your team verifies the chain
> themselves. At the end of 30 days you either have proof or you have a full
> report on what it would take."

**c) The capture** (PART VII) — save the three answers before you leave the
building. The capture form is on the same phone: `#/fieldkit` → **THE CAPTURE
TEMPLATE** → fill → **SAVE CAPTURE**. It saves server-side and the toast
confirms `CAPTURE SAVED · WORM #<seq>` — which is itself a nice final beat:
*"and the record of this meeting is now in the same chain."*

**d) The leave-behind.** From `#/docs`, **COPY** the leave-behind paragraph /
guide, or show them the QR. The master QR encodes the live serving address —
hand-scan it in the room and the guide is on their phone too.

---

# PART III — HOW THEIR OPERATORS USE IT DAILY

This is the part the operations manager is actually buying. Learn it so you
can narrate it as their staff's day, not as features.

## 3.1 Shift start (60 seconds, per guard/supervisor)

1. Open VVU from the home screen (installed once, per §3.00 of the script).
2. **JOIN METHOD** — first time only: choose **QR CODE** or **GOOGLE
   AUTHENTICATOR (MANUAL KEY)**; enter **CALLSIGN** (e.g. `GQ_PATROL_01`),
   farm/site and district; tick the three consent lines; scan the QR into
   **Google Authenticator, Microsoft Authenticator, Authy, Aegis or FreeOTP**
   (standard RFC 6238 — no proprietary app); enter the 6-digit code →
   **COMMIT JOIN**. The receipt shows their **join code**, **WORM SEQ** and
   **entry hash**.
3. Every shift after: open app → 6-digit code → in. Session is minted on
   chain (`SESSION_MINTED`), valid 15 minutes, re-minted on activity.
   Works offline — the code is computed locally (HMAC-SHA1); dead zone ≠
   locked out.

## 3.2 On shift — the record writes itself

- Every operator action lands in the **WORM ledger** (append-only, SHA-256
  chained): logins, session re-mints, incident declarations, captures,
  theme/action events. The footer shows the live chain tip: `WORM #<seq>` and
  `SHA <tip>`.
- **Incident declared** → two-step armed declaration (arm → declare), every
  transition (`WATCH → DECLARED → ESCALATED → STAND-DOWN`) a chained event
  with actor and timestamp.
- **Evidence capture** → `#/fieldkit` capture template (or the site-specific
  variant built for the pilot): the entry is hash-chained at the moment of
  capture. Notes that "went missing" or "were corrected" are structurally
  impossible without proof.

## 3.3 End of shift (2 minutes, per supervisor)

1. `#/icsh` → **WORM LEDGER** → **RUN AUDIT** — verifies the full chain since
   genesis.
2. **EXPORT ledger.jsonl** — the shift's audit artifact, one JSON line per
   event; file it or email it to the client contact as the shift proof.

## 3.4 Control room / management

- `#/watchdog` — rail health at a glance, **RECHECK NOW**, per-service
  latency, self-integrity fingerprint of the running surface. Read-only: no
  one "fixes" records from the monitor.
- `#/receipts` → **VERIFY CHAIN** — one button, whole-chain recompute,
  `CHAIN VALID · CHECKED N FROM GENESIS` or the exact break point.
- `#/mission` — gates, WORM chain viewer, audit log panel.
- **DAYSHIFT** header toggle — high-contrast mode for bright control rooms;
  honest toast: `DAYSHIFT · LIGHT OPS MODE`.
- Keyboard: `Ctrl+1…0` jump the ten fixed surfaces; `Ctrl+K` command palette
  (the **Lindiwe** tutor lives there too).

## 3.5 What a client (their customer) sees

The strongest close in the meeting: *"Right now, when a client disputes a
patrol log, you email them a screenshot. With the pilot running, you email
them the ledger export — and the instructions to verify it without trusting
you. The dispute ends at the mathematics."*

---

# PART IV — OBJECTIONS & ANSWERS (verbatim, tested register)

**"We already have a guard-tracking / control-room app."**
"Keep it. We don't track guards and we don't replace dispatch. We wrap the
records your systems and staff already produce in a hash chain, so the output
becomes provable to third parties. It's the difference between a log and
evidence."

**"Our guys have cheap phones / a mix of Android and iPhone."**
"The web page is the app. It installs from the browser — no app store, no
MDM, no minimum handset. Same install path on an R800 Android, a company
iPhone, and the control-room PC. It also runs offline for the dead zones."

**"What happens in a blackout / no signal?"**
"Verification is a local computation — codes generate offline, the app shell
boots offline, records chain locally and sync when the link returns. We
demonstrated it just now with airplane mode. Load-shedding is a design
constraint here, not an edge case."

**"Who audits the auditor? Can't you change the records?"**
"The ledger verify recomputes every hash from the first entry. The export is
a plain file — your client or an independent auditor verifies it without our
software. And our own governance actions are in the same chain: revocations,
joins, gate certifications — everything is append-only."

**"Is this blockchain? We heard blockchain before."**
"It's a hash chain — the same cryptographic primitive a blockchain is built
on, without a token or a third-party network. Today it's local-ledger
tamper-evidence; external timestamp anchoring is the roadmap item. I'll tell
you when that lands, not before."

**"Is this POPIA-compliant?"**
"Consent, data minimisation and the right to revoke are enforced in the
protocol and recorded on chain — I'll show you the consent frame. Our
Information Regulator operator registration is still in progress; I won't
overclaim it. What I can say: the ledger stores hashes and minimal fields,
not payloads — there is very little personal data to protect, by design."

**"We're PSIRA-registered — does this do PSIRA reporting?"**
"Not today, and I won't claim it does. PSIRA reporting integration is a
roadmap item — and the pilot is exactly how it gets scoped to the real
reports you submit. What the pilot gives you today is the tamper-evident
record underneath any report."

**"What does it cost?"** — see PART VI. Lead with the pilot, not the menu.

**"Leave it with us, we'll think about it."**
"Sure. Before I go — the three questions from the start of our chat: I'll
save your answers so the follow-up is specific, not a brochure. If I sent you
one paragraph and a QR to the demo, would you show one other person here?"
(Get the second name. The capture form takes 60 seconds.)

---

# PART V — THE HONESTY TABLE (carry this in your head)

The estate states its limits on-screen. So do you. **Never claim anything in
the right-hand column.**

| You CAN claim (verified today) | You must NOT claim |
| --- | --- |
| PWA install on every platform, own icon, standalone window, offline shell | An app-store presence (there is none) |
| Append-only SHA-256 WORM ledger, full-chain verify, ledger.jsonl export | External blockchain anchoring (anchor relay is a declared **stub**) |
| TOTP join/login — RFC 6238, standard authenticator apps, offline codes, on-chain consent + revoke | 24-word phrase / hardware-key identity (that layer is a named roadmap item, not built) |
| Receipts: hash-chained ops + Merkle root + one-button genesis verify | That receipts are externally timestamped |
| Incident FSM: two-step armed declaration, consent-gated mesh, append-only journal | That field sensor nodes are live (demo nodes carry `sim:true`, stated on-screen) |
| QR phone-pairing rail: protocol + receipt chain tested | That pairing is verified on real Android — the panel itself says **PROTOTYPE — UNVERIFIED ON REAL ANDROID**; the pilot is what proves it |
| FieldKit capture: server-persisted, WORM-logged, one per conversation | That it's a CRM (it's a capture template; the outreach engine is separate) |
| Spatial/twin control-room views as **demonstrations** | That the telemetry in #/ive or the twin is live data (both are labeled simulated/seeded) |
| Android APK built by CI (run 35765662656, green, staged engine, artifact hashed); XAPK packager tested 10/10 on a real signed APK | That the APK is device-verified (sideload+run is the pending operator step); that a Windows .exe exists (unbuilt) |
| POPIA consent/minimisation/revoke **in the protocol** | Our own Information Regulator registration (pending); PSIRA integration (roadmap) |
| B-BBEE Level 1 Contributor (135% procurement recognition); CIPC Reg. 2026/259053/07 (Active) | Any client names or logos (none exist yet — say "in pilot definition" if pressed) |

If you are ever unsure mid-meeting: open `#/docs` → this guide → this table,
and read the row out loud. Admitting the boundary in the room is the product.

---

# PART VI — COMMERCIAL & COMPLIANCE FACTS (verbatim)

**The door-opener (say first):**
- **R5,000 fixed-price 30-day pilot** (excl. VAT) — one process, made
  tamper-evident, verified by their own staff at the end.
- Full licence after 3 successful verifications (3 nodes).

**The price card v2 (the canonical menu — `#/docs` → PRICE CARD (V2));**
**rows a security firm will care about:**

| ID | Offering | Entry price |
| --- | --- | --- |
| PC-01 | ProofBridge Discovery | R15,000 (1 week) |
| PC-03 | ProofBridge Monitoring | R5,000/month |
| PC-06 | IVE Workspace — Professional | R3,000/month per workspace |
| PC-13 | SEARM Enterprise Assessment | R150,000–R500,000+ (scoped) |

Full menu (PC-01 … PC-14) on the price card surface — do not quote prices that
aren't on it.

**Company facts (verifiable):**
- B-BBEE Level 1 Contributor — 135% procurement recognition
- CIPC Reg. 2026/259053/07 (Active)
- 30-second supplier verification
- POPIA-compliant SHA-256 WORM audit ledger (protocol layer)
- City Digital Twin GIS with edge-AI anomaly monitoring (demonstrable, simulated feed)

**Compliance pack status:** Terms of Service, Complaints Procedure, Consent
Record Spec, B2B Pilot Integration — all served in `#/docs`, all marked
**DRAFT — REVIEW REQUIRED** until the lawyer signs off. Say exactly that.

---

# PART VII — THE CAPTURE & THE FOLLOW-UP

## 7.1 Before you leave the building (60 seconds)

`#/fieldkit` → **THE CAPTURE TEMPLATE** → fill:

- **LECTURER *** field → the decision-maker's name/role (the field is named
  for the campus walk; in the security walk it's the person you just met)
- **FACULTY *** → pick the closest (this maps to sector in the pilot build)
- **Q1 — BIGGEST UNVERIFIABLE THING** → their answer, their words
- **Q2 — HOW FAILURES ARE CAUGHT TODAY / WHO PAYS** → their answer
- **Q3 — THEIR TRUST CONDITION** → verbatim "I would trust this if…"
- **DOMINANT BOTTLENECK** → circle one
- **WOULD THEY USE IT?** → YES / NO / MAYBE
- **FOLLOW-UP ACTION** → the next concrete step + date

**SAVE CAPTURE** → `CAPTURE SAVED · WORM #<seq>`. Required fields are marked;
deleting a capture later keeps the WORM row (append-only — the meeting itself
is now on the chain, which is your closing line).

## 7.2 After the visit

- Captures and the WORM ledger are the follow-up source of truth
  (`#/fieldkit` → **PEOPLE NOTES ON FILE**).
- Email follow-ups run through the estate's outreach engine with **POPIA s69
  consent gates armed** — no consent basis recorded, the send is refused by
  the software, not by discipline. (Sending is dry-run until the mail key is
  configured; do not claim sends that didn't happen.)
- The pilot scope comes from their Q1 + Q3. The acceptance test is their Q3,
  restated.

---

# APPENDIX A — SURFACE MAP (what to open, when)

| Surface | Route | Use in the meeting when… |
| --- | --- | --- |
| Flywheel / 4th state | `#/icsh` (default) | The proof — RUN ×1, WORM LEDGER, RUN AUDIT, EXPORT ledger.jsonl |
| Receipts | `#/receipts` | Chain verify — VERIFY CHAIN; the tamper story |
| The documents | `#/docs` | This guide, leave-behind, price card, compliance pack, QR access |
| Field node | `#/field` | Phone pairing (status: PROTOTYPE, read the panel verbatim) |
| Incident FSM | `#/wildfire` | Declaration flow — two-step armed, states, journal |
| Field kit / capture | `#/fieldkit` | The three questions + the capture before leaving |
| Watchdog | `#/watchdog` | Control-room health view — RECHECK NOW |
| Mission control | `#/mission` | Gates, audit log, WORM viewer (management audience) |
| Spatial / twin | `#/ive`, `#/twin` | Control-room "where this goes" vision — always labeled simulated/seeded |

Keyboard: `Ctrl+1` spatial · `Ctrl+2` evidence · `Ctrl+3` terminal · `Ctrl+4`
mission · `Ctrl+5` twin · `Ctrl+6` watchdog · `Ctrl+7` receipts · `Ctrl+8`
pools · `Ctrl+9` field · `Ctrl+0` settings · `Ctrl+K` palette. PWA shortcuts:
Flywheel, Ledger, Field node, Wildfire twin.

# APPENDIX B — THE ANDROID APK STATE (for the "is there an app?" deep question)

Current, verifiable state:

- CI run **35765662656** (workflow `build-android`, checkout `ed24adf`) —
  green; artifact `vvutrust-android-debug-apk`, APK sha256
  `f9f7e8665629458f652d7acf020bbb11596a5303bc9692aa4554911e30be17e9`.
- The workflow's five fail-closed gates ran — including **G3, which stages
  the engine tree and fails unless `runner/vvu_runner.py` reached the Kivy
  staging tree**. A green run therefore proves staging happened.
- The **XAPK packager** (`make_xapk.py`) is tested 10/10 on a real signed
  APK, deterministic, fail-closed read-back.

The honest pending step: **sideload + run on a real device** — download the
artifact, verify the sha256 above, install, run the flywheel once. The static
30-second check that settles "is the engine inside": `unzip -l <apk> | grep
-i vvu_runner` — engine files visible in the APK listing means bundled;
absent means the staging needs folding into the spec. Until that check or the
device run: say *"the APK exists, the engine staging is proven in CI, and the
device run is the next operator step — the browser install in front of you
works today."*

# APPENDIX C — THE ONE-PAGE LEAVE-BEHIND (print from #/docs)

> **ProofBridge is a provenance-and-audit layer.**
>
> It records what happened in a system — a payment, a reading, a decision —
> as a cryptographic chain that any third party can verify without trusting
> the operator.
>
> It does not detect lies. It makes it impossible to change the record after
> the fact. The bottleneck it removes is: "we can't prove what happened
> cheaply, portably, and across institutions that don't trust each other."
>
> For a security operation: every patrol, incident report and handover becomes
> a chain of receipts your client, your insurer or a court can verify without
> trusting you — or us.
>
> **30-day fixed-price pilot: R5,000 (excl. VAT).** One process, made
> tamper-evident, verified by your own staff.
>
> Install it yourself: scan the QR / open the link → **INSTALL** — no app
> store, works offline, every platform.

*Venture Vision Ubuntu · Gqeberha · B-BBEE Level 1 (135%) · CIPC 2026/259053/07*
