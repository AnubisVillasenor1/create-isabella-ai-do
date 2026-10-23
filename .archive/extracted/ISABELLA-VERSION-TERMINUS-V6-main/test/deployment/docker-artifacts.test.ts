import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(fileURLToPath(new URL("../../Dockerfile", import.meta.url)), "utf8");
const compose = readFileSync(fileURLToPath(new URL("../../docker-compose.yml", import.meta.url)), "utf8");

describe("container build artifact", () => {
  it("builds and runs the bundled ESM entrypoint without tsx", () => {
    expect(dockerfile).toContain("pnpm run build:dist");
    expect(dockerfile).toContain('CMD ["dist/server.js"]');
    expect(dockerfile).not.toMatch(/\btsx\b/);
  });

  it("installs only production dependencies in the runtime image", () => {
    expect(dockerfile).toContain("pnpm install --frozen-lockfile --prod");
  });

  it("never references the workspace file absent from the repository", () => {
    expect(dockerfile).not.toContain("pnpm-workspace.yaml");
  });

  it("runs as a non-root numeric user and ships runtime assets", () => {
    expect(dockerfile).toContain("USER 10001");
    expect(dockerfile).toContain("src/ui");
    expect(dockerfile).toContain("src/styles");
  });

  it("ships the intro video assets read at runtime (AUD-16)", () => {
    expect(dockerfile).toMatch(/COPY --from=build \/app\/src\/assets \.\/src\/assets/);
  });
});

describe("docker compose stack", () => {
  it("defines the runtime and a Postgres dependency", () => {
    expect(compose).toContain("services:");
    expect(compose).toMatch(/^ {2}app:/m);
    expect(compose).toMatch(/^ {2}postgres:/m);
  });

  it("applies database migrations and persists BookPI evidence", () => {
    expect(compose).toContain("/docker-entrypoint-initdb.d");
    expect(compose).toContain("BOOKPI_LEDGER_PATH");
    expect(compose).toContain("bookpi-data:");
  });

  it("declares healthchecks and a least-privilege runtime", () => {
    expect(compose).toContain("healthcheck:");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain('user: "10001:10001"');
  });
});
