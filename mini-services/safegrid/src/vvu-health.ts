// mini-services/safegrid/src/vvu-health.ts
// ─────────────────────────────────────────────────────────────────────────────
// VVU DELIVERY-HEALTH PROBE — the ctx.vvu input of the §4 predicate.
//
// Probes GET {VVU_BASE}/api/safegrid/health on an interval and caches the
// latest snapshot. FAIL CLOSED: until a probe succeeds the state is
// 'unavailable', and every probe error returns to 'unavailable' — an
// unknown VVU state never authorizes suppression.
//
// State semantics (REPORTED — operator-decided):
//   · fetch error / timeout / non-200 → 'unavailable'
//   · 200 with backlog === 0          → 'healthy'
//   · 200 with backlog > 0            → 'degraded', backlogDepth = backlog
//     (responsive but sealing is behind — §4 allows suppression only
//      while backlogDepth <= backlogCeiling)
//
// TOPOLOGY DISCLOSURE: in this sandbox the probe and the relay POST share
// the same network path to the same host, so a partition that breaks
// delivery also breaks the probe. In a topology where they could diverge,
// the probe alone must NOT be the only delivery-failure detector — the
// outbox retry/dead-letter path is the durable backstop either way.
//
// Probe interval / timeout / backlog ceiling = SPEC (measure in pilot).
// ─────────────────────────────────────────────────────────────────────────────

import type { VvuState } from './policy';

export interface VvuHealthSnapshot {
  state: VvuState;
  backlogDepth: number;
  checkedAt: string; // informational
  lastError: string | null;
}

export const BACKLOG_CEILING = Number(process.env.SAFEGRID_BACKLOG_CEILING ?? 500); // SPEC
const PROBE_INTERVAL_MS = Number(process.env.SAFEGRID_PROBE_INTERVAL_MS ?? 2_000); // SPEC
const PROBE_TIMEOUT_MS = Number(process.env.SAFEGRID_PROBE_TIMEOUT_MS ?? 1_500); // SPEC

export class VvuHealth {
  private snap: VvuHealthSnapshot = {
    state: 'unavailable', // fail closed until first success
    backlogDepth: Number.MAX_SAFE_INTEGER,
    checkedAt: new Date().toISOString(),
    lastError: 'no probe completed yet',
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private inflight: Promise<void> | null = null;
  private override: VvuState | null = null; // deterministic test/demo hook

  constructor(private baseUrl: string) {}

  snapshot(): VvuHealthSnapshot {
    return this.override
      ? { ...this.snap, state: this.override, backlogDepth: this.override === 'healthy' ? 0 : this.snap.backlogDepth }
      : this.snap;
  }

  /** Test/demo hook: force a state ('auto' restores the prober). Disclosed:
   * used by /v1/admin/vvu-health so QA can demonstrate the fail-closed
   * policy transitions without killing a real VVU. */
  force(state: VvuState | 'auto'): void {
    this.override = state === 'auto' ? null : state;
    if (state === 'auto') void this.probeOnce();
  }

  async probeOnce(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(`${this.baseUrl}/api/safegrid/health`, {
          signal: ctrl.signal,
          headers: { accept: 'application/json' },
        });
        if (!res.ok) {
          this.snap = {
            state: 'unavailable',
            backlogDepth: Number.MAX_SAFE_INTEGER,
            checkedAt: new Date().toISOString(),
            lastError: `health endpoint HTTP ${res.status}`,
          };
          return;
        }
        const body = (await res.json()) as { backlog?: unknown };
        const backlog = typeof body.backlog === 'number' && Number.isSafeInteger(body.backlog) && body.backlog >= 0
          ? body.backlog
          : null;
        if (backlog === null) {
          // Malformed health body — cannot determine state ⇒ fail closed.
          this.snap = {
            state: 'unavailable',
            backlogDepth: Number.MAX_SAFE_INTEGER,
            checkedAt: new Date().toISOString(),
            lastError: 'health endpoint body missing a valid integer backlog',
          };
          return;
        }
        this.snap = {
          state: backlog === 0 ? 'healthy' : 'degraded',
          backlogDepth: backlog,
          checkedAt: new Date().toISOString(),
          lastError: null,
        };
      } catch (err) {
        this.snap = {
          state: 'unavailable',
          backlogDepth: Number.MAX_SAFE_INTEGER,
          checkedAt: new Date().toISOString(),
          lastError: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(t);
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  start(): void {
    if (this.timer) return;
    void this.probeOnce();
    this.timer = setInterval(() => void this.probeOnce(), PROBE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
