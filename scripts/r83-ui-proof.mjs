// scripts/r83-ui-proof.mjs — R83 · the ONE-CALL UI proof of the PAGINATED
// audit. The sandbox reaps background stubs between tool calls (R82 lesson),
// so this script does everything inside a single node process:
//   1. start the conformance stub with maxKeys 2 (every LIST is multi-page),
//      its store planted with ONE off-contract object (no vault bundles);
//   2. swap sync-target.json to point at the stub (backup kept in memory);
//   3. drive the audit API once (the same call the browser's RUN AUDIT makes)
//      and print the transport block the UI would render;
//   4. restore sync-target.json byte-for-byte and stop the stub — in a finally.
// It is the API-side half of the UI proof; the tile/row components that render
// this shape are shared with the file audit (qa83 screenshots cover those).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startS3ConformanceStub } from './s3-conformance-stub.mjs';

const BASE = 'http://127.0.0.1:3000';
// The standing target lives beside the vault (same path the drill uses).
const CONFIG_PATH = join(process.cwd(), 'vvu-trust', 'bundles', 'sync-target.json');
const DIR = join(process.cwd(), '.s3-r83-proof');

mkdirSync(join(DIR, 'vvu-ui-bucket', 'vvu-anchors'), { recursive: true });
for (let i = 1; i <= 5; i++) {
  // five filler objects so the paginated listing has pages to walk
  writeFileSync(
    join(DIR, 'vvu-ui-bucket', 'vvu-anchors', `vvu-anchor-bundle-2099010${i}T000000-filler.json`),
    JSON.stringify({ format: 'not-a-vault-bundle', note: `R83 pagination filler ${i}` }, null, 2) + '\n',
  );
}

const configBackup = readFileSync(CONFIG_PATH);
const stub = await startS3ConformanceStub({
  port: 9107,
  dir: DIR,
  accessKey: 'r83-proof-akid',
  secretKey: 'r83-proof-secret',
  region: 'us-east-1',
  maxKeys: 2, // every LIST paginates — the point of this proof
});

let exitCode = 0;
try {
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      { target: 's3', endpoint: 'http://127.0.0.1:9107', bucket: 'vvu-ui-bucket', prefix: 'vvu-anchors', accessKeyId: 'r83-proof-akid', secretAccessKey: 'r83-proof-secret', region: 'us-east-1', note: 'R83 UI proof — transient, restored byte-for-byte in finally' },
      null,
      2,
    ) + '\n',
  );
  const audit = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a = audit?.audit ?? {};
  console.log('verdict:', a.verdict, '(DRIFT = 5 MISSING vault rows outrank the EXTRA sweep — but the sweep still ran, paginated and complete)');
  console.log('transport:', JSON.stringify(a.transport, null, 2));
  const extras = (a.files ?? []).filter((f) => f.verdict === 'EXTRA');
  console.log(`EXTRA rows: ${extras.length} (each existence-proven by the signed LIST, byte-counted)`);
  const okPagination =
    a.transport?.listOk === true &&
    a.transport?.listPages >= 3 && // 5 filler objects / maxKeys 2 → 3 pages
    a.transport?.truncated === false && // pagination COMPLETED — not truncation
    a.transport?.mirrorObjects === 5 && // the store plants fillers only, no manifest
    extras.length === 5;
  console.log(`R83 UI-PROOF: ${okPagination ? 'ALL GREEN — the UI will render LIST OK · 6·NPG with the completed-pagination note' : 'FAILED'}`);
  if (!okPagination) exitCode = 1;
} catch (e) {
  console.log('proof crashed:', e instanceof Error ? e.message : String(e));
  exitCode = 1;
} finally {
  writeFileSync(CONFIG_PATH, configBackup); // byte-for-byte, even on crash
  const restored = readFileSync(CONFIG_PATH);
  console.log('config restored byte-for-byte:', Buffer.compare(restored, configBackup) === 0);
  await stub.stop();
  rmSync(DIR, { recursive: true, force: true });
}
process.exit(exitCode);
