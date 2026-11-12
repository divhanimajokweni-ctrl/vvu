// FIRE cases — 9 TAMPER + 9 GOVERNANCE, plus the verify-build wrapper
// and governance check. Pure logic, no React, no "use client".
import { WormChain, ChainRow, SHA256, RNG } from "@/lib/vvu-utils";

export type FireBuild = "honest-v1" | "vulnerable-v0.9";
export const ZERO = "0".repeat(64);

export interface Break { check: string; seq: number; detail: string; }
export interface VerifyResult { ok: boolean; breaks: Break[]; }

// ============================================================
// verifyBuild — honest-v1 runs every check; vulnerable-v0.9
// skips CHAIN_LINKAGE (the deliberate hole). The check names
// are the four Fire vocabularly names: CHAIN_LINKAGE,
// SEQ_CONTINUITY, PAYLOAD_HASH, ROW_DIGEST.
// ============================================================
export function verifyBuild(rows: ChainRow[], build: FireBuild): VerifyResult {
  const breaks: Break[] = [];
  const seenSeq = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // 1. SEQ_CONTINUITY (per-row seq + duplicates)
    if (r.seq !== i) breaks.push({ check: "SEQ_CONTINUITY", seq: i, detail: `expected seq ${i}, got ${r.seq}` });
    if (seenSeq.has(r.seq)) breaks.push({ check: "SEQ_CONTINUITY", seq: i, detail: `duplicate seq ${r.seq} at row ${i}` });
    seenSeq.add(r.seq);

    // 2. CHAIN_LINKAGE (honest only — the vulnerable build skips it)
    const expectedPrev = i === 0 ? ZERO : rows[i - 1].digest;
    if (build === "honest-v1" && r.prev_hash !== expectedPrev) {
      breaks.push({ check: "CHAIN_LINKAGE", seq: i, detail: `prev_hash mismatch at row ${i}` });
    }

    // 3. PAYLOAD_HASH
    if (r.payload_hash !== WormChain.payloadHash(r.payload)) {
      breaks.push({ check: "PAYLOAD_HASH", seq: i, detail: `payload hash mismatch at row ${i}` });
    }

    // 4. ROW_DIGEST
    const recomputed = WormChain.rowDigest({ seq: r.seq, prev_hash: r.prev_hash, payload: r.payload, payload_hash: r.payload_hash });
    if (r.digest !== recomputed) {
      breaks.push({ check: "ROW_DIGEST", seq: i, detail: `row digest mismatch at row ${i}` });
    }
  }
  return { ok: breaks.length === 0, breaks };
}

// ============================================================
// Governance check — N1..N9 refusal rules
// ============================================================
export interface GovEnv {
  signed: boolean;
  signerRegistered: boolean;
  alreadySeen: boolean;
  seq: number;
  expectedSeq: number;
  targetInScope: boolean;
  metadataContainsPII: boolean;
  authExpired: boolean;
  malformed: boolean;
  anchorStubSelfDeclares: boolean;
}

export function checkGovernance(env: GovEnv): "REJECTED" | "ACCEPTED" {
  if (!env.signed) return "REJECTED";              // N1
  if (!env.signerRegistered) return "REJECTED";    // N2
  if (env.alreadySeen) return "REJECTED";          // N3
  if (env.seq < env.expectedSeq) return "REJECTED";// N4
  if (!env.targetInScope) return "REJECTED";       // N5
  if (env.metadataContainsPII) return "REJECTED";  // N6
  if (env.authExpired) return "REJECTED";          // N7
  if (env.malformed) return "REJECTED";            // N8
  if (env.anchorStubSelfDeclares) return "REJECTED";// N9
  return "ACCEPTED";
}

// base "good" envelope — every field valid; each N-case flips one
const GOOD_GOV: GovEnv = {
  signed: true,
  signerRegistered: true,
  alreadySeen: false,
  seq: 5,
  expectedSeq: 5,
  targetInScope: true,
  metadataContainsPII: false,
  authExpired: false,
  malformed: false,
  anchorStubSelfDeclares: false,
};

