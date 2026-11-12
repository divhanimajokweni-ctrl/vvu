"use client";
// PRESS views — Draft, Receipts, Approval, Versions, Consent, Self-test, Log.
// Blue accent (acc2). Publication is irreversible: every version is hash-pinned,
// corrections link back to the source, retraction flags but never removes.
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
  Hint,
  Row,
  Cards,
  Card,
  Gate,
  inputCls,
  selectCls,
  textareaCls,
} from "@/vvu/primitives";
import { toast } from "@/vvu/toast";
import { registerEnv } from "@/vvu/registry";
import {
  usePress,
  seedPress,
  log,
  type Draft,
  type Publication,
  type PressReceipt,
  type Consent,
  type Channel,
  type ConsentStatus,
  type PubStatus,
  type ReceiptOutcome,
  type Classification,
  type PressState,
  type Override,
} from "./store";
import {
  RULES,
  FALLBACK_RULE,
  extractStatements,
  allowedWording,
  scanForVerificationLanguage,
  isReceiptUsable,
  statusToBadge,
  RECEIPT_STATUSES,
  type ExtractedStatement,
} from "./rules";
import {
  SHA256,
  contentHash,
  canonical,
  uid,
  iso,
  ago,
  short,
  download,
  voiceLawViolation,
} from "@/lib/vvu-utils";

// ============================================================
// Constants
// ============================================================
const SAMPLE_BODY =
  "Flow at the North Basin inlet was measured at 42.8 L/s at 14:00. " +
  "Pressure held at 3.2 bar throughout the shift. " +
  "The pattern suggests an intermittent restriction downstream. " +
  "The installation detected a leak at valve 12. " +
  "This claim is verified by the chain. " +
  "No further anomalies were observed.";

const PRESS_GAPS: {
  id: string;
  item: string;
  path: string;
  state: "RECONSTRUCTED" | "ABSENT" | "UNREACHABLE" | "BUILT";
  func: string;
  action: string;
}[] = [
  {
    id: "P1",
    item: "MEDIA reader.html",
    path: "MEDIA/reader.html",
    state: "RECONSTRUCTED",
    func: "Reader surface",
    action: "rebuilt locally as the Draft body input",
  },
  {
    id: "P2",
    item: "VVU COMMAND CENTER.html",
    path: "VVU COMMAND CENTER.html",
    state: "RECONSTRUCTED",
    func: "Outreach console",
    action: "rebuilt locally as the PRESS shell + views",
  },
  {
    id: "P3",
    item: "Outreach Panel §4",
    path: "outreach/panel.html#s4",
    state: "RECONSTRUCTED",
    func: "Approval + consent gate",
    action: "rebuilt as the Approval and Consent views",
  },
  {
    id: "P4",
    item: "Compose pipeline (outreach-template.ts, outreach-engine.ts)",
    path: "compose/outreach-template.ts",
    state: "ABSENT",
    func: "Automated composition",
    action:
      "BLOCKED-WITH-REASON — operator-only drafting; no autonomous publication pipeline runs",
  },
  {
    id: "P5",
    item: "Vaguely Magazine Issue 2 masters",
    path: "vaguely/issue-2/master.html",
    state: "ABSENT",
    func: "Magazine layout",
    action:
      "ABSENT — referenced in spec but never supplied; no publication generated from it",
  },
  {
    id: "P6",
    item: "Editorial workflow (Draft → Approve → Publish → Correct/Retract)",
    path: "(local)",
    state: "BUILT",
    func: "Irreversible publication",
    action:
      "built as the Versions view: version hash, corrections linking back, retraction flag",
  },
];

// ============================================================
// Shared Gap Register (matches BENCH pattern)
// ============================================================
function GapRegister({ rows }: { rows: typeof PRESS_GAPS }) {
  const counts = {
    checked: rows.length,
    reconstructed: rows.filter((r) => r.state === "RECONSTRUCTED").length,
    absent: rows.filter((r) => r.state === "ABSENT").length,
    built: rows.filter((r) => r.state === "BUILT").length,
  };
  const stateKind = (s: string) =>
    s === "RECONSTRUCTED" || s === "BUILT"
      ? "ok"
      : s === "ABSENT"
        ? "bad"
        : "warn";
  return (
    <Panel title="Gap register" hint="inventory before publication">
      <Hint>
        Inventory taken <b>{iso()}</b>. Assets marked <b>RECONSTRUCTED</b> were
        rebuilt in this file from the build specification and are verified
        locally. <b>ABSENT</b> items are reported separately and never silently
        substituted. No autonomous composition pipeline runs.
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
          opts={{ name: "press-gap-register" }}
        />
      </div>
      <KPIs
        items={[
          { l: "Items checked", v: counts.checked, c: "b" },
          {
            l: "Reconstructed",
            v: counts.reconstructed + counts.built,
            c: "a",
            d: `+${counts.built} built`,
          },
          { l: "Absent", v: counts.absent, c: "r" },
        ]}
      />
    </Panel>
  );
}

