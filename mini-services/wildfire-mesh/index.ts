// mini-services/wildfire-mesh/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// VVU · WINTER POOLS · WILDFIRE EMERGENCY MESH (Task 41-a) — the backend for
// the operator-side (NOT demo) "Winter Pools · Wildfire Emergency View".
// Cape Town co-op members + fire officers use this at 03:00 during an
// incident declaration.
//
// WHAT IT IS: a consent-gated emergency mesh service.
//   · FSM: NORMAL → WATCH → DECLARED → ESCALATED → STAND-DOWN → NORMAL with
//     legal de-escalations (WATCH→NORMAL, DECLARED→WATCH, ESCALATED→DECLARED).
//     src/lib/wildfire-fsm.ts is the SINGLE SOURCE OF TRUTH — imported here
//     by relative path, same pattern as vvu-field-onboard importing
//     src/lib/proofbridge/merkle.ts.
//   · CONSENT GATE (hard, not cosmetic): a member's field node is PRESENT on
//     the mesh ONLY while their `wildfire.emergency.mesh` authorisation is
//     granted. Revoked members are ABSENT from telemetry AND from the
//     snapshot `nodes` list — never dimmed, never half-visible. Grant/revoke
//     is a first-class, visible, testable action in BOTH directions.
//   · JOURNAL: append-only SHA-256 hash chain (WORM discipline), persisted
//     write-through to data/journal.json, restored at boot (if the file's
//     chain fails verification the broken file is PRESERVED and a fresh
//     genesis starts — a broken chain is never silently continued).
//     GET /verify recomputes the whole chain from genesis — REAL recompute,
//     not a cached flag.
//
// HONESTY LABELS (never print a tier the chain does not have):
//   · Field nodes are SIMULATED — every telemetry frame and snapshot node
//     carries `sim:true`. No real paired device exists yet.
//   · Journal tier: T0 · LOCAL_SOFTWARE_SHA256_CHAIN — local software chain,
//     NO external anchor (no counter-signature, no blockchain).
//   · Mirroring to the estate ledger (POST /api/vvu/ledger) is NOT WIRED;
//     journal entries carry the ledger-ready WORM projection in data.details.
//
// PORT: 3006 (WILDFIRE_PORT env override; the default is hardcoded because
// the dashboard + gateway depend on it).
//
// GATEWAY CONTRACT: the browser connects through the Caddy gateway on :81 —
//   socket.io: io("/?XTransformPort=3006")   → engine.io path MUST be '/'
//   HTTP:       GET /status?XTransformPort=3006, POST /fsm?XTransformPort=3006 …
// With engine path '/', engine.io intercepts every URL that starts with '/',
// so HTTP routes are served through an io.engine.use middleware that
// short-circuits before engine.io's verify() step (verified pattern shared
// with telemetry-service :3003 and vvu-field-onboard :3005; socket.io 4.8.3).
// ─────────────────────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Server, type Socket } from 'socket.io';
import {
  WILDFIRE_STATES,
  WILDFIRE_MEMBER_SEED,
  canTransition,
  wildfireWormEvent,
  wildfireConsentWormEvent,
  type WildfireFsmState,
  type WildfireMemberSeed,
} from '../../src/lib/wildfire-fsm';

// ─── Constants ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.WILDFIRE_PORT ?? 3006); // hardcoded default — the dashboard depends on it
const HERE = dirname(new URL(import.meta.url).pathname);
const DATA_DIR = join(HERE, 'data');
const JOURNAL_FILE = join(DATA_DIR, 'journal.json');

const TIER = 'T0 · LOCAL_SOFTWARE_SHA256_CHAIN'; // honesty label — no external anchor
const GENESIS_PREV = '0'.repeat(64);
const TELEMETRY_TICK_MS = 4_000; // simulated field-node telemetry cadence
const HEARTBEAT_MIN_MS = 60_000; // mesh.heartbeat journal cadence — keeps the chain readable
const JOURNAL_DEFAULT_LIMIT = 100;
const JOURNAL_MAX_LIMIT = 1000;

const BOOT_TS = new Date().toISOString();
const BOOT_MS = Date.now();

// ─── Types ──────────────────────────────────────────────────────────────────

type JournalKind =
  | 'GENESIS'
  | 'fsm.seed'
  | 'wildfire.state.transition'
  | 'wildfire.mesh.consent.grant'
  | 'wildfire.mesh.consent.revoke'
  | 'mesh.node.telemetry'
  | 'mesh.heartbeat';

