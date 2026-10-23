import { describe, expect, it } from "vitest";
import { ProtocolRegistry, type ProtocolContext } from "../../src/protocols";

describe("protocols/registry", () => {
  it("registra y recupera un protocolo congelado", () => {
    const registry = new ProtocolRegistry();
    registry.register({ id: "p.one", version: "1.0.0", description: "d", execute: async () => 1 });
    const protocol = registry.get("p.one");
    expect(protocol.id).toBe("p.one");
    expect(Object.isFrozen(protocol)).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });

  it("rechaza IDs duplicados", () => {
    const registry = new ProtocolRegistry();
    const protocol = { id: "p.dup", version: "1.0.0", description: "d", execute: async () => 1 };
    registry.register(protocol);
    expect(() => registry.register(protocol)).toThrow(/duplicate protocol/);
  });

  it("falla cerrado ante un protocolo desconocido", () => {
    const registry = new ProtocolRegistry();
    expect(() => registry.get("missing")).toThrow(/unknown protocol/);
  });

  it("propaga el requestId explícito como requestId y traceId", async () => {
    const registry = new ProtocolRegistry();
    const seen: ProtocolContext[] = [];
    registry.register({
      id: "p.ctx",
      version: "1.0.0",
      description: "d",
      execute: async (context) => {
        seen.push(context);
        return context.input;
      },
    });
    const result = await registry.execute("p.ctx", { value: 7 }, "req-1");
    expect(result).toEqual({ value: 7 });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.requestId).toBe("req-1");
    expect(seen[0]?.traceId).toBe("req-1");
  });

  it("genera un requestId por defecto y lo reutiliza como traceId", async () => {
    const registry = new ProtocolRegistry();
    let capturedRequestId = "";
    registry.register({
      id: "p.ctx2",
      version: "1.0.0",
      description: "d",
      execute: async (context) => {
        capturedRequestId = context.requestId ?? "";
        return context.traceId;
      },
    });
    const traceId = await registry.execute("p.ctx2", {});
    expect(capturedRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(traceId).toBe(capturedRequestId);
  });
});
