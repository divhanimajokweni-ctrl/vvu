// mini-services/telemetry-service/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// VVU · Gqeberha edge-node simulator (Task 3)
//
// A standalone Bun + TypeScript mini-service on port 3003 that simulates:
//   · the physical FSM of the edge node (Appendix B.3 — enforced exactly),
//   · hydraulic / thermal telemetry physics (Joukowsky celerity invariant),
//   · the MRR / Trust-Gate 3A-3B-3C business simulation,
//   · an in-memory WORM hash chain (sha256-linked, GENESIS 2026-09-01),
// and broadcasts everything to the Next.js dashboard over socket.io
// (path MUST be '/' — the Caddy gateway forwards /?XTransformPort=3003 here),
// while persisting WORM events / telemetry / FSM audits to the Next.js API.
//
// NOTE on HTTP routing: with engine path '/', engine.io intercepts every URL
// that starts with '/', therefore /state and /healthz are served through an
// engine.io middleware (io.engine.use) which short-circuits before the
// engine.io verify() step. Verified working with socket.io 4.8.3 / engine.io
// 6.6.9. Legit engine.io requests (query carries EIO/transport/sid) are passed
// through via next().
//
// All shared types are RE-DECLARED here (independent project, no imports from
// the main app — mirrors src/types/vvu.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { Server, type Socket } from 'socket.io';

// ─── Constants ──────────────────────────────────────────────────────────────

const PORT = 3003; // hardcoded — the gateway and the gates API depend on it
const NEXT_BASE = 'http://127.0.0.1:3000'; // Next.js dev server (server-to-server)
const TENANT = 'e1002324-0000-0000-0000-000000000001';
const TICK_MS = 1500;
const MONTH_TICKS = 40; // fixed month length (rollover cadence)
const MRR_TARGET = 50000;
const WORM_CHAIN_CAP = 500; // in-memory chain tail cap (snapshot sends last 30)
const WORM_QUEUE_CAP = 200; // outbound persistence queue cap
const WORM_FLUSH_MAX = 3; // max POSTs per 5s flush
const WORM_MAX_ATTEMPTS = 3; // drop a persisted event after 3 failed POSTs
const HISTORY_CAP = 120;
const FSM_LOG_CAP = 50; // in-memory cap (snapshot sends last 20)

/** Genesis prevHash for the sim-side WORM chain (Appendix: 2026-09-01 boot). */
const GENESIS_PREV = 'GENESIS-20260901-0000000000000000000000000000000000';

// ─── Types (self-contained — mirror of src/types/vvu.ts) ────────────────────

type FsmState =
  | 'DISCONNECTED'
  | 'PAIRING_BLE'
  | 'TOTP_VERIFICATION'
  | 'STEADY_STATE_LOCKED'
  | 'LEAK_ACTIVE'
  | 'THERMAL_THROTTLE'
  | 'FAIL_CLOSED';

type FsmSymbol = 'INIT' | 'CHAL' | 'TOTP_OK' | 'CLICK' | 'CLEAR' | 'WARN' | 'CRIT' | 'RESET';

const FSM_SYMBOLS: readonly string[] = ['INIT', 'CHAL', 'TOTP_OK', 'CLICK', 'CLEAR', 'WARN', 'CRIT', 'RESET'];

interface NodeTelemetry {
  nodeId: string;
  name: string;
  role: string;
  xMm: number;
  yMm: number;
  zMm: number;
  flowRate: number; // L/s
  pressureHead: number; // m
  acousticAbnormal: boolean;
  apuTemperature: number; // °C
}

interface LeakState {
  active: boolean;
  nodeId: string | null;
  intensity: number; // 0..1
}

interface SimMetrics {
  customers: number;
  mrr: number;
  mrrTarget: number;
  consecutiveMonthsAt50k: number;
  nodesSteady: number;
  steadyStateHours: number;
  /** Task 7-a — demo narrative hold: accrual clamps at 71.9h until SIM SKIP 3C. */
  steadyFrozen: boolean;
  simMonth: number;
  simDay: number;
  speedMultiplier: number;
  pipeline: { emails: number; demos: number; pilots: number };
}

interface TelemetryFrame {
  ts: number;
  fsmState: FsmState;
  nodes: NodeTelemetry[];
  leak: LeakState;
  metrics: SimMetrics;
  thermalThrottled: boolean;
  estimatedCelerity: number;
  invariantOk: boolean;
}

interface HistoryBuffer {
  ts: number[];
  flow: number[]; // inlet L/s
  pressure: number[]; // m
  temp: number[]; // °C
  mrr: number[]; // Rand
}

interface WormSimEvent {
  seq: number;
  ts: number;
  source: string;
  event: string;
  details: string;
  hash: string;
  prevHash: string;
}

interface FsmLogEntry {
  ts: number;
  from: FsmState;
  to: FsmState;
  symbol: FsmSymbol;
  reason: string;
}

interface GateProgress {
  id: '3A' | '3B' | '3C';
  conditionsMet: boolean;
  progress: Array<{ label: string; current: number; target: number; unit: string }>;
}

// Round 19 — 6G NeXt HOLOCOM cross-layer metrics frame (§IV-B2, mirrors
// src/types/vvu.ts). Broadcast every 2nd tick (3s) on the 'holo' event.
interface HoloFrame {
  ts: number;
  tick: number;
  app: {
    meshPolysM: number;
    textureResK: number;
    meshBitrateGbps: number;
    audioBitrateKbps: number;
    virtualCameras: number;
    renderFps: number;
    avgDecodeMs: number;
  };
  computing: {
    clientCpu: number;
    clientGpu: number;
    edgeCpu: number;
    edgeGpu: number;
    edgeMem: number;
    centralGpu: number;
  };
  network: {
    uplinkMs: number;
    downlinkMs: number;
    uplinkGbps: number;
    downlinkGbps: number;
    jitterMs: number;
    lossPct: number;
    stallMs: number;
  };
  mtpTotalMs: number;
  mtpBreach: boolean;
  stressLevel: number;
}

// Fixed part of the MTP chain (mirrors src/lib/holocom.ts MTP_SEGMENTS).
const HOLO_MTP_FIXED_MS = 1.2 + 3.0 + 2.0 + 3.5 + 1.8 + 2.2 + 1.0; // 14.7
const HOLO_MTP_TARGET_MS = 20; // 6G target (paper §III: "extremely low delay")

