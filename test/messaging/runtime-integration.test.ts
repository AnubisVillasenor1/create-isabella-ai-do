import { describe, expect, it } from "vitest";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import { createPrincipal } from "../../src/identity/principal";
import type { MagpieEvent } from "../../src/messaging";

describe("MAGPIE-X runtime integration", () => {
  it("registers hsf.messaging.bus and round-trips publish/subscribe", () => {
    const runtime = new IsabellaGenesisRuntime();
    expect(runtime.capabilities.list().map((c) => c.id)).toContain("hsf.messaging.bus");

    const seen: MagpieEvent[] = [];
    const off = runtime.subscribeEvent("territory.updated", (event) => seen.push(event));
    const report = runtime.publishEvent({ topic: "territory.updated", type: "update", payload: { id: "t-1" } });

    expect(report).toMatchObject({ topic: "territory.updated", delivered: 1, failed: 0 });
    expect(seen[0]?.payload).toEqual({ id: "t-1" });

    off();
    expect(runtime.publishEvent({ topic: "territory.updated", type: "update", payload: null }).delivered).toBe(0);
  });

  it("emits a governed tool.failed event when a tool cannot execute (fail-closed)", async () => {
    const runtime = new IsabellaGenesisRuntime();
    const failed: string[] = [];
    runtime.subscribeEvent("tool.failed", (event) => failed.push(event.topic));

    const decision = await runtime.executeTool("tool.does.not.exist", { q: "x" }, createPrincipal({ id: "test:operator", kind: "human", roles: ["operator"] }), "scope");
    expect(decision.admitted).toBe(false);
    expect(failed).toEqual(["tool.failed"]);
    expect(runtime.events.history("tool.failed")).toHaveLength(1);
  });
});