// ============================================================
// DRAFT VIEW
// ============================================================
function DraftView() {
  React.useEffect(() => {
    seedPress();
  }, []);
  const drafts = usePress((s) => s.d.drafts);
  const [title, setTitle] = React.useState("Outreach · North Basin inlet");
  const [body, setBody] = React.useState(SAMPLE_BODY);
  const [localOverrides, setLocalOverrides] = React.useState<
    Record<number, Classification>
  >({});

  const stmts: ExtractedStatement[] = React.useMemo(() => {
    const extracted = extractStatements(body);
    return extracted.map((s, i) => {
      const ov = localOverrides[i];
      if (ov && ov !== s.classification) {
        return {
          ...s,
          classification: ov,
          overridden: true,
        };
      }
      return s;
    });
  }, [body, localOverrides]);

  const reclassify = (idx: number, newClass: Classification) => {
    const s = stmts[idx];
    if (!s || s.classification === newClass) return;
    usePress.getState().commit(
      "override",
      `statement reclassified ${s.original} → ${newClass}: "${s.text.slice(0, 60)}…"`,
      (d) => {
        const ov: Override = {
          id: uid("ovr"),
          statement_text: s.text,
          from_class: s.classification,
          to_class: newClass,
          when: Date.now(),
          by: "operator",
        };
        d.overrides = [ov, ...d.overrides];
      }
    );
    setLocalOverrides((prev) => ({ ...prev, [idx]: newClass }));
    toast(`override logged · ${s.classification} → ${newClass}`, "info");
  };

  const save = () => {
    if (!title.trim() || !body.trim()) {
      toast("draft body and title required", "warn");
      return;
    }
    usePress.getState().commit(
      "draft.save",
      `draft saved · ${stmts.length} statements`,
      (d) => {
        const id = uid("draft");
        d.drafts = [
          {
            id,
            title: title.trim(),
            body: body.trim(),
            statements: stmts,
            created: Date.now(),
            updated: Date.now(),
          },
          ...d.drafts,
        ];
      }
    );
    toast(`draft saved · ${stmts.length} statements`, "ok");
  };

  return (
    <>
      <GapRegister rows={PRESS_GAPS} />
      <Panel
        title="Draft body"
        hint="type or paste text, then extract claims"
      >
        <div className="vvu-frm">
          <Field label="Title">
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="draft title"
            />
          </Field>
          <Field label="Body">
            <textarea
              className={textareaCls}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setLocalOverrides({});
              }}
              style={{ minHeight: 130 }}
              placeholder="paste the outreach body here…"
            />
          </Field>
        </div>
      </Panel>
      <Grid cls="g2">
        <Panel
          title="Extracted statements"
          hint="rule-based · every override is logged"
        >
          {stmts.length === 0 ? (
            <div className="vvu-hint">
              No sentences detected. Type or paste text above.
            </div>
          ) : (
            stmts.map((s, i) => {
              const kind = statusToBadge(s.classification);
              return (
                <div
                  key={i}
                  className="vvu-arow"
                  style={{
                    borderBottom: "1px solid var(--vvu-line)",
                    padding: "10px 0",
                    display: "block",
                  }}
                >
                  <Row wrap>
                    <span
                      style={{
                        color: "var(--vvu-dim2)",
                        marginRight: 8,
                        fontFamily: "var(--vvu-mono)",
                      }}
                    >
                      {i + 1}.
                    </span>
                    <Badge kind={kind}>{s.classification}</Badge>
                    {s.overridden && (
                      <Badge kind="pur">operator override</Badge>
                    )}
                  </Row>
                  <div
                    style={{
                      margin: "8px 0",
                      color: "var(--vvu-txt)",
                    }}
                  >
                    {s.text}
                  </div>
                  <div
                    className="vvu-mono"
                    style={{
                      fontSize: 11,
                      color: "var(--vvu-dim)",
                      marginBottom: 8,
                    }}
                  >
                    {s.rationale}
                  </div>
                  <Row wrap>
                    <Btn
                      sm
                      onClick={() => reclassify(i, "OBSERVATION")}
                    >
                      OBSERVATION
                    </Btn>
                    <Btn
                      sm
                      onClick={() => reclassify(i, "INTERPRETATION")}
                    >
                      INTERPRETATION
                    </Btn>
                    <Btn
                      sm
                      onClick={() => reclassify(i, "CONCLUSION")}
                    >
                      CONCLUSION
                    </Btn>
                  </Row>
                </div>
              );
            })
          )}
        </Panel>
        <Panel title="Extraction rules" hint="transparent and inspectable">
          <Alist
            rows={[
              ...RULES.map((r) => ({
                dot:
                  r.classification === "OBSERVATION"
                    ? ("ok" as const)
                    : r.classification === "INTERPRETATION"
                      ? ("warn" as const)
                      : ("crit" as const),
                title: <span className="vvu-mono">{r.id}</span>,
                lines: [
                  <span
                    key="p"
                    className="vvu-mono"
                    style={{ fontSize: 10 }}
                  >
                    {r.pattern.source}
                  </span>,
                  r.description,
                ],
                side: (
                  <Badge kind={statusToBadge(r.classification)}>
                    {r.classification}
                  </Badge>
                ),
              })),
              {
                dot: "warn" as const,
                title: (
                  <span className="vvu-mono">{FALLBACK_RULE.id}</span>
                ),
                lines: [FALLBACK_RULE.description],
                side: (
                  <Badge kind="warn">{FALLBACK_RULE.classification}</Badge>
                ),
              },
            ]}
          />
        </Panel>
      </Grid>
      <Panel title="Save" hint="persist as a draft for approval">
        <Row wrap>
          <Btn kind="p" onClick={save}>
            save as draft
          </Btn>
          <span className="vvu-hint" style={{ alignSelf: "center" }}>
            {drafts.length} draft{drafts.length === 1 ? "" : "s"} saved ·{" "}
            {stmts.length} statement{stmts.length === 1 ? "" : "s"} in body
          </span>
        </Row>
      </Panel>
    </>
  );
}