// ============================================================
// Case types
// ============================================================
export interface TamperCase {
  id: string;
  kind: "tamper";
  group: "TAMPER";
  desc: string;
  retrofit: "A1";
  apply: (rows: ChainRow[]) => void;
  expect: { ok: boolean; check?: string };
}
export interface GovCase {
  id: string;
  kind: "governance";
  group: "GOVERNANCE";
  desc: string;
  retrofit: "A2";
  apply: () => "REJECTED" | "ACCEPTED";
  expect: "REJECTED";
}
export type Case = TamperCase | GovCase;

// ============================================================
// 9 TAMPER cases — each mutates an 8-row chain.
// ============================================================
export const TAMPER_CASES: TamperCase[] = [
  {
    id: "TAMPER-MODIFIED",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Edit the payload of row 3 in place — payload_hash no longer matches the stored payload.",
    apply: (rows) => { rows[3].payload = "TAMPERED|" + rows[3].payload; },
    expect: { ok: false, check: "PAYLOAD_HASH" },
  },
  {
    id: "TAMPER-DELETED",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Splice row 4 out of the chain — every row after it has a seq higher than its new index.",
    apply: (rows) => { rows.splice(4, 1); },
    expect: { ok: false, check: "SEQ_CONTINUITY" },
  },
  {
    id: "TAMPER-REORDERED",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Swap rows 2 and 3 — both rows now have the wrong seq for their position.",
    apply: (rows) => { const t = rows[2]; rows[2] = rows[3]; rows[3] = t; },
    expect: { ok: false, check: "SEQ_CONTINUITY" },
  },
  {
    id: "TAMPER-DUPLICATE",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Insert a clone of row 5 at index 5 — the original row 5 then sits at index 6 with a duplicate seq.",
    apply: (rows) => { rows.splice(5, 0, { ...rows[5] }); },
    expect: { ok: false, check: "SEQ_CONTINUITY" },
  },
  {
    id: "TAMPER-WRONG-PREV",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Forge row 6's prev_hash and recompute its digest so ROW_DIGEST does not also fire — the only honest check that catches it is CHAIN_LINKAGE.",
    apply: (rows) => {
      rows[6].prev_hash = "f".repeat(64);
      rows[6].digest = WormChain.rowDigest({
        seq: rows[6].seq, prev_hash: rows[6].prev_hash,
        payload: rows[6].payload, payload_hash: rows[6].payload_hash,
      });
    },
    expect: { ok: false, check: "CHAIN_LINKAGE" },
  },
  {
    id: "TAMPER-WRONG-SEQ",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Set row 5's seq to 99 — the row's seq no longer matches its position.",
    apply: (rows) => { rows[5].seq = 99; },
    expect: { ok: false, check: "SEQ_CONTINUITY" },
  },
  {
    id: "TAMPER-STALE",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Replay an older, valid chain. No mutation. Control case — verify must return ok=true.",
    apply: () => { /* no mutation — control */ },
    expect: { ok: true },
  },
  {
    id: "TAMPER-CONCURRENT",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Set row 6's seq to 5 — two writers wrote the same sequence number.",
    apply: (rows) => { rows[6].seq = 5; },
    expect: { ok: false, check: "SEQ_CONTINUITY" },
  },
  {
    id: "TAMPER-FORGED-DIGEST",
    kind: "tamper", group: "TAMPER", retrofit: "A1",
    desc: "Replace row 4's digest with a forged value — the digest no longer recomputes from its own fields.",
    apply: (rows) => { rows[4].digest = "0".repeat(64); },
    expect: { ok: false, check: "ROW_DIGEST" },
  },
];

