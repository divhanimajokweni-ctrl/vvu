// FIRE store — threats, expectations, auths, runs, counterexamples.
// makeStore-backed, persisted to "fire.vvu.v1". No "use client".
import { makeStore, LogEntry } from "@/vvu/store";
import { uid, iso } from "@/lib/vvu-utils";
import {
  Case, FireBuild, runCase, RunCaseResult, Break,
  coverageStatement, buildCounterexampleDigest, reproSteps,
  ALL_CASES,
} from "./cases";

export type Tier = "Reality" | "Architecture" | "Hypothesis" | "Vision";
export type Provenance = "RETROFITTED" | "REGISTERED" | "PRE-REGISTERED" | "SPEC-ONLY";
export type AuthState = "ACTIVE" | "EXPIRED" | "REVOKED" | "DRAFT";
export type Outcome =
  | "PASSED-UNDER-CONDITIONS" | "FAILED" | "INCONCLUSIVE"
  | "BLOCKED" | "SKIPPED-BY-ASSET-ABSENCE" | "PROVEN"
  | "RETROFITTED" | "PRE-REGISTERED" | "SPEC-ONLY";

export interface Threat {
  threat_id: string;
  target: string;
  capability: string;
  asset: string;
  in_scope: string;
  out_scope: string;
  auth_ref: string;
  provenance: Provenance;
  tier: Tier;
  created: number;
}

export interface Expectation {
  expectation_id: string;
  version: number;
  governs: string;
  expected_ok: boolean;
  expected_check: string;
  statement: string;
  supersedes: string | null;
  runs: number;
  provenance: Provenance;
  tier: Tier;
  created: number;
}

export interface Auth {
  reference: string;
  authoriser: string;
  target: string;
  scope: string;
  valid_from: number;
  valid_until: number;
  status: AuthState;
  tier: Tier;
  created: number;
}

export interface RunCaseRow {
  case_id: string;
  outcome: Outcome;
  detail: string;
  expected_str: string;
  observed_str: string;
  observed_ok?: boolean;
  observed_breaks?: Break[];
}

export interface Run {
  run_id: string;
  target: FireBuild;
  version: string;
  seed: string;
  auth_ref: string | null;
  blocked: "NO_AUTHORISATION" | null;
  cases: RunCaseRow[];
  ran: number;
  passed: number;
  failed: number;
  inconclusive: number;
  skipped: number;
  state: "BLOCKED" | "COMPLETE" | "RUNNING";
  coverage: string;
  when: number;
}

export interface Counterexample {
  cx_id: string;
  run_id: string;
  case_id: string;
  target: FireBuild;
  seed: string;
  expected: string;
  observed: string;
  digest: string;
  repro: string[];
  breaks: Break[];
  when: number;
}

export interface FireState {
  threats: Threat[];
  expectations: Expectation[];
  auths: Auth[];
  runs: Run[];
  counterexamples: Counterexample[];
}

const ENV_KEY = "fire.vvu.v1";

// ============================================================
// Seeded retrofit threats — A1 retrofits THREAT-T1..T5,
// A2 retrofits THREAT-G1..G5.
// ============================================================
const DAY = 86400000;

