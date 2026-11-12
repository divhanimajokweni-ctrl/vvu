import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/docs/compliance — serves the compliance pack markdown (and the
// operator field guide) from disk (Task 46; guide added for the security-firm
// cold-outreach round). The operator's field message: "you're no longer
// supplying me with these types of documents" — the documents existed as
// files in the repo, unreachable from a phone in the field. This route makes
// them readable in THE DOCUMENTS view (#/docs), honestly:
//   * fixed server-side allowlist — the client never controls a path;
//   * per-file honest error states — an unreadable file reports its error,
//     it is never faked or silently dropped;
//   * ids align with COMPLIANCE_PACK in src/lib/ops-data.ts (TOS /
//     COMPLAINTS / CONSENT / B2B) so the view can cross-reference the
//     ledger's purpose text; the offer document is the manifest J1
//     cross-reference. The GUIDE id is rendered by the FIELD GUIDE section
//     (variant="guide"), not the compliance pack section.
const DOCS: { id: string; fallbackTitle: string; file: string }[] = [
  { id: 'TOS', fallbackTitle: 'Terms of Service', file: 'ProofBridge/compliance/TERMS-OF-SERVICE.md' },
  { id: 'COMPLAINTS', fallbackTitle: 'Complaints Procedure', file: 'ProofBridge/compliance/COMPLAINTS-PROCEDURE.md' },
  { id: 'CONSENT', fallbackTitle: 'Consent Record Spec', file: 'ProofBridge/compliance/CONSENT-RECORD-SPEC.md' },
  { id: 'B2B', fallbackTitle: 'B2B Pilot Integration', file: 'ProofBridge/compliance/B2B-PILOT-INTEGRATION.md' },
  { id: 'OFFER', fallbackTitle: 'Blockchain Detection Offer', file: 'blockchain-detection-offer.md' },
  { id: 'GUIDE', fallbackTitle: 'Operator Field Guide — Private Security Firms', file: 'docs/OPERATOR_FIELD_GUIDE.md' },
];

export interface ServedDoc {
  id: string;
  title: string;
  file: string;
  markdown: string;
  chars: number;
  mtimeIso: string | null;
  error: string | null;
}

export async function GET() {
  const docs: ServedDoc[] = await Promise.all(
    DOCS.map(async (d): Promise<ServedDoc> => {
      const abs = path.join(process.cwd(), d.file);
      try {
        const [md, st] = await Promise.all([readFile(abs, 'utf8'), stat(abs)]);
        const heading = md.match(/^#\s+(.+)\r?\n/m);
        return {
          id: d.id,
          title: heading ? heading[1].trim() : d.fallbackTitle,
          file: d.file,
          markdown: md,
          chars: md.length,
          mtimeIso: st.mtime.toISOString(),
          error: null,
        };
      } catch (e) {
        return {
          id: d.id,
          title: d.fallbackTitle,
          file: d.file,
          markdown: '',
          chars: 0,
          mtimeIso: null,
          error: e instanceof Error ? e.message : 'unreadable',
        };
      }
    }),
  );
  return NextResponse.json(
    { docs, generatedAt: new Date().toISOString() },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
