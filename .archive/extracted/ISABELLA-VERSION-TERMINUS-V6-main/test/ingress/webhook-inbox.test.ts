import { describe, expect, it } from "vitest";
import { WebhookInbox } from "../../src/ingress/webhook-inbox";

/** state: draft | engine-generated */
describe("WebhookInbox", () => {
  it("dedupes completed events, flags in-flight, and releases failures", () => {
    const inbox = new WebhookInbox(1000, 100, 100);
    expect(inbox.begin("evt_1", 0)).toBe("NEW");
    expect(inbox.begin("evt_1", 1)).toBe("IN_FLIGHT");
    inbox.fail("evt_1");
    expect(inbox.begin("evt_1", 2)).toBe("NEW");
    inbox.complete("evt_1", 3);
    expect(inbox.begin("evt_1", 4)).toBe("DUPLICATE");
    expect(inbox.begin("evt_2", 4)).toBe("NEW");
  });
  it("expires entries (TTL and in-flight TTL for crashed handlers)", () => {
    const inbox = new WebhookInbox(1000, 100, 100);
    inbox.begin("a", 0);
    expect(inbox.begin("a", 101)).toBe("NEW");
    inbox.complete("a", 0);
    expect(inbox.begin("a", 999)).toBe("DUPLICATE");
    expect(inbox.begin("a", 1001)).toBe("NEW");
  });
  it("stays bounded and validates input", () => {
    const inbox = new WebhookInbox(1000, 10, 100);
    for (let i = 0; i < 100; i += 1) inbox.begin(`e${i}`, 0);
    expect(inbox.size).toBeLessThanOrEqual(10);
    expect(() => inbox.begin("", 0)).toThrow();
    expect(() => new WebhookInbox(0)).toThrow();
  });
});

import { EventOrderGuard } from "../../src/ingress/webhook-inbox";

describe("EventOrderGuard", () => {
  it("drops stale events so a late update cannot resurrect a deleted subscription", () => {
    const g = new EventOrderGuard();
    expect(g.accept("ws", 100)).toBe(true);
    expect(g.accept("ws", 300)).toBe(true); // deleted
    expect(g.accept("ws", 200)).toBe(false); // updated tardío
    expect(g.accept("ws", 300)).toBe(true);
    expect(g.accept("other", 1)).toBe(true);
  });
  it("is bounded and validates", () => {
    const g = new EventOrderGuard(3);
    for (let i = 0; i < 10; i += 1) g.accept(`k${i}`, i);
    expect((g as unknown as { last: Map<string, number> }).last.size).toBeLessThanOrEqual(3);
    expect(() => new EventOrderGuard(0)).toThrow();
  });
});