function initialState(): FireState {
  const now = Date.now();
  const retrofitThreats: Threat[] = [
    { threat_id: "THREAT-T1", target: "honest-v1", capability: "payload tampering", asset: "WORM chain rows", in_scope: "row payload hash", out_scope: "payload truth", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Reality", created: now - 30 * DAY },
    { threat_id: "THREAT-T2", target: "honest-v1", capability: "row deletion", asset: "chain sequence", in_scope: "row seq continuity", out_scope: "payload content", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Reality", created: now - 29 * DAY },
    { threat_id: "THREAT-T3", target: "honest-v1", capability: "row reordering", asset: "chain ordering", in_scope: "seq vs index", out_scope: "row order truth", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Reality", created: now - 28 * DAY },
    { threat_id: "THREAT-T4", target: "honest-v1", capability: "duplicate row insertion", asset: "chain uniqueness", in_scope: "duplicate seq", out_scope: "payload semantics", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Reality", created: now - 27 * DAY },
    { threat_id: "THREAT-T5", target: "honest-v1", capability: "forged prev_hash", asset: "chain linkage", in_scope: "prev_hash binding", out_scope: "external anchoring", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Reality", created: now - 26 * DAY },
    { threat_id: "THREAT-G1", target: "honest-v1", capability: "unsigned artefact", asset: "gate enforcement", in_scope: "signature presence", out_scope: "signature scheme", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Architecture", created: now - 25 * DAY },
    { threat_id: "THREAT-G2", target: "honest-v1", capability: "unregistered signer", asset: "signer registry", in_scope: "signer membership", out_scope: "key derivation", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Architecture", created: now - 24 * DAY },
    { threat_id: "THREAT-G3", target: "honest-v1", capability: "replay", asset: "artefact uniqueness", in_scope: "seen-digest set", out_scope: "artefact content", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Architecture", created: now - 23 * DAY },
    { threat_id: "THREAT-G4", target: "honest-v1", capability: "PII in metadata", asset: "consent boundary", in_scope: "metadata field scan", out_scope: "payload PII", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Architecture", created: now - 22 * DAY },
    { threat_id: "THREAT-G5", target: "honest-v1", capability: "expired authorisation", asset: "auth window", in_scope: "valid_until bound", out_scope: "auth issuance", auth_ref: "AUTH-RETRO", provenance: "RETROFITTED", tier: "Architecture", created: now - 21 * DAY },
  ];
  // Seed one initial expectation so the registry is non-empty.
  const exp: Expectation = {
    expectation_id: "EXP-001", version: 1, governs: "TAMPER-MODIFIED",
    expected_ok: false, expected_check: "PAYLOAD_HASH",
    statement: "Editing a row payload in place must break PAYLOAD_HASH.",
    supersedes: null, runs: 0, provenance: "PRE-REGISTERED", tier: "Reality", created: now - 7 * DAY,
  };
  // Seed one ACTIVE auth for honest-v1 so the Run view opens "Authorised".
  const auth: Auth = {
    reference: "AUTH-0001", authoriser: "vvu-adversarial-lead",
    target: "honest-v1", scope: "all 9 tamper + 9 governance cases",
    valid_from: now - 7 * DAY, valid_until: now + 84 * DAY,
    status: "ACTIVE", tier: "Architecture", created: now - 7 * DAY,
  };
  return { threats: retrofitThreats, expectations: [exp], auths: [auth], runs: [], counterexamples: [] };
}

export const useFire = makeStore<FireState>(ENV_KEY, initialState);

// ============================================================
// findAuthIn — pure; testable without the store
// ============================================================
export function findAuthIn(auths: Auth[], target: string, now: number): Auth | undefined {
  return auths.find((a) =>
    a.target === target &&
    a.status === "ACTIVE" &&
    a.valid_from <= now &&
    a.valid_until >= now,
  );
}
export function findAuth(target: string): Auth | undefined {
  return findAuthIn(useFire.getState().d.auths, target, Date.now());
}

// ============================================================
// executeRun — authorisation-gated adversarial run
// ============================================================
export function executeRun(target: FireBuild, seed: string, caseIds: string[]): Run {
  const st = useFire.getState();
  const auth = findAuth(target);
  const version = target === "honest-v1" ? "1.0.0" : "0.9.0";

  if (!auth) {
    const run: Run = {
      run_id: uid("run"), target, version, seed,
      auth_ref: null, blocked: "NO_AUTHORISATION",
      cases: [], ran: 0, passed: 0, failed: 0, inconclusive: 0, skipped: caseIds.length,
      state: "BLOCKED",
      coverage: coverageStatement(target, 0, caseIds.length, ALL_CASES.length),
      when: Date.now(),
    };
    st.commit("run.blocked", `run ${run.run_id} blocked · no authorisation for ${target}`, (d) => {
      d.runs = [run, ...d.runs];
    });
    return run;
  }

  // Resolve each case id → run
  const cases: RunCaseRow[] = caseIds.map((id) => {
    const c = ALL_CASES.find((cc) => cc.id === id);
    if (!c) return { case_id: id, outcome: "SKIPPED-BY-ASSET-ABSENCE" as Outcome, detail: "case not found in registry", expected_str: "—", observed_str: "—" };
    const r = runCase(c, target, seed);
    return {
      case_id: r.case_id,
      outcome: r.outcome as Outcome,
      detail: r.detail,
      expected_str: r.expected_str,
      observed_str: r.observed_str,
      observed_ok: r.observed_ok,
      observed_breaks: r.observed_breaks,
    };
  });

  const passed = cases.filter((c) => c.outcome === "PASSED-UNDER-CONDITIONS").length;
  const failed = cases.filter((c) => c.outcome === "FAILED").length;
  const inconclusive = cases.filter((c) => c.outcome === "INCONCLUSIVE").length;
  const skipped = cases.filter((c) => c.outcome === "SKIPPED-BY-ASSET-ABSENCE").length;
  const ran = cases.length - skipped;

  const run: Run = {
    run_id: uid("run"), target, version, seed,
    auth_ref: auth.reference, blocked: null,
    cases, ran, passed, failed, inconclusive, skipped,
    state: "COMPLETE",
    coverage: coverageStatement(target, ran, skipped, ALL_CASES.length),
    when: Date.now(),
  };

  // Preserve counterexamples for FAILED cases
  const newCxs: Counterexample[] = cases
    .filter((c) => c.outcome === "FAILED")
    .map((c) => {
      const breaks = c.observed_breaks ?? [];
      return {
        cx_id: uid("cx"),
        run_id: run.run_id,
        case_id: c.case_id,
        target,
        seed,
        expected: c.expected_str,
        observed: c.observed_str,
        digest: buildCounterexampleDigest(run.run_id, c.case_id, target, seed, c.expected_str, c.observed_str, breaks),
        repro: reproSteps(c.case_id, target, seed),
        breaks,
        when: Date.now(),
      };
    });

  st.commit("run.complete", `run ${run.run_id} complete · ${target} · ${passed}/${ran} passed · ${failed} failed · ${newCxs.length} cx`, (d) => {
    d.runs = [run, ...d.runs];
    d.counterexamples = [...newCxs, ...d.counterexamples];
  });
  return run;
}

// ============================================================
// Replay — re-run a stored counterexample's case against a target
// ============================================================
export function replayCx(cx: Counterexample, target: FireBuild): RunCaseRow {
  const c = ALL_CASES.find((cc) => cc.id === cx.case_id);
  if (!c) return { case_id: cx.case_id, outcome: "SKIPPED-BY-ASSET-ABSENCE", detail: "case no longer registered", expected_str: cx.expected, observed_str: "—" };
  const r = runCase(c, target, cx.seed);
  return {
    case_id: r.case_id, outcome: r.outcome as Outcome,
    detail: r.detail, expected_str: r.expected_str, observed_str: r.observed_str,
    observed_ok: r.observed_ok, observed_breaks: r.observed_breaks,
  };
}

// ============================================================
// Mutators — register threats/expectations/auths
// ============================================================
export function registerThreat(t: Omit<Threat, "created" | "provenance" | "tier"> & { provenance?: Provenance; tier?: Tier }): Threat {
  const full: Threat = {
    ...t,
    provenance: t.provenance ?? "REGISTERED",
    tier: t.tier ?? "Reality",
    created: Date.now(),
  };
  useFire.getState().commit("threat.register", `threat ${full.threat_id} registered · ${full.target}`, (d) => {
    d.threats = [full, ...d.threats];
  });
  return full;
}

export function registerExpectation(e: Omit<Expectation, "version" | "supersedes" | "runs" | "provenance" | "tier" | "created"> & { tier?: Tier }): Expectation {
  const st = useFire.getState();
  // immutability: editing an existing expectation creates a new version
  const existing = st.d.expectations.filter((x) => x.expectation_id === e.expectation_id);
  const version = existing.length ? Math.max(...existing.map((x) => x.version)) + 1 : 1;
  const supersedes = existing.length ? `${e.expectation_id} v${version - 1}` : null;
  const full: Expectation = {
    ...e,
    version, supersedes, runs: 0,
    provenance: "PRE-REGISTERED",
    tier: e.tier ?? "Reality",
    created: Date.now(),
  };
  useFire.getState().commit("expectation.register", `expectation ${full.expectation_id} v${full.version} registered · governs ${full.governs}`, (d) => {
    d.expectations = [full, ...d.expectations];
  });
  return full;
}

export function registerAuth(a: Omit<Auth, "status" | "tier" | "created"> & { tier?: Tier }): Auth {
  const full: Auth = {
    ...a,
    status: "ACTIVE",
    tier: a.tier ?? "Architecture",
    created: Date.now(),
  };
  useFire.getState().commit("auth.record", `authorisation ${full.reference} recorded · ${full.target} · ${full.authoriser}`, (d) => {
    d.auths = [full, ...d.auths];
  });
  return full;
}

export function toggleAuth(reference: string): void {
  const st = useFire.getState();
  const a = st.d.auths.find((x) => x.reference === reference);
  if (!a) return;
  if (a.status !== "ACTIVE" && a.status !== "REVOKED") return;
  const next = a.status === "ACTIVE" ? "REVOKED" : "ACTIVE";
  st.commit("auth.toggle", `authorisation ${reference} ${a.status} → ${next}`, (d) => {
    const i = d.auths.findIndex((x) => x.reference === reference);
    if (i >= 0) d.auths[i] = { ...d.auths[i], status: next };
  });
}

// ============================================================
// showReport — full text for the report view
// ============================================================
export function reportText(run: Run): string {
  const lines: string[] = [];
  const bar = "=".repeat(72);
  lines.push(bar);
  lines.push("FIRE TEST REPORT");
  lines.push(bar);
  lines.push(`RUN ID           ${run.run_id}`);
  lines.push(`TARGET           ${run.target}`);
  lines.push(`TARGET DESCRIPTION  adversarial target build; ${run.target === "honest-v1" ? "full verification (every check)" : "verification minus CHAIN_LINKAGE (deliberate hole)"}`);
  lines.push(`TARGET TIER       ${run.target === "honest-v1" ? "Architecture (honest)" : "Hypothesis (vulnerable)"}`);
  lines.push(`SEED             ${run.seed}`);
  lines.push(`ENVIRONMENT       FIRE · VVU-ENV-FIRE-2026-001`);
  lines.push(`STARTED          ${iso(run.when)}`);
  lines.push(`FINISHED         ${iso(run.when + 1000)}`);
  lines.push(`AUTHORISATION    ${run.auth_ref ?? "(refused — no authorisation)"}`);
  lines.push(`PROVENANCE        RETROFITTED`);
  lines.push("");
  lines.push("SCOPE");
  for (const c of run.cases) {
    lines.push(`  · ${c.case_id} — ${ALL_CASES.find((cc) => cc.id === c.case_id)?.desc ?? "(unregistered case)"}`);
  }
  lines.push("");
  lines.push("CASE RESULTS");
  for (const c of run.cases) {
    lines.push(`  [${c.outcome}] ${c.case_id} — ${c.detail}`);
  }
  lines.push("");
  lines.push("COVERAGE STATEMENT");
  lines.push(`  ${run.coverage}`);
  lines.push("");
  lines.push("LIMITATIONS");
  lines.push("  · Fire does not emit PROVEN. PASSED-UNDER-CONDITIONS is the highest outcome Fire may emit.");
  lines.push("  · Counterexamples are the smallest useful reproduction, not a full exploit.");
  lines.push("  · Anchor is a self-declared local stub; external relay is unreachable.");
  if (run.blocked) lines.push(`  · Run was blocked: ${run.blocked}`);
  lines.push("");
  lines.push("COUNTEREXAMPLES PRESERVED");
  if (run.failed === 0) {
    lines.push("  (none — no failed cases on this run)");
  } else {
    const cxs = useFire.getState().d.counterexamples.filter((cx) => cx.run_id === run.run_id);
    for (const cx of cxs) {
      lines.push(`  · ${cx.cx_id} — case ${cx.case_id} · digest ${cx.digest.slice(0, 24)}…`);
    }
  }
  lines.push("");
  lines.push(bar);
  lines.push("END OF REPORT");
  lines.push(bar);
  return lines.join("\n");
}

export const log = (type: string, detail: string) =>
  useFire.getState().commit(type, detail);

export type { LogEntry };
export type { Case };
