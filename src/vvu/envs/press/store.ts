// PRESS store — drafts, publications, receipts, corrections, retractions, consents, overrides.
// makeStore-backed, persisted to "press.vvu.v1". No "use client" (this is a .ts module).
import { makeStore, LogEntry } from "@/vvu/store";
import { SHA256, uid } from "@/lib/vvu-utils";

export type Classification = "OBSERVATION" | "INTERPRETATION" | "CONCLUSION";

export interface DraftStatement {
  text: string;
  classification: Classification;
  matchedRules: string[];
  rationale: string;
  overridden: boolean;
  original: Classification;
}

export interface Draft {
  id: string;
  title: string;
  body: string;
  statements: DraftStatement[];
  created: number;
  updated: number;
}

export type ReceiptOutcome = "PROVEN" | "INCONCLUSIVE" | "NOT_PROVEN" | "BLOCKED";

export interface PressReceipt {
  receipt_id: string;
  policy: string;
  outcome: ReceiptOutcome;
  scope: string;
  limitations: string[];
  digest: string;
  when: number;
  expired?: boolean;
  superseded?: boolean;
}

export type PubStatus = "DRAFT" | "APPROVED" | "PUBLISHED" | "CORRECTED" | "RETRACTED";

export interface ApprovalRecord {
  approver: string;
  role: string;
  receipt_id?: string;
  consent_status?: "OPTED_IN" | "OPTED_OUT";
  blockers: string[];
  permitted_wording?: string;
  version_hash: string;
  when: number;
}

export interface Publication {
  id: string;
  draft_id: string;
  title: string;
  version: number;
  hash: string;
  status: PubStatus;
  body: string;
  statements: DraftStatement[];
  approver: string;
  role: string;
  receipt_id?: string;
  consent_status?: "OPTED_IN" | "OPTED_OUT";
  when: number;
  approval: ApprovalRecord;
  held: DraftStatement[];
  corrections_count: number;
  retracted: boolean;
  retraction_reason?: string;
}

export interface Correction {
  id: string;
  publication_id: string;
  version: number;
  body: string;
  when: number;
  links_back_to: number;
}

export interface Retraction {
  id: string;
  publication_id: string;
  when: number;
  reason: string;
}

export type Channel = "email" | "sms" | "in-app" | "print";
export type ConsentStatus = "OPTED_IN" | "OPTED_OUT";

export interface Consent {
  id: string;
  recipient: string;
  channel: Channel;
  status: ConsentStatus;
  updated: number;
}

export interface Override {
  id: string;
  statement_text: string;
  from_class: Classification;
  to_class: Classification;
  when: number;
  by: string;
}

export interface PressState {
  drafts: Draft[];
  publications: Publication[];
  receipts: PressReceipt[];
  corrections: Correction[];
  retractions: Retraction[];
  consents: Consent[];
  overrides: Override[];
}

const ENV_KEY = "press.vvu.v1";

const initialState = (): PressState => ({
  drafts: [],
  publications: [],
  receipts: [],
  corrections: [],
  retractions: [],
  consents: [],
  overrides: [],
});

export const usePress = makeStore<PressState>(ENV_KEY, initialState);

// ---- seed two receipts on first load (idempotent) ----
// rcpt-proven-1 — PROVEN, scope = the chain rows linked from genesis to the bound head digest
// rcpt-incon-1 — INCONCLUSIVE, signature check couldn't run because key unavailable
export function seedPress(): void {
  const st = usePress.getState();
  if (st.d.receipts.length > 0) return;
  st.commit(
    "seed",
    "2 receipts seeded · rcpt-proven-1 (PROVEN) · rcpt-incon-1 (INCONCLUSIVE)",
    (d) => {
      d.receipts = [
        {
          receipt_id: "rcpt-proven-1",
          policy: "vvp-chain@1.0.0",
          outcome: "PROVEN",
          scope:
            "the chain rows linked from genesis to the bound head digest",
          limitations: [],
          digest:
            "sha256:" +
            SHA256.hexOf("rcpt-proven-1|vvp-chain@1.0.0|PROVEN|chain-rows-from-genesis"),
          when: Date.now() - 86400000,
        },
        {
          receipt_id: "rcpt-incon-1",
          policy: "vvp-chain@1.0.0",
          outcome: "INCONCLUSIVE",
          scope:
            "signature check couldn't run because key unavailable",
          limitations: ["signature check not executed — key unavailable"],
          digest:
            "sha256:" +
            SHA256.hexOf("rcpt-incon-1|vvp-chain@1.0.0|INCONCLUSIVE|signature-key-unavailable"),
          when: Date.now() - 43200000,
        },
      ];
    }
  );
}

// helper for views that just want to write a log entry without mutating data
export const log = (type: string, detail: string) =>
  usePress.getState().commit(type, detail);

export type { LogEntry };
