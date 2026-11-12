// scripts/s3-ui-stub-runner.mjs — R82 · a long-lived stub for the UI audit
// proof. NOT a smoke: run it in the background, swap sync-target.json to point
// at it, run the audit from the browser, then kill it and restore the config.
// The store is planted with ONE off-contract object (no vault bundles) so the
// read-only audit shows: 5 MISSING + 1 EXTRA + LIST OK tile — the full new UI
// family with zero pushes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startS3ConformanceStub } from './s3-conformance-stub.mjs';

const DIR = join(process.cwd(), '.s3-ui-stub');
mkdirSync(join(DIR, 'vvu-ui-bucket', 'vvu-anchors'), { recursive: true });
writeFileSync(
  join(DIR, 'vvu-ui-bucket', 'vvu-anchors', 'vvu-anchor-bundle-20990101T000000-ui-proof.json'),
  JSON.stringify({ format: 'not-a-vault-bundle', note: 'planted for the R82 UI audit proof' }, null, 2) + '\n',
);

const stub = await startS3ConformanceStub({
  port: 9105,
  dir: DIR,
  accessKey: 'ui-proof-akid',
  secretKey: 'ui-proof-secret',
  region: 'us-east-1',
});
console.log('ui stub ready on :9105');
process.on('SIGTERM', async () => {
  await stub.stop();
  process.exit(0);
});
setInterval(() => {}, 1 << 30); // hold the event loop
