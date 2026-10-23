# LITLE Trust Fabric — GenesisAI

## Ownership
GenesisAI is the canonical runtime. LITLE is an internal trust/evidence/certification fabric; it is not a second cognitive runtime.

## Operational surface
- `POST /api/v1/litle/attest` creates a deterministic LITLE identity binding, evidence-chain root, epistemic profile and DAC certificate.
- `POST /api/v1/litle/verify` verifies the certificate and optional evidence chain. The HMAC secret never crosses the API boundary.
- `GET /api/v1/status` reports the LITLE fabric as an active Genesis subsystem.

## Cryptographic boundary
L-512.v1 is implemented as a fixed 512-byte container format. Canonical transport uses Bech32m. Evidence roots and container hashes use SHA3-512 through Node's native crypto implementation. Certificates use HMAC-SHA256 with the existing BOOKPI integrity secret.

This implementation does not claim to be a native ML-DSA/Dilithium implementation. Post-quantum signature integration remains a separate cryptographic-provider boundary.

## Epistemic layer
The current executable weighting follows the source implementation: methodological rigor 20%, reproducibility 18%, citation integrity 15%, peer review 12%, data transparency 12%, AI provenance 10%, longevity 8%, epistemological novelty 5%.

## Security
`BOOKPI_INTEGRITY_SECRET` must be configured externally with at least 32 characters in production. Certificate verification uses the server-side secret and does not accept a client-provided secret.