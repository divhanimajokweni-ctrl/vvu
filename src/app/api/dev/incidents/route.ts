import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev/incidents
// Returns all incidents ordered by startedAt desc.
export async function GET() {
  await seedWorkspaceIfEmpty();
  const items = await db.incident.findMany({
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ items });
}