interface SimSnapshot {
  frame: TelemetryFrame;
  history: HistoryBuffer;
  wormChain: WormSimEvent[]; // last 30
  fsmLog: FsmLogEntry[]; // last 20
  gateProgress: GateProgress[];
}

// Typed socket contract (server → client / client → server).
interface ServerToClientEvents {
  snapshot: (snap: SimSnapshot) => void;
  telemetry: (frame: TelemetryFrame) => void;
  history: (history: HistoryBuffer) => void;
  worm: (event: WormSimEvent) => void;
  fsm: (entry: FsmLogEntry) => void;
  'fsm-error': (err: { message: string }) => void;
  holo: (frame: HoloFrame) => void;
}

interface ClientToServerEvents {
  cmd: (payload: { type: string }) => void;
  'sim-speed': (payload: { multiplier: number }) => void;
  'worm-log': (payload: { event: string; source: string; details: string }) => void;
  'request-snapshot': () => void;
  'sim-skip': (payload: { gate: string }) => void;
  'holo-stress': (payload: { level: number }) => void;
}

// ─── The 12 physical nodes (Appendix C.2 — ENU mm) ──────────────────────────

interface NodeDef {
  nodeId: string;
  name: string;
  role: string;
  xMm: number;
  yMm: number;
  zMm: number;
}

const NODE_DEFS: NodeDef[] = [
  { nodeId: 'N01', name: 'Telemetry Mast', role: 'Antenna mast & edge-cloud telemetry', xMm: 0, yMm: 0, zMm: 1290 },
  { nodeId: 'N02', name: 'Inlet Meter Pod', role: 'Primary inlet flow sensor', xMm: -750, yMm: -160, zMm: 930 },
  { nodeId: 'N03', name: 'Outlet Meter Pod', role: 'Primary outlet flow sensor', xMm: 750, yMm: 160, zMm: 930 },
  { nodeId: 'N04', name: 'Pressure Pipe DN300', role: 'Central structural pressure-retaining spool', xMm: 0, yMm: 0, zMm: 750 },
  { nodeId: 'N05', name: 'Edge Control Cabinet', role: 'Sealed edge node; Bayesian inference', xMm: 0, yMm: 400, zMm: 400 },
  { nodeId: 'N06', name: 'Power Backup Module', role: '8S4P LiFePO₄ battery pack (HBK)', xMm: 0, yMm: -400, zMm: 400 },
  { nodeId: 'N07', name: 'Left Service Rack', role: 'Cable management & lateral mounting', xMm: -720, yMm: -240, zMm: 290 },
  { nodeId: 'N08', name: 'Right Service Rack', role: 'Cable management & lateral mounting', xMm: 720, yMm: 240, zMm: 290 },
  { nodeId: 'N09', name: 'North Datum Skid', role: 'Heavy base support chassis', xMm: 0, yMm: 560, zMm: 40 },
  { nodeId: 'N10', name: 'South Datum Skid', role: 'Heavy base support chassis', xMm: 0, yMm: -560, zMm: 40 },
  { nodeId: 'N11', name: 'Top Height Beacon', role: 'Visual vertical reference', xMm: 100, yMm: 0, zMm: 1465 },
  { nodeId: 'N12', name: 'Pipe Spool DN100', role: 'SANS 1299 service lateral', xMm: -375, yMm: -80, zMm: 840 },
];

/** Wetted hydraulic path — these nodes carry the shared pressure head & acoustic flag. */
const HYDRAULIC_NODES = new Set(['N02', 'N03', 'N04', 'N12']);
/** Leak nodes cycle in this order (each CLICK picks the next). */
const LEAK_CYCLE: readonly string[] = ['N04', 'N12', 'N02'];

// ─── FSM transition table (Appendix B.3 — enforced EXACTLY) ─────────────────

interface FsmEdge {
  to: FsmState;
  reason: string;
}

const FSM_TABLE: Record<FsmState, Partial<Record<FsmSymbol, FsmEdge>>> = {
  DISCONNECTED: {
    INIT: { to: 'PAIRING_BLE', reason: 'Establish BLE-SC via ECDH; init watchdog timer' },
  },
  PAIRING_BLE: {
    CHAL: { to: 'TOTP_VERIFICATION', reason: 'Request challenge signature; display random photo grid' },
  },
  TOTP_VERIFICATION: {
    TOTP_OK: { to: 'STEADY_STATE_LOCKED', reason: 'Grant access; load config; centre canvas at Gqeberha' },
    CRIT: { to: 'DISCONNECTED', reason: 'Purge ephemeral keys; reset hardware; log auth failure' },
  },
  STEADY_STATE_LOCKED: {
    CLICK: { to: 'LEAK_ACTIVE', reason: 'Fire raycaster; set pipe crimson; project 20m soil moisture overlay' },
    WARN: { to: 'THERMAL_THROTTLE', reason: 'Log thermal fact to WORM; reduce APU clock' },
  },
  LEAK_ACTIVE: {
    CLEAR: { to: 'STEADY_STATE_LOCKED', reason: 'Restore pipe colours; slow tank replenishment' },
    WARN: { to: 'THERMAL_THROTTLE', reason: 'Log thermal fact to WORM; reduce APU clock; decimate mesh 62.5%' },
    RESET: { to: 'STEADY_STATE_LOCKED', reason: 'Authorised human-in-the-loop audit recovery' },
  },
  THERMAL_THROTTLE: {
    RESET: { to: 'STEADY_STATE_LOCKED', reason: 'De-escalate throttling after temp < 60°C (5°C hysteresis)' },
    CRIT: { to: 'FAIL_CLOSED', reason: 'Flush RAM evidence to NVMe; battery disconnect within 500ms' },
  },
  FAIL_CLOSED: {
    RESET: { to: 'STEADY_STATE_LOCKED', reason: 'SHA-256 hash checks across 19 master assets; re-open circuit breakers' },
  },
};

// ─── Small helpers ──────────────────────────────────────────────────────────

