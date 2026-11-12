// mini-services/safegrid/src/routes/alerts.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAFEGRID API ROUTES (Express 5).
//
// Producer surface:
//   POST /v1/alerts                  — ingest an alert, decide (§4), store
//                                       decision + outbox in ONE transaction
//   GET  /v1/decisions?limit=        — recent decisions + their outbox state
//   GET  /v1/outbox/status           — state counts, due count, relay stats,
//                                       VVU health snapshot, policy snapshot
//   POST /v1/outbox/relay/tick       — one relay pass now (manual/demo)
//   POST /v1/outbox/failed/requeue   — requeue dead-lettered rows (operator)
//
// Test/demo hooks (DISCLOSED — they exist so the acceptance suite and the
// QA demo can drive deterministic states without killing real processes):
//   POST /v1/admin/policy            — {epoch} set · {clear:true} remove
//   POST /v1/admin/consent           — {tenant_id, ttl_ms}
//   POST /v1/admin/vvu-health        — {state:'healthy'|'degraded'|'unavailable'|'auto'}
//   POST /v1/admin/relay             — {running:boolean} (crash simulation)
//
// Every handler validates its input and fails closed (400 on contract
// violations; nothing is inferred from a malformed request).
// ─────────────────────────────────────────────────────────────────────────────

