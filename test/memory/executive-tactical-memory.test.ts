import { describe, expect, it } from "vitest";
import { ExecutiveTacticalMemory } from "../../src/memory/executive-tactical-memory";

function sequentialIds(): () => string {
  let index = 0;
  return () => `etm-${++index}`;
}

describe("ExecutiveTacticalMemory", () => {
  it("stores goals, plans, decisions and priorities ordered by priority then age", () => {
    let clock = 1_000;
    const memory = new ExecutiveTacticalMemory({
      now: () => clock++,
      defaultTtlMs: null,
      idFactory: sequentialIds(),
    });

    memory.record("goal", "Consolidar el canon", { owner: "CROWN" }, { priority: 0.4 });
    memory.record("plan", "Publicar la página", { steps: 3 }, { priority: 0.9 });
    memory.record("decision", "Aprobar el registro", { approved: true }, { priority: 0.9 });

    const records = memory.list();
    expect(records.map((record) => record.kind)).toEqual(["plan", "decision", "goal"]);
    expect(records[0]?.title).toBe("Publicar la página");
    expect(memory.list("decision")).toHaveLength(1);
    expect(memory.stats().byKind).toEqual({ goal: 1, plan: 1, decision: 1, priority: 0 });
  });

  it("hides expired records while preserving a verifiable chain", () => {
    let clock = 1_000;
    const memory = new ExecutiveTacticalMemory({
      now: () => clock,
      defaultTtlMs: 100,
      idFactory: sequentialIds(),
    });
    const record = memory.record("decision", "Vigencia corta", { value: 1 });

    expect(memory.list()).toHaveLength(1);
    clock = 1_100;

    expect(memory.list()).toHaveLength(0);
    expect(memory.read(record.id)).toBeUndefined();
    const stats = memory.stats();
    expect(stats.activeRecords).toBe(0);
    expect(stats.expiredRecords).toBe(1);
    expect(stats.retainedRecords).toBe(1);
    expect(stats.integrity).toBe(true);
  });

  it("supports non-expiring tactical records", () => {
    let clock = 5_000;
    const memory = new ExecutiveTacticalMemory({
      now: () => clock,
      defaultTtlMs: null,
      idFactory: sequentialIds(),
    });
    memory.record("goal", "Meta permanente", { scope: "session" });
    clock = 5_000_000;

    expect(memory.list()).toHaveLength(1);
    expect(memory.stats().expiredRecords).toBe(0);
  });

  it("evicts oldest records at capacity without breaking integrity", () => {
    let clock = 1_000;
    const memory = new ExecutiveTacticalMemory({
      capacity: 2,
      now: () => clock++,
      defaultTtlMs: null,
      idFactory: sequentialIds(),
    });
    const first = memory.record("goal", "Primera", {});
    const second = memory.record("plan", "Segunda", {});
    const third = memory.record("decision", "Tercera", {});

    expect(memory.read(first.id)).toBeUndefined();
    expect(memory.read(second.id)).toBeDefined();
    expect(memory.read(third.id)).toBeDefined();
    expect(memory.size).toBe(2);
    expect(memory.verifyIntegrity()).toBe(true);

    const snapshot = memory.snapshot();
    expect(snapshot.evictedHead).toBe(first.hash);
    expect(snapshot.headHash).toBe(third.hash);
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.integrity).toBe(true);
  });

  it("detects local tampering of a retained record", () => {
    const memory = new ExecutiveTacticalMemory({ defaultTtlMs: null, idFactory: sequentialIds() });
    memory.record("goal", "Integridad", { value: 1 });
    expect(memory.verifyIntegrity()).toBe(true);

    const internal = memory as unknown as { records: Array<{ payload: unknown }> };
    const first = internal.records[0];
    expect(first).toBeDefined();
    if (first) first.payload = { value: 2 };

    expect(memory.verifyIntegrity()).toBe(false);
    expect(memory.stats().integrity).toBe(false);
  });

  it("clones payloads on write and read so callers cannot mutate stored state", () => {
    const memory = new ExecutiveTacticalMemory({ defaultTtlMs: null, idFactory: sequentialIds() });
    const payload = { goal: "publicar" };
    const record = memory.record("goal", "Payload aislado", payload);

    payload.goal = "mutado";
    expect((record.payload as { goal: string }).goal).toBe("publicar");

    const fetched = memory.read(record.id);
    expect(fetched).toBeDefined();
    if (fetched) (fetched.payload as { goal: string }).goal = "otro";
    expect((memory.read(record.id)?.payload as { goal: string }).goal).toBe("publicar");
  });

  it("rejects invalid capacity, kind, title, priority, TTL and payloads", () => {
    expect(() => new ExecutiveTacticalMemory({ capacity: 0 })).toThrow("ETM_INVALID_CAPACITY");
    expect(() => new ExecutiveTacticalMemory({ defaultTtlMs: 0 })).toThrow("ETM_INVALID_TTL");

    const memory = new ExecutiveTacticalMemory({ idFactory: sequentialIds() });
    expect(() => memory.record("goal", "   ", {})).toThrow("ETM_INVALID_TITLE");
    expect(() => memory.record("goal", "x", {}, { priority: 2 })).toThrow("ETM_INVALID_PRIORITY");
    expect(() => memory.record("goal", "x", {}, { ttlMs: 0 })).toThrow("ETM_INVALID_TTL");
    expect(() => memory.record("goal", "x", () => 1)).toThrow("ETM_PAYLOAD_NOT_CLONEABLE");
    expect(() => memory.record("unknown" as "goal", "x", {})).toThrow("ETM_INVALID_KIND");
  });

  it("declares no authority or canonical-memory mutation in its snapshot", () => {
    const memory = new ExecutiveTacticalMemory({ defaultTtlMs: null, idFactory: sequentialIds() });
    memory.record("priority", "Ordenar el trabajo", { rank: 1 });

    const snapshot = memory.snapshot();
    expect(snapshot.authority).toBe("NONE");
    expect(snapshot.canonicalMemoryMutation).toBe(false);
    expect(snapshot.integrity).toBe(true);
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it("clears tactical state without claiming to erase canonical evidence", () => {
    const memory = new ExecutiveTacticalMemory({ defaultTtlMs: null, idFactory: sequentialIds() });
    memory.record("plan", "Plan temporal", {});
    memory.clear();

    expect(memory.size).toBe(0);
    expect(memory.list()).toEqual([]);
    expect(memory.verifyIntegrity()).toBe(true);
    expect(memory.snapshot().headHash).toBeNull();
  });
});