const round = (v: number, dp = 2): number => Math.round(v * 10 ** dp) / 10 ** dp;

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** POST JSON, never throws — resolves {ok, status}. */
async function postJson(url: string, body: unknown, timeoutMs = 4000): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // drain the body so the socket is released
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore */
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Sim state ──────────────────────────────────────────────────────────────

const sim = {
  // FSM — boot state: STEADY_STATE_LOCKED (nodes pre-provisioned)
  fsmState: 'STEADY_STATE_LOCKED' as FsmState,
  fsmLog: [] as FsmLogEntry[],

  // leak physics
  leak: { active: false, nodeId: null as string | null, intensity: 0 },
  leakClearing: false, // post-CLEAR ease-out phase
  leakCycleIdx: 0,

  // hydraulic physics (per tick)
  inletFlow: 42.5,
  outletFlow: 42.5,
  pressureHead: 58,
  acoustic: false,

  // APU thermal — persistent cabinet (N05) temperature
  apuTemp: 51,

  // celerity invariant latch
  celerity: 688,
  invariantOk: true,
  invariantHoldTick: -1, // tick after which a recovered invariant may flip back to true

  // business sim
  tick: 0,
  ticksIntoMonth: 0,
  metrics: {
    customers: 1, // R5k pilot — invoice already verified (boot WORM GATE_3A_EVIDENCE)
    mrr: 5000,
    mrrTarget: MRR_TARGET,
    consecutiveMonthsAt50k: 0,
    nodesSteady: 3,
    steadyStateHours: 66.2,
    steadyFrozen: false,
    simMonth: 1,
    simDay: 0,
    speedMultiplier: 1,
    pipeline: { emails: 0, demos: 0, pilots: 0 },
  } as SimMetrics,

  // rolling history (cap 120)
  history: { ts: [] as number[], flow: [] as number[], pressure: [] as number[], temp: [] as number[], mrr: [] as number[] },

  // latest broadcast frame (built at boot, rebuilt every tick)
  frame: null as TelemetryFrame | null,
};

// ─── WORM hash chain ────────────────────────────────────────────────────────

const wormChain: WormSimEvent[] = [];
let wormSeq = 1;

interface WormQueueItem {
  source: string;
  event: string;
  details: string;
  attempts: number;
}
const wormQueue: WormQueueItem[] = [];

/**
 * Append a WORM event to the in-memory chain:
 *   hash = sha256(`${prevHash}|${seq}|${source}|${event}|${details}|${tsISO}`)
 * Broadcasts 'worm' to all clients and queues the event for Next.js persistence.
 */
function appendWorm(source: string, event: string, details: string): WormSimEvent {
  const seq = wormSeq++;
  const ts = Date.now();
  const tsISO = new Date(ts).toISOString();
  const prevHash = wormChain.length > 0 ? wormChain[wormChain.length - 1].hash : GENESIS_PREV;
  const hash = sha256(`${prevHash}|${seq}|${source}|${event}|${details}|${tsISO}`);
  const evt: WormSimEvent = { seq, ts, source, event, details, hash, prevHash };
  wormChain.push(evt);
  if (wormChain.length > WORM_CHAIN_CAP) wormChain.splice(0, wormChain.length - WORM_CHAIN_CAP);
  io.emit('worm', evt);
  // queue for the Next.js /api/vvu/ledger flush (5s cadence)
  wormQueue.push({ source, event, details, attempts: 0 });
  if (wormQueue.length > WORM_QUEUE_CAP) wormQueue.splice(0, wormQueue.length - WORM_QUEUE_CAP);
  return evt;
}

let wormFlushing = false;

/** Flush the outbound WORM queue: one POST per event, oldest first, max 3 per flush. */
async function flushWormQueue(): Promise<void> {
  if (wormFlushing || wormQueue.length === 0) return;
  wormFlushing = true;
  try {
    let posts = 0;
    while (posts < WORM_FLUSH_MAX && wormQueue.length > 0) {
      const head = wormQueue[0];
      posts++;
      const r = await postJson(`${NEXT_BASE}/api/vvu/ledger`, {
        source: head.source,
        event: head.event,
        details: head.details,
      });
      if (r.ok) {
        wormQueue.shift();
      } else {
        head.attempts++;
        if (head.attempts >= WORM_MAX_ATTEMPTS) {
          console.log(`[VVU] WORM persist dropped after ${WORM_MAX_ATTEMPTS} attempts · ${head.event}`);
          wormQueue.shift();
        }
        break; // API unreachable — retry the head on the next flush
      }
    }
  } finally {
    wormFlushing = false;
  }
}

// ─── FSM engine ─────────────────────────────────────────────────────────────

/** Best-effort audit-log persistence to the Next.js API (fire and forget). */
function postAudit(from: FsmState, to: FsmState, symbol: FsmSymbol, reason: string): void {
  void postJson(`${NEXT_BASE}/api/vvu/audit`, {
    actor: 'EDGE-FSM',
    action: 'FSM_TRANSITION',
    fromState: from,
    toState: to,
    symbol,
    reason,
  });
}

function startLeak(): void {
  const nodeId = LEAK_CYCLE[sim.leakCycleIdx % LEAK_CYCLE.length];
  sim.leakCycleIdx++;
  sim.leak = { active: true, nodeId, intensity: 0 };
  sim.leakClearing = false;
  console.log(`[SIM] leak started at ${nodeId} (leak #${sim.leakCycleIdx})`);
}

function hardClearLeak(reason: string): void {
  if (sim.leak.active) console.log(`[SIM] leak cleared at ${sim.leak.nodeId} · ${reason}`);
  sim.leak = { active: false, nodeId: null, intensity: 0 };
  sim.leakClearing = false;
}

/**
 * Execute a transition (table-legal or guard-forced): mutate state, run
 * transition side-effects, append to the FSM log, WORM-bind the transition,
 * broadcast 'fsm' and persist the audit entry.
 */
