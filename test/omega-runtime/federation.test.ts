import { describe, expect, it } from "vitest";
import {
  DistributedKvFabric,
  FederatedKnowledgeSync,
  compareClocks,
  mergeClocks,
  type FederatedRecord,
} from "../../src/omega-runtime/federation";

describe("vector clocks", () => {
  it("orders equal, ahead, behind and concurrent clocks", () => {
    expect(compareClocks({ a: 1 }, { a: 1 })).toBe("equal");
    expect(compareClocks({ a: 2 }, { a: 1 })).toBe("ahead");
    expect(compareClocks({ a: 1 }, { a: 2 })).toBe("behind");
    expect(compareClocks({ a: 2, b: 1 }, { a: 1, b: 2 })).toBe("concurrent");
  });

  it("merges clocks component-wise", () => {
    expect(mergeClocks({ a: 2, b: 1 }, { a: 1, b: 4, c: 2 })).toEqual({ a: 2, b: 4, c: 2 });
  });
});

describe("ΩX-12 federated knowledge synchronization", () => {
  it("applies a dominant remote record and rejects a stale one", () => {
    const sync = new FederatedKnowledgeSync({ nodeId: "a", now: () => 10 });
    sync.upsert("plan", { price: 10 }, 10);
    const incoming: FederatedRecord = {
      id: "plan",
      value: { price: 20 },
      clock: { a: 2, b: 1 },
      updatedAt: 20,
      deleted: false,
      origin: "b",
    };
    expect(sync.merge(incoming)).toMatchObject({ applied: true, reason: "applied" });
    expect(sync.get("plan")?.value).toEqual({ price: 20 });

    const concurrent: FederatedRecord = {
      ...incoming,
      clock: { a: 1, b: 2 },
      updatedAt: 30,
      value: { price: 30 },
    };
    expect(sync.merge(concurrent)).toMatchObject({ applied: true, reason: "applied" });
    expect(sync.get("plan")?.value).toEqual({ price: 30 });

    const stale: FederatedRecord = { ...incoming, clock: { a: 1, b: 1 }, updatedAt: 5, value: { price: 5 } };
    expect(sync.merge(stale)).toMatchObject({ applied: false, reason: "stale-clock" });
    expect(sync.get("plan")?.value).toEqual({ price: 30 });
    expect(sync.stats().conflicts).toBe(1);
  });

  it("propagates tombstones and prunes them after the TTL", () => {
    const sync = new FederatedKnowledgeSync({ nodeId: "a", tombstoneTtlMs: 100, now: () => 1_000 });
    sync.upsert("decision", { ok: true }, 1_000);
    const removed = sync.remove("decision", 1_100);
    expect(removed?.deleted).toBe(true);
    expect(sync.get("decision")).toBeUndefined();
    expect(sync.list()).toEqual([]);
    expect(sync.pruneTombstones(1_150)).toBe(0);
    expect(sync.pruneTombstones(1_250)).toBe(1);
    expect(sync.size).toBe(0);
  });

  it("exports only records newer than a remote clock", () => {
    const sync = new FederatedKnowledgeSync({ nodeId: "a" });
    sync.upsert("one", 1, 1);
    sync.upsert("two", 2, 2);
    const exported = sync.exportSince({ a: 1 });
    expect(exported.map((record) => record.id)).toEqual(["two"]);
    expect(sync.digest()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ΩX-17 distributed KV fabric", () => {
  it("replicates writes and reads by quorum", () => {
    const kv = new DistributedKvFabric({
      nodeIds: ["n1", "n2", "n3"],
      replicationFactor: 3,
      now: () => 5,
    });
    const write = kv.set("omega:key", { value: 42 });
    expect(write.ok).toBe(true);
    expect(write.acknowledgements).toBe(3);
    expect(write.quorumRequired).toBe(2);
    const read = kv.get("omega:key");
    expect(read.found).toBe(true);
    expect(read.value).toEqual({ value: 42 });
    expect(read.quorumMet).toBe(true);
    expect(read.replicas).toHaveLength(3);
  });

  it("fails closed when quorum cannot be reached", () => {
    const kv = new DistributedKvFabric({
      nodeIds: ["n1", "n2", "n3"],
      replicationFactor: 3,
    });
    kv.set("omega:key", "value");
    const replicas = kv.replicasFor("omega:key");
    kv.setNodeHealth(replicas[0]!, false);
    kv.setNodeHealth(replicas[1]!, false);
    const read = kv.get("omega:key");
    expect(read.quorumMet).toBe(false);
    expect(read.found).toBe(false);
    expect(read.acknowledgements).toBe(1);
    expect(kv.snapshot().quorumFailures).toBeGreaterThan(0);
    kv.setNodeHealth(replicas[0]!, true);
    kv.setNodeHealth(replicas[1]!, true);
    expect(kv.get("omega:key").found).toBe(true);
  });

  it("treats removals as tombstones and validates keys", () => {
    const kv = new DistributedKvFabric({ nodeIds: ["n1", "n2"], replicationFactor: 2 });
    kv.set("key", "value");
    const removal = kv.remove("key");
    expect(removal.ok).toBe(true);
    expect(kv.get("key").found).toBe(false);
    expect(() => kv.get("")).toThrow(/key/);
  });
});
