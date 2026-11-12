// mini-services/safegrid/src/outbox/claim.ts
// ─────────────────────────────────────────────────────────────────────────────
// OUTBOX CLAIM — the FOR UPDATE SKIP LOCKED helper (SQLite mapping).
//
// SPEC (§2 SafeGrid side) — the claim query, in the spec's Postgres form:
//
//   BEGIN;
//   SELECT ... FROM integration_outbox
//    WHERE (state = 'pending' AND available_at <= now())
//       OR (state = 'processing' AND lease_until < now())
//    ORDER BY insertion order
//    LIMIT n
//    FOR UPDATE SKIP LOCKED;
//   UPDATE ... SET state = 'processing', lease_until = now() + lease;
//   COMMIT;                 -- lease committed, lock released
//   ... HTTP POST happens AFTER, holding NO row lock ...
//
// SQLite mapping (DISCLOSED — no Postgres in this sandbox): SQLite has no
// row locks to SKIP — writers are serialized engine-wide. The claim is one
// single UPDATE statement whose WHERE carries the spec's recovery
// predicate verbatim; a single statement is atomic in SQLite, which makes
// it the shortest possible "short transaction": the lease is committed the
// moment the statement finishes and NO lock of any kind is held across the
// HTTP POST. Two concurrent claimers cannot both win a row: the second
// statement sees state='processing' with lease_until in the future.
//
// ORDER BY note (§1.4): claim order uses the table's internal rowid
// (insertion order — local FIFO fairness for the RELAY only). This is NOT
// a chain-order claim: chain order is decided by VVU's WORM append
// (worm_seal_index.position), never by this queue.
//
// Lease duration = SPEC (30 s here; must be measured in the pilot).
// ─────────────────────────────────────────────────────────────────────────────

import type { IntegrationOutboxRow } from '../db/schema';
import { nowIso, sqlite } from '../db';

export const LEASE_MS = Number(process.env.SAFEGRID_LEASE_MS ?? 30_000); // SPEC
export const CLAIM_BATCH = Number(process.env.SAFEGRID_CLAIM_BATCH ?? 5); // SPEC

interface RawClaimRow {
  id: string;
  event_id: string;
  event_type: string;
  payload: string;
  state: string;
  available_at: string;
  lease_until: string | null;
  attempts: number;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

/**
 * Atomically claim up to `limit` due outbox rows: pending rows whose
 * available_at has passed, PLUS processing rows whose lease expired
 * (relay crash recovery). Returns the claimed rows with the lease already
 * committed. No lock is held after this returns.
 *
 * `claimDueOutboxOn` runs against ANY bun:sqlite handle (the acceptance
 * suite uses it to model a second relay instance dying mid-claim on the
 * same database file); `claimDueOutbox` is the service's own handle.
 */
export function claimDueOutboxOn(
  handle: import('bun:sqlite').Database,
  limit: number,
  leaseMs = LEASE_MS,
): IntegrationOutboxRow[] {
  const now = nowIso();
  const leaseUntil = new Date(Date.now() + leaseMs).toISOString();
  const rows = handle
    .prepare(
      `UPDATE integration_outbox
          SET state = 'processing',
              lease_until = ?,
              attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM integration_outbox
           WHERE (state = 'pending' AND available_at <= ?)
              OR (state = 'processing' AND lease_until < ?)
           ORDER BY rowid ASC
           LIMIT ?
        )
        RETURNING id, event_id, event_type, payload, state, available_at,
                  lease_until, attempts, last_error, delivered_at, created_at`,
    )
    .all(leaseUntil, now, now, limit) as RawClaimRow[];
  return rows.map(mapRow);
}

function mapRow(r: RawClaimRow): IntegrationOutboxRow {
  return {
    id: r.id,
    eventId: r.event_id,
    eventType: r.event_type,
    payload: r.payload,
    state: r.state,
    availableAt: r.available_at,
    leaseUntil: r.lease_until,
    attempts: r.attempts,
    lastError: r.last_error,
    deliveredAt: r.delivered_at,
    createdAt: r.created_at,
  };
}

export function claimDueOutbox(limit = CLAIM_BATCH): IntegrationOutboxRow[] {
  return claimDueOutboxOn(sqlite, limit);
}

/** Rows currently claimable (diagnostics only — the UI shows this). */
export function dueOutboxCount(): number {
  const now = nowIso();
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM integration_outbox
        WHERE (state = 'pending' AND available_at <= ?)
           OR (state = 'processing' AND lease_until < ?)`,
    )
    .get(now, now) as { n: number };
  return row.n;
}