interface JournalEntry {
  seq: number;
  at: string; // ISO
  kind: JournalKind;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

interface FsmSnapshot {
  state: WildfireFsmState;
  at: string;
  actor: string;
}

type Member = WildfireMemberSeed; // roster row — consent is mutated by grant/revoke

/** Per-node SIMULATED sensor state — wind drifts smoothly via a phase. */
interface NodeSim {
  phase: number;
  windBase: number; // 15–45 kph centre
  windAmp: number; // oscillation amplitude
  batteryBase: number; // 60–100% at boot, slow drain
}

// ─── State ──────────────────────────────────────────────────────────────────

let journal: JournalEntry[] = [];
let fsm: FsmSnapshot = { state: 'NORMAL', at: BOOT_TS, actor: 'BOOT' };
const members: Member[] = WILDFIRE_MEMBER_SEED.map((m) => ({ ...m }));
const sims = new Map<string, NodeSim>();

// ─── Small helpers ──────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;
const isKnownState = (s: unknown): s is WildfireFsmState =>
  typeof s === 'string' && (WILDFIRE_STATES as readonly string[]).includes(s);

function journalHead(): string {
  return journal.length ? journal[journal.length - 1].hash : GENESIS_PREV;
}

// ─── Hash chain (WORM discipline) ───────────────────────────────────────────

/** hash = sha256(prevHash|seq|at|kind|JSON.stringify(data)) — the one and
 *  only recipe; /verify recomputes every entry with it. */
function entryHash(
  e: Pick<JournalEntry, 'seq' | 'at' | 'kind' | 'data' | 'prevHash'>
): string {
  return createHash('sha256')
    .update(`${e.prevHash}|${e.seq}|${e.at}|${e.kind}|${JSON.stringify(e.data)}`)
    .digest('hex');
}

/** REAL full-chain recompute from genesis: genesis shape, seq numbering,
 *  prevHash linkage and per-entry hash recomputation. No cached flags. */
function verifyChain(entries: readonly JournalEntry[]): { valid: boolean; reason?: string } {
  if (entries.length === 0) return { valid: false, reason: 'EMPTY' };
  if (entries[0].kind !== 'GENESIS' || entries[0].prevHash !== GENESIS_PREV) {
    return { valid: false, reason: 'BAD_GENESIS' };
  }
  let prev = GENESIS_PREV;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) return { valid: false, reason: `SEQ_BREAK@${e.seq}` };
    if (e.prevHash !== prev) return { valid: false, reason: `PREVHASH_BREAK@${e.seq}` };
    if (entryHash(e) !== e.hash) return { valid: false, reason: `HASH_BREAK@${e.seq}` };
    prev = e.hash;
  }
  return { valid: true };
}

function persistJournal(): void {
  writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2)); // write-through on every append (low volume)
}

function appendJournal(kind: JournalKind, data: Record<string, unknown>): JournalEntry {
  const prev = journal.length ? journal[journal.length - 1] : null;
  const draft = {
    seq: (prev?.seq ?? 0) + 1,
    at: new Date().toISOString(),
    kind,
    data,
    prevHash: prev?.hash ?? GENESIS_PREV,
  };
  const entry: JournalEntry = { ...draft, hash: entryHash(draft) };
  journal.push(entry);
  persistJournal();
  io.emit('wildfire.journal', { entry, head: journalHead(), count: journal.length });
  return entry;
}

// ─── HTTP + socket.io wiring (repo-verified engine-middleware pattern) ──────

const httpServer = createServer(); // HTTP routes served in the engine middleware below

