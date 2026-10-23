import { describe, expect, it } from "vitest";
import { CitemeshBus } from "../../src/fabric/citemesh";

describe("CITEMESH", () => {
  it("publishes and delivers to subscribers", async () => {
    const bus = new CitemeshBus();
    const received: string[] = [];
    bus.subscribe("test.topic", (e) => { received.push(e.type); });
    const ev = await bus.publish({ type: "test.topic", payload: { x: 1 }, source: "src" });
    expect(ev.type).toBe("test.topic");
    expect(received).toEqual(["test.topic"]);
    expect(bus.stats().published).toBe(1);
    expect(bus.stats().delivered).toBe(1);
  });
  it("wildcard and target delivery", async () => {
    const bus = new CitemeshBus();
    const all: string[] = [];
    bus.subscribe("*", (e) => { all.push(e.id); });
    await bus.publish({ type: "a", payload: 1, source: "s", target: "t" });
    expect(all).toHaveLength(1);
  });
  it("isolates handler failures", async () => {
    const bus = new CitemeshBus();
    const ok: string[] = [];
    bus.subscribe("t", () => { throw new Error("boom"); });
    bus.subscribe("t", (e) => { ok.push(e.id); });
    await bus.publish({ type: "t", payload: 1, source: "s" });
    expect(ok).toHaveLength(1);
    expect(bus.stats().failed).toBe(1);
  });
  it("replays with filters", async () => {
    const bus = new CitemeshBus();
    await bus.publish({ type: "a", payload: 1, source: "s1" });
    await bus.publish({ type: "b", payload: 2, source: "s2" });
    expect(bus.replay({ type: "a" })).toHaveLength(1);
    expect(bus.replay({ source: "s2" })).toHaveLength(1);
  });
  it("validates input and bounds", async () => {
    const bus = new CitemeshBus();
    await expect(bus.publish({ type: "", payload: 1, source: "s" } as never)).rejects.toThrow();
    await expect(bus.publish({ type: "t", payload: 1, source: "" } as never)).rejects.toThrow();
    expect(() => new CitemeshBus(0)).toThrow();
  });
});
