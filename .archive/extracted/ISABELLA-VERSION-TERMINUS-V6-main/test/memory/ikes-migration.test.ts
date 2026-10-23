import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migration = readFileSync(resolve(root, "supabase/migrations/20261017000001_ikes-memory.sql"), "utf8");

describe("IKES migration concurrency contract", () => {
  it("prevents an existing source ID from being rebound to different content", () => {
    expect(migration).toMatch(/atlas_knowledge_guard_source_identity/);
    expect(migration).toMatch(/new\.content_hash <> old\.content_hash/);
    expect(migration).toMatch(/new\.uri <> old\.uri/);
    expect(migration).toMatch(/IKES_SOURCE_IDENTITY_IMMUTABLE/);
  });

  it("rejects stale or conflicting claim versions but allows idempotent retries", () => {
    expect(migration).toMatch(/atlas_knowledge_guard_claim_version/);
    expect(migration).toMatch(/new\.version = old\.version and new\.content_hash = old\.content_hash/);
    expect(migration).toMatch(/new\.version <> old\.version \+ 1/);
    expect(migration).toMatch(/IKES_CLAIM_VERSION_CONFLICT/);
    expect(migration).toMatch(/IKES_CLAIM_SAME_VERSION_MUTATION/);
    expect(migration).toMatch(/before update on public\.atlas_knowledge_claims/);
  });

  it("retains server-only access and row-level security", () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on table[\s\S]*from anon, authenticated/i);
    expect(migration).toMatch(/to service_role/i);
  });
});
