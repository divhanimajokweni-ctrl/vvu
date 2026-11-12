// PRESS rule-based statement extraction + receipt-wording contract.
// Pure functions — no React, no store. Importable by index.tsx and self-tests.
import type {
  PressReceipt,
  Classification,
  ReceiptOutcome,
} from "./store";

export interface Rule {
  id: string;
  classification: Classification;
  pattern: RegExp;
  description: string;
}

// ---- 7 regex classifiers (first matching rule's class wins) ----
export const RULES: Rule[] = [
  {
    id: "R-UNIT",
    classification: "OBSERVATION",
    pattern: /\b\d+(?:\.\d+)?\s*(?:L\/s|kL|bar|%|km|m|kg|NTU|mg\/L)\b/i,
    description:
      "number + unit (L/s, kL, bar, %, km, m, kg, NTU, mg/L)",
  },
  {
    id: "R-MEASURED",
    classification: "OBSERVATION",
    pattern: /\b(?:measured|recorded|observed|logged|read)\b/i,
    description:
      "measurement verb: measured | recorded | observed | logged | read",
  },
  {
    id: "R-AT-TIME",
    classification: "OBSERVATION",
    pattern: /\b(?:\d{2}:\d{2}(?::\d{2})?|\d{4}-\d{2}-\d{2})\b/,
    description: "timestamp HH:MM or YYYY-MM-DD",
  },
  {
    id: "R-SUGGESTS",
    classification: "INTERPRETATION",
    pattern:
      /\b(?:suggests|indicates|appears|seems|likely|consistent with|points to|may mean|could be)\b/i,
    description:
      "hedged verb: suggests | indicates | appears | seems | likely | consistent with | points to | may mean | could be",
  },
  {
    id: "R-THEREFORE",
    classification: "CONCLUSION",
    pattern:
      /\b(?:therefore|thus|hence|so that|consequently|this proves|proves|confirms|demonstrates)\b/i,
    description:
      "connective: therefore | thus | hence | so that | consequently | this proves | proves | confirms | demonstrates",
  },
  {
    id: "R-DETECTED",
    classification: "CONCLUSION",
    pattern:
      /\b(?:(?:system|installation|device|sensor)\s+detected|we\s+detected|(?:is|was)\s+(?:a\s+)?leak)\b/i,
    description:
      "detection attribution: system/installation/device/sensor detected, we detected, is/was a leak",
  },
  {
    id: "R-VERIFIED",
    classification: "CONCLUSION",
    pattern:
      /\b(?:verified|proven|certified|independently confirmed|validated by|confirmed by the chain|chain-verified|tamper-proof|unassailable)\b/i,
    description:
      "unqualified verification claim (matches the banned-word surface for detection, not for output)",
  },
];

// Fallback rule — applied when no rule above matches the sentence.
export const FALLBACK_RULE = {
  id: "R-FALLBACK",
  classification: "INTERPRETATION" as Classification,
  description:
    "no observation rule matched — treated as interpretation until an operator reclassifies it",
};

// ---- sentence splitter: ./!? followed by whitespace ----
export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ExtractedStatement {
  text: string;
  classification: Classification;
  matchedRules: string[];
  rationale: string;
  overridden: boolean;
  original: Classification;
}

// ---- extract statements: first matching rule's class wins ----
export function extractStatements(text: string): ExtractedStatement[] {
  return splitSentences(text).map((s) => {
    const matched: string[] = [];
    let firstClass: Classification | null = null;
    for (const r of RULES) {
      // reset lastIndex defensively in case a global flag is ever added
      r.pattern.lastIndex = 0;
      if (r.pattern.test(s)) {
        matched.push(r.id);
        if (firstClass === null) firstClass = r.classification;
      }
    }
    if (firstClass === null) {
      return {
        text: s,
        classification: FALLBACK_RULE.classification,
        matchedRules: [],
        rationale: FALLBACK_RULE.description,
        overridden: false,
        original: FALLBACK_RULE.classification,
      };
    }
    const rationale = `rules: ${matched.join(
      ", "
    )} — first match wins (${firstClass})`;
    return {
      text: s,
      classification: firstClass,
      matchedRules: matched,
      rationale,
      overridden: false,
      original: firstClass,
    };
  });
}

// ============================================================
// Receipt linkage contract
// ============================================================
export const RECEIPT_STATUSES: ReceiptOutcome[] = [
  "PROVEN",
  "INCONCLUSIVE",
  "NOT_PROVEN",
  "BLOCKED",
];

// matches verification language in input text
export const VERIFICATION_WORDS =
  /\b(?:verified|proven|certified|independently confirmed|validated by|confirmed by the chain|chain-verified|tamper-proof|unassailable)\b/i;

export function scanForVerificationLanguage(text: string): string[] {
  const hits: string[] = [];
  if (!text) return hits;
  const re = new RegExp(VERIFICATION_WORDS.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push(m[0]);
  }
  return hits;
}

export function isReceiptUsable(
  receipt: PressReceipt | null | undefined
): boolean {
  if (!receipt) return false;
  return (
    receipt.outcome === "PROVEN" &&
    !receipt.expired &&
    !receipt.superseded
  );
}

export interface WordingPolicy {
  mayClaimVerification: boolean;
  template?: string;
  wording?: string;
  reason?: string;
}

// only PROVEN (and not expired/superseded) returns mayClaimVerification: true.
// null receipt → reason "no receipt bound — verification claim must be omitted and dependent statements held"
export function allowedWording(
  receipt: PressReceipt | null | undefined
): WordingPolicy {
  if (!receipt) {
    return {
      mayClaimVerification: false,
      reason:
        "no receipt bound — verification claim must be omitted and dependent statements held",
    };
  }
  if (receipt.expired) {
    return {
      mayClaimVerification: false,
      reason: `receipt ${receipt.receipt_id} expired — verification claim must be omitted`,
    };
  }
  if (receipt.superseded) {
    return {
      mayClaimVerification: false,
      reason: `receipt ${receipt.receipt_id} superseded — verification claim must be omitted`,
    };
  }
  if (receipt.outcome !== "PROVEN") {
    return {
      mayClaimVerification: false,
      reason: `outcome ${receipt.outcome} forbids verification language`,
    };
  }
  return {
    mayClaimVerification: true,
    template: `The evidence supports this claim under policy ${receipt.policy}.`,
    wording: `evidence supports this claim under ${receipt.policy}`,
  };
}

// ============================================================
// Status → badge kind
// ============================================================
export function statusToBadge(
  s: string
): "ok" | "info" | "warn" | "bad" | "mut" {
  const map: Record<
    string,
    "ok" | "info" | "warn" | "bad" | "mut"
  > = {
    OBSERVATION: "ok",
    INTERPRETATION: "warn",
    CONCLUSION: "bad",
    PROVEN: "ok",
    INCONCLUSIVE: "warn",
    NOT_PROVEN: "bad",
    BLOCKED: "info",
    DRAFT: "mut",
    APPROVED: "info",
    PUBLISHED: "ok",
    CORRECTED: "warn",
    RETRACTED: "bad",
    OPTED_IN: "ok",
    OPTED_OUT: "bad",
    HELD: "warn",
  };
  return map[s] ?? "mut";
}