// ============================================================
// 9 GOVERNANCE cases N1..N9 — each flips one bad field
// ============================================================
export const GOV_CASES: GovCase[] = [
  {
    id: "N1", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Unsigned artefact refused — an envelope without a signature is rejected at the gate.",
    apply: () => checkGovernance({ ...GOOD_GOV, signed: false }),
    expect: "REJECTED",
  },
  {
    id: "N2", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Unregistered signer refused — the signer key is not in the registry.",
    apply: () => checkGovernance({ ...GOOD_GOV, signerRegistered: false }),
    expect: "REJECTED",
  },
  {
    id: "N3", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Replayed signed artefact refused — the artefact digest has already been seen.",
    apply: () => checkGovernance({ ...GOOD_GOV, alreadySeen: true }),
    expect: "REJECTED",
  },
  {
    id: "N4", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Sequence regression refused — the supplied seq is lower than the expected next seq.",
    apply: () => checkGovernance({ ...GOOD_GOV, seq: 3, expectedSeq: 5 }),
    expect: "REJECTED",
  },
  {
    id: "N5", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Out-of-scope request refused — the requested target is not in the authorisation scope.",
    apply: () => checkGovernance({ ...GOOD_GOV, targetInScope: false }),
    expect: "REJECTED",
  },
  {
    id: "N6", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "PII in metadata-only path refused — metadata carries personal data on a path not authorised for it.",
    apply: () => checkGovernance({ ...GOOD_GOV, metadataContainsPII: true }),
    expect: "REJECTED",
  },
  {
    id: "N7", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Expired authorisation refused — the bound authorisation's valid-until has passed.",
    apply: () => checkGovernance({ ...GOOD_GOV, authExpired: true }),
    expect: "REJECTED",
  },
  {
    id: "N8", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Malformed envelope refused — required fields missing or unparseable.",
    apply: () => checkGovernance({ ...GOOD_GOV, malformed: true }),
    expect: "REJECTED",
  },
  {
    id: "N9", kind: "governance", group: "GOVERNANCE", retrofit: "A2",
    desc: "Anchor stub self-declares — the anchor is a self-declared stub, not an external relay.",
    apply: () => checkGovernance({ ...GOOD_GOV, anchorStubSelfDeclares: true }),
    expect: "REJECTED",
  },
];

export const ALL_CASES: Case[] = [...TAMPER_CASES, ...GOV_CASES];

export const CASE_DESC: Record<string, string> = Object.fromEntries(
  ALL_CASES.map((c) => [c.id, c.desc]),
);

// ============================================================
// buildChain — 8 deterministic rows from seed + caseId
// ============================================================
export function buildChain(seed: string, caseId: string): WormChain {
  const rng = RNG(seed + ":" + caseId);
  const chain = new WormChain("fire");
  for (let i = 0; i < 8; i++) {
    chain.commit(`row-${i}|rng-${rng.int(1000000)}|${caseId}`);
  }
  return chain;
}

// ============================================================
// runCase — apply a case to a fresh chain, compare to expectation
// ============================================================
export interface RunCaseResult {
  case_id: string;
  outcome: "PASSED-UNDER-CONDITIONS" | "FAILED" | "INCONCLUSIVE" | "BLOCKED" | "SKIPPED-BY-ASSET-ABSENCE" | "RETROFITTED" | "PRE-REGISTERED" | "SPEC-ONLY";
  detail: string;
  observed_ok?: boolean;
  observed_breaks?: Break[];
  expected_str: string;
  observed_str: string;
}

