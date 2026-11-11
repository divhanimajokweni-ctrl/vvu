// VVU session — zero-signup anonymous user, tracked via a signed cookie.
// The model demands "no card, no signup funnel"; this is how we honour it.

import { db } from "@/lib/db";
import { randomHex } from "@/lib/worm";
import type { Tier } from "@/lib/tiers";

export const COOKIE_NAME = "vvu_uid";

export type Session = {
  userId: string;
  isNew: boolean;
};

/**
 * Resolve the current demo user from a cookie value. If the cookie is absent
 * or stale, mint a fresh anonymous id. The User row is created lazily on the
 * first build to keep read paths cheap.
 */
export function resolveUid(cookieValue: string | undefined): {
  uid: string;
  isNew: boolean;
} {
  if (cookieValue && /^[a-z0-9]{16,32}$/i.test(cookieValue)) {
    return { uid: cookieValue, isNew: false };
  }
  return { uid: randomHex(12), isNew: true };
}

export async function ensureUser(uid: string): Promise<{
  userId: string;
  freeBuildUsed: boolean;
  exportUsed: boolean;
  tier: Tier;
  lastBuildAt: Date | null;
}> {
  const email = `anon-${uid}@vvu.local`;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return {
      userId: existing.id,
      freeBuildUsed: existing.freeBuildUsed,
      exportUsed: existing.exportUsed,
      tier: existing.tier as Tier,
      lastBuildAt: existing.lastBuildAt,
    };
  }
  const created = await db.user.create({
    data: { email, tier: "FREE_DAILY" },
  });
  return {
    userId: created.id,
    freeBuildUsed: false,
    exportUsed: false,
    tier: "FREE_DAILY",
    lastBuildAt: null,
  };
}
