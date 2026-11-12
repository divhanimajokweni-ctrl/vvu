import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev/roadmap
// Returns all roadmap items, grouped by milestone (Q1, Q2, Q3, Q4, Backlog).
export async function GET() {
  await seedWorkspaceIfEmpty();
  const items = await db.roadmapItem.findMany({
    orderBy: { createdAt: "asc" },
  });

  const milestones = ["Q1", "Q2", "Q3", "Q4", "Backlog"] as const;
  const grouped: Record<string, typeof items> = {};
  for (const m of milestones) grouped[m] = [];
  for (const item of items) {
    const key = grouped[item.milestone] ? item.milestone : "Backlog";
    grouped[key].push(item);
  }

  return NextResponse.json({ milestones: grouped });
}
