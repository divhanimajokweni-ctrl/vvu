#!/usr/bin/env node
/**
 * inject-headers.js — Prepend the VVU EARTH TECH license header to all
 * .ts/.tsx files in open-source/ and shared/ that don't already have one.
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const HEADER = `/**
 * @license
 * VVU EARTH TECH ⚙ - AIR Kernel
 * Copyright (c) 2026 Venture Vision Ubuntu
 *
 * LICENSE: Apache-2.0 (Open Source) OR Commercial (Enterprise)
 * See LICENSE and COMMERCIAL_LICENSE.md for details.
 *
 * This file is part of the VVU EARTH TECH horizontal infrastructure.
 * It contains no product-specific logic (Golden Rule).
 */
`;

const DIRS = ['open-source', 'shared'];
const EXTENSIONS = ['.ts', '.tsx'];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (EXTENSIONS.includes(extname(e.name))) files.push(full);
  }
  return files;
}

async function main() {
  let injected = 0;
  let skipped = 0;
  for (const dir of DIRS) {
    try {
      const files = await walk(dir);
      for (const f of files) {
        const content = await readFile(f, 'utf-8');
        if (content.startsWith('/**') && content.includes('@license')) {
          skipped++;
          continue;
        }
        await writeFile(f, HEADER + content, 'utf-8');
        injected++;
        console.log(`  ✅ ${f}`);
      }
    } catch {
      /* dir doesn't exist */
    }
  }
  console.log(`\n${injected} header(s) injected, ${skipped} already had headers.`);
}

main();