const io = new Server(httpServer, {
  path: '/', // gateway contract: /?XTransformPort=3006
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Boot journal: fresh genesis vs verified restore ────────────────────────

/** Fresh chain: GENESIS + honest seed authorisation state (one consent entry
 *  per member, matching the seed) + fsm.seed note. Runtime member.consent
 *  values already equal the seed, so no replay needed here. */
function seedFreshJournal(): void {
  journal = [];
  appendJournal('GENESIS', {
    note: 'WINTER POOLS · WILDFIRE MESH JOURNAL — local software chain, no external anchor',
  });
  for (const m of WILDFIRE_MEMBER_SEED) {
    const worm = wildfireConsentWormEvent(m.id, m.callsign, m.consent, 'SEED-BOOTSTRAP');
    appendJournal(worm.event as JournalKind, {
      memberId: m.id,
      callsign: m.callsign,
      grant: m.consent,
      actor: 'SEED-BOOTSTRAP',
      details: worm.details,
      source: worm.source, // ledger-ready projection (mirror NOT WIRED)
    });
  }
  const e = appendJournal('fsm.seed', { state: 'NORMAL', actor: 'SEED-BOOTSTRAP', note: 'seed FSM — NORMAL at boot' });
  fsm = { state: 'NORMAL', at: e.at, actor: 'SEED-BOOTSTRAP' };
}

function loadJournalAtBoot(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(JOURNAL_FILE)) {
    console.log('[wildfire-mesh] no journal file — starting FRESH GENESIS chain');
    seedFreshJournal();
    return;
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(readFileSync(JOURNAL_FILE, 'utf8'));
  } catch {
    parsed = null;
  }
  const entries = Array.isArray(parsed) ? (parsed as JournalEntry[]) : null;
  const check = entries ? verifyChain(entries) : { valid: false, reason: 'UNPARSEABLE' };
  if (!entries || !check.valid) {
    // NEVER silently continue a broken chain: preserve the evidence on disk,
    // LOG loudly, start a fresh genesis.
    const backup = join(DATA_DIR, `journal.broken-${Date.now()}.json`);
    try {
      renameSync(JOURNAL_FILE, backup);
    } catch {
      /* backup best-effort — the fresh genesis below still starts clean */
    }
    console.error(
      `[wildfire-mesh] JOURNAL CHAIN FAILED VERIFICATION (${check.reason ?? 'UNPARSEABLE'}) — broken file preserved at ${backup}; starting FRESH GENESIS. The prior chain is NOT continued.`
    );
    seedFreshJournal();
    return;
  }
  journal = entries;
  // Replay the restored chain to rebuild runtime state honestly: consent
  // grants/revokes and FSM transitions in chain order; last one wins.
  for (const e of journal) {
    if (e.kind === 'wildfire.mesh.consent.grant' || e.kind === 'wildfire.mesh.consent.revoke') {
      const m = members.find((mm) => mm.id === e.data.memberId);
      if (m) m.consent = e.data.grant === true;
    } else if (e.kind === 'fsm.seed' || e.kind === 'wildfire.state.transition') {
      if (isKnownState(e.data.to ?? e.data.state)) {
        const next = (e.data.to ?? e.data.state) as WildfireFsmState;
        const actor = typeof e.data.actor === 'string' ? e.data.actor : 'REPLAY';
        fsm = { state: next, at: e.at, actor };
      }
    }
  }
  console.log(
    `[wildfire-mesh] journal restored: ${journal.length} entries · head ${journalHead().slice(0, 12)}… · fsm ${fsm.state} · present ${members.filter((m) => m.consent).length}/${members.length} nodes`
  );
}

// ─── Core actions (shared by HTTP POST and socket.request) ──────────────────

type FsmResult =
  | { ok: true; from: WildfireFsmState; to: WildfireFsmState; entry: JournalEntry }
  | { ok: false; code: 'UNKNOWN_STATE' | 'ILLEGAL_TRANSITION'; from: WildfireFsmState; to: string };

function applyFsmTransition(to: unknown, actor: unknown, reason: unknown): FsmResult {
  const from = fsm.state;
  if (!isKnownState(to)) return { ok: false, code: 'UNKNOWN_STATE', from, to: String(to) };
  const target = to;
  if (!canTransition(from, target)) return { ok: false, code: 'ILLEGAL_TRANSITION', from, to: target };
  const actorStr = typeof actor === 'string' && actor.trim() ? actor.trim() : 'UNKNOWN';
  const reasonStr = typeof reason === 'string' ? reason : '';
  const worm = wildfireWormEvent(from, target, actorStr, reasonStr);
  const entry = appendJournal(worm.event as JournalKind, {
    from,
    to: target,
    actor: actorStr,
    reason: reasonStr,
    details: worm.details,
    source: worm.source, // ledger-ready projection (mirror NOT WIRED)
  });
  fsm = { state: target, at: entry.at, actor: actorStr };
  io.emit('wildfire.fsm', { from, to: target, actor: actorStr, reason: reasonStr, at: entry.at, entry });
  return { ok: true, from, to: target, entry };
}

type ConsentResult =
  | { ok: true; member: Member; entry: JournalEntry }
  | { ok: false; code: 'UNKNOWN_MEMBER'; memberId: string };

function applyConsent(memberId: unknown, grant: unknown, actor: unknown, reason: unknown): ConsentResult {
  const id = typeof memberId === 'string' ? memberId : '';
  const member = members.find((m) => m.id === id);
  if (!member) return { ok: false, code: 'UNKNOWN_MEMBER', memberId: id };
  const grantBool = grant === true;
  const actorStr = typeof actor === 'string' && actor.trim() ? actor.trim() : 'UNKNOWN';
  const reasonStr = typeof reason === 'string' ? reason : '';
  const worm = wildfireConsentWormEvent(member.id, member.callsign, grantBool, actorStr);
  const entry = appendJournal(worm.event as JournalKind, {
    memberId: member.id,
    callsign: member.callsign,
    grant: grantBool,
    actor: actorStr,
    ...(reasonStr ? { reason: reasonStr } : {}),
    details: worm.details,
    source: worm.source, // ledger-ready projection (mirror NOT WIRED)
  });
  member.consent = grantBool; // the gate: telemetry + nodes exclude revoked members immediately
  io.emit('wildfire.consent', {
    memberId: member.id,
    callsign: member.callsign,
    grant: grantBool,
    actor: actorStr,
    at: entry.at,
    entry,
  });
  return { ok: true, member, entry };
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

/** Present nodes = consented members ONLY. Revoked members are ABSENT. */
function presentNodes(): (Member & { sim: true })[] {
  return members.filter((m) => m.consent).map((m) => ({ ...m, sim: true }));
}

function meshSnapshot() {
  return {
    fsm: { ...fsm },
    members: members.map((m) => ({ ...m })),
    nodes: presentNodes(),
    journalHead: journalHead(),
    journalCount: journal.length,
    tier: TIER,
  };
}

function statusSnapshot() {
  return {
    service: 'wildfire-mesh',
    port: PORT,
    fsm: { ...fsm },
    members: members.map((m) => ({ ...m })),
    nodesPresent: members.filter((m) => m.consent).length,
    journalHead: journalHead(),
    journalCount: journal.length,
    tier: TIER,
    uptimeSec: Math.floor((Date.now() - BOOT_MS) / 1000),
    startedAt: BOOT_TS,
  };
}

// ─── socket.io ──────────────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[wildfire-mesh] +viewer ${socket.id} (${io.engine.clientsCount} connected)`);
  socket.emit('wildfire.snapshot', meshSnapshot());

  // FSM transition request — same validation path as POST /fsm.
  socket.on('wildfire.fsm.request', (payload: { to?: string; actor?: string; reason?: string }) => {
    const r = applyFsmTransition(payload?.to, payload?.actor, payload?.reason);
    if (!r.ok) {
      socket.emit('wildfire.error', { scope: 'fsm', message: r.code, from: r.from, to: r.to });
    }
  });

  // Consent request — same validation path as POST /consent.
  socket.on('wildfire.consent.request', (payload: { memberId?: string; grant?: boolean; actor?: string; reason?: string }) => {
    const r = applyConsent(payload?.memberId, payload?.grant, payload?.actor, payload?.reason);
    if (!r.ok) {
      socket.emit('wildfire.error', { scope: 'consent', message: r.code, memberId: r.memberId });
    }
  });

  socket.on('disconnect', (why) => {
    console.log(`[wildfire-mesh] -viewer ${socket.id} (${why})`);
  });
});

