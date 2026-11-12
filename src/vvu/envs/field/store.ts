// FIELD store — observations, delivery, gaps, sensors, ackedIds.
// Pure TS module (no "use client" directive).
import { makeStore } from "@/vvu/store";
import { toast } from "@/vvu/toast";
import { uid, dur, download } from "@/lib/vvu-utils";
import {
  Observation,
  GapFact,
  Sensor,
  SENSORS,
  CONFIG_VERSION,
  isObservation,
  useVC,
  buildExportPackage,
  transitionAllowed,
  ClockSource,
  ClockConfidence,
  DeliveryStatus,
} from "./helpers";

export interface FieldState {
  queue: Observation[];
  delivered: Observation[];
  gaps: GapFact[];
  sensors: Sensor[];
  ackedIds: string[];
  configVersion: string;
}

const ENV_KEY = "field.vvu.v1";

const initialState = (): FieldState => ({
  queue: [],
  delivered: [],
  gaps: [],
  sensors: SENSORS.map((s) => ({ ...s })),
  ackedIds: [],
  configVersion: CONFIG_VERSION,
});

export const useField = makeStore<FieldState>(ENV_KEY, initialState);

// ============================================================
// capture() — build an observation from sensor + value + clock opts,
// validate with isObservation, push to queue. measured_at = VC.now()
// (NEVER overwritten by received_at). received_at = Date.now() (real
// wall clock). Toasts warn on FAULT or EXPIRED sensor (FS-5: the
// observation is recorded WITH that state, not dropped).
// ============================================================
export function capture(
  sensorId: string,
  value: number,
  opts: { clock_source?: ClockSource; clock_confidence?: ClockConfidence } = {}
): Observation | null {
  const st = useField.getState();
  const sensor = st.d.sensors.find((s) => s.id === sensorId);
  if (!sensor) {
    toast(`unknown sensor ${sensorId}`, "bad");
    return null;
  }
  const vcNow = useVC.getState().now;
  const obs: Observation = {
    observation_id: uid("obs"),
    value,
    unit: sensor.unit,
    sensor_id: sensor.id,
    measured_at: vcNow, // virtual clock — never overwritten
    received_at: Date.now(), // real wall clock when the system received it
    calibration_state: sensor.calibration,
    sensor_state: sensor.state,
    configuration_version: st.d.configVersion,
    provenance: "SYNTHETIC-ONLY",
    clock_source: opts.clock_source ?? "VIRTUAL",
    clock_confidence: opts.clock_confidence ?? "HIGH",
    delivery_status: "RECORDED_LOCALLY",
  };
  const v = isObservation(obs);
  if (!v.ok) {
    toast(`capture rejected: ${v.reason}`, "bad");
    return null;
  }
  // transition RECORDED_LOCALLY → QUEUED_FOR_EXPORT (allowed)
  obs.delivery_status = "QUEUED_FOR_EXPORT";
  st.commit(
    "capture",
    `observation ${obs.observation_id} recorded · ${obs.sensor_id} · ${obs.value} ${obs.unit}`,
    (d) => {
      d.queue = [...d.queue, obs];
    }
  );
  if (sensor.state === "FAULT") {
    toast(`sensor ${sensor.id} FAULT — observation recorded WITH that state`, "warn");
  }
  if (sensor.calibration === "EXPIRED") {
    toast(`sensor ${sensor.id} calibration EXPIRED — observation recorded WITH that state`, "warn");
  }
  return obs;
}

// ============================================================
// syncOnce() — pop the queue, transition each through
// TRANSMITTED → ACCEPTED_BY_RECEIVER → VALIDATED_BY_RECEIVER (final
// state VALIDATED_BY_RECEIVER), push to delivered, populate acked_by
// and validation_ref, collapse duplicates by observation_id via
// ackedIds. Detects a gap (>60s between last delivered.measured_at
// and first queued.measured_at) and records a gap fact.
// ============================================================
export function syncOnce(): { delivered_count: number; duplicates: number; gap?: GapFact } {
  const st = useField.getState();
  const queue = st.d.queue;
  if (queue.length === 0) {
    toast("queue is empty", "info");
    return { delivered_count: 0, duplicates: 0 };
  }

  // gap detection: >60s between last delivered.measured_at and first queued.measured_at
  let gap: GapFact | undefined;
  if (st.d.delivered.length > 0) {
    const lastDelivered = st.d.delivered[st.d.delivered.length - 1];
    const firstQueued = queue[0];
    const delta = firstQueued.measured_at - lastDelivered.measured_at;
    if (delta > 60000) {
      gap = {
        gap_id: uid("gap"),
        from: lastDelivered.measured_at,
        to: firstQueued.measured_at,
        duration_ms: delta,
        observations_queued: queue.length,
        reason: "device offline — no connectivity during this interval",
        recorded_at: Date.now(),
      };
    }
  }

  // collapse duplicates by observation_id via ackedIds
  const acked = new Set<string>(st.d.ackedIds);
  const newDelivered: Observation[] = [];
  let duplicates = 0;
  for (const obs of queue) {
    if (acked.has(obs.observation_id)) {
      duplicates++;
      continue;
    }
    // strict ladder: QUEUED_FOR_EXPORT → TRANSMITTED → ACCEPTED_BY_RECEIVER → VALIDATED_BY_RECEIVER
    // (final state VALIDATED_BY_RECEIVER; each step allowed)
    if (
      !transitionAllowed("QUEUED_FOR_EXPORT", "TRANSMITTED") ||
      !transitionAllowed("TRANSMITTED", "ACCEPTED_BY_RECEIVER") ||
      !transitionAllowed("ACCEPTED_BY_RECEIVER", "VALIDATED_BY_RECEIVER")
    ) {
      continue;
    }
    const acked_by = "receiver-" + Math.random().toString(36).slice(2, 8);
    const validation_ref = "vr-" + Math.random().toString(36).slice(2, 10);
    newDelivered.push({
      ...obs,
      delivery_status: "VALIDATED_BY_RECEIVER",
      acked_by,
      validation_ref,
    });
    acked.add(obs.observation_id);
  }

  st.commit(
    "sync",
    `synced ${newDelivered.length} observation(s) · ${duplicates} duplicate(s) collapsed${gap ? " · gap fact emitted" : ""}`,
    (d) => {
      d.delivered = [...d.delivered, ...newDelivered];
      d.queue = [];
      d.ackedIds = Array.from(acked);
      if (gap) d.gaps = [...d.gaps, gap!];
    }
  );

  if (gap) toast(`gap fact emitted · ${dur(gap.duration_ms)} offline`, "warn");
  toast(
    `synced ${newDelivered.length} obs · ${duplicates} duplicates collapsed`,
    newDelivered.length > 0 ? "ok" : "info"
  );
  return { delivered_count: newDelivered.length, duplicates, gap };
}

