// mini-services/safegrid/src/db/schema.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAFEGRID — Drizzle schema (SQLite dialect).
//
// SPEC NOTE (Round 57, ordering integration): SafeGrid is specified as
// Node/Express 5 + Drizzle ORM + Postgres. This sandbox has no Postgres
// server (no credentials, no daemon) — the estate substrate is SQLite.
// Deviation DISCLOSED in worklog R57: Drizzle ORM is used exactly as
// specified (same table shapes, same indexes); the engine is bun:sqlite
// with WAL + busy_timeout. Every Postgres-only primitive the spec asks for
// is mapped to its SQLite equivalent and tagged in-file:
//
//   · bigserial                  → INTEGER PRIMARY KEY AUTOINCREMENT
//   · timestamptz                → TEXT (RFC 3339, UTC, millisecond "Z")
//   · enum(...)                  → TEXT + CHECK constraint (app-validated)
//   · FOR UPDATE SKIP LOCKED     → single-statement atomic
//                                  UPDATE ... WHERE id IN (SELECT ...)
//                                  RETURNING (see src/outbox/claim.ts —
//                                  SQLite has no row-lock verb; writers are
//                                  serialized engine-wide, and the lease
//                                  predicate below provides recovery)
//
// §1 ORDERING DECISION (REPORTED — operator-decided, binding):
//   1. The WORM chain's append order is the authoritative order for the
//      stream. Nothing else is.
//   2. safegrid_decision.id is LOCAL INSERTION ORDER ONLY. It is diagnostic
//      and is retained as such. If exposed in a payload it is named
//      local_decision_id — never `sequence` — and its scope is documented
//      as local to this table.
//   3. worm_seal_index.position (owned by VVU) is the stream order.
//   4. No timestamp establishes order anywhere in this schema. decided_at /
//      created_at / available_at / lease_until / delivered_at are
//      informational (display, rate windows, lease expiry).
//   5. Stream scope: stream_id = tenant_id (declared scope, this pipeline).
//
// There is deliberately NO `sequence` column and NO ordering claim in the
// outbox payload contract (see src/outbox/payload.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * SafeGrid suppression decisions — one row per alert decision.
 *
 * `id`: Local insertion order. Diagnostic only. Not authoritative for
 * chain order. (The authoritative order for a decision event is the
 * position VVU's WORM append assigns it, per stream.)
 */
export const safegridDecision = sqliteTable(
  'safegrid_decision',
  {
    // Local insertion order. Diagnostic only. Not authoritative for chain order.
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    alertId: text('alert_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    cameraId: text('camera_id').notNull(),
    // 'low' | 'high' | 'unknown' — risk classification input (never authorization alone)
    risk: text('risk').notNull(),
    decision: text('decision').notNull(), // 'suppress' | 'hold' | 'escalate'
    // Policy evidence snapshot (what the predicate actually saw — fail-closed trail)
    policyEpoch: integer('policy_epoch'), // NULL = policy missing at decision time
    policyFreshness: text('policy_freshness').notNull(), // 'fresh' | 'stale' | 'missing'
    localConsentValid: integer('local_consent_valid', { mode: 'boolean' }).notNull(),
    localCeilingAllows: integer('local_ceiling_allows', { mode: 'boolean' }).notNull(),
    vvuState: text('vvu_state').notNull(), // 'healthy' | 'degraded' | 'unavailable'
    backlogDepth: integer('backlog_depth').notNull().default(0),
    backlogCeiling: integer('backlog_ceiling').notNull().default(0),
    // Informational (RFC 3339 UTC ms). NOT an ordering fact (§1.4).
    decidedAt: text('decided_at').notNull(),
  },
  (t) => [
    index('ix_decision_tenant_decided').on(t.tenantId, t.decidedAt), // rate-window lookup, not ordering
    index('ix_decision_decision').on(t.decision),
  ],
);

/**
 * Transactional outbox — written in the SAME local transaction as the
 * decision row. The relay (src/outbox/relay.ts) claims rows with a short
 * atomic lease, POSTs to the VVU inbox, then updates state. No row lock is
 * ever held across the HTTP call.
 */
export const integrationOutbox = sqliteTable(
  'integration_outbox',
  {
    id: text('id').notNull().primaryKey(), // uuid v4 (identity of the outbox row, no ordering meaning)
    eventId: text('event_id').notNull(), // deterministic idempotency key derived from the decision
    eventType: text('event_type').notNull(), // 'safegrid.decision.v1'
    // JSON text of the event payload. Contract: NO `sequence` field, ever.
    payload: text('payload').notNull(),
    // 'pending' | 'processing' | 'delivered' | 'failed'
    state: text('state').notNull().default('pending'),
    availableAt: text('available_at').notNull(), // informational/lease arithmetic (not ordering)
    leaseUntil: text('lease_until'), // claim lease expiry; NULL when not claimed
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    deliveredAt: text('delivered_at'), // informational (not ordering)
    createdAt: text('created_at').notNull(), // informational (not ordering)
  },
  (t) => [
    uniqueIndex('ux_outbox_event_id').on(t.eventId),
    // The claim query's access path (state, available_at):
    index('ix_outbox_state_available').on(t.state, t.availableAt),
  ],
);

export type SafegridDecisionRow = typeof safegridDecision.$inferSelect;
export type IntegrationOutboxRow = typeof integrationOutbox.$inferSelect;
export type NewIntegrationOutbox = typeof integrationOutbox.$inferInsert;