function doTransition(from: FsmState, to: FsmState, symbol: FsmSymbol, reason: string): void {
  sim.fsmState = to;

  // ── transition side-effects ──
  if (to === 'LEAK_ACTIVE') {
    startLeak();
  } else if (to === 'FAIL_CLOSED') {
    // battery disconnect + circuit breakers open → the physical leak is cut off
    hardClearLeak('FAIL_CLOSED safety cutoff (battery disconnect within 500ms)');
  }
  if (from === 'LEAK_ACTIVE' && (symbol === 'CLEAR' || symbol === 'RESET')) {
    // CLEAR → ease out over ~10 ticks; RESET → human-in-the-loop recovery
    sim.leakClearing = true;
  }

  const entry: FsmLogEntry = { ts: Date.now(), from, to, symbol, reason };
  sim.fsmLog.push(entry);
  if (sim.fsmLog.length > FSM_LOG_CAP) sim.fsmLog.splice(0, sim.fsmLog.length - FSM_LOG_CAP);

  appendWorm('FSM', `FSM_${symbol}_${to}`, reason);
  io.emit('fsm', entry);
  postAudit(from, to, symbol, reason);
  console.log(`[FSM] ${from} --${symbol}--> ${to} · ${reason}`);
}

/** Run a client 'cmd' symbol — legal: transition; illegal: fsm-error to that socket. */
function handleCommand(socket: Socket<ClientToServerEvents, ServerToClientEvents>, symbolRaw: unknown): void {
  const symbol = String(symbolRaw ?? '');
  if (!FSM_SYMBOLS.includes(symbol)) {
    socket.emit('fsm-error', { message: `ILLEGAL δ: ${symbol} in ${sim.fsmState}` });
    return;
  }
  const edge = FSM_TABLE[sim.fsmState][symbol as FsmSymbol];
  if (!edge) {
    socket.emit('fsm-error', { message: `ILLEGAL δ: ${symbol} in ${sim.fsmState}` });
    return;
  }
  doTransition(sim.fsmState, edge.to, symbol as FsmSymbol, edge.reason);
}

/**
 * Thermal guards — run AFTER the APU temperature is computed each tick:
 *   · temp ≥ 85  → force CRIT (if the state has a CRIT edge), else go FAIL_CLOSED
 *                  directly with the critical-limits reason;
 *   · temp ≥ 65  → force WARN from STEADY_STATE_LOCKED / LEAK_ACTIVE;
 *   · THERMAL_THROTTLE cools −1.5 °C/tick → auto RESET once temp < 60 (5 °C hysteresis).
 */
function runThermalGuards(): void {
  const t = sim.apuTemp;
  if (t >= 85) {
    if (sim.fsmState === 'FAIL_CLOSED') return; // already locked down
    const crit = FSM_TABLE[sim.fsmState].CRIT;
    if (crit) {
      doTransition(sim.fsmState, crit.to, 'CRIT', `THERMAL GUARD ≥85°C · ${crit.reason}`);
    } else {
      doTransition(sim.fsmState, 'FAIL_CLOSED', 'CRIT', 'System temperatures exceeded critical limits');
    }
    return;
  }
  if (t >= 65 && (sim.fsmState === 'STEADY_STATE_LOCKED' || sim.fsmState === 'LEAK_ACTIVE')) {
    const warn = FSM_TABLE[sim.fsmState].WARN!;
    doTransition(sim.fsmState, warn.to, 'WARN', `THERMAL GUARD ≥65°C · ${warn.reason}`);
    return;
  }
  if (sim.fsmState === 'THERMAL_THROTTLE' && t < 60) {
    const reset = FSM_TABLE.THERMAL_THROTTLE.RESET!;
    doTransition('THERMAL_THROTTLE', reset.to, 'RESET', `AUTO · ${reset.reason}`);
  }
}

// ─── Tick physics ───────────────────────────────────────────────────────────

/** Leak intensity: ramp 0→1 over 6 ticks; post-CLEAR ease-out over ~10 ticks. */
function advanceLeak(): void {
  if (!sim.leak.active) return;
  if (sim.leakClearing) {
    sim.leak.intensity -= 0.1;
    if (sim.leak.intensity < 0.05) hardClearLeak('ease-out complete (intensity < 0.05)');
  } else if (sim.leak.intensity < 1) {
    sim.leak.intensity = Math.min(1, sim.leak.intensity + 1 / 6);
  }
}

/** Hydraulic physics: inlet 42.5±1.2 L/s, leak draw, outlet, head 58±0.8 m, acoustic. */
function advanceHydraulics(): void {
  const inletFlow = 42.5 + (Math.random() - 0.5) * 2.4; // 42.5 ± 1.2 L/s
  const intensity = sim.leak.active ? sim.leak.intensity : 0;
  const draw = sim.leak.active ? (8 + 6 * intensity) * intensity : 0; // ramps with intensity
  sim.inletFlow = inletFlow;
  sim.outletFlow = inletFlow - draw;
  sim.pressureHead = 58 + (Math.random() - 0.5) * 1.6 - (sim.leak.active ? 4.5 * intensity : 0);
  // acoustic anomaly on the wetted path while intensity > 0.25, with 2% flutter
  sim.acoustic = sim.leak.active && sim.leak.intensity > 0.25 && Math.random() > 0.02;

  // Joukowsky-style wave celerity + safe-harbour invariant latch [200,1400] m/s
  const c = Math.round(
    Math.sqrt(Math.max(1, sim.pressureHead) * 9.81 * 1480 * (0.35 + Math.min(0.4, inletFlow / 200)))
  );
  sim.celerity = c;
  if (c < 200 || c > 1400) {
    sim.invariantOk = false; // violation latches — no auto-recover for a tick
    sim.invariantHoldTick = sim.tick + 1;
  } else if (sim.tick >= sim.invariantHoldTick) {
    sim.invariantOk = true;
  }
}

/**
 * APU thermal model (persistent cabinet N05 temperature):
 *   baseline(t) = 51 + 3·sin(t/40) + noise;
 *   · leak friction heat: +4.5·intensity per tick while drawing;
 *   · THERMAL_THROTTLE: sustained clock-reduction load floor of baseline+6,
 *     with forced cooling of −1.5 °C/tick;
 *   · otherwise (not throttled, not leaking): decay toward baseline at −0.4 °C/tick.
 */
