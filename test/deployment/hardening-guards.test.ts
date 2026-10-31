import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(p, "utf8");
const run = (script: string, ...args: string[]): string =>
  execFileSync(process.execPath, [script, ...args], { encoding: "utf8" });

describe("operational hardening guards", () => {
  it("docker-compose carries no inline credentials and no obsolete `version` key", () => {
    const compose = read("docker-compose.yml");
    expect(compose).not.toMatch(/^version:/m);
    expect(compose).not.toMatch(/postgresql:\/\/[^\s:]+:(?!\$\{)[^\s@$<]+@/);
    expect(compose).toContain("DATABASE_URL: ${DATABASE_URL:?");
  });

  it("every internet-facing or log-reading service drops capabilities or limits memory", () => {
    const compose = read("docker-compose.yml");
    for (const svc of ["caddy", "otel", "victoriametrics", "app"]) {
      const block = compose.split(new RegExp(`^  ${svc}:`, "m"))[1]?.split(/^  [a-z_-]+:\s*$/m)[0] ?? "";
      expect(block, svc).toMatch(/no-new-privileges:true/);
      expect(block, svc).toMatch(/cap_drop:\s*\n\s*- ALL/);
      expect(block, svc).toMatch(/memory:/);
    }
  });

  it(".env.example has no duplicated keys, real-looking secrets or undocumented variables", () => {
    expect(run("scripts/check-env-example.mjs")).toMatch(/ENV_EXAMPLE_OK/);
  });

  it("SOPS placeholders never coexist with a tracked encrypted file", () => {
    expect(run("scripts/check-sops-placeholders.mjs")).toMatch(/SOPS_PLACEHOLDERS_OK/);
  });

  it("docs/STATUS.md is regenerated from the repository (cannot drift from config)", () => {
    expect(run("scripts/generate-status.mjs", "--check")).toMatch(/STATUS_OK/);
  });

  it("every area excluded from the main typecheck is covered by tsconfig.layers.json or is a known standalone runtime", () => {
    const ts = JSON.parse(read("tsconfig.json")) as { exclude: string[] };
    const layers = JSON.parse(read("tsconfig.layers.json")) as { include: string[] };
    const standalone = new Set(["src/lib", "src/authz-runtime", "src/hypercore-runtime", "src/components", "src/hooks", "src/core"]);
    const uncovered = ts.exclude.filter((e) => e.startsWith("src/") && !standalone.has(e) && !layers.include.includes(e));
    expect(uncovered).toEqual([]);
  });
});

describe("database migrations are deployable", () => {
  const migDir = "infra/db/migrations";
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

  it("the table the runtime reads/writes (commerce_subscriptions) is created by a versioned migration", () => {
    const all = files.map((f) => read(`${migDir}/${f}`)).join("\n");
    expect(all).toMatch(/CREATE TABLE IF NOT EXISTS commerce_subscriptions/);
  });

  it("the in-source commerce migration cannot drift from the deployed copy", () => {
    expect(read(`${migDir}/005_commerce_persistent_subscriptions.sql`)).toBe(read("src/commerce/migrations/002_persistent_subscriptions.sql"));
  });

  it("migration versions are unique and contiguous", () => {
    const versions = files.map((f) => Number(f.split("_")[0]));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
  });

  it("docker-compose applies schema.sql and every versioned migration on first boot", () => {
    const compose = read("docker-compose.yml");
    for (const f of files) expect(compose, f).toContain(`${migDir}/${f}:/docker-entrypoint-initdb.d/10-${f}`);
  });

  it("scripts/migrate.sh points at a directory that exists", () => {
    const sh = read("scripts/migrate.sh");
    expect(sh).toContain("infra/db/migrations");
    expect(sh).not.toMatch(/MIGRATIONS_DIR="\$\{PROJECT_DIR\}\/migrations"/);
  });
});
