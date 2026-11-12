import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev/contributions?type=ISSUE&state=OPEN&repo=air-kernel
// Returns all contributions, optionally filtered.
export async function GET(req: Request) {
  await seedWorkspaceIfEmpty();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const state = url.searchParams.get("state");
  const repo = url.searchParams.get("repo");

  const where: {
    type?: string;
    state?: string;
    repo?: string;
  } = {};
  if (type) where.type = type;
  if (state) where.state = state;
  if (repo) where.repo = repo;

  const items = await db.contribution.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}
