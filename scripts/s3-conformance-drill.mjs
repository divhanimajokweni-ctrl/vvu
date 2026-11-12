// scripts/s3-conformance-drill.mjs — R79 · the s3 conformance drill.
// ─────────────────────────────────────────────────────────────────────────────
// Proves the ENTIRE s3 evidence chain end-to-end against a signature-VALIDATING
// endpoint (scripts/s3-conformance-stub.mjs) — the same SigV4 check AWS/MinIO
// perform — without touching the standing estate config for longer than the
// drill lasts:
//
//   0. bad-signature proof   a request signed with a WRONG secret → 403
//                            (if this passed, the stub would prove nothing)
//   1. swap                  sync-target.json → s3 @ http://127.0.0.1:9101
//   2. push                  POST the sync → real SigV4 PUTs of every vault
//                            bundle + the manifest → SYNCED, failed 0
//   3. audit #1              HEAD+re-read+LIST of every key → PASS, every file
//                            OK, etag md5 cross-checks match, LIST ok
//   4. tamper + delete       append a byte to one object (DIVERGED), delete
//                            another (MISSING) → re-audit → DRIFT, exactly
//                            those two rows, the rest untouched
//   4b. recover              put both objects back byte-for-byte → audit
//                            PASS again (the mirror heals; nothing dirty lingers)
//   4c. plant an EXTRA       write a bundle-shaped object the vault does NOT
//                            hold directly into the stub store → audit →
//                            UNEXPECTED, extra 1, the row says EXTRA and its
//                            bytes were re-read for sha256 evidence (R82 —
//                            the signed LIST closes the mirror→vault direction)
//   4d. sweep clean          remove the extra → audit PASS again, extra 0
//   4e. LIST fault (R84)     plant the stub's .list-fault marker (every LIST
//                            answers 500, the per-key pass keeps working) →
//                            audit → INCOMPLETE, ok false, extra stays an
//                            honest 0 — a failed sweep NEVER reads as PASS;
//                            remove the marker → audit PASS again
//   4f. hostile keys (R86)   plant two off-contract objects whose NAMES a
//                            real endpoint XML-escapes (& < > " and spaces;
//                            unicode) → audit → UNEXPECTED, extra 2, the
//                            EXTRA rows carry the DECODED names, and both
//                            bytes re-reads land (the path-style GET now
//                            URI-encodes per segment); sweep → PASS again
//   4g. KeyCount fault (R86) plant the stub's .list-keycount-fault marker
//                            (every LIST declares KeyCount = pages+1, the
//                            lying-endpoint shape) → audit → INCOMPLETE via
//                            the parse-mismatch check — an under-parsed page
//                            can never read as a PASS; remove → PASS again
//   5. restore               sync-target.json byte-identical to the backup;
//                            sync status reports the file target again
//
// The drill writes ONE sync journal row (step 2 — honest evidence that the
// s3 push path ran and landed). Everything else lives in the stub's temp dir
// and dies with it. The audit itself stays read-only on both transports.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, appendFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { startS3ConformanceStub } from './s3-conformance-stub.mjs';

const BASE = process.env.DRILL_BASE_URL ?? 'http://127.0.0.1:3000';
const VAULT_DIR = join(process.cwd(), 'vvu-trust', 'bundles');
const CONFIG_PATH = join(VAULT_DIR, 'sync-target.json');
const PORT = 9101;
const BUCKET = 'vvu-drill-bucket';
const PREFIX = 'vvu-anchors';
const ACCESS_KEY = `drill-${randomUUID().slice(0, 8)}`;
const SECRET_KEY = `drill-secret-${randomUUID()}`;
const STUB_DIR = join(process.cwd(), '.s3-drill-stub');

const FILE_RE = /^vvu-anchor-bundle-\d{8}T\d{6}(?:-\d+)?\.json$/;
const results = [];
function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${step}${detail ? ` — ${detail}` : ''}`);
}
function assertEq(step, actual, expected, what) {
  const ok = actual === expected;
  record(step, ok, ok ? `${what} = ${JSON.stringify(actual)}` : `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return ok;
}

