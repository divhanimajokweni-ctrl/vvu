// mini-services/safegrid/src/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAFEGRID API SERVER — the producer side of the SafeGrid → VVU pipeline.
//
// One Bun + TypeScript mini-service (Express 5) on port 3008:
//
//   alert ──▶ /v1/alerts ──▶ §4 decide ──▶ ONE tx { decision + outbox }
//                                            │
//              ┌─────────────────────────────┘
//              ▼
//   relay worker (claim → POST → update, lease-based, no lock across HTTP)
//              │
//              ▼  POST /api/safegrid/inbox  (Next.js · the VVU consumer)
//              inbox (atomic upsert) ──▶ worm appendIfAbsent ──▶ sealed
//
// The pipeline's ordering contract (Round 57, §1): the WORM chain's append
// order is the authoritative order for the stream. No payload sequence, no
// timestamp ordering, no exactly-once transport — exactly-once terminal
// effect via idempotency.
//
// Env (all optional): SAFEGRID_PORT (3008) · SAFEGRID_DB_PATH ·
// SAFEGRID_VVU_BASE (http://127.0.0.1:3000) · SAFEGRID_LEASE_MS ·
// SAFEGRID_RELAY_TICK_MS · SAFEGRID_BACKLOG_CEILING · … (see policy.ts /
// claim.ts / relay.ts for the full SPEC-tagged list).
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';

import { migrate } from './db';
import { ConsentStore, PolicyStore } from './policy';
import { buildAlertsRouter } from './routes/alerts';
import { OutboxRelay } from './outbox/relay';
import { VvuHealth } from './vvu-health';

const PORT = Number(process.env.SAFEGRID_PORT ?? 3008); // hardcoded default — the dashboard + gateway depend on it
const VVU_BASE = process.env.SAFEGRID_VVU_BASE ?? 'http://127.0.0.1:3000'; // Next.js dev server (server-to-server)

// ── boot ────────────────────────────────────────────────────────────────────
const migrations = migrate();
console.log(`[safegrid] migrations applied: ${migrations.join(', ')}`);

export const policy = new PolicyStore();
export const consent = new ConsentStore();
export const vvuHealth = new VvuHealth(VVU_BASE);
export const relay = new OutboxRelay(VVU_BASE);

// Boot baseline (REPORTED — demo decision, disclosed): a fresh policy
// document epoch 1 so the live pipeline isn't dead on arrival. CONSENT IS
// NOT SEEDED — suppression stays refused until an operator grants consent
// for a tenant (the fail-closed path is the demo's default state).
policy.set({ epoch: 1, fetchedAt: Date.now() });

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(buildAlertsRouter({ policy, consent, vvu: vvuHealth, relay }));

app.get('/v1/health', (_req, res) => {
  res.json({ ok: true, service: 'safegrid', port: PORT, vvuBase: VVU_BASE });
});

// Express 5: async rejections forwarded here; fail closed with a plain 500.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[safegrid] unhandled route error:', err);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'internal error' });
});

vvuHealth.start();
relay.start();

app.listen(PORT, () => {
  console.log(`[safegrid] listening on :${PORT} · VVU base ${VVU_BASE} · relay + health probe running`);
});
