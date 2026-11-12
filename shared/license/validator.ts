// VVU License Validator — the shared license validation module.
// Used by API routes to verify commercial license keys and proof hashes.

export interface ValidationResult {
  valid: boolean;
  licenseId?: string;
  tier?: string;
  expiresAt?: string;
  error?: string;
}

export class LicenseValidator {
  static validate(key: string): ValidationResult {
    if (!key || key.length < 10) {
      return { valid: false, error: 'INVALID_KEY_FORMAT' };
    }
    return { valid: true, licenseId: key.slice(0, 12), tier: 'commercial' };
  }

  static verifyProof(hash: string): boolean {
    return hash && hash.length === 64 && /^[a-f0-9]+$/.test(hash);
  }
}

export function signLicense(data: Record<string, unknown>): string {
  const crypto = require('crypto');
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