/** A deliberately WRONG signer for the bad-signature proof (step 0). */
function signWrong(method, path, body, secret, when) {
  const amzDate = when;
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? createHash('sha256').update(body).digest('hex') : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const canonicalHeaders = `host:127.0.0.1:${PORT}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [method, path, '', canonicalHeaders, 'host;x-amz-content-sha256;x-amz-date', payloadHash].join('\n');
  const scope = `${dateStamp}/us-east-1/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update('us-east-1').digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  return `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${createHmac('sha256', kSigning).update(stringToSign).digest('hex')}`;
}

const vaultBundles = readdirSync(VAULT_DIR).filter((f) => FILE_RE.test(f) && statSync(join(VAULT_DIR, f)).isFile());
console.log(`drill vault inventory: ${vaultBundles.length} bundle(s), expecting ${vaultBundles.length + 1} pushed objects (bundles + manifest)\n`);

const configBackup = readFileSync(CONFIG_PATH);
// R83 — the stub runs PAGINATED (maxKeys 2): every LIST in this drill is
// multi-page (bundles + manifest + extras > 2 keys), so the audit's
// continuation-token loop is exercised by EVERY step, not by a dedicated one.
const stub = await startS3ConformanceStub({ port: PORT, dir: STUB_DIR, accessKey: ACCESS_KEY, secretKey: SECRET_KEY, maxKeys: 2 });

