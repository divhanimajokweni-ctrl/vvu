# VVU EARTH TECH ⚙ — Commercial License Terms

**Copyright (c) 2026 Venture Vision Ubuntu. All rights reserved.**

This file governs the `commercial/` directory of the VVU EARTH TECH monorepo.
The open-source core (`open-source/` and `shared/`) is licensed under Apache 2.0
(see `LICENSE`). The commercial modules are proprietary and require a valid
signed license issued by Venture Vision Ubuntu.

## Commercial Modules

| Module | Description | Minimum Tier |
|--------|-------------|-------------|
| `commercial/tee-attestation/` | AMD SEV-SNP / Intel SGX hardware attestation | ENTERPRISE |
| `commercial/zk-prover-gpu/` | MI300X cloud ZK proof acceleration | ENTERPRISE |
| `commercial/compliance-automation/` | SOC 2, POPIA auto-evidence generation | ENTERPRISE |
| `commercial/enterprise-sso/` | SAML / OIDC single sign-on | ENTERPRISE |
| `commercial/governance/` | Tokenization, full autonomy, revenue share | GOVERNANCE |

## License Tiers

| Tier | Price | Features |
|------|-------|----------|
| OPEN_SOURCE | Free (Apache 2.0) | AIR Kernel, Epistemic Runtime, HBK Adapter (basic), Safe-Krypte (basic) |
| PRO | R5,000/mo | + Safe-Liner (basic), multi-node basic |
| ENTERPRISE | R25,000/mo | + TEE attestation, ZK prover GPU, compliance automation, enterprise SSO |
| GOVERNANCE | R100k+/mo | + Tokenization, full autonomy, governance engine, 60/30/10 revenue share |

## License Validation

Licenses are Ed25519-signed JSON payloads verified at boot by
`shared/license/validator.ts`. Feature access is gated by
`commercial/governance/feature-gate.ts` (the `@requireFeature` decorator).

## Restrictions

1. **No redistribution** of commercial modules without a valid enterprise license.
2. **No modification** of the license validator or feature gate to bypass tier checks.
3. **Hardware binding**: Enterprise/Governance licenses may be bound to a hardware
   fingerprint. Transferring a bound license to different hardware is prohibited.
4. **The Golden Rule**: The open-source AIR Kernel must remain free of
   product-specific logic. Any contribution that violates this rule will be rejected.

## Contact

For commercial licensing inquiries: legal@vvu.earth
