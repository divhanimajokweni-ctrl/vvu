// FORGE envelope — canonical hashing + PROPOSED-only enforcement.
// Pure-TS, no VVU runtime dependency. The browser is the validator.
import { uid, iso, canonical, contentHash, clone } from "@/lib/vvu-utils";

export const ENVELOPE_VERSION = "1.0.0";

// Statuses Forge may NEVER write. Only PROPOSED is permitted on a claim.
export const FORGE_FORBIDDEN_STATUS = [
  "VERIFIED",
  "TESTED",
  "PUBLISHED",
  "PROVEN",
  "INTEGRITY_VALID",
  "REJECTED",
] as const;

export const PROVENANCE = [
  "DEVICE-OBSERVED",
  "OPERATOR-AUTHORED",
  "HARNESS-GENERATED",
  "SYNTHETIC",
] as const;

export const SURFACES = [
  "Plugin-Creator-Studio",
  "STUDI",
  "spreadsheet",
  "Validation-Dashboard",
] as const;

export type Provenance = (typeof PROVENANCE)[number];
export type Surface = (typeof SURFACES)[number];
export type TierTag = "Reality" | "Architecture" | "Hypothesis" | "Vision";
export type ArtefactType =
  | "claim"
  | "model"
  | "learning_submission"
  | "experimental_record"
  | "validation_payload"
  | "plugin";
export type Level = "core" | "field" | "ops";
export type PluginHook =
  | "boot"
  | "store.commit"
  | "evidence.intake"
  | "evidence.stage"
  | "media.ingested"
  | "alert.raised"
  | "audit.flush";

export interface ProducedBy {
  environment: string;
  instance_id: string;
  operator_id: string;
  software_version: string;
}

export interface ProvenanceInfo {
  inputs: string[];
  supersedes: string | null;
}

export interface Integrity {
  digest: string;
}

export interface Envelope {
  envelope_version: string;
  artefact_id: string;
  artefact_type: string;
  produced_by: ProducedBy;
  produced_at: string;
  content: unknown;
  provenance: ProvenanceInfo;
  integrity: Integrity;
  status: string;
  limitations: string[];
  surface?: string;
  provenance_label?: string;
  tier_tag?: string;
}

export interface MakeEnvelopeOpts {
  surface?: string;
  provenance_label?: string;
  tier_tag?: string;
  inputs?: string[];
  supersedes?: string | null;
  limitations?: string[];
  status?: string;
}

// ---- makeEnvelope ----
// The digest is contentHash(canonical(envelope-without-integrity)) — i.e.
// SHA-256 over canonical JSON of a clone with the integrity field deleted.
// A third party holding the file alone can recompute it without Forge.
export function makeEnvelope(
  artefact_type: string,
  content: unknown,
  opts: MakeEnvelopeOpts = {}
): Envelope {
  const env: Envelope = {
    envelope_version: ENVELOPE_VERSION,
    artefact_id: uid("art"),
    artefact_type,
    produced_by: {
      environment: "forge",
      instance_id: "forge-local",
      operator_id: "forge-operator",
      software_version: "1.0.0",
    },
    produced_at: iso(),
    content,
    provenance: { inputs: opts.inputs ?? [], supersedes: opts.supersedes ?? null },
    integrity: { digest: "" },
    status: opts.status ?? "DRAFT",
    limitations: opts.limitations ?? [],
  };
  if (opts.surface) env.surface = opts.surface;
  if (opts.provenance_label) env.provenance_label = opts.provenance_label;
  if (opts.tier_tag) env.tier_tag = opts.tier_tag;
  // Compute the digest over canonical form of envelope WITHOUT integrity.
  const cloneWithoutIntegrity = clone(env);
  delete (cloneWithoutIntegrity as { integrity?: Integrity }).integrity;
  env.integrity.digest = contentHash(cloneWithoutIntegrity);
  return env;
}

export function verifyEnvelope(env: Envelope): {
  matches: boolean;
  recomputed: string;
  stored: string;
} {
  const c = clone(env);
  const stored = env.integrity.digest;
  delete (c as { integrity?: Integrity }).integrity;
  const recomputed = contentHash(c);
  return { matches: stored === recomputed, recomputed, stored };
}

// ============================================================
// Claims — PROPOSED-only enforcement
// ============================================================
export interface Claim {
  claim_id: string;
  claim_text: string;
  status: "PROPOSED";
  tier_tag?: string;
  author: string;
  created_at: string;
  supporting: string[];
}

export interface MakeClaimOpts {
  tier_tag?: string;
  author?: string;
  supporting?: string[];
}

export function makeProposedClaim(
  claim_text: string,
  opts: MakeClaimOpts = {}
): Claim {
  const c: Claim = {
    claim_id: uid("claim"),
    claim_text,
    status: "PROPOSED",
    tier_tag: opts.tier_tag,
    author: opts.author ?? "forge-operator",
    created_at: iso(),
    supporting: opts.supporting ?? [],
  };
  assertProposedOnly(c);
  return c;
}

// assertProposedOnly throws if the claim's status is anything other than PROPOSED.
// Forge cannot write VERIFIED, TESTED, PUBLISHED, PROVEN, INTEGRITY_VALID or REJECTED.
export function assertProposedOnly(claim: { status: string }): void {
  if (claim.status !== "PROPOSED") {
    throw new Error(
      `Forge may only write status PROPOSED, found ${claim.status}`
    );
  }
}

// ============================================================
// FORGE-side state entities (not the envelope itself)
// ============================================================
export interface Plugin {
  plugin_id: string;
  name: string;
  version: string;
  hook: PluginHook;
  description: string;
  enabled: boolean;
  artefact: Envelope; // canonical-hashed envelope of the plugin spec
}

export interface StudiModule {
  module_id: string;
  title: string;
  level: Level;
  mastery: number; // 0-100
  reps: number;
  last_review: number;
  next_review: number;
}

export interface SheetRow {
  row_id: string;
  param: string;
  value: number;
  unit: string;
  note: string;
}

export interface HarnessRun {
  run_id: string;
  seed: string;
  passed: number;
  total: number;
  rate: number; // percent 0-100
  digest: string;
  when: number;
}