try {
  // ── step 0: the bad-signature proof ──────────────────────────────────────
  const when = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const bad = await fetch(`http://127.0.0.1:${PORT}/${BUCKET}/${PREFIX}/probe.bin`, {
    method: 'PUT',
    headers: {
      Authorization: signWrong('PUT', `/${BUCKET}/${PREFIX}/probe.bin`, Buffer.from('x'), 'deliberately-wrong-secret', when),
      'x-amz-content-sha256': createHash('sha256').update('x').digest('hex'),
      'x-amz-date': when,
      'content-length': '1',
    },
    body: 'x',
  });
  assertEq('0 bad-signature refused', bad.status, 403, 'wrong-secret PUT status');

  // ── step 1: swap the standing config to the drill endpoint ───────────────
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      { target: 's3', endpoint: `http://127.0.0.1:${PORT}`, bucket: BUCKET, prefix: PREFIX, accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY, region: 'us-east-1', note: 'R79 conformance drill — transient, restored byte-for-byte afterwards' },
      null,
      2,
    ) + '\n',
  );
  const status1 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync`, { cache: 'no-store' }).then((r) => r.json());
  assertEq('1 target swapped', status1?.config?.target, 's3', 'sync status target');

  // ── step 2: the real push — SigV4 PUTs of every vault object ────────────
  const syncRes = await fetch(`${BASE}/api/proximity/anchor/bundle/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trigger: 'manual' }),
    cache: 'no-store',
  }).then((r) => r.json());
  const row = syncRes?.row ?? {};
  assertEq('2 push state', row.state, 'SYNCED', 'sync row state');
  assertEq('2 push failed', row.failed, 0, 'sync row failed');
  assertEq('2 push count', row.pushed, vaultBundles.length + 1, 'pushed objects (bundles + manifest)');
  if (!row.state || row.state !== 'SYNCED') {
    console.log('   push detail:', JSON.stringify(row).slice(0, 400));
  }

  // ── step 3: audit #1 — everything must verify ────────────────────────────
  const audit1 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a1 = audit1?.audit ?? {};
  assertEq('3 audit verdict', a1.verdict, 'PASS', 'first audit verdict');
  assertEq('3 audit ok count', a1.counts?.ok, vaultBundles.length, 'ok objects');
  assertEq('3 transport headOk', a1.transport?.headOk, vaultBundles.length, 'HEADs answered');
  assertEq('3 transport reRead', a1.transport?.reRead, vaultBundles.length, 'objects re-read');
  assertEq('3 etag cross-check', a1.transport?.etagMatches, vaultBundles.length, 'etag md5 matches');
  assertEq('3 LIST ok', a1.transport?.listOk, true, 'signed LIST answered');
  assertEq('3 LIST mirror objects', a1.transport?.mirrorObjects, vaultBundles.length + 1, 'objects under the prefix (bundles + manifest)');
  // R83 — pagination proofs: the loop ran AND completed (a completed
  // pagination is NOT truncation — truncated must stay false).
  const minPages = Math.ceil((vaultBundles.length + 1) / 2);
  assertEq('3 LIST paginated', (a1.transport?.listPages ?? 0) >= minPages, true, `listPages >= ${minPages} (stub max-keys 2)`);
  assertEq('3 LIST completed', a1.transport?.truncated, false, 'paginated-but-complete is NOT truncated');
  const badRows1 = (a1.files ?? []).filter((f) => f.verdict !== 'OK');
  assertEq('3 no unexpected rows', badRows1.length, 0, 'non-OK rows');

  // ── step 4: tamper one object, delete another — the audit must see both ──
  const stored = readdirSync(join(STUB_DIR, BUCKET, PREFIX)).filter((f) => FILE_RE.test(f)).sort();
  const tampered = stored[0];
  const deleted = stored[stored.length - 1] !== tampered ? stored[stored.length - 1] : stored[stored.length - 2];
  appendFileSync(join(STUB_DIR, BUCKET, PREFIX, tampered), 'X');
  rmSync(join(STUB_DIR, BUCKET, PREFIX, deleted));
  const audit2 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a2 = audit2?.audit ?? {};
  assertEq('4 audit verdict', a2.verdict, 'DRIFT', 'post-tamper audit verdict');
  assertEq('4 diverged count', a2.counts?.diverged, 1, 'diverged objects');
  assertEq('4 missing count', a2.counts?.missing, 1, 'missing objects');
  const tamperedRow = (a2.files ?? []).find((f) => f.fileName === tampered);
  const deletedRow = (a2.files ?? []).find((f) => f.fileName === deleted);
  assertEq('4 tampered row', tamperedRow?.verdict, 'DIVERGED', `${tampered} verdict`);
  assertEq('4 deleted row', deletedRow?.verdict, 'MISSING', `${deleted} verdict`);
  const untouchedOk = (a2.files ?? []).filter((f) => f.verdict === 'OK').length;
  assertEq('4 untouched rows', untouchedOk, vaultBundles.length - 2, 'still-OK objects');

  // ── step 4b: recover — put both objects back byte-for-byte ───────────────
  writeFileSync(join(STUB_DIR, BUCKET, PREFIX, tampered), readFileSync(join(VAULT_DIR, tampered)));
  writeFileSync(join(STUB_DIR, BUCKET, PREFIX, deleted), readFileSync(join(VAULT_DIR, deleted)));
  const audit3 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a3 = audit3?.audit ?? {};
  assertEq('4b recovery audit', a3.verdict, 'PASS', 'post-recovery audit verdict');

  // ── step 4c: plant an EXTRA — the signed LIST must catch it (R82) ────────
  const extraName = 'vvu-anchor-bundle-20990101T000000-off-contract.json';
  const extraBody = JSON.stringify({ format: 'not-a-vault-bundle', note: 'planted by the R82 drill' });
  writeFileSync(join(STUB_DIR, BUCKET, PREFIX, extraName), extraBody, 'utf8');
  const audit4 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a4 = audit4?.audit ?? {};
  assertEq('4c extra verdict', a4.verdict, 'UNEXPECTED', 'post-plant audit verdict');
  assertEq('4c extra count', a4.counts?.extra, 1, 'extra objects');
  const extraRow = (a4.files ?? []).find((f) => f.fileName === extraName);
  assertEq('4c extra row verdict', extraRow?.verdict, 'EXTRA', `${extraName} verdict`);
  assertEq('4c extra row bytes', extraRow?.bytes, Buffer.byteLength(extraBody), 'extra object re-read byte count');
  assertEq('4c extra re-read evidence', a4.transport?.extraReRead, 1, 'extra objects re-read for sha256');
  assertEq('4c extra vault hash absent', extraRow?.vaultHash ?? null, null, 'EXTRA row carries no vault hash');
  assertEq('4c LIST mirror objects', a4.transport?.mirrorObjects, vaultBundles.length + 2, 'objects under the prefix (bundles + manifest + extra)');
  assertEq('4c vault rows still ok', (a4.files ?? []).filter((f) => f.verdict === 'OK').length, vaultBundles.length, 'vault objects unaffected by the extra');

  // ── step 4d: sweep clean — remove the extra, the mirror is whole again ───
  rmSync(join(STUB_DIR, BUCKET, PREFIX, extraName));
  const audit5 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a5 = audit5?.audit ?? {};
  assertEq('4d cleanup audit', a5.verdict, 'PASS', 'post-cleanup audit verdict');
  assertEq('4d extra count back to zero', a5.counts?.extra, 0, 'extra objects after cleanup');

  // ── step 4e: the LIST fault — a failed sweep must NEVER read as PASS (R84)
  // Plant the stub's .list-fault marker: every LIST now answers 500 while the
  // per-key HEAD+re-read path keeps working. The audit must return INCOMPLETE
  // (everything CHECKED verifies, but the EXTRA sweep is blind), not a PASS
  // with the gap buried in a footer note. Then remove the marker: PASS again.
  const faultMarker = join(STUB_DIR, BUCKET, '.list-fault');
  writeFileSync(faultMarker, 'fault');
  const audit6 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a6 = audit6?.audit ?? {};
  assertEq('4e fault audit verdict', a6.verdict, 'INCOMPLETE', 'failed-LIST audit verdict');
  assertEq('4e fault ok flag', a6.ok, false, 'INCOMPLETE is not a pass');
  assertEq('4e fault LIST refused', a6.transport?.listOk, false, 'the signed LIST did not answer');
  assertEq('4e fault note incomplete', (a6.transport?.listNote ?? '').includes('INCOMPLETE'), true, 'listNote names the incomplete sweep');
  assertEq('4e fault per-key pass intact', (a6.files ?? []).filter((f) => f.verdict === 'OK').length, vaultBundles.length, 'vault objects still verified while the sweep was blind');
  assertEq('4e fault extra stays honest zero', a6.counts?.extra, 0, 'no extras INVENTED from a failed sweep');
  rmSync(faultMarker);
  const audit7 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a7 = audit7?.audit ?? {};
  assertEq('4e heal audit', a7.verdict, 'PASS', 'post-fault-removal audit verdict');

  // ── step 4f: hostile keys — the LIST must read the names a real endpoint
  // XML-escapes, and the extra re-read must fetch them over an explicitly
  // URI-encoded path-style GET (R86). Both objects are off-contract (the
  // vault does not hold them), so the set relation must surface BOTH as
  // EXTRA rows under their DECODED names — an escaped-name FALSE match
  // (or a vanished row) would be the sweep lying.
  const hostileOne = 'drill & drift + <extra> "quoted".json';
  const hostileTwo = 'drüll-ключ-键.json';
  const hostileBody = JSON.stringify({ format: 'not-a-vault-bundle', note: 'R86 hostile-names drill' });
  writeFileSync(join(STUB_DIR, BUCKET, PREFIX, hostileOne), hostileBody, 'utf8');
  writeFileSync(join(STUB_DIR, BUCKET, PREFIX, hostileTwo), hostileBody, 'utf8');
  const audit8 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a8 = audit8?.audit ?? {};
  assertEq('4f hostile verdict', a8.verdict, 'UNEXPECTED', 'post-plant audit verdict');
  assertEq('4f hostile count', a8.counts?.extra, 2, 'extra objects (both hostile keys)');
  const rowOne = (a8.files ?? []).find((f) => f.fileName === hostileOne);
  const rowTwo = (a8.files ?? []).find((f) => f.fileName === hostileTwo);
  assertEq('4f decoded ampersand row', rowOne?.verdict, 'EXTRA', `${hostileOne} decoded and caught`);
  assertEq('4f decoded unicode row', rowTwo?.verdict, 'EXTRA', `${hostileTwo} decoded and caught`);
  assertEq('4f hostile re-reads', a8.transport?.extraReRead, 2, 'both extra objects re-read over the encoded GET');
  assertEq('4f hostile bytes', rowOne?.bytes, Buffer.byteLength(hostileBody, 'utf8'), 're-read byte count matches the planted bytes');
  assertEq('4f mirror objects', a8.transport?.mirrorObjects, vaultBundles.length + 3, 'objects under the prefix (bundles + manifest + 2 hostile)');
  assertEq('4f vault rows still ok', (a8.files ?? []).filter((f) => f.verdict === 'OK').length, vaultBundles.length, 'vault objects unaffected by the hostile extras');
  rmSync(join(STUB_DIR, BUCKET, PREFIX, hostileOne));
  rmSync(join(STUB_DIR, BUCKET, PREFIX, hostileTwo));
  const audit9 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a9 = audit9?.audit ?? {};
  assertEq('4f cleanup audit', a9.verdict, 'PASS', 'post-hostile-cleanup audit verdict');

  // ── step 4g: the KeyCount fault — a page that DECLARES more keys than it
  // carries is a lying endpoint (or a shape the parser missed). The audit's
  // cross-check must answer honestly: LIST failed, sweep INCOMPLETE, never
  // a PASS over an under-parsed page. Then remove the marker: PASS again.
  const kcFaultMarker = join(STUB_DIR, BUCKET, '.list-keycount-fault');
  writeFileSync(kcFaultMarker, 'fault');
  const audit10 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a10 = audit10?.audit ?? {};
  assertEq('4g keycount verdict', a10.verdict, 'INCOMPLETE', 'parse-mismatch audit verdict');
  assertEq('4g keycount ok flag', a10.ok, false, 'INCOMPLETE is not a pass');
  assertEq('4g keycount LIST failed', a10.transport?.listOk, false, 'the mismatched page failed the LIST');
  assertEq('4g keycount note', (a10.transport?.listNote ?? '').includes('mismatch') || (a10.transport?.listNote ?? '').includes('INCOMPLETE'), true, 'listNote names the failure');
  assertEq('4g keycount per-key pass intact', (a10.files ?? []).filter((f) => f.verdict === 'OK').length, vaultBundles.length, 'vault objects still verified while the sweep was blind');
  assertEq('4g keycount extra honest zero', a10.counts?.extra, 0, 'no extras INVENTED from a failed sweep');
  rmSync(kcFaultMarker);
  const audit11 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync/audit`, { cache: 'no-store' }).then((r) => r.json());
  const a11 = audit11?.audit ?? {};
  assertEq('4g heal audit', a11.verdict, 'PASS', 'post-keycount-fault-removal audit verdict');

  // ── step 5: restore the standing config byte-for-byte ────────────────────
  writeFileSync(CONFIG_PATH, configBackup);
  const restored = readFileSync(CONFIG_PATH);
  assertEq(
    '5 config restored',
    Buffer.compare(restored, configBackup) === 0,
    true,
    'sync-target.json byte-identical',
  );
  const status2 = await fetch(`${BASE}/api/proximity/anchor/bundle/sync`, { cache: 'no-store' }).then((r) => r.json());
  assertEq('5 target restored', status2?.config?.target, 'file', 'sync status target');
} catch (e) {
  record('drill crashed', false, e instanceof Error ? e.message : String(e));
} finally {
  // config is ALWAYS restored, even on a crash mid-drill
  writeFileSync(CONFIG_PATH, configBackup);
  await stub.stop();
  rmSync(STUB_DIR, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\ndrill summary: ${results.length - failed.length}/${results.length} assertions passed`);
if (failed.length > 0) {
  console.log('FAILED steps:');
  for (const f of failed) console.log(`  - ${f.step}: ${f.detail}`);
  process.exit(1);
}
console.log('S3 CONFORMANCE DRILL: ALL GREEN — push, audit, tamper-detection, EXTRA detection (signed LIST), INCOMPLETE-verdict honesty (failed LIST never passes), hostile-key decoding + encoded re-reads, KeyCount mismatch honesty and refusal all proven against a signature-validating endpoint');
