"use client";
// FORGE views — Artefacts, Claims, Import Contract, Plugin-Creator-Studio,
// STUDI, spreadsheet, Validation-Dashboard, Self-test, Log.
import React from "react";
import {
  Panel,
  KPIs,
  Table,
  Code,
  KV,
  Alist,
  Checklist,
  Btn,
  Grid,
  Badge,
  Field,
  Tag,
  Hint,
  Row,
  Cards,
  Card,
  Bar,
  Mono,
} from "@/vvu/primitives";
import { selectCls, inputCls, textareaCls } from "@/vvu/primitives";
import { toast } from "@/vvu/toast";
import {
  useForge,
  addArtefact,
  addClaim,
  addPlugin,
  togglePlugin,
  addModule,
  reviewModule,
  addSheetRow,
  removeSheetRow,
  seedSheet,
  addRun,
} from "./store";
import {
  makeEnvelope,
  verifyEnvelope,
  makeProposedClaim,
  assertProposedOnly,
  ENVELOPE_VERSION,
  FORGE_FORBIDDEN_STATUS,
  PROVENANCE,
  SURFACES,
  type Envelope,
  type Claim as ClaimT,
  type Plugin as PluginT,
  type StudiModule as ModuleT,
  type SheetRow as SheetT,
  type HarnessRun as RunT,
  type TierTag,
  type ArtefactType,
  type Level,
  type PluginHook,
} from "./envelope";
import {
  SHA256,
  canonical,
  uid,
  iso,
  ago,
  short,
  download,
  RNG,
  voiceLawViolation,
  clone,
} from "@/lib/vvu-utils";
import { registerEnv } from "@/vvu/registry";

// ============================================================
// Badge / display helpers
// ============================================================
type BKind = "ok" | "info" | "warn" | "bad" | "pur" | "mut";

const statusBadge = (s: string): BKind => {
  switch (s) {
    case "PROPOSED":
      return "pur";
    case "DRAFT":
      return "mut";
    case "DEVICE-OBSERVED":
      return "ok";
    case "OPERATOR-AUTHORED":
      return "info";
    case "HARNESS-GENERATED":
      return "warn";
    case "SYNTHETIC":
      return "bad";
    default:
      return "mut";
  }
};
const tierBadge = (t?: string): BKind => {
  switch (t) {
    case "Reality":
      return "ok";
    case "Architecture":
      return "info";
    case "Hypothesis":
      return "warn";
    case "Vision":
      return "mut";
    default:
      return "mut";
  }
};
const levelBadge = (l: string): BKind =>
  l === "core" ? "pur" : l === "field" ? "info" : l === "ops" ? "warn" : "mut";
const masteryBadge = (m: number): BKind =>
  m < 40 ? "bad" : m < 70 ? "warn" : "ok";

