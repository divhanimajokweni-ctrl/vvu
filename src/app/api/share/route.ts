import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUid, ensureUser, COOKIE_NAME } from "@/lib/session";
import { TIERS, type Tier } from "@/lib/tiers";
import { appendChainEvent } from "@/lib/chain";
import { randomHex, signToken } from "@/lib/worm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const buildId = String(body.buildId || "");
  if (!buildId) {
    return NextResponse.json({ error: "BUILD_ID_REQUIRED" }, { status: 400 });
  }

  const { uid, isNew } = resolveUid(req.cookies.get(COOKIE_NAME)?.value);
  const user = await ensureUser(uid);

  const build = await db.build.findUnique({ where: { id: buildId } });
  if (!build || build.userId !== user.userId) {
    return NextResponse.json({ error: "BUILD_NOT_FOUND" }, { status: 404 });
  }
  if (build.status !== "BUILT") {
    return NextResponse.json(
      { error: "BUILD_NOT_LIVE", status: build.status },
      { status: 409 }
    );
  }

  const tier = build.tier as Tier;
  const tierCfg = TIERS[tier];

  // Simultaneous active-share cap (1 on free tiers).
  if (tierCfg.maxSimultaneousShares > 0) {
    const active = await db.share.count({
      where: {
        buildId: build.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (active >= tierCfg.maxSimultaneousShares) {
      return NextResponse.json(
        { error: "SHARE_LIMIT_REACHED", max: tierCfg.maxSimultaneousShares },
        { status: 409 }
      );
    }
  }

  const shareId = "sh_" + randomHex(9);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + tierCfg.shareTtlMs);

  const payload = {
    share_id: shareId,
    twin_hash: build.twinHash,
    twin_name: build.twinName,
    tier,
    viewer_limit: tierCfg.viewerLimit,
    expires_at: expiresAt.toISOString(),
    issued_by: user.userId,
    issued_at: now.toISOString(),
  };

  const { token, signature, kid } = await signToken(payload);

  await db.share.create({
    data: {
      shareId,
      buildId: build.id,
      tier,
      viewerLimit: tierCfg.viewerLimit,
      expiresAt,
      tokenPayload: JSON.stringify(payload),
      tokenSig: signature,
    },
  });

  await appendChainEvent({
    buildId: build.id,
    eventType: "TWIN_SHARED",
    payload: {
      share_id: shareId,
      tier,
      viewer_limit: tierCfg.viewerLimit,
      expires_at: expiresAt.toISOString(),
      twin_hash: build.twinHash,
      shared_by: user.userId,
      channel: "link",
      sig_kid: kid,
      watermark: tierCfg.watermark,
    },
  });

  const res = NextResponse.json({
    shareId,
    token,
    shareUrl: `https://share.vvu.co.za/${token}`,
    expiresAt: expiresAt.toISOString(),
    viewerLimit: tierCfg.viewerLimit,
    signature,
    kid,
    payload,
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
