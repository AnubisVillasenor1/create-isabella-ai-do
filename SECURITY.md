# Security policy — Isabella GenesisAI

## Reporting a vulnerability

Do not publish exploitable details, credentials, personal data, or proof-of-concept payloads in public issues.

Until a dedicated private security contact is configured, report suspected vulnerabilities through the repository owner’s configured GitHub private vulnerability reporting channel. If that channel is not enabled, request a private channel from the maintainers without including exploit details in the initial public message, and include a minimal reproducible report once a private channel exists.

## Secrets

- Never commit API keys, bearer tokens, private keys, service-role keys, personal data, or production datasets.
- Rotate any credential that may have been exposed; deleting a secret from the latest commit does not remove it from Git history.
- Keep `HSF_API_TOKEN`, `GENESIS_ADMIN_API_TOKEN`, `GEMINI_API_KEY`, `MODEL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ISABELLA_APPROVAL_PRIVATE_KEY_PEM`, and `BOOKPI_INTEGRITY_SECRET` in the deployment secret manager or GitHub Actions secrets.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Use least privilege, separate environments, and credential rotation.
- Never place secrets in browser code, source fixtures, logs, telemetry, generated documentation, or API error messages.

## Current security boundaries

- HSF invocation requires `HSF_API_TOKEN`.
- Knowledge admission and administrative review require `GENESIS_ADMIN_API_TOKEN`.
- Public memory submissions are bounded proposals in a process-local review queue; they do not mutate canonical IKES memory.
- Public cognitive endpoints use a fixed viewer principal. Client-supplied roles and principal IDs are not authority.
- Public endpoints have process-local rate limits. These reduce abuse but are not a distributed WAF or a substitute for edge-level rate limiting.
- IKES release requires source/evidence, audit, valid commit and indexing evidence. A proposal is not a released knowledge artifact.
- BookPI currently provides a volatile in-memory SHA-256 hash chain. It is not durable WORM storage, a Merkle tree, or a signed external audit log.
- Human approval verification requires a separately provisioned trusted Ed25519 public key, matching key ID, and bound approver principal. The public key embedded in an approval is not trusted by itself; production approval also requires an authorized approver role.
- Evolution evidence cannot promote a control from self-reported passed=true records alone; an external evidence verifier must be wired.
- The post-quantum and HSM providers are not configured. The system must not claim FIPS/ML-DSA/ML-KEM verification until an actual provider and test evidence exist.

## Cryptographic verification implemented in-process

These controls now verify real signatures and hashes instead of returning placeholder successes. They remain process-local and have not been externally audited.

- **Passwords:** scrypt with a random per-hash salt and self-describing cost parameters (`N`, `r`, `p`). Legacy unsalted SHA-256 hashes are rejected.
- **TOTP:** requires an enrolled secret, accepts a ±1 time-step window, and refuses a time step already consumed by the same credential.
- **WebAuthn:** validates `clientDataJSON` type, exact challenge, origin, `crossOrigin`, RP ID hash, user-presence flag, optional user-verification flag, monotonically increasing `signCount`, and the assertion signature. `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` (or per-credential metadata) are required trust anchors; without them assertions fail closed.
- **Certificates:** requires a currently valid X.509 certificate whose SPKI exactly matches the pinned credential key, plus a signature over the challenge. A self-signed or external certificate is not trusted merely because it parses.
- **Device credential:** requires a signature over `challenge + "\n" + attestation` verified with the enrolled device key. Attestations of type `none`, missing quotes, and missing verification keys are treated as untrusted.
- **Device trust:** verification requires a server-issued, single-use, 60-second challenge plus a fresh signature over that challenge from the enrolled device key. The challenge is consumed on every attempt, including failures, so an enrollment quote cannot be replayed as a session proof.
- **Evidence and policy:** cognitive governance denies when no policy applies, evaluates a restricted expression DSL without `eval`, verifies evidence signatures only against registered trusted keys, enforces classification clearance, requires signatures for confidential/restricted evidence, verifies every provenance link, and fails a quality gate with no checks.
- **Sandbox:** refuses execution with `SANDBOX_BACKEND_UNAVAILABLE` when no isolation backend is configured.

**Residual limits:** identity, device, and trust-anchor registries are in memory; there is no durable replay cache across process restarts. Challenge freshness for WebAuthn, certificate, and device *credentials* is the caller's responsibility — the identity provider checks the challenge it receives but does not issue or persist a nonce store for those factors. Certificate chains, revocation (CRL/OCSP), WebAuthn attestation trust chains, hardware-backed key custody, and distributed rate limiting are not implemented. These controls are test evidence, not a compliance certification.

## Speech is never authority

The native TTS surface plans prosody and delivers sentence-level text events; it does not synthesize provider audio, authorize actions, or execute anything. Barge-in marks are scoped to an actor, single-use, and expire. The chat UI treats every spoken fragment as untrusted text.

## Security boundaries (conceptual)

- An identifier in a request is not authentication.
- A capability descriptor is not authority.
- A successful HTTP response is not evidence of factual correctness.
- A hash is not proof that a source is authentic or truthful.
- A framework list is not a compliance assessment.
- A local test is not proof of production deployment.
- A simulated or fixture response must never claim cryptographic verification, external synchronization, or compliance.

## Release gates

Before production deployment, require:
1. Typecheck, tests and production build pass on the exact release SHA.
2. Negative authentication and authorization tests pass.
3. Secret-bearing input is withheld from API outputs and logs.
4. Persistent audit storage, retention, backup and tamper-evidence are tested.
5. RLS/tenant isolation is verified against the deployed database, not inferred from configuration.
6. External model routes have quotas and edge-level rate limiting.
7. Dependency and secret scanning pass.
8. Threat model and abuse-case tests pass.
9. Backup/restore drill and rollback test are documented and executed.
10. Legal, privacy, licensing and jurisdictional review is completed for the actual deployment.

## Scope

This policy is engineering guidance and is not a guarantee that the project has undergone an external security audit or penetration test.
