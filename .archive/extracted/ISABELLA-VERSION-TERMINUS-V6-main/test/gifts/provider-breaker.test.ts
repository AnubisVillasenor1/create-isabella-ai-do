import { describe, expect, it } from "vitest";
import { ProviderBreaker } from "../../src/gifts/provider-breaker";

describe("Regalo 7 — Disyuntor de Proveedores", () => {
  it("abre tras los fallos y pasa a HALF_OPEN tras el enfriamiento", () => {
    let clock = 0;
    const breaker = new ProviderBreaker({ failureThreshold: 2, openMs: 1000, now: () => clock });

    expect(breaker.allow("proveedor-a")).toBe(true);
    breaker.recordFailure("proveedor-a");
    expect(breaker.allow("proveedor-a")).toBe(true);
    breaker.recordFailure("proveedor-a");
    expect(breaker.stateOf("proveedor-a").state).toBe("OPEN");
    expect(breaker.allow("proveedor-a")).toBe(false);

    clock = 1000;
    expect(breaker.stateOf("proveedor-a").state).toBe("HALF_OPEN");
    breaker.recordSuccess("proveedor-a");
    expect(breaker.stateOf("proveedor-a").state).toBe("CLOSED");
  });

  it("ordena proveedores sanos primero", () => {
    const breaker = new ProviderBreaker({ failureThreshold: 1, openMs: 10000, now: () => 0 });
    breaker.recordFailure("caido");
    const ordered = breaker.orderForRouting(["caido", "sano"]);
    expect(ordered[0]).toBe("sano");
    expect(breaker.available(["caido", "sano"])).toEqual(["sano"]);
  });
});