export function runCase(c: Case, target: FireBuild, seed: string): RunCaseResult {
  if (c.kind === "tamper") {
    const chain = buildChain(seed, c.id);
    c.apply(chain.rows);
    const v = verifyBuild(chain.rows, target);
    const expected_str = `ok=${c.expect.ok}${c.expect.check ? " · check=" + c.expect.check : ""}`;
    const observed_str = `ok=${v.ok}${v.breaks.length ? " · breaks=" + v.breaks.map((b) => b.check + "@row" + b.seq).join(",") : " · breaks=none"}`;

    if (c.expect.ok === true) {
      // Control case — must verify ok
      if (v.ok) return { case_id: c.id, outcome: "PASSED-UNDER-CONDITIONS", detail: "valid chain verified ok (control)", observed_ok: v.ok, observed_breaks: v.breaks, expected_str, observed_str };
      return { case_id: c.id, outcome: "FAILED", detail: `expected ok=true but verify found ${v.breaks.length} break(s)`, observed_ok: v.ok, observed_breaks: v.breaks, expected_str, observed_str };
    }
    // expect.ok === false
    if (v.ok) {
      // Tamper NOT detected on this build → FAILED (preserve counterexample)
      return { case_id: c.id, outcome: "FAILED", detail: `tamper NOT detected on ${target}; verifier returned ok=true — expected ${c.expect.check}`, observed_ok: v.ok, observed_breaks: v.breaks, expected_str, observed_str };
    }
    const ec = c.expect.check;
    if (ec && v.breaks.some((b) => b.check === ec)) {
      const hit = v.breaks.find((b) => b.check === ec)!;
      return { case_id: c.id, outcome: "PASSED-UNDER-CONDITIONS", detail: `tamper detected — ${ec}@row${hit.seq}: ${hit.detail}`, observed_ok: v.ok, observed_breaks: v.breaks, expected_str, observed_str };
    }
    // Detected but by an unexpected check
    return { case_id: c.id, outcome: "INCONCLUSIVE", detail: `tamper detected but by ${v.breaks[0].check}@row${v.breaks[0].seq}; expected ${ec}`, observed_ok: v.ok, observed_breaks: v.breaks, expected_str, observed_str };
  }

  // governance
  const verdict = c.apply();
  const expected_str = c.expect;
  const observed_str = verdict;
  if (verdict === c.expect) {
    return { case_id: c.id, outcome: "PASSED-UNDER-CONDITIONS", detail: `${c.id}: governance returned ${verdict}`, expected_str, observed_str };
  }
  return { case_id: c.id, outcome: "FAILED", detail: `${c.id}: governance returned ${verdict}, expected ${c.expect}`, expected_str, observed_str };
}

// ============================================================
// Coverage statement — what was actually claimed
// ============================================================
export function coverageStatement(target: FireBuild, ran: number, skipped: number, total: number): string {
  return `Coverage: ${ran} of ${total} cases executed against ${target} (v${target === "honest-v1" ? "1.0.0" : "0.9.0"}). Skipped: ${skipped}. Fire does not emit PROVEN.`;
}

// ============================================================
// buildCounterexample — smallest reproducible failure
// ============================================================
export function buildCounterexampleDigest(
  runId: string, caseId: string, target: FireBuild, seed: string,
  expected: string, observed: string, breaks: Break[],
): string {
  return "sha256:" + SHA256.hexOf(
    [runId, caseId, target, seed, expected, observed, breaks.map((b) => `${b.check}@${b.seq}`).join("|")].join("·"),
  );
}

export function reproSteps(caseId: string, target: FireBuild, seed: string): string[] {
  const c = ALL_CASES.find((cc) => cc.id === caseId);
  if (!c) return [`unknown case ${caseId}`];
  if (c.kind === "tamper") {
    return [
      `1. construct WormChain("fire") and commit 8 rows from RNG(${seed}:${caseId})`,
      `2. apply ${caseId} mutation: ${c.desc}`,
      `3. call verifyBuild(rows, "${target}") — honest-v1 runs every check; vulnerable-v0.9 skips CHAIN_LINKAGE`,
      `4. compare to expectation: ok=${c.expect.ok}${c.expect.check ? ", check=" + c.expect.check : ""}`,
      `5. if mismatch → counterexample preserved with the stored seed and case id`,
    ];
  }
  return [
    `1. construct governance envelope with the ${caseId} bad-field flipped`,
    `2. call checkGovernance(envelope)`,
    `3. compare to expectation: ${c.expect}`,
  ];
}
