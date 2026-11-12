/// <reference types="bun-types" />

// index.ts — ProofBridge FIELD DEMO · SENSOR MESH rail (port 3007).
//
// The demo, one page: a laptop runs this tiny local server; guests scan a QR
// code with their phones; their phones become sensor nodes (camera, mic, GPS,
// motion, battery); the dashboard shows all of them live. Every reading is
// appended to a SHA-256 hash-chained journal on disk. /verify walks the chain
// from genesis. Nothing leaves the room: ZERO outbound network calls exist in
// this file or in the pages it serves.
//
// Rail boundary (ProofBridge/TEMPLATE_QR_BRIDGE.md §15): this is the
// field-demo sensor mesh — a SEPARATE rail from the QR-bridge pairing rail
// (:3005). This service's QR carries a plain join URL — a reference, never a
// secret (§1 discipline). Endpoints are noindex (§9). Local QR render only (§8).
//
// Honest deviation from the one-page spec: the spec said "One Python file.
// FastAPI + WebSocket." This environment's service contract mandates Bun
// mini-services — same behaviour, same endpoints (/join, dashboard, WS,
// hash-chained journal, /verify), zero npm dependencies at runtime.

import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { ServerWebSocket } from 'bun';
import { Chain, type JournalEvent } from './chain';
import { qrAscii, qrSvg } from './qr';

const PORT = 3007;
const STALE_MS = 5000; // a channel with no fresh reading flips to UNDEFINED — never a guess
const MAX_MSGS_PER_SEC = 30;
const CHANNELS = ['camera', 'mic', 'gps', 'motion', 'battery'] as const;
type Channel = (typeof CHANNELS)[number];
type Ws = ServerWebSocket<{ role: string }>;

const chain = new Chain(new URL('./data/journal.jsonl', import.meta.url).pathname);
// pages are read per-request (tiny files) — page edits go live without a
// service restart, and hot-reload never serves a stale cached shell
const page = (name: string) => readFileSync(new URL(`./public/${name}`, import.meta.url).pathname, 'utf8');
const bootTime = Date.now();

type ChannelState = { state: 'live' | 'undefined'; value: unknown; reason?: string; ts: number };
type NodeState = {
  id: string;
  label: string;
  sim: boolean;
  joinedAt: number;
  lastSeen: number;
  channels: Partial<Record<Channel, ChannelState>>;
};

const nodes = new Map<Ws, NodeState>();
const sockets = new Set<Ws>();
const msgTimes = new Map<Ws, number[]>();
const recent: JournalEvent[] = [];

const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow' };
const HTML_HEADERS = {
  ...NOINDEX,
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self' ws: wss:",
};

function logEvent(input: Omit<JournalEvent, 'seq' | 'ts' | 'prev' | 'hash'>): JournalEvent {
  const evt = chain.append(input);
  recent.push(evt);
  if (recent.length > 14) recent.shift();
  console.log(
    `[journal] #${evt.seq} ${evt.type}${evt.node ? ` · ${evt.node}` : ''}${evt.ch ? `/${evt.ch}` : ''} ${evt.state ?? ''}`
  );
  return evt;
}

function publicState() {
  const now = Date.now();
  return {
    service: 'mesh-demo',
    startedAt: bootTime,
    now,
    staleMs: STALE_MS,
    nodes: [...nodes.values()].map((n) => ({
      id: n.id,
      label: n.label,
      sim: n.sim,
      joinedAt: n.joinedAt,
      lastSeen: n.lastSeen,
      silentMs: now - n.lastSeen,
      channels: Object.fromEntries(
        CHANNELS.map((ch) => {
          const c = n.channels[ch];
          if (!c) return [ch, { state: 'undefined', value: null, reason: 'NO_DATA', ts: 0 }];
          const stale = c.state === 'live' && now - c.ts > STALE_MS;
          return [
            ch,
            stale
              ? {
                  state: 'undefined' as const,
                  value: c.value,
                  reason: `STALE_${Math.round((now - c.ts) / 1000)}S`,
                  ts: c.ts,
                }
              : c,
          ];
        })
      ),
    })),
    chain: chain.snapshot(),
    events: recent.slice(-12).map((e) => ({
      seq: e.seq,
      ts: e.ts,
      type: e.type,
      node: e.node,
      ch: e.ch,
      state: e.state,
      reason: e.reason,
    })),
  };
}

function wsBroadcast() {
  const payload = JSON.stringify({ type: 'state', state: publicState() });
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {
      /* per-socket failure ignored */
    }
  }
}