function advanceThermal(): void {
  const baseline = 51 + 3 * Math.sin(sim.tick / 40) + (Math.random() - 0.5) * 1.2;
  const leakDrawing = sim.leak.active && sim.leak.intensity > 0.05;
  const throttled = sim.fsmState === 'THERMAL_THROTTLE';

  if (leakDrawing) sim.apuTemp += 4.5 * sim.leak.intensity;
  if (throttled) {
    sim.apuTemp = Math.max(baseline + 6, sim.apuTemp - 1.5);
  } else if (!leakDrawing) {
    sim.apuTemp = Math.max(baseline, sim.apuTemp - 0.4);
  }
  if (sim.apuTemp < baseline) sim.apuTemp = baseline;
}

/** MRR / pipeline simulation (scaled by the speed multiplier). */
function advanceBusiness(): void {
  const m = sim.metrics;
  const speed = m.speedMultiplier;

  // acquisition (halted while FAIL_CLOSED; customers capped at 10 → R50k)
  if (sim.fsmState !== 'FAIL_CLOSED') {
    if (m.customers < 10 && Math.random() < 0.012 * speed) m.customers++;
  }
  m.pipeline.emails += Math.round(Math.random() * 2 * speed); // 0..2 × speed
  if (Math.random() < Math.min(1, 0.05 * speed)) m.pipeline.demos++;
  if (m.customers < 10 && Math.random() < Math.min(1, 0.008 * speed)) m.pipeline.pilots++;
  m.mrr = m.customers * 5000;

  // month rollover every 40 ticks (fixed, not speed-scaled)
  sim.ticksIntoMonth++;
  if (sim.ticksIntoMonth >= MONTH_TICKS) {
    sim.ticksIntoMonth = 0;
    m.simMonth++;
    if (m.mrr >= MRR_TARGET) m.consecutiveMonthsAt50k++;
    else m.consecutiveMonthsAt50k = 0;
    appendWorm(
      'SYSTEM',
      'SIM_MONTH_ROLL',
      `month ${m.simMonth - 1} closed · MRR R${m.mrr.toLocaleString('en-ZA')} · streak ${m.consecutiveMonthsAt50k} month(s) at R50k`
    );
  }
  m.simDay = Math.floor(sim.ticksIntoMonth / (MONTH_TICKS / 30));
}

// ─── Frame / snapshot builders ──────────────────────────────────────────────

function nodesSteadyNow(): number {
  return sim.fsmState === 'STEADY_STATE_LOCKED' ? 3 : 0;
}

/** Build the full 12-node telemetry frame from current sim state (pure). */
function buildFrame(): TelemetryFrame {
  const m = sim.metrics;
  m.nodesSteady = nodesSteadyNow();

  const nodes: NodeTelemetry[] = NODE_DEFS.map((n) => {
    const hydraulic = HYDRAULIC_NODES.has(n.nodeId);
    const flowRate =
      n.nodeId === 'N02'
        ? round(sim.inletFlow)
        : n.nodeId === 'N03'
          ? round(sim.outletFlow)
          : round((Math.random() - 0.5) * 0.1); // idle nodes: tiny noise
    const pressureHead = hydraulic ? round(sim.pressureHead) : round((Math.random() - 0.5) * 0.1);
    const acousticAbnormal = hydraulic ? sim.acoustic : false;
    const apuTemperature = n.nodeId === 'N05' ? round(sim.apuTemp) : round(34 + (Math.random() - 0.5) * 4); // ambient ~34±2
    return {
      nodeId: n.nodeId,
      name: n.name,
      role: n.role,
      xMm: n.xMm,
      yMm: n.yMm,
      zMm: n.zMm,
      flowRate,
      pressureHead,
      acousticAbnormal,
      apuTemperature,
    };
  });

  return {
    ts: Date.now(),
    fsmState: sim.fsmState,
    nodes,
    leak: {
      active: sim.leak.active,
      nodeId: sim.leak.nodeId,
      intensity: round(sim.leak.intensity, 3),
    },
    metrics: { ...m, pipeline: { ...m.pipeline } }, // copy — frames stay immutable
    thermalThrottled: sim.fsmState === 'THERMAL_THROTTLE',
    estimatedCelerity: sim.celerity,
    invariantOk: sim.invariantOk,
  };
}

function pushHistory(): void {
  const h = sim.history;
  h.ts.push(sim.frame!.ts);
  h.flow.push(round(sim.inletFlow));
  h.pressure.push(round(sim.pressureHead));
  h.temp.push(round(sim.apuTemp));
  h.mrr.push(sim.metrics.mrr);
  if (h.ts.length > HISTORY_CAP) {
    h.ts.shift();
    h.flow.shift();
    h.pressure.shift();
    h.temp.shift();
    h.mrr.shift();
  }
}

/** Fresh copy so zustand setState on the client re-renders (new reference). */
function historyCopy(): HistoryBuffer {
  const h = sim.history;
  return { ts: [...h.ts], flow: [...h.flow], pressure: [...h.pressure], temp: [...h.temp], mrr: [...h.mrr] };
}

/** Trust-gate 3A/3B/3C conditions, recomputed live (consumed by /state + snapshot). */
function computeGates(): GateProgress[] {
  const m = sim.metrics;
  const steady = nodesSteadyNow();
  return [
    {
      id: '3A',
      conditionsMet: m.customers >= 1,
      progress: [{ label: 'Pilot customers', current: m.customers, target: 1, unit: 'customers' }],
    },
    {
      id: '3B',
      conditionsMet: m.mrr >= MRR_TARGET && m.consecutiveMonthsAt50k >= 2,
      progress: [
        { label: 'MRR', current: m.mrr, target: MRR_TARGET, unit: 'R' },
        { label: 'Consecutive months at R50k', current: m.consecutiveMonthsAt50k, target: 2, unit: 'months' },
      ],
    },
    {
      id: '3C',
      conditionsMet: steady >= 3 && m.steadyStateHours >= 72,
      progress: [
        { label: 'Steady nodes', current: steady, target: 3, unit: 'nodes' },
        { label: 'Steady-state hours', current: round(Math.min(m.steadyStateHours, 72), 1), target: 72, unit: 'h' },
      ],
    },
  ];
}

function buildSnapshot(): SimSnapshot {
  return {
    frame: sim.frame!,
    history: historyCopy(),
    wormChain: wormChain.slice(-30),
    fsmLog: sim.fsmLog.slice(-20),
    gateProgress: computeGates(),
  };
}

