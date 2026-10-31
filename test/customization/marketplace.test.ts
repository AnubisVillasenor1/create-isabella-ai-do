import { describe, expect, it } from "vitest";
import {
  CUSTOMIZATION_CATALOG,
  CustomizationRegistry,
  MARKETPLACE_METHOD_ID,
  buildMarketplaceCatalog,
  buildMarketplaceSnapshot,
  planMarketplaceEnablement,
  resolveMarketplacePack,
  type CustomizationEntry,
  type MarketplaceInventory,
} from "../../src/customization";

const INVENTORY: MarketplaceInventory = {
  customizations: CUSTOMIZATION_CATALOG.length,
  skills: 0,
  tools: 0,
  protocols: 0,
  modules: 0,
  capabilities: 0,
};

const KIT_ID = "isabella.plugin.antigravity-kit";

function seed(): CustomizationRegistry {
  const registry = new CustomizationRegistry();
  for (const entry of CUSTOMIZATION_CATALOG) registry.register(entry);
  return registry;
}

function kitEntry(): CustomizationEntry {
  const entry = CUSTOMIZATION_CATALOG.find((item) => item.id === KIT_ID);
  if (!entry) throw new Error("kit missing");
  return entry;
}

describe("CUSTOMIZATION_CATALOG", () => {
  it("tiene ids únicos y versiones semánticas", () => {
    const ids = CUSTOMIZATION_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of CUSTOMIZATION_CATALOG) expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("expone entidades inmutables", () => {
    expect(Object.isFrozen(CUSTOMIZATION_CATALOG)).toBe(true);
    for (const entry of CUSTOMIZATION_CATALOG) expect(Object.isFrozen(entry)).toBe(true);
  });

  it("el kit referencia sólo entidades presentes en el catálogo", () => {
    const pack = resolveMarketplacePack(kitEntry(), seed());
    expect(pack.missing).toEqual([]);
    expect(pack.resolution.every((item) => item.present)).toBe(true);
  });
});

describe("buildMarketplaceCatalog", () => {
  it("expone el catálogo con conteos por tipo", () => {
    const catalog = buildMarketplaceCatalog(seed());
    expect(catalog.methodId).toBe(MARKETPLACE_METHOD_ID);
    expect(catalog.entries).toHaveLength(CUSTOMIZATION_CATALOG.length);
    expect(catalog.kindCounts.plugin).toBe(1);
    expect(catalog.kindCounts["mcp-server"]).toBe(1);
  });
});

describe("buildMarketplaceSnapshot", () => {
  it("declara que no autoriza ni ejecuta", () => {
    const snapshot = buildMarketplaceSnapshot(seed(), INVENTORY);
    expect(snapshot.authorizationPerformed).toBe(false);
    expect(snapshot.executionPerformed).toBe(false);
    expect(snapshot.inventory.customizations).toBe(CUSTOMIZATION_CATALOG.length);
    expect(snapshot.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el digest es estable para el mismo inventario", () => {
    expect(buildMarketplaceSnapshot(seed(), INVENTORY).digest).toBe(
      buildMarketplaceSnapshot(seed(), INVENTORY).digest,
    );
  });
});

describe("resolveMarketplacePack", () => {
  it("rechaza entidades que no son plugin", () => {
    const ruleEntry = CUSTOMIZATION_CATALOG.find((entry) => entry.kind === "rule")!;
    expect(() => resolveMarketplacePack(ruleEntry, seed())).toThrow("MARKETPLACE_PACK_NOT_PLUGIN");
  });

  it("detecta entradas ausentes", () => {
    const registry = new CustomizationRegistry();
    const orphan: CustomizationEntry = {
      kind: "plugin",
      id: "isabella.plugin.orphan",
      version: "1.0.0",
      state: "engine-generated",
      scope: "workspace",
      description: "pack sin dependencias registradas",
      enabledByDefault: false,
      disabled: true,
      bundles: { rules: ["isabella.rule.nope"], skills: [], hooks: [], mcpServers: [] },
    };
    registry.register(orphan);
    expect(resolveMarketplacePack(orphan, registry).missing).toContain("isabella.rule.nope");
  });

  it("marca los packs como no habilitados", () => {
    const pack = resolveMarketplacePack(kitEntry(), seed());
    expect(pack.enabled).toBe(false);
    expect(pack.requiresHumanApproval).toBe(true);
  });
});

describe("planMarketplaceEnablement", () => {
  it("produce un plan no ejecutado ni autorizado", () => {
    const plan = planMarketplaceEnablement(resolveMarketplacePack(kitEntry(), seed()));
    expect(plan.status).toBe("PLANNED_NOT_ENABLED");
    expect(plan.enabled).toBe(false);
    expect(plan.authorizationPerformed).toBe(false);
    expect(plan.executionPerformed).toBe(false);
    expect(plan.steps.length).toBeGreaterThan(0);
  });
});
