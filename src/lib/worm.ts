// ══════════════════════════════════════════════════════════════════════
// VVU · WORM chain — the canonical hash chain that proves physical state
// changes for a published twin.
//
// Spec:
//   • RFC 8785 JCS canonicalisation (sorted keys, deterministic numbers)
//   • SHA-256 source_hash = H(canonical(payload))
//   • SHA-256 chain_hash  = H(prev_chain_hash || source_hash)
//   • Ed25519 token signing (keypair persisted to db/.signing-key.json)
//
// Every share, view, revoke, expiry, export and deletion is appended here.
// The receipt is a Merkle-style root over this chain. verifyChain()
// recomputes every link from seq 0 — independent, offline, no API key.
// ══════════════════════════════════════════════════════════════════════

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// ─── RFC 8785 JCS canonicalisation ────────────────────────────────────────

function serializeString(s: string): string {
  // JSON.stringify matches JCS string escaping (control chars, ", \, \uXXXX)
  return JSON.stringify(s);
}

function serializeNumber(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    throw new Error("JCS: NaN / Infinity are not serialisable");
  }
  // JCS: -0 serialises as "0". String(-0) === "0" in V8, but be explicit.
  if (Object.is(n, -0) || n === 0) return "0";
  // V8's Number.prototype.toString already yields the shortest round-trip
  // representation with lowercase "e" and required exponent sign — JCS
  // compatible for every value this estate will emit.
  return String(n);
}

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return serializeNumber(value);
  if (typeof value === "string") return serializeString(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // JCS sorts keys by UTF-16 code unit order — the default Array.sort.
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .filter((k) => obj[k] !== undefined)
        .map((k) => `${serializeString(k)}:${canonicalize(obj[k])}`)
        .join(",") +
      "}"
    );
  }
  throw new Error("JCS: unsupported type " + typeof value);
}

// ─── SHA-256 ──────────────────────────────────────────────────────────────

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

// ─── Chain primitives ─────────────────────────────────────────────────────

export type ChainEventInput = {
  eventType: string;
  payload: Record<string, unknown>;
};

export type ChainEventRow = {
  seq: number;
  eventType: string;
  payload: string; // canonical JSON
  sourceHash: string;
  chainHash: string;
};

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** Compute the next chain link from the previous chain hash + a payload. */
export function appendEvent(
  prevChainHash: string,
  eventType: string,
  payload: Record<string, unknown>
): ChainEventRow {
  const canon = canonicalize(payload);
  const sourceHash = sha256Hex(canon);
  const chainHash = sha256Hex(prevChainHash + sourceHash);
  return { seq: 0, eventType, payload: canon, sourceHash, chainHash };
}

export type VerifyResult =
  | { valid: true; root: string }
  | { valid: false; brokenAt: number; reason: string };

/**
 * Recompute the whole chain from seq 0. No API key, no network. This is the
 * "the user can recompute the chain independently" invariant.
 */
export function verifyChain(rows: ChainEventRow[]): VerifyResult {
  let prev = GENESIS_HASH;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.seq !== i) {
      return { valid: false, brokenAt: i, reason: `SEQ_GAP at ${i}` };
    }
    const expectedSource = sha256Hex(row.payload);
    if (expectedSource !== row.sourceHash) {
      return { valid: false, brokenAt: i, reason: `SOURCE_HASH_MISMATCH at ${i}` };
    }
    const expectedChain = sha256Hex(prev + row.sourceHash);
    if (expectedChain !== row.chainHash) {
      return { valid: false, brokenAt: i, reason: `CHAIN_LINK_BROKEN at ${i}` };
    }
    prev = row.chainHash;
  }
  return { valid: true, root: prev };
}

// ─── Ed25519 signing (keypair persisted across restarts) ───────────────────

type SigningKey = {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  publicKeyPem: string;
  publicKeyB64: string; // base64 of the raw 32-byte public key, for receipts
  kid: string; // key id = first 8 hex of the public key
};

const KEY_PATH = path.join(process.cwd(), "db", ".signing-key.json");

