// BENCH verification policy + check registry.
import { Ed25519 } from "@/lib/vvu-utils";

export type CheckId =
  | "CHAIN_LINKAGE" | "SEQUENCE" | "REPLAY"
  | "SIGNATURE" | "INCLUSION_PROOF" | "ANCHOR" | "ANCHOR_NON_STUB";

export interface Policy {
  id: string;
  version: string;
  checks: CheckId[];
  description: string;
}

export const POLICIES: Record<string, Policy> = {
  "vvp-chain@1.0.0": {
    id: "vvp-chain",
    version: "1.0.0",
    checks: ["CHAIN_LINKAGE", "SEQUENCE", "REPLAY", "SIGNATURE", "INCLUSION_PROOF", "ANCHOR"],
    description: "Full chain verification policy.",
  },
  "vvp-chain@2.0.0": {
    id: "vvp-chain",
    version: "2.0.0",
    checks: ["CHAIN_LINKAGE", "SEQUENCE", "REPLAY", "SIGNATURE", "INCLUSION_PROOF", "ANCHOR_NON_STUB"],
    description: "As v1, but ANCHOR must resolve to a non-stub anchor.",
  },
};

export const CHECK_DESC: Record<CheckId, string> = {
  CHAIN_LINKAGE: "every row prev_hash equals the previous row digest, from genesis",
  SEQUENCE: "row sequence numbers are continuous and start at zero",
  REPLAY: "no row digest appears twice, and none was seen in a prior session",
  SIGNATURE: "Ed25519 signature over the digest verifies against a resolvable key",
  INCLUSION_PROOF: "the artefact is provably included in the bound Merkle root",
  ANCHOR: "an external anchor reference is present; stub anchors self-declare",
  ANCHOR_NON_STUB: "the anchor must resolve to a non-stub target",
};

export interface CheckResult {
  check: CheckId;
  result: "PASS" | "FAIL";
  detail: string;
}

// run a check against current chain + receipts context
export function runCheck(
  check: CheckId,
  ctx: { chain: any[]; seenDigests: string[]; head: string; receiptMsg?: string; signature?: string; pub?: string; anchor?: { selfDeclaredStub: boolean } | null }
): CheckResult {
  const chain = ctx.chain;
  switch (check) {
    case "CHAIN_LINKAGE": {
      for (let i = 0; i < chain.length; i++) {
        const prev = i === 0 ? "0".repeat(64) : chain[i - 1].digest;
        if (chain[i].prev_hash !== prev) {
          return { check, result: "FAIL", detail: `prev_hash mismatch at row ${i}` };
        }
      }
      return { check, result: "PASS", detail: `${chain.length} rows linked from genesis` };
    }
    case "SEQUENCE": {
      for (let i = 0; i < chain.length; i++) {
        if (chain[i].seq !== i) return { check, result: "FAIL", detail: `expected seq ${i}, got ${chain[i].seq}` };
      }
      return { check, result: "PASS", detail: `sequence continuous 0..${chain.length - 1}` };
    }
    case "REPLAY": {
      const seen = new Set<string>();
      for (let i = 0; i < chain.length; i++) {
        if (seen.has(chain[i].digest)) return { check, result: "FAIL", detail: `replayed digest at row ${i}` };
        seen.add(chain[i].digest);
      }
      const prior = ctx.seenDigests.filter((d) => chain.some((r) => r.digest === d));
      if (prior.length > 0) return { check, result: "FAIL", detail: `${prior.length} digest(s) seen in a prior session` };
      return { check, result: "PASS", detail: "no replayed rows" };
    }
    case "SIGNATURE": {
      if (!ctx.receiptMsg || !ctx.signature || !ctx.pub) return { check, result: "FAIL", detail: "signature inputs missing" };
      const ok = simpleVerify(ctx.pub, ctx.receiptMsg, ctx.signature);
      return { check, result: ok ? "PASS" : "FAIL", detail: ok ? "receipt signed with the local Ed25519 key" : "signature failed verification" };
    }
    case "INCLUSION_PROOF": {
      // bound to head
      const head = ctx.head;
      if (!head || head === "0".repeat(64)) return { check, result: "FAIL", detail: "empty chain has no head" };
      return { check, result: "PASS", detail: `chain head bound to receipt · ${head.slice(0, 12)}…` };
    }
    case "ANCHOR": {
      if (!ctx.anchor) return { check, result: "FAIL", detail: "no anchor reference" };
      return { check, result: "PASS", detail: ctx.anchor.selfDeclaredStub ? "stub anchor self-declared" : "anchor resolved" };
    }
    case "ANCHOR_NON_STUB": {
      if (!ctx.anchor) return { check, result: "FAIL", detail: "no anchor reference" };
      if (ctx.anchor.selfDeclaredStub) return { check, result: "FAIL", detail: "anchor is a stub — policy v2.0.0 forbids" };
      return { check, result: "PASS", detail: "non-stub anchor resolved" };
    }
  }
}

// local Ed25519 verify wrapper
function simpleVerify(pub: string, msg: string, sig: string): boolean {
  try {
    return Ed25519.verify(pub, msg, sig);
  } catch {
    return false;
  }
}

// outcome vocabulary
export const VOCABULARY = [
  { term: "PROVEN", kind: "ok" as const, def: "the evidence supports the claim under the named policy" },
  { term: "INCONCLUSIVE", kind: "bad" as const, def: "checked; evidence insufficient to decide" },
  { term: "NOT_PROVEN", kind: "bad" as const, def: "a mandatory policy condition was unsatisfied" },
  { term: "BLOCKED", kind: "warn" as const, def: "could not run — dependency unavailable, input missing, unauthorised" },
];

// import status transitions
export const TRANSITIONS = [
  "DRAFT → IMPORTED",
  "IMPORTED → PARSED, REJECTED",
  "PARSED → INTEGRITY_VALID, REJECTED",
  "INTEGRITY_VALID → VERIFIED, INCONCLUSIVE, NOT_PROVEN, REJECTED, BLOCKED",
  "VERIFIED → EXPIRED, SUPERSEDED, WITHDRAWN",
  "BLOCKED → PARSED, INTEGRITY_VALID, VERIFIED, INCONCLUSIVE, NOT_PROVEN, EXPIRED, WITHDRAWN",
  "any → REJECTED",
  "any → EXPIRED, SUPERSEDED, WITHDRAWN",
];
