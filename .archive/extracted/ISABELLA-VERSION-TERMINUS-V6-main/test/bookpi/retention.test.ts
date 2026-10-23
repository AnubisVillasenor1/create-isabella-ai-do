import { describe, expect, it } from "vitest";
import { planRetention } from "../../src/bookpi/retention";
import { InMemoryBookPiLedger, type BookPiEvent } from "../../src/bookpi/ledger";

function seedLedger(count: number, startMs: number, stepMs: number): BookPiEvent[] {
  const ledger = new InMemoryBookPiLedger();
  for (let i = 0; i < count; i += 1) {
    ledger.append({
      id: `evt-${i}`,
      timestamp: new Date(startMs + i * stepMs).toISOString(),
      type: "test.event",
      methodId: "TINA.YUN.TEST.append.v0.1.0.LOW.AUTONOMOUS",
      principal: "tester",
      riskTier: "LOW",
      status: "OK",
    });
  }
  return [...ledger.list()];
}

describe("planRetention", () => {
  const base = 1_700_000_000_000;

  it("keeps the most-recent N events and archives the rest", () => {
    const events = seedLedger(5, base, 1_000);
    const plan = planRetention(events, { maxEvents: 2 });
    expect(plan.kept).toHaveLength(2);
    expect(plan.archived).toHaveLength(3);
    expect(plan.kept[0]?.id).toBe("evt-3");
    expect(plan.checkpoint?.archivedCount).toBe(3);
    expect(plan.checkpoint?.lastArchivedHash).toBe(plan.archived.at(-1)?.hash);
  });

  it("archives events older than maxAgeMs", () => {
    const events = seedLedger(5, base, 1_000);
    const plan = planRetention(events, { maxAgeMs: 2_500, now: base + 5_000 });
    expect(plan.archived.map((e) => e.id)).toEqual(["evt-0", "evt-1", "evt-2"]);
    expect(plan.kept.map((e) => e.id)).toEqual(["evt-3", "evt-4"]);
  });

  it("combines both policies taking the more aggressive cut", () => {
    const events = seedLedger(6, base, 1_000);
    const plan = planRetention(events, { maxEvents: 4, maxAgeMs: 3_500, now: base + 6_000 });
    expect(plan.archived).toHaveLength(3);
    expect(plan.kept).toHaveLength(3);
  });

  it("keeps everything with an empty policy", () => {
    const events = seedLedger(3, base, 1_000);
    const plan = planRetention(events, {});
    expect(plan.kept).toHaveLength(3);
    expect(plan.archived).toHaveLength(0);
    expect(plan.checkpoint).toBeNull();
  });

  it("rejects invalid policies", () => {
    const events = seedLedger(1, base, 1_000);
    expect(() => planRetention(events, { maxEvents: -1 })).toThrow("RETENTION_MAX_EVENTS_INVALID");
    expect(() => planRetention(events, { maxAgeMs: -1 })).toThrow("RETENTION_MAX_AGE_INVALID");
  });

  it("can archive everything when maxEvents is zero", () => {
    const events = seedLedger(3, base, 1_000);
    const plan = planRetention(events, { maxEvents: 0 });
    expect(plan.kept).toHaveLength(0);
    expect(plan.archived).toHaveLength(3);
  });
});