function sanitizeLabel(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  const clean = s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  return clean.length > 0 ? clean : `GUEST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const server = Bun.serve<{ role: string }>({
  port: PORT,
  fetch(req, srv) {
    const url = new URL(req.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    // gateway alias: the /mesh-demo prefix strips to the same routes
    // (/mesh-demo → /, /mesh-demo/join → /join, /mesh-demo/state → /state, …)
    if (path.startsWith('/mesh-demo')) path = path.slice('/mesh-demo'.length) || '/';

    if (path === '/ws') {
      if (srv.upgrade(req, { data: { role: 'client' } })) return;
      return new Response('WS_UPGRADE_FAILED', { status: 400, headers: NOINDEX });
    }
    if (path === '/') return new Response(page('dashboard.html'), { headers: HTML_HEADERS });
    if (path === '/join') return new Response(page('join.html'), { headers: HTML_HEADERS });
    if (path === '/health') {
      const snap = chain.snapshot();
      return Response.json({ ok: true, nodes: nodes.size, head: snap.head.slice(0, 12), entries: snap.entries }, { headers: NOINDEX });
    }
    if (path === '/state') return Response.json(publicState(), { headers: { ...NOINDEX, 'Cache-Control': 'no-store' } });
    if (path === '/verify') {
      const t0 = Date.now();
      const result = chain.verify();
      console.log(`[verify] ${result.valid ? 'VALID' : 'BROKEN'} in ${Date.now() - t0}ms`);
      return Response.json(result, { headers: NOINDEX });
    }
    if (path === '/journal/tail') {
      const n = Math.min(200, Math.max(1, parseInt(url.searchParams.get('n') ?? '50', 10) || 50));
      return Response.json(chain.tail(n), { headers: NOINDEX });
    }
    if (path === '/qr.svg') {
      const d = url.searchParams.get('d') ?? '';
      if (d.length < 8 || d.length > 512) {
        return new Response('BAD_QR_PAYLOAD', { status: 400, headers: { ...NOINDEX, 'Content-Type': 'text/plain' } });
      }
      try {
        return new Response(qrSvg(d), {
          headers: { ...NOINDEX, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
        });
      } catch (e) {
        return new Response(`QR_ENCODE_FAILED: ${(e as Error).message}`, { status: 422, headers: { ...NOINDEX, 'Content-Type': 'text/plain' } });
      }
    }
    return new Response('NOT_FOUND', { status: 404, headers: { ...NOINDEX, 'Content-Type': 'text/plain' } });
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
    },
    message(ws, message) {
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(String(message));
      } catch {
        return; // malformed frame ignored
      }
      // per-connection rate cap
      const now = Date.now();
      const times = (msgTimes.get(ws) ?? []).filter((t) => now - t < 1000);
      times.push(now);
      msgTimes.set(ws, times);
      if (times.length > MAX_MSGS_PER_SEC) return;

      if (msg.type === 'hello') {
        const node: NodeState = {
          id: typeof msg.id === 'string' ? msg.id.slice(0, 64) : `anon-${Math.random().toString(36).slice(2, 8)}`,
          label: sanitizeLabel(msg.label),
          sim: msg.sim === true,
          joinedAt: now,
          lastSeen: now,
          channels: {},
        };
        nodes.set(ws, node);
        logEvent({ type: 'node.join', node: node.label, value: { id: node.id, sim: node.sim } });
        try {
          ws.send(JSON.stringify({ type: 'hello-ack', id: node.id, label: node.label }));
        } catch {}
        wsBroadcast();
        return;
      }

      const node = nodes.get(ws);
      if (!node) return; // readings before hello are dropped
      node.lastSeen = now;

      if (msg.type === 'reading') {
        const ch = String(msg.ch) as Channel;
        if (!CHANNELS.includes(ch)) return;
        const state = msg.state === 'live' ? 'live' : 'undefined';
        const value = msg.value === undefined ? null : msg.value;
        if (JSON.stringify(value).length > 400) return;
        const reason = typeof msg.reason === 'string' ? msg.reason.slice(0, 48) : undefined;
        node.channels[ch] = { state, value, reason, ts: now };
        logEvent({ type: 'reading', node: node.label, ch, state, value, reason });
        wsBroadcast();
        return;
      }

      if (msg.type === 'unshare') {
        logEvent({ type: 'node.leave', node: node.label, reason: 'STOP_SHARING' });
        nodes.delete(ws);
        try {
          ws.send(JSON.stringify({ type: 'stopped', ok: true }));
        } catch {}
        wsBroadcast();
        return;
      }
    },
    close(ws) {
      sockets.delete(ws);
      msgTimes.delete(ws);
      const node = nodes.get(ws);
      if (node) {
        logEvent({ type: 'node.leave', node: node.label, reason: 'DISCONNECT' });
        nodes.delete(ws);
        wsBroadcast();
      }
    },
  },
});

// 1s tick — the dashboard "subscribes every second"; stale channels re-mark
// UNDEFINED even when nothing new arrives. Never a guess, never a freeze.
setInterval(() => wsBroadcast(), 1000);

// ── startup banner ──────────────────────────────────────────────────────────
const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i): i is NonNullable<typeof i> => i !== undefined && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  PROOFBRIDGE FIELD DEMO · SENSOR MESH — port 3007                   ║');
console.log('║  LOCAL-ONLY RAIL · nothing leaves the room · QR rendered locally     ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`  dashboard : http://localhost:${PORT}/          (also /mesh-demo via gateway)`);
console.log(`  phone page: http://localhost:${PORT}/join      (also /mesh-demo/join)`);
console.log(`  verify    : http://localhost:${PORT}/verify`);
for (const ip of ips.slice(0, 2)) {
  const lan = `http://${ip}:${PORT}/join`;
  console.log(`\n  LAN-DIRECT QR for ${lan}  (room use — same WiFi):\n`);
  console.log(
    qrAscii(lan)
      .split('\n')
      .map((l) => '    ' + l)
      .join('\n')
  );
}
console.log("\n  NOTE: the DASHBOARD's own QR (left panel) is derived from the origin the");
console.log('  dashboard was opened from — use THAT QR when going through the gateway/');
console.log('  preview. This terminal QR is for bare-LAN room demos only.');
console.log(`\n  journal: ${chain.snapshot().entries} entries · head ${chain.snapshot().head.slice(0, 16)}…`);
console.log(`  listening on :${server.port} — waiting for nodes…`);
