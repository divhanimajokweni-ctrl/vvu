// scripts/governance-keys.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generate the governance kernel's Ed25519 permit keypair and print the env
// block (or append it to .env with --write).
//
//   bun scripts/governance-keys.ts            # print
//   bun scripts/governance-keys.ts --write    # append to .env if vars absent
//
// The PEMs are emitted as single-line base64 (dotenv-safe). The key id is
// the sha256 fingerprint of the public key's SPKI DER (first 16 hex), so a
// key rotation is visible in every permit's keyId and old permits fail
// verification with PERMIT_KEY_ID_MISMATCH — by design.
//
// Production: replace env-held private keys with a KMS/HSM-backed signer
// before CONTROLLED_BENCH (src/lib/permit-crypto.ts is the only PEM touchpoint).
// ─────────────────────────────────────────────────────────────────────────────

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, type KeyObject } from 'node:crypto';

// Inlined fingerprint (same derivation as src/lib/permit-crypto.ts) so the
// script runs under plain `bun` without the react-server condition the
// server-only guard requires.
function fingerprintKeyId(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  return `ed25519-${createHash('sha256').update(der).digest('hex').slice(0, 16)}`;
}

const write = process.argv.includes('--write');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const keyId = fingerprintKeyId(publicKey);
const privB64 = Buffer.from(
  privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
).toString('base64');
const pubB64 = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }).toString()
).toString('base64');

const block = [
  '',
  '# ── Governance kernel (Round 56) — Ed25519 permit signing ──────────────',
  `GOVERNANCE_KEY_ID=${keyId}`,
  `GOVERNANCE_PRIVATE_KEY_PEM=${privB64}`,
  `GOVERNANCE_PUBLIC_KEY_PEM=${pubB64}`,
].join('\n');

if (write) {
  const envPath = '.env';
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  if (existing.includes('GOVERNANCE_PRIVATE_KEY_PEM')) {
    console.log('GOVERNANCE_* keys already present in .env — nothing written.');
    console.log(`Existing key id in use (see .env). Generated key id was: ${keyId}`);
  } else {
    appendFileSync(envPath, `${block}\n`);
    console.log(`Appended governance keyring to .env — keyId ${keyId}`);
  }
} else {
  console.log(block);
  console.log(`\n# keyId: ${keyId}`);
}
