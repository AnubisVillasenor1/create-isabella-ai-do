import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const server = readFileSync(resolve(root, "src/server.ts"), "utf8");
const graphStart = server.search(/app\.get\(\s*["']\/api\/v1\/integrations\/graph["']/);
const graphEnd = server.indexOf("// Bounded latency diagnostics", graphStart);
const graph = server.slice(graphStart, graphEnd);

function nodeId(id: string): RegExp {
  return new RegExp(`id:\\s*["']${id}["']`);
}

describe("runtime integration graph contract", () => {
  it("requires an admin token and disables caching", () => {
    expect(graphStart).toBeGreaterThanOrEqual(0);
    expect(graphEnd).toBeGreaterThan(graphStart);
    expect(graph).toMatch(/authorizeApiToken\(req, res, ["']GENESIS_ADMIN_API_TOKEN["']\)/);
    expect(graph).toMatch(/Cache-Control["'],\s*["']no-store["']/);
  });

  it("reports actual persistence dependencies separately", () => {
    for (const id of ["ikes-memory", "atlas-store", "bookpi-pipeline", "bookpi-legacy", "observability"]) {
      expect(graph).toMatch(nodeId(id));
    }
    expect(graph).toMatch(/readinessEvidence/);
    expect(graph).toMatch(/disclaimer:\s*["']WIRED describes a code path/);
  });

  it("includes the existing registered route surfaces", () => {
    for (const id of [
      "yun-events", "hypercore-api", "openai-compatible-api", "ihec",
      "osiris-sentinel", "session-memory", "verified-knowledge",
      "commerce-economy", "civilization", "hf-hub", "omega-api",
    ]) expect(graph).toMatch(nodeId(id));
  });

  it("uses dependency evidence in edges without leaking out-of-scope state", () => {
    expect(graph).toMatch(
      /to:\s*["']bookpi-legacy["'],\s*state:\s*legacyBookpiEvidence\?\.status\?\.toUpperCase\(\)/,
    );
    expect(graph).not.toContain("legacyLedgerStatus.toUpperCase()");
    expect(graph).toMatch(
      /id:\s*["']bookpi-legacy["'],\s*state:\s*legacyBookpiEvidence\?\.status/,
    );
  });

  it("uses the live health/readiness probe and does not overclaim inference wiring", () => {
    expect(graph).toMatch(/const igeOmegaProbe = await probeIgeOmegaGateway\(process\.env\)/);
    expect(graph).toMatch(/id:\s*["']ige-omega-rust["'],\s*state:\s*igeOmegaProbe\.status/);
    expect(graph).toMatch(/to:\s*["']ige-omega-rust["'],\s*state:\s*igeOmegaProbe\.status/);
    expect(graph).toMatch(/authenticated inference bridging remains unverified/);
  });
});