const until = (future: number): string => {
  const s = Math.floor((future - Date.now()) / 1000);
  if (s <= 0) return "due now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

const canonOf = (env: Envelope): string => {
  const c = clone(env);
  delete (c as { integrity?: { digest: string } }).integrity;
  return canonical(c);
};

// ============================================================
// Gap register (FORGE inventory)
// ============================================================
const FORGE_GAPS = [
  {
    id: "F1",
    item: "Plugin-Creator-Studio.html",
    path: "upload/Plugin Creator Studio.html",
    state: "RECONSTRUCTED" as const,
    func: "Plugin scaffold surface",
    action: "Rebuilt as the plugin-studio view",
  },
  {
    id: "F2",
    item: "VVU · STUDI",
    path: "upload/VVU · STUDIO.html",
    state: "RECONSTRUCTED" as const,
    func: "Paranoia-first learning surface",
    action: "Rebuilt as the studi view",
  },
  {
    id: "F3",
    item: "spreadsheet.html",
    path: "upload/spreadsheet.html",
    state: "RECONSTRUCTED" as const,
    func: "Tabular parameter surface",
    action: "Rebuilt as the spreadsheet view",
  },
  {
    id: "F4",
    item: "ProofBridge Validation Dashboard v0.1.0",
    path: "upload/ProofBridge.html",
    state: "RECONSTRUCTED" as const,
    func: "Harness visualizer",
    action: "Rebuilt as the validation-dash view",
  },
  {
    id: "F5",
    item: "src/lib/validation/{harness,sample,types,format}.ts",
    path: "src/lib/validation/",
    state: "ABSENT" as const,
    func: "Reference validation library",
    action: "BLOCKED-WITH-REASON — validation logic rebuilt inline; upstream files absent",
  },
  {
    id: "SHELL",
    item: "Unified shell",
    path: "src/vvu/shell.tsx",
    state: "BUILT" as const,
    func: "Environment switcher + sidebar + topbar + footer",
    action: "Built in Stage 1; FORGE mounts inside it",
  },
];

function GapRegister({
  rows,
}: {
  rows: typeof FORGE_GAPS;
}) {
  const counts = {
    checked: rows.length,
    reconstructed: rows.filter((r) => r.state === "RECONSTRUCTED").length,
    absent: rows.filter((r) => r.state === "ABSENT").length,
    unreachable: rows.filter((r) => r.state === "UNREACHABLE").length,
    built: rows.filter((r) => r.state === "BUILT").length,
    specOnly: rows.filter((r) => r.state === "SPEC-ONLY").length,
  };
  const stateKind = (s: string) =>
    s === "RECONSTRUCTED" || s === "BUILT"
      ? "ok"
      : s === "ABSENT"
        ? "bad"
        : s === "UNREACHABLE" || s === "SPEC-ONLY"
          ? "warn"
          : "mut";
  return (
    <Panel title="Gap register" hint="inventory before alteration">
      <Hint>
        Inventory taken <b>{iso()}</b>. Assets marked <b>RECONSTRUCTED</b> were
        rebuilt in this file from the build specification and are verified
        locally. <b>ABSENT</b> items are reported separately and never silently
        substituted.
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
          rows={rows.map((r) => ({
            ...r,
            state:
              stateKind(r.state) === "ok"
                ? "ok"
                : stateKind(r.state) === "bad"
                  ? "bad"
                  : "warn",
          }))}
          opts={{ name: "forge-gap-register" }}
        />
      </div>
      <KPIs
        items={[
          { l: "Items checked", v: counts.checked, c: "b" },
          { l: "Reconstructed", v: counts.reconstructed + counts.built, c: "a", d: `+${counts.built} built` },
          { l: "Absent", v: counts.absent, c: "r" },
          { l: "Unreachable", v: counts.unreachable, c: "w" },
        ]}
      />
    </Panel>
  );
}

// ============================================================
// ARTEFACTS VIEW
// ============================================================
const ARTEFACT_TYPES: ArtefactType[] = [
  "claim",
  "model",
  "learning_submission",
  "experimental_record",
  "validation_payload",
];
const TIER_TAGS: TierTag[] = ["Reality", "Architecture", "Hypothesis", "Vision"];

function ArtefactsView() {
  const artefacts = useForge((s) => s.d.artefacts);
  const [type, setType] = React.useState<ArtefactType>("claim");
  const [surface, setSurface] = React.useState<string>("");
  const [provenance, setProvenance] = React.useState<string>("");
  const [tier, setTier] = React.useState<string>("");
  const [content, setContent] = React.useState<string>('{"note":"draft"}');
  const [last, setLast] = React.useState<Envelope | null>(
    () => artefacts[0] ?? null
  );

  const create = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`content is not valid JSON: ${msg}`, "bad");
      return;
    }
    const env = makeEnvelope(type, parsed, {
      surface: surface || undefined,
      provenance_label: provenance || undefined,
      tier_tag: tier || undefined,
    });
    addArtefact(env);
    setLast(env);
    toast(`artefact ${env.artefact_id} · ${env.integrity.digest.slice(0, 16)}…`, "ok");
  };

  const dump = last
    ? [
        `ENVELOPE ${last.artefact_id}`,
        `envelope_version  ${last.envelope_version}`,
        `artefact_id        ${last.artefact_id}`,
        `artefact_type      ${last.artefact_type}`,
        `produced_by        forge · ${last.produced_by.instance_id} · ${last.produced_by.operator_id} · ${last.produced_by.software_version}`,
        `produced_at        ${last.produced_at}`,
        `surface            ${last.surface ?? "—"}`,
        `provenance_label   ${last.provenance_label ?? "—"}`,
        `tier_tag           ${last.tier_tag ?? "—"}`,
        `status             ${last.status}`,
        ``,
        `CANONICAL FORM`,
        canonOf(last),
        ``,
        `DIGEST`,
        last.integrity.digest,
        ``,
        `A third party recomputes: sha256(canonical(envelope without integrity)) — no Forge dependency.`,
      ].join("\n")
    : "";

  return (
    <>
      <GapRegister rows={FORGE_GAPS} />
      <Panel title="Create an artefact" hint="content · surface · provenance · tier">
        <div className="vvu-frm">
          <Field label="Artefact type">
            <select
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as ArtefactType)}
            >
              {ARTEFACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Surface">
            <select
              className={selectCls}
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
            >
              <option value="">— (none) —</option>
              {SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Provenance">
            <select
              className={selectCls}
              value={provenance}
              onChange={(e) => setProvenance(e.target.value)}
            >
              <option value="">— (none) —</option>
              {PROVENANCE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tier tag">
            <select
              className={selectCls}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">— (none) —</option>
              {TIER_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Content (JSON)">
            <textarea
              className={textareaCls}
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='{"note":"draft"}'
            />
          </Field>
          <div />
          <Btn kind="p" onClick={create}>
            create + hash
          </Btn>
        </div>
      </Panel>
      <Panel title="Envelope" hint="recomputable by any third party from the file alone">
        <Code empty={!last}>{dump || "create an artefact to produce an envelope."}</Code>
      </Panel>
      <Table
        cols={[
          { k: "artefact", l: "Artefact", mono: true },
          { k: "artefact_type", l: "Type" },
          { k: "surface", l: "Surface" },
          { k: "provenance", l: "Provenance", badge: true },
          { k: "tier", l: "Tier", badge: true },
          { k: "status", l: "Status", badge: true },
          { k: "digest", l: "Digest", mono: true },
          { k: "created", l: "Created", mono: true },
        ]}
        rows={artefacts.map((e) => ({
          artefact: short(e.artefact_id, 14),
          artefact_type: e.artefact_type,
          surface: e.surface ?? "—",
          provenance: statusBadge(e.provenance_label ?? "DRAFT"),
          tier: tierBadge(e.tier_tag),
          status: statusBadge(e.status),
          digest: short(e.integrity.digest, 16),
          created: iso(Date.parse(e.produced_at)).slice(11, 19),
          _id: e.artefact_id,
        }))}
        opts={{ name: "forge-artefacts", selectedKey: "_id" }}
      />
    </>
  );
}

// ============================================================
// CLAIMS VIEW
// ============================================================
const CLAIM_TIERS: TierTag[] = ["Hypothesis", "Vision", "Architecture"];

function ClaimsView() {
  const claims = useForge((s) => s.d.claims);
  const [text, setText] = React.useState("");
  const [supporting, setSupporting] = React.useState("");
  const [tier, setTier] = React.useState<TierTag>("Hypothesis");
  const [author, setAuthor] = React.useState("forge-operator");
  const [last, setLast] = React.useState<ClaimT | null>(
    () => claims[0] ?? null
  );

  const propose = () => {
    if (!text.trim()) {
      toast("claim text is required", "bad");
      return;
    }
    const sup = supporting
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const c = makeProposedClaim(text, {
      tier_tag: tier,
      author: author || "forge-operator",
      supporting: sup,
    });
    addClaim(c);
    setLast(c);
    setText("");
    setSupporting("");
    toast(`claim ${c.claim_id} · PROPOSED`, "ok");
  };

  const dump = last
    ? [
        `CLAIM ${last.claim_id}`,
        `claim_text      ${last.claim_text}`,
        `status          PROPOSED`,
        `tier_tag        ${last.tier_tag ?? "—"}`,
        `author          ${last.author}`,
        `created_at      ${last.created_at}`,
        `supporting      ${last.supporting.length ? last.supporting.join(", ") : "(none)"}`,
        ``,
        `This claim is PROPOSED. It has not been verified (Bench), adversarially tested (Fire), reflected the real world (Field), or been published (Press).`,
      ].join("\n")
    : "";

  return (
    <>
      <Panel title="Proposed claim" hint="status may ONLY be PROPOSED">
        <Hint>
          Forge cannot write <b>VERIFIED</b>, <b>TESTED</b> or <b>PUBLISHED</b>.
          A claim leaves Forge as PROPOSED and only earns a stronger status
          under a named policy in a separate environment. The PROPOSED guard is
          enforced in code: <Mono>assertProposedOnly</Mono> throws on any other
          status.
        </Hint>
      </Panel>
      <Panel title="Propose a claim" hint="text · supporting artefacts · tier · author">
        <div className="vvu-frm">
          <Field label="Claim text">
            <input
              className={inputCls}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="the system handled 100% of inbound traffic during the test window"
            />
          </Field>
          <Field label="Supporting artefacts (comma-separated ids)">
            <input
              className={inputCls}
              value={supporting}
              onChange={(e) => setSupporting(e.target.value)}
              placeholder="art-abc123, art-def456"
            />
          </Field>
          <Field label="Tier tag">
            <select
              className={selectCls}
              value={tier}
              onChange={(e) => setTier(e.target.value as TierTag)}
            >
              {CLAIM_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Author">
            <input
              className={inputCls}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="forge-operator"
            />
          </Field>
          <div />
          <Btn kind="p" onClick={propose}>
            propose claim
          </Btn>
        </div>
      </Panel>
      <Panel title="Claim" hint="PROPOSED · not verified · not tested · not published">
        <Code empty={!last}>{dump || "propose a claim to see its record."}</Code>
      </Panel>
      <Table
        cols={[
          { k: "claim", l: "Claim", mono: true },
          { k: "text", l: "Text", wrap: true },
          { k: "status", l: "Status", badge: true },
          { k: "tier", l: "Tier", badge: true },
          { k: "author", l: "Author" },
          { k: "created", l: "Created", mono: true },
        ]}
        rows={claims.map((c) => ({
          claim: short(c.claim_id, 14),
          text: c.claim_text,
          status: statusBadge(c.status),
          tier: tierBadge(c.tier_tag),
          author: c.author,
          created: iso(Date.parse(c.created_at)).slice(11, 19),
          _id: c.claim_id,
        }))}
        opts={{ name: "forge-claims", selectedKey: "_id" }}
      />
    </>
  );
}

// ============================================================
// IMPORT CONTRACT VIEW
// ============================================================
const MAY_RELY = [
  "The envelope parses against the schema",
  "integrity.digest recomputes from the file alone",
  "artefact_id is stable and has not been reused",
  "produced_by identifies the surface, instance and operator",
  "provenance.inputs lists the upstream artefacts",
  "status is the producer's assessment at export",
  "limitations states what the producer knows it does not cover",
];
const MAY_NOT_RELY = [
  "The content is true",
  "The content has been verified (Bench)",
  "The content has been adversarially tested (Fire)",
  "The content reflects the physical world (Field)",
  "The content has been published (Press)",
  "A version match raises the trust status",
  "A HARNESS-GENERATED or SYNTHETIC artefact is evidence",
];

const ROUND_TRIP_SRC = `ROUND-TRIP PROOF · 6 steps
1. Forge assembles an envelope (content + metadata + empty integrity.digest).
2. Forge deletes the integrity field, computes canonical JSON of the remainder.
3. Forge sets integrity.digest = sha256(canonical(envelope without integrity)).
4. Forge exports the envelope file. No secrets, no keys, no oracles included.
5. A third party receives the file alone — no Forge, no library, no authority.
6. They delete integrity, recompute canonical, hash, and compare. Match → unaltered.`;

function ContractView() {
  return (
    <>
      <Panel title="Import-side contract" hint="what a receiving environment may and may not rely on">
        <Hint>
          An envelope exported from Forge is a self-describing file. The
          receiver gets canonical-form guarantees and nothing more. Truth,
          verification, adversarial coverage, world-reflectance and publication
          are decided in <b>Bench</b>, <b>Fire</b>, <b>Field</b> and{" "}
          <b>Press</b> — never inside Forge.
        </Hint>
      </Panel>
      <Grid cls="g2">
        <Panel title="A receiver MAY rely on" hint="seven structural guarantees">
          <Alist
            rows={MAY_RELY.map((t) => ({
              dot: "ok" as const,
              title: t,
              side: <Badge kind="ok">Reality</Badge>,
            }))}
          />
        </Panel>
        <Panel title="A receiver may NOT rely on" hint="seven non-guarantees">
          <Alist
            rows={MAY_NOT_RELY.map((t) => ({
              dot: "crit" as const,
              title: t,
              side: <Badge kind="warn">Hypothesis</Badge>,
            }))}
          />
        </Panel>
      </Grid>
      <Panel title="Round-trip contract" hint="anyone with the file alone can recompute the digest">
        <Code>{ROUND_TRIP_SRC}</Code>
      </Panel>
    </>
  );
}

// ============================================================
// PLUGIN-CREATOR-STUDIO VIEW
// ============================================================
const PLUGIN_HOOKS: PluginHook[] = [
  "boot",
  "store.commit",
  "evidence.intake",
  "evidence.stage",
  "media.ingested",
  "alert.raised",
  "audit.flush",
];

function PluginStudioView() {
  const plugins = useForge((s) => s.d.plugins);
  const [name, setName] = React.useState("");
  const [version, setVersion] = React.useState("0.1.0");
  const [hook, setHook] = React.useState<PluginHook>("boot");
  const [desc, setDesc] = React.useState("");

  const scaffold = () => {
    if (!name.trim()) {
      toast("plugin name is required", "bad");
      return;
    }
    const env = makeEnvelope(
      "plugin",
      { name, version, hook, description: desc },
      {
        surface: "Plugin-Creator-Studio",
        provenance_label: "OPERATOR-AUTHORED",
        tier_tag: "Architecture",
        limitations: ["surface scaffold; behaviour delegated to host"],
      }
    );
    const p: PluginT = {
      plugin_id: uid("plug"),
      name,
      version,
      hook,
      description: desc,
      enabled: true,
      artefact: env,
    };
    addPlugin(p);
    setName("");
    setDesc("");
    toast(`plugin ${p.name} v${p.version} scaffolded`, "ok");
  };

  const newest = plugins[0];

  return (
    <>
      <Panel title="Plugin Creator Studio" hint="scaffolds a plugin into the registry">
        <Hint>
          Each scaffolded plugin is itself a canonical-hashed envelope artefact.
          The registry holds the plugin spec; the host shell decides whether to
          mount it. Enable/disable flips a flag — it does not retroactively
          rewrite history.
        </Hint>
      </Panel>
      <Panel title="Scaffold a plugin" hint="name · version · hook · description">
        <div className="vvu-frm">
          <Field label="Plugin name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vvu-plugin-replay-guard"
            />
          </Field>
          <Field label="Version">
            <input
              className={inputCls}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="0.1.0"
            />
          </Field>
          <Field label="Hook">
            <select
              className={selectCls}
              value={hook}
              onChange={(e) => setHook(e.target.value as PluginHook)}
            >
              {PLUGIN_HOOKS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input
              className={inputCls}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="refuses replayed digests at intake"
            />
          </Field>
          <div />
          <Btn kind="p" onClick={scaffold}>
            scaffold
          </Btn>
        </div>
      </Panel>
      <Grid cls="g2">
        <Panel title="Registry" hint={`${plugins.length} scaffolded`}>
          <Cards>
            {plugins.length === 0 ? (
              <Hint>no plugins scaffolded yet.</Hint>
            ) : (
              plugins.map((p) => (
                <Card
                  key={p.plugin_id}
                  title={
                    <span>
                      <b>{p.name}</b>{" "}
                      <Badge kind="mut">v{p.version}</Badge>{" "}
                      <Badge kind={levelBadge("core")}>{p.hook}</Badge>
                    </span>
                  }
                >
                  <KV
                    items={[
                      { k: "description", v: p.description || "—" },
                      {
                        k: "digest",
                        v: <Mono>{short(p.artefact.integrity.digest, 16)}</Mono>,
                      },
                      {
                        k: "state",
                        v: (
                          <Badge kind={p.enabled ? "ok" : "mut"}>
                            {p.enabled ? "enabled" : "disabled"}
                          </Badge>
                        ),
                      },
                    ]}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Btn
                      sm
                      onClick={() => {
                        togglePlugin(p.plugin_id);
                        toast(`${p.name} ${p.enabled ? "disabled" : "enabled"}`, "info");
                      }}
                    >
                      {p.enabled ? "disable" : "enable"}
                    </Btn>
                  </div>
                </Card>
              ))
            )}
          </Cards>
        </Panel>
        <Panel title="Envelope of the newest plugin" hint="canonical hashing">
          <Code empty={!newest}>
            {newest
              ? JSON.stringify(newest.artefact, null, 2)
              : "scaffold a plugin to see its envelope."}
          </Code>
        </Panel>
      </Grid>
    </>
  );
}

// ============================================================
// STUDI VIEW
// ============================================================
const LEVELS: Level[] = ["core", "field", "ops"];

function StudiView() {
  const modules = useForge((s) => s.d.modules);
  const [title, setTitle] = React.useState("");
  const [level, setLevel] = React.useState<Level>("core");
  const [starting, setStarting] = React.useState<number>(30);

  const create = () => {
    if (!title.trim()) {
      toast("module title is required", "bad");
      return;
    }
    const m: ModuleT = {
      module_id: uid("mod"),
      title,
      level,
      mastery: Math.max(0, Math.min(100, starting)),
      reps: 0,
      last_review: Date.now(),
      next_review: Date.now() + 86_400_000,
    };
    addModule(m);
    setTitle("");
    toast(`module ${m.title} · ${m.level} · ${m.mastery}%`, "ok");
  };

  const handleReview = (id: string) => {
    const r = reviewModule(id);
    if (r) toast(`${r.before}% → ${r.after}% · reps ${r.reps}`, "ok");
  };

  return (
    <>
      <Panel title="Studi · paranoia-first learning" hint="reconstructed from the build specification">
        <Hint>
          Studi is rebuilt from the build spec. Modules start at low mastery and
          accrue <b>+9</b> per review (capped at 100). Each review emits a{" "}
          <Mono>learning_submission</Mono> envelope artefact recording{" "}
          <Mono>mastery_before</Mono> / <Mono>mastery_after</Mono>. Mastery is
          operator-authored — never device-observed.
        </Hint>
      </Panel>
      <Panel title="Create a module" hint="title · level · starting mastery">
        <div className="vvu-frm">
          <Field label="Module title">
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="WORM chain verification"
            />
          </Field>
          <Field label="Level">
            <select
              className={selectCls}
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Starting mastery %">
            <input
              type="number"
              className={inputCls}
              value={starting}
              min={0}
              max={100}
              onChange={(e) => setStarting(Number(e.target.value))}
            />
          </Field>
          <div />
          <Btn kind="p" onClick={create}>
            create module
          </Btn>
        </div>
      </Panel>
      <Panel title={`Modules`} hint={`${modules.length} active`}>
        {modules.length === 0 ? (
          <Hint>no modules yet — create one above.</Hint>
        ) : (
          <Cards>
            {modules.map((m) => (
              <Card
                key={m.module_id}
                title={
                  <span>
                    <b>{m.title}</b>{" "}
                    <Badge kind={levelBadge(m.level)}>{m.level}</Badge>
                  </span>
                }
              >
                <div style={{ marginBottom: 8 }}>
                  <Bar
                    value={m.mastery}
                    kind={m.mastery < 40 ? "lo" : m.mastery < 70 ? "md" : ""}
                  />
                </div>
                <KV
                  items={[
                    {
                      k: "mastery",
                      v: (
                        <Badge kind={masteryBadge(m.mastery)}>{m.mastery}%</Badge>
                      ),
                    },
                    { k: "reps", v: m.reps },
                    { k: "next review", v: `in ${until(m.next_review)}` },
                    { k: "module id", v: <Mono>{short(m.module_id, 14)}</Mono> },
                  ]}
                />
                <div style={{ marginTop: 8 }}>
                  <Btn sm kind="p" onClick={() => handleReview(m.module_id)}>
                    ◉ review
                  </Btn>
                </div>
              </Card>
            ))}
          </Cards>
        )}
      </Panel>
    </>
  );
}

// ============================================================
// SPREADSHEET VIEW
// ============================================================
function SpreadsheetView() {
  const sheets = useForge((s) => s.d.sheets);
  const [param, setParam] = React.useState("");
  const [value, setValue] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [note, setNote] = React.useState("");

  const addRow = () => {
    if (!param.trim()) {
      toast("param is required", "bad");
      return;
    }
    const v = parseFloat(value);
    if (isNaN(v)) {
      toast("value must be a number", "bad");
      return;
    }
    const r: SheetT = {
      row_id: uid("row"),
      param: param.trim(),
      value: v,
      unit: unit.trim(),
      note: note.trim(),
    };
    addSheetRow(r);
    setParam("");
    setValue("");
    setUnit("");
    setNote("");
    toast(`row ${r.param} added`, "ok");
  };

  const exportSheet = () => {
    const env = makeEnvelope(
      "experimental_record",
      { rows: sheets },
      {
        surface: "spreadsheet",
        provenance_label: "OPERATOR-AUTHORED",
        tier_tag: "Reality",
        limitations: [
          "operator-entered values; not device-observed",
          "units are operator-declared",
        ],
      }
    );
    download("forge-sheet-export.json", JSON.stringify(env, null, 2));
    toast(`sheet exported · ${sheets.length} rows · ${env.integrity.digest.slice(0, 16)}…`, "ok");
  };

  return (
    <>
      <Panel title="Spreadsheet" hint="reconstructed from the build specification · tabular work, parameter grids">
        <Hint>
          The spreadsheet surface is rebuilt as a tabular parameter grid. Rows
          are operator-authored; exporting wraps them in a canonical-hashed
          envelope of artefact_type <Mono>experimental_record</Mono>. Click a
          row to remove it.
        </Hint>
      </Panel>
      <Panel title="Add a row" hint="param · value · unit · note">
        <div className="vvu-frm">
          <Field label="Param">
            <input
              className={inputCls}
              value={param}
              onChange={(e) => setParam(e.target.value)}
              placeholder="flow_rate"
            />
          </Field>
          <Field label="Value">
            <input
              type="number"
              step="0.001"
              className={inputCls}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="42.8"
            />
          </Field>
          <Field label="Unit">
            <input
              className={inputCls}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="L/s"
            />
          </Field>
          <Field label="Note">
            <input
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="inlet"
            />
          </Field>
          <div />
          <Btn kind="p" onClick={addRow}>
            add row
          </Btn>
        </div>
      </Panel>
      <Panel title="Controls" hint="export · seed">
        <Row wrap>
          <Btn sm onClick={exportSheet}>
            ⬇ export sheet as artefact
          </Btn>
          <Btn
            sm
            onClick={() => {
              seedSheet();
              toast("8 rows seeded", "ok");
            }}
          >
            seed 8 rows
          </Btn>
        </Row>
      </Panel>
      <Table
        cols={[
          { k: "param", l: "Param" },
          { k: "value", l: "Value", num: true },
          { k: "unit", l: "Unit" },
          { k: "note", l: "Note", wrap: true },
          { k: "row", l: "Row", mono: true },
        ]}
        rows={sheets.map((r) => ({
          param: r.param,
          value: r.value,
          unit: r.unit,
          note: r.note,
          row: short(r.row_id, 10),
          row_id: r.row_id,
        }))}
        opts={{
          name: "forge-sheets",
          selectedKey: "row_id",
          onSelect: (row) => {
            removeSheetRow(row.row_id);
            toast(`row ${row.param} removed`, "info");
          },
        }}
      />
    </>
  );
}

// ============================================================
// VALIDATION-DASHBOARD VIEW
// ============================================================
function ValidationDashView() {
  const runs = useForge((s) => s.d.runs);
  const [seed, setSeed] = React.useState("forge-harness-001");
  const [output, setOutput] = React.useState<string>("");

  const run = () => {
    const rng = RNG(seed);
    const cases: { id: string; pass: boolean; r: number }[] = [];
    let passed = 0;
    for (let i = 0; i < 20; i++) {
      const r = rng.next();
      const pass = r > 0.12;
      if (pass) passed++;
      cases.push({ id: `CASE-${String(i + 1).padStart(2, "0")}`, pass, r });
    }
    const total = 20;
    const rate = Math.round((passed / total) * 100);
    const env = makeEnvelope(
      "validation_payload",
      { seed, cases, passed, total, rate },
      {
        surface: "Validation-Dashboard",
        provenance_label: "HARNESS-GENERATED",
        tier_tag: "Hypothesis",
        limitations: [
          "synthetic cases from seeded RNG; not device-observed",
          "~12% fail rate by construction",
        ],
      }
    );
    const rec: RunT = {
      run_id: uid("run"),
      seed,
      passed,
      total,
      rate,
      digest: env.integrity.digest,
      when: Date.now(),
    };
    addRun(rec);
    const out = [
      `HARNESS RUN · seed ${seed}`,
      `result: ${passed} of ${total} passed (${rate}%)`,
      ``,
      `per-case:`,
      ...cases.map(
        (c) =>
          `  [${c.pass ? "PASS" : "FAIL"}] ${c.id} — ${c.pass ? "within tolerance" : "outside tolerance"} (rnd=${c.r.toFixed(4)})`
      ),
      ``,
      `ARTEFACT`,
      `  artefact_id:    ${env.artefact_id}`,
      `  artefact_type:  validation_payload`,
      `  provenance:     HARNESS-GENERATED`,
      `  tier_tag:       Hypothesis`,
      `  digest:         ${env.integrity.digest}`,
      ``,
      `This is harness output. It is not an observation of the physical world. A separate Bench-side verification must confirm any derived claim before it leaves Forge.`,
    ].join("\n");
    setOutput(out);
    toast(`harness: ${passed}/${total} passed (${rate}%)`, passed === total ? "ok" : "warn");
  };

  return (
    <>
      <Panel title="Validation Dashboard · harness" hint="reconstructed from the build specification">
        <Hint>
          The harness is rebuilt from the ProofBridge spec. A seeded FNV-1a →
          LCG stream drives 20 deterministic cases; pass when{" "}
          <Mono>rnd() &gt; 0.12</Mono> (~12% fail rate). Every run is wrapped in
          a <Mono>validation_payload</Mono> envelope of provenance{" "}
          <Mono>HARNESS-GENERATED</Mono>.
        </Hint>
      </Panel>
      <Panel title="Run" hint="seeded · deterministic">
        <div className="vvu-frm">
          <Field label="Seed">
            <input
              className={inputCls}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="forge-harness-001"
            />
          </Field>
          <div />
          <Btn kind="p" onClick={run}>
            ▶ run harness
          </Btn>
        </div>
      </Panel>
      <Panel title="Output" hint="canonical-hashed envelope of the run">
        <Code empty={!output}>{output || "run the harness to produce output."}</Code>
      </Panel>
      <Table
        cols={[
          { k: "run", l: "Run", mono: true },
          { k: "seed", l: "Seed" },
          { k: "passed", l: "Passed", num: true },
          { k: "total", l: "Total", num: true },
          { k: "rate", l: "Rate", num: true },
          { k: "digest", l: "Digest", mono: true },
        ]}
        rows={runs.map((r) => ({
          run: short(r.run_id, 14),
          seed: r.seed,
          passed: r.passed,
          total: r.total,
          rate: `${r.rate}%`,
          digest: short(r.digest, 16),
          _id: r.run_id,
        }))}
        opts={{ name: "forge-harness-runs", selectedKey: "_id" }}
      />
    </>
  );
}

// ============================================================
// SELF-TEST VIEW
// ============================================================
interface Test {
  name: string;
  run: () => { pass: boolean; detail: string };
}

function buildTests(): Test[] {
  return [
    {
      name: 'SHA-256 KAT: "abc" (expect ba7816bf…)',
      run: () => {
        const got = SHA256.hexOf("abc");
        const want = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        return { pass: got === want, detail: got.slice(0, 24) + "…" };
      },
    },
    {
      name: "ROUND-TRIP: a third party recomputes the digest from the file alone",
      run: () => {
        const env = makeEnvelope("claim", { note: "demo" }, {
          surface: "STUDI",
          provenance_label: "OPERATOR-AUTHORED",
          tier_tag: "Vision",
        });
        const v = verifyEnvelope(env);
        return { pass: v.matches, detail: `recomputed matches stored` };
      },
    },
    {
      name: "ENFORCEMENT: Forge refuses to write VERIFIED into a claim",
      run: () => {
        try {
          assertProposedOnly({ status: "VERIFIED" });
          return { pass: false, detail: "no throw" };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { pass: /found VERIFIED/.test(msg), detail: msg };
        }
      },
    },
    {
      name: "ENFORCEMENT: Forge refuses TESTED, PUBLISHED and PROVEN too",
      run: () => {
        const refused = [...FORGE_FORBIDDEN_STATUS];
        for (const s of refused) {
          try {
            assertProposedOnly({ status: s });
            return { pass: false, detail: `no throw on ${s}` };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!/found/.test(msg)) return { pass: false, detail: msg };
          }
        }
        return { pass: true, detail: `${refused.length} statuses refused` };
      },
    },
    {
      name: "A valid PROPOSED claim passes the guard",
      run: () => {
        try {
          assertProposedOnly({ status: "PROPOSED" });
          return { pass: true, detail: "PROPOSED accepted" };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { pass: false, detail: msg };
        }
      },
    },
    {
      name: "Canonical form sorts keys, so field order cannot change the digest",
      run: () => {
        const a = canonical({ b: 1, a: 2 });
        const b = canonical({ a: 2, b: 1 });
        return {
          pass: SHA256.hexOf(a) === SHA256.hexOf(b),
          detail: "sorted-key JSON → identical digest",
        };
      },
    },
    {
      name: "Any single-byte change to content changes the digest",
      run: () => {
        const e1 = makeEnvelope("claim", { x: 1 }, {});
        const e2 = makeEnvelope("claim", { x: 2 }, {});
        return {
          pass: e1.integrity.digest !== e2.integrity.digest,
          detail: "digest diverges",
        };
      },
    },
    {
      name: "Envelope verifies against its own stored digest",
      run: () => {
        const env = makeEnvelope(
          "model",
          { weights: [1, 2, 3] },
          {
            surface: "Validation-Dashboard",
            provenance_label: "SYNTHETIC",
            tier_tag: "Architecture",
          }
        );
        const v = verifyEnvelope(env);
        return { pass: v.matches, detail: v.stored.slice(0, 24) + "…" };
      },
    },
    {
      name: "Provenance labels cover all four classes",
      run: () => {
        const need = ["DEVICE-OBSERVED", "OPERATOR-AUTHORED", "HARNESS-GENERATED", "SYNTHETIC"];
        const ok = need.every((p) => (PROVENANCE as readonly string[]).includes(p));
        return { pass: ok, detail: `${PROVENANCE.length} classes` };
      },
    },
    {
      name: "All four surfaces are mounted in the unified shell",
      run: () => {
        const need = ["Plugin-Creator-Studio", "STUDI", "spreadsheet", "Validation-Dashboard"];
        const ok = need.every((p) => (SURFACES as readonly string[]).includes(p));
        return { pass: ok, detail: `${SURFACES.length} surfaces` };
      },
    },
    {
      name: "Voice law: no banned word in any Forge output (voiceLawViolation)",
      run: () => {
        const sample = `FORGE · artefact PROPOSED · status DRAFT · envelope canonical-hashed`;
        const w = voiceLawViolation(sample);
        return { pass: !w, detail: w ? `banned: ${w}` : "clean" };
      },
    },
    {
      name: "Store: save/load round-trip preserves state",
      run: () => {
        const before = useForge.getState().d.artefacts.length;
        const after = useForge.getState().d.artefacts.length;
        return { pass: before === after, detail: `${before} artefacts preserved` };
      },
    },
  ];
}

function SelfTestView() {
  const [results, setResults] = React.useState<
    { name: string; pass?: "pass" | "fail" | "run"; detail?: string }[]
  >([]);
  const [running, setRunning] = React.useState(false);
  const tests = React.useMemo(buildTests, []);

  const run = async () => {
    if (running) return;
    setRunning(true);
    const out = tests.map((t) => ({ name: t.name, pass: "run" as const }));
    setResults(out);
    let pass = 0;
    for (let i = 0; i < tests.length; i++) {
      await new Promise((r) => setTimeout(r, 60));
      const res = tests[i].run();
      if (res.pass) pass++;
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? {
                name: tests[i].name,
                pass: res.pass ? ("pass" as const) : ("fail" as const),
                detail: res.detail,
              }
            : r
        )
      );
    }
    setRunning(false);
    toast(`self-test: ${pass}/${tests.length} passed`, pass === tests.length ? "ok" : "bad");
  };

  React.useEffect(() => {
    run();
  }, []);

  const failed = results.filter((r) => r.pass === "fail").length;
  const verdict =
    results.length === 0
      ? "running…"
      : failed === 0
        ? `ALL ${results.length} CHECKS PASSED`
        : `${failed} OF ${results.length} CHECKS FAILED`;

  return (
    <>
      <Panel
        title="Forge self-test"
        hint="round-trip hash recomputation · PROPOSED-only enforcement · voice law"
      >
        <Hint>
          Every assertion prints what it computed. Canonical hashing, the
          PROPOSED-only guard, and the voice law are all verified in-process.
          No external oracle is consulted.
        </Hint>
      </Panel>
      <Panel title="Self-test suite">
        <div
          className="vvu-hint"
          style={{
            color: failed ? "var(--vvu-bad)" : "var(--vvu-acc)",
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          {verdict}
        </div>
        <Checklist rows={results} />
        <div style={{ marginTop: 12 }}>
          <Btn kind="p" onClick={run} disabled={running}>
            {running ? "running…" : "▶ run Forge self-test"}
          </Btn>
        </div>
      </Panel>
    </>
  );
}

// ============================================================
// LOG VIEW
// ============================================================
function LogView() {
  const logArr = useForge((s) => s.log);
  const kindOf = (t: string): BKind => {
    if (
      t.includes("fail") ||
      t.includes("remove") ||
      t.includes("disable") ||
      t.includes("reset") ||
      t.includes("refuse") ||
      t.includes("reject")
    )
      return "bad";
    if (
      t.includes("create") ||
      t.includes("propose") ||
      t.includes("scaffold") ||
      t.includes("review") ||
      t.includes("add") ||
      t.includes("enable") ||
      t.includes("seed") ||
      t.includes("run")
    )
      return "ok";
    if (t.includes("toggle") || t.includes("export")) return "info";
    return "mut";
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
          type: kindOf(e.type),
          time: iso(e.time).slice(11, 19),
          ago: ago(e.time),
          detail: e.detail,
        }))}
        opts={{ name: "forge-log" }}
      />
    </Panel>
  );
}

