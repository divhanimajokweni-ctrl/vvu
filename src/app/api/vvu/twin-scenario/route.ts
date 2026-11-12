import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// src/app/api/vvu/twin-scenario/route.ts — serves the Municipal Twin
// wildfire artifact (public/twin/cape_town_wildfire.html) and exposes its
// integrity facts. The md5 + byte count are COMPUTED FROM DISK on every
// request — never hardcoded — so the provenance strip in TwinFrame can
// never lie about what is actually being served.
//
//   GET /api/vvu/twin-scenario        → the artifact HTML (same-origin →
//                                        the WORM pin can reach it via
//                                        iframe.contentDocument)
//   GET /api/vvu/twin-scenario?meta=1 → { md5, bytes, path, servedAt }

const ARTIFACT_PATH = join(
  process.cwd(),
  'public',
  'twin',
  'cape_town_wildfire.html'
);

function artifactFacts() {
  const buf = readFileSync(ARTIFACT_PATH);
  const md5 = createHash('md5').update(buf).digest('hex');
  return { md5, bytes: buf.byteLength };
}

export async function GET(req: NextRequest) {
  try {
    const facts = artifactFacts();
    const meta = req.nextUrl.searchParams.get('meta');

    if (meta === '1') {
      return NextResponse.json({
        ...facts,
        path: 'public/twin/cape_town_wildfire.html',
        servedAt: new Date().toISOString(),
        honesty: 'SEED DATA · NOT LIVE',
      });
    }

    const html = readFileSync(ARTIFACT_PATH, 'utf-8');
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Artifact-Md5': facts.md5,
        'X-Artifact-Bytes': String(facts.bytes),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `ARTIFACT_UNREADABLE: ${e.message}`
            : 'ARTIFACT_UNREADABLE',
      },
      { status: 500 }
    );
  }
}