import type { NextFunction, Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { desc, eq, sql } from 'drizzle-orm';

import { db, sqlite } from '../db';
import { integrationOutbox, safegridDecision } from '../db/schema';
import { decideAndStore, type AlertInput } from '../decide-store';
import type { ConsentStore, PolicyStore, Risk } from '../policy';
import type { VvuHealth } from '../vvu-health';
import { dueOutboxCount } from '../outbox/claim';
import type { OutboxRelay } from '../outbox/relay';

export interface SafegridDeps {
  policy: PolicyStore;
  consent: ConsentStore;
  vvu: VvuHealth;
  relay: OutboxRelay;
}

const RISKS: Risk[] = ['low', 'high', 'unknown'];

export function buildAlertsRouter(deps: SafegridDeps): Router {
  const r = makeRouter();

  // ── helpers ──────────────────────────────────────────────────────────────
  function parseAlert(body: unknown): { ok: true; alert: AlertInput } | { ok: false; error: string } {
    if (typeof body !== 'object' || body === null) return { ok: false, error: 'body must be a JSON object' };
    const b = body as Record<string, unknown>;
    const alertId = typeof b.alert_id === 'string' ? b.alert_id.trim() : '';
    const tenantId = typeof b.tenant_id === 'string' ? b.tenant_id.trim() : '';
    const cameraId = typeof b.camera_id === 'string' ? b.camera_id.trim() : '';
    const risk = b.risk;
    if (!alertId) return { ok: false, error: 'alert_id (non-empty string) is required' };
    if (!tenantId) return { ok: false, error: 'tenant_id (non-empty string) is required — it is the stream scope' };
    if (!cameraId) return { ok: false, error: 'camera_id (non-empty string) is required' };
    if (typeof risk !== 'string' || !RISKS.includes(risk as Risk)) {
      return { ok: false, error: `risk must be one of ${RISKS.join(' | ')}` };
    }
    const score = b.score === undefined ? 0 : b.score;
    if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0 || score > 100) {
      return { ok: false, error: 'score must be a safe integer 0..100' };
    }
    return {
      ok: true,
      alert: {
        alert_id: alertId,
        tenant_id: tenantId,
        camera_id: cameraId,
        risk: risk as Risk,
        classification: typeof b.classification === 'string' ? b.classification : 'unclassified',
        score,
        received_at: typeof b.received_at === 'string' ? b.received_at : undefined,
      },
    };
  }

  // ── producer surface ─────────────────────────────────────────────────────

  r.post('/v1/alerts', (req: Request, res: Response) => {
    const parsed = parseAlert(req.body);
    if (!parsed.ok) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }
    // Crash-point hook (DISCLOSED test hook — the acceptance suite's eight
    // crash points): crash_point='before_outbox_commit' aborts the decision
    // transaction after the decision INSERT (rollback: no decision, no
    // event); 'after_outbox_commit' commits both rows and then fails the
    // response (client sees an error, state survives — the outbox owns
    // delivery from there).
    const crash = (req.body as Record<string, unknown> | null)?.crash_point;
    if (crash !== undefined && crash !== 'before_outbox_commit' && crash !== 'after_outbox_commit') {
      res.status(400).json({ ok: false, error: "crash_point must be 'before_outbox_commit' | 'after_outbox_commit'" });
      return;
    }
    let result: ReturnType<typeof decideAndStore>;
    try {
      result = decideAndStore(parsed.alert, deps, { crash: crash as never });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('INJECTED CRASH')) {
        res.status(500).json({ ok: false, error: 'INJECTED_CRASH', point: crash });
        return;
      }
      throw err;
    }
    res.status(200).json({
      ok: true,
      decision: result.decisionRow.decision,
      local_decision_id: result.decisionRow.id, // local insertion order — diagnostic only
      event_id: result.envelope.event_id,
      stream_id: result.envelope.stream_id,
      vvu_state: result.ctx.vvu,
      policy_freshness: result.ctx.policy,
      evidence: {
        local_consent_valid: result.ctx.localConsentValid,
        local_ceiling_allows: result.ctx.localCeilingAllows,
        risk: result.ctx.risk,
        backlog_depth: result.ctx.backlogDepth,
        backlog_ceiling: result.ctx.backlogCeiling,
      },
    });
  });

  r.get('/v1/decisions', (req: Request, res: Response) => {
    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 25;
    const includePayload = req.query.include_payload === '1'; // test/QA hook (payload contract assertions)
    const rows = db
      .select({
        id: safegridDecision.id,
        alertId: safegridDecision.alertId,
        tenantId: safegridDecision.tenantId,
        cameraId: safegridDecision.cameraId,
        risk: safegridDecision.risk,
        decision: safegridDecision.decision,
        policyEpoch: safegridDecision.policyEpoch,
        policyFreshness: safegridDecision.policyFreshness,
        localConsentValid: safegridDecision.localConsentValid,
        localCeilingAllows: safegridDecision.localCeilingAllows,
        vvuState: safegridDecision.vvuState,
        decidedAt: safegridDecision.decidedAt, // informational
        outboxState: integrationOutbox.state,
        outboxAttempts: integrationOutbox.attempts,
        outboxLastError: integrationOutbox.lastError,
        eventId: integrationOutbox.eventId,
      })
      .from(safegridDecision)
      .leftJoin(integrationOutbox, eq(integrationOutbox.eventId, sql`'safegrid.decision.' || ${safegridDecision.tenantId} || '.' || ${safegridDecision.id}`))
      .orderBy(desc(safegridDecision.id)) // local insertion order (diagnostic display only)
      .limit(limit)
      .all();
    const out = rows.map((row) => ({
      ...row,
      payload: includePayload
        ? db.select({ payload: integrationOutbox.payload }).from(integrationOutbox).where(eq(integrationOutbox.eventId, row.eventId ?? '')).get()?.payload ?? null
        : undefined,
    }));
    res.json({ ok: true, decisions: out });
  });

  r.get('/v1/outbox/status', (_req: Request, res: Response) => {
    const counts = { pending: 0, processing: 0, delivered: 0, failed: 0 } as Record<string, number>;
    for (const row of db.select({ state: integrationOutbox.state, n: sql<number>`count(*)` }).from(integrationOutbox).groupBy(integrationOutbox.state).all()) {
      counts[row.state] = row.n;
    }
    res.json({
      ok: true,
      counts,
      due: dueOutboxCount(),
      relay: deps.relay.stats,
      vvu: deps.vvu.snapshot(),
      policy: deps.policy.snapshot(),
    });
  });

  r.post('/v1/outbox/relay/tick', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const t = await deps.relay.tick();
      res.json({ ok: true, tick: t });
    } catch (err) {
      next(err);
    }
  });

  r.post('/v1/outbox/failed/requeue', (_req: Request, res: Response) => {
    const run = sqlite
      .prepare(
        `UPDATE integration_outbox
            SET state = 'pending', available_at = ?, lease_until = NULL, last_error = NULL
          WHERE state = 'failed'`,
      )
      .run(new Date().toISOString());
    res.json({ ok: true, requeued: run.changes });
  });

  // ── admin / test hooks (DISCLOSED) ───────────────────────────────────────

  r.post('/v1/admin/policy', (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.clear === true) {
      deps.policy.clear();
      res.json({ ok: true, policy: deps.policy.snapshot() });
      return;
    }
    const epoch = b.epoch;
    if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 1) {
      res.status(400).json({ ok: false, error: 'epoch must be a positive safe integer (or {clear:true})' });
      return;
    }
    // fetchedAt override lets the suite construct a STALE policy deterministically.
    const fetchedAt = typeof b.fetchedAt === 'number' && Number.isSafeInteger(b.fetchedAt) ? b.fetchedAt : Date.now();
    deps.policy.set({ epoch, fetchedAt });
    res.json({ ok: true, policy: deps.policy.snapshot() });
  });

  r.post('/v1/admin/consent', (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof b.tenant_id === 'string' ? b.tenant_id : '';
    const ttlMs = b.ttl_ms === undefined ? 3_600_000 : b.ttl_ms;
    if (!tenantId || typeof ttlMs !== 'number' || !Number.isSafeInteger(ttlMs) || ttlMs < 0) {
      res.status(400).json({ ok: false, error: 'tenant_id (string) and ttl_ms (safe integer >= 0) are required' });
      return;
    }
    if (b.revoke === true) {
      deps.consent.revoke(tenantId);
    } else {
      deps.consent.grant(tenantId, ttlMs);
    }
    res.json({ ok: true, consent_valid: deps.consent.valid(tenantId) });
  });

  r.post('/v1/admin/vvu-health', (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const state = b.state;
    if (typeof state !== 'string' || !['healthy', 'degraded', 'unavailable', 'auto'].includes(state)) {
      res.status(400).json({ ok: false, error: "state must be 'healthy' | 'degraded' | 'unavailable' | 'auto'" });
      return;
    }
    deps.vvu.force(state as 'healthy' | 'degraded' | 'unavailable' | 'auto');
    res.json({ ok: true, vvu: deps.vvu.snapshot() });
  });

  r.post('/v1/admin/relay', (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.running === true) {
      deps.relay.start();
    } else if (b.running === false) {
      deps.relay.stop(); // "worker crashed": nothing gets claimed until resumed
    } else {
      res.status(400).json({ ok: false, error: 'running (boolean) is required' });
      return;
    }
    res.json({ ok: true, relay: deps.relay.stats });
  });

  return r;
}
