import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyChain, type ChainEventRow } from "@/lib/worm";

export const runtime = "nodejs";

/**
 * Recompute the whole chain from seq 0 — offline, no API key, no network.
 * This is the "the user can recompute the chain independently" invariant.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  const { buildId } = await params;
  const rows = await db.chainEvent.findMany({
    where: { buildId },
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
  return NextResponse.json({
    buildId,
    count: rows.length,
    events: mapped,
    verdict,
  });
}
