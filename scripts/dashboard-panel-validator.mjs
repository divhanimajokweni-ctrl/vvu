#!/usr/bin/env node
/**
 * Dashboard Panel Validator — schema-validates Grafana-style JSON dashboards
 * before they ship. Mirrors scripts/golden-rule-checker.js pattern: pure-Node
 * ESM, zero dependencies, exit 1 on any violation.
 *
 * Usage:
 *   node scripts/dashboard-panel-validator.mjs                    # scan dashboards/
 *   node scripts/dashboard-panel-validator.mjs dashboards/        # scan a directory
 *   node scripts/dashboard-panel-validator.mjs dashboards/x.json  # scan one file
 *
 * Exit: 0 = all clean, 1 = violations found, 2 = error
 */
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';

const ALLOWED_PANEL_TYPES = new Set([
  'stat', 'gauge', 'table', 'timeseries', 'bargauge', 'barchart',
  'piechart', 'heatmap', 'nodeGraph', 'geomap', 'text', 'logs',
]);
const DEPRECATED = { graph: 'timeseries' };
const FORBIDDEN_KEYS = new Set(['password', 'api_key', 'secureJsonData']);

const isNum = n => typeof n === 'number' && !Number.isNaN(n);
const isNonEmptyStr = s => typeof s === 'string' && s.trim().length > 0;

// Walk a JSON subtree collecting any forbidden keys (password / api_key / secureJsonData).
function walkForbidden(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkForbidden(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const p = `${path}.${k}`;
      if (FORBIDDEN_KEYS.has(k)) out.push({ path: p, key: k });
      walkForbidden(v, p, out);
    }
  }
  return out;
}

// Walk a JSON subtree collecting `datasource` fields that are objects (must be strings).
function findBadDatasources(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => findBadDatasources(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const p = `${path}.${k}`;
      if (k === 'datasource' && v !== null && typeof v === 'object') out.push({ path: p });
      else findBadDatasources(v, p, out);
    }
  }
  return out;
}

// Axis-aligned rectangle overlap (Grafana grid).
function overlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function parentKey(path) {
  const segs = path.split('.');
  return segs.length >= 2 ? segs[segs.length - 2] : '';
}

function validate(filePath, data) {
  const rel = relative(process.cwd(), filePath);
  const vs = [];
  const push = (panelId, field, msg) => vs.push({ file: rel, panelId, field, message: msg });

  if (!isNonEmptyStr(data.title)) push(null, 'title', 'top-level "title" must be a non-empty string');
  if (!isNum(data.schemaVersion) || data.schemaVersion <= 0) push(null, 'schemaVersion', 'top-level "schemaVersion" must be a positive number');
  if (!Array.isArray(data.panels) || data.panels.length === 0) {
    push(null, 'panels', 'top-level "panels" must be a non-empty array');
    return vs;
  }

  const seenIds = new Set();
  const rects = [];

  data.panels.forEach((panel, i) => {
    if (!panel || typeof panel !== 'object') { push(null, null, `panel @${i}: not an object`); return; }
    const id = panel.id;
    const label = isNum(id) ? `#${id}` : `@${i}`;

    if (!isNum(id)) push(id, 'id', `panel ${label}: "id" must be a number`);
    else if (seenIds.has(id)) push(id, 'id', `panel ${label}: "id" is duplicated`);
    else seenIds.add(id);

    if (typeof panel.type !== 'string') push(id, 'type', `panel ${label}: "type" must be a string`);
    else if (DEPRECATED[panel.type]) push(id, 'type', `panel ${label}: type "${panel.type}" is deprecated (use "${DEPRECATED[panel.type]}")`);
    else if (!ALLOWED_PANEL_TYPES.has(panel.type)) push(id, 'type', `panel ${label}: type "${panel.type}" is not allowed (must be one of: ${[...ALLOWED_PANEL_TYPES].join(', ')})`);

    if (!isNonEmptyStr(panel.title)) push(id, 'title', `panel ${label}: "title" must be a non-empty string`);

    const g = panel.gridPos;
    if (!g || typeof g !== 'object') push(id, 'gridPos', `panel ${label}: "gridPos" is missing or not an object`);
    else {
      const bad = ['x', 'y', 'w', 'h'].filter(k => !isNum(g[k]) || g[k] < 0 || g[k] > 24);
      if (bad.length > 0) push(id, 'gridPos', `panel ${label}: "gridPos" fields ${bad.join(', ')} must be numbers 0-24`);
      else {
        if (g.x + g.w > 24) push(id, 'gridPos', `panel ${label}: gridPos x+w=${g.x + g.w} exceeds 24`);
        const rect = { id, x: g.x, y: g.y, w: g.w, h: g.h };
        for (const prev of rects) {
          if (overlap(prev, rect)) { push(id, 'gridPos', `panel ${label}: overlaps panel #${prev.id}`); break; }
        }
        rects.push(rect);
      }
    }

    if (!Array.isArray(panel.targets)) push(id, 'targets', `panel ${label}: "targets" must be an array (may be empty)`);

    for (const f of walkForbidden(panel, `panel[${i}]`, [])) {
      const parent = parentKey(f.path);
      push(id, f.key, `panel ${label}: forbidden field "${f.key}"${parent ? ` in ${parent}` : ''}`);
    }
    for (const d of findBadDatasources(panel, `panel[${i}]`, [])) {
      push(id, 'datasource', `panel ${label}: "datasource" must be a string (got object)`);
    }
  });

  return vs;
}