// ─── Round 19 — 6G NeXt HOLOCOM channel + cross-layer metrics sim ───────────
// §III/IV: an H3D call between two clients via the edge renderer. Nominal
// 6G channel keeps total MTP ≈ 19.4ms (fixed 14.7 + two ~2.3ms legs), right
// under the 20ms target; injected stress (level 1-3, UI "INJECT CHANNEL
// STRESS" → 'holo-stress' socket command) degrades legs/loss/jitter/stalls,
// breaches the MTP budget and drags the QoE surrogate — exactly the paper's
// "undesirable values of transmission parameters … produce artifacts such
// as blurring, freezing" narrative. MTP breach enter/exit transitions are
// WORM-logged (HOLO_MTP_BREACH / HOLO_MTP_RECOVERED).

const holo = {
  tick: 0,
  stressLevel: 0, // 0..3 — NOMINAL | LIGHT | HEAVY | SEVERE
  lastBreach: false,
  // smooth walkers (mean-reverting noise)
  uplinkMs: 2.1,
  downlinkMs: 2.3,
  jitterMs: 0.5,
  lossPct: 0.3,
  stallMs: 0,
  uplinkGbps: 2.1,
  downlinkGbps: 1.9,
  meshPolysM: 2.4,
  renderFps: 90,
  edgeGpu: 0.52,
  edgeCpu: 0.41,
};

/** Small mean-reverting jitter around a base, clamped ≥ lo. */
function walk(current: number, base: number, amplitude: number, lo: number): number {
  const noise = (Math.random() - 0.5) * 2 * amplitude;
  const revert = (base - current) * 0.25;
  return Math.max(lo, current + noise + revert);
}

function holoStressProfile(level: number): { legMs: number; loss: number; jitter: number; stall: number; bw: number } {
  // level: 0 NOMINAL · 1 LIGHT · 2 HEAVY · 3 SEVERE
  return [
    { legMs: 0, loss: 0, jitter: 0, stall: 0, bw: 1 },
    { legMs: 1.6, loss: 2.0, jitter: 1.2, stall: 25, bw: 0.85 },
    { legMs: 3.6, loss: 5.5, jitter: 2.6, stall: 90, bw: 0.6 },
    { legMs: 7.5, loss: 11.0, jitter: 4.5, stall: 260, bw: 0.38 },
  ][Math.max(0, Math.min(3, level))];
}

function buildHoloFrame(): HoloFrame {
  const p = holoStressProfile(holo.stressLevel);
  holo.uplinkMs = walk(holo.uplinkMs, 2.1 + p.legMs, 0.3, 0.8);
  holo.downlinkMs = walk(holo.downlinkMs, 2.3 + p.legMs, 0.32, 0.9);
  holo.jitterMs = walk(holo.jitterMs, 0.5 + p.jitter, 0.18, 0.05);
  holo.lossPct = walk(holo.lossPct, 0.3 + p.loss, 0.12, 0.02);
  holo.stallMs = walk(holo.stallMs, p.stall, p.stall > 0 ? p.stall * 0.2 : 2, 0);
  holo.uplinkGbps = walk(holo.uplinkGbps, 2.1 * p.bw, 0.14, 0.4);
  holo.downlinkGbps = walk(holo.downlinkGbps, 1.9 * p.bw, 0.12, 0.3);
  holo.meshPolysM = walk(holo.meshPolysM, 2.4, 0.1, 1.5);
  holo.renderFps = Math.max(24, Math.round(walk(holo.renderFps, 90 - holo.stressLevel * 18, 2, 20)));
  holo.edgeGpu = walk(holo.edgeGpu, 0.52 + holo.stressLevel * 0.06, 0.03, 0.1);
  holo.edgeCpu = walk(holo.edgeCpu, 0.41, 0.025, 0.1);

  const mtpTotal = HOLO_MTP_FIXED_MS + round(holo.uplinkMs + holo.downlinkMs, 2);
  const breach = mtpTotal > HOLO_MTP_TARGET_MS;

  if (breach !== holo.lastBreach) {
    holo.lastBreach = breach;
    appendWorm(
      'HOLOCOM',
      breach ? 'HOLO_MTP_BREACH' : 'HOLO_MTP_RECOVERED',
      breach
        ? `MTP ${round(mtpTotal, 2)}ms > ${HOLO_MTP_TARGET_MS}ms 6G target · UL ${round(holo.uplinkMs, 2)}ms · DL ${round(holo.downlinkMs, 2)}ms · stress L${holo.stressLevel}`
        : `MTP recovered to ${round(mtpTotal, 2)}ms (≤ ${HOLO_MTP_TARGET_MS}ms target) · stress L${holo.stressLevel}`
    );
  }

  return {
    ts: Date.now(),
    tick: ++holo.tick,
    app: {
      meshPolysM: round(holo.meshPolysM, 2),
      textureResK: 8,
      meshBitrateGbps: round(3.6 * (holo.meshPolysM / 2.4), 2),
      audioBitrateKbps: 256,
      virtualCameras: 4, // SeeReal-style eye-tracked H3D sub-frames
      renderFps: holo.renderFps,
      avgDecodeMs: round(1.8 + holo.stressLevel * 0.4, 2),
    },
    computing: {
      clientCpu: round(walk(0.35, 0.35, 0.02, 0.1), 3),
      clientGpu: round(walk(0.24, 0.24, 0.015, 0.05), 3),
      edgeCpu: round(holo.edgeCpu, 3),
      edgeGpu: round(holo.edgeGpu, 3),
      edgeMem: round(walk(0.45, 0.45, 0.02, 0.1), 3),
      centralGpu: round(walk(0.3, 0.3, 0.02, 0.05), 3),
    },
    network: {
      uplinkMs: round(holo.uplinkMs, 2),
      downlinkMs: round(holo.downlinkMs, 2),
      uplinkGbps: round(holo.uplinkGbps, 2),
      downlinkGbps: round(holo.downlinkGbps, 2),
      jitterMs: round(holo.jitterMs, 2),
      lossPct: round(holo.lossPct, 2),
      stallMs: round(holo.stallMs, 1),
    },
    mtpTotalMs: round(mtpTotal, 2),
    mtpBreach: breach,
    stressLevel: holo.stressLevel,
  };
}

