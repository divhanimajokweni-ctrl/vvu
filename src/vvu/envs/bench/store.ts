// BENCH store — WORM chain, Ed25519 keys, policies, receipts, claims, log.
import { makeStore, LogEntry } from "@/vvu/store";
import { WormChain, ChainRow, SHA256, Ed25519, contentHash, canonical, uid, seedBytesFromString } from "@/lib/vvu-utils";

export interface BenchReceipt {
  receipt_id: string;
  claim_ref: string;
  policy: string;
  consent_tier: "anon" | "paying" | "enterprise";
  artefact_id: string;
  digest: string;
  signature: string;
  anchor: { anchor_id: string; selfDeclaredStub: boolean; note: string };
  receipt_hash: string;
  outcome: "PROVEN" | "INCONCLUSIVE" | "NOT_PROVEN" | "BLOCKED";
  checks: { check: string; result: "PASS" | "FAIL"; detail: string }[];
  scope: string;
  limitations: string[];
  when: number;
}

export interface BenchClaim {
  claim_id: string;
  text: string;
  policy: string;
  tier: string;
  author: string;
  when: number;
}

export interface BenchKeys {
  publicKey: string;
  secretSeed: string;
}

export interface BenchState {
  chain: ChainRow[];
  receipts: BenchReceipt[];
  claims: BenchClaim[];
  keys: BenchKeys;
  seenDigests: string[];
}

const ENV_KEY = "bench.vvu.v1";

const initialKeys = (): BenchKeys => {
  const seed = seedBytesFromString("bench-key-seed-2026", 32);
  const kp = Ed25519.keypairFromSeed(seed);
  return { publicKey: kp.publicKey, secretSeed: kp.secretSeed };
};

const initialState = (): BenchState => ({
  chain: [],
  receipts: [],
  claims: [],
  keys: initialKeys(),
  seenDigests: [],
});

export const useBench = makeStore<BenchState>(ENV_KEY, initialState);

// ---- chain helper bound to store ----
export function commitChainRow(payload: string): ChainRow {
  const st = useBench.getState();
  const chain = new WormChain("vvu-bench");
  chain.rows = [...st.d.chain];
  const row = chain.commit(payload);
  st.commit("chain.append", `row ${row.seq} appended · payload ${payload.slice(0, 40)}`, (d) => {
    d.chain = chain.rows;
    d.seenDigests = [...d.seenDigests, row.digest];
  });
  return row;
}

export function tamperRow(seq: number, payload: string): void {
  const st = useBench.getState();
  st.commit("chain.tamper", `row ${seq} payload altered`, (d) => {
    if (!d.chain[seq]) return;
    d.chain[seq] = { ...d.chain[seq], payload };
  });
}

export function restoreRow(seq: number): void {
  const st = useBench.getState();
  st.commit("chain.repair", `row ${seq} rehashed`, (d) => {
    const r = d.chain[seq];
    if (!r) return;
    const prev = seq === 0 ? "0".repeat(64) : d.chain[seq - 1].digest;
    const payload_hash = WormChain.payloadHash(r.payload);
    const partial = { seq: r.seq, prev_hash: prev, payload: r.payload, payload_hash };
    const digest = WormChain.rowDigest(partial);
    d.chain[seq] = { ...partial, digest };
  });
}

export function seedBench(): void {
  const st = useBench.getState();
  if (st.d.chain.length > 0) return;
  const chain = new WormChain("vvu-bench");
  for (let i = 0; i < 12; i++) {
    chain.commit(`bench-obs-${i}|${Date.now() + i}`);
  }
  st.commit("chain.seed", "12 rows appended from genesis", (d) => {
    d.chain = chain.rows;
    // NOTE: seenDigests tracks digests from PRIOR sessions (persisted via localStorage),
    // NOT the current chain's own digests. Seeding it with the chain's own digests would
    // make the REPLAY check immediately fail on the first verification. Leave it as-is
    // (empty on first seed, accumulates across reloads via the persisted store).
  });
}

export function getChain(): WormChain {
  const c = new WormChain("vvu-bench");
  c.rows = useBench.getState().d.chain;
  return c;
}

export function signReceipt(msg: string): string {
  const seed = useBench.getState().d.keys.secretSeed;
  return Ed25519.sign(seed, msg);
}

export function verifyPub(pub: string, msg: string, sig: string): boolean {
  return Ed25519.verify(pub, msg, sig);
}

export const log = (type: string, detail: string) =>
  useBench.getState().commit(type, detail);

export type { LogEntry };
