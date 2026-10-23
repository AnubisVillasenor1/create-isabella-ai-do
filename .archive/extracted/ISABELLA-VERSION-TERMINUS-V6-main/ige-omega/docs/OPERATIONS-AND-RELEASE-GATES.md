# IGE-Ω operational release gates

This runbook distinguishes implementation from verified deployment. A successful GitHub API response or a created commit is not a compilation or runtime test.

## Required checks for every candidate SHA

Run from the repository root with a supported stable Rust toolchain:

```sh
cd ige-omega
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --release -p gateway
```

For PostgreSQL integration coverage, use a disposable PostgreSQL 16 database and set `IGE_TEST_DATABASE_URL`. The CI workflow uses `cargo test --workspace -- --include-ignored` so ignored integration tests are not silently skipped. Never point these tests at production data.

## Configuration checks

- Generate a unique principal token using `openssl rand -hex 32`.
- Configure `IGE_API_TOKENS=token|tenant_uuid|user_uuid`; do not put real tokens in source control, issue comments, logs, or artifacts.
- Confirm `DATABASE_URL` targets the intended database and the database role has only the privileges required by migrations and runtime.
- Confirm `IGE_RATE_LIMIT_PER_MINUTE` is between 1 and 10000. The current limiter is process-local; it does not provide a shared quota across replicas.
- Confirm `/health` is used only for process liveness and `/ready` for database reachability. Neither endpoint proves all application dependencies are healthy.

## Migration review

Migrations run on gateway startup. Apply them first against a disposable copy of representative data. Migration 0009 creates memory validation constraints as `NOT VALID`: new writes are constrained immediately, while pre-existing rows are not certified until each constraint is validated. Before validating, query for blank/oversized content or provenance, out-of-range importance, and non-array/oversized embeddings; repair or quarantine incompatible records.

Before validating migration 0009 constraints, run this audit query against the target database:

```sql
SELECT
  count(*) FILTER (WHERE char_length(btrim(content)) NOT BETWEEN 1 AND 20000) AS invalid_content,
  count(*) FILTER (WHERE char_length(btrim(provenance)) NOT BETWEEN 1 AND 2000) AS invalid_provenance,
  count(*) FILTER (WHERE NOT (importance >= 0 AND importance <= 1)) AS invalid_importance,
  count(*) FILTER (
    WHERE embedding IS NOT NULL
      AND CASE
        WHEN jsonb_typeof(embedding) = 'array'
          THEN jsonb_array_length(embedding) > 16384
        ELSE TRUE
      END
  ) AS invalid_embedding
FROM memory_records;
```

If any count is nonzero, inspect and repair/quarantine those records before running `ALTER TABLE memory_records VALIDATE CONSTRAINT ...` for each of the four migration 0009 constraints. Treat this as a data migration with a backup and a rollback/recovery plan, not as an automatic cleanup.

Migration 0010 adds `NOT VALID` constraints for World Model entity names/types/provenance, relation labels and causal evidence array shape/size. Audit legacy rows before validation:

```sql
SELECT
  (SELECT count(*) FROM world_entities
   WHERE char_length(btrim(name)) NOT BETWEEN 1 AND 500
      OR char_length(btrim(entity_type)) NOT BETWEEN 1 AND 100
      OR char_length(btrim(provenance)) NOT BETWEEN 1 AND 2000) AS invalid_entities,
  (SELECT count(*) FROM world_relations
   WHERE char_length(btrim(relation)) NOT BETWEEN 1 AND 200) AS invalid_relations,
  (SELECT count(*) FROM causal_edges
   WHERE CASE
     WHEN jsonb_typeof(evidence) = 'array'
       THEN jsonb_array_length(evidence) > 64
     ELSE TRUE
   END) AS invalid_causal_evidence;
```

Inspect and repair/quarantine incompatible records before validating each constraint from migration 0010. Do not silently delete historical graph data.

## Release decision

Do not promote while any of the following is true:

1. The exact candidate SHA has not completed formatting, Clippy, unit/contract tests, PostgreSQL integration tests, and a release build on a functioning runner.
2. Migration application and rollback/recovery procedures have not been exercised against a disposable database snapshot.
3. Cross-tenant and cross-user access tests have not been run.
4. Container image build, non-root execution, graceful SIGTERM shutdown, readiness behavior, and Kubernetes rollout have not been verified.
5. Operators cannot rotate/revoke principal tokens. The current environment registry has no dynamic revocation endpoint.
6. Audit requirements demand immutable external/WORM retention or cryptographic signatures. The current SHA-256 chain is tamper-evident within the database trust boundary, not independent proof against a database owner or superuser.

## Incident response minimum

If a token is exposed, replace the registry entry and restart/roll out every gateway instance; there is no dynamic revocation in this MVP. Preserve application and database logs, record the affected principal and time window, run the BookPI-X verifier, and compare the chain head with any independently preserved checkpoint. A valid chain alone does not prove that no event was omitted before a trusted checkpoint was created.
