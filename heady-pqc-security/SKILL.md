---
name: heady-pqc-security
description: Use when implementing post-quantum cryptography, WebAuthn passwordless authentication, mutual TLS, IP classification and geo-guarding, secure handshake protocols, Web3 ledger anchoring, RBAC vendor access control, environment validation, or secret rotation in the Heady™ ecosystem. Keywords include PQC, post-quantum, WebAuthn, mTLS, mutual TLS, IP classification, geo-guard, handshake, Web3, ledger anchor, RBAC, secret rotation, env validator, and advanced security.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ PQC & Advanced Security

## When to Use This Skill

Use this skill when the user needs to:
- Implement post-quantum cryptographic protections
- Set up WebAuthn passwordless authentication
- Configure mutual TLS (mTLS) for service-to-service auth
- Classify IPs and enforce geo-based access control
- Anchor audit trails to Web3 ledgers
- Manage RBAC for vendor/partner access
- Validate environment configurations
- Automate secret rotation

## Module Map

| Module | Path | Role |
|---|---|---|
| pqc | src/security/pqc.js | Post-quantum cryptography (CRYSTALS-Kyber, Dilithium) |
| webauthn | src/security/webauthn.js | FIDO2/WebAuthn passwordless auth |
| mtls | src/security/mtls.js | Mutual TLS certificate management |
| ip-classification | src/security/ip-classification.js | IP geo-classification and threat scoring |
| handshake | src/security/handshake.js | Secure handshake protocol for service auth |
| web3-ledger-anchor | src/security/web3-ledger-anchor.js | Blockchain audit trail anchoring |
| rbac-vendor | src/security/rbac-vendor.js | Role-based access for vendors/partners |
| env-validator | src/security/env-validator.js | Environment variable validation |
| secret-rotation | src/security/secret-rotation.js | Automated secret/key rotation |

## Instructions

### Post-Quantum Cryptography (PQC)
1. Use CRYSTALS-Kyber for key encapsulation (KEM).
2. Use CRYSTALS-Dilithium for digital signatures.
3. Hybrid mode: combine classical (X25519) + PQC for defense in depth.
4. Key sizes follow NIST Level 3 (192-bit equivalent security).
5. PQC protects: API tokens, session keys, stored secrets, agent keypairs.

### WebAuthn Integration
1. Support FIDO2 passkeys for user authentication.
2. Store credential public keys in the user profile database.
3. Challenge generation uses crypto.randomBytes(32).
4. Attestation verification supports packed, tpm, and none formats.
5. Resident keys enable true passwordless login.

### Mutual TLS (mTLS)
1. Service-to-service communication requires client certificates.
2. Certificate authority (CA) hierarchy: Root CA -> Intermediate CA -> Service Certs.
3. Certificate issuance via configs/pki/scripts/issue-cert.sh.
4. Rotation: certificates auto-renew at 80% of validity period.
5. Pinning: service certs are pinned in the service registry.

### IP Classification & Geo-Guard
- Classify IPs into tiers: trusted, known, unknown, suspicious, blocked.
- Geo-fencing: restrict access by country/region.
- Threat scoring: integrate with IP reputation databases.
- Rate limiting adjusts based on IP classification tier.
- Phi-scaled trust levels: 1.0 (trusted) -> 0.618 -> 0.382 -> 0.236 -> 0.0 (blocked).

### Web3 Ledger Anchoring
1. Hash critical audit events (SHA-256).
2. Batch hashes into Merkle trees (Fibonacci-sized batches: 8, 13, 21).
3. Anchor Merkle root to a blockchain (Ethereum, Polygon).
4. Verification: prove any event is in the anchored tree.
5. Use for: security events, compliance evidence, IP claims.

### Secret Rotation
- Rotation schedule: Fibonacci intervals (8, 13, 21, 34 days).
- Supported: API keys, database credentials, JWT signing keys, TLS certs.
- Zero-downtime rotation with dual-key overlap period.
- Integration with 1Password, Vault, or native secret store.

## Output Format

- Security Configuration
- Cryptographic Parameters
- Certificate Chain Status
- IP Classification Report
- Rotation Schedule
- Compliance Evidence