// ─── HTTP routes (io.engine.use — short-circuits engine.io verify()) ────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

io.engine.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
  const rawUrl = req.url || '/';
  const path = rawUrl.split('?')[0];
  const isEngineIo = /[?&](EIO|transport|sid)=/.test(rawUrl) || path.startsWith('/socket.io');
  if (isEngineIo) {
    next(); // let engine.io handle its handshake / polling / upgrade requests
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET / — tiny honest landing (what this service is)
  if (req.method === 'GET' && path === '/') {
    json(res, 200, {
      status: 'OPERATOR SERVICE — SIMULATED FIELD NODES · T0 LOCAL SOFTWARE CHAIN · NO EXTERNAL ANCHOR',
      gateway: 'io("/?XTransformPort=3006") — engine.io path /',
      ...statusSnapshot(),
    });
    return;
  }

  // GET /status — full roster (with consent booleans) + chain head
  if (req.method === 'GET' && path === '/status') {
    json(res, 200, statusSnapshot());
    return;
  }

  // GET /health
  if (req.method === 'GET' && path === '/health') {
    json(res, 200, { ok: true });
    return;
  }

  // GET /journal?limit=100 — newest-first tail of the chain
  if (req.method === 'GET' && path === '/journal') {
    let limit = JOURNAL_DEFAULT_LIMIT;
    try {
      const raw = Number(new URL(rawUrl, 'http://localhost').searchParams.get('limit') ?? JOURNAL_DEFAULT_LIMIT);
      if (Number.isFinite(raw) && raw > 0) limit = Math.min(Math.floor(raw), JOURNAL_MAX_LIMIT);
    } catch {
      /* keep default */
    }
    json(res, 200, { entries: journal.slice(-limit).reverse(), head: journalHead(), count: journal.length, tier: TIER });
    return;
  }

  // GET /verify — REAL full-chain recompute from genesis
  if (req.method === 'GET' && path === '/verify') {
    const check = verifyChain(journal);
    json(res, 200, {
      valid: check.valid,
      ...(check.reason ? { reason: check.reason } : {}),
      count: journal.length,
      head: journalHead(),
      tier: TIER,
      verifiedAt: new Date().toISOString(),
    });
    return;
  }

  // POST /fsm {to, actor, reason}
  if (req.method === 'POST' && path === '/fsm') {
    readBody(req).then((b) => {
      const r = applyFsmTransition(b.to, b.actor, b.reason);
      if (!r.ok) {
        json(res, r.code === 'UNKNOWN_STATE' ? 400 : 409, { error: r.code, from: r.from, to: r.to });
        return;
      }
      json(res, 200, { ok: true, from: r.from, to: r.to, entry: r.entry });
    });
    return;
  }

  // POST /consent {memberId, grant, actor, reason?}
  if (req.method === 'POST' && path === '/consent') {
    readBody(req).then((b) => {
      const r = applyConsent(b.memberId, b.grant, b.actor, b.reason);
      if (!r.ok) {
        json(res, 404, { error: r.code, memberId: r.memberId });
        return;
      }
      json(res, 200, { ok: true, member: r.member, entry: r.entry });
    });
    return;
  }

  json(res, 404, { error: 'NOT_FOUND', path });
});

