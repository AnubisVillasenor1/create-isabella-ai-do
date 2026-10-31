import { describe, expect, it } from "vitest";
import { runDeployReadiness } from "../../src/health/deploy-readiness";

const strong = (seed: string): string => Array.from({ length: 48 }, (_, i) => "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(i * 7 + seed.charCodeAt(i % seed.length)) % 62]).join("");

const good = {
  GENESIS_ADMIN_API_TOKEN: strong("admin"),
  OPS_API_TOKEN: strong("ops!!"),
  APP_PUBLIC_URL: "https://isabella.example.org",
  BOOKPI_INTEGRITY_SECRET: strong("bookpi"),
  DATABASE_URL: "postgresql://u:p@db.example.org:5432/isabella?sslmode=require",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: strong("sb"),
  SUPABASE_ANON_KEY: "eyJhbGciOi-example-anon-key",
  GROQ_API_KEY: "gsk_example",
  ALLOWED_ORIGINS: "https://isabella.example.org",
  BOOKPI_LEDGER_PATH: "/app/data/ledger.jsonl",
} as const;

describe("deploy readiness", () => {
  it("is READY for a complete production configuration", () => {
    const r = runDeployReadiness(good);
    expect(r.findings.filter((f) => f.severity === "ERROR")).toEqual([]);
    expect(r.status).toBe("READY");
  });

  it("blocks without the integrity secret or a database", () => {
    const { BOOKPI_INTEGRITY_SECRET: _s, DATABASE_URL: _d, ...rest } = good;
    const r = runDeployReadiness(rest);
    expect(r.status).toBe("BLOCKED");
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-BOOKPI-SECRET-MISSING");
    expect(ids).toContain("DR-DATABASE-MISSING");
  });

  it("rejects a weak integrity secret and a non-postgres URL", () => {
    const r = runDeployReadiness({ ...good, BOOKPI_INTEGRITY_SECRET: "changeme", DATABASE_URL: "mysql://x" });
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-BOOKPI-SECRET-WEAK");
    expect(ids).toContain("DR-DATABASE-INVALID");
  });

  it("requires Supabase URL and key together; warns when absent", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _k, ...half } = good;
    expect(runDeployReadiness(half).findings.map((f) => f.id)).toContain("DR-SUPABASE-PARTIAL");
    const { SUPABASE_URL: _u, SUPABASE_SERVICE_ROLE_KEY: _k2, ...none } = good;
    const r = runDeployReadiness(none);
    expect(r.findings.map((f) => f.id)).toContain("DR-SUPABASE-ABSENT");
    expect(r.status).toBe("READY_WITH_WARNINGS");
  });

  it("blocks when Supabase is configured but its user-authentication key is absent", () => {
    const { SUPABASE_ANON_KEY: _anon, ...rest } = good;
    const ids = runDeployReadiness(rest).findings.map((f) => f.id);
    expect(ids).toContain("DR-SUPABASE-AUTH-KEY-MISSING");
  });

  it("warns about a missing inference provider and localhost origins", () => {
    const { GROQ_API_KEY: _g, ...rest } = good;
    const ids = runDeployReadiness({ ...rest, ALLOWED_ORIGINS: "http://localhost:3000" }).findings.map((f) => f.id);
    expect(ids).toContain("DR-NO-INFERENCE-PROVIDER");
    expect(ids).toContain("DR-ORIGINS-LOCAL");
  });

  it("blocks Vercel production when API-key or federation state is ephemeral", () => {
    const r = runDeployReadiness({
      ...good,
      VERCEL: "1",
      ISABELLA_API_KEY_STORE: "memory",
      ISABELLA_FEDERATION_STORE: "memory",
    });
    expect(r.status).toBe("BLOCKED");
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-SERVERLESS-NON_DURABLE_API_KEYS");
    expect(ids).toContain("DR-SERVERLESS-NON_DURABLE_FEDERATION");
  });

  it("blocks the file backend on Vercel as well", () => {
    const r = runDeployReadiness({
      ...good,
      VERCEL: "1",
      ISABELLA_API_KEY_STORE: "file",
      ISABELLA_FEDERATION_STORE: "file",
    });
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-SERVERLESS-NON_DURABLE_API_KEYS");
    expect(ids).toContain("DR-SERVERLESS-NON_DURABLE_FEDERATION");
    expect(r.status).toBe("BLOCKED");
  });

  it("accepts a Postgres store pair as durable on serverless", () => {
    const r = runDeployReadiness({
      ...good,
      VERCEL: "1",
      ISABELLA_API_KEY_STORE: "postgres",
      ISABELLA_FEDERATION_STORE: "postgres",
    });
    const ids = r.findings.map((f) => f.id);
    expect(ids).not.toContain("DR-SERVERLESS-NON_DURABLE_API_KEYS");
    expect(ids).not.toContain("DR-SERVERLESS-NON_DURABLE_FEDERATION");
    expect(r.status).toBe("READY");
  });

  it("accepts the neon alias in any case", () => {
    const r = runDeployReadiness({
      ...good,
      VERCEL: "1",
      ISABELLA_API_KEY_STORE: "neon",
      ISABELLA_FEDERATION_STORE: "NEON",
    });
    expect(r.status).toBe("READY");
  });

  it("blocks a Postgres store mode that has no usable database URL", () => {
    const { DATABASE_URL: _d, ...rest } = good;
    const r = runDeployReadiness({
      ...rest,
      VERCEL: "1",
      ISABELLA_API_KEY_STORE: "postgres",
      ISABELLA_FEDERATION_STORE: "postgres",
    });
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-SERVERLESS-API_KEYS_DB_MISSING");
    expect(ids).toContain("DR-SERVERLESS-FEDERATION_DB_MISSING");
    expect(r.status).toBe("BLOCKED");
  });

  it("blocks a Postgres store mode whose URL is not a postgres connection string", () => {
    const r = runDeployReadiness({
      ...good,
      VERCEL: "1",
      DATABASE_URL: "mysql://u:p@db.example.org:3306/isabella",
      ISABELLA_API_KEY_STORE: "postgres",
      ISABELLA_FEDERATION_STORE: "neon",
    });
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-DATABASE-INVALID");
    expect(ids).toContain("DR-SERVERLESS-API_KEYS_DB_MISSING");
    expect(ids).toContain("DR-SERVERLESS-FEDERATION_DB_MISSING");
  });

  it("blocks an unknown store mode without echoing its value", () => {
    const r = runDeployReadiness({
      ...good,
      VERCEL: "1",
      ISABELLA_API_KEY_STORE: "shared",
      ISABELLA_FEDERATION_STORE: "redis",
    });
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("DR-SERVERLESS-API_KEYS_MODE_UNKNOWN");
    expect(ids).toContain("DR-SERVERLESS-FEDERATION_MODE_UNKNOWN");
    expect(JSON.stringify(r)).not.toContain("redis");
    expect(JSON.stringify(r)).not.toContain("shared");
  });

  it("never leaks secret values in findings", () => {
    const r = runDeployReadiness({ ...good, BOOKPI_INTEGRITY_SECRET: "changeme" });
    expect(JSON.stringify(r)).not.toContain("changeme");
  });
});
