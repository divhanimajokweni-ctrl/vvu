import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUid, ensureUser, COOKIE_NAME } from "@/lib/session";
import {
  TIERS,
  tierForUser,
  FREE_DAILY_WINDOW_MS,
  type Tier,
} from "@/lib/tiers";
import { appendChainEvent, twinHashOf } from "@/lib/chain";
import { randomHex } from "@/lib/worm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const twinName = String(body.twinName || "Untitled twin").slice(0, 80);
  const surface = String(body.surface || "rig").slice(0, 24);
  const fidelity = String(body.fidelity || "T1").slice(0, 4);

  const { uid, isNew } = resolveUid(req.cookies.get(COOKIE_NAME)?.value);
  const user = await ensureUser(uid);

  const buildTier: Tier = tierForUser({
    freeBuildUsed: user.freeBuildUsed,
    tier: user.tier,
  });

  // Daily rate limit — only on the daily tier (the free build is one-shot).
  if (buildTier === "FREE_DAILY" && user.lastBuildAt) {
    const elapsed = Date.now() - user.lastBuildAt.getTime();
    if (elapsed < FREE_DAILY_WINDOW_MS) {
      const retryInMs = FREE_DAILY_WINDOW_MS - elapsed;
      return NextResponse.json(
        {
          error: "DAILY_LIMIT",
          retryInMs,
          retryAt: new Date(Date.now() + retryInMs).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  const tierCfg = TIERS[buildTier];
  const nonce = randomHex(8);
  const twinHash = twinHashOf({
    twin_name: twinName,
    surface,
    fidelity,
    user_id: user.userId,
    nonce,
  });
  const now = Date.now();
  const expiresAt = new Date(now + tierCfg.storageTtlMs);

  const build = await db.build.create({
    data: {
      userId: user.userId,
      twinName,
      twinHash,
      tier: buildTier,
      fidelity,
      surface,
      status: "BUILT",
      expiresAt,
    },
  });

  await appendChainEvent({
    buildId: build.id,
    eventType: "TWIN_BUILT",
    payload: {
      build_id: build.id,
      twin_name: twinName,
      twin_hash: twinHash,
      tier: buildTier,
      fidelity,
      surface,
      expires_at: expiresAt.toISOString(),
      mode: "SIM",
      compute: "Puter.js (client-side)",
    },
  });

  // The first free build consumes the one-time entitlement.
  await db.user.update({
    where: { id: user.userId },
    data: {
      freeBuildUsed: buildTier === "FREE_BUILD" ? true : user.freeBuildUsed,
      lastBuildAt: new Date(now),
    },
  });

  const res = NextResponse.json({
    buildId: build.id,
    twinName,
    twinHash,
    tier: buildTier,
    fidelity,
    surface,
    expiresAt: expiresAt.toISOString(),
    persistenceMs: tierCfg.storageTtlMs,
    share: {
      ttlMs: tierCfg.shareTtlMs,
      viewerLimit: tierCfg.viewerLimit,
      export: tierCfg.export,
      watermark: tierCfg.watermark,
    },
    freeBuildUsed: buildTier === "FREE_BUILD" ? true : user.freeBuildUsed,
  });
  if (isNew) {
    res.cookies.set(COOKIE_NAME, uid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}
