// mini-services/safegrid/src/outbox/payload.ts
// ─────────────────────────────────────────────────────────────────────────────
// OUTBOX PAYLOAD BUILDER — the event contract VVU ingests and seals.
//
// §1 AMENDMENT (binding): the payload carries NO `sequence` field. A prior
// design claimed a payload field `sequence: bigserial` as the ordering
// fact; that claim was WRONG and is removed. Ordering is a decision, not a
// column:
//
//   · The WORM chain's append order (worm_seal_index.position, owned by
//     VVU, assigned by the append operation, monotonic per stream) is the
//     authoritative order for the stream. Nothing else is.
//   · `local_decision_id` below is safegrid_decision.id — LOCAL INSERTION
//     ORDER, diagnostic only, scoped to the SafeGrid decision table. It
//     makes NO ordering claim about the stream and is never used by VVU
//     for positioning.
//   · `occurred_at` is informational. No timestamp establishes order.
//
// Every value is a JSON string / safe integer / boolean (JCS-safe by
// construction — VVU canonicalizes with RFC 8785 and rejects non-integers;
// see §3). VVU FAILS CLOSED on any payload that still carries `sequence`
// (HTTP 400 SEQUENCE_FIELD_FORBIDDEN at /api/safegrid/inbox).
//
// Stream scope (§1.5): stream_id = tenant_id, declared for this pipeline.
// A different scope later = a NEW stream identifier, not a reinterpretation.
// ─────────────────────────────────────────────────────────────────────────────

import type { SafegridDecisionRow } from '../db/schema';
import type { Decision, Risk, VvuState } from '../policy';

export const EVENT_TYPE = 'safegrid.decision.v1';
export const CONSUMER_NAME = 'vvu';

export interface DecisionEventPayload {
  tenant_id: string; // == stream_id (declared scope)
  occurred_at: string; // RFC 3339 UTC ms — informational, NOT ordering
  local_decision_id: number; // safegrid_decision.id — local insertion order, diagnostic only
  alert: {
    alert_id: string;
    camera_id: string;
    risk: Risk;
    classification: string;
    score: number; // 0..100 safe integer
    received_at: string; // informational
  };
  decision: Decision;
  decision_basis: {
    policy_epoch: number | null; // null = policy missing (fail closed)
    policy_freshness: 'fresh' | 'stale' | 'missing';
    local_consent_valid: boolean;
    local_ceiling_allows: boolean;
    suppressions_in_window: number;
    ceiling: number;
    vvu_state: VvuState;
    backlog_depth: number;
    backlog_ceiling: number;
  };
}

/** The full POST envelope for the VVU inbox. event_id is DETERMINISTIC
 * (derived from tenant + decision id) so a relay retry after a crash
 * re-POSTs the SAME event id and VVU's (consumer_name, event_id) unique
 * constraint makes the duplicate harmless (§: exactly-once terminal
 * effect, not exactly-once transport). */
export interface OutboxEnvelope {
  consumer_name: string;
  event_id: string;
  event_type: string;
  stream_id: string; // = payload.tenant_id (declared scope; VVU enforces the equality)
  payload: DecisionEventPayload;
}

export interface BuildPayloadInput {
  decisionRow: SafegridDecisionRow;
  alert: { alertId: string; cameraId: string; risk: Risk; classification: string; score: number; receivedAt: string };
  basis: {
    policyEpoch: number | null;
    policyFreshness: 'fresh' | 'stale' | 'missing';
    localConsentValid: boolean;
    localCeilingAllows: boolean;
    suppressionsInWindow: number;
    ceiling: number;
    vvuState: VvuState;
    backlogDepth: number;
    backlogCeiling: number;
  };
}

/** Deterministic idempotency key for a decision event. */
export function eventIdFor(tenantId: string, localDecisionId: number): string {
  return `safegrid.decision.${tenantId}.${localDecisionId}`;
}

/** Build the payload + envelope. NOTE (test contract): the produced
 * payload object has NO `sequence` property — asserted by the acceptance
 * suite (ordering.test.ts) and enforced again at the VVU boundary. */
export function buildOutboxPayload(input: BuildPayloadInput): OutboxEnvelope {
  const d = input.decisionRow;
  const payload: DecisionEventPayload = {
    tenant_id: d.tenantId,
    occurred_at: d.decidedAt,
    local_decision_id: d.id,
    alert: {
      alert_id: input.alert.alertId,
      camera_id: input.alert.cameraId,
      risk: input.alert.risk,
      classification: input.alert.classification,
      score: input.alert.score,
      received_at: input.alert.receivedAt,
    },
    decision: d.decision as Decision,
    decision_basis: {
      policy_epoch: input.basis.policyEpoch,
      policy_freshness: input.basis.policyFreshness,
      local_consent_valid: input.basis.localConsentValid,
      local_ceiling_allows: input.basis.localCeilingAllows,
      suppressions_in_window: input.basis.suppressionsInWindow,
      ceiling: input.basis.ceiling,
      vvu_state: input.basis.vvuState,
      backlog_depth: input.basis.backlogDepth,
      backlog_ceiling: input.basis.backlogCeiling,
    },
  };
  return {
    consumer_name: CONSUMER_NAME,
    event_id: eventIdFor(d.tenantId, d.id),
    event_type: EVENT_TYPE,
    stream_id: payload.tenant_id,
    payload,
  };
}
