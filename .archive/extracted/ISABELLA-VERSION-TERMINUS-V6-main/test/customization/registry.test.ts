import { describe, expect, it } from "vitest";
import { CustomizationRegistry, type CustomizationEntry } from "../../src/customization";

function rule(id: string): CustomizationEntry {
  return {
    kind: "rule",
    id,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    description: "regla",
    path: "AGENTS.md",
    alwaysOn: true,
    trigger: "always_on",
  };
}

describe("CustomizationRegistry", () => {
  it("registra y recupera entidades por id", () => {
    const registry = new CustomizationRegistry();
    registry.register(rule("isabella.rule.a"));
    expect(registry.has("isabella.rule.a")).toBe(true);
    expect(registry.get("isabella.rule.a")?.kind).toBe("rule");
  });

  it("rechaza descriptores inválidos", () => {
    const registry = new CustomizationRegistry();
    expect(() => registry.register({ ...rule(""), id: "" })).toThrow("CUSTOMIZATION_INVALID_DESCRIPTOR");
  });

  it("rechaza duplicados", () => {
    const registry = new CustomizationRegistry();
    registry.register(rule("isabella.rule.a"));
    expect(() => registry.register(rule("isabella.rule.a"))).toThrow("CUSTOMIZATION_DUPLICATE:isabella.rule.a");
  });

  it("lista ordenado y congelado", () => {
    const registry = new CustomizationRegistry();
    registry.register(rule("isabella.rule.b"));
    registry.register(rule("isabella.rule.a"));
    const list = registry.list();
    expect(list.map((entry) => entry.id)).toEqual(["isabella.rule.a", "isabella.rule.b"]);
    expect(Object.isFrozen(list[0])).toBe(true);
  });

  it("cuenta por tipo", () => {
    const registry = new CustomizationRegistry();
    registry.register(rule("isabella.rule.a"));
    registry.register({ ...rule("isabella.hook.a"), kind: "hook", event: "Stop", enabled: true, handlers: [] });
    const counts = registry.countByKind();
    expect(counts.rule).toBe(1);
    expect(counts.hook).toBe(1);
    expect(counts.skill).toBe(0);
    expect(registry.listByKind("rule")).toHaveLength(1);
  });

  it("produce un digest determinista", () => {
    const a = new CustomizationRegistry();
    const b = new CustomizationRegistry();
    a.register(rule("isabella.rule.a"));
    b.register(rule("isabella.rule.a"));
    expect(a.manifest()).toBe(b.manifest());
    b.register(rule("isabella.rule.c"));
    expect(a.manifest()).not.toBe(b.manifest());
  });
});
