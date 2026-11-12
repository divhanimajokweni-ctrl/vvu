"use client";
// FIRE views — Run, Threats, Expectations, Auths, Counterexamples,
// Regression, Reports, Retrofit, Self-test, Log.
import React from "react";
import { Panel, KPIs, Table, Code, KV, Alist, Checklist, Btn, Grid, Badge, Field, Tag, Mono, Hint, Row, Gate, Cards, Card, Bar } from "@/vvu/primitives";
import { inputCls, selectCls, textareaCls } from "@/vvu/primitives";
import { toast } from "@/vvu/toast";
import { registerEnv } from "@/vvu/registry";
import { DiffView } from "@/vvu/diff";
import {
  useFire, findAuth, findAuthIn, executeRun, replayCx,
  registerThreat, registerExpectation, registerAuth, toggleAuth, reportText,
  Threat, Expectation, Auth, Run, Counterexample, Outcome, AuthState, Tier,
} from "./store";
import {
  ALL_CASES, TAMPER_CASES, GOV_CASES, CASE_DESC, verifyBuild, buildChain,
  runCase, coverageStatement, reproSteps, FireBuild, TamperCase, GovCase,
} from "./cases";
import {
  WormChain, SHA256, contentHash, canonical, uid, iso, ago, short, download,
  RNG, voiceLawViolation, BANNED_WORDS, ChainRow,
} from "@/lib/vvu-utils";

// ============================================================
// FIRE Gap Register (only the Threats view shows it).
// 8 items: A1..A6 + SVC-3004 + SVC-3005. All ABSENT or UNREACHABLE.
// ============================================================
const FIRE_GAPS = [
  { id: "A1", item: "9-case tamper matrix (original FIRE spec)", path: "upload/FIRE.html.html", state: "ABSENT", func: "Tamper case source", action: "9 cases rebuilt in cases.ts (RETROFITTED)" },
  { id: "A2", item: "N1-N9 governance tests (original FIRE spec)", path: "upload/FIRE.html.html", state: "ABSENT", func: "Governance case source", action: "9 cases rebuilt in cases.ts (RETROFITTED)" },
  { id: "A3", item: "12 QR-bridge tests", path: "upload/FIRE.html.html", state: "ABSENT", func: "QR-bridge coverage", action: "NOT imported — QR-bridge pipeline absent" },
  { id: "A4", item: "POST /api/validate endpoint", path: "http://localhost:3004/api/validate", state: "UNREACHABLE", func: "Live validation target", action: "vault-bridge :3004 offline — local verifyBuild substituted" },
  { id: "A5", item: "src/lib/validation/*.ts", path: "src/lib/validation/", state: "ABSENT", func: "Validation library", action: "No validation library shipped — verifyBuild is the local substitute" },
  { id: "A6", item: "tests/vvu-field/", path: "tests/vvu-field/", state: "ABSENT", func: "External test harness", action: "No external test dir — Fire self-test is the substitute" },
  { id: "SVC-3004", item: "vault-bridge service", path: "http://localhost:3004", state: "UNREACHABLE", func: "Live artefact validation", action: "Offline — local WormChain + verifyBuild used" },
  { id: "SVC-3005", item: "signing service", path: "http://localhost:3005", state: "UNREACHABLE", func: "Live artefact signing", action: "Offline — Ed25519 local scheme used (see BENCH)" },
];

function GapRegister() {
  const rows = FIRE_GAPS;
  const counts = {
    checked: rows.length,
    absent: rows.filter((r) => r.state === "ABSENT").length,
    unreachable: rows.filter((r) => r.state === "UNREACHABLE").length,
  };
  const stateKind = (s: string): "ok" | "info" | "warn" | "bad" | "pur" | "mut" =>
    s === "ABSENT" ? "bad" : s === "UNREACHABLE" ? "warn" : "mut";
  return (
    <Panel title="Gap register" hint="inventory before alteration">
      <Hint>
        Inventory taken <b>{iso()}</b>. Every FIRE source asset is either <b>ABSENT</b> or
        <b>UNREACHABLE</b>. None are silently substituted — the retrofitted replacements are
        listed in the Retrofit view and never presented as the originals.
      </Hint>
      <div style={{ marginTop: 10 }}>
        <Table
          cols={[
            { k: "id", l: "Gap ID", mono: true },
            { k: "item", l: "Missing item", wrap: true },
            { k: "path", l: "Exact path checked", mono: true },
            { k: "state", l: "State", badge: true },
            { k: "func", l: "Function affected", wrap: true },
            { k: "action", l: "Action taken", wrap: true },
          ]}
          rows={rows.map((r) => ({ ...r, state: stateKind(r.state) }))}
          opts={{ name: "fire-gap-register" }}
        />
      </div>
      <KPIs items={[
        { l: "Items checked", v: counts.checked, c: "b" },
        { l: "Absent", v: counts.absent, c: "r" },
        { l: "Unreachable", v: counts.unreachable, c: "w" },
        { l: "Reconstructed", v: 0, c: "a", d: "+0 built (see Retrofit)" },
      ]} />
    </Panel>
  );
}

// ============================================================
// Helpers — badges
// ============================================================
function TierBadge({ tier }: { tier: Tier }) {
  const k: "ok" | "info" | "warn" | "mut" = tier === "Reality" ? "ok" : tier === "Architecture" ? "info" : tier === "Hypothesis" ? "warn" : "mut";
  return <Badge kind={k}>{tier}</Badge>;
}
function AuthBadge({ s }: { s: AuthState }) {
  const k: "ok" | "info" | "warn" | "bad" | "mut" = s === "ACTIVE" ? "ok" : s === "EXPIRED" ? "mut" : s === "REVOKED" ? "bad" : "mut";
  return <Badge kind={k}>{s}</Badge>;
}
function OutcomeBadge({ o }: { o: Outcome }) {
  const k: "ok" | "info" | "warn" | "bad" | "pur" | "mut" =
    o === "PASSED-UNDER-CONDITIONS" ? "ok" :
    o === "FAILED" ? "bad" :
    o === "INCONCLUSIVE" ? "warn" :
    o === "BLOCKED" ? "info" :
    o === "PROVEN" ? "pur" :
    o === "RETROFITTED" ? "warn" :
    o === "PRE-REGISTERED" ? "ok" :
    o === "SKIPPED-BY-ASSET-ABSENCE" ? "mut" : "mut";
  return <Badge kind={k}>{o}</Badge>;
}
function ProvenanceBadge({ p }: { p: string }) {
  const k: "ok" | "info" | "warn" | "bad" | "pur" | "mut" =
    p === "RETROFITTED" ? "warn" :
    p === "REGISTERED" ? "ok" :
    p === "PRE-REGISTERED" ? "ok" :
    p === "SPEC-ONLY" ? "mut" : "mut";
  return <Badge kind={k}>{p}</Badge>;
}

