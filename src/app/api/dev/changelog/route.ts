import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev/changelog
// Returns all changelog entries ordered by publishedAt desc.
export async function GET() {
  await seedWorkspaceIfEmpty();
  const items = await db.changelogEntry.findMany({
    orderBy: { publishedAt: "desc" },
  });
  return NextResponse.json({ items });
}
