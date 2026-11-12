// scripts/ive/route-b-selftest.ts — Route B live seal test.
//
// Exercises the REAL main-app infrastructure that
// src/ive/app/api/vvu/captures/sync/route.ts now targets (operator
// ruling 2026-09-30, trace 1a0efb98fb125351): appendWormEvent — the
// existing prisma WormEvent sha256 chain from src/lib/vvu-ledger.ts —
// plus verifyChain over the full ledger.
//
// Appends exactly ONE honestly-labeled selftest event, then verifies
// the chain. NOT a capture: the details line says so, in plain voice.
// Run: cd /home/z/my-project && bun scripts/ive/route-b-selftest.ts

import { appendWormEvent, verifyChain } from '../../src/lib/vvu-ledger';

async function main() {
  const before = await verifyChain();
  console.log('BEFORE :', JSON.stringify(before));

  const seal = await appendWormEvent({
    source: 'IVE-CAPTURE-SYNC',
    event: 'ROUTE_B_SELFTEST',
    details:
      'route-B retarget selftest · NOT a capture · exercises the exact seal path of src/ive/app/api/vvu/captures/sync/route.ts · operator ruling trace 1a0efb98fb125351',
  });
  console.log(
    'SEALED :',
    JSON.stringify({
      seq: seal.seq,
      hash: `${seal.hash.slice(0, 16)}…`,
      prevHash: `${seal.prevHash.slice(0, 16)}…`,
      createdAt: seal.createdAt,
    })
  );

  const after = await verifyChain();
  console.log('AFTER  :', JSON.stringify(after));
  if (!after.chainValid) {
    console.error('FAIL-CLOSED: chain invalid after seal');
    process.exit(1);
  }
  console.log('RESULT : chain valid · count', before.count, '→', after.count);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('SELFTEST ERROR:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
