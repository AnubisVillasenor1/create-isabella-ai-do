# Assurance Control Plane — Isabella Genesis V6

**Status:** additive engineering control; structural audit only.  
**Branch:** `evolution/assurance-control-plane-2026-10`  
**Purpose:** make repository-level regressions visible on every pull request and preserve a machine-readable audit artifact tied to the exact commit.

## Implemented in this change

1. `scripts/repository-assurance.mjs` performs dependency-free, read-only checks for package metadata, required scripts, lockfile ambiguity, pull-request CI coverage, frozen installs, and key security/evidence artifacts.
2. `.github/workflows/repository-assurance.yml` runs the audit on pull requests, pushes to main/evolution branches, and manual dispatch.
3. The workflow publishes JSON and Markdown reports named with the full Git SHA. Warnings remain visible without being misrepresented as blockers.
4. The audit also guards against structural regression of the README's veracity/reproducibility contract, the evidence-backed readiness endpoint, fail-closed dependency checks, and the presence of Genesis/IGE modules plus their tests. It additionally requires bounded route-latency telemetry and percentile benchmark tests, and rejects reintroduction of the audited placeholder IKES source seeds.
4. Structural blockers fail the job. The audit deliberately does not claim that a route is secure, a provider is connected, cryptography is post-quantum, or a deployment is healthy merely because a file exists.

## Reproduction

```bash
node scripts/repository-assurance.mjs
```

Outputs:
- `artifacts/assurance/repository-assurance.json`
- `artifacts/assurance/repository-assurance.md`

The generated directory should be treated as a build artifact, not committed as fresh evidence. CI attaches the reports to the exact workflow run.

## Acceptance and interpretation

- **PASS** means the named structural invariant was observed in the checked-out tree.
- **WARN** means the condition needs attention but is not automatically a release blocker.
- **FAIL** means a structural blocker is missing or invalid and the job exits non-zero.
- A report is not proof of runtime behavior, threat resistance, integration, production readiness, or legal/regulatory compliance.
- Existing typecheck, unit tests, security suite, and production-evidence gates remain authoritative for their own scopes; this audit supplements rather than replaces them.

## Initial findings to resolve

1. **Lockfile blocker:** the repository file API did not find `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` on this branch. The existing CI uses `pnpm install --frozen-lockfile`; that combination is not reproducible and is expected to fail until the intended lockfile is generated and committed. The new gate reports this as a blocker rather than silently weakening installation policy.
2. **Package-manager pin:** `package.json` does not declare `packageManager`, although CI configures pnpm 10. Pin the exact approved pnpm version after generating and validating the lockfile.
3. The GitHub workflow runs associated with this branch SHA reported `failure`; logs were not available through the connected API, so the precise failing step remains unconfirmed. Do not attribute the failure solely to the missing lockfile without retrieving the full job log.

Do not silently modify the lockfile or claim reproducibility without running the actual install and validation suite.