// ─── The tick (1500ms) ──────────────────────────────────────────────────────

function tick(): void {
  sim.tick++;

  advanceBusiness();
  advanceLeak();
  advanceHydraulics();
  advanceThermal();
  runThermalGuards(); // may transition the FSM (WORM + 'fsm' broadcast inside)

  // steady-state accrual — only in STEADY_STATE_LOCKED (post-guard state).
  // Task 7-a — DEMO NARRATIVE HOLD: accrual clamps at 71.9h (one tick short of
  // the 72h Gate 3C condition) and sets steadyFrozen, so "fresh 66.2h" demos
  // keep a visible 0.1h-to-go bar instead of auto-maturing 3C in minutes.
  // SIM SKIP 3C (or hours already ≥ 72) releases the hold and accrual resumes.
  if (sim.fsmState === 'STEADY_STATE_LOCKED' && !sim.metrics.steadyFrozen) {
    const next = sim.metrics.steadyStateHours + 0.15 * sim.metrics.speedMultiplier;
    if (next >= 71.9 && sim.metrics.steadyStateHours < 72) {
      sim.metrics.steadyStateHours = 71.9;
      sim.metrics.steadyFrozen = true;
      appendWorm(
        'SYSTEM',
        'STEADY_HOLD',
        'Steady accrual hold @ 71.9h — Gate 3C maturity requires explicit SIM SKIP 3C (demo narrative control)'
      );
      console.log('[SIM] steady hold engaged @ 71.9h — awaiting SIM SKIP 3C');
    } else {
      sim.metrics.steadyStateHours = round(next, 3);
    }
  }

  sim.frame = buildFrame();
  pushHistory();

  io.emit('telemetry', sim.frame);
  if (sim.tick % 10 === 0) io.emit('history', historyCopy());

  // Round 19 — HOLOCOM cross-layer metrics frame every 2nd tick (3s).
  if (sim.tick % 2 === 0) io.emit('holo', buildHoloFrame());
}

// ─── Telemetry persistence (10s cadence, fire-and-forget) ───────────────────

async function persistTelemetry(): Promise<void> {
  const r = await postJson(`${NEXT_BASE}/api/vvu/telemetry`, {
    nodeId: 'N02',
    flowRate: round(sim.inletFlow, 1),
    pressureHead: round(sim.pressureHead, 1),
    acousticAbnormal: sim.acoustic,
    apuTemperature: round(sim.apuTemp, 1),
    tenantId: TENANT,
  });
  if (!r.ok) {
    // 422 = the API persisted the log but flagged the frame (SANS validation /
    // thermal guard) — an expected condition under demo states like
    // FAIL_CLOSED, not a persistence failure. Only 5xx/0 are true failures.
    if (r.status === 422) {
      console.log(`[VVU] telemetry ingest rejected (422) · frame flagged by validation · log persisted`);
    } else {
      console.log(`[VVU] telemetry persist failed (status ${r.status}) — API reachable?`);
    }
  }
}

// ─── HTTP + socket.io wiring ────────────────────────────────────────────────

const httpServer = createServer(); // all routing handled below

