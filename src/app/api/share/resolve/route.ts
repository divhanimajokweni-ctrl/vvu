import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendChainEvent } from "@/lib/chain";
import { verifyToken, viewerHash } from "@/lib/worm";

export const runtime = "nodejs";

/**
 * The viewer endpoint — what a recipient of a share link sees.
 * No signup, no account. Validates the Ed25519 signature, checks TTL, counts
 * unique viewers (privacy-preserving hash), appends a SHARE_VIEWED event.
 *
 * This is the Resend model: the share is the delivery, the view is the
 * receipt. Then it's done.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const verified = await verifyToken(token);

  if (!verified.ok) {
    return NextResponse.json(
      { state: "SHARE_INVALID", reason: verified.reason },
      { status: 401 }
    );
  }

  const { payload } = verified;
  const share = await db.share.findUnique({
    where: { shareId: payload.share_id },
  });
  if (!share) {
    return NextResponse.json({ state: "SHARE_UNKNOWN" }, { status: 404 });
  }

  const now = new Date();

  if (share.revokedAt) {
    return NextResponse.json({
      state: "SHARE_REVOKED",
      shareId: share.shareId,
      revokedAt: share.revokedAt.toISOString(),
      twinName: payload.twin_name,
      twinHash: payload.twin_hash,
    });
  }

  if (now > share.expiresAt) {
    const views = await db.shareView.count({
      where: { shareRef: share.shareId },
    });
    await appendChainEvent({
      buildId: share.buildId,
      eventType: "SHARE_EXPIRED",
      payload: {
        share_id: share.shareId,
        expired_at: share.expiresAt.toISOString(),
        total_views: views,
      },
    });
    return NextResponse.json({
      state: "SHARE_EXPIRED",
      shareId: share.shareId,
      expiredAt: share.expiresAt.toISOString(),
      totalViews: views,
      twinName: payload.twin_name,
      twinHash: payload.twin_hash,
    });
  }

  // Viewer dedup — SHA-256(IP + UA + shareId). Counts once per recipient.
  // The optional `fp` query is a demo affordance: it salts the UA so the
  // simulator can show multiple distinct recipients (real opens dedup by the
  // real fingerprint — no fp).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";
  const fp = req.nextUrl.searchParams.get("fp");
  const uaRaw = req.headers.get("user-agent") || "unknown";
  const ua = fp ? `${uaRaw}::${fp}` : uaRaw;
  const vHash = viewerHash(ip, ua, share.shareId);

  const already = await db.shareView.findFirst({
    where: { shareRef: share.shareId, viewerHash: vHash },
  });

  if (!already) {
    const tierLimit = share.viewerLimit;
    if (tierLimit > 0 && share.viewerCount >= tierLimit) {
      const views = await db.shareView.count({
        where: { shareRef: share.shareId },
      });
      await appendChainEvent({
        buildId: share.buildId,
        eventType: "SHARE_EXHAUSTED",
        payload: {
          share_id: share.shareId,
          total_views: views,
          limit: tierLimit,
        },
      });
      return NextResponse.json({
        state: "SHARE_EXHAUSTED",
        shareId: share.shareId,
        viewerLimit: tierLimit,
        totalViews: views,
        twinName: payload.twin_name,
        twinHash: payload.twin_hash,
      });
    }

    await db.shareView.create({
      data: { shareRef: share.shareId, viewerHash: vHash },
    });
    const updated = await db.share.update({
      where: { id: share.id },
      data: { viewerCount: { increment: 1 } },
    });
    await appendChainEvent({
      buildId: share.buildId,
      eventType: "SHARE_VIEWED",
      payload: {
        share_id: share.shareId,
        viewer_hash: vHash,
        viewer_index: updated.viewerCount,
        ts: now.toISOString(),
      },
    });
  }

  const refreshed = await db.share.findUnique({
    where: { id: share.id },
  });
  const build = await db.build.findUnique({ where: { id: share.buildId } });

  return NextResponse.json({
    state: "SHARE_LIVE",
    shareId: share.shareId,
    twinName: payload.twin_name,
    twinHash: payload.twin_hash,
    tier: payload.tier,
    surface: build?.surface ?? "rig",
    fidelity: build?.fidelity ?? "T1",
    viewerLimit: share.viewerLimit,
    viewerCount: refreshed?.viewerCount ?? share.viewerCount,
    expiresAt: share.expiresAt.toISOString(),
  });
}
