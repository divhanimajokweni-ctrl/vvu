# DATA PRESENTATION SPEC — the labeling, clock, and atomicity contract

**Applies to:** every surface of the VVU validation estate, enforced end-to-end in the
PROXIMITY ▸ RECORD LAYER (`#/records`) and binding for all future projections.
**Version:** 1.0 · Round 60 · status: ENFORCED IN CODE (`src/lib/proximity/types.ts` + `src/components/proximity/ProximityWorkspace.tsx`)

---

## 1 · Does every numeric item have a precise label?

**Rule: no bare numbers, ever.** A number rendered without its unit AND its meaning is a
bug, not a style choice. `0.31` on a screen could be a risk score, a pass rate, or a
latency — the reader must never have to guess.

Every numeric value renders as **value + unit + meaning**, in that order:

| Rendered                        | value | unit    | meaning            |
| ------------------------------- | ----- | ------- | ------------------ |
| `821 milli · RISK 0.821`        | 821   | milli   | risk score         |
| `212 ms · P95 HTTP LATENCY`     | 212   | ms      | p95 latency        |
| `45 cm · DISTANCE`              | 45    | cm      | proximity gap      |
| `-58 dBm · RSSI`                | -58   | dBm     | signal strength    |
| `12500 ms · DWELL 12.5 s`       | 12500 | ms      | dwell time         |
| `7 · SEALED RECORDS`            | 7     | records | chain length       |
| `0.820 · RISK THRESHOLD`        | 0.820 | —       | suppression limit  |

**Rules of the rule:**

1. **The unit lives in the field name at the contract layer** (`risk_milli`,
   `distance_cm`, `rssi_dbm`, `dwell_ms`) and in the label at the display layer. The
   contract audit (`GET /api/proximity/audit`) fails any numeric field whose unit is not
   in its name.
2. **Scaled integers get both scales at display time**: `risk_milli 821 ≡ RISK 0.821`
   (three decimals, always), `dwell_ms 12500 · DWELL 12.5 s`. The sealed value is the
   integer; the display shows the human scale.
3. **Thresholds render as thresholds**: the slider shows `threshold 820 milli · RISK
   0.820` — the rule expression shows both sides in both scales:
   `IF risk_milli 871 (RISK 0.871) > 820 (RISK 0.820) → SUPPRESS ACTION`.
4. **Counts carry their noun** (`7 records`, `2 refused`) — a count without its noun is
   a bare number.

## 2 · Are timezone parameters unified?

**Rule: one clock — the server cluster clock, UTC, rendered explicitly.**

- Display format is **`YYYY-MM-DD HH:MM:SS UTC`** (e.g. `2026-11-03 22:14:07 UTC`),
  produced by exactly one function: `formatUtc()` in `src/lib/proximity/types.ts`.
- The record layer's **stored** format is **RFC 3339 UTC millisecond precision**
  (`2026-11-03T22:14:07.123Z`) — enforced by regex at ingest; anything else is a 400.
- The workspace header carries a **live UTC clock** ticking every second, so every
  panel on the page is readable against one displayed time base.
- **Never** render `Date.toLocaleString()`, never a local timezone, never a bare ISO
  string in a human-facing slot. Machine-facing slots (canonical bytes, JSON fields)
  keep RFC 3339-ms-Z — that is the contract, not the display.
- **Timestamps are informational only.** Chain order is `worm_seal_index.position`
  (append order). Nothing in this estate orders by time — a tampered `occurred_at`
  cannot reorder history.

## 3 · Is the information atomic?

**Rule: one feature block = one primary system indicator.** Each card answers exactly
one question and carries its indicator as a chip in the card header:

| Card                             | Primary indicator (ONE)                  |
| -------------------------------- | ---------------------------------------- |
| OPERATIONAL FLOW · inputs        | current suppression verdict              |
| ACTIVE PROCESSING RULES          | armed / rule fired                       |
| STATE LEDGER · append-only       | chain validity (VALID / BROKEN at #N)    |
| GOVERNANCE EVALUATOR · passes    | latest gate decision (ALLOW / REFUSE)    |
| ALLOWED vs REFUSED ledger        | gate counters                            |
| CONTRACT AUDIT                   | audit pass / fail                        |

Consequences enforced in layout:

- A card never merges two indicators into one chip; a second metric becomes a `Metric`
  tile inside the card, each with its own unit + meaning.
- Atomic cards survive grid reflows: the three-column pipeline tab
  (`operational flow | state ledger | governance evaluator`) stacks cleanly at mobile
  widths with **the center column reserved for the ledger** on desktop, per the layout
  contract.
- Long lists (chain rows, decision log) cap at `max-h-*` with styled overflow — an
  atomic card never grows unbounded.

## 4 · Layout tokens (dark base)

| Token                | Value                                             |
| -------------------- | ------------------------------------------------- |
| Base background      | `#04060c` (near-black) on the workspace wrapper   |
| Card backing         | `bg-slate-900/60` — **slightly translucent**      |
| Card border          | `border-slate-800` — thin, light-gray, inner      |
| Card rounding        | `rounded-xl`, header rule `border-b border-slate-800` |
| Emphasis labels      | subtle colored: emerald = allowed/pass/valid · rose = refused/broken · amber = fired/hold · cyan = hashes/streams · violet = kernel/bytes/production |
| Numeric type         | `font-mono tabular-nums`                          |
| Section labels       | `text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300` |
| Micro-labels         | `text-[9.5px] uppercase tracking-[0.12em] text-slate-500` |
| Scrollbars           | 1.5px, rounded, `bg-slate-800` thumb             |

Color is **meaning, not decoration**: the only strong hues on the page are verdicts.
Nothing else competes with them.

## 5 · Page segmentation (tense per tab)

| Tab           | Tense        | Content                                                      |
| ------------- | ------------ | ------------------------------------------------------------ |
| PIPELINE      | the present  | live triggers, rule arrows, the ledger live, latest passes   |
| STATE LEDGER  | the past     | sealed append-only stream, hashes, stored canonical bytes    |
| GOVERNANCE    | the rules    | gate + decision rules, allowed vs refused evaluation ledger  |
| DEVELOPERS    | the core     | contract audit, boundary proof, API explorer, honest limits  |

The visual rule arrows show **active data processing rules** — e.g.
`IF risk_milli > 820 (RISK > 0.820) → SUPPRESS ACTION` — lighting amber as the live
input crosses the threshold, with the server as the authority that re-evaluates.
