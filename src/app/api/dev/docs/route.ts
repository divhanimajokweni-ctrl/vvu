import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev/docs
// Returns the doc index: id, slug, title, category, order, updatedAt (NO bodies).
export async function GET() {
  await seedWorkspaceIfEmpty();
  const items = await db.docPage.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      order: true,
      updatedAt: true,
    },
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ items });
}
