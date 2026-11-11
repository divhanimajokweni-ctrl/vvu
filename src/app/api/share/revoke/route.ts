import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUid, ensureUser, COOKIE_NAME } from "@/lib/session";
import { appendChainEvent } from "@/lib/chain";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const shareId = String(body.shareId || "");
  if (!shareId) {
    return NextResponse.json({ error: "SHARE_ID_REQUIRED" }, { status: 400 });
  }

  const { uid, isNew } = resolveUid(req.cookies.get(COOKIE_NAME)?.value);
  const user = await ensureUser(uid);

  const share = await db.share.findUnique({ where: { shareId } });
  if (!share) {
    return NextResponse.json({ error: "SHARE_NOT_FOUND" }, { status: 404 });
  }
  const build = await db.build.findUnique({ where: { id: share.buildId } });
  if (!build || build.userId !== user.userId) {
    return NextResponse.json({ error: "NOT_OWNER" }, { status: 403 });
  }
  if (share.revokedAt) {
    return NextResponse.json({ error: "ALREADY_REVOKED" }, { status: 409 });
  }

  const revokedAt = new Date();
  await db.share.update({
    where: { id: share.id },
    data: { revokedAt },
  });

  await appendChainEvent({
    buildId: build.id,
    eventType: "SHARE_REVOKED",
    payload: {
      share_id: share.shareId,
      revoked_at: revokedAt.toISOString(),
      revoked_by: user.userId,
    },
  });

  const res = NextResponse.json({ ok: true, shareId, revokedAt });
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