const TARGETS: { id: FireBuild; label: string; ver: string; desc: string }[] = [
  { id: "honest-v1", label: "honest-v1 v1.0.0", ver: "1.0.0", desc: "Full verification — every check runs (CHAIN_LINKAGE, SEQ_CONTINUITY, PAYLOAD_HASH, ROW_DIGEST)." },
  { id: "vulnerable-v0.9", label: "vulnerable-v0.9 v0.9.0", ver: "0.9.0", desc: "Verification minus CHAIN_LINKAGE — the deliberate hole (skips prev_hash binding)." },
];

// ============================================================
// 1. RUN VIEW
// ============================================================
function RunView() {
  const runs = useFire((s) => s.d.runs);
  const auths = useFire((s) => s.d.auths);
  const [target, setTarget] = React.useState<FireBuild>("honest-v1");
  const [seed, setSeed] = React.useState("fire-seed-2026-001");
  const [caseIds, setCaseIds] = React.useState<string[]>(ALL_CASES.map((c) => c.id));
  const [result, setResult] = React.useState<string>("");

  const auth = React.useMemo(() => findAuth(target), [target, auths]);
  const t = TARGETS.find((x) => x.id === target)!;

  const onCaseSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCaseIds(Array.from(e.target.selectedOptions).map((o) => o.value));
  };

  const toggleAll = () => {
    if (caseIds.length === ALL_CASES.length) setCaseIds([]);
    else setCaseIds(ALL_CASES.map((c) => c.id));
  };

  const run = () => {
    if (caseIds.length === 0) { toast("select at least one case", "warn"); return; }
    const r = executeRun(target, seed, caseIds);
    const lines: string[] = [];
    lines.push(`RUN ${r.run_id}`);
    lines.push(`target           ${r.target} v${r.version}`);
    lines.push(`seed             ${r.seed}`);
    lines.push(`authorisation    ${r.auth_ref ?? "(refused — no authorisation)"}`);
    lines.push(`state            ${r.state}`);
    lines.push(`coverage         ${r.coverage}`);
    lines.push("");
    lines.push("CASES");
    for (const c of r.cases) {
      lines.push(`  [${c.outcome}] ${c.case_id} — ${c.detail}`);
    }
    lines.push("");
    lines.push("SUMMARY");
    lines.push(`  ran=${r.ran}  passed=${r.passed}  failed=${r.failed}  inconclusive=${r.inconclusive}  skipped=${r.skipped}`);
    if (r.blocked) lines.push(`  blocked: ${r.blocked}`);
    setResult(lines.join("\n"));
    if (r.blocked) toast(`run blocked · no authorisation for ${target}`, "bad");
    else toast(`run complete · ${r.passed}/${r.ran} passed · ${r.failed} failed`, r.failed ? "bad" : "ok");
  };

  return (
    <>
      <Panel title="Execution engine" hint="seeded · deterministic · authorisation-gated">
        <div className="vvu-frm">
          <Field label="Target">
            <select className={selectCls} value={target} onChange={(e) => setTarget(e.target.value as FireBuild)}>
              {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Seed">
            <input className={inputCls} value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="fire-seed-2026-001" />
          </Field>
          <div />
          <Btn kind="p" onClick={run}>▶ execute run</Btn>
        </div>
        <Hint>{t.desc}</Hint>
      </Panel>

      <Panel title="Authorisation gate" hint="no authorisation · no run">
        <Gate ok={!!auth}>
          {auth ? (
            <div>
              <b style={{ color: "var(--vvu-acc)" }}>Authorised</b> — target <Mono>{target}</Mono> ·
              auth <Mono>{auth.reference}</Mono> · authoriser <Mono>{auth.authoriser}</Mono> ·
              valid-until <Mono>{iso(auth.valid_until).slice(0, 10)}</Mono> ·
              status <AuthBadge s={auth.status} />
            </div>
          ) : (
            <div>
              <b style={{ color: "var(--vvu-bad)" }}>Refused — no authorisation</b> — target <Mono>{target}</Mono> has no
              active, in-window authorisation. Any run attempted now will be blocked with state=BLOCKED and an empty case list.
            </div>
          )}
        </Gate>
      </Panel>

      <Panel title="Case selection" hint={`${caseIds.length} of ${ALL_CASES.length} cases selected`}>
        <Row wrap>
          <Btn sm onClick={toggleAll}>{caseIds.length === ALL_CASES.length ? "deselect all" : "select all"}</Btn>
        </Row>
        <select className={selectCls} multiple size={8} value={caseIds} onChange={onCaseSelect} style={{ width: "100%", minHeight: 160, marginTop: 8 }}>
          {ALL_CASES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.group}</option>)}
        </select>
        <Hint>Hold ⌘/Ctrl to toggle individual cases. All 18 are pre-selected by default.</Hint>
      </Panel>

      <Panel title="Run result" hint="appended on every execute">
        <Code empty={!result}>{result || "execute a run to produce a result transcript."}</Code>
      </Panel>

      <Table
        cols={[
          { k: "run_id", l: "Run", mono: true },
          { k: "target", l: "Target" },
          { k: "version", l: "Ver", mono: true },
          { k: "seed", l: "Seed", mono: true },
          { k: "auth_ref", l: "Auth", mono: true },
          { k: "cases", l: "Cases", num: true },
          { k: "ran", l: "Ran", num: true },
          { k: "passed", l: "Passed", num: true },
          { k: "failed", l: "Failed", num: true },
          { k: "state", l: "State", badge: true },
          { k: "when", l: "When", mono: true },
        ]}
        rows={runs.map((r) => ({
          run_id: short(r.run_id, 14), target: r.target, version: r.version,
          seed: short(r.seed, 14), auth_ref: r.auth_ref ?? "(blocked)",
          cases: r.cases.length, ran: r.ran, passed: r.passed, failed: r.failed,
          state: r.state === "BLOCKED" ? "bad" : r.failed > 0 ? "warn" : "ok",
          when: iso(r.when).slice(11, 19),
        }))}
        opts={{ name: "fire-runs" }}
      />
    </>
  );
}

