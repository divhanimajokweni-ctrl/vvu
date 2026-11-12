/**
 * Regenerate the Ed25519 key pair + sample licenses for the 4 tiers.
 * Run with: bun run scripts/regenerate-license-keys.ts
 *
 * Output:
 *   keys/vvu-public.pem    — Ed25519 public key (PEM)
 *   keys/vvu-private.pem   — Ed25519 private key (PEM, NEVER shipped in OSS)
 *   keys/sample-licenses.json — 4 signed licenses (one per tier)
 */
import { generateKeyPairSync } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { signLicense } from "../shared/license/validator";
import { TIER_FEATURES, type LicensePayload, type LicenseTier } from "../shared/license/license-schema";

const KEYS_DIR = join(process.cwd(), "keys");
mkdirSync(KEYS_DIR, { recursive: true });

// 1. Generate Ed25519 key pair
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
writeFileSync(join(KEYS_DIR, "vvu-public.pem"), pubPem);
writeFileSync(join(KEYS_DIR, "vvu-private.pem"), privPem, { mode: 0o600 });
console.log("✓ Generated Ed25519 key pair → keys/vvu-public.pem, keys/vvu-private.pem");

// 2. Build sample licenses for the 4 tiers
const now = new Date();
const iso = (d: Date) => d.toISOString();
const inFuture = (years: number) => iso(new Date(now.getFullYear() + years, now.getMonth(), now.getDate()));

const tiers: Array<{ tier: LicenseTier; orgId: string; orgName: string; maxNodes: number; region: string; hardwareFingerprint?: string }> = [
  { tier: "GOVERNANCE", orgId: "nmbm", orgName: "Nelson Mandela Bay Municipality", maxNodes: 1000, region: "ZA-EC", hardwareFingerprint: "gqeberha-hbk-01" },
  { tier: "ENTERPRISE", orgId: "capetown-ent", orgName: "Cape Town Enterprise", maxNodes: 100, region: "ZA-WC" },
  { tier: "PRO", orgId: "polokwane-log", orgName: "Polokwane Logistics", maxNodes: 25, region: "ZA-LP" },
  { tier: "OPEN_SOURCE", orgId: "oss-contributor", orgName: "Open Source Contributor", maxNodes: 5, region: "GLOBAL" },
];

const licenses: Record<string, { payload: LicensePayload; signature: string }> = {};
for (const t of tiers) {
  const payload: LicensePayload = {
    licenseId: `lic_${t.orgId}_${t.tier.toLowerCase()}_${now.getFullYear()}`,
    tier: t.tier,
    organizationId: t.orgId,
    organizationName: t.orgName,
    issuedAt: iso(now),
    expiresAt: inFuture(2),
    features: TIER_FEATURES[t.tier],
    maxNodes: t.maxNodes,
    region: t.region,
    // REA feature flag — only the GOVERNANCE (founder) tier gets it by default.
    // B2B pilots (ENTERPRISE, PRO, OPEN_SOURCE) require explicit founder enablement.
    REA_ENABLED: t.tier === "GOVERNANCE",
    // Empty consent log — appended to per-target as scans are consented.
    consentLog: [],
    ...(t.hardwareFingerprint ? { hardwareFingerprint: t.hardwareFingerprint } : {}),
  };
  const signed = signLicense(payload, privPem);
  licenses[t.orgId] = signed;
  const reaFlag = t.tier === "GOVERNANCE" ? "REA=true" : "REA=false";
  console.log(`  ✓ ${t.tier.padEnd(12)} ${t.orgName.padEnd(40)} ${reaFlag}`);
}

const out = { publicKeyPem: pubPem, licenses };
writeFileSync(join(KEYS_DIR, "sample-licenses.json"), JSON.stringify(out, null, 2));
console.log("✓ Wrote keys/sample-licenses.json with 4 signed licenses");
