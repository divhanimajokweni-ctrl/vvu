// mini-services/safegrid/src/db/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SafeGrid DB client — drizzle over bun:sqlite, WAL + busy_timeout.
//
// The raw `Database` handle is exported too: the outbox claim query is a
// single-statement atomic UPDATE ... RETURNING (src/outbox/claim.ts) and
// running it through the raw handle keeps that exactly one statement —
// the shortest possible "short transaction" (§2: claim, commit the lease,
// THEN POST; no lock held across the network call).
//
// Migrations: every .sql in src/db/migrations runs at boot, idempotently,
// in filename order, inside one transaction. 0001_init.sql creates both
// tables with all columns and constraints (spec §6.10).
// ─────────────────────────────────────────────────────────────────────────────

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as schema from './schema';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export const DB_PATH =
  process.env.SAFEGRID_DB_PATH ?? join(HERE, '..', '..', 'data', 'safegrid.db');

/** bun:sqlite raw handle — WAL, awaited busy timeout. EXPORTED for the
 * single-statement claim (and for tests that need a second connection). */
export const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA busy_timeout = 5000;');
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

/** Apply every idempotent migration (one transaction per file). */
export function migrate(): string[] {
  const dir = join(HERE, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    sqlite.transaction(() => {
      sqlite.exec(sql);
    })();
  }
  return files;
}

/** RFC 3339 UTC with millisecond precision + Z — the estate timestamp
 * contract (§3). All TEXT timestamp columns use exactly this format so
 * lexicographic comparison equals chronological comparison. */
export function nowIso(): string {
  return new Date().toISOString();
}

export { schema };
