// mini-services/safegrid/src/decide-store.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE DECISION PIPELINE — SafeGrid's hot path.
//
// decideAndStore() is the ONLY place a suppression is decided and the ONLY
// writer of the (decision + outbox) pair. It runs §4 verbatim on a
// snapshot of local evidence, then writes BOTH rows in ONE local SQLite
// transaction:
//
//     BEGIN
//       INSERT safegrid_decision ...
//       INSERT integration_outbox ...   (payload: NO sequence field)
//     COMMIT
//
// That single transaction is the whole transactional-outbox guarantee on
// the producer side: a committed decision ALWAYS has its event row, and a
// rolled-back transaction leaves NEITHER (crash point 1 of the acceptance
// suite). The relay then owns eventual delivery; the decision handler never
// awaits the network — hot-path isolation (asserted by the suite).
//
// Crash hooks (opts.crash) exist for the acceptance suite's eight crash
// points. They are pure control-flow injections inside the real code path
// — the suite simulates a process dying at each boundary, then proves the
// pipeline's recovery properties from the surviving state.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';

import { db, nowIso } from './db';
import { integrationOutbox, safegridDecision, type SafegridDecisionRow } from './db/schema';
import { buildOutboxPayload, eventIdFor, type OutboxEnvelope } from './outbox/payload';
import {
  CEILING_WINDOW_MS,
  ConsentStore,
  decide,
  PolicyStore,
  SUPPRESSION_CEILING,
  type DecisionContext,
  type Risk,
} from './policy';
import type { VvuHealth } from './vvu-health';
import { BACKLOG_CEILING } from './vvu-health';

export interface AlertInput {
  alert_id: string;
  tenant_id: string;
  camera_id: string;
  risk: Risk;
  classification?: string;
  score?: number; // 0..100
  received_at?: string; // informational
}

export interface DecideOptions {
  /** Crash-point hooks for the acceptance suite (crash.test.ts). */
  crash?: 'before_outbox_commit' | 'after_outbox_commit';
}

export interface DecideResult {
  decisionRow: SafegridDecisionRow;
  envelope: OutboxEnvelope;
  ctx: DecisionContext;
}

/** Count this tenant's suppressions inside the rolling ceiling window.
 * (A rate-limit input, NOT an ordering fact — §1.4.) */
function suppressionsInWindow(tenantId: string): number {
  const cutoff = new Date(Date.now() - CEILING_WINDOW_MS).toISOString();
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(safegridDecision)
    .where(
      and(
        eq(safegridDecision.tenantId, tenantId),
        eq(safegridDecision.decision, 'suppress'),
        gte(safegridDecision.decidedAt, cutoff), // informational window, not ordering
      ),
    )
    .get();
  return row?.n ?? 0;
}

/**
 * The hot path. Locally valid evidence in, one transaction out.
 * Throws only on storage failure or an injected crash point.
 */
export function decideAndStore(
  alert: AlertInput,
  deps: { policy: PolicyStore; consent: ConsentStore; vvu: VvuHealth },
  opts: DecideOptions = {},
): DecideResult {
  // 1. Snapshot local evidence (§4: SafeGrid owns the immediate decision
  //    using locally valid evidence).
  const policySnap = deps.policy.snapshot();
  const consentValid = deps.consent.valid(alert.tenant_id);
  const usedCeiling = SUPPRESSION_CEILING;
  const inWindow = suppressionsInWindow(alert.tenant_id);
  const ceilingAllows = inWindow < usedCeiling;
  const vvuSnap = deps.vvu.snapshot();
  const backlogCeiling = BACKLOG_CEILING;

  const ctx: DecisionContext = {
    policy: policySnap.freshness,
    localConsentValid: consentValid,
    localCeilingAllows: ceilingAllows,
    risk: alert.risk,
    vvu: vvuSnap.state,
    backlogDepth: vvuSnap.backlogDepth,
    backlogCeiling,
  };

  // 2. §4 verbatim — missing proof delays suppression, never authorizes it.
  const decision = decide(ctx);

  // 3. ONE transaction: decision + outbox (the outbox guarantee).
  const decidedAt = nowIso();
  const result = db.transaction((tx): DecideResult => {
    const inserted = tx
      .insert(safegridDecision)
      .values({
        alertId: alert.alert_id,
        tenantId: alert.tenant_id,
        cameraId: alert.camera_id,
        risk: alert.risk,
        decision,
        policyEpoch: policySnap.epoch,
        policyFreshness: policySnap.freshness,
        localConsentValid: consentValid,
        localCeilingAllows: ceilingAllows,
        vvuState: vvuSnap.state,
        backlogDepth: Math.min(vvuSnap.backlogDepth, 2_147_483_647),
        backlogCeiling,
        decidedAt,
      })
      .returning()
      .get();

    if (opts.crash === 'before_outbox_commit') {
      // Crash point 1: process dies after the decision INSERT but before
      // the transaction commits → ROLLBACK → no decision, no event.
      throw new Error('INJECTED CRASH: before_outbox_commit');
    }

    const envelope = buildOutboxPayload({
      decisionRow: inserted,
      alert: {
        alertId: alert.alert_id,
        cameraId: alert.camera_id,
        risk: alert.risk,
        classification: alert.classification ?? 'unclassified',
        score: Number.isSafeInteger(alert.score) ? (alert.score as number) : 0,
        receivedAt: alert.received_at ?? decidedAt,
      },
      basis: {
        policyEpoch: policySnap.epoch,
        policyFreshness: policySnap.freshness,
        localConsentValid: consentValid,
        localCeilingAllows: ceilingAllows,
        suppressionsInWindow: inWindow,
        ceiling: usedCeiling,
        vvuState: vvuSnap.state,
        backlogDepth: Math.min(vvuSnap.backlogDepth, 2_147_483_647),
        backlogCeiling,
      },
    });

    tx.insert(integrationOutbox)
      .values({
        id: randomUUID(),
        eventId: envelope.event_id,
        eventType: envelope.event_type,
        payload: JSON.stringify(envelope.payload), // NO sequence field — contract
        state: 'pending',
        availableAt: decidedAt,
        attempts: 0,
        createdAt: decidedAt,
      })
      .run();

    return { decisionRow: inserted, envelope, ctx };
  });

  if (opts.crash === 'after_outbox_commit') {
    // Crash point 2: transaction COMMITTED, then the process dies before
    // anything else — the row is pending and the relay's recovery claim
    // eventually delivers it. (Injection is post-return; the suite kills
    // the relay instead of the process here.)
    throw new Error('INJECTED CRASH: after_outbox_commit');
  }

  return result;
}

/** Look up the deterministic event id for a decision (tests + UI). */
export function eventIdOfDecision(tenantId: string, localDecisionId: number): string {
  return eventIdFor(tenantId, localDecisionId);
}