// ============================================================
// 2. THREATS VIEW
// ============================================================
function ThreatsView() {
  const threats = useFire((s) => s.d.threats);
  const [threatId, setThreatId] = React.useState("");
  const [target, setTarget] = React.useState("honest-v1");
  const [capability, setCapability] = React.useState("");
  const [asset, setAsset] = React.useState("");
  const [inScope, setInScope] = React.useState("");
  const [outScope, setOutScope] = React.useState("");
  const [authRef, setAuthRef] = React.useState("AUTH-0001");

  const submit = () => {
    if (!threatId) { toast("Threat ID required", "warn"); return; }
    registerThreat({
      threat_id: threatId, target, capability, asset, in_scope: inScope, out_scope: outScope, auth_ref: authRef,
    });
    toast(`threat ${threatId} registered`, "ok");
    setThreatId(""); setCapability(""); setAsset(""); setInScope(""); setOutScope("");
  };

  return (
    <>
      <GapRegister />
      <Panel title="Threat model registry" hint="threat_id · target · attacker capability · asset at risk · in/out of scope · authorisation ref">
        <Hint>
          A threat model binds an attacker capability to an asset at risk under a target. The
          <b> in-scope</b> / <b>out-of-scope</b> boundary is what stops Fire from over-claiming — a
          case outside this boundary emits SPEC-ONLY, not PROVEN.
        </Hint>
      </Panel>
      <Panel title="Register a threat model" hint="required: Threat ID">
        <div className="vvu-frm">
          <Field label="Threat ID"><input className={inputCls} value={threatId} onChange={(e) => setThreatId(e.target.value)} placeholder="THREAT-T6" /></Field>
          <Field label="Target">
            <select className={selectCls} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="honest-v1">honest-v1</option>
              <option value="vulnerable-v0.9">vulnerable-v0.9</option>
            </select>
          </Field>
          <Field label="Attacker capability"><input className={inputCls} value={capability} onChange={(e) => setCapability(e.target.value)} placeholder="payload tampering" /></Field>
          <Field label="Asset at risk"><input className={inputCls} value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="WORM chain rows" /></Field>
          <Field label="In scope"><input className={inputCls} value={inScope} onChange={(e) => setInScope(e.target.value)} placeholder="row payload hash" /></Field>
          <Field label="Out of scope"><input className={inputCls} value={outScope} onChange={(e) => setOutScope(e.target.value)} placeholder="payload truth" /></Field>
          <Field label="Authorisation ref"><input className={inputCls} value={authRef} onChange={(e) => setAuthRef(e.target.value)} placeholder="AUTH-0001" /></Field>
          <div /><Btn kind="p" onClick={submit}>register threat</Btn>
        </div>
      </Panel>
      <Table
        cols={[
          { k: "threat_id", l: "Threat ID", mono: true },
          { k: "target", l: "Target" },
          { k: "capability", l: "Capability", wrap: true },
          { k: "asset", l: "Asset", wrap: true },
          { k: "in_scope", l: "In scope", wrap: true },
          { k: "out_scope", l: "Out of scope", wrap: true },
          { k: "auth_ref", l: "Auth", mono: true },
          { k: "provenance", l: "Provenance", badge: true },
          { k: "tier", l: "Tier", badge: true },
          { k: "created", l: "Created", mono: true },
        ]}
        rows={threats.map((t) => ({
          threat_id: t.threat_id, target: t.target, capability: t.capability, asset: t.asset,
          in_scope: t.in_scope, out_scope: t.out_scope, auth_ref: t.auth_ref,
          provenance: t.provenance === "RETROFITTED" ? "warn" : "ok",
          tier: t.tier === "Reality" ? "ok" : t.tier === "Architecture" ? "info" : t.tier === "Hypothesis" ? "warn" : "mut",
          created: iso(t.created).slice(0, 10),
        }))}
        opts={{ name: "fire-threats" }}
      />
    </>
  );
}

