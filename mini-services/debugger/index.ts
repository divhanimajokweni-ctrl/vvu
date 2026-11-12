/**
 * VVU Native Debugger — :3098
 * The epistemic microscope for the VVU Runtime.
 *
 * I1 Zero-trust      — chain accepts only collector-emitted events; nothing self-certifies.
 * I2 Immutability    — append-only WORM chain; /verify detects any retro-edit.
 * I3 Reproducibility — /replay is a pure function over the event list.
 * I4 Holistic        — /diff judges whole sessions, never a lone event.
 * I5 Separation      — observe-only. No write path into product runtime.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3098;
const STORE_DIR = join(__dirname, '.sessions');
const DAEMON_URL = process.env.DAEMON_URL ?? '';
const CORS = '*';
const MAX_SESSION_EVENTS = 20_000;
const AMBIENT_ROTATE_AT = 5_000;
const MAX_EVENT_BYTES = 64 * 1024;

mkdirSync(STORE_DIR, { recursive: true });

function canon(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const GENESIS = '0'.repeat(64);
const now = () => new Date().toISOString();

const EVENT_TYPES = new Set(['http', 'console', 'error', 'span', 'metric', 'custom', 'system']);
const LEVELS = new Set(['debug', 'info', 'warn', 'error']);

type EventType = 'http' | 'console' | 'error' | 'span' | 'metric' | 'custom' | 'system';
type EventLevel = 'debug' | 'info' | 'warn' | 'error';

interface ChainEvent {
  seq: number; ts: string; type: EventType; level: EventLevel; source: string; message: string;
  data?: Record<string, unknown>; traceId?: string; spanId?: string; parentSpanId?: string; correlationId?: string;
  prevHash: string; hash: string;
}
type IncomingEvent = Partial<Omit<ChainEvent, 'seq' | 'prevHash' | 'hash'>>;

interface Session {
  id: string; ambient: boolean; status: 'open' | 'closed'; startedAt: string; closedAt?: string;
  head: string; merkleRoot?: string; meta: Record<string, unknown>;
}

const sessions = new Map<string, Session>();
const chains = new Map<string, ChainEvent[]>();
const streamClients = new Set<{ res: ServerResponse; sessionId?: string }>();
let rotating = false;

const fileFor = (id: string) => join(STORE_DIR, `${id.replace(/[^a-zA-Z0-9_.-]/g, '_')}.jsonl`);
const persistLine = (id: string, obj: unknown) => appendFileSync(fileFor(id), JSON.stringify(obj) + '\n');

function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return GENESIS;
  let level = [...hashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(sha256(level[i]! + (level[i + 1] ?? level[i]!)));
    level = next;
  }
  return level[0]!;
}

function loadFromDisk() {
  const files = readdirSync(STORE_DIR).filter((f) => f.endsWith('.jsonl')).sort();
  for (const f of files) {
    const id = f.slice(0, -'.jsonl'.length);
    const lines = readFileSync(join(STORE_DIR, f), 'utf8').split('\n');
    const list: ChainEvent[] = [];
    const session: Session = { id, ambient: id.startsWith('ambient-'), status: 'open', startedAt: now(), head: GENESIS, meta: {} };
    let closed = false;
    for (const line of lines) {
      if (!line) continue;
      let rec: any;
      try { rec = JSON.parse(line); } catch { break; }
      if (rec.__session) { session.startedAt = rec.__session.startedAt ?? session.startedAt; session.meta = rec.__session.meta ?? {}; session.ambient = !!rec.__session.ambient; }
      else if (rec.__closed) { closed = true; session.closedAt = rec.__closed.closedAt; session.merkleRoot = rec.__closed.merkleRoot; }
      else { list.push(rec as ChainEvent); }
    }
    session.status = closed ? 'closed' : 'open';
    session.head = list.length ? list[list.length - 1]!.hash : GENESIS;
    sessions.set(id, session);
    chains.set(id, list);
  }
}

function stripUnsafe(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripUnsafe);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined || typeof val === 'function' || typeof val === 'symbol') continue;
      if (typeof val === 'bigint') { out[k] = val.toString(); continue; }
      out[k] = stripUnsafe(val);
    }
    return out;
  }
  return v;
}

function sanitizeEvent(raw: IncomingEvent): { ok: true; ev: Omit<ChainEvent, 'seq' | 'prevHash' | 'hash'> } | { ok: false; error: string } {
  const type = raw.type as EventType;
  if (!EVENT_TYPES.has(type)) return { ok: false, error: 'invalid-type' };
  const level = (raw.level ?? 'info') as EventLevel;
  if (!LEVELS.has(level)) return { ok: false, error: 'invalid-level' };
  const ev: Omit<ChainEvent, 'seq' | 'prevHash' | 'hash'> = {
    ts: typeof raw.ts === 'string' && raw.ts.length <= 40 ? raw.ts : now(),
    type, level, source: String(raw.source ?? 'unknown').slice(0, 120), message: String(raw.message ?? '').slice(0, 2000),
  };
  if (raw.data !== undefined) {
    if (typeof raw.data !== 'object' || raw.data === null || Array.isArray(raw.data)) return { ok: false, error: 'invalid-data' };
    const clean = stripUnsafe(raw.data) as Record<string, unknown>;
    try { if (canon(clean).length > MAX_EVENT_BYTES) return { ok: false, error: 'data-too-large' }; } catch { return { ok: false, error: 'invalid-data' }; }
    ev.data = clean;
  }
  for (const k of ['traceId', 'spanId', 'parentSpanId', 'correlationId'] as const) {
    const v = raw[k];
    if (typeof v === 'string' && v) ev[k] = v.slice(0, 80);
  }
  return { ok: true, ev };
}

function appendEvent(session: Session, raw: IncomingEvent): { ok: true; event: ChainEvent } | { ok: false; error: string } {
  if (session.status === 'closed') return { ok: false, error: 'session-closed' };
  const list = chains.get(session.id)!;
  if (!session.ambient && list.length >= MAX_SESSION_EVENTS) return { ok: false, error: 'session-full' };
  const s = sanitizeEvent(raw);
  if (!s.ok) return s;
  const core: Record<string, unknown> = { seq: list.length + 1, ts: s.ev.ts, type: s.ev.type, level: s.ev.level, source: s.ev.source, message: s.ev.message };
  if (s.ev.data) core.data = s.ev.data;
  if (s.ev.traceId) core.traceId = s.ev.traceId;
  if (s.ev.spanId) core.spanId = s.ev.spanId;
  if (s.ev.parentSpanId) core.parentSpanId = s.ev.parentSpanId;
  if (s.ev.correlationId) core.correlationId = s.ev.correlationId;
  const prevHash = session.head;
  const hash = sha256(prevHash + '\n' + canon(core));
  const event = { ...core, prevHash, hash } as ChainEvent;
  list.push(event);
  session.head = hash;
  persistLine(session.id, event);
  broadcast(session, event);
  if (session.ambient && !rotating && list.length >= AMBIENT_ROTATE_AT) { rotating = true; try { rotateAmbient('size'); } finally { rotating = false; } }
  return { ok: true, event };
}

function startSession(meta: Record<string, unknown>): Session {
  const id = `s-${now().replace(/[:.]/g, '')}-${randomUUID().slice(0, 8)}`;
  const session: Session = { id, ambient: false, status: 'open', startedAt: now(), head: GENESIS, meta };
  sessions.set(id, session); chains.set(id, []);
  persistLine(id, { __session: { id, startedAt: session.startedAt, meta, ambient: false } });
  return session;
}

function ambientIndex(): number {
  let max = 0;
  for (const id of sessions.keys()) { const m = /^ambient-(\d+)$/.exec(id); if (m) max = Math.max(max, Number(m[1])); }
  return max;
}

function openAmbient(n?: number): Session {
  const id = `ambient-${n ?? ambientIndex() + 1}`;
  const session: Session = { id, ambient: true, status: 'open', startedAt: now(), head: GENESIS, meta: { label: 'ambient evidence (errors & system signals)' } };
  sessions.set(id, session); chains.set(id, []);
  persistLine(id, { __session: { id, startedAt: session.startedAt, meta: session.meta, ambient: true } });
  return session;
}

function currentAmbient(): Session {
  const s = sessions.get(`ambient-${ambientIndex()}`);
  if (s && s.status === 'open') return s;
  return openAmbient();
}

function rotateAmbient(reason: string) {
  const cur = sessions.get(`ambient-${ambientIndex()}`);
  if (cur && cur.status === 'open') closeSession(cur.id, `ambient-rotate:${reason}`, true);
  openAmbient();
}

function closeSession(id: string, reason = 'manual', silent = false):
  { ok: true; merkleRoot: string; eventCount: number } | { ok: false; error: string } {
  const session = sessions.get(id);
  if (!session) return { ok: false, error: 'not-found' };
  if (session.status === 'closed') return { ok: false, error: 'already-closed' };
  appendEvent(session, { type: 'system', level: 'info', source: 'debugger', message: `session closed (${reason})` });
  session.status = 'closed';
  session.closedAt = now();
  const list = chains.get(id)!;
  session.merkleRoot = merkleRoot(list.map((e) => e.hash));
  persistLine(id, { __closed: { closedAt: session.closedAt, merkleRoot: session.merkleRoot, eventCount: list.length, reason } });
  if (!silent) void notifyDaemon({ kind: 'debugger.session.closed', sessionId: id, merkleRoot: session.merkleRoot, eventCount: list.length, reason });
  return { ok: true, merkleRoot: session.merkleRoot, eventCount: list.length };
}

function verifyChain(id: string) {
  const list = chains.get(id) ?? [];
  let prev = GENESIS;
  for (const e of list) {
    const { prevHash: _p, hash: _h, ...core } = e;
    const expected = sha256(prev + '\n' + canon(core));
    if (e.prevHash !== prev || e.hash !== expected) {
      return { sessionId: id, ok: false, checked: e.seq - 1, firstBroken: { seq: e.seq, expectedPrevHash: prev, actualPrevHash: e.prevHash, expectedHash: expected, actualHash: e.hash } };
    }
    prev = e.hash;
  }
  return { sessionId: id, ok: true, checked: list.length, merkleRoot: merkleRoot(list.map((e) => e.hash)) };
}

function percentile(xs: number[], p: number): number | undefined {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return Math.round(s[i]! * 100) / 100;
}

function replay(id: string) {
  const list = chains.get(id) ?? [];
  const session = sessions.get(id);
  const levelCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const http: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  const durationsBySource = new Map<string, number[]>();
  const spanBegins = new Map<string, ChainEvent>();
  const spanEnds = new Map<string, ChainEvent>();

  for (const e of list) {
    levelCounts[e.level] = (levelCounts[e.level] ?? 0) + 1;
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
    if (e.type === 'http') {
      http.push({ seq: e.seq, ts: e.ts, source: e.source, method: e.data?.method, path: e.data?.path, status: e.data?.status, durationMs: e.data?.durationMs });
      const d = e.data?.durationMs;
      if (typeof d === 'number') { const arr = durationsBySource.get(e.source) ?? []; arr.push(d); durationsBySource.set(e.source, arr); }
    }
    if (e.level === 'error' || e.type === 'error') errors.push({ seq: e.seq, ts: e.ts, source: e.source, message: e.message });
    if (e.type === 'span' && e.spanId) { if (e.data?.phase === 'end') spanEnds.set(e.spanId, e); else spanBegins.set(e.spanId, e); }
  }

  const spans = [...spanBegins.entries()].map(([sid, b]) => {
    const end = spanEnds.get(sid);
    return { spanId: sid, name: (b.data?.name as string) ?? b.message, source: b.source, beginSeq: b.seq, endSeq: end?.seq, durationMs: (end?.data?.durationMs as number | undefined) ?? (end ? Math.max(0, Date.parse(end.ts) - Date.parse(b.ts)) : undefined), closed: !!end };
  });

  return {
    sessionId: id,
    session: session && { status: session.status, startedAt: session.startedAt, closedAt: session.closedAt, merkleRoot: session.merkleRoot, meta: session.meta },
    eventCount: list.length, levelCounts, typeCounts, httpCount: http.length, errorCount: errors.length,
    http: http.slice(-200), errors: errors.slice(-100), spans: spans.slice(-100),
    orphanEndSpans: [...spanEnds.keys()].filter((sid) => !spanBegins.has(sid)).length,
    httpBySource: [...durationsBySource.entries()].map(([source, ds]) => ({ source, count: ds.length, p50: percentile(ds, 50), p95: percentile(ds, 95), max: Math.round(Math.max(...ds) * 100) / 100 })),
    chainHead: list.length ? list[list.length - 1]!.hash : GENESIS,
  };
}

function normalizeMessage(m: string): string {
  return m.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>').replace(/\b[0-9a-f]{16,}\b/gi, '<hash>').replace(/-?\d+(?:\.\d+)?/g, '<n>').slice(0, 140);
}
const signatureOf = (e: ChainEvent) => `${e.type}/${e.source}/${normalizeMessage(e.message)}`;

interface SigStat { count: number; firstSeq: number; durations: number[]; errored: boolean }

function signatures(list: ChainEvent[]): Map<string, SigStat> {
  const m = new Map<string, SigStat>();
  for (const e of list) {
    const sig = signatureOf(e);
    let st = m.get(sig);
    if (!st) { st = { count: 0, firstSeq: e.seq, durations: [], errored: false }; m.set(sig, st); }
    st.count++;
    if (e.level === 'error') st.errored = true;
    const d = e.data?.durationMs;
    if (typeof d === 'number') st.durations.push(d);
  }
  return m;
}

function diffSessions(aId: string, bId: string) {
  const A = signatures(chains.get(aId) ?? []);
  const B = signatures(chains.get(bId) ?? []);
  const onlyInA: Array<{ signature: string; count: number; firstSeq: number; error: boolean }> = [];
  const onlyInB: Array<{ signature: string; count: number; firstSeq: number; error: boolean }> = [];
  const drift: Array<{ signature: string; countA: number; countB: number; countDelta: number; p50A?: number; p50B?: number; durationRatio?: number }> = [];

  for (const [sig, st] of A) {
    if (!B.has(sig)) { onlyInA.push({ signature: sig, count: st.count, firstSeq: st.firstSeq, error: st.errored }); continue; }
    const stB = B.get(sig)!;
    const pA = percentile(st.durations, 50), pB = percentile(stB.durations, 50);
    const ratio = pA !== undefined && pB !== undefined && pB > 0 ? pA / pB : undefined;
    if (st.count !== stB.count || (ratio !== undefined && (ratio > 1.5 || ratio < 1 / 1.5))) {
      drift.push({ signature: sig, countA: st.count, countB: stB.count, countDelta: st.count - stB.count, p50A: pA, p50B: pB, durationRatio: ratio ? Math.round(ratio * 100) / 100 : undefined });
    }
  }
  for (const [sig, st] of B) if (!A.has(sig)) onlyInB.push({ signature: sig, count: st.count, firstSeq: st.firstSeq, error: st.errored });

  onlyInA.sort((x, y) => x.firstSeq - y.firstSeq);
  onlyInB.sort((x, y) => x.firstSeq - y.firstSeq);
  drift.sort((x, y) => Math.abs(y.countDelta) - Math.abs(x.countDelta));

  return {
    a: aId, b: bId,
    summary: { signaturesA: A.size, signaturesB: B.size, onlyInA: onlyInA.length, onlyInB: onlyInB.length, drift: drift.length },
    earliestDivergence: onlyInA[0] && { signature: onlyInA[0].signature, firstSeq: onlyInA[0].firstSeq, interpretation: 'earliest event present in A (investigated) but absent from B (baseline) — least-divergent suspect' },
    onlyInA: onlyInA.slice(0, 50), onlyInB: onlyInB.slice(0, 50), drift: drift.slice(0, 50),
  };
}

async function notifyDaemon(payload: Record<string, unknown>) {
  if (!DAEMON_URL) return;
  try { await fetch(DAEMON_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(2000) }); } catch {}
}

function broadcast(session: Session, event: ChainEvent) {
  if (streamClients.size === 0) return;
  const frame = `event: evidence\ndata: ${JSON.stringify({ sessionId: session.id, event })}\n\n`;
  for (const c of [...streamClients]) {
    if (c.sessionId && c.sessionId !== session.id) continue;
    try { c.res.write(frame); } catch { streamClients.delete(c); }
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': CORS, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > 2 * 1024 * 1024) { reject(new Error('body-too-large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { if (chunks.length === 0) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid-json')); } });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'debugger', port: PORT, sessions: sessions.size, openSessions: [...sessions.values()].filter((s) => s.status === 'open').length, uptimeSec: Math.round(process.uptime()) });
    if (req.method === 'GET' && url.pathname === '/sessions') return json(res, 200, { ok: true, sessions: [...sessions.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).map((s) => ({ id: s.id, ambient: s.ambient, status: s.status, startedAt: s.startedAt, closedAt: s.closedAt, eventCount: chains.get(s.id)?.length ?? 0, merkleRoot: s.merkleRoot, head: s.head, meta: s.meta })) });
    if (req.method === 'POST' && url.pathname === '/session/start') { const body = await readBody(req); const meta = (body.meta && typeof body.meta === 'object' ? body.meta : body) as Record<string, unknown>; const session = startSession(meta); appendEvent(session, { type: 'system', source: 'debugger', message: 'session opened', data: { meta: session.meta } }); return json(res, 201, { ok: true, sessionId: session.id, genesis: GENESIS, head: session.head }); }
    if (req.method === 'POST' && url.pathname === '/ambient/events') { const body = await readBody(req); const ambient = currentAmbient(); const incoming = (Array.isArray(body.events) ? body.events : [body.event]).filter(Boolean) as IncomingEvent[]; let appended = 0; const rejected: string[] = []; for (const ev of incoming) { const r = appendEvent(ambient, ev); r.ok ? appended++ : rejected.push(r.error); } return json(res, 200, { ok: true, sessionId: ambient.id, appended, rejected }); }
    if (parts[0] === 'session' && parts[1]) {
      const id = decodeURIComponent(parts[1]); const session = sessions.get(id);
      if (!session) return json(res, 404, { ok: false, error: 'not-found' });
      if (parts.length === 3 && parts[2] === 'event' && req.method === 'POST') { const r = appendEvent(session, (await readBody(req)) as IncomingEvent); return r.ok ? json(res, 201, { ok: true, event: r.event }) : json(res, 400, { ok: false, error: r.error }); }
      if (parts.length === 3 && parts[2] === 'events' && req.method === 'POST') { const body = await readBody(req); const incoming = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : []; if (incoming.length > 500) return json(res, 413, { ok: false, error: 'batch-too-large' }); let appended = 0; const rejected: string[] = []; for (const ev of incoming) { const r = appendEvent(session, ev); r.ok ? appended++ : rejected.push(r.error); } return json(res, 200, { ok: true, sessionId: id, appended, rejected, head: session.head }); }
      if (parts.length === 3 && parts[2] === 'close' && req.method === 'POST') { const body = await readBody(req); const r = closeSession(id, typeof body.reason === 'string' ? body.reason : 'manual'); return r.ok ? json(res, 200, r) : json(res, 400, r); }
      if (parts.length === 2 && req.method === 'GET') { const afterSeq = Number(url.searchParams.get('afterSeq') ?? 0) || 0; const all = chains.get(id) ?? []; const list = all.filter((e) => e.seq > afterSeq).slice(-500); return json(res, 200, { ok: true, session: { ...session }, events: list, head: session.head, totalCount: all.length }); }
      if (parts.length === 3 && parts[2] === 'verify' && req.method === 'GET') return json(res, 200, verifyChain(id));
      if (parts.length === 3 && parts[2] === 'replay' && req.method === 'GET') return json(res, 200, { ok: true, replay: replay(id) });
    }
    if (req.method === 'POST' && url.pathname === '/diff') { const body = await readBody(req); const a = typeof body.a === 'string' ? body.a : ''; const b = typeof body.b === 'string' ? body.b : ''; if (!a || !b) return json(res, 400, { ok: false, error: 'a-and-b-required' }); if (!sessions.has(a) || !sessions.has(b)) return json(res, 404, { ok: false, error: 'not-found' }); return json(res, 200, { ok: true, diff: diffSessions(a, b) }); }
    if (req.method === 'GET' && url.pathname === '/stream') {
      const sessionId = url.searchParams.get('sessionId') ?? undefined;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'access-control-allow-origin': CORS });
      res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, sessionId: sessionId ?? '*' })}\n\n`);
      const client = { res, sessionId }; streamClients.add(client);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 15_000);
      req.on('close', () => { clearInterval(ping); streamClients.delete(client); });
      return;
    }
    return json(res, 404, { ok: false, error: 'no-route' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === 'body-too-large' || msg === 'invalid-json' ? 400 : 500;
    return json(res, status, { ok: false, error: msg === 'body-too-large' || msg === 'invalid-json' ? msg : 'internal' });
  }
});

process.on('unhandledRejection', (r) => console.error('[debugger] unhandledRejection:', r));
loadFromDisk();
if (ambientIndex() === 0) openAmbient(1); else currentAmbient();
server.listen(PORT, () => { console.log(`[debugger] listening on :${PORT}  (store: ${STORE_DIR})`); console.log(`[debugger] contract: observe-only · WORM chain · pure replay · holistic diff`); });
