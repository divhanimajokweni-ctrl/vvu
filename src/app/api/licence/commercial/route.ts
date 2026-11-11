import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUid, ensureUser, COOKIE_NAME } from "@/lib/session";
import { appendChainEvent } from "@/lib/chain";
import { randomHex, signToken } from "@/lib/worm";

export const runtime = "nodejs";

/**
 * The commercial gate. In production this fires after a Stitch / Paystack
 * webhook validates. Here we simulate the post-payment state so the loop is
 * demonstrable end-to-end.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const buildId = String(body.buildId || "");
  const rail = String(body.rail || "STITCH").toUpperCase() === "PAYSTACK"
    ? "PAYSTACK"
    : "STITCH";

  const { uid, isNew } = resolveUid(req.cookies.get(COOKIE_NAME)?.value);
  const user = await ensureUser(uid);

  const build = await db.build.findUnique({ where: { id: buildId } });
  if (!build || build.userId !== user.userId) {
    return NextResponse.json({ error: "BUILD_NOT_FOUND" }, { status: 404 });
  }

  const licenceId = "Vvu-CL-" + randomHex(6);
  const issuedAt = new Date();

  await db.user.update({
    where: { id: user.userId },
    data: { tier: "COMMERCIAL", licenceId },
  });

  const payload = {
    licence_id: licenceId,
    build_id: build.id,
    twin_hash: build.twinHash,
    tier: "COMMERCIAL",
    payment_rail: rail,
    issued_to: user.userId,
    issued_at: issuedAt.toISOString(),
    persistence: "configurable",
    export: "unrestricted",
  };
  const { token, signature, kid } = await signToken(payload as never);

  await appendChainEvent({
    buildId: build.id,
    eventType: "COMMERCIAL_LICENCE_ISSUED",
    payload: {
      licence_id: licenceId,
      build_id: build.id,
      twin_hash: build.twinHash,
      payment_rail: rail,
      sig_kid: kid,
      issued_at: issuedAt.toISOString(),
    },
  });

  const res = NextResponse.json({
    ok: true,
    licenceId,
    rail,
    issuedAt: issuedAt.toISOString(),
    token,
    signature,
    kid,
    payload,
    note:
      rail === "STITCH"
        ? "Settled via Stitch (SA card / instant EFT / PayShap). T+1."
        : "Settled via Paystack (international card / EFT). T+1.",
  });
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
