/**
 * VVU WORM Nest — live WORM hash-chained evidence stream + telemetry.
 * Port: 3003
 *
 * Events emitted:
 *   - "snapshot"   (on connect) — full node list + chain head
 *   - "evidence"   (~2.5s)      — per-node spatial evidence
 *   - "worm"       (~5s)        — new hash-chained WORM event
 *   - "chain-head" (~10s)       — { wormHead, depth, lastHash }
 *   - "eis"        (~4s)        — Evidence Integrity Score tick
 *
 * The hash chain is genuinely SHA-256 verifiable.
 * Connect via: io("/?XTransformPort=3003", { transports: ["websocket"] })
 */

import { createServer } from "http";
import { Server } from "socket.io";
import { createHash } from "crypto";

const PORT = 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── SHA-256 ──
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ── Types ──
type NodeType = "edge_node" | "tank" | "pump" | "valve" | "acoustic" | "prv";
type VerificationState = "INCONCLUSIVE" | "CANDIDATE" | "VERIFIED" | "TAMPER_DETECTED";

interface SpatialNode {
  id: string;
  type: NodeType;
  name: string;
  position: { lng: number; lat: number; altitude: number };
  telemetry: { flowRate?: number; pressure?: number; tankLevel?: number; spl?: number };
  verificationState: VerificationState;
  tier: 1 | 2 | 3 | 4;
}

// ── NMBM nodes (Gqeberha) ──
const NODES: SpatialNode[] = [
  { id: "NODE-HG-01", type: "edge_node", name: "Baakens River Gateway", position: { lng: 25.6022, lat: -33.9608, altitude: 42.8 }, telemetry: { flowRate: 112.4, pressure: 4.6, spl: 48.2 }, verificationState: "VERIFIED", tier: 2 },
  { id: "NODE-TANK-04", type: "tank", name: "Algoa Bay JoJo Buffer #4", position: { lng: 25.6154, lat: -33.9542, altitude: 68.2 }, telemetry: { flowRate: 45.0, pressure: 1.2, tankLevel: 78 }, verificationState: "VERIFIED", tier: 2 },
  { id: "NODE-PRV-02", type: "prv", name: "Driefontein PRV", position: { lng: 25.5891, lat: -33.9685, altitude: 85.0 }, telemetry: { flowRate: 148.9, pressure: 3.8, spl: 62.4 }, verificationState: "CANDIDATE", tier: 1 },
];

// ── WORM chain ──
const wormChain: { hash: string; previousHash: string | null; subject: string; source: string; payload: string; observedAt: string }[] = [];
let wormHead: string = sha256("genesis");

function appendWorm(subject: string, source: string, payload: Record<string, unknown>) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const previousHash = wormHead;
  const hash = sha256(previousHash + canonical);
  wormHead = hash;
  const event = { hash, previousHash, subject, source, payload: canonical, observedAt: new Date().toISOString() };
  wormChain.push(event);
  io.emit("worm", event);
  io.emit("chain-head", { wormHead, depth: wormChain.length, lastHash: hash });
  console.log(`[worm-nest] WORM #${wormChain.length}: ${subject} → ${hash.slice(0, 16)}…`);
  return event;
}

// ── EIS computation ──
function computeEIS(pressure: number, flow: number, acoustic: number): number {
  const w1 = Math.abs(pressure - 4.5) / 4.5;
  const w2 = flow > 200 ? (flow - 200) / 100 : 0;
  const w3 = acoustic > 55 ? (acoustic - 55) / 10 : 0;
  return Math.min(100, Math.round((w1 * 40 + w2 * 35 + w3 * 25) * 10) / 10);
}

// ── Connection handling ──
io.on("connection", (socket) => {
  console.log(`[worm-nest] client connected: ${socket.id}`);
  socket.emit("snapshot", { nodes: NODES, chainHead: wormHead, depth: wormChain.length, chain: wormChain.slice(-10) });
  socket.on("disconnect", () => console.log(`[worm-nest] client disconnected: ${socket.id}`));
});

// ── Telemetry ticker (every 2.5s) ──
setInterval(() => {
  NODES.forEach((node) => {
    if (node.telemetry.flowRate) node.telemetry.flowRate = Number((node.telemetry.flowRate + (Math.random() * 0.8 - 0.4)).toFixed(2));
    if (node.telemetry.pressure) node.telemetry.pressure = Number((node.telemetry.pressure + (Math.random() * 0.2 - 0.1)).toFixed(2));
    if (node.telemetry.spl) node.telemetry.spl = Number((node.telemetry.spl + (Math.random() * 0.5 - 0.25)).toFixed(2));
    io.emit("evidence", { ...node, observedAt: new Date().toISOString() });
  });
}, 2500);

// ── WORM event ticker (every 5s) ──
setInterval(() => {
  const node = NODES[Math.floor(Math.random() * NODES.length)];
  const subjects = ["pressure.deviation", "flow.anomaly", "acoustic.threshold", "tank.level", "verification.tick"];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  appendWorm(subject, node.id, { node: node.id, type: node.type, telemetry: node.telemetry, timestamp: new Date().toISOString() });
}, 5000);

// ── EIS ticker (every 4s) ──
setInterval(() => {
  const node = NODES[Math.floor(Math.random() * NODES.length)];
  const eis = computeEIS(node.telemetry.pressure ?? 0, node.telemetry.flowRate ?? 0, node.telemetry.spl ?? 0);
  io.emit("eis", { nodeId: node.id, eis, timestamp: new Date().toISOString() });
}, 4000);

// ── Start ──
httpServer.listen(PORT, () => {
  console.log(`[worm-nest] WORM nest WebSocket server on port ${PORT}`);
  console.log(`[worm-nest] Connect via: io("/?XTransformPort=${PORT}")`);
  // Genesis WORM event
  appendWorm("chain.genesis", "system", { type: "genesis", timestamp: new Date().toISOString() });
});