// ============================================================
// syncTwiceTest() — demonstrate idempotency: sync once, then re-queue
// the same observation_ids and sync again. The second sync collapses
// all re-queued ids as duplicates (ackedIds dedup).
// ============================================================
export function syncTwiceTest(): void {
  const st = useField.getState();
  if (st.d.queue.length === 0) {
    // seed two fresh observations so we have something to test
    capture("SNS-001", 1.0, {});
    capture("SNS-002", 2.0, {});
  }
  const before = useField.getState().d.queue;
  if (before.length === 0) {
    toast("nothing to sync", "info");
    return;
  }
  // snapshot the ids before sync (these will be re-queued after)
  const ids = before.map(
    (o) => ({ ...o, delivery_status: "QUEUED_FOR_EXPORT" as DeliveryStatus })
  );
  // sync once — delivers all, acks the ids
  syncOnce();
  // re-queue the same observation_ids (simulating a duplicate retry from the device)
  useField.getState().commit(
    "sync.dup-test",
    `re-queued ${ids.length} observation(s) with same ids to test idempotency`,
    (d) => {
      d.queue = [...d.queue, ...ids];
    }
  );
  // sync again — should collapse all as duplicates
  syncOnce();
}

// ============================================================
// simulateReceiverFailure() — FS-2: receiver unavailable. Queue
// retained, nothing dropped. (No state change, just a log entry +
// toast.)
// ============================================================
export function simulateReceiverFailure(): void {
  const st = useField.getState();
  if (st.d.queue.length === 0) {
    toast("queue is empty — nothing to fail", "info");
    return;
  }
  st.commit(
    "sync.fail",
    `receiver unavailable · ${st.d.queue.length} observation(s) retained · nothing dropped`,
    () => {}
  );
  toast(
    `receiver unavailable · ${st.d.queue.length} obs retained · nothing dropped`,
    "warn"
  );
}

// ============================================================
// exportQueue() — FS-4: handoff. Export the queue as a self-contained
// JSON file (schema + observations + count + manifest hash). No
// service online required to transfer.
// ============================================================
export function exportQueue(): void {
  const st = useField.getState();
  const pkg = buildExportPackage(st.d.queue, st.d.configVersion);
  const fname = `field-queue-${new Date().toISOString().slice(0, 10)}-${st.d.queue.length}.json`;
  download(fname, JSON.stringify(pkg, null, 2));
  toast(`exported ${st.d.queue.length} observations as self-contained file`, "ok");
}

// ============================================================
// recordManualGap() — push a 2-hour gap ending at VC.now().
// ============================================================
export function recordManualGap(): GapFact {
  const vcNow = useVC.getState().now;
  const st = useField.getState();
  const to = vcNow;
  const from = to - 2 * 60 * 60 * 1000; // 2 hours
  const gap: GapFact = {
    gap_id: uid("gap"),
    from,
    to,
    duration_ms: 2 * 60 * 60 * 1000,
    observations_queued: st.d.queue.length,
    reason: "manual gap fact — 2-hour offline interval recorded",
    recorded_at: Date.now(),
  };
  st.commit("gap.record", `manual gap fact recorded · ${dur(gap.duration_ms)}`, (d) => {
    d.gaps = [...d.gaps, gap];
  });
  toast(`manual gap fact recorded · ${dur(gap.duration_ms)}`, "ok");
  return gap;
}

// ============================================================
// log helper
// ============================================================
export const log = (type: string, detail: string) =>
  useField.getState().commit(type, detail);
