// chain.ts — SHA-256 hash-chained WORM journal for the mesh-demo rail.
// Append-only JSONL on disk; /verify walks from genesis and recomputes every
// hash. A missing sensor reading is never invented here — the journal records
// exactly what the phone declared (live value or undefined + reason).

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type JournalEvent = {
  seq: number;
  ts: string;
  type: string;
  node?: string;
  ch?: string;
  state?: string;
  value?: unknown;
  reason?: string;
  note?: string;
  prev: string;
  hash: string;
};

type EventInput = Omit<JournalEvent, 'seq' | 'ts' | 'prev' | 'hash'>;

function bodyHash(e: Omit<JournalEvent, 'hash'>): string {
  const canon = [
    e.seq,
    e.ts,
    e.type,
    e.node ?? '',
    e.ch ?? '',
    e.state ?? '',
    JSON.stringify(e.value ?? null),
    e.reason ?? '',
    e.note ?? '',
    e.prev,
  ].join('|');
  return createHash('sha256').update(canon).digest('hex');
}

export type VerifyResult =
  | { valid: true; entries: number; head: string; walked_from: string; duration_ms: number }
  | { valid: false; break_at_seq: number; reason: string; entries: number; duration_ms: number };

export class Chain {
  private head = 'GENESIS';
  private count = 0;

  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(this.file)) {
      const lines = readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
      if (lines.length > 0) {
        const last = JSON.parse(lines[lines.length - 1]) as JournalEvent;
        this.head = last.hash;
        this.count = last.seq + 1;
      }
    }
    if (this.count === 0) {
      this.append({ type: 'chain.genesis', note: 'mesh-demo journal genesis' });
    }
  }

  append(input: EventInput): JournalEvent {
    const e: Omit<JournalEvent, 'hash'> = {
      seq: this.count,
      ts: new Date().toISOString(),
      prev: this.head,
      ...input,
    };
    const full: JournalEvent = { ...e, hash: bodyHash(e) };
    appendFileSync(this.file, JSON.stringify(full) + '\n');
    this.head = full.hash;
    this.count++;
    return full;
  }

  snapshot(): { head: string; entries: number; genesis: 'GENESIS' } {
    return { head: this.head, entries: this.count, genesis: 'GENESIS' };
  }

  tail(n: number): JournalEvent[] {
    if (!existsSync(this.file)) return [];
    const lines = readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-n).map((l) => JSON.parse(l) as JournalEvent);
  }

  verify(): VerifyResult {
    const t0 = Date.now();
    if (!existsSync(this.file)) {
      return { valid: true, entries: 0, head: 'GENESIS', walked_from: 'GENESIS', duration_ms: Date.now() - t0 };
    }
    const lines = readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
    let prev = 'GENESIS';
    for (let idx = 0; idx < lines.length; idx++) {
      let e: JournalEvent;
      try {
        e = JSON.parse(lines[idx]) as JournalEvent;
      } catch {
        return { valid: false, break_at_seq: idx, reason: 'MALFORMED_LINE', entries: lines.length, duration_ms: Date.now() - t0 };
      }
      if (e.seq !== idx) {
        return { valid: false, break_at_seq: e.seq ?? idx, reason: 'SEQ_GAP', entries: lines.length, duration_ms: Date.now() - t0 };
      }
      if (e.prev !== prev) {
        return { valid: false, break_at_seq: e.seq, reason: 'PREV_MISMATCH', entries: lines.length, duration_ms: Date.now() - t0 };
      }
      const { hash: _hash, ...rest } = e;
      if (bodyHash(rest) !== e.hash) {
        return { valid: false, break_at_seq: e.seq, reason: 'HASH_MISMATCH', entries: lines.length, duration_ms: Date.now() - t0 };
      }
      prev = e.hash;
    }
    return { valid: true, entries: lines.length, head: prev, walked_from: 'GENESIS', duration_ms: Date.now() - t0 };
  }
}
