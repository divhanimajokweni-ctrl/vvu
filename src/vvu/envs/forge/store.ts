// FORGE store — artefacts, claims, plugins, studi modules, sheet rows, harness runs.
import { makeStore, LogEntry } from "@/vvu/store";
import { uid } from "@/lib/vvu-utils";
import {
  Envelope,
  Claim,
  Plugin,
  StudiModule,
  SheetRow,
  HarnessRun,
  makeEnvelope,
} from "./envelope";

export interface ForgeState {
  artefacts: Envelope[];
  claims: Claim[];
  plugins: Plugin[];
  modules: StudiModule[];
  sheets: SheetRow[];
  runs: HarnessRun[];
}

const ENV_KEY = "forge.vvu.v1";

const initialState = (): ForgeState => ({
  artefacts: [],
  claims: [],
  plugins: [],
  modules: [],
  sheets: [],
  runs: [],
});

export const useForge = makeStore<ForgeState>(ENV_KEY, initialState);

// ---- mutators bound to the store ----
export function addArtefact(env: Envelope): void {
  useForge.getState().commit(
    "artefact.create",
    `artefact ${env.artefact_id} · ${env.artefact_type} · ${env.integrity.digest.slice(0, 16)}…`,
    (d) => {
      d.artefacts = [env, ...d.artefacts];
    }
  );
}

export function addClaim(c: Claim): void {
  useForge.getState().commit(
    "claim.propose",
    `claim ${c.claim_id} · PROPOSED · ${c.claim_text.slice(0, 40)}`,
    (d) => {
      d.claims = [c, ...d.claims];
    }
  );
}

export function addPlugin(p: Plugin): void {
  useForge.getState().commit(
    "plugin.scaffold",
    `plugin ${p.name} v${p.version} · ${p.hook}`,
    (d) => {
      d.plugins = [p, ...d.plugins];
    }
  );
}

export function togglePlugin(plugin_id: string): void {
  const st = useForge.getState();
  const p = st.d.plugins.find((x) => x.plugin_id === plugin_id);
  if (!p) return;
  st.commit(
    "plugin.toggle",
    `plugin ${p.name} ${p.enabled ? "disabled" : "enabled"}`,
    (d) => {
      d.plugins = d.plugins.map((x) =>
        x.plugin_id === plugin_id ? { ...x, enabled: !x.enabled } : x
      );
    }
  );
}

export function addModule(m: StudiModule): void {
  useForge.getState().commit(
    "studi.create",
    `module ${m.title} · ${m.level} · ${m.mastery}%`,
    (d) => {
      d.modules = [m, ...d.modules];
    }
  );
}

export interface ReviewOutcome {
  before: number;
  after: number;
  reps: number;
  env: Envelope;
}

// Each review adds 9 mastery points (capped at 100), increments reps,
// and emits a learning_submission envelope artefact with mastery_before/after.
export function reviewModule(module_id: string): ReviewOutcome | null {
  const st = useForge.getState();
  const m = st.d.modules.find((x) => x.module_id === module_id);
  if (!m) return null;
  const before = m.mastery;
  const after = Math.min(100, before + 9);
  const reps = m.reps + 1;
  const env = makeEnvelope(
    "learning_submission",
    {
      module_id: m.module_id,
      title: m.title,
      level: m.level,
      mastery_before: before,
      mastery_after: after,
      reps,
    },
    {
      surface: "STUDI",
      provenance_label: "OPERATOR-AUTHORED",
      tier_tag: "Vision",
      limitations: ["mastery is operator-authored, not device-observed"],
    }
  );
  st.commit(
    "studi.review",
    `module ${m.title} · ${before}%→${after}% · reps ${reps}`,
    (d) => {
      d.modules = d.modules.map((x) =>
        x.module_id === module_id
          ? {
              ...x,
              mastery: after,
              reps,
              last_review: Date.now(),
              next_review: Date.now() + 86_400_000,
            }
          : x
      );
      d.artefacts = [env, ...d.artefacts];
    }
  );
  return { before, after, reps, env };
}

export function addSheetRow(r: SheetRow): void {
  useForge.getState().commit(
    "sheet.add",
    `row ${r.param} = ${r.value} ${r.unit}`,
    (d) => {
      d.sheets = [...d.sheets, r];
    }
  );
}

export function removeSheetRow(row_id: string): void {
  const st = useForge.getState();
  const r = st.d.sheets.find((x) => x.row_id === row_id);
  if (!r) return;
  st.commit("sheet.remove", `row ${r.param} removed`, (d) => {
    d.sheets = d.sheets.filter((x) => x.row_id !== row_id);
  });
}

export function seedSheet(): void {
  const rows: SheetRow[] = [
    { row_id: uid("row"), param: "flow_rate", value: 42.8, unit: "L/s", note: "inlet" },
    { row_id: uid("row"), param: "pressure", value: 3.2, unit: "bar", note: "main" },
    { row_id: uid("row"), param: "level", value: 64, unit: "%", note: "tank A" },
    { row_id: uid("row"), param: "turbidity", value: 0.8, unit: "NTU", note: "outlet" },
    { row_id: uid("row"), param: "temp", value: 18.4, unit: "°C", note: "ambient" },
    { row_id: uid("row"), param: "ph", value: 7.1, unit: "—", note: "sample" },
    { row_id: uid("row"), param: "chlorine", value: 0.6, unit: "mg/L", note: "residual" },
    { row_id: uid("row"), param: "volume", value: 980, unit: "kL", note: "capacity" },
  ];
  useForge.getState().commit("sheet.seed", "8 rows seeded", (d) => {
    d.sheets = rows;
  });
}

export function addRun(r: HarnessRun): void {
  useForge.getState().commit(
    "harness.run",
    `run ${r.run_id} · ${r.passed}/${r.total} passed (${r.rate}%)`,
    (d) => {
      d.runs = [r, ...d.runs];
    }
  );
}

export const log = (type: string, detail: string) =>
  useForge.getState().commit(type, detail);

export type { LogEntry };