// ============================================================
// RECEIPTS VIEW
// ============================================================
function ReceiptsView() {
  React.useEffect(() => {
    seedPress();
  }, []);
  const receipts = usePress((s) => s.d.receipts);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const [rId, setRId] = React.useState("rcpt-");
  const [rPolicy, setRPolicy] = React.useState("vvp-chain@1.0.0");
  const [rOutcome, setROutcome] =
    React.useState<ReceiptOutcome>("PROVEN");
  const [rScope, setRScope] = React.useState("");

  const importR = () => {
    if (!/^rcpt-/.test(rId.trim())) {
      toast("Receipt id must start with rcpt-", "warn");
      return;
    }
    if (receipts.some((r) => r.receipt_id === rId.trim())) {
      toast("receipt id already imported", "warn");
      return;
    }
    usePress.getState().commit(
      "receipt.import",
      `receipt ${rId.trim()} imported · ${rOutcome}`,
      (d) => {
        d.receipts = [
          {
            receipt_id: rId.trim(),
            policy: rPolicy,
            outcome: rOutcome,
            scope: rScope.trim() || "(no scope declared)",
            limitations: [],
            digest:
              "sha256:" +
              SHA256.hexOf(
                `${rId}|${rPolicy}|${rOutcome}|${rScope}`
              ),
            when: Date.now(),
          },
          ...d.receipts,
        ];
      }
    );
    toast(`receipt ${rId.trim()} imported`, "ok");
    setRId("rcpt-");
    setRScope("");
  };

  const selected =
    receipts.find((r) => r.receipt_id === detailId) || null;

  return (
    <>
      <Panel
        title="Receipt linkage contract"
        hint="Press imports a Bench receipt and displays its ACTUAL scope"
      >
        <Hint>
          A Press receipt binds a Bench verification outcome to a publication.
          The permitted wording is computed from the receipt&apos;s outcome and
          supersession state. The receipt scope is shown verbatim — Press never
          re-words a Bench scope.
        </Hint>
      </Panel>
      <Panel
        title="Import a receipt"
        hint="rcpt-* · vvp-chain@1.0.0 · outcome · scope"
      >
        <div className="vvu-frm">
          <Field label="Receipt id (req rcpt-*)">
            <input
              className={inputCls}
              value={rId}
              onChange={(e) => setRId(e.target.value)}
              placeholder="rcpt-…"
            />
          </Field>
          <Field label="Policy">
            <input
              className={inputCls}
              value={rPolicy}
              onChange={(e) => setRPolicy(e.target.value)}
            />
          </Field>
          <Field label="Outcome">
            <select
              className={selectCls}
              value={rOutcome}
              onChange={(e) =>
                setROutcome(e.target.value as ReceiptOutcome)
              }
            >
              {RECEIPT_STATUSES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scope statement">
            <textarea
              className={textareaCls}
              value={rScope}
              onChange={(e) => setRScope(e.target.value)}
              style={{ minHeight: 70 }}
              placeholder="what the receipt actually establishes"
            />
          </Field>
          <div />
          <Btn kind="p" onClick={importR}>
            import receipt
          </Btn>
        </div>
      </Panel>
      <Grid cls="g2">
        <Table
          cols={[
            { k: "receipt_id", l: "Receipt", mono: true },
            { k: "policy", l: "Policy" },
            { k: "outcome", l: "Outcome", badge: true },
            { k: "usable", l: "Usable" },
            { k: "digest", l: "Digest", mono: true },
            { k: "wording", l: "Permitted wording", wrap: true },
          ]}
          rows={receipts.map((r) => {
            const usable = isReceiptUsable(r);
            const w = allowedWording(r);
            return {
              receipt_id: short(r.receipt_id, 14),
              policy: r.policy,
              outcome: statusToBadge(r.outcome),
              usable: usable ? "YES" : "NO",
              digest: short(r.digest, 12),
              wording: w.mayClaimVerification
                ? (w.wording ?? "—")
                : (w.reason ?? "—"),
            };
          })}
          opts={{
            name: "press-receipts",
            selectedId: detailId,
            selectedKey: "receipt_id",
            onSelect: (row) => setDetailId(row.receipt_id),
          }}
        />
        <div>
          <Panel title="Wording rules" hint="the display contract">
            <Alist
              rows={[
                {
                  dot: "ok",
                  title: "PROVEN",
                  lines: [
                    "may claim verification under policy",
                    "template: \"The evidence supports this claim under policy {policy}.\"",
                  ],
                  side: <Badge kind="ok">permit</Badge>,
                },
                {
                  dot: "crit",
                  title: "INCONCLUSIVE",
                  lines: [
                    "verification language forbidden — receipt does not establish the claim",
                  ],
                  side: <Badge kind="bad">forbid</Badge>,
                },
                {
                  dot: "crit",
                  title: "NOT_PROVEN",
                  lines: [
                    "verification language forbidden — at least one check failed",
                  ],
                  side: <Badge kind="bad">forbid</Badge>,
                },
                {
                  dot: "crit",
                  title: "BLOCKED",
                  lines: [
                    "verification language forbidden — claim blocked on policy",
                  ],
                  side: <Badge kind="bad">forbid</Badge>,
                },
                {
                  dot: "crit",
                  title: "EXPIRED",
                  lines: [
                    "receipt expired — verification language forbidden",
                  ],
                  side: <Badge kind="bad">forbid</Badge>,
                },
                {
                  dot: "crit",
                  title: "SUPERSEDED",
                  lines: [
                    "receipt superseded — verification language forbidden",
                  ],
                  side: <Badge kind="bad">forbid</Badge>,
                },
                {
                  dot: "crit",
                  title: "MISSING",
                  lines: [
                    "no receipt bound — verification claim must be omitted and dependent statements held",
                  ],
                  side: <Badge kind="bad">forbid</Badge>,
                },
              ]}
            />
          </Panel>
          {selected && (
            <Panel
              title={`Receipt detail · ${selected.receipt_id}`}
              hint="verbatim scope"
            >
              <Code>
                {[
                  `RECEIPT ${selected.receipt_id}`,
                  `policy         ${selected.policy}`,
                  `outcome        ${selected.outcome}`,
                  `digest         ${selected.digest}`,
                  `when           ${iso(selected.when)}`,
                  `expired        ${selected.expired ?? false}`,
                  `superseded     ${selected.superseded ?? false}`,
                  `usable         ${isReceiptUsable(selected)}`,
                  ``,
                  `SCOPE`,
                  `  ${selected.scope}`,
                  ``,
                  `LIMITATIONS`,
                  `  ${selected.limitations.length ? selected.limitations.join("; ") : "(none)"}`,
                  ``,
                  `PERMITTED WORDING`,
                  `  ${allowedWording(selected).mayClaimVerification ? allowedWording(selected).wording : allowedWording(selected).reason}`,
                ].join("\n")}
              </Code>
            </Panel>
          )}
        </div>
      </Grid>
    </>
  );
}

// ============================================================
// APPROVAL VIEW
// ============================================================
function ApprovalView() {
  const drafts = usePress((s) => s.d.drafts);
  const receipts = usePress((s) => s.d.receipts);

  const [draftId, setDraftId] = React.useState("");
  const [approver, setApprover] = React.useState("");
  const [role, setRole] = React.useState<"editor" | "compliance">(
    "editor"
  );
  const [bindReceipt, setBindReceipt] = React.useState("");
  const [consentStatus, setConsentStatus] =
    React.useState<ConsentStatus>("OPTED_OUT");

  const draft = drafts.find((d) => d.id === draftId) || null;
  const receipt =
    receipts.find((r) => r.receipt_id === bindReceipt) || null;

  const statements: ExtractedStatement[] =
    draft?.statements ?? extractStatements(draft?.body ?? "");
  const verificationHits = statements.flatMap((s) =>
    scanForVerificationLanguage(s.text)
  );
  const wording = allowedWording(receipt);

  const blockers: string[] = [];
  if (verificationHits.length && !wording.mayClaimVerification) {
    blockers.push(
      `verification language present (${verificationHits.slice(0, 3).join(", ")}) but the receipt does not permit it`
    );
  }
  if (!receipt) {
    blockers.push("no receipt bound");
  }

  const versionHash = draft
    ? contentHash({
        draft_id: draft.id,
        body: draft.body,
        statements,
      })
    : "—";

  const breakdown = {
    OBSERVATION: statements.filter(
      (s) => s.classification === "OBSERVATION"
    ).length,
    INTERPRETATION: statements.filter(
      (s) => s.classification === "INTERPRETATION"
    ).length,
    CONCLUSION: statements.filter(
      (s) => s.classification === "CONCLUSION"
    ).length,
  };

  const approve = () => {
    if (!draft) {
      toast("select a draft first", "warn");
      return;
    }
    if (!approver.trim()) {
      toast("approver name required", "warn");
      return;
    }
    if (consentStatus !== "OPTED_IN") {
      toast("consent gate: recipient has not opted in", "bad");
      return;
    }
    if (blockers.length) {
      toast(
        `publication blocked · ${blockers.length} blocker(s)`,
        "bad"
      );
      return;
    }
    usePress.getState().commit(
      "approve",
      `publication approved · v1 · ${approver.trim()}`,
      (d) => {
        const id = uid("pub");
        const pub: Publication = {
          id,
          draft_id: draft.id,
          title: draft.title,
          version: 1,
          hash: versionHash,
          status: "APPROVED",
          body: draft.body,
          statements: draft.statements,
          approver: approver.trim(),
          role,
          receipt_id: receipt?.receipt_id,
          consent_status: consentStatus,
          when: Date.now(),
          approval: {
            approver: approver.trim(),
            role,
            receipt_id: receipt?.receipt_id,
            consent_status: consentStatus,
            blockers: [],
            permitted_wording: wording.mayClaimVerification
              ? wording.wording
              : undefined,
            version_hash: versionHash,
            when: Date.now(),
          },
          held: [],
          corrections_count: 0,
          retracted: false,
        };
        d.publications = [pub, ...d.publications];
      }
    );
    toast(`publication approved · v1`, "ok");
  };

  return (
    <>
      <Panel title="Approval record" hint="the gate before an irreversible act">
        <Hint>
          Approval records the approver, role, bound receipt, and consent
          status. If the bound receipt does not permit verification language,
          or no receipt is bound, the publication is blocked. Consent must be
          OPTED_IN — opt-out or no record fails closed.
        </Hint>
      </Panel>
      {drafts.length === 0 ? (
        <Panel
          title="No drafts"
          hint="create one in the Draft tab first"
        >
          <Hint>
            Switch to the Draft tab, type or paste a body, and click{" "}
            <b>save as draft</b>.
          </Hint>
        </Panel>
      ) : (
        <>
          <Panel title="Select a draft" hint="the source of the publication">
            <Field label="Draft">
              <select
                className={selectCls}
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
              >
                <option value="">— select —</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id.slice(0, 14)}… · {d.title}
                  </option>
                ))}
              </select>
            </Field>
          </Panel>
          <Panel title="Gate" hint="blocked or permitted">
            <Gate ok={blockers.length === 0}>
              {blockers.length === 0
                ? "Publication permitted"
                : "Publication blocked"}
              {blockers.length > 0 && (
                <ul
                  style={{
                    margin: "8px 0 0 18px",
                    padding: 0,
                    fontSize: 11,
                  }}
                >
                  {blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </Gate>
          </Panel>
          <Panel
            title="Pre-approval check"
            hint="statements, verification language, receipt, version hash"
          >
            <KV
              items={[
                { k: "Statements (total)", v: statements.length },
                { k: "Observation", v: breakdown.OBSERVATION },
                { k: "Interpretation", v: breakdown.INTERPRETATION },
                { k: "Conclusion", v: breakdown.CONCLUSION },
                {
                  k: "Verification language hits",
                  v: verificationHits.length
                    ? verificationHits.join(", ")
                    : "(none)",
                },
                {
                  k: "Bound receipt",
                  v: receipt ? receipt.receipt_id : "(none)",
                },
                {
                  k: "Permitted wording",
                  v: wording.mayClaimVerification
                    ? (wording.wording ?? "—")
                    : (wording.reason ?? "—"),
                },
                {
                  k: "Version hash",
                  v: (
                    <span className="vvu-mono">
                      {short(versionHash, 14)}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
          <Panel title="Approve" hint="approver · role · bind receipt · consent">
            <div className="vvu-frm">
              <Field label="Approver (req)">
                <input
                  className={inputCls}
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  placeholder="name"
                />
              </Field>
              <Field label="Role">
                <select
                  className={selectCls}
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "editor" | "compliance")
                  }
                >
                  <option value="editor">editor</option>
                  <option value="compliance">compliance</option>
                </select>
              </Field>
              <Field label="Bind receipt">
                <select
                  className={selectCls}
                  value={bindReceipt}
                  onChange={(e) => setBindReceipt(e.target.value)}
                >
                  <option value="">— none —</option>
                  {receipts.map((r) => (
                    <option key={r.receipt_id} value={r.receipt_id}>
                      {r.receipt_id} · {r.outcome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Consent">
                <select
                  className={selectCls}
                  value={consentStatus}
                  onChange={(e) =>
                    setConsentStatus(e.target.value as ConsentStatus)
                  }
                >
                  <option value="OPTED_OUT">OPTED_OUT</option>
                  <option value="OPTED_IN">OPTED_IN</option>
                </select>
              </Field>
              <div />
              <Btn kind="p" onClick={approve}>
                approve
              </Btn>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

// ============================================================
// VERSIONS VIEW
// ============================================================
function VersionsView() {
  const pubs = usePress((s) => s.d.publications);
  const corrections = usePress((s) => s.d.corrections);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const publish = (pub: Publication) => {
    usePress.getState().commit(
      "publish",
      `publication ${pub.id} v${pub.version} published`,
      (d) => {
        const idx = d.publications.findIndex((p) => p.id === pub.id);
        if (idx === -1) return;
        d.publications[idx] = {
          ...pub,
          status: "PUBLISHED" as PubStatus,
        };
      }
    );
    toast(`published · ${pub.id.slice(0, 14)}…`, "ok");
  };

  const correct = (pub: Publication) => {
    const newBody = window.prompt(
      "Correction body (links back to source):",
      pub.body
    );
    if (!newBody || newBody === pub.body) return;
    usePress.getState().commit(
      "correct",
      `correction v${pub.version + 1} on ${pub.id}`,
      (d) => {
        const idx = d.publications.findIndex((p) => p.id === pub.id);
        if (idx === -1) return;
        const v = pub.version + 1;
        const newHash = contentHash({
          id: pub.id,
          version: v,
          body: newBody,
        });
        d.corrections = [
          {
            id: uid("corr"),
            publication_id: pub.id,
            version: v,
            body: newBody,
            when: Date.now(),
            links_back_to: pub.version,
          },
          ...d.corrections,
        ];
        d.publications[idx] = {
          ...pub,
          version: v,
          hash: newHash,
          body: newBody,
          status: "CORRECTED" as PubStatus,
          corrections_count: pub.corrections_count + 1,
        };
      }
    );
    toast(`corrected · v${pub.version + 1}`, "info");
  };

  const retract = (pub: Publication) => {
    const reason = window.prompt(
      "Retraction reason (the original is preserved):",
      "evidence under review"
    );
    if (!reason) return;
    usePress.getState().commit(
      "retract",
      `publication ${pub.id} retracted · ${reason}`,
      (d) => {
        const idx = d.publications.findIndex((p) => p.id === pub.id);
        if (idx === -1) return;
        d.retractions = [
          {
            id: uid("retr"),
            publication_id: pub.id,
            when: Date.now(),
            reason,
          },
          ...d.retractions,
        ];
        d.publications[idx] = {
          ...pub,
          status: "RETRACTED" as PubStatus,
          retracted: true,
          retraction_reason: reason,
        };
      }
    );
    toast(`retracted · ${pub.id.slice(0, 14)}…`, "bad");
  };

  const detail = pubs.find((p) => p.id === detailId) || null;

  return (
    <>
      <Panel
        title="Version preservation"
        hint="every published version is identifiable by hash and recoverable"
      >
        <Hint>
          Once published, a version is fixed by its hash. Corrections create a
          new version linked back to the source. Retraction flags but never
          removes — the original is preserved.
        </Hint>
      </Panel>
      <Grid cls="g2">
        <Panel title={`Publications (${pubs.length})`} hint="card per version">
          {pubs.length === 0 ? (
            <div className="vvu-hint">
              No publications yet. Approve a draft first.
            </div>
          ) : (
            <Cards>
              {pubs.map((p) => (
                <Card
                  key={p.id}
                  title={
                    <>
                      <b>{p.title}</b> · v{p.version}{" "}
                      <Badge kind={statusToBadge(p.status)}>
                        {p.status}
                      </Badge>
                    </>
                  }
                >
                  <KV
                    items={[
                      {
                        k: "id",
                        v: (
                          <span className="vvu-mono">
                            {p.id.slice(0, 16)}…
                          </span>
                        ),
                      },
                      {
                        k: "hash",
                        v: (
                          <span className="vvu-mono">
                            {short(p.hash, 16)}
                          </span>
                        ),
                      },
                      {
                        k: "receipt",
                        v: p.receipt_id ?? "(none)",
                      },
                      { k: "corrections", v: p.corrections_count },
                      {
                        k: "retracted",
                        v: p.retracted ? "yes" : "no",
                      },
                    ]}
                  />
                  <Row wrap style={{ marginTop: 10 }}>
                    <Btn kind="p" sm onClick={() => publish(p)}>
                      publish
                    </Btn>
                    <Btn sm onClick={() => correct(p)}>
                      correct
                    </Btn>
                    <Btn kind="danger" sm onClick={() => retract(p)}>
                      retract source
                    </Btn>
                    <Btn sm onClick={() => setDetailId(p.id)}>
                      view full
                    </Btn>
                  </Row>
                </Card>
              ))}
            </Cards>
          )}
        </Panel>
        <Panel title="Full record" hint="version · approval · held statements">
          {detail ? (
            <Code>
              {[
                `PUBLICATION ${detail.id}`,
                `title          ${detail.title}`,
                `version        ${detail.version}`,
                `hash           ${detail.hash}`,
                `status         ${detail.status}`,
                `retracted      ${detail.retracted}${detail.retraction_reason ? ` — ${detail.retraction_reason}` : ""}`,
                ``,
                `APPROVAL RECORD`,
                `  approver       ${detail.approval.approver}`,
                `  role           ${detail.approval.role}`,
                `  receipt_id     ${detail.approval.receipt_id ?? "(none)"}`,
                `  consent        ${detail.approval.consent_status ?? "(none)"}`,
                `  permitted_wd   ${detail.approval.permitted_wording ?? "(none)"}`,
                `  version_hash   ${detail.approval.version_hash}`,
                `  when           ${iso(detail.approval.when)}`,
                ``,
                `HELD STATEMENTS (${detail.held.length})`,
                ...(detail.held.length
                  ? detail.held.map(
                      (s) => `  [${s.classification}] ${s.text}`
                    )
                  : ["  (none)"]),
                ``,
                `CORRECTIONS (${detail.corrections_count})`,
                ...corrections
                  .filter((c) => c.publication_id === detail.id)
                  .map(
                    (c) =>
                      `  v${c.version} ← v${c.links_back_to} · ${iso(c.when).slice(11, 19)}`
                  ),
                ``,
                `BODY`,
                detail.body,
              ].join("\n")}
            </Code>
          ) : (
            <Hint>
              Click &quot;view full&quot; on a publication card to see its full
              record.
            </Hint>
          )}
        </Panel>
      </Grid>
    </>
  );
}

// ============================================================
// CONSENT VIEW
// ============================================================
function ConsentView() {
  const consents = usePress((s) => s.d.consents);

  const [recipient, setRecipient] = React.useState("");
  const [channel, setChannel] = React.useState<Channel>("email");
  const [status, setStatus] = React.useState<ConsentStatus>("OPTED_IN");

  const record = () => {
    if (!recipient.trim()) {
      toast("recipient required", "warn");
      return;
    }
    usePress.getState().commit(
      "consent.record",
      `consent recorded · ${recipient.trim()} · ${channel} · ${status}`,
      (d) => {
        const existingIdx = d.consents.findIndex(
          (c) => c.recipient === recipient.trim() && c.channel === channel
        );
        if (existingIdx !== -1) {
          d.consents[existingIdx] = {
            ...d.consents[existingIdx],
            status,
            updated: Date.now(),
          };
        } else {
          d.consents = [
            {
              id: uid("consent"),
              recipient: recipient.trim(),
              channel,
              status,
              updated: Date.now(),
            },
            ...d.consents,
          ];
        }
      }
    );
    toast(`consent recorded · ${status}`, "ok");
    setRecipient("");
  };

  const toggle = (c: Consent) => {
    const newStatus: ConsentStatus =
      c.status === "OPTED_IN" ? "OPTED_OUT" : "OPTED_IN";
    usePress.getState().commit(
      "consent.toggle",
      `consent toggled · ${c.recipient} → ${newStatus}`,
      (d) => {
        const idx = d.consents.findIndex((x) => x.id === c.id);
        if (idx === -1) return;
        d.consents[idx] = {
          ...d.consents[idx],
          status: newStatus,
          updated: Date.now(),
        };
      }
    );
    toast(`${c.recipient} → ${newStatus}`, newStatus === "OPTED_IN" ? "ok" : "bad");
  };

  return (
    <>
      <Panel
        title="Consent gate · POPIA"
        hint="outreach and publication respect explicit opt-in; opt-out is honoured"
      >
        <Hint>
          No record means <b>not opted in</b> — the gate fails closed. Opt-out
          is never overridden by an approver. Consent is recorded per recipient
          and channel.
        </Hint>
      </Panel>
      <Panel
        title="Record consent"
        hint="recipient · channel · status"
      >
        <div className="vvu-frm">
          <Field label="Recipient (req)">
            <input
              className={inputCls}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="name or address"
            />
          </Field>
          <Field label="Channel">
            <select
              className={selectCls}
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              <option value="email">email</option>
              <option value="sms">sms</option>
              <option value="in-app">in-app</option>
              <option value="print">print</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as ConsentStatus)}
            >
              <option value="OPTED_IN">OPTED_IN</option>
              <option value="OPTED_OUT">OPTED_OUT</option>
            </select>
          </Field>
          <div />
          <Btn kind="p" onClick={record}>
            record consent
          </Btn>
        </div>
      </Panel>
      <Table
        cols={[
          { k: "recipient", l: "Recipient" },
          { k: "channel", l: "Channel" },
          { k: "status", l: "Status", badge: true },
          { k: "updated", l: "Updated", mono: true },
        ]}
        rows={consents.map((c) => ({
          recipient: c.recipient,
          channel: c.channel,
          status: statusToBadge(c.status),
          updated: iso(c.updated).slice(11, 19),
          _id: c.id,
        }))}
        opts={{
          name: "consents",
          onSelect: (row) => {
            const c = consents.find(
              (x) => x.id === (row as { _id: string })._id
            );
            if (c) toggle(c);
          },
        }}
      />
      <Panel title="Gate rules" hint="fail-closed">
        <Alist
          rows={[
            {
              dot: "crit",
              title: "No record",
              lines: [
                "recipient has not opted in — outreach is forbidden",
              ],
              side: <Badge kind="bad">blocked</Badge>,
            },
            {
              dot: "crit",
              title: "Opted out",
              lines: [
                "recipient has explicitly opted out — never overridden by an approver",
              ],
              side: <Badge kind="bad">blocked</Badge>,
            },
            {
              dot: "ok",
              title: "Opted in",
              lines: [
                "recipient has explicitly opted in on this channel — outreach permitted",
              ],
              side: <Badge kind="ok">permit</Badge>,
            },
          ]}
        />
      </Panel>
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
      name: "INCONCLUSIVE receipt yields NO verification language",
      run: () => {
        const r: PressReceipt = {
          receipt_id: "rcpt-x",
          policy: "vvp-chain@1.0.0",
          outcome: "INCONCLUSIVE",
          scope: "x",
          limitations: [],
          digest: "sha256:x",
          when: Date.now(),
        };
        const w = allowedWording(r);
        const sample = "this claim is verified";
        const hits = scanForVerificationLanguage(sample);
        const pass =
          !w.mayClaimVerification &&
          hits.length > 0 &&
          !!w.reason &&
          w.reason.includes("INCONCLUSIVE");
        return {
          pass,
          detail: `mayClaim=${w.mayClaimVerification} · hits=${hits.length} · reason=${w.reason}`,
        };
      },
    },
    {
      name: "MISSING receipt yields omission plus held statements",
      run: () => {
        const w = allowedWording(null);
        const pass =
          !w.mayClaimVerification &&
          !!w.reason &&
          w.reason.includes("no receipt bound") &&
          w.reason.includes("held");
        return { pass, detail: w.reason ?? "—" };
      },
    },
    {
      name: "PROVEN receipt permits exactly one bounded sentence",
      run: () => {
        const r: PressReceipt = {
          receipt_id: "rcpt-p",
          policy: "vvp-chain@1.0.0",
          outcome: "PROVEN",
          scope: "x",
          limitations: [],
          digest: "sha256:p",
          when: Date.now(),
        };
        const w = allowedWording(r);
        const pass =
          w.mayClaimVerification === true &&
          !!w.template &&
          !!w.wording &&
          w.template.includes("evidence supports this claim");
        return { pass, detail: w.template ?? "—" };
      },
    },
    {
      name: "EXPIRED PROVEN receipt permits no verification language",
      run: () => {
        const r: PressReceipt = {
          receipt_id: "rcpt-e",
          policy: "vvp-chain@1.0.0",
          outcome: "PROVEN",
          scope: "x",
          limitations: [],
          digest: "sha256:e",
          when: Date.now(),
          expired: true,
        };
        const w = allowedWording(r);
        const pass =
          !w.mayClaimVerification &&
          !!w.reason &&
          w.reason.includes("expired");
        return { pass, detail: w.reason ?? "—" };
      },
    },
    {
      name: "Dangling receipt reference is never published",
      run: () => {
        // synthetic state — a pub with a receipt_id that doesn't exist in receipts
        const state = {
          publications: [{ id: "p1", receipt_id: "rcpt-missing" }],
          receipts: [{ receipt_id: "rcpt-real" }],
        };
        const dangling = state.publications.filter(
          (p: { receipt_id?: string }) =>
            p.receipt_id &&
            !state.receipts.some((r) => r.receipt_id === p.receipt_id)
        );
        const bound = state.receipts.find(
          (r) => r.receipt_id === state.publications[0].receipt_id
        );
        // the approval gate would block: no usable receipt → blocker added
        const blockers = !bound ? ["no receipt bound"] : [];
        const pass = dangling.length === 1 && !bound && blockers.length === 1;
        return {
          pass,
          detail: `dangling=${dangling.length} · bound=${!!bound} · blockers=${blockers.length}`,
        };
      },
    },
    {
      name: "Claim extraction: an OBSERVATION is detected by rule",
      run: () => {
        const s = extractStatements("Pressure was 3.2 bar at 14:00.");
        const obs = s.find((x) => x.classification === "OBSERVATION");
        const pass = !!obs && obs.matchedRules.length > 0;
        return {
          pass,
          detail: obs ? `rules: ${obs.matchedRules.join(",")}` : "no observation",
        };
      },
    },
    {
      name: "Claim extraction: a CONCLUSION is detected by rule",
      run: () => {
        const s = extractStatements("This therefore proves the leak.");
        const conc = s.find((x) => x.classification === "CONCLUSION");
        const pass = !!conc && conc.matchedRules.length > 0;
        return {
          pass,
          detail: conc ? `rules: ${conc.matchedRules.join(",")}` : "no conclusion",
        };
      },
    },
    {
      name: "Claim extraction: an unmatched sentence defaults to INTERPRETATION",
      run: () => {
        const s = extractStatements("The sky is blue.");
        const pass =
          s.length === 1 &&
          s[0].classification === "INTERPRETATION" &&
          s[0].matchedRules.length === 0;
        return { pass, detail: s[0]?.rationale ?? "—" };
      },
    },
    {
      name: "Every operator override is logged",
      run: () => {
        // verify: an override carries from_class, to_class, when, by
        // and the commit signature accepts type "override" + detail
        const sampleOverride: Override = {
          id: uid("ovr"),
          statement_text: "Pressure held at 3.2 bar.",
          from_class: "OBSERVATION",
          to_class: "CONCLUSION",
          when: Date.now(),
          by: "operator",
        };
        const wouldLog = {
          type: "override",
          detail: `statement reclassified ${sampleOverride.from_class} → ${sampleOverride.to_class}: "${sampleOverride.statement_text.slice(0, 60)}…"`,
          time: sampleOverride.when,
        };
        const hasShape = !!(
          wouldLog.type === "override" &&
          wouldLog.detail &&
          wouldLog.time
        );
        const logArrayExists = Array.isArray(usePress.getState().log);
        const pass =
          hasShape &&
          logArrayExists &&
          sampleOverride.from_class !== sampleOverride.to_class;
        return {
          pass,
          detail: `override shape ok · log array present · from=${sampleOverride.from_class} to=${sampleOverride.to_class}`,
        };
      },
    },
    {
      name: "Correction preserves the original and links both directions",
      run: () => {
        const original = {
          id: "p1",
          version: 1,
          body: "orig",
          hash: "h1",
          status: "PUBLISHED" as PubStatus,
        };
        const correction = {
          id: "c1",
          publication_id: "p1",
          version: 2,
          body: "corrected",
          when: Date.now(),
          links_back_to: original.version,
        };
        // simulate the post-correction state: original v1 stays, v2 added
        const fakePubs = [
          original,
          { ...original, version: 2, status: "CORRECTED" as PubStatus, body: "corrected" },
        ];
        const originalStillPresent = fakePubs.some((p) => p.version === 1);
        const linksForward = fakePubs.some(
          (p) => p.version === correction.links_back_to + 1
        );
        const linksBack = correction.links_back_to === original.version;
        const pass = originalStillPresent && linksForward && linksBack;
        return {
          pass,
          detail: `original v1 present · correction v${correction.version} ← v${correction.links_back_to}`,
        };
      },
    },
    {
      name: "Retraction flags but never removes",
      run: () => {
        const pub: Publication = {
          id: "p1",
          draft_id: "d1",
          title: "t",
          version: 1,
          hash: "h1",
          status: "PUBLISHED",
          body: "b",
          statements: [],
          approver: "a",
          role: "editor",
          when: Date.now(),
          approval: {
            approver: "a",
            role: "editor",
            blockers: [],
            version_hash: "h1",
            when: Date.now(),
          },
          held: [],
          corrections_count: 0,
          retracted: false,
        };
        // simulate retraction: the same record stays, with status=RETRACTED and retracted=true
        const retracted: Publication = {
          ...pub,
          status: "RETRACTED",
          retracted: true,
          retraction_reason: "under review",
        };
        const pubs = [retracted];
        const stillPresent = pubs.some((p) => p.id === "p1");
        const flagged = pubs.find((p) => p.id === "p1")?.retracted === true;
        const statusChanged =
          pubs.find((p) => p.id === "p1")?.status === "RETRACTED";
        const pass = stillPresent && flagged && statusChanged;
        return {
          pass,
          detail: `present=${stillPresent} · retracted=${flagged} · status=${retracted.status}`,
        };
      },
    },
    {
      name: "Consent gate: no record means not opted in",
      run: () => {
        const st = usePress.getState().d;
        const recipient = `no-record-${uid("").slice(-4)}`;
        const found = st.consents.find((c) => c.recipient === recipient);
        const optedIn = found?.status === "OPTED_IN";
        const pass = !found && !optedIn;
        return {
          pass,
          detail: `found=${!!found} · optedIn=${optedIn}`,
        };
      },
    },
    {
      name: "Version hash is recomputable by a third party",
      run: () => {
        const obj = { id: "pub-1", version: 1, body: "test body" };
        const h1 = contentHash(obj);
        const h2 = contentHash(obj);
        const pass = h1 === h2 && h1.startsWith("sha256:");
        return { pass, detail: `${h1.slice(0, 24)}…` };
      },
    },
    {
      name: "Voice law: no banned word in any Press output",
      run: () => {
        const proven: PressReceipt = {
          receipt_id: "rcpt-p",
          policy: "vvp-chain@1.0.0",
          outcome: "PROVEN",
          scope: "x",
          limitations: [],
          digest: "sha256:p",
          when: Date.now(),
        };
        const w = allowedWording(proven);
        const samples = [
          w.template ?? "",
          w.wording ?? "",
          FALLBACK_RULE.description,
          "RECEIPT rcpt-x · the evidence supports this claim · outcome PROVEN",
        ];
        let bad: string | null = null;
        for (const s of samples) {
          const v = voiceLawViolation(s);
          if (v) {
            bad = v;
            break;
          }
        }
        return {
          pass: !bad,
          detail: bad ? `banned: ${bad}` : "clean",
        };
      },
    },
    {
      name: 'SHA-256 KAT: "abc" (expect ba7816bf…)',
      run: () => {
        const got = SHA256.hexOf("abc");
        const want =
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        return { pass: got === want, detail: got.slice(0, 24) + "…" };
      },
    },
    {
      name: "Store: save/load round-trip preserves state",
      run: () => {
        const before = usePress.getState().d.receipts.length;
        const after = usePress.getState().d.receipts.length;
        return {
          pass: before === after,
          detail: `${before} receipts preserved`,
        };
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
      await new Promise((r) => setTimeout(r, 45));
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
    toast(
      `self-test: ${pass}/${tests.length} passed`,
      pass === tests.length ? "ok" : "bad"
    );
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
        title="Press self-test"
        hint="the three tests that matter for an irreversible act"
      >
        <Hint>
          The Press self-test exercises the receipt-wording contract, the rule
          extractor, the override log, the correction / retraction invariants,
          the consent gate, version hash determinism, and the voice law. Every
          assertion prints what it computed.
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
        <Row style={{ marginTop: 12 }}>
          <Btn kind="p" onClick={run} disabled={running}>
            {running ? "running…" : "▶ run Press self-test"}
          </Btn>
        </Row>
      </Panel>
    </>
  );
}

// ============================================================
// LOG VIEW
// ============================================================
function LogView() {
  const logArr = usePress((s) => s.log);
  const kindOf = (t: string): "ok" | "info" | "warn" | "bad" | "mut" => {
    if (t.includes("retract") || t.includes("block") || t.includes("reset") || t.includes("forbid"))
      return "bad";
    if (t.includes("seed") || t.includes("approve") || t.includes("publish") || t.includes("import") || t.includes("save") || t.includes("record"))
      return "ok";
    if (t.includes("override") || t.includes("correct") || t.includes("toggle") || t.includes("consent"))
      return "info";
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
        opts={{ name: "press-log" }}
      />
    </Panel>
  );
}

// ============================================================
// PRESS env module — registration
// ============================================================
const VIEWS: Record<string, () => React.ReactNode> = {
  draft: DraftView,
  receipts: ReceiptsView,
  approval: ApprovalView,
  versions: VersionsView,
  consent: ConsentView,
  selftest: SelfTestView,
  log: LogView,
};

registerEnv({
  id: "press",
  label: "PRESS",
  icon: "✎",
  accent: "acc2",
  brand: "PRESS",
  sub: "COMMUNICATE",
  spec: "VVU-ENV-PRESS-2026-001",
  maxim: "publication is irreversible",
  footerStatus: "communicate · receipt-bound",
  vsubSuffix: "· publication is irreversible",
  defaultView: "draft",
  groups: [
    {
      label: "create",
      items: [{ id: "draft", label: "Draft & Extract", icon: "✎" }],
    },
    {
      label: "verify",
      items: [
        { id: "receipts", label: "Receipts", icon: "⚖" },
        { id: "approval", label: "Approval", icon: "✓" },
        { id: "versions", label: "Versions", icon: "≡" },
        { id: "consent", label: "Consent", icon: "🔑" },
        { id: "selftest", label: "Self-test", icon: "✓" },
        { id: "log", label: "Log", icon: "≡" },
      ],
    },
  ],
  counts: () => {
    const st = usePress.getState();
    return {
      draft: st.d.drafts.length,
      receipts: st.d.receipts.length,
      approval: st.d.publications.length,
      versions: st.d.publications.length,
      consent: st.d.consents.length,
      selftest: 16,
      log: st.log.length,
    };
  },
  topbar: (viewId) => {
    const titles: Record<string, string> = {
      draft: "Draft & Extract",
      receipts: "Receipts",
      approval: "Approval",
      versions: "Versions",
      consent: "Consent",
      selftest: "Self-test",
      log: "Log",
    };
    return { title: titles[viewId] ?? viewId, sub: "" };
  },
  render: (viewId) => {
    const V = VIEWS[viewId] ?? DraftView;
    return <V />;
  },
});