let cachedKey: SigningKey | null = null;

async function loadOrCreateSigningKey(): Promise<SigningKey> {
  if (cachedKey) return cachedKey;

  try {
    const raw = await fs.readFile(KEY_PATH, "utf8");
    const parsed = JSON.parse(raw) as {
      privateKeyPem: string;
      publicKeyPem: string;
    };
    const privateKey = crypto.createPrivateKey({
      key: parsed.privateKeyPem,
      format: "pem",
      type: "pkcs8",
    });
    const publicKey = crypto.createPublicKey({
      key: parsed.publicKeyPem,
      format: "pem",
      type: "spki",
    });
    cachedKey = materialiseKey(privateKey, publicKey);
    return cachedKey;
  } catch {
    // first boot — generate and persist
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    const publicKeyPem = publicKey
      .export({ format: "pem", type: "spki" })
      .toString();
    await fs.mkdir(path.dirname(KEY_PATH), { recursive: true });
    await fs.writeFile(
      KEY_PATH,
      JSON.stringify({ privateKeyPem, publicKeyPem }, null, 2),
      "utf8"
    );
    cachedKey = materialiseKey(privateKey, publicKey);
    return cachedKey;
  }
}

function materialiseKey(
  privateKey: crypto.KeyObject,
  publicKey: crypto.KeyObject
): SigningKey {
  const rawPub = publicKey.export({ type: "spki", format: "der" });
  // SPKI DER for Ed25519: last 32 bytes are the raw public key
  const raw32 = rawPub.subarray(rawPub.length - 32);
  const publicKeyB64 = raw32.toString("base64");
  const kid = raw32.subarray(0, 4).toString("hex");
  return {
    privateKey,
    publicKey,
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    publicKeyB64,
    kid,
  };
}

export async function getSigningKey(): Promise<SigningKey> {
  return loadOrCreateSigningKey();
}

// ─── Signed share tokens ──────────────────────────────────────────────────

export type ShareTokenPayload = {
  share_id: string;
  twin_hash: string;
  twin_name: string;
  tier: string;
  viewer_limit: number;
  expires_at: string; // ISO
  issued_by: string;
  issued_at: string; // ISO
};

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** Sign a payload into a self-contained, forge-resistant share token. */
export async function signToken(
  payload: ShareTokenPayload
): Promise<{ token: string; signature: string; kid: string }> {
  const key = await getSigningKey();
  const canon = canonicalize(payload);
  const sig = crypto.sign(null, Buffer.from(canon, "utf8"), key.privateKey);
  const sigB64 = b64url(sig);
  return {
    token: `${b64url(canon)}.${sigB64}`,
    signature: sigB64,
    kid: key.kid,
  };
}

export type TokenVerifyResult =
  | { ok: true; payload: ShareTokenPayload; signature: string; kid: string }
  | { ok: false; reason: string };

/** Verify a token's Ed25519 signature and decode its payload. */
export async function verifyToken(
  token: string
): Promise<TokenVerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "MALFORMED_TOKEN" };
  }
  const [encPayload, encSig] = parts;
  const canon = fromB64url(encPayload).toString("utf8");
  const sig = fromB64url(encSig);
  const key = await getSigningKey();
  const valid = crypto.verify(
    null,
    Buffer.from(canon, "utf8"),
    key.publicKey,
    sig
  );
  if (!valid) {
    return { ok: false, reason: "SIG_INVALID" };
  }
  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(canon) as ShareTokenPayload;
  } catch {
    return { ok: false, reason: "PAYLOAD_UNPARSEABLE" };
  }
  return { ok: true, payload, signature: encSig, kid: key.kid };
}

/** The anonymised viewer hash — SHA-256(IP + UA + shareId). Privacy dedup. */
export function viewerHash(ip: string, ua: string, shareId: string): string {
  return sha256Hex(`${ip}|${ua}|${shareId}`);
}

/** SHA-256 of an arbitrary buffer — used for the Obsidian export file hash. */
export function sha256Buf(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