async function collectTargets(arg) {
  if (!arg) {
    const dir = join(process.cwd(), 'dashboards');
    if (!existsSync(dir)) return { targets: [], label: 'dashboards/' };
    const entries = await readdir(dir);
    return { targets: entries.filter(n => n.endsWith('.json')).map(n => join(dir, n)).sort(), label: 'dashboards/' };
  }
  const full = join(process.cwd(), arg);
  const st = await stat(full);
  if (st.isDirectory()) {
    const entries = await readdir(full);
    return {
      targets: entries.filter(n => n.endsWith('.json')).map(n => join(full, n)).sort(),
      label: arg.endsWith('/') ? arg : `${arg}/`,
    };
  }
  return { targets: [full], label: arg };
}

async function main() {
  const arg = process.argv[2];
  let targets, label;
  try {
    const r = await collectTargets(arg);
    targets = r.targets; label = r.label;
  } catch (e) {
    console.error(`[VVU dashboard-validator] ✗ cannot stat "${arg}": ${e.message}`);
    process.exit(2);
  }

  if (targets.length === 0) {
    console.log(`[VVU dashboard-validator] no dashboard JSON files found in ${label}`);
    process.exit(0);
  }

  console.log(`[VVU dashboard-validator] scanning ${label}`);

  const summaries = [];
  let allVs = [];

  for (const t of targets) {
    const rel = relative(process.cwd(), t);
    let raw;
    try {
      raw = await readFile(t, 'utf-8');
    } catch (e) {
      console.log(`  ✗ ${rel} — read error: ${e.message}`);
      summaries.push({ file: rel, panelCount: 0, violations: 1 });
      allVs.push({ file: rel, panelId: null, field: null, message: `read error: ${e.message}` });
      continue;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      const m = e.message.match(/position (\d+)/);
      let where = '';
      if (m) {
        const pos = +m[1];
        const before = raw.slice(0, pos);
        const line = before.split('\n').length;
        const col = pos - before.lastIndexOf('\n');
        where = `:${line}:${col}`;
      }
      console.log(`  ✗ ${rel} — JSON parse error${where}: ${e.message}`);
      summaries.push({ file: rel, panelCount: 0, violations: 1 });
      allVs.push({ file: rel, panelId: null, field: null, message: `JSON parse error${where}: ${e.message}` });
      continue;
    }
    const vs = validate(t, data);
    const panelCount = Array.isArray(data.panels) ? data.panels.length : 0;
    if (vs.length === 0) {
      console.log(`  ✓ ${rel} — ${panelCount} panel${panelCount === 1 ? '' : 's'}, all valid`);
    } else {
      console.log(`  ✗ ${rel} — ${vs.length} violation${vs.length === 1 ? '' : 's'}:`);
      for (const v of vs) console.log(`      ${v.message}`);
    }
    summaries.push({ file: rel, panelCount, violations: vs.length });
    allVs = allVs.concat(vs);
  }

  await writeFile(
    join(process.cwd(), 'dashboard-validator-report.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      dashboardsScanned: summaries.length,
      failed: summaries.filter(s => s.violations > 0).length,
      totalViolations: allVs.length,
      allowedPanelTypes: [...ALLOWED_PANEL_TYPES],
      summaries,
      violations: allVs,
      status: allVs.length === 0 ? 'PASS' : 'FAIL',
    }, null, 2),
  );

  const failed = summaries.filter(s => s.violations > 0).length;
  if (allVs.length > 0) {
    console.log(`[VVU dashboard-validator] ${failed} dashboard${failed === 1 ? '' : 's'} failed, ${allVs.length} violation${allVs.length === 1 ? '' : 's'}`);
    process.exit(1);
  }
  console.log(`[VVU dashboard-validator] all ${summaries.length} dashboard${summaries.length === 1 ? '' : 's'} passed, 0 violations`);
  process.exit(0);
}

main().catch(e => {
  console.error('[VVU dashboard-validator] fatal error:', e);
  process.exit(2);
});
