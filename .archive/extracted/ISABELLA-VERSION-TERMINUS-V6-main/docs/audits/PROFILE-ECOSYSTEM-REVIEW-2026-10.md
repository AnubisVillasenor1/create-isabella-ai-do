# Isabella / TAMV GitHub portfolio review

**Review date:** 2026-10-11  
**Scope:** repository inventory visible to the connected GitHub integration, targeted review of the Isabella-related repositories, and implementation work on `isabella-V6-TINA-h6`.  
**Evidence rule:** this is a repository-level engineering review, not a claim that every file in every repository has been exhaustively reviewed or that any system is production-certified.

## Executive assessment

The portfolio contains multiple generations and surfaces of Isabella: a public TINA runtime, a separate detailed `isabella-ai-tina` repository, `isabella-s-crown`, `isabella-s-genesis-ai`, `isabella-villasenor-ai`, `isabella-s-core-intelligence`, `isabella-sovereign-ai`, and TAMV-facing documentation and prototypes. This creates useful research breadth, but the canonical implementation boundary is not consistently obvious from repository documentation.

The target `isabella-V6-TINA-h6` is a private repository whose README largely mirrors the public `Isabella-V6-TINA` runtime documentation. Some badges and links still point at the public repository. The target has a distinct name but no visible evidence in its README of a documented fork/derivation policy, source-of-truth declaration, or synchronization contract.

## Cross-repository findings

| Repository | Evidence reviewed | Finding | Recommended disposition |
|---|---|---|---|
| `Isabella-V6-TINA` | README and project identity | Most complete reviewed runtime narrative: explicit maturity limits, security, readiness, latency, IGE and release gates. It also references PRs #18/#19 in that repository. | Treat as an upstream reference only if that is the intended source of truth; do not assume PRs or branch state transfer to h6. |
| `isabella-V6-TINA-h6` | README, package manifest, CI, assurance scripts, ops module and tests | Private derivative with TypeScript runtime and IGE-Ω documentation. CI requires pnpm frozen installation; the branch contains `pnpm-lock.yaml` and now pins the package manager version. | Keep isolated on a review branch, repair dependency reproducibility before release, and define whether h6 is upstream, downstream, or a release candidate. |
| `isabella-ai-tina` | README and version/status section | Detailed architecture and governance document; identifies package version 4.3.3 and describes a local TESTED status dated 2026-10-08. The document itself cautions that local tests do not imply production certification. | Reconcile its contracts, release status and capabilities with the selected canonical runtime using code-level diffs, not README similarity alone. |
| `isabella-s-crown` | README | README is primarily a research prompt and Lovable starter instructions, rather than a reproducible module contract or release record. | Extract actual CROWN implementation only after inspecting source, dependencies, tests and license; do not treat its README as proof of a production-ready subsystem. |
| `genesis-digytamv-nexus` | README | README remains generic Lovable project scaffolding and does not establish a technical integration contract with the TINA runtime. | Classify as a prototype/UI surface unless source and tests prove a deeper role. |
| `DOCUMENTACION-TAMV-DM-X4-e-ISABELLA-AI` | Profile inventory and repository identity | Large documentation repository that appears central to the TAMV/Isabella architecture narrative. Its claims must be mapped to implementation evidence. | Use it as a specification source only after mapping each claim to a code path, test and deployment artifact. |
| `isabella-s-genesis-ai`, `isabella-s-core-intelligence`, `isabella-villasenor-ai`, `isabella-sovereign-ai`, `isabella-mexa` | Repository inventory/search results | Multiple related implementation surfaces exist; names alone do not establish code overlap, maturity or compatibility. | Perform a license-aware source/API/dependency comparison before copying or merging code. |

## Target repository: confirmed engineering gaps

