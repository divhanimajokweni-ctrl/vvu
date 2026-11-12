#!/usr/bin/env node
/**
 * VVU — Field OS Card Playwright Smoke Test
 *
 * Verifies the four views (CARD, CAPTURE, QUEUE, SIGNATURE) load without
 * errors, plus capture-form persistence across a page reload.
 *
 * Adapted 2026-09-30 to the REAL operator card (src/ive/card.html):
 *   - Views are <section id="view-{name}"> containers toggled by nav buttons
 *     [data-view="{name}"] — LOWERCASE values (the pre-card version of this
 *     test hypothesised UPPERCASE data-view containers; that shape never
 *     existed). The card does NOT read location.hash, so navigation happens
 *     by clicking the nav buttons, exactly like a real user (exercises
 *     setView()). A hash-only page.goto is avoided too: it is a
 *     same-document navigation that resolves to a null response.
 *   - Persistence is localStorage-backed (fresh browser context per run, so
 *     the queue starts empty every time). The card requires name + phone to
 *     save a contact.
 *
 * Usage:
 *   node scripts/verify/field_card_smoke.mjs --card-path=/path/to/card.html
 *   CARD_HTML_PATH=/path/to/card.html node scripts/verify/field_card_smoke.mjs
 *
 * For VVU estate (default path src/ive/card.html — the TRACKED CANONICAL
 * card; r25 serving posture retired the static out/ export, so the smoke
 * now verifies the canonical artifact itself):
 *   node scripts/verify/field_card_smoke.mjs
 *
 * Exit codes:
 *   0 = all tests pass
 *   1 = test failure or missing card.html path
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Default VVU estate path — the tracked canonical card (r25: the out/
// static export is retired; the canonical file is the verify target)
const DEFAULT_CARD_PATH = resolve(process.cwd(), 'src/ive/card.html');
const CARD_HTML_PATH = process.env.CARD_HTML_PATH || parseArgs() || DEFAULT_CARD_PATH;

if (!existsSync(CARD_HTML_PATH)) {
  console.error(`ERROR: card.html not found at ${CARD_HTML_PATH}`);
  console.error('Usage: CARD_HTML_PATH=/path/to/card.html node scripts/verify/field_card_smoke.mjs');
  process.exit(1);
}

const FILE_URL = `file://${CARD_HTML_PATH}`;
const RESULTS_PATH = '/tmp/field_card_smoke_results.json';

console.log(`[${new Date().toISOString()}] Starting smoke test`);
console.log(`[${new Date().toISOString()}] Card HTML: ${FILE_URL}`);

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    startedAt: new Date().toISOString(),
    cardHtmlPath: CARD_HTML_PATH,
    tests: []
  };

  try {
    // Each view test performs a full page navigation to the base URL (a
    // hash-only goto is a same-document navigation — Playwright resolves it
    // to a null response, which is not a card defect), then switches views
    // by clicking the nav button, the card's real navigation path.
    results.tests.push(await testView(page, 'CARD', FILE_URL));
    results.tests.push(await testView(page, 'CAPTURE', FILE_URL));
    results.tests.push(await testView(page, 'QUEUE', FILE_URL));
    results.tests.push(await testView(page, 'SIGNATURE', FILE_URL));

    // Test 5: Persistence (save + reload)
    results.tests.push(await testPersistence(page, FILE_URL));

  } catch (err) {
    results.error = err.message;
  } finally {
    await browser.close();
  }

  results.completedAt = new Date().toISOString();
  results.passed = results.tests.every(t => t.status === 'PASS');

  // Write results for worklog
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log(`[${new Date().toISOString()}] Results: ${results.passed ? 'PASS' : 'FAIL'} (${RESULTS_PATH})`);

  process.exit(results.passed ? 0 : 1);
}

async function testView(page, viewName, url) {
  const test = { view: viewName, status: 'PASS', errors: [] };
  // The real card uses lowercase view names (data-view="card", section#view-card).
  const v = viewName.toLowerCase();

  try {
    // Console/page-error listeners must be attached BEFORE navigation,
    // otherwise load-time errors escape the check.
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

    if (!response || !response.ok()) {
      test.status = 'FAIL';
      test.errors.push(`HTTP ${response?.status() || 'timeout'}`);
      return test;
    }

    // The card does not read location.hash — navigate by clicking the nav
    // button for this view, like a real user (exercises setView()).
    const navBtn = await page.$(`nav button[data-view="${v}"]`);
    if (navBtn) {
      await navBtn.click();
    } else {
      test.errors.push(`nav button [data-view="${v}"] not found — card shape changed?`);
    }

    await page.waitForTimeout(1000); // Allow JS to settle

    if (consoleErrors.length > 0) {
      test.status = 'WARN';
      test.errors.push(...consoleErrors);
    }

    // View is live when its section container exists AND is the active one.
    const section = await page.$(`section#view-${v}`);
    if (!section) {
      test.status = 'WARN';
      test.errors.push(`View section #view-${v} not found`);
    } else if (navBtn) {
      const active = await page.$eval(`section#view-${v}`, el => el.classList.contains('on'));
      if (!active) {
        test.status = 'WARN';
        test.errors.push(`View #view-${v} present but not active after nav click`);
      }
    }

  } catch (err) {
    test.status = 'FAIL';
    test.errors.push(err.message);
  }

  return test;
}

async function testPersistence(page, baseUrl) {
  const test = { name: 'PERSISTENCE', status: 'PASS', errors: [] };

  try {
    // Start on the CARD view (default) — the card ignores location.hash.
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Navigate to the capture form via the nav button (real-user path).
    await page.click('nav button[data-view="capture"]');

    // Fill form. The card requires name + phone; email and the legitimate
    // interest checkbox complete the contact record.
    await page.fill('#fName', 'Smoke Test Contact');
    await page.fill('#fPhone', '+27821234567');
    await page.fill('#fEmail', 'smoke@test.local');
    await page.check('#fLi');

    // Save
    await page.click('#saveBtn');
    await page.waitForTimeout(500);

    // Reload — persistence is localStorage-backed, must survive.
    await page.reload({ waitUntil: 'networkidle' });

    // Queue renders on load; open the QUEUE view like a user and check it.
    await page.click('nav button[data-view="queue"]');

    const queueCount = await page.textContent('#qTotal');
    if (!queueCount || parseInt(queueCount) < 1) {
      test.status = 'FAIL';
      test.errors.push('Contact did not survive page reload (queue empty)');
    }

    // Verify queue item exists (scoped to the queue view section)
    const queueItem = await page.$('#view-queue .item');
    if (!queueItem) {
      test.status = 'FAIL';
      test.errors.push('No queue items found after reload');
    }

  } catch (err) {
    test.status = 'FAIL';
    test.errors.push(err.message);
  }

  return test;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.findIndex(a => a === '--card-path' || a.startsWith('--card-path='));
  if (idx === -1) return null;

  const arg = args[idx];
  if (arg === '--card-path') {
    return args[idx + 1];
  } else {
    return arg.split('=')[1];
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
