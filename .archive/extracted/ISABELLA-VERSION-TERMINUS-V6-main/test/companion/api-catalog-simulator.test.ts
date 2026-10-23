import { describe, expect, it } from "vitest";
import { createApiCatalogSimulator } from "../../src/companion/api-catalog-simulator";
import type { SimulatedEndpoint } from "../../src/companion/api-catalog-simulator";

const catalog: readonly SimulatedEndpoint[] = Object.freeze([
  Object.freeze({ route: "/api/v1/health", method: "GET", sensitive: false, sideEffects: "NONE" }),
  Object.freeze({ route: "/api/v1/memory", method: "GET", sensitive: false, sideEffects: "NONE" }),
  Object.freeze({ route: "/api/v1/commerce/order", method: "POST", sensitive: true, sideEffects: "NONE" }),
]);

describe("api-catalog-simulator (ISA-455)", () => {
  it("cannot execute privileged actions, structurally", () => {
    const simulator = createApiCatalogSimulator({ catalog });
    expect(simulator.executesPrivilegedActions()).toBe(false);
  });

  it("executes only non-sensitive simulated routes and never mutates state", () => {
    const simulator = createApiCatalogSimulator({ catalog });
    const response = simulator.execute("/api/v1/health");
    expect(response).toMatchObject({ ok: true, simulated: true });
    expect(response.payload).toBe("simulated:/api/v1/health");
  });

  it("refuses sensitive routes and unknown routes", () => {
    const simulator = createApiCatalogSimulator({ catalog });
    expect(simulator.isSensitive("/api/v1/commerce/order")).toBe(true);
    expect(() => simulator.execute("/api/v1/commerce/order")).toThrow(/sensible/);
    expect(() => simulator.execute("/nope")).toThrow(/no simulada/);
  });

  it("cannot be constructed with a side-effecting endpoint", () => {
    const sideEffecting = { route: "/x", method: "POST", sensitive: false, sideEffects: "REAL" } as unknown as SimulatedEndpoint;
    expect(() => createApiCatalogSimulator({ catalog: [sideEffecting] })).toThrow(/side effects/);
  });

  it("rejects empty routes, non-slash routes and duplicates", () => {
    expect(() => createApiCatalogSimulator({ catalog: [Object.freeze({ route: "", method: "GET", sensitive: false, sideEffects: "NONE" })] })).toThrow(/vacía/);
    expect(() => createApiCatalogSimulator({ catalog: [Object.freeze({ route: "x", method: "GET", sensitive: false, sideEffects: "NONE" })] })).toThrow(/ini/);
    expect(() =>
      createApiCatalogSimulator({
        catalog: [
          Object.freeze({ route: "/a", method: "GET", sensitive: false, sideEffects: "NONE" }),
          Object.freeze({ route: "/a", method: "GET", sensitive: false, sideEffects: "NONE" }),
        ],
      }),
    ).toThrow(/duplicada/);
  });
});