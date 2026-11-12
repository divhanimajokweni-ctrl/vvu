#!/usr/bin/env bun
// scripts/gen/generate_authority_files.mjs — generate the two data authority
// files from REAL box state (operator instruction 2026-09-30: "generated, not
// hand-written"):
//
//   docs/data/ledger.jsonl   — export of the real WORM chain (Prisma WormEvent,
//                              seq ascending), chain-verified BEFORE export.
//   docs/data/manifest.json  — registry of the estate's real authority files,
//                              each with sha256 + bytes + mtime. Clock-header
//                              shape. The manifest is not self-listed.
//
// Fail-closed: if the WORM chain does not verify, or a manifest-scope file is
// missing, this script exits 1 and writes nothing.
//
// Run: bun scripts/gen/generate_authority_files.mjs   (or: bun run gen:authority)

import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const GENESIS_HASH = 'GENESIS-20260901-0000000000000000000000000000000000';

const LEDGER_OUT = path.join(ROOT, 'docs/data/ledger.jsonl');
const MANIFEST_OUT = path.join(ROOT, 'docs/data/manifest.json');

// Files the manifest registers — every one must exist (fail-closed if not).
// r37 extension (+5, 2026-09-30): the authority artifacts that landed r21–r33
// — the binding rulings, the round-lock law, the standing probe the round
// protocol's VERIFY step names, the card's end-to-end verification, and the
// serving posture script — registered so the manifest governs the real estate.
const MANIFEST_SCOPE = [
  'docs/strategy/RUNNER-MAIN.md',
  'docs/strategy/RUNNER-SCOPE.md',
  'docs/strategy/TASKS-MAIN.md',
  'docs/strategy/CARD-SYNC.md',
  'docs/strategy/VOICE.md',
  'docs/strategy/SUPPORT-PAGE.md',
  'docs/strategy/RULINGS.md',
  'docs/data/clock.json',
  'docs/data/ledger.jsonl',
  'scripts/setup/gen_key_to_file.sh',
  'scripts/setup/verify_key_registered.sh',
  'scripts/verify/field_card_smoke.mjs',
  'scripts/verify/field_card_landing.mjs',
  'scripts/verify-estate.sh',
  'scripts/round.lock.sh',
  'scripts/ive/serve.sh',
  'scripts/gen/generate_authority_files.mjs',
  'src/lib/card-captures.ts',
  'src/app/api/vvu/captures/sync/route.ts',
];

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function fail(msg) {
  console.error(`GENERATOR FAILED (nothing written): ${msg}`);
  process.exit(1);
}

async function nextRevision(file) {
  try {
    const prev = JSON.parse(await readFile(file, 'utf8'));
    return (typeof prev.revision === 'number' ? prev.revision : 0) + 1;
  } catch {
    return 1;
  }
}

// ─── 1. WORM chain export → docs/data/ledger.jsonl ───────────────────────────

async function generateLedger() {
  // DATABASE_URL from env or .env (the dev server uses .env).
  if (!process.env.DATABASE_URL) {
    try {
      const env = await readFile(path.join(ROOT, '.env'), 'utf8');
      const m = env.match(/^DATABASE_URL=(.+)$/m);
      if (m) process.env.DATABASE_URL = m[1].trim();
    } catch {
      /* no .env — fall through to Prisma's own resolution */
    }
  }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.wormEvent.findMany({ orderBy: { seq: 'asc' } });

    // Verify the chain over the full export (same formula as vvu-ledger.ts).
    let prev = GENESIS_HASH;
    for (const r of rows) {
      const expect = sha256(`${prev}|${r.seq}|${r.source}|${r.event}|${r.details ?? ''}|${r.createdAt.toISOString()}`);
      if (r.prevHash !== prev || r.hash !== expect) {
        fail(`WORM chain breaks at seq ${r.seq} — refusing to export a broken chain`);
      }
      prev = r.hash;
    }

    const lines = rows.map((r) =>
      JSON.stringify({
        schema: 'vvu.ledger-entry.v1',
        seq: r.seq,
        source: r.source,
        event: r.event,
        details: r.details,
        prevHash: r.prevHash,
        hash: r.hash,
        createdAt: r.createdAt.toISOString(),
      })
    );
    await writeFile(LEDGER_OUT, `${lines.join('\n')}\n`, 'utf8');
    return rows.length;
  } finally {
    await prisma.$disconnect();
  }
}

// ─── 2. File registry → docs/data/manifest.json ─────────────────────────────

async function generateManifest() {
  const revision = await nextRevision(MANIFEST_OUT);
  const entries = [];
  for (const rel of MANIFEST_SCOPE) {
    const abs = path.join(ROOT, rel);
    let content;
    let st;
    try {
      content = await readFile(abs, 'utf8');
      st = await stat(abs);
    } catch {
      fail(`manifest-scope file missing: ${rel}`);
    }
    entries.push({
      path: rel,
      sha256: sha256(content),
      bytes: st.size,
      last_write_utc: st.mtime.toISOString(),
    });
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const manifest = {
    schema: 'vvu.manifest.v1',
    version: new Date().toISOString().slice(0, 10),
    revision,
    generated_at_utc: new Date().toISOString(),
    generated_by: 'scripts/gen/generate_authority_files.mjs',
    note: 'Generated from real box state — do not hand-edit; re-run the generator. Entries are sha256 + size + mtime of the live files. The manifest itself is not self-listed.',
    entries,
  };
  await writeFile(MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { revision, count: entries.length };
}

// ─── run ─────────────────────────────────────────────────────────────────────

const ledgerCount = await generateLedger();
const manifestInfo = await generateManifest();
console.log(
  `OK — docs/data/ledger.jsonl: ${ledgerCount} entries (chain verified before export); ` +
    `docs/data/manifest.json: revision ${manifestInfo.revision}, ${manifestInfo.count} entries hashed.`
);
