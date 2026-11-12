import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/docs/qr — server-side QR generation for THE DOCUMENTS (#/docs,
// Task 46 — the operator's field request: "I want to get the QR code").
// The caller passes the payload to encode:
//   * a URL derived from window.location.origin at runtime (the master QR —
//     no URL is ever invented here; it is whatever address actually serves
//     this build, plus the #/docs hash), or
//   * the compact TEXT of a document (the honest fallback that works
//     everywhere — the QR carries the content itself, no server needed).
// Payloads are capped: QRs beyond ~1000 chars become too dense to scan
// reliably, so long documents are rejected with a stated reason instead of
// being silently truncated.
const MAX_PAYLOAD = 1000;

export async function POST(req: NextRequest) {
  let payload: string | undefined;
  try {
    const body = (await req.json()) as { payload?: string };
    payload = body.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!payload || !payload.trim()) {
    return NextResponse.json({ error: 'payload required' }, { status: 400 });
  }
  if (payload.length > MAX_PAYLOAD) {
    return NextResponse.json(
      {
        error: `payload too long for a scannable QR (${payload.length} > ${MAX_PAYLOAD} chars) — use the COPY button instead of the QR`,
        cap: MAX_PAYLOAD,
      },
      { status: 413 },
    );
  }
  try {
    // Same brand treatment as the field pairing card (Task 37): dark modules
    // on lime — high contrast, scannable, unmistakably this estate's output.
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#060806', light: '#c8ff00' },
    });
    return NextResponse.json({ dataUrl, chars: payload.length }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'QR generation failed' },
      { status: 500 },
    );
  }
}