// ─── SIMULATED field-node telemetry (HONEST — labelled sim:true) ────────────

function initSims(): void {
  for (const m of members) {
    if (sims.has(m.id)) continue;
    sims.set(m.id, {
      phase: Math.random() * Math.PI * 2,
      windBase: 15 + Math.random() * 30, // 15–45 kph centre
      windAmp: 4 + Math.random() * 9,
      batteryBase: 60 + Math.random() * 40, // 60–100% at boot
    });
  }
}

let lastHeartbeatAt = 0;

function telemetryTick(): void {
  const now = Date.now();
  const t = now / 1000;
  const present = members.filter((m) => m.consent); // CONSENT GATE — absent members are never emitted
  let windSum = 0;
  for (const m of present) {
    const s = sims.get(m.id);
    if (!s) continue;
    // Wind drifts smoothly: base + sin(t/37 + phase) * amplitude, clamped 10–65.
    const wind = clamp(s.windBase + Math.sin(t / 37 + s.phase) * s.windAmp, 10, 65);
    const temp = clamp(28 + Math.sin(t / 53 + s.phase * 1.7) * 8 + (Math.random() - 0.5) * 1.6, 18, 42);
    const battery = clamp(s.batteryBase - ((now - BOOT_MS) / 60_000) * 0.05 + (Math.random() - 0.5) * 1.2, 40, 100);
    windSum += wind;
    io.emit('wildfire.telemetry', {
      memberId: m.id,
      callsign: m.callsign,
      col: m.col,
      row: m.row,
      windKph: round1(wind),
      tempC: round1(temp),
      batteryPct: round1(battery),
      at: new Date(now).toISOString(),
      sim: true, // HONESTY: simulated field node — no real device behind this
    });
  }
  // Journal heartbeat at most once per minute (not every 4s — keep the chain readable).
  if (now - lastHeartbeatAt >= HEARTBEAT_MIN_MS) {
    lastHeartbeatAt = now;
    appendJournal('mesh.heartbeat', {
      presentNodes: present.length,
      windAvg: present.length ? round1(windSum / present.length) : null,
    });
  }
}

// ─── Boot ───────────────────────────────────────────────────────────────────

initSims();
loadJournalAtBoot(); // fresh genesis OR verified restore + replay (io exists → appends broadcast to 0..n viewers)
setInterval(telemetryTick, TELEMETRY_TICK_MS);

httpServer.listen(PORT, () => {
  console.log(
    `[wildfire-mesh] listening on :${PORT} · fsm ${fsm.state} · ${members.filter((m) => m.consent).length}/${members.length} nodes present · journal ${journal.length} entries (head ${journalHead().slice(0, 12)}…) · tier ${TIER}`
  );
  console.log(`[wildfire-mesh] SIMULATED field nodes · T0 LOCAL_SOFTWARE_SHA256_CHAIN · no external anchor · gateway: /?XTransformPort=${PORT}`);
});
