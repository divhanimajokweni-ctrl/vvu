/**
 * @license
 * VVU EARTH TECH ⚙ - Feature Gate
 * Copyright (c) 2026 Venture Vision Ubuntu
 *
 * LICENSE: Commercial (Enterprise)
 * See COMMERCIAL_LICENSE.md for details.
 */

import { LicenseValidator, type ValidationResult } from '../../shared/license/validator';
import type { SignedLicense } from '../../shared/license/license-schema';

let CACHED_VALIDATION: ValidationResult | null = null;

export function loadLicense(license: SignedLicense, publicKeyPem?: string) {
  const validator = new LicenseValidator(publicKeyPem);
  CACHED_VALIDATION = validator.validate(license);
  return CACHED_VALIDATION;
}

export function getValidation(): ValidationResult | null {
  return CACHED_VALIDATION;
}

export function isFeatureEnabled(featureName: string): boolean {
  if (!CACHED_VALIDATION) return false;
  if (!CACHED_VALIDATION.isValid) return false;
  return CACHED_VALIDATION.features.includes(featureName);
}

/**
 * Feature gate decorator — wraps an async function and throws HF-006 if the
 * required feature is not licensed.
 */
export function requireFeature(featureName: string) {
  return function <T extends (...args: never[]) => Promise<unknown>>(
    target: T,
  ): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      if (!CACHED_VALIDATION) {
        throw new Error('FATAL: License not initialized at boot.');
      }
      if (!CACHED_VALIDATION.isValid) {
        throw new Error(
          `HF-006: Feature '${featureName}' BLOCKED. ${CACHED_VALIDATION.failureReason}`,
        );
      }
      if (!CACHED_VALIDATION.features.includes(featureName)) {
        throw new Error(
          `HF-006: Feature '${featureName}' requires higher tier (current: ${CACHED_VALIDATION.tier}).`,
        );
      }
      return target(...args) as ReturnType<T>;
    }) as T;
  };
}

/**
 * Synchronous feature gate for non-async contexts.
 */
export function guardFeature(featureName: string): void {
  if (!CACHED_VALIDATION) {
    throw new Error('FATAL: License not initialized at boot.');
  }
  if (!CACHED_VALIDATION.isValid) {
    throw new Error(
      `HF-006: Feature '${featureName}' BLOCKED. ${CACHED_VALIDATION.failureReason}`,
    );
  }
  if (!CACHED_VALIDATION.features.includes(featureName)) {
    throw new Error(
      `HF-006: Feature '${featureName}' requires higher tier (current: ${CACHED_VALIDATION.tier}).`,
    );
  }
}
