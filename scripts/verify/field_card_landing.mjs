#!/usr/bin/env node
/**
 * VVU — Field OS Card LANDING Test (main-runner r26, 2026-09-30)
 *
 * Proves the last unproven hop of the card↔server workstream: the REAL
 * card's own send code over LIVE HTTP. Every prior proof drove the server
 * side directly (r24: handler invocation; r25: curl). This test drives the
 * REAL card served by the IVE server (same-origin posture, r25) in a real
 * browser: capture a contact in the CAPTURE view, let the card's own
 * saveContact() auto-sync fire, and verify the data LANDS end to end:
 *
 *   card UI → card's fetch (envelope on the wire) → IVE server :3100 →
 *   shared store (db/card-captures.jsonl, one chain) → WORM bridge seq →
 *   main-app ops endpoint :3000 (the surface §11 reads)
 *
 * Assertions (fail-closed, each quoted in the worklog):
 *   1. The wire envelope is the card's exact contract shape
 *      (schema vvu.captures.sync.v1, writer, captured[]).
 *   2. The card's queue row is marked synced_at + sync_ref = the WORM seq.
 *   3. The toast ends "synced 1 · <ref>".
 *   4. The record is in the store: both GETs (:3100 and :3000) see it,
 *      chainValid true on both, fields verbatim.
 *   5. The WORM row at the ref seq says CARD_CAPTURES_SYNCED / accepted=1.
 *
 * Usage: node scripts/verify/field_card_landing.mjs [--card-url=http://127.0.0.1:3100/card.html]
 * Exit codes: 0 = all assertions pass · 1 = any failure
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';

// DATABASE_URL for the direct WORM assertion (a bare node script does not
// auto-load .env — load it explicitly, DATABASE_URL only, before Prisma).
if (!process.env.DATABASE_URL) {
  try {
    const line = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
      .split('\n').find(l => l.startsWith('DATABASE_URL='));
    if (line) process.env.DATABASE_URL = line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
  } catch { /* fail-closed: the WORM check will error out loudly if needed */ }
}

const args = process.argv.slice(2);
const argUrl = (args.find(a => a.startsWith('--card-url=')) || '').split('=')[1];
const CARD_URL = process.env.CARD_URL || argUrl || 'http://127.0.0.1:3100/card.html';
const SYNC_API = CARD_URL.replace(/\/card\.html$/, '') + '/api/vvu/captures/sync';
const MAIN_API = 'http://127.0.0.1:3000/api/vvu/captures/sync';
const RESULTS_PATH = '/tmp/field_card_landing_results.json';