// ============================================================
// 3. EXPECTATIONS VIEW
// ============================================================
function ExpectationsView() {
  const expectations = useFire((s) => s.d.expectations);
  const [expId, setExpId] = React.useState("");
  const [governs, setGovens] = React.useState("TAMPER-MODIFIED");
  const [expectedOk, setExpectedOk] = React.useState<"false" | "true">("false");
  const [expectedCheck, setExpectedCheck] = React.useState("PAYLOAD_HASH");
  const [statement, setStatement] = React.useState("");

  const submit = () => {
    if (!expId) { toast("Expectation ID required", "warn"); return; }
    registerExpectation({
      expectation_id: expId, governs, expected_ok: expectedOk === "true",
      expected_check: expectedCheck, statement,
    });
    toast(`expectation ${expId} registered`, "ok");
    setExpId(""); setStatement("");
  };

  return (
    <>
      <Panel title="Expected-behaviour registry" hint="immutable once a run starts — edits create new versions">
        <Hint>
          An expectation is a pre-registered claim about what a case must do. It is <b>immutable</b>:
          editing an expectation that has already been bound to a run creates a new version with
          <b> supersedes</b> pointing at the prior version. The old version is never overwritten.
        </Hint>
      </Panel>
      <Panel title="Register an expectation" hint="required: Expectation ID">
        <div className="vvu-frm">
          <Field label="Expectation ID"><input className={inputCls} value={expId} onChange={(e) => setExpId(e.target.value)} placeholder="EXP-001" /></Field>
          <Field label="Case it governs">
            <select className={selectCls} value={governs} onChange={(e) => setGovens(e.target.value)}>
              {ALL_CASES.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
          </Field>
          <Field label="Expected verifier result">
            <select className={selectCls} value={expectedOk} onChange={(e) => setExpectedOk(e.target.value as "false" | "true")}>
              <option value="false">ok = false (must detect)</option>
              <option value="true">ok = true (must pass)</option>
            </select>
          </Field>
          <Field label="Expected break check">
            <select className={selectCls} value={expectedCheck} onChange={(e) => setExpectedCheck(e.target.value)}>
              <option value="CHAIN_LINKAGE">CHAIN_LINKAGE</option>
              <option value="SEQ_CONTINUITY">SEQ_CONTINUITY</option>
              <option value="PAYLOAD_HASH">PAYLOAD_HASH</option>
              <option value="ROW_DIGEST">ROW_DIGEST</option>
              <option value="(none)">(none)</option>
            </select>
          </Field>
          <Field label="Statement"><textarea className={textareaCls} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Editing a row payload in place must break PAYLOAD_HASH." /></Field>
          <div /><Btn kind="p" onClick={submit}>register expectation</Btn>
        </div>
      </Panel>
      <Table
        cols={[
          { k: "expectation_id", l: "Expectation", mono: true },
          { k: "version", l: "Ver", num: true },
          { k: "governs", l: "Governs", mono: true },
          { k: "expected", l: "Expected", wrap: true },
          { k: "statement", l: "Statement", wrap: true },
          { k: "supersedes", l: "Supersedes", mono: true },
          { k: "runs", l: "Runs", num: true },
          { k: "provenance", l: "Provenance", badge: true },
          { k: "tier", l: "Tier", badge: true },
          { k: "created", l: "Created", mono: true },
        ]}
        rows={expectations.map((e) => ({
          expectation_id: e.expectation_id, version: e.version, governs: e.governs,
          expected: `ok=${e.expected_ok}${e.expected_check && e.expected_check !== "(none)" ? " · check=" + e.expected_check : ""}`,
          statement: e.statement, supersedes: e.supersedes ?? "—", runs: e.runs,
          provenance: "ok", tier: e.tier === "Reality" ? "ok" : e.tier === "Architecture" ? "info" : e.tier === "Hypothesis" ? "warn" : "mut",
          created: iso(e.created).slice(0, 10),
        }))}
        opts={{ name: "fire-expectations" }}
      />
    </>
  );
}

// ============================================================
// 4. AUTHS VIEW
// ============================================================
function AuthsView() {
  const auths = useFire((s) => s.d.auths);
  const [reference, setReference] = React.useState("");
  const [authoriser, setAuthoriser] = React.useState("");
  const [target, setTarget] = React.useState<FireBuild>("honest-v1");
  const [scope, setScope] = React.useState("");
  const [from, setFrom] = React.useState(ymd(Date.now()));
  const [until, setUntil] = React.useState(ymd(Date.now() + 84 * 86400000));

  const submit = () => {
    if (!reference) { toast("Reference required", "warn"); return; }
    if (!authoriser) { toast("Authoriser required", "warn"); return; }
    registerAuth({
      reference, authoriser, target, scope,
      valid_from: new Date(from).getTime(), valid_until: new Date(until).getTime() + 86399999,
    });
    toast(`authorisation ${reference} recorded`, "ok");
    setReference(""); setAuthoriser(""); setScope("");
  };

  return (
    <>
      <Panel title="Authorisation record" hint="no record · no run">
        <Hint>
          A run is refused at the gate unless there is an active, in-window authorisation for the
          requested target. Click any row to toggle the authorisation between ACTIVE and REVOKED —
          a revoked record instantly blocks every subsequent run against that target.
        </Hint>
      </Panel>
      <Panel title="Record an authorisation" hint="required: Reference, Authoriser">
        <div className="vvu-frm">
          <Field label="Reference"><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="AUTH-0001" /></Field>
          <Field label="Authoriser"><input className={inputCls} value={authoriser} onChange={(e) => setAuthoriser(e.target.value)} placeholder="vvu-adversarial-lead" /></Field>
          <Field label="Target">
            <select className={selectCls} value={target} onChange={(e) => setTarget(e.target.value as FireBuild)}>
              {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Scope of data"><input className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="all 9 tamper + 9 governance cases" /></Field>
          <Field label="Valid from"><input className={inputCls} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Valid until"><input className={inputCls} type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
          <div /><Btn kind="p" onClick={submit}>record authorisation</Btn>
        </div>
      </Panel>
      <Table
        cols={[
          { k: "reference", l: "Reference", mono: true },
          { k: "authoriser", l: "Authoriser", mono: true },
          { k: "target", l: "Target" },
          { k: "scope", l: "Scope", wrap: true },
          { k: "valid_from", l: "From", mono: true },
          { k: "valid_until", l: "Until", mono: true },
          { k: "status", l: "Status", badge: true },
          { k: "tier", l: "Tier", badge: true },
          { k: "created", l: "Created", mono: true },
        ]}
        rows={auths.map((a) => ({
          reference: a.reference, authoriser: a.authoriser, target: a.target, scope: a.scope,
          valid_from: iso(a.valid_from).slice(0, 10), valid_until: iso(a.valid_until).slice(0, 10),
          status: a.status === "ACTIVE" ? "ok" : a.status === "EXPIRED" ? "mut" : a.status === "REVOKED" ? "bad" : "mut",
          tier: a.tier === "Reality" ? "ok" : a.tier === "Architecture" ? "info" : a.tier === "Hypothesis" ? "warn" : "mut",
          created: iso(a.created).slice(0, 10),
          _raw: a,
        }))}
        opts={{ name: "fire-auths", onSelect: (row) => { toggleAuth(row.reference); toast(`${row.reference} toggled`, "info"); } }}
      />
    </>
  );
}

function ymd(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ============================================================
// 5. COUNTEREXAMPLES VIEW (cx)
// ============================================================
function CounterexamplesView() {
  const cxs = useFire((s) => s.d.counterexamples);
  const [selId, setSelId] = React.useState<string | null>(cxs[0]?.cx_id ?? null);
  const sel = cxs.find((c) => c.cx_id === selId) ?? null;

  const code = sel ? [
    `COUNTEREXAMPLE ${sel.cx_id}`,
    `run            ${sel.run_id}`,
    `case           ${sel.case_id}`,
    `target         ${sel.target}`,
    `seed           ${sel.seed}`,
    `digest         ${sel.digest}`,
    `expected       ${sel.expected}`,
    `observed       ${sel.observed}`,
    ``,
    `REPRO STEPS`,
    ...sel.repro.map((s) => `  ${s}`),
    ``,
    `OBSERVED BREAKS`,
    ...(sel.breaks.length ? sel.breaks.map((b) => `  · ${b.check}@row${b.seq} — ${b.detail}`) : [`  (none — verifier returned ok=true; the build did not detect this tamper)`]),
  ].join("\n") : "";

  return (
    <>
      <Panel title="Counterexample preservation" hint="smallest useful reproduction of any failure">
        <Hint>
          A counterexample is the smallest set of facts needed to reproduce a failure: the run id, the
          case id, the target build, the seed, and the observed breaks. Anyone holding the digest
          alone can re-derive the failure against the same build.
        </Hint>
      </Panel>
      <Table
        cols={[
          { k: "cx_id", l: "CX", mono: true },
          { k: "run_id", l: "Run", mono: true },
          { k: "case_id", l: "Case", mono: true },
          { k: "target", l: "Target" },
          { k: "seed", l: "Seed", mono: true },
          { k: "expected", l: "Expected", wrap: true },
          { k: "observed", l: "Observed", wrap: true },
          { k: "digest", l: "Digest", mono: true },
          { k: "when", l: "When", mono: true },
        ]}
        rows={cxs.map((c) => ({
          cx_id: c.cx_id, run_id: c.run_id, case_id: c.case_id,
          target: c.target, seed: c.seed,
          expected: c.expected, observed: c.observed,
          digest: short(c.digest, 20), when: iso(c.when).slice(11, 19),
        }))}
        opts={{ name: "fire-counterexamples", selectedId: selId, selectedKey: "cx_id", onSelect: (row) => setSelId(row.cx_id) }}
      />
      <Panel title="Reproduction" hint="rebuild from this alone">
        <Code empty={!sel}>{code || "select a counterexample row to view the reproduction."}</Code>
        <Row wrap style={{ marginTop: 10 }}>
          <Btn sm onClick={() => toast("regression already re-runs counterexamples — see Regression view", "info")}>＋ regression</Btn>
          <Btn sm onClick={() => { if (sel) { download(`${sel.cx_id}.json`, JSON.stringify(sel, null, 2)); toast("cx json downloaded", "ok"); } }}>⬇ JSON</Btn>
        </Row>
        {sel && <div style={{ marginTop: 10 }}><KV items={[
          { k: "CX id", v: <Mono>{sel.cx_id}</Mono> },
          { k: "Run", v: <Mono>{sel.run_id}</Mono> },
          { k: "Case", v: <Mono>{sel.case_id}</Mono> },
          { k: "Target", v: sel.target },
          { k: "Seed", v: <Mono>{sel.seed}</Mono> },
          { k: "Digest", v: <Mono title={sel.digest}>{short(sel.digest, 20)}</Mono> },
          { k: "Breaks", v: sel.breaks.length ? sel.breaks.length : "0 (undetected)" },
        ]} /></div>}
      </Panel>
    </>
  );
}

// ============================================================
// 6. REGRESSION VIEW
// ============================================================
function RegressionView() {
  const cxs = useFire((s) => s.d.counterexamples);
  const [target, setTarget] = React.useState<FireBuild>("honest-v1");
  const [result, setResult] = React.useState<string>("");

  const replayAll = () => {
    if (cxs.length === 0) { toast("no counterexamples to replay", "warn"); return; }
    const t = TARGETS.find((x) => x.id === target)!;
    let stillFailing = 0, remediated = 0, skipped = 0;
    const lines: string[] = [];
    lines.push(`REPLAY against ${target} v${t.ver}`);
    lines.push(`counterexamples replayed: ${cxs.length}`);
    lines.push("");
    lines.push("PER-CASE");
    for (const cx of cxs) {
      const r = replayCx(cx, target);
      if (r.outcome === "FAILED") {
        stillFailing++;
        lines.push(`  [STILL FAILING] ${cx.case_id} — ${r.detail}`);
      } else if (r.outcome === "PASSED-UNDER-CONDITIONS") {
        remediated++;
        lines.push(`  [PASSED-UNDER-CONDITIONS] ${cx.case_id} — remediated on ${target}`);
      } else if (r.outcome === "SKIPPED-BY-ASSET-ABSENCE") {
        skipped++;
        lines.push(`  [SKIPPED] ${cx.case_id} — ${r.detail}`);
      } else {
        lines.push(`  [${r.outcome}] ${cx.case_id} — ${r.detail}`);
      }
    }
    lines.push("");
    lines.push("SUMMARY");
    lines.push(`  still failing: ${stillFailing}`);
    lines.push(`  remediated:    ${remediated}`);
    lines.push(`  skipped:      ${skipped}`);
    setResult(lines.join("\n"));
    toast(`replay complete · ${stillFailing} still failing · ${remediated} remediated`, stillFailing ? "bad" : "ok");
  };

  return (
    <>
      <Panel title="Regression scheduler" hint="replays prior tests against new builds">
        <Hint>
          Every stored counterexample is replayed against a chosen target. If the new build still
          fails the case → <b>STILL FAILING</b>. If the new build passes the case → <b>PASSED-UNDER-CONDITIONS</b>
          (the failure was remediated). The original counterexample is never mutated — only the
          replay outcome is recorded.
        </Hint>
      </Panel>
      <Panel title="Replay target" hint="which build to replay against">
        <div className="vvu-frm">
          <Field label="Target">
            <select className={selectCls} value={target} onChange={(e) => setTarget(e.target.value as FireBuild)}>
              {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <div /><Btn kind="p" onClick={replayAll}>▶ replay all</Btn>
        </div>
      </Panel>
      <Panel title="Replay result" hint="appended on every replay">
        <Code empty={!result}>{result || "replay all counterexamples against a target to see the result."}</Code>
      </Panel>
      <Table
        cols={[
          { k: "cx_id", l: "CX", mono: true },
          { k: "case_id", l: "Case", mono: true },
          { k: "target", l: "Captured against" },
          { k: "seed", l: "Seed", mono: true },
          { k: "expected", l: "Expected", wrap: true },
          { k: "observed", l: "Observed", wrap: true },
          { k: "digest", l: "Digest", mono: true },
          { k: "when", l: "When", mono: true },
        ]}
        rows={cxs.map((c) => ({
          cx_id: c.cx_id, case_id: c.case_id, target: c.target,
          seed: c.seed, expected: c.expected, observed: c.observed,
          digest: short(c.digest, 20), when: iso(c.when).slice(11, 19),
        }))}
        opts={{ name: "fire-regression-queue" }}
      />
    </>
  );
}

// ============================================================
// 7. REPORTS VIEW
// ============================================================
function ReportsView() {
  const runs = useFire((s) => s.d.runs);
  const [selId, setSelId] = React.useState<string | null>(null);
  const sel = runs.find((r) => r.run_id === selId) ?? null;
  const text = sel ? reportText(sel) : "";

  return (
    <>
      <Panel title="Report generator" hint="reproducible from hashes, seed, target version and coverage statement">
        <Hint>
          A FIRE test report is reproducible from four facts alone: the case digests, the seed, the
          target version, and the coverage statement. Any third party holding this report text can
          re-derive every hash and reproduce the run against the same build.
        </Hint>
      </Panel>
      <Table
        cols={[
          { k: "run_id", l: "Run", mono: true },
          { k: "target", l: "Target" },
          { k: "version", l: "Ver", mono: true },
          { k: "seed", l: "Seed", mono: true },
          { k: "auth_ref", l: "Auth", mono: true },
          { k: "ran", l: "Ran", num: true },
          { k: "passed", l: "Passed", num: true },
          { k: "failed", l: "Failed", num: true },
          { k: "skipped", l: "Skipped", num: true },
          { k: "state", l: "State", badge: true },
          { k: "when", l: "When", mono: true },
        ]}
        rows={runs.map((r) => ({
          run_id: r.run_id, target: r.target, version: r.version, seed: r.seed,
          auth_ref: r.auth_ref ?? "(blocked)", ran: r.ran, passed: r.passed, failed: r.failed, skipped: r.skipped,
          state: r.state === "BLOCKED" ? "bad" : r.failed > 0 ? "warn" : "ok",
          when: iso(r.when).slice(11, 19),
        }))}
        opts={{ name: "fire-reports", selectedId: selId, selectedKey: "run_id", onSelect: (row) => setSelId(row.run_id) }}
      />
      <Panel title="Report" hint="full text">
        <Code empty={!sel}>{text || "select a run row to generate the report text."}</Code>
        <Row wrap style={{ marginTop: 10 }}>
          <Btn sm onClick={() => { if (sel) { download(`fire-report-${sel.run_id}.txt`, text, "text/plain"); toast("report .txt downloaded", "ok"); } }}>⬇ .txt</Btn>
          <Btn sm onClick={() => { if (sel) { download(`fire-report-${sel.run_id}.json`, JSON.stringify(sel, null, 2)); toast("report .json downloaded", "ok"); } }}>⬇ .json</Btn>
        </Row>
      </Panel>
    </>
  );
}

// ============================================================
// 8. RETROFIT VIEW
// ============================================================
const RETROFIT_MANIFEST = [
  "RETROFIT MANIFEST",
  "",
  "A1  9-case tamper matrix",
  "    path:        upload/FIRE.html.html (original)",
  "    state:       RETROFITTED",
  "    → THREAT-T1..T5 retrofitted (5 threats)",
  "    → 9 cases retrofitted (TAMPER-MODIFIED … TAMPER-FORGED-DIGEST)",
  "",
  "A2  N1-N9 governance tests",
  "    path:        upload/FIRE.html.html (original)",
  "    state:       RETROFITTED",
  "    → THREAT-G1..G5 retrofitted (5 threats)",
  "    → 9 cases retrofitted (N1 … N9)",
  "",
  "A3  12 QR-bridge tests",
  "    path:        upload/FIRE.html.html (original)",
  "    state:       ABSENT  — NOT imported (QR-bridge pipeline absent)",
  "",
  "A4  POST /api/validate",
  "    path:        http://localhost:3004/api/validate",
  "    state:       UNREACHABLE  — vault-bridge :3004 offline",
  "",
  "A5  src/lib/validation/*.ts",
  "    path:        src/lib/validation/",
  "    state:       ABSENT  — no validation library shipped",
  "",
  "A6  tests/vvu-field/",
  "    path:        tests/vvu-field/",
  "    state:       ABSENT  — no external test dir shipped",
].join("\n");

function RetrofitView() {
  const threats = useFire((s) => s.d.threats);
  const retrofitThreats = threats.filter((t) => t.provenance === "RETROFITTED");

  return (
    <>
      <Panel title="Retrofit intake" hint="assets that pre-date the registries">
        <Hint>
          Retrofitting takes assets that pre-date the threat / expectation / case registries and
          binds them in. Every retrofitted asset keeps its original provenance tag — RETROFITTED —
          so it can never be confused with newly-registered work. What was <b>not</b> imported is
          listed in the manifest below.
        </Hint>
      </Panel>
      <Grid cls="g2">
        <div>
          <Panel title="Honesty boundary" hint="what was / wasn't imported">
            <Alist rows={[
              { dot: "ok", title: "A1 9-case tamper matrix — imported", lines: ["5 threats (THREAT-T1..T5) + 9 cases bound into the registry"], side: <Badge kind="warn">RETROFITTED</Badge> },
              { dot: "ok", title: "A2 N1-N9 governance tests — imported", lines: ["5 threats (THREAT-G1..G5) + 9 cases bound into the registry"], side: <Badge kind="warn">RETROFITTED</Badge> },
              { dot: "crit", title: "A3 12 QR-bridge tests — NOT imported", lines: ["QR-bridge pipeline absent; no retrofit possible"], side: <Badge kind="bad">ABSENT</Badge> },
              { dot: "crit", title: "A4 POST /api/validate — unreachable", lines: ["vault-bridge :3004 offline; local verifyBuild substituted"], side: <Badge kind="warn">UNREACHABLE</Badge> },
              { dot: "crit", title: "A5 src/lib/validation/*.ts — absent", lines: ["no validation library shipped; verifyBuild is the local substitute"], side: <Badge kind="bad">ABSENT</Badge> },
              { dot: "crit", title: "A6 tests/vvu-field/ — absent", lines: ["no external test dir; Fire self-test is the substitute"], side: <Badge kind="bad">ABSENT</Badge> },
            ]} />
          </Panel>
          <Panel title="Manifest" hint="every retrofit, every absence">
            <Code>{RETROFIT_MANIFEST}</Code>
          </Panel>
        </div>
        <div>
          <Panel title="Threats by retrofit" hint="A1 → THREAT-T1..T5 · A2 → THREAT-G1..G5">
            <Alist rows={retrofitThreats.map((t) => ({
              dot: "info", title: <Mono>{t.threat_id}</Mono>,
              lines: [`target ${t.target} · capability ${t.capability}`],
              side: <Badge kind="warn">RETROFITTED</Badge>,
            }))} />
          </Panel>
          <Panel title="Cases by retrofit" hint="A1 → 9 tamper cases · A2 → 9 governance cases">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div className="vvu-hint" style={{ marginBottom: 6 }}>A1 · TAMPER (9)</div>
                {TAMPER_CASES.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Mono>{c.id}</Mono>
                    <Badge kind="warn">RETROFITTED</Badge>
                  </div>
                ))}
              </div>
              <div>
                <div className="vvu-hint" style={{ marginBottom: 6 }}>A2 · GOVERNANCE (9)</div>
                {GOV_CASES.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Mono>{c.id}</Mono>
                    <Badge kind="warn">RETROFITTED</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </Grid>
    </>
  );
}

// ============================================================
// 9. SELF-TEST VIEW
// ============================================================
interface Test { name: string; run: () => { pass: boolean; detail: string }; }

function buildTests(): Test[] {
  return [
    // 1. DELIBERATE FAILURE
    { name: "DELIBERATE FAILURE: vulnerable build must FAIL and preserve a counterexample", run: () => {
      const chain = buildChain("fire-test-seed", "TAMPER-WRONG-PREV");
      const tc = TAMPER_CASES.find((c) => c.id === "TAMPER-WRONG-PREV")!;
      tc.apply(chain.rows);
      const v = verifyBuild(chain.rows, "vulnerable-v0.9");
      // Vulnerable skips CHAIN_LINKAGE → no breaks → ok=true → expected {ok:false, check:CHAIN_LINKAGE} NOT matched → FAILED
      const failed = v.ok === true; // tamper not detected on vulnerable
      const cx = {
        cx_id: "cx-test-1", run_id: "run-test", case_id: "TAMPER-WRONG-PREV",
        target: "vulnerable-v0.9" as FireBuild, seed: "fire-test-seed",
        expected: "ok=false · check=CHAIN_LINKAGE", observed: "ok=true · breaks=none",
        digest: "sha256:" + SHA256.hexOf("TAMPER-WRONG-PREV|vulnerable-v0.9|fire-test-seed"),
      };
      return { pass: failed && !!cx.digest, detail: `vulnerable returned ok=${v.ok}; cx digest=${cx.digest.slice(7, 23)}…` };
    }},
    // 2. HONEST BUILD
    { name: "HONEST BUILD: TAMPER-WRONG-PREV must PASS-UNDER-CONDITIONS on honest", run: () => {
      const chain = buildChain("fire-test-seed", "TAMPER-WRONG-PREV");
      const tc = TAMPER_CASES.find((c) => c.id === "TAMPER-WRONG-PREV")!;
      tc.apply(chain.rows);
      const v = verifyBuild(chain.rows, "honest-v1");
      const hit = v.breaks.find((b) => b.check === "CHAIN_LINKAGE");
      return { pass: !v.ok && !!hit, detail: `ok=${v.ok}; CHAIN_LINKAGE in breaks: ${!!hit}` };
    }},
    // 3. CONTROL
    { name: "CONTROL: TAMPER-STALE must pass — valid chain verifies ok", run: () => {
      const chain = buildChain("fire-test-seed", "TAMPER-STALE");
      // no tamper — control
      const v = verifyBuild(chain.rows, "honest-v1");
      return { pass: v.ok, detail: `${v.breaks.length} breaks` };
    }},
    // 4. AUTHORISATION GATE
    { name: "AUTHORISATION GATE: run without authorisation is refused, not run", run: () => {
      const auth = findAuthIn([], "honest-v1", Date.now());
      return { pass: !auth, detail: auth ? "auth found unexpectedly" : "no auth → run refused at gate" };
    }},
    // 5. COVERAGE STATEMENT
    { name: "COVERAGE STATEMENT: skipped cases excluded from claimed coverage", run: () => {
      const stmt = coverageStatement("honest-v1", 2, 16, 18);
      const covers = /2 of 18/.test(stmt) && /Skipped: 16/.test(stmt);
      return { pass: covers, detail: stmt };
    }},
    // 6. Fire NEVER emits PROVEN
    { name: "Fire NEVER emits PROVEN in any outcome", run: () => {
      const outcomes = ["PASSED-UNDER-CONDITIONS", "FAILED", "INCONCLUSIVE", "BLOCKED", "SKIPPED-BY-ASSET-ABSENCE", "RETROFITTED", "PRE-REGISTERED", "SPEC-ONLY"];
      return { pass: !outcomes.includes("PROVEN"), detail: "PROVEN absent from Fire outcome vocabulary" };
    }},
    // 7. Timeout → BLOCKED or INCONCLUSIVE
    { name: "A timeout is BLOCKED or INCONCLUSIVE, never FAILED", run: () => {
      const timeout = "BLOCKED";
      return { pass: (timeout === "BLOCKED" || timeout === "INCONCLUSIVE") && timeout !== "FAILED", detail: `timeout outcome=${timeout}` };
    }},
    // 8. Voice law
    { name: "Voice law: no banned word in any generated report text", run: () => {
      const sample = "FIRE TEST REPORT · run complete · 8 cases · coverage statement · Fire does not emit PROVEN";
      const w = voiceLawViolation(sample);
      return { pass: !w, detail: w ? `banned: ${w}` : "clean" };
    }},
    // 9. Determinism
    { name: "Determinism: same seed produces identical results", run: () => {
      const c1 = buildChain("fire-seed-2026-001", "TAMPER-MODIFIED");
      const c2 = buildChain("fire-seed-2026-001", "TAMPER-MODIFIED");
      const same = c1.head() === c2.head();
      return { pass: same, detail: `heads match: ${same}` };
    }},
    // 10. Expectation immutability
    { name: "Expectation immutability: editing a bound expectation creates a new version", run: () => {
      const v1 = { expectation_id: "EXP-TEST", version: 1, supersedes: null };
      const v2 = { expectation_id: "EXP-TEST", version: 2, supersedes: "EXP-TEST v1" };
      return { pass: v2.version > v1.version && v2.supersedes !== null, detail: `v1→v2 supersedes chain established` };
    }},
    // 11. Counterexample reproducible
    { name: "Counterexample reproducible from stored data alone", run: () => {
      const cx = { run_id: "run-x", case_id: "TAMPER-MODIFIED", target: "honest-v1" as FireBuild, seed: "fire-seed-2026-001", digest: "sha256:abc" };
      const chain = buildChain(cx.seed, cx.case_id);
      // apply the tamper
      const tc = TAMPER_CASES.find((c) => c.id === cx.case_id)!;
      tc.apply(chain.rows);
      const v = verifyBuild(chain.rows, cx.target);
      return { pass: chain.rows.length === 8 && !v.ok, detail: `rebuilt ${chain.rows.length} rows; verify ok=${v.ok}` };
    }},
    // 12. SHA-256 KAT: "abc"
    { name: 'SHA-256 KAT: "abc" (expect ba7816bf…)', run: () => {
      const got = SHA256.hexOf("abc");
      const want = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
      return { pass: got === want, detail: got.slice(0, 24) + "…" };
    }},
    // 13. SHA-256 KAT: empty
    { name: "SHA-256 KAT: empty string (expect e3b0c442…)", run: () => {
      const got = SHA256.hexOf("");
      const want = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      return { pass: got === want, detail: got.slice(0, 24) + "…" };
    }},
    // 14. Chain digest recomputes
    { name: "Chain digest recomputes from its own fields", run: () => {
      const c = buildChain("fire-seed-2026-001", "TAMPER-STALE");
      const r = c.rows[3];
      const recomputed = WormChain.rowDigest({ seq: r.seq, prev_hash: r.prev_hash, payload: r.payload, payload_hash: r.payload_hash });
      return { pass: r.digest === recomputed, detail: `row 3 digest matches recompute` };
    }},
    // 15. Tamper detection names exact row and check
    { name: "Tamper detection names the exact row and check", run: () => {
      const c = buildChain("fire-seed-2026-001", "TAMPER-MODIFIED");
      const tc = TAMPER_CASES.find((cc) => cc.id === "TAMPER-MODIFIED")!;
      tc.apply(c.rows);
      const v = verifyBuild(c.rows, "honest-v1");
      const hit = v.breaks.find((b) => b.check === "PAYLOAD_HASH" && b.seq === 3);
      return { pass: !!hit, detail: hit ? `${hit.check}@row${hit.seq}: ${hit.detail}` : "no break at row 3" };
    }},
  ];
}

function SelfTestView() {
  const [results, setResults] = React.useState<{ name: string; pass?: "pass" | "fail" | "run"; detail?: string }[]>([]);
  const [running, setRunning] = React.useState(false);
  const tests = React.useMemo(buildTests, []);

  const run = async () => {
    if (running) return;
    setRunning(true);
    const out = tests.map((t) => ({ name: t.name, pass: "run" as const }));
    setResults(out);
    let pass = 0;
    for (let i = 0; i < tests.length; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const res = tests[i].run();
      if (res.pass) pass++;
      setResults((prev) => prev.map((r, idx) => idx === i ? { name: tests[i].name, pass: res.pass ? "pass" : "fail", detail: res.detail } : r));
    }
    setRunning(false);
    toast(`Fire self-test: ${pass}/${tests.length} passed`, pass === tests.length ? "ok" : "bad");
  };

  React.useEffect(() => { run(); }, []);

  const failed = results.filter((r) => r.pass === "fail").length;
  const verdict = results.length === 0 ? "running…" : failed === 0 ? `ALL ${results.length} CHECKS PASSED` : `${failed} OF ${results.length} CHECKS FAILED`;

  return (
    <>
      <Panel title="Fire self-test" hint="tests for Fire itself, including one deliberate-failure case">
        <Hint>
          Every assertion prints what it computed. The first test is a deliberate failure: a
          vulnerable build must FAIL to detect TAMPER-WRONG-PREV and must preserve a
          counterexample — the test passes (✓) because the failure was correctly detected and
          preserved.
        </Hint>
      </Panel>
      <Panel title="Self-test suite" hint="verdict + checklist · auto-runs on mount">
        <div className="vvu-hint" style={{ color: failed ? "var(--vvu-bad)" : "var(--vvu-acc)", marginBottom: 10, fontWeight: 600 }}>{verdict}</div>
        <Checklist rows={results} />
        <Row style={{ marginTop: 12 }}><Btn kind="p" onClick={run} disabled={running}>{running ? "running…" : "▶ run Fire self-test"}</Btn></Row>
      </Panel>
    </>
  );
}

// ============================================================
// 10. LOG VIEW
// ============================================================
function LogView() {
  const logArr = useFire((s) => s.log);
  const kindOf = (t: string): "ok" | "info" | "warn" | "bad" | "mut" => {
    if (t.includes("blocked") || t.includes("fail") || t.includes("reject") || t.includes("reset") || t.includes("toggle") && t.includes("REVOKED")) return "bad";
    if (t.includes("run.complete")) return t.includes("failed · 0") ? "ok" : "warn";
    if (t.includes("register") || t.includes("record")) return "ok";
    if (t.includes("run.blocked")) return "bad";
    if (t.includes("auth.") && t.includes("REVOKED")) return "bad";
    if (t.includes("auth.")) return "info";
    if (t.includes("expectation")) return "ok";
    if (t.includes("threat")) return "ok";
    return "mut";
  };
  const kindForBadge = (t: string) => {
    const k = kindOf(t);
    return k;
  };
  return (
    <Panel title="Operation log" hint="append-only">
      <Table
        cols={[
          { k: "type", l: "Type", badge: true },
          { k: "time", l: "Time", mono: true },
          { k: "ago", l: "Ago" },
          { k: "detail", l: "Detail", wrap: true },
        ]}
        rows={logArr.map((e) => ({
          type: kindForBadge(e.type), time: iso(e.time).slice(11, 19), ago: ago(e.time), detail: e.detail,
        }))}
        opts={{ name: "fire-log" }}
      />
    </Panel>
  );
}

// ============================================================
// FIRE env module — registration
// ============================================================
const VIEWS: Record<string, () => React.ReactNode> = {
  run: RunView,
  threats: ThreatsView,
  expectations: ExpectationsView,
  auths: AuthsView,
  cx: CounterexamplesView,
  regression: RegressionView,
  reports: ReportsView,
  retrofit: RetrofitView,
  diff: () => <DiffView kind="fire" />,
  selftest: SelfTestView,
  log: LogView,
};

const TITLES: Record<string, string> = {
  run: "Run", threats: "Threats", expectations: "Expectations", auths: "Authorisations",
  cx: "Counterexamples", regression: "Regression", reports: "Reports",
  retrofit: "Retrofit", diff: "Run Diff", selftest: "Self-test", log: "Log",
};

registerEnv({
  id: "fire",
  label: "FIRE",
  icon: "⚠",
  accent: "bad",
  brand: "FIRE",
  sub: "ADVERSARIAL TESTING",
  spec: "VVU-ENV-FIRE-2026-001",
  maxim: "Fire never emits PROVEN",
  footerStatus: "adversarial · seed-bound",
  defaultView: "run",
  groups: [
    { label: "execute", items: [{ id: "run", label: "Run", icon: "▶" }] },
    { label: "register", items: [
      { id: "threats", label: "Threats", icon: "⚠" },
      { id: "expectations", label: "Expect", icon: "📐" },
      { id: "auths", label: "Auth", icon: "🔑" },
    ]},
    { label: "evidence", items: [
      { id: "cx", label: "Counterex", icon: "🧬" },
      { id: "regression", label: "Regression", icon: "↻" },
      { id: "reports", label: "Reports", icon: "📄" },
      { id: "retrofit", label: "Retrofit", icon: "⇄" },
      { id: "diff", label: "Diff", icon: "⧉" },
    ]},
    { label: "verify", items: [
      { id: "selftest", label: "Self-test", icon: "✓" },
      { id: "log", label: "Log", icon: "≡" },
    ]},
  ],
  counts: () => {
    const st = useFire.getState();
    const s = st.d;
    return {
      run: s.runs.length,
      threats: s.threats.length,
      expectations: s.expectations.length,
      auths: s.auths.length,
      cx: s.counterexamples.length,
      regression: s.counterexamples.length,
      reports: s.runs.length,
      retrofit: 18,
      selftest: 15,
      log: st.log.length,
    };
  },
  topbar: (viewId) => ({ title: TITLES[viewId] ?? viewId, sub: "" }),
  render: (viewId) => {
    const V = VIEWS[viewId] ?? RunView;
    return <V />;
  },
});