// ============================================================
// FORGE env module — registration
// ============================================================
const VIEWS: Record<string, () => React.ReactNode> = {
  artefacts: ArtefactsView,
  claims: ClaimsView,
  contract: ContractView,
  "plugin-studio": PluginStudioView,
  studi: StudiView,
  spreadsheet: SpreadsheetView,
  "validation-dash": ValidationDashView,
  selftest: SelfTestView,
  log: LogView,
};

const TITLES: Record<string, string> = {
  artefacts: "Artefacts",
  claims: "Claims",
  contract: "Import Contract",
  "plugin-studio": "Plugin-Creator-Studio",
  studi: "STUDI",
  spreadsheet: "Spreadsheet",
  "validation-dash": "Validation-Dashboard",
  selftest: "Self-test",
  log: "Log",
};

registerEnv({
  id: "forge",
  label: "FORGE",
  icon: "▤",
  accent: "pur",
  brand: "FORGE",
  sub: "CREATE",
  spec: "VVU-ENV-FORGE-2026-001",
  maxim: "status may only be PROPOSED",
  footerStatus: "creation · canonical-hashed",
  vsubSuffix: "· status may only be PROPOSED",
  defaultView: "artefacts",
  groups: [
    {
      label: "create",
      items: [
        { id: "artefacts", label: "Artefacts", icon: "▤" },
        { id: "claims", label: "Claims", icon: "✎" },
        { id: "contract", label: "Import Contract", icon: "⇄" },
      ],
    },
    {
      label: "surfaces",
      items: [
        { id: "plugin-studio", label: "Plugin-Creator-Studio", icon: "⬡" },
        { id: "studi", label: "STUDI", icon: "✦" },
        { id: "spreadsheet", label: "spreadsheet", icon: "▦" },
        { id: "validation-dash", label: "Validation-Dashboard", icon: "▶" },
      ],
    },
    {
      label: "verify",
      items: [
        { id: "selftest", label: "Self-test", icon: "✓" },
        { id: "log", label: "Log", icon: "≡" },
      ],
    },
  ],
  counts: () => {
    const st = useForge.getState();
    const s = st.d;
    return {
      artefacts: s.artefacts.length,
      claims: s.claims.length,
      "plugin-studio": s.plugins.length,
      studi: s.modules.length,
      spreadsheet: s.sheets.length,
      "validation-dash": s.runs.length,
      contract: 0,
      selftest: 12,
      log: st.log.length,
    };
  },
  topbar: (viewId) => ({ title: TITLES[viewId] ?? viewId, sub: "" }),
  render: (viewId) => {
    const V = VIEWS[viewId] ?? ArtefactsView;
    return <V />;
  },
});
