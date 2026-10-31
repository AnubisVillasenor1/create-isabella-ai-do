import { describe, expect, it } from "vitest";
import { MAGPIE_SCHEMA_VERSION, MAGPIE_WILDCARD, MagpieBus, type MagpieEvent } from "../../src/messaging/magpie";

describe("MAGPIE-X governed event bus", () => {
  it("delivers to topic subscribers in subscription order", () => {
    const bus = new MagpieBus();
    const seen: number[] = [];
    bus.subscribe("territory.updated", () => seen.push(1));
    bus.subscribe("territory.updated", () => seen.push(2));
    const report = bus.publish({ topic: "territory.updated", type: "update", payload: { id: "t-1" } });
    expect(report.delivered).toBe(2);
    expect(report.failed).toBe(0);
    expect(seen).toEqual([1, 2]);
  });

  it("delivers every event to wildcard subscribers", () => {
    const bus = new MagpieBus();
    const topics: string[] = [];
    bus.subscribe(MAGPIE_WILDCARD, (event: MagpieEvent) => topics.push(event.topic));
    bus.publish({ topic: "a", type: "x", payload: null });
    bus.publish({ topic: "b", type: "y", payload: null });
    expect(topics).toEqual(["a", "b"]);
  });

  it("isolates a faulty subscriber without failing the publisher", () => {
    const bus = new MagpieBus();
    bus.subscribe("x", () => {
      throw new Error("boom");
    });
    const ok: string[] = [];
    bus.subscribe("x", () => ok.push("ok"));
    const report = bus.publish({ topic: "x", type: "t", payload: null });
    expect(report).toMatchObject({ delivered: 1, failed: 1 });
    expect(ok).toEqual(["ok"]);
  });

  it("stamps the canonical schema version and keeps a bounded history", () => {
    const bus = new MagpieBus(2);
    bus.publish({ topic: "a", type: "t", payload: 1 });
    bus.publish({ topic: "a", type: "t", payload: 2 });
    bus.publish({ topic: "a", type: "t", payload: 3 });
    const history = bus.history("a");
    expect(history).toHaveLength(2);
    expect(history[0]?.schemaVersion).toBe(MAGPIE_SCHEMA_VERSION);
  });

  it("unsubscribes and rejects empty topics/types (fail-closed)", () => {
    const bus = new MagpieBus();
    let count = 0;
    const off = bus.subscribe("a", () => (count += 1));
    off();
    bus.publish({ topic: "a", type: "t", payload: null });
    expect(count).toBe(0);
    expect(() => bus.publish({ topic: " ", type: "t", payload: null })).toThrow(/MAGPIE_TOPIC_REQUIRED/);
    expect(() => bus.publish({ topic: "a", type: "  ", payload: null })).toThrow(/MAGPIE_TYPE_REQUIRED/);
  });
});
