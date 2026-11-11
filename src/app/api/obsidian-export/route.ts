import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUid, ensureUser, COOKIE_NAME } from "@/lib/session";
import { appendChainEvent } from "@/lib/chain";
import { sha256Buf, verifyChain, type ChainEventRow } from "@/lib/worm";
import { TIERS, type Tier } from "@/lib/tiers";

export const runtime = "nodejs";

const MIT_LICENSE = `MIT License

Copyright (c) ${new Date().getFullYear()} the twin author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const buildId = String(body.buildId || "");

  const { uid, isNew } = resolveUid(req.cookies.get(COOKIE_NAME)?.value);
  const user = await ensureUser(uid);

  const build = await db.build.findUnique({ where: { id: buildId } });
  if (!build || build.userId !== user.userId) {
    return NextResponse.json({ error: "BUILD_NOT_FOUND" }, { status: 404 });
  }

  const tier = build.tier as Tier;
  const tierCfg = TIERS[tier];

  if (tierCfg.export === "NONE") {
    return NextResponse.json(
      { error: "EXPORT_NOT_AVAILABLE", tier, hint: "Upgrade to commercial." },
      { status: 403 }
    );
  }
  if (tierCfg.export === "MIT_ONCE" && user.exportUsed) {
    return NextResponse.json(
      { error: "EXPORT_ALREADY_USED", hint: "MIT export is single-use on the free tier." },
      { status: 403 }
    );
  }

  // Recompute the chain root for the export's provenance front-matter.
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

  const exportedAt = new Date();
  const chainLog = mapped
    .map(
      (r) =>
        `- [${r.seq}] \`${r.eventType}\` · source \`${r.sourceHash.slice(0, 12)}…\` · chain \`${r.chainHash.slice(0, 12)}…\``
    )
    .join("\n");

  const markdown = `---
twin_name: ${JSON.stringify(build.twinName)}
twin_hash: ${build.twinHash}
build_id: ${build.id}
tier: ${build.tier}
surface: ${build.surface}
fidelity: ${build.fidelity}
licence: MIT
exported_at: ${exportedAt.toISOString()}
chain_verdict: ${verdict.valid ? "VERIFIED" : "BROKEN"}
chain_root: ${verdict.valid ? verdict.root : "—"}
event_count: ${rows.length}
---

# ${build.twinName}

> Exported from Venture Vision Ubuntu under the **MIT licence**. This file is
> yours forever. The twin it describes has a TTL; this note does not.

## Provenance

The twin fingerprint is:

\`\`\`
${build.twinHash}
\`\`\`

The WORM chain that proves what happened to this twin recomputes to the
following root (SHA-256, RFC-8785 JCS canonicalisation, Ed25519-signed tokens):

\`\`\`
${verdict.valid ? verdict.root : "CHAIN BROKEN — see events"}
\`\`\`

**Verdict:** ${verdict.valid ? "✅ VERIFIED" : "❌ BROKEN"}

## Event log

${chainLog}

---

${MIT_LICENSE}
`;

  const buf = Buffer.from(markdown, "utf8");
  const fileHash = sha256Buf(buf);

  await db.export.create({
    data: {
      buildId: build.id,
      licence: "MIT",
      fileHash,
      sizeBytes: buf.length,
    },
  });

  await appendChainEvent({
    buildId: build.id,
    eventType: "TWIN_EXPORTED",
    payload: {
      build_id: build.id,
      twin_hash: build.twinHash,
      licence: "MIT",
      file_hash: fileHash,
      size_bytes: buf.length,
      chain_root: verdict.valid ? verdict.root : "",
    },
  });

  if (tierCfg.export === "MIT_ONCE") {
    await db.user.update({
      where: { id: user.userId },
      data: { exportUsed: true },
    });
  }

  const res = NextResponse.json({
    ok: true,
    buildId: build.id,
    twinName: build.twinName,
    twinHash: build.twinHash,
    licence: "MIT",
    fileHash,
    sizeBytes: buf.length,
    markdown,
    chainVerdict: verdict.valid ? "VERIFIED" : "BROKEN",
    chainRoot: verdict.valid ? verdict.root : "",
    exportedAt: exportedAt.toISOString(),
    exportUsed: tierCfg.export === "MIT_ONCE" ? true : user.exportUsed,
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