// The path MUST be exactly '/' — Caddy forwards /?XTransformPort=3003 here.
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// engine.io middleware: serve /state and /healthz BEFORE engine.io's verify()
// (with path '/', engine.io would otherwise claim every request).
io.engine.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
  const rawUrl = req.url || '/';
  const path = rawUrl.split('?')[0];
  const isEngineIo = /[?&](EIO|transport|sid)=/.test(rawUrl) || path.startsWith('/socket.io');
  if (isEngineIo) {
    next(); // let engine.io handle its handshake / polling / upgrade requests
    return;
  }

  // CORS on all sim endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET' && path === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === 'GET' && path === '/state') {
    // consumed by the Next.js /api/vvu/gates route to verify gate conditions
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ frame: sim.frame, gateProgress: computeGates() }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`[IO] client connected ${socket.id} · total ${io.engine.clientsCount}`);
  socket.emit('snapshot', buildSnapshot());

  socket.on('request-snapshot', () => {
    socket.emit('snapshot', buildSnapshot());
  });

  socket.on('cmd', (payload) => {
    handleCommand(socket, payload?.type);
  });

  socket.on('sim-speed', (payload) => {
    const raw = Number(payload?.multiplier);
    if (!Number.isFinite(raw)) {
      console.warn(`[IO] sim-speed ignored: non-numeric multiplier from ${socket.id}`);
      return;
    }
    const clamped = Math.min(20, Math.max(1, round(raw, 2))); // clamp 1..20
    if (clamped === sim.metrics.speedMultiplier) return;
    const old = sim.metrics.speedMultiplier;
    sim.metrics.speedMultiplier = clamped;
    appendWorm('SYSTEM', 'SIM_SPEED', `sim speed multiplier ${old}× → ${clamped}×`);
    console.log(`[SIM] speed multiplier ${old}× → ${clamped}×`);
    io.emit('telemetry', buildFrame()); // instant UI feedback
  });

  socket.on('sim-skip', (payload) => {
    const gate = String(payload?.gate ?? '').trim().toUpperCase();
    if (!['3A', '3B', '3C', 'RESET_DEMO'].includes(gate)) {
      socket.emit('fsm-error', { message: `SIM-SKIP: unknown gate "${gate}" (3A · 3B · 3C · RESET_DEMO)` });
      return;
    }
    const m = sim.metrics;
    let details = '';

    if (gate === '3A') {
      m.customers = Math.max(1, m.customers);
      m.mrr = m.customers * 5000;
      details = `Gate 3A fast path · customers ${m.customers} · MRR R${m.mrr.toLocaleString('en-ZA')}`;
    } else if (gate === '3B') {
      m.customers = 10;
      m.mrr = MRR_TARGET;
      m.consecutiveMonthsAt50k = Math.max(2, m.consecutiveMonthsAt50k);
      details = `Gate 3B fast path · customers 10 · MRR R${m.mrr.toLocaleString('en-ZA')} · streak ${m.consecutiveMonthsAt50k} month(s)`;
    } else if (gate === '3C') {
      // 3C needs 3 steady nodes — normalise the FSM first if a leak/thermal arc is open.
      if (sim.fsmState !== 'STEADY_STATE_LOCKED') {
        const edge = FSM_TABLE[sim.fsmState].RESET;
        doTransition(
          sim.fsmState,
          'STEADY_STATE_LOCKED',
          'RESET',
          `SIM SKIP 3C normalisation · ${edge ? edge.reason : 'demo state reset'}`
        );
        hardClearLeak('SIM SKIP 3C normalisation');
        sim.leakClearing = false;
      }
      m.steadyStateHours = Math.max(72, m.steadyStateHours);
      m.steadyFrozen = false; // release the 71.9h hold — accrual resumes past 72h
      details = `Gate 3C fast path · steady nodes 3 · ${m.steadyStateHours.toFixed(1)}h (≥72h met)`;
    } else if (gate === 'RESET_DEMO') {
      // full fresh-demo state (fresh service boot values)
      if (sim.fsmState !== 'STEADY_STATE_LOCKED') {
        doTransition(sim.fsmState, 'STEADY_STATE_LOCKED', 'RESET', 'SIM RESET_DEMO · fresh demo state');
      }
      hardClearLeak('SIM RESET_DEMO');
      sim.leakClearing = false;
      sim.apuTemp = 51;
      sim.inletFlow = 42.5;
      sim.outletFlow = 42.5;
      sim.pressureHead = 58;
      sim.acoustic = false;
      Object.assign(m, {
        customers: 1,
        mrr: 5000,
        consecutiveMonthsAt50k: 0,
        nodesSteady: 3,
        steadyStateHours: 66.2,
        steadyFrozen: false,
        simMonth: 1,
        simDay: 0,
        speedMultiplier: 1,
      });
      sim.ticksIntoMonth = 0;
      details =
        'demo state reset · 1 customer · MRR R5k · 66.2h steady · ×1 speed · STEADY_STATE_LOCKED';
    }

    appendWorm('DEMO_CTRL', 'SIM_SKIP', details);
    console.log(`[SIM] skip → ${gate} · ${details}`);

    sim.frame = buildFrame();
    io.emit('telemetry', sim.frame); // instant UI feedback everywhere
    io.emit('snapshot', buildSnapshot()); // refresh gate progress + chain for all clients
  });

  socket.on('worm-log', (payload) => {
    const event = String(payload?.event ?? '').trim().slice(0, 80);
    if (!event) {
      console.warn(`[IO] worm-log ignored: missing event from ${socket.id}`);
      return;
    }
    const source = String(payload?.source ?? '').trim().slice(0, 40) || 'OPERATOR';
    const details = String(payload?.details ?? '').slice(0, 400);
    appendWorm(source, event, details);
  });

  socket.on('holo-stress', (payload) => {
    const raw = Number(payload?.level);
    if (!Number.isFinite(raw)) {
      console.warn(`[IO] holo-stress ignored: non-numeric level from ${socket.id}`);
      return;
    }
    const level = Math.max(0, Math.min(3, Math.round(raw)));
    if (level === holo.stressLevel) return;
    const old = holo.stressLevel;
    holo.stressLevel = level;
    const names = ['NOMINAL', 'LIGHT', 'HEAVY', 'SEVERE'];
    appendWorm(
      'HOLOCOM',
      'HOLO_CHANNEL_STRESS',
      `channel stress L${old} ${names[Math.min(3, old)]} → L${level} ${names[level]} · radio shadow + interference walk injected`
    );
    console.log(`[HOLO] channel stress L${old} → L${level}`);
    io.emit('holo', buildHoloFrame()); // instant UI feedback
  });

  socket.on('disconnect', (reason) => {
    console.log(`[IO] client disconnected ${socket.id} (${reason}) · total ${Math.max(0, io.engine.clientsCount - 1)}`);
  });
});

// ─── Boot sequence + timers ─────────────────────────────────────────────────

let tickTimer: ReturnType<typeof setInterval> | null = null;
let wormTimer: ReturnType<typeof setInterval> | null = null;
let telemetryTimer: ReturnType<typeof setInterval> | null = null;

console.log(`[VVU] Gqeberha edge node booting · port ${PORT} · tenant ${TENANT}`);

sim.frame = buildFrame(); // initial frame so the first snapshot is complete

httpServer.listen(PORT, () => {
  console.log(`[VVU] http + socket.io listening on :${PORT} (engine path '/')`);

  // WORM boot sequence (in order)
  appendWorm('SYSTEM', 'SYSTEM_BOOT', `Gqeberha edge node online · port ${PORT} · tenant ${TENANT}`);
  appendWorm('SYSTEM', 'TENANT_RLS_SCOPE', 'vvu.current_tenant_id scoped · RLS isolation active');
  appendWorm('FSM', 'FSM_BOOT_STEADY_STATE', 'Nodes pre-provisioned · STEADY_STATE_LOCKED · steady 66.2h');
  appendWorm('GATE', 'GATE_3A_EVIDENCE', 'R5k pilot invoice verified · WORM invoice + POP bound');
  appendWorm('TELEMETRY', 'TELEMETRY_WORM_BIND', 'ingestEdgeTelemetry cadence 1.5s · celerity bounds [200,1400] m/s');
  console.log('[VVU] WORM boot sequence complete (5 events chained to GENESIS-20260901)');

  tickTimer = setInterval(tick, TICK_MS);
  wormTimer = setInterval(() => void flushWormQueue(), 5000);
  telemetryTimer = setInterval(() => void persistTelemetry(), 10000);
  console.log(`[VVU] tick engine online · ${TICK_MS}ms cadence · speed ${sim.metrics.speedMultiplier}× · MRR R${sim.metrics.mrr}`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`[VVU] ${signal} received — shutting down (closing io + httpServer)`);
  if (tickTimer) clearInterval(tickTimer);
  if (wormTimer) clearInterval(wormTimer);
  if (telemetryTimer) clearInterval(telemetryTimer);
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref(); // hard stop fallback
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Resilience under nohup: never die on a stray async error — log and continue.
process.on('uncaughtException', (err) => {
  console.error(`[VVU] uncaughtException (suppressed): ${err?.message ?? err}`);
});
process.on('unhandledRejection', (err) => {
  console.error(`[VVU] unhandledRejection (suppressed): ${String(err)}`);
});