1. **Dependency reproducibility — toolchain pin applied.** `pnpm-lock.yaml` uses lockfile format 9; `package.json` now declares `packageManager: pnpm@10.28.0` and Node `24.x`, and CI uses pnpm `10.28.0`. Vercel confirmed the lockfile was current during install. The latest source changes still require their own completed build.
2. **Rust workspace verification — release blocker.** The `ige-omega/` workspace manifest exists and declares eight crates, but `ige-omega/Cargo.lock` was not found. Rust formatting, clippy, tests, PostgreSQL integration tests and release build must run in CI against the exact release SHA.
3. **Repository identity drift.** README badges and upstream PR references point to `OsoPanda1/Isabella-V6-TINA`, not the h6 repository. That can mislead maintainers about which repository's checks and pull requests apply.
4. **Runtime input validation.** The production-ops module accepted non-finite rate-limiter values and did not prevent time rollback from moving the refill watermark backward. Circuit-breaker half-open state did not serialize the recovery probe. Invalid maintenance-window timestamps were silently treated as inactive.
5. **Evidence semantics.** The assurance scripts are structural checks. Their PASS result does not prove runtime security, provider connectivity, PostgreSQL persistence, PQC operation, model training, production health or certification. Keep this distinction explicit.
6. **ML scope.** Genesis routing consumes externally supplied scores and ranks them deterministically. That is not evidence of learned weights, local model training, native GPU serving or a proprietary foundation model.
7. **Canonical ownership and license provenance.** Related repositories should not be merged solely because they share a brand. Compare licenses, code origins, public APIs, schemas, tests and secret-handling boundaries before reusing code.

## Implemented in this review branch

- Validated token-bucket capacity, refill rate, costs and timestamps as finite and within explicit bounds.
- Prevented clock regressions from rewinding the token-bucket refill watermark.
- Validated circuit-breaker thresholds, recovery duration and timestamps.
- Serialized the half-open circuit-breaker probe so only one request tests recovery at a time.
- Rejected invalid timeout values.
- Made malformed or inverted maintenance windows fail explicitly rather than silently appearing inactive.
- Added regression tests for each of these boundary conditions.

These changes are committed to `evolution/runtime-hardening-2026-10`. They are not considered verified until CI reports a successful run on the resulting commit.

## Required next gates

1. Keep the committed pnpm lockfile, `packageManager` pin, and frozen CI installation synchronized.
2. Generate and commit `ige-omega/Cargo.lock`; run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and release build.
3. Run TypeScript typecheck, full Vitest suite, build, security suite and production-evidence gate on the same SHA.
4. Test PostgreSQL integration and tenant/session isolation with a disposable database; test backup/restore and migrations.
5. Inspect actual callers of CROWN, AEGIS, IKES, VERITAS, BookPI and HSF to prove fail-closed behavior at every privileged boundary.
6. Reconcile the target README and API contracts with the chosen upstream and record the relationship in a versioned architecture decision.
7. Do not merge or deploy while required checks are missing, inconclusive or red.

## Release principle

A repository can contain substantial code and still lack a reproducible release path. Isabella's readiness must be measured from executable behavior, tests, configuration and evidence tied to the exact commit—not from architecture diagrams, repository size, naming, or aspirational documentation.


## Follow-up status refresh — 2026-10-11

- Re-read `pnpm-lock.yaml` from `evolution/runtime-hardening-2026-10`: the file is present and uses lockfile format `9.0`. The earlier statement that the lockfile was absent was incorrect and is superseded by this correction.
- This historical finding was superseded: `package.json` now pins `pnpm@10.28.0` and Node `24.x`.
- `ige-omega/Cargo.lock` is still absent; the new Rust CI job will intentionally fail at its explicit lockfile gate until a genuine lockfile is generated and committed.
- GitHub Actions run records for the previous head report `startup_failure` and expose no jobs/step logs through the connector. Vercel deployment `dpl_Cu3MQGLBPGmcVqX4w4YDSWEMMRhp` identified a concrete TypeScript build failure in `src/atlas/persistence.ts`: the inferred `Response` type did not expose `ok`, `text`, `status`, `statusText` or `json`. Updated `tsconfig.json` to include `DOM` and `DOM.Iterable` alongside `ES2022`, so the standard Fetch API response types are available. This is a targeted corrective change, not yet a verified fix: the new commit must be rebuilt and the deployment logs rechecked. Do not mark the branch green until CI confirms it.

