# Security model

Every route except `/health` and `/ready` requires a bearer token. Configure `IGE_API_TOKENS` as semicolon-separated entries in this exact form: `token|tenant_uuid|user_uuid;token2|tenant_uuid|user_uuid`. Each token must contain exactly 64 hexadecimal characters; duplicate tokens, malformed UUIDs and malformed entries prevent startup. Generate unique secrets with `openssl rand -hex 32`. Do not commit real tokens.

The gateway derives tenant/user identity from the matching token and ignores caller-supplied identity fields (the request DTOs no longer contain them). Memory reads are restricted to the authenticated tenant and user, except records explicitly stored with TENANT scope, which are shared only within that tenant. The API body limit is 64 KiB; inference, content, provenance, importance and expiry inputs are validated.

The bearer-token registry is a small deployment MVP, not OIDC. Use TLS, secret rotation, rate limiting, per-token revocation, managed secrets, backups, image scanning and independent audit anchoring before production. No endpoint executes external actions.

BookPI-X rejects application-level UPDATE/DELETE through a PostgreSQL trigger and verifies the hash chain. A database owner can still disable the trigger or rewrite the table; this is not WORM storage, a digital signature, or non-repudiation. Export and anchor signed chain heads outside the database for stronger tamper evidence.


World Model writes are tenant-checked in Rust and again by PostgreSQL triggers. Each graph mutation and its BookPI-X event share one transaction; audit append failure rolls back the mutation. Read endpoints are tenant-filtered and never accept tenant IDs from request parameters.

Memory erasure is a hard delete scoped to the authenticated tenant and user. Its BookPI-X event stores only the record ID and principal identifiers, not the erased content; the delete and audit event commit atomically. This is deliberate data erasure, not a reversible soft-delete. Tenant-shared records may be read within their tenant, but only their recorded owner can erase them through this endpoint.


The gateway enforces an in-memory fixed-window limit per authenticated tenant/user principal (`IGE_RATE_LIMIT_PER_MINUTE`, default 120). The principal registry is capped at 1,000 entries, so limiter state remains bounded. Limits reset on process restart and are not distributed across replicas; production should use a shared gateway/WAF or distributed rate limiter.


Session-scoped memory requires an explicit `session_id` on creation and retrieval. A request cannot create a SESSION record without a session ID or attach a session ID to TENANT/USER scope. Session IDs do not replace the authenticated principal; reads still filter by the token-bound tenant and user.
