import { describe, expect, it } from "vitest";
import { GenesisModuleRegistry, type GenesisModuleDescriptor } from "../../src/modules";

function descriptor(overrides: Partial<GenesisModuleDescriptor> = {}): GenesisModuleDescriptor {
  return { id: "mod.one", version: "1.0.0", domain: "cognition", capabilities: ["recall"], ...overrides };
}

describe("modules/registry", () => {
  it("registra, recupera y lista módulos", () => {
    const registry = new GenesisModuleRegistry();
    registry.register(descriptor());
    expect(registry.get("mod.one").id).toBe("mod.one");
    expect(registry.list()).toHaveLength(1);
  });

  it("rechaza IDs duplicados", () => {
    const registry = new GenesisModuleRegistry();
    registry.register(descriptor());
    expect(() => registry.register(descriptor())).toThrow(/duplicate module/);
  });

  it("falla cerrado ante un módulo desconocido", () => {
    const registry = new GenesisModuleRegistry();
    expect(() => registry.get("missing")).toThrow(/unknown module/);
  });

  it("congela el descriptor y sus capacidades", () => {
    const registry = new GenesisModuleRegistry();
    const capabilities = ["recall"];
    registry.register(descriptor({ capabilities }));
    const stored = registry.get("mod.one");
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.capabilities)).toBe(true);
    capabilities.push("write");
    expect(stored.capabilities).toHaveLength(1);
  });
});
