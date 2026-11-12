#!/usr/bin/env node
/**
 * Golden Rule Checker — AST scanner that enforces the "AIR is horizontal
 * infrastructure" rule. Scans the open-source/ directory for product-specific
 * strings that must never leak into the horizontal core.
 *
 * Usage: node scripts/golden-rule-checker.js
 * Exit: 0 = pass, 1 = violations found
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname, relative } from 'path';

const OSS_DIR = join(process.cwd(), 'open-source');
const FORBIDDEN_STRINGS = [
  'ProofBridge', 'Ubuntu Pools', 'UbuntuPools', 'SafeGrid',
  'Stokvel', 'ROSCA', 'FSCA', 'FICA', 'POPIA',
  'kimi_reply', 'vision_agent', 'Hydro-Gateway', 'HBK', 'VVU EARTH TECH',
  'Jendamark', 'Welfit Oddy', 'Formex', 'Algoa', 'Gqeberha',
  'NMBM', 'Propella', 'TIA Seed', 'WRC',
];

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.rs', '.go'];

async function scanDirectory(dir) {
  let violations = [];
  let scannedCount = 0;
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;

    if (entry.isDirectory()) {
      const result = await scanDirectory(fullPath);
      violations = violations.concat(result.violations);
      scannedCount += result.scanned;
    } else if (FILE_EXTENSIONS.includes(extname(entry.name))) {
      scannedCount++;
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) return;
        FORBIDDEN_STRINGS.forEach(keyword => {
          if (line.includes(keyword)) {
            violations.push({
              file: relative(process.cwd(), fullPath),
              line: index + 1,
              keyword,
              content: line.trim().slice(0, 80),
            });
          }
        });
      });
    }
  }
  return { violations, scanned: scannedCount };
}

async function main() {
  try {
    const { violations, scanned } = await scanDirectory(OSS_DIR);

    const report = {
      timestamp: new Date().toISOString(),
      filesScanned: scanned,
      violationCount: violations.length,
      forbiddenStrings: FORBIDDEN_STRINGS,
      violations,
      status: violations.length === 0 ? 'PASS' : 'FAIL',
    };

    // Write report
    await writeFile(
      join(process.cwd(), 'golden-rule-report.json'),
      JSON.stringify(report, null, 2),
    );

    if (violations.length > 0) {
      console.error('❌ GOLDEN RULE VIOLATION: open-source/ contains product-specific logic.');
      violations.forEach(v =>
        console.error(`  📄 ${v.file}:${v.line} | "${v.keyword}" → ${v.content}`),
      );
      console.error(`\n${violations.length} violation(s) in ${scanned} file(s).`);
      process.exit(1);
    }

    console.log(`✅ Golden Rule Check Passed. ${scanned} files scanned, 0 violations.`);
    process.exit(0);
  } catch (e) {
    console.error('Golden rule checker error:', e.message);
    process.exit(2);
  }
}

main();
