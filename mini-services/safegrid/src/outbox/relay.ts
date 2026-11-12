// mini-services/safegrid/src/outbox/relay.ts
// ─────────────────────────────────────────────────────────────────────────────
// RELAY WORKER — the async side of the transactional outbox.
//
// Loop per tick:
//   1. CLAIM a due batch (single atomic statement; lease committed with it
//      — src/outbox/claim.ts). NO row lock (SQLite has none to hold) and
//      NO transaction is open after the claim returns.
//   2. POST each claimed event to the VVU inbox (envelope = the payload
//      bytes committed in the decision transaction — the relay never
//      rebuilds a payload; it is a courier, not an author).
//   3. UPDATE the row from the POST outcome:
//        · 2xx sealed | duplicate → 'delivered' (duplicate IS success —
//          exactly-once terminal effect, not exactly-once transport)
//        · 4xx contract violation → 'failed' (dead-letter; manual requeue)
//        · 5xx / network / timeout → 'pending' with available_at = now +
//          exponential backoff; after MAX_ATTEMPTS → 'failed'
//
// CRASH RECOVERY: if the process dies between claim and update, the row
// stays 'processing' with lease_until in the future; once the lease
// expires the exact recovery predicate in claim.ts re-claims it. A
// duplicate POST that results is harmless by design (VVU upsert +
// appendIfAbsent).
//
// HOT-PATH ISOLATION (the acceptance test asserts it): the decision
// handler never awaits this loop. When VVU is down, the loop-level
// cool-down backs off (250 ms → 5 s) so futile claims don't contend with
// decision transactions on the shared DB file.
//
// Backoff schedule / max attempts / tick / batch / POST timeout = SPEC
// (must be measured in the pilot). Lease = 30 s (SPEC).
// ─────────────────────────────────────────────────────────────────────────────

import { sql } from 'drizzle-orm';

import { db, nowIso } from '../db';
import type { IntegrationOutboxRow } from '../db/schema';
import { claimDueOutbox, CLAIM_BATCH, LEASE_MS } from './claim';
import { CONSUMER_NAME, type OutboxEnvelope } from './payload';

export const RELAY_TICK_MS = Number(process.env.SAFEGRID_RELAY_TICK_MS ?? 250); // SPEC
export const POST_TIMEOUT_MS = Number(process.env.SAFEGRID_POST_TIMEOUT_MS ?? 2_000); // SPEC
export const MAX_ATTEMPTS = Number(process.env.SAFEGRID_MAX_ATTEMPTS ?? 8); // SPEC
const BACKOFF_BASE_MS = 250; // SPEC
const BACKOFF_CAP_MS = 30_000; // SPEC
const COOLDOWN_CAP_MS = 5_000; // SPEC

export interface RelayStats {
  running: boolean;
  ticks: number;
  postsOk: number; // sealed
  postsDuplicate: number;
  postsFailed: number; // retryable failures
  deadLettered: number;
  lastError: string | null;
  lastTickAt: string | null;
  cooldownUntil: string | null; // informational
  leaseMs: number;
}

export class OutboxRelay {
  private timer: ReturnType<typeof setInterval> | null = null;
  private cooldownMult = 1;
  private busy = false;
  stats: RelayStats = {
    running: false,
    ticks: 0,
    postsOk: 0,
    postsDuplicate: 0,
    postsFailed: 0,
    deadLettered: 0,
    lastError: null,
    lastTickAt: null,
    cooldownUntil: null,
    leaseMs: LEASE_MS,
  };

  constructor(private vvuBase: string) {}

  /** One pass: claim → POST → update. Exposed directly for tests and for
   * the manual /v1/outbox/relay/tick endpoint. */
  async tick(): Promise<{ claimed: number; sealed: number; duplicate: number; failed: number }> {
    const claimed = claimDueOutbox(CLAIM_BATCH);
    let sealed = 0;
    let duplicate = 0;
    let failed = 0;
    let networkFailures = 0;
    for (const row of claimed) {
      const outcome = await this.postOne(row);
      if (outcome.kind === 'sealed') sealed++;
      else if (outcome.kind === 'duplicate') duplicate++;
      else if (outcome.kind === 'retryable') { failed++; if (outcome.network) networkFailures++; }
      else if (outcome.kind === 'dead') { failed++; this.stats.deadLettered++; }
    }
    this.stats.ticks++;
    this.stats.lastTickAt = nowIso();
    // Loop-level cool-down: a tick where every POST failed on the network
    // backs the loop off exponentially (hot-path isolation).
    if (claimed.length > 0 && failed === claimed.length && networkFailures === claimed.length) {
      this.cooldownMult = Math.min(this.cooldownMult * 2, COOLDOWN_CAP_MS / RELAY_TICK_MS);
      this.stats.cooldownUntil = new Date(Date.now() + this.cooldownMult * RELAY_TICK_MS).toISOString();
    } else {
      this.cooldownMult = 1;
      this.stats.cooldownUntil = null;
    }
    return { claimed: claimed.length, sealed, duplicate, failed };
  }

