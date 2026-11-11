import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyChain, type ChainEventRow } from "@/lib/worm";
import { TIERS, type Tier } from "@/lib/tiers";

export const runtime = "nodejs";

/**
 * The receipt — provable, shareable, no ownership check. A commercial customer
 * shows this to their auditor as proof of legal commercial deployment.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  const { buildId } = await params;
  const build = await db.build.findUnique({ where: { id: buildId } });
  if (!build) {
    return NextResponse.json({ error: "BUILD_NOT_FOUND" }, { status: 404 });
  }

  const tier = build.tier as Tier;
  const tierCfg = TIERS[tier];

  const rows = await db.chainEvent.findMany({
    where: { buildId: build.id },
    orderBy: { seq: "asc" },
  });
  const mapped: ChainEventRow[] = rows.map((r) => ({
    seq: r.seq,
    eventType: r.eventType,
    payload: r.payload,
    sourceHash: r.sourceHash,
    chainHash: r.chainHash,
  }));
  const verdict = verifyChain(mapped);

  const exports = await db.export.findMany({
    where: { buildId: build.id },
    orderBy: { createdAt: "asc" },
  });
  const shares = await db.share.findMany({
    where: { buildId: build.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    receipt: {
      build_id: build.id,
      twin_name: build.twinName,
      twin_hash: build.twinHash,
      tier: build.tier,
      persistence: `${tierCfg.storageTtlMs / 3600000}h`,
      commercial_use: tierCfg.commercial ? "permitted" : "prohibited",
      export_licence:
        tierCfg.export === "NONE"
          ? "not available"
          : tierCfg.export === "MIT_ONCE"
            ? "MIT (single-use)"
            : "MIT (unrestricted)",
      share_lifetime: `${Math.round(tierCfg.shareTtlMs / 3600000)}h`,
      viewer_limit: tierCfg.viewerLimit === 0 ? "unlimited" : tierCfg.viewerLimit,
      chain_verdict: verdict.valid ? "VERIFIED" : "BROKEN",
      chain_root: verdict.valid ? verdict.root : "",
      event_count: rows.length,
      mode: "SIM",
    },
    events: mapped,
    exports: exports.map((e) => ({
      licence: e.licence,
      file_hash: e.fileHash,
      size_bytes: e.sizeBytes,
      created_at: e.createdAt.toISOString(),
    })),
    shares: shares.map((s) => ({
      share_id: s.shareId,
      tier: s.tier,
      viewer_count: s.viewerCount,
      viewer_limit: s.viewerLimit,
      expires_at: s.expiresAt.toISOString(),
      revoked: !!s.revokedAt,
    })),
  });
}
