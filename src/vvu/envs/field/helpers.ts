// FIELD helpers — observation schema, virtual clock, transition rules.
// Pure TS module (no "use client" directive — would break Turbopark in .ts).
import { create } from "zustand";
import { uid, SHA256, canonical } from "@/lib/vvu-utils";

// ============================================================
// Observation vocabulary
// ============================================================
export type CalibrationState = "VALID" | "EXPIRED" | "UNKNOWN";
export type SensorState = "OK" | "FAULT" | "UNKNOWN";
export type Provenance = "DEVICE-OBSERVED" | "SYNTHETIC-ONLY";
export type ClockSource = "VIRTUAL" | "NTP" | "GPS";
export type ClockConfidence = "HIGH" | "MEDIUM" | "LOW";
export type DeliveryStatus =
  | "RECORDED_LOCALLY"
  | "QUEUED_FOR_EXPORT"
  | "TRANSMITTED"
  | "ACCEPTED_BY_RECEIVER"
  | "VALIDATED_BY_RECEIVER";

// 12 required fields. Anything carrying inference/conclusion/interpretation
// is NOT an observation (type separation — observations are pure measurement).
export interface Observation {
  observation_id: string;
  value: number;
  unit: string;
  sensor_id: string;
  measured_at: number;
  received_at: number;
  calibration_state: CalibrationState;
  sensor_state: SensorState;
  configuration_version: string;
  provenance: Provenance;
  clock_source: ClockSource;
  clock_confidence: ClockConfidence;
  // delivery lifecycle (transient metadata; not part of the 12 measurement fields)
  delivery_status: DeliveryStatus;
  acked_by?: string;
  validation_ref?: string;
}

export const REQUIRED_OBSERVATION_FIELDS = [
  "observation_id",
  "value",
  "unit",
  "sensor_id",
  "measured_at",
  "received_at",
  "calibration_state",
  "sensor_state",
  "configuration_version",
  "provenance",
  "clock_source",
  "clock_confidence",
] as const;

export const FORBIDDEN_INFERENCE_KEYS = [
  "inference",
  "conclusion",
  "interpretation",
] as const;

const CAL_VALUES: CalibrationState[] = ["VALID", "EXPIRED", "UNKNOWN"];
const SEN_VALUES: SensorState[] = ["OK", "FAULT", "UNKNOWN"];
const PROV_VALUES: Provenance[] = ["DEVICE-OBSERVED", "SYNTHETIC-ONLY"];
const CLK_SRC_VALUES: ClockSource[] = ["VIRTUAL", "NTP", "GPS"];
const CLK_CONF_VALUES: ClockConfidence[] = ["HIGH", "MEDIUM", "LOW"];

export function isObservation(o: unknown): { ok: boolean; reason?: string } {
  if (!o || typeof o !== "object") return { ok: false, reason: "not an object" };
  const obj = o as Record<string, unknown>;
  // type separation: an inference/conclusion/interpretation cannot be an observation
  for (const k of FORBIDDEN_INFERENCE_KEYS) {
    if (k in obj) return { ok: false, reason: `forbidden inference key present: ${k}` };
  }
  for (const k of REQUIRED_OBSERVATION_FIELDS) {
    if (!(k in obj) || obj[k] === undefined || obj[k] === null) {
      return { ok: false, reason: `missing required field: ${k}` };
    }
  }
  if (typeof obj.value !== "number" || Number.isNaN(obj.value)) {
    return { ok: false, reason: "value must be a number" };
  }
  if (typeof obj.measured_at !== "number" || typeof obj.received_at !== "number") {
    return { ok: false, reason: "timestamps must be numbers" };
  }
  if (!CAL_VALUES.includes(obj.calibration_state as CalibrationState)) {
    return { ok: false, reason: `bad calibration_state: ${obj.calibration_state}` };
  }
  if (!SEN_VALUES.includes(obj.sensor_state as SensorState)) {
    return { ok: false, reason: `bad sensor_state: ${obj.sensor_state}` };
  }
  if (!PROV_VALUES.includes(obj.provenance as Provenance)) {
    return { ok: false, reason: `bad provenance: ${obj.provenance}` };
  }
  if (!CLK_SRC_VALUES.includes(obj.clock_source as ClockSource)) {
    return { ok: false, reason: `bad clock_source: ${obj.clock_source}` };
  }
  if (!CLK_CONF_VALUES.includes(obj.clock_confidence as ClockConfidence)) {
    return { ok: false, reason: `bad clock_confidence: ${obj.clock_confidence}` };
  }
  return { ok: true };
}

