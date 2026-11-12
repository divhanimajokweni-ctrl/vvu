// mini-services/safegrid/src/policy.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAFEGRID SUPPRESSION POLICY — §4 of the ordering-integration contract.
//
// POLICY INVARIANT (REPORTED — operator-decided, binding, unchanged):
//   Suppression is authorized ONLY by a positive predicate.
//   risk === 'low' alone is NOT authorization.
//
//   suppressionAuthorized(ctx) :=
//     ctx.policy === 'fresh' &&
//     ctx.localConsentValid &&
//     ctx.localCeilingAllows &&
//     ctx.risk === 'low' &&
//     (ctx.vvu === 'healthy' ||
//      (ctx.vvu === 'degraded' && ctx.backlogDepth <= ctx.backlogCeiling))
//
//   Anywhere suppression is decided:
//     if (!suppressionAuthorized(ctx)) {
//       return ctx.risk === 'high' ? 'escalate' : 'hold';
//     }
//     return 'suppress';
//
// Missing proof delays suppression. It NEVER silently authorizes it.
// Every input to the predicate is locally valid evidence (SafeGrid owns
// the immediate decision); VVU state enters only as the delivery-health
// gate, and an UNKNOWN VVU state is 'unavailable' (fail closed).
//
// Evidence tags:
//   · predicate + branch table = SPEC (§4, restated binding)
//   · POLICY_MAX_AGE_MS / ceiling / window numbers = SPEC (must be
//     measured in the pilot — see §7 limits in worklog R57)
// ─────────────────────────────────────────────────────────────────────────────

export type Risk = 'low' | 'high' | 'unknown';
export type VvuState = 'healthy' | 'degraded' | 'unavailable';
export type PolicyFreshness = 'fresh' | 'stale' | 'missing';
export type Decision = 'suppress' | 'hold' | 'escalate';

/** Everything suppressionAuthorized may look at. All fields are local
 * evidence or the probed VVU delivery-health snapshot. */
export interface DecisionContext {
  policy: PolicyFreshness | 'fresh' | 'stale' | 'missing';
  localConsentValid: boolean;
  localCeilingAllows: boolean;
  risk: Risk;
  vvu: VvuState;
  backlogDepth: number;
  backlogCeiling: number;
}

/** §4 — the positive predicate, verbatim. */
export function suppressionAuthorized(ctx: DecisionContext): boolean {
  return (
    ctx.policy === 'fresh' &&
    ctx.localConsentValid &&
    ctx.localCeilingAllows &&
    ctx.risk === 'low' &&
    (ctx.vvu === 'healthy' ||
     (ctx.vvu === 'degraded' && ctx.backlogDepth <= ctx.backlogCeiling))
  );
}

/** §4 — the decision rule, verbatim. There is no third path: if the
 * predicate cannot say YES, the answer is hold (or escalate on high risk).
 * This function has no I/O and no clock — callers snapshot evidence. */
export function decide(ctx: DecisionContext): Decision {
  if (!suppressionAuthorized(ctx)) {
    return ctx.risk === 'high' ? 'escalate' : 'hold';
  }
  return 'suppress';
}

// ─── Local evidence providers ────────────────────────────────────────────────
// Policy store: an epoch-stamped policy document. Freshness is measured
// against POLICY_MAX_AGE_MS (SPEC — pilot must measure). No document
// loaded ⇒ 'missing' ⇒ never suppress.

export interface PolicyDocument {
  epoch: number;
  fetchedAt: number; // epoch ms — informational (freshness window, not ordering)
}

export const POLICY_MAX_AGE_MS = Number(process.env.SAFEGRID_POLICY_MAX_AGE_MS ?? 5 * 60_000); // SPEC

export class PolicyStore {
  private doc: PolicyDocument | null = null;

  set(doc: PolicyDocument): void {
    this.doc = { epoch: doc.epoch, fetchedAt: doc.fetchedAt };
  }

  clear(): void {
    this.doc = null;
  }

  snapshot(): { freshness: PolicyFreshness; epoch: number | null } {
    if (!this.doc) return { freshness: 'missing', epoch: null };
    const age = Date.now() - this.doc.fetchedAt;
    return { freshness: age <= POLICY_MAX_AGE_MS ? 'fresh' : 'stale', epoch: this.doc.epoch };
  }
}

// Consent store: per-tenant suppression consent with expiry. Absent or
// expired ⇒ invalid ⇒ never suppress.

export interface ConsentRecord {
  tenantId: string;
  expiresAt: number; // epoch ms — informational (validity window, not ordering)
}

export class ConsentStore {
  private byTenant = new Map<string, ConsentRecord>();

  grant(tenantId: string, ttlMs: number): void {
    this.byTenant.set(tenantId, { tenantId, expiresAt: Date.now() + ttlMs });
  }

  revoke(tenantId: string): void {
    this.byTenant.delete(tenantId);
  }

  valid(tenantId: string): boolean {
    const r = this.byTenant.get(tenantId);
    return !!r && Date.now() < r.expiresAt;
  }
}

// Ceiling: max suppressions per tenant per rolling window. The window is a
// RATE LIMIT (policy input), not an ordering fact — §1.4 forbids using
// timestamps to establish ORDER, not to bound rates. The count query lives
// with the decision store (routes/alerts.ts).

export const SUPPRESSION_CEILING = Number(process.env.SAFEGRID_SUPPRESSION_CEILING ?? 10); // SPEC
export const CEILING_WINDOW_MS = Number(process.env.SAFEGRID_CEILING_WINDOW_MS ?? 60 * 60_000); // SPEC
