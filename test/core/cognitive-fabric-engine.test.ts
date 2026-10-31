import { describe, expect, it } from "vitest";
import { CognitiveFabricEngine } from "../../src/core/cognitive-fabric-engine";

describe("Cognitive Fabric Engine (CFE)", () => {
  it("registers meshes and executes tasks", async () => {
    const cfe = new CognitiveFabricEngine();
    cfe.register("reasoning", "reasoner", (t) => ({ taskId: t.id, kind: t.kind, output: "ok", latencyMs: 1, success: true }));
    expect(cfe.has("reasoning")).toBe(true);
    const r = await cfe.execute({ kind: "reasoning", input: "hi", priority: 1 });
    expect(r.success).toBe(true);
    expect(r.output).toBe("ok");
  });
  it("fails on unknown mesh", async () => {
    const cfe = new CognitiveFabricEngine();
    await expect(cfe.execute({ kind: "memory", input: "x", priority: 0 })).rejects.toThrow();
  });
  it("handles unhealthy mesh", async () => {
    const cfe = new CognitiveFabricEngine();
    cfe.register("agent", "agent", (t) => ({ taskId: t.id, kind: t.kind, output: 1, latencyMs: 1, success: true }));
    cfe.setHealthy("agent", false);
    const r = await cfe.execute({ kind: "agent", input: 1, priority: 0 });
    expect(r.success).toBe(false);
  });
  it("executeAll and health", async () => {
    const cfe = new CognitiveFabricEngine();
    cfe.register("rag", "rag", (t) => ({ taskId: t.id, kind: t.kind, output: "r", latencyMs: 1, success: true }));
    const rs = await cfe.executeAll([{ kind: "rag", input: 1, priority: 0 }, { kind: "rag", input: 2, priority: 0 }]);
    expect(rs).toHaveLength(2);
    expect(cfe.health()).toHaveLength(1);
    expect(cfe.stats().meshes).toBe(1);
  });
  it("validates input", () => {
    const cfe = new CognitiveFabricEngine();
    expect(() => cfe.register("reasoning", "", (t) => ({ taskId: t.id, kind: t.kind, output: 1, latencyMs: 1, success: true }))).toThrow();
  });
});
