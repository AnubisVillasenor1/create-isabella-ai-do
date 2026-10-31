import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANON_MATURITY_DEFINITIONS,
  OMEGA_ARCHITECTURE,
  OMEGA_CANON,
  OMEGA_FOUNDATION_GENERATIONS,
  OMEGA_IMPLEMENTATIONS,
  OMEGA_INVARIANT,
  OMEGA_MEMORY_TIERS,
  OMEGA_SECURITY_LAYERS,
  buildOmegaCanonPayload,
  type CanonMaturity,
} from "../../src/platform/omega-canon";
import {
  PLATFORM_CONTRACT_VERSION,
  PLATFORM_NAV_GROUPS,
  PLATFORM_PAGES,
  buildPlatformCatalogPayload,
  findPlatformPage,
} from "../../src/platform/catalog";

const MATURITIES: readonly CanonMaturity[] = ["verified", "implemented", "partial", "specified"];
const manifest = (relative: string) => new URL(`../../${relative}`, import.meta.url);

describe("Génesis Ω∞ canonical registry", () => {
  it("declares doctrine without a production claim", () => {
    expect(OMEGA_CANON.generation).toBe("Genesis Ω∞");
    expect(OMEGA_CANON.productionClaim).toBe(false);
    expect(OMEGA_INVARIANT).toBe("SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION");
    expect(Object.keys(CANON_MATURITY_DEFINITIONS)).toEqual([...MATURITIES]);
  });

  it("reports counts that match the registry arrays", () => {
    const payload = buildOmegaCanonPayload();
    expect(payload.contract).toBe("omega-canon/1.0.0");
    expect(payload.counts).toEqual({
      pillars: 7,
      architectureLayers: 14,
      implementations: 26,
      memoryTiers: 4,
      crownLevels: 7,
      agents: 12,
      federations: 9,
      securityLayers: 7,
      foundationGenerations: 3,
    });
    expect(payload.maturity).toEqual({ verified: 5, implemented: 6, partial: 12, specified: 3 });
    const sum = MATURITIES.reduce((total, maturity) => total + payload.maturity[maturity], 0);
    expect(sum).toBe(payload.counts.implementations);
  });

  it("keeps identifiers unique and ΩX ordering contiguous", () => {
    expect(new Set(OMEGA_IMPLEMENTATIONS.map((entry) => entry.id)).size).toBe(OMEGA_IMPLEMENTATIONS.length);
    expect(OMEGA_IMPLEMENTATIONS.map((entry) => entry.order)).toEqual(
      Array.from({ length: OMEGA_IMPLEMENTATIONS.length }, (_, index) => index + 1),
    );
    for (const collection of [OMEGA_ARCHITECTURE, OMEGA_MEMORY_TIERS, OMEGA_SECURITY_LAYERS]) {
      expect(new Set(collection.map((entry) => entry.id)).size).toBe(collection.length);
    }
    for (const entry of [...OMEGA_ARCHITECTURE, ...OMEGA_IMPLEMENTATIONS, ...OMEGA_MEMORY_TIERS, ...OMEGA_SECURITY_LAYERS]) {
      expect(MATURITIES).toContain(entry.maturity);
    }
  });

  it("backs every non-specified entry with existing evidence and marks specified gaps honestly", () => {
    const entries = [
      ...OMEGA_ARCHITECTURE,
      ...OMEGA_IMPLEMENTATIONS,
      ...OMEGA_MEMORY_TIERS,
      ...OMEGA_SECURITY_LAYERS,
    ];
    for (const entry of entries) {
      if (entry.maturity === "specified") {
        expect(entry.evidence).toHaveLength(0);
        continue;
      }
      expect(entry.evidence.length).toBeGreaterThan(0);
      for (const relative of entry.evidence) {
        expect(existsSync(manifest(relative)), `missing evidence: ${relative}`).toBe(true);
      }
      if (entry.maturity === "verified") {
        expect(entry.evidence.some((relative) => relative.startsWith("test/"))).toBe(true);
      }
    }
    for (const generation of OMEGA_FOUNDATION_GENERATIONS) {
      expect(generation.maturity).toBe("specified");
    }
  });

  it("publishes the canon through the platform catalog and its trust navigation", () => {
    const page = findPlatformPage("canon");
    expect(page).toBeDefined();
    expect(page?.path).toBe("/platform/canon");
    expect(page?.group).toBe("trust");
    expect(page?.dynamic).toBe("canon");

    const trust = PLATFORM_NAV_GROUPS.find((group) => group.id === "trust");
    expect(trust?.pages).toContain("canon");
    for (const group of PLATFORM_NAV_GROUPS) {
      for (const id of group.pages) expect(findPlatformPage(id)).toBeDefined();
    }
    expect(new Set(PLATFORM_PAGES.map((entry) => entry.path)).size).toBe(PLATFORM_PAGES.length);

    const payload = buildPlatformCatalogPayload(new Date("2026-10-25T00:00:00.000Z"));
    expect(PLATFORM_CONTRACT_VERSION).toBe("1.1.0");
    expect(payload.contract).toBe(PLATFORM_CONTRACT_VERSION);
    expect(payload.counts).toEqual({ pages: 17, groups: 5, chatSurfaces: 1 });
    expect(payload.pages.some((entry) => entry.path === "/platform/canon")).toBe(true);
    expect(payload.canon.counts.implementations).toBe(26);
    expect(payload.canon.canonical.productionClaim).toBe(false);
    expect(payload.disclaimers.some((line) => line.includes("canon Génesis Ω∞"))).toBe(true);
  });
});