  /** POST one claimed row. No transaction and no lock is open while this
   * awaits the network. */
  private async postOne(row: IntegrationOutboxRow): Promise<
    | { kind: 'sealed'; sealRef: string | null }
    | { kind: 'duplicate'; sealRef: string | null }
    | { kind: 'retryable'; network: boolean; error: string }
    | { kind: 'dead'; error: string }
  > {
    let envelope: OutboxEnvelope;
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      envelope = {
        consumer_name: CONSUMER_NAME,
        event_id: row.eventId,
        event_type: row.eventType,
        stream_id: String(payload.tenant_id ?? ''),
        payload: payload as unknown as OutboxEnvelope['payload'],
      };
      if (!envelope.stream_id) throw new Error('payload has no tenant_id (stream scope)');
    } catch (err) {
      // Contract violation in the stored payload — dead-letter, never retry.
      const error = err instanceof Error ? err.message : String(err);
      await this.markFailed(row, error);
      return { kind: 'dead', error };
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.vvuBase}/api/safegrid/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(t);
      const error = err instanceof Error ? err.message : String(err);
      await this.markRetryable(row, error);
      return { kind: 'retryable', network: true, error };
    }
    clearTimeout(t);

    if (res.ok) {
      let body: { status?: string; seal_ref?: string | null } = {};
      try { body = (await res.json()) as typeof body; } catch { /* body optional */ }
      const sealRef = typeof body.seal_ref === 'string' ? body.seal_ref : null;
      if (body.status === 'duplicate') {
        this.stats.postsDuplicate++;
        await this.markDelivered(row, sealRef);
        return { kind: 'duplicate', sealRef };
      }
      this.stats.postsOk++;
      await this.markDelivered(row, sealRef);
      return { kind: 'sealed', sealRef };
    }

    const error = `HTTP ${res.status}`;
    if (res.status >= 400 && res.status < 500) {
      // Permanent contract violation (e.g. SEQUENCE_FIELD_FORBIDDEN) —
      // retrying cannot fix the payload. Dead-letter.
      await this.markFailed(row, error);
      return { kind: 'dead', error };
    }
    await this.markRetryable(row, error);
    return { kind: 'retryable', network: false, error };
  }

  private async markDelivered(row: IntegrationOutboxRow, _sealRef: string | null): Promise<void> {
    await db.run(sql`
      UPDATE integration_outbox
         SET state = 'delivered', delivered_at = ${nowIso()},
             lease_until = NULL, last_error = NULL
       WHERE id = ${row.id}`);
  }

  private async markRetryable(row: IntegrationOutboxRow, error: string): Promise<void> {
    this.stats.postsFailed++;
    this.stats.lastError = error;
    if (row.attempts >= MAX_ATTEMPTS) {
      await this.markFailed(row, `${error} (after ${row.attempts} attempts)`);
      return;
    }
    const backoff = Math.min(BACKOFF_BASE_MS * 2 ** row.attempts, BACKOFF_CAP_MS);
    await db.run(sql`
      UPDATE integration_outbox
         SET state = 'pending',
             available_at = ${new Date(Date.now() + backoff).toISOString()},
             lease_until = NULL,
             last_error = ${error}
       WHERE id = ${row.id}`);
  }

  private async markFailed(row: IntegrationOutboxRow, error: string): Promise<void> {
    this.stats.lastError = error;
    await db.run(sql`
      UPDATE integration_outbox
         SET state = 'failed', lease_until = NULL, last_error = ${error}
       WHERE id = ${row.id}`);
  }

  /** The loop. `running=false` (admin/test hook) simulates a crashed
   * worker: nothing is claimed, rows simply wait — the acceptance suite
   * proves no event is lost when it resumes. */
  start(): void {
    if (this.timer) return;
    this.stats.running = true;
    this.timer = setInterval(() => {
      if (this.busy) return;
      if (this.cooldownMult > 1 && this.stats.cooldownUntil && Date.now() < Date.parse(this.stats.cooldownUntil)) {
        return; // cooling down (VVU down) — hot-path isolation
      }
      this.busy = true;
      // The tick's own failures are RECORDED, never unhandled — an
      // unhandled rejection would kill the worker process (Bun semantics),
      // and a dead relay is exactly what the lease-recovery path exists
      // to survive — but it should also never happen on a transient
      // SQLITE_BUSY.
      void this.tick()
        .catch((e: unknown) => {
          this.stats.lastError = e instanceof Error ? e.message : String(e);
          console.error('[safegrid-relay] tick failed (will retry):', this.stats.lastError);
        })
        .finally(() => { this.busy = false; });
    }, RELAY_TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stats.running = false;
  }
}
