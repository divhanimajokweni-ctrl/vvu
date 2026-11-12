/**
 * Epistemic Runtime — Real-time Event Bus (WebSocket service)
 * Port: 3032
 *
 * This is NOT polling. This is a real WebSocket server that pushes live events:
 * - State transitions (committed/rejected)
 * - Invariant violations
 * - Merge proposals
 * - Shadow bridge events
 * - Shard status changes
 *
 * The dashboard connects via: io("/?XTransformPort=3032")
 */

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3032;

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Event types ─────────────────────────────────────────────────────────────

interface RuntimeEvent {
  id: string;
  type: "transition" | "violation" | "merge" | "shadow" | "shard_status" | "proof";
  shardId?: string;
  policyName?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// ── Event log (ring buffer, last 1000 events) ───────────────────────────────

const eventLog: RuntimeEvent[] = [];
const MAX_LOG = 1000;

function logEvent(event: RuntimeEvent): void {
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.shift();
  // Broadcast to all connected clients
  io.emit("event", event);
  console.log(`[event-bus] ${event.type}: ${event.id} → ${io.engine.clientsCount} clients`);
}

// ── Connection handling ─────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[event-bus] client connected: ${socket.id}`);

  // Send recent event history on connect
  socket.emit("history", eventLog.slice(-50));

  // Client can subscribe to specific event types
  socket.on("subscribe", (types: string[]) => {
    for (const t of types) {
      socket.join(`type:${t}`);
    }
    console.log(`[event-bus] ${socket.id} subscribed to: ${types.join(", ")}`);
  });

  // Client can push events (for testing / CLI integration)
  socket.on("push", (event: Omit<RuntimeEvent, "id" | "timestamp">) => {
    const fullEvent: RuntimeEvent = {
      ...event,
      id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    logEvent(fullEvent);
    socket.emit("ack", { id: fullEvent.id });
  });

  socket.on("disconnect", () => {
    console.log(`[event-bus] client disconnected: ${socket.id}`);
  });
});

// ── Simulated runtime events (for demo — real events come from the engine) ──

const SHARDS = ["europe-west", "europe-north", "na-east", "na-west", "apac-south", "apac-east"];
const POLICIES = ["grid_frequency_stability", "fleet_safety_envelope", "water_treatment_safety"];

let eventCounter = 0;

function generateRuntimeEvent(): RuntimeEvent {
  const types: RuntimeEvent["type"][] = ["transition", "violation", "merge", "shadow", "shard_status"];
  const type = types[Math.floor(Math.random() * types.length)];
  const shard = SHARDS[Math.floor(Math.random() * SHARDS.length)];
  const policy = POLICIES[Math.floor(Math.random() * POLICIES.length)];

  const base = {
    id: `evt-${Date.now().toString(36)}-${(++eventCounter).toString(36)}`,
    type,
    shardId: shard,
    policyName: policy,
    timestamp: Date.now(),
    data: {} as Record<string, unknown>,
  };

  switch (type) {
    case "transition":
      base.data = {
        committed: Math.random() > 0.15,
        nodeId: `edge-0${Math.floor(Math.random() * 3) + 1}`,
        clock: { [`edge-0${Math.floor(Math.random() * 3) + 1}`]: Math.floor(Math.random() * 100) },
      };
      break;
    case "violation":
      base.data = {
        invariant: ["freq_bounds", "thermal_headroom", "speed_bound", "chlorine_residual"][Math.floor(Math.random() * 4)],
        severity: Math.random() > 0.5 ? "critical" : "medium",
        soft: Math.random() > 0.5,
      };
      break;
    case "merge":
      base.data = {
        from: SHARDS[Math.floor(Math.random() * SHARDS.length)],
        to: shard,
        divergence: Math.random() * 2,
        result: Math.random() > 0.2 ? "applied" : "rejected",
      };
      break;
    case "shadow":
      base.data = {
        kind: ["takeover", "whatif", "replay", "divergence"][Math.floor(Math.random() * 4)],
        divergence: Math.random(),
      };
      break;
    case "shard_status":
      base.data = {
        status: ["healthy", "repairing", "violating"][Math.floor(Math.random() * 3)],
        nodeId: `edge-0${Math.floor(Math.random() * 3) + 1}`,
      };
      break;
  }

  return base;
}

// Emit events every 3-8 seconds
function scheduleNext() {
  const delay = 3000 + Math.random() * 5000;
  setTimeout(() => {
    logEvent(generateRuntimeEvent());
    scheduleNext();
  }, delay);
}

// ── Start ───────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[event-bus] WebSocket server running on port ${PORT}`);
  console.log(`[event-bus] Connect via: io("/?XTransformPort=${PORT}")`);
  scheduleNext();
});
