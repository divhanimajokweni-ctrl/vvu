import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/dev/docs/[slug]
// Returns a single doc page by slug, including the markdown body.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  await seedWorkspaceIfEmpty();
  const { slug } = await params;
  const doc = await db.docPage.findUnique({ where: { slug } });
  if (!doc) {
    return NextResponse.json(
      { error: `doc not found: ${slug}` },
      { status: 404 },
    );
  }
  return NextResponse.json({ doc });
}