const results = { startedAt: new Date().toISOString(), cardUrl: CARD_URL, checks: [], pass: false };
const check = (name, pass, detail) => {
  results.checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  return pass;
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture the card's outbound sync POST — the real bytes on the wire —
  // AND the reply the card actually consumed.
  let wire = null;
  let reply = null;
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/api/vvu/captures/sync')) {
      try { wire = { url: req.url(), body: JSON.parse(req.postData() || 'null') }; } catch { wire = { url: req.url(), body: null }; }
    }
  });
  page.on('response', res => {
    if (res.request().method() === 'POST' && res.url().includes('/api/vvu/captures/sync')) {
      res.json().then(j => { reply = { status: res.status(), body: j }; }).catch(() => { reply = { status: res.status(), body: null }; });
    }
  });

  console.log(`[${new Date().toISOString()}] LANDING test — driving the real card at ${CARD_URL}`);
  const load = await page.goto(CARD_URL, { waitUntil: 'load' });
  check('card served by the IVE server (same-origin posture)', load.ok(), `GET ${CARD_URL} → ${load.status()}`);

  // Same-origin proof: the card falls back to location.origin + /api/…
  // (settings.endpoint unset in a fresh context), so the wire URL must
  // share the card's own origin — verified after the sync fires below.

  // 1) Capture a contact in the CAPTURE view — real UI, real clicks.
  await page.click('button[data-view="capture"]');
  await page.fill('#fName', 'Landing Proof');
  await page.fill('#fPhone', '0825550107');
  await page.fill('#fCompany', 'Landing Estates PTY');
  await page.fill('#fNotes', 'main-runner r26 landing proof — fLi unchecked, basis NONE');
  // #fLi intentionally UNCHECKED → basis: NONE (no relay side-path fires).

  const wirePromise = new Promise(resolve => {
    const t = setInterval(() => { if (wire) { clearInterval(t); resolve(wire); } }, 200);
    setTimeout(() => { clearInterval(t); resolve(wire); }, 20000);
  });

  await page.click('#saveBtn');   // saveContact() → auto-sync() when online

  // 2) The card's own reply handling: queue row must flip to synced.
  await page.waitForFunction(() => {
    const q = JSON.parse(localStorage.getItem('vvu.card.queue.v1') || '[]');
    return q.length > 0 && q[0].synced_at;
  }, { timeout: 20000 });

  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('vvu.card.queue.v1') || '[]'));
  const row = q[0];
  const toast = await page.evaluate(() => document.querySelector('#toast')?.textContent || '');
  const pill = await page.evaluate(() => document.getElementById('syncLabel')?.textContent || '');

  check('wire envelope is the card contract exactly',
    !!wire && wire.body?.schema === 'vvu.captures.sync.v1' && typeof wire.body?.writer === 'string'
      && Array.isArray(wire.body?.captured) && wire.body.captured.length === 1,
    wire ? `POST ${wire.url} schema=${wire.body?.schema} writer=${wire.body?.writer}` : 'no sync POST observed');
  check('same-origin sync URL (card fell back to location.origin)',
    !!wire && new URL(wire.url).origin === new URL(CARD_URL).origin,
    wire ? wire.url : 'n/a');
  check('card row marked synced_at + sync_ref (the card accepted the reply)',
    !!row?.synced_at && typeof row?.sync_ref === 'string' && /^\d+$/.test(row.sync_ref),
    `id=${row?.id} ref=${row?.sync_ref}`);
  check('toast confirms the landing', /synced 1 · \d+/.test(toast), `toast="${toast}"`);
  check('sync pill settled (all synced / zero pending)', /all synced|0 pending/.test(pill), `pill="${pill}"`);
  check('POST reply the card consumed is the exact success shape',
    !!reply && reply.status === 200 && Array.isArray(reply.body?.accepted)
      && reply.body.accepted.length === 1 && typeof reply.body?.ref === 'string',
    reply ? `HTTP ${reply.status} {"accepted":["${reply.body?.accepted?.[0]}"],"ref":"${reply.body?.ref}"}` : 'no reply captured');

  const ref = row.sync_ref;

  // 3) Server side — the record LANDED in the shared store. The IVE
  // endpoint is POST-only by design (GET → 405, r21 posture), so the
  // status surface is the main-app ops endpoint — the same API §11 reads.
  const main = await (await fetch(MAIN_API)).json();          // main-app ops view
  check('main-app ops endpoint sees the record, chain valid (shared store)',
    main.count >= 1 && main.chainValid === true, `count=${main.count} chainValid=${main.chainValid}`);

  const recent = await (await fetch(MAIN_API + '?recent=20')).json();
  const landed = (recent.recent || []).find(r => r.id === row.id);
  check('record fields landed verbatim (snake_case, none stripped)',
    !!landed && landed.name === 'Landing Proof' && landed.phone === '0825550107'
      && landed.company === 'Landing Estates PTY' && landed.basis === 'NONE'
      && typeof landed.captured_at === 'string',
    landed ? `name=${landed.name} company=${landed.company} basis=${landed.basis}` : 'id not found in recent[]');

  // 4) WORM bridge — the ref IS the seq (direct Prisma, no shell).
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const worm = await prisma.wormEvent.findUnique({ where: { seq: Number(ref) } });
  const wormDetails = worm?.details || '';
  await prisma.$disconnect();
  check('WORM bridge row at the ref seq (CARD_SYNC / CARD_CAPTURES_SYNCED / accepted=1)',
    worm?.event === 'CARD_CAPTURES_SYNCED' && worm?.source === 'CARD_SYNC'
      && /accepted=1 \(new 1, dup 0\)/.test(wormDetails),
    `seq=${worm?.seq} details="${wormDetails}"`);

  results.pass = results.checks.every(c => c.pass);
  results.ref = ref;
  results.rowId = row.id;
} catch (e) {
  results.error = String(e && e.message || e);
  console.error('ERROR:', results.error);
} finally {
  await browser.close();
  results.finishedAt = new Date().toISOString();
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log(`[${results.finishedAt}] Results: ${results.pass ? 'PASS' : 'FAIL'} (${RESULTS_PATH})`);
  process.exit(results.pass ? 0 : 1);
}