- The active Vercel build log confirmed the lockfile is up to date and the deployed toolchain was pnpm `10.28.0`; `package.json` now pins `packageManager: pnpm@10.28.0` and Node `24.x`, and CI uses the same pnpm version. This removes the previous implicit toolchain selection. New deployments were queued for these commits; their final results were not yet available at the time of this update.


## Conversational interaction hardening — 2026-10-11

- Updated `POST /api/v1/cognition/route` for automatic model selection: Gemini is attempted when `GEMINI_API_KEY` or `MODEL_API_KEY` is configured; otherwise the Open Science gateway is attempted; a deterministic local fallback remains available and is identified separately in `responseEngine`.
- Added bounded public conversation context (maximum eight prior turns; each message capped at 2,000 characters) and only permits `user`/`assistant` roles. Client history is untrusted context and never grants identity, memory access, tool access, or authority.
- Added provider request timeouts using `INFERENCE_TIMEOUT_MS` bounded to 3–30 seconds (default 15 seconds) and rate-limited hosted model requests.
- Updated the UI default to `auto`, sends ephemeral in-page history, and clears that history on refresh. The user can explicitly choose the local sovereign fallback.
- Vercel had completed a build for the earlier conversation commit `fd223b2`; later changes for system-instruction isolation, provider timeouts, and the documentation refresh were still building/queued during this update. Do not claim the latest SHA is deployed or that a live conversation test has passed until its deployment is `READY` and a real request is tested.
- `ige-omega/Cargo.lock` remains absent; the Rust verification gate is intentionally blocked pending a genuine lockfile and full Rust CI.


## Serverless runtime gate — 2026-10-11

- Live HTTP probes against the previously `READY` preview returned `500 FUNCTION_INVOCATION_FAILED` for both `/health` and `/api/v1/isabella/status`; runtime logs were unavailable through the current retention window. A ready build therefore was not equivalent to a working HTTP application.
- Added a default export for the Express app and guarded `app.listen()` so a Vercel serverless cold start does not open a separate listening socket. The first deployment of that change failed TypeScript with `TS2742` because the inferred Express application type was not portable; corrected it with an explicit `Application` annotation.
- The deployment for the type-annotation fix was still building at the time of this audit update. The serverless handler change must be considered unverified until the newest deployment reaches `READY` and `/health` returns HTTP 200. Then test the chat route with a real POST and verify provider response metadata.
- Critical release gates remain: no verified Rust `Cargo.lock`/Rust CI, no successful live chat POST test, and no verified latest-SHA test suite. Keep the PR in draft and do not promote to production.


## ESM module-resolution finding and regression gate — 2026-10-11

- The first startup smoke-test build failed with `ERR_MODULE_NOT_FOUND`: Node ESM could not resolve the extensionless internal import `dist/genesis/runtime` emitted by plain `tsc` into `dist/server.js`. This provides a concrete explanation for the earlier serverless invocation failures; a successful TypeScript compile had not produced a directly executable Node ESM entrypoint.
- Added the already-locked `esbuild@0.28.2` as an explicit development dependency and changed the build to bundle `src/server.ts` into `dist/server.js` (`platform=node`, ESM, external package dependencies). The startup smoke script now imports that production artifact, binds it to an ephemeral local HTTP server, checks `GET /health`, and posts a simple conversation to `/api/v1/cognition/route` in explicit sovereign mode.
- The lockfile now declares the existing locked esbuild version in the root importer; the upcoming frozen install/build must confirm consistency. The deployment containing the bundle and smoke gate was queued at the time of this update; neither smoke success nor runtime recovery is yet confirmed.


