import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const server = readFileSync(resolve(root, "src/server.ts"), "utf8");
const graphStart = server.indexOf('app.get("/api/v1/integrations/graph"');
const graphEnd = server.indexOf("// Bounded latency diagnostics", graphStart);
const graph = server.slice(graphStart, graphEnd);

describe("runtime integration graph contract", () => {
  it("requires an admin token and disables caching", () => {
    expect(graph).toMatch(/authorizeApiToken\(req, res, "GENESIS_ADMIN_API_TOKEN"\)/);
    expect(graph).toMatch(/Cache-Control", "no-store"/);
  });

  it("reports actual persistence dependencies separately", () => {
    for (const id of ["ikes-memory", "atlas-store", "bookpi-pipeline", "bookpi-legacy", "observability"]) {
      expect(graph).toContain(`id: "${id}"`);
    }
    expect(graph).toMatch(/readinessEvidence/);
    expect(graph).toMatch(/disclaimer: "WIRED describes a code path/);
  });

  it("includes the existing registered route surfaces", () => {
    for (const id of [
      "yun-events", "hypercore-api", "openai-compatible-api", "ihec",
      "osiris-sentinel", "session-memory", "verified-knowledge",
      "commerce-economy", "civilization", "hf-hub", "omega-api",
    ]) expect(graph).toContain(`id: "${id}"`);
  });

  it("uses dependency evidence in edges without leaking out-of-scope state", () => {
    expect(graph).toMatch(/to: "bookpi-legacy", state: legacyBookpiEvidence\?\.status\?\.toUpperCase\(\)/);
    expect(graph).not.toContain("legacyLedgerStatus.toUpperCase()");
    expect(graph).toMatch(/id: "bookpi-legacy", state: legacyBookpiEvidence\?\.status/);
  });

  it("uses the live health/readiness probe and does not overclaim inference wiring", () => {
    expect(graph).toMatch(/const igeOmegaProbe = await probeIgeOmegaGateway\(process\.env\)/);
    expect(graph).toMatch(/id: "ige-omega-rust", state: igeOmegaProbe\.status/);
    expect(graph).toMatch(/to: "ige-omega-rust", state: igeOmegaProbe\.status/);
    expect(graph).toMatch(/authenticated inference bridging remains unverified/);
  });
});