export function buildSampleObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    observation_id: uid("obs"),
    value: 1.5,
    unit: "L/s",
    sensor_id: "SNS-001",
    measured_at: useVC.getState().now,
    received_at: Date.now(),
    calibration_state: "VALID",
    sensor_state: "OK",
    configuration_version: CONFIG_VERSION,
    provenance: "SYNTHETIC-ONLY",
    clock_source: "VIRTUAL",
    clock_confidence: "HIGH",
    delivery_status: "RECORDED_LOCALLY",
    ...overrides,
  };
}

// ============================================================
// Sensors (4 seeded) + configuration version
// ============================================================
export interface Sensor {
  id: string;
  calibration: CalibrationState;
  state: SensorState;
  unit: string;
}

export const SENSORS: Sensor[] = [
  { id: "SNS-001", calibration: "VALID", state: "OK", unit: "L/s" },
  { id: "SNS-002", calibration: "VALID", state: "OK", unit: "kL" },
  { id: "SNS-003", calibration: "EXPIRED", state: "OK", unit: "bar" },
  { id: "SNS-004", calibration: "VALID", state: "FAULT", unit: "L/s" },
];

export const CONFIG_VERSION = "vvu-field-cfg@1.0.0";

// ============================================================
// Gap facts
// ============================================================
export interface GapFact {
  gap_id: string;
  from: number;
  to: number;
  duration_ms: number;
  observations_queued: number;
  reason: string;
  recorded_at: number;
}

// ============================================================
// Delivery transitions — strict ladder, no skips
// ============================================================
const ALLOWED_TRANSITIONS: [DeliveryStatus, DeliveryStatus][] = [
  ["RECORDED_LOCALLY", "QUEUED_FOR_EXPORT"],
  ["QUEUED_FOR_EXPORT", "TRANSMITTED"],
  ["TRANSMITTED", "ACCEPTED_BY_RECEIVER"],
  ["ACCEPTED_BY_RECEIVER", "VALIDATED_BY_RECEIVER"],
];

export function transitionAllowed(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export const DELIVERY_LADDER: DeliveryStatus[] = [
  "RECORDED_LOCALLY",
  "QUEUED_FOR_EXPORT",
  "TRANSMITTED",
  "ACCEPTED_BY_RECEIVER",
  "VALIDATED_BY_RECEIVER",
];

// ============================================================
// Virtual clock — transient singleton (NOT in FieldState store).
// Initialized to Date.now() on module load. advance(ms) moves it
// forward. Exposed via a tiny zustand store so React can subscribe.
// ============================================================
export const useVC = create<{
  now: number;
  advance: (ms: number) => void;
  set: (ts: number) => void;
  reset: () => void;
}>((set) => ({
  now: Date.now(),
  advance: (ms) => set((s) => ({ now: s.now + ms })),
  set: (ts) => set({ now: ts }),
  reset: () => set({ now: Date.now() }),
}));

// ============================================================
// Self-contained export package (FS-4 handoff)
// ============================================================
export function buildExportPackage(observations: Observation[], configVersion: string) {
  const pkg = {
    schema: "vvu-field-export@1.0.0",
    provenance: "SYNTHETIC-ONLY" as Provenance,
    exported_at: Date.now(),
    configuration_version: configVersion,
    observations,
    count: observations.length,
  };
  const manifest_hash = "sha256:" + SHA256.hexOf(canonical(pkg));
  return { ...pkg, manifest_hash };
}

export function verifyExportPackage(pkg: unknown): boolean {
  if (!pkg || typeof pkg !== "object") return false;
  const p = pkg as Record<string, unknown>;
  if (!p.manifest_hash || typeof p.manifest_hash !== "string") return false;
  const rest = { ...p };
  delete rest.manifest_hash;
  const recomputed = "sha256:" + SHA256.hexOf(canonical(rest));
  return recomputed === p.manifest_hash;
}