## AI provider readiness — 2026-10-11

- The runtime smoke test successfully exercised the bundled Express app locally: `/health` returned 200 and the POST conversation route returned 200 with `responseEngine: sovereign`.
- The optional real-model smoke test then attempted the AI Gateway path. It did not generate an LLM response; AI Gateway returned `GatewayInternalServerError` with the explicit account-level reason that a valid credit card must be on file to service requests and unlock free credits. The route correctly fell back to `sovereign-fallback`, but this is not generative LLM conversation.
- Build policy: basic runtime/chat smoke remains blocking; the provider smoke reports failure non-blockingly for preview unless `ISABELLA_REQUIRE_LLM_SMOKE=true` is set. This allows the interface to deploy without falsely certifying external inference. Before a user-facing LLM trial, the account owner must complete AI Gateway billing setup or configure a valid provider key and run the required-model smoke test.
- The selected `inclusionai/ling-3.1-flash-free` model is currently listed as free through October 13, 2026, after which the free model ID stops serving. Long-term operation needs an approved fallback model and billing policy; do not silently switch to a billable model without authorization.


## Latest preview verification — 2026-10-11 16:36 UTC

- Vercel deployment `dpl_FzeX3saUeqiEubCJ8chv44Nuj9XY` is `READY` on commit `0e8cc5393288603fca903666d0d0f326823b423c`.
- Live `GET /health` returned HTTP 200 (`status: healthy`); live `GET /api/v1/isabella/status` returned HTTP 200; live homepage `/` returned HTTP 200 on the immediately preceding deployment that used the same explicit root `server.js` entrypoint.
- Build smoke test reported `RUNTIME_SMOKE_OK` with HTTP 200 for health and a successful POST to `/api/v1/cognition/route` in sovereign mode. The real AI Gateway smoke did not generate an LLM response because Vercel AI Gateway requires a valid credit card on file to service requests. The app therefore falls back to the local deterministic engine; the preview is reachable, but real model-powered chat is not yet verified or available under the current billing state.
- The LLM smoke is now non-blocking for preview builds, but can be made a hard release gate with `ISABELLA_REQUIRE_LLM_SMOKE=true` after AI Gateway billing or a provider key is configured. This distinction must be preserved in release notes and status claims.


## Conversational fallback and latency protection — 2026-10-11

- Implemented `generateSovereignFallback()` as an explicit local conversational fallback. It recognizes greetings, thanks, identity/capability questions, privacy/history questions and TAMV/RDM/IGE topics; for unsupported general questions it asks for context instead of inventing an answer. It explicitly discloses that it is not an LLM and does not claim access to repositories, web or persistent personal memory.
- Added a regression smoke test for greeting → identity follow-up, including two history turns. Vercel build `dpl_43ncKpvTW17ntBe6NtU662HhBkHH` completed successfully and logged `LOCAL_CONVERSATION_SMOKE_OK` with health/chat/follow-up HTTP 200.
- Added a 60-second default process-local cooldown after AI Gateway failure (configurable with `PROVIDER_FAILURE_COOLDOWN_MS`, bounded 10–300 seconds) to avoid repeatedly waiting for the provider in a warm instance. Serverless cold starts can reset this in-memory cooldown; it is latency protection, not a distributed circuit breaker.
- Latest commit `75f8891295577793ff78d5cc6b4053b8b62dd68e` is still building at the time of this note. The prior commit's smoke confirms the new conversational fallback; the latest cooldown change still requires the latest build to reach READY and its smoke output to be checked.
- External LLM remains blocked by Vercel AI Gateway billing (`GatewayInternalServerError`, card required). To activate genuine generative chat, the account owner must enable Gateway billing or configure a valid `GEMINI_API_KEY` / `MODEL_API_KEY` in the Preview environment. No key was invented, and no paid model was silently selected.
