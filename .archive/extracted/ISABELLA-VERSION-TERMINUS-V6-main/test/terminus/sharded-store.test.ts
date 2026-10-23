import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { BookPiEventRecord, BookPiEventSeed, BookPiStorage } from "../../src/bookpi/types";
import {
  TerminusShardedStore,
  type DataKeyManager,
  type ShardQuota,
  type ShardStore,
  type StoredShard,
} from "../../src/terminus/sharded-store";

class MemoryShardStore implements ShardStore {
  readonly entries = new Map<string, StoredShard>();
  constructor(readonly providerId: string, public failWrites = false) {}

  async putIfWithinQuota(record: StoredShard, quota: ShardQuota): Promise<void> {
    if (this.failWrites) throw new Error("provider quota unavailable");
    const key = record.tenantFingerprint + ":" + record.objectId + ":" + record.shardIndex;
    if (this.entries.has(key)) throw new Error("immutable object already exists");
    const cloned = { ...record, payload: Uint8Array.from(record.payload), triangulatedId: { ...record.triangulatedId } };
    const nextBytes = this.byteUsage() + Buffer.byteLength(JSON.stringify({ ...cloned, payload: Array.from(cloned.payload) }));
    if (this.entries.size + 1 > quota.maxObjects || nextBytes > quota.maxBytes) throw new Error("quota exceeded");
    this.entries.set(key, cloned);
  }

  async get(objectId: string, tenantFingerprint: string, shardIndex: number): Promise<StoredShard | null> {
    const found = this.entries.get(tenantFingerprint + ":" + objectId + ":" + shardIndex);
    return found ? { ...found, payload: Uint8Array.from(found.payload), triangulatedId: { ...found.triangulatedId } } : null;
  }

  async delete(objectId: string, tenantFingerprint: string, shardIndex: number): Promise<void> {
    this.entries.delete(tenantFingerprint + ":" + objectId + ":" + shardIndex);
  }

  async getUsage(): Promise<{ usedBytes: number; objectCount: number }> {
    return { usedBytes: this.byteUsage(), objectCount: this.entries.size };
  }

  private byteUsage(): number {
    let total = 0;
    for (const record of this.entries.values()) {
      total += Buffer.byteLength(JSON.stringify({ ...record, payload: Array.from(record.payload) }));
    }
    return total;
  }
}

function noOpAdmissionGate() {
  return async () => ({ commit: async () => {}, release: async () => {} });
}

class MemoryKeyManager implements DataKeyManager {
  readonly keys = new Map<string, Uint8Array>();
  private next = 0;

  async createKey(): Promise<{ keyId: string; key: Uint8Array }> {
    const keyId = "test-key-" + (++this.next);
    const key = randomBytes(32);
    this.keys.set(keyId, Uint8Array.from(key));
    return { keyId, key };
  }

  async getKey(keyId: string): Promise<Uint8Array | null> {
    const key = this.keys.get(keyId);
    return key ? Uint8Array.from(key) : null;
  }

  async destroyKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);
    key?.fill(0);
    this.keys.delete(keyId);
  }
}

function fakeLedger(): BookPiStorage {
  let sequence = 0;
  const events: BookPiEventRecord[] = [];
  return {
    getLastEvent: async () => events.at(-1) ?? null,
    appendEvent: async (seed: BookPiEventSeed) => {
      sequence += 1;
      const record = {
        ...seed, id: "bookpi-" + sequence, type: seed.header.type, sequence,
        prevHash: events.at(-1)?.hash ?? "0".repeat(64), timestamp: new Date().toISOString(),
        integrity: "test-integrity", hash: sequence.toString(16).padStart(64, "0"), canonical: JSON.stringify(seed),
      } as BookPiEventRecord;
      events.push(record);
      return record;
    },
    listEvents: async () => [...events],
    verifyChain: async () => ({ valid: true, count: events.length, failures: [] }),
  };
}

function makeHarness(failedProviders: number[] = [], maxObjectBytes = 1_000_000) {
  const stores = Array.from({ length: 9 }, (_, index) => new MemoryShardStore("provider-" + index, failedProviders.includes(index)));
  const quotas = Object.fromEntries(stores.map((store) => [store.providerId, { maxBytes: 10_000_000, maxObjects: 100 }]));
  const keyManager = new MemoryKeyManager();
  const coordinator = new TerminusShardedStore({
    stores,
    quotas,
    keyManager,
    ledger: fakeLedger(),
    admissionGate: noOpAdmissionGate(),
    maxObjectBytes,
    clock: () => Date.parse("2026-10-12T12:00:00.000Z"),
  });
  return { stores, quotas, keyManager, coordinator };
}

describe("TerminusShardedStore", () => {
  it("encrypts and reconstructs with three unavailable providers", async () => {
    const { coordinator } = makeHarness([6, 7, 8]);
    const ref = await coordinator.put({ objectId: "obj-1", tenantId: "tenant-a", plaintext: "TAMV / Isabella / Terminus Ω" });
    expect(ref.degraded).toBe(true);
    expect(ref.successfulShardIndexes).toHaveLength(6);
    await expect(coordinator.getText(ref, "tenant-a")).resolves.toBe("TAMV / Isabella / Terminus Ω");
  });

  it("fails closed and removes partial shards when fewer than six writes succeed", async () => {
    const { stores, keyManager, coordinator } = makeHarness([5, 6, 7, 8]);
    await expect(coordinator.put({ objectId: "obj-fail", tenantId: "tenant-a", plaintext: "secret" }))
      .rejects.toThrow("TERMINUS_SHARD_QUORUM_NOT_MET");
    expect(stores.every((store) => store.entries.size === 0)).toBe(true);
    expect(keyManager.keys.size).toBe(0);
  });

  it("round-trips empty and short payloads with the GCM tag stored separately", async () => {
    const { coordinator } = makeHarness();
    const emptyRef = await coordinator.put({ objectId: "obj-empty", tenantId: "tenant-a", plaintext: "" });
    const shortRef = await coordinator.put({ objectId: "obj-short", tenantId: "tenant-a", plaintext: "ok" });
    expect(emptyRef.ciphertextLength).toBe(0);
    expect(emptyRef.originalLength).toBe(0);
    await expect(coordinator.getText(emptyRef, "tenant-a")).resolves.toBe("");
    await expect(coordinator.getText(shortRef, "tenant-a")).resolves.toBe("ok");
  });

  it("refuses cross-tenant reconstruction", async () => {
    const { coordinator } = makeHarness();
    const ref = await coordinator.put({ objectId: "obj-tenant", tenantId: "tenant-a", plaintext: "tenant data" });
    await expect(coordinator.get(ref, "tenant-b")).rejects.toThrow("TERMINUS_OBJECT_REFERENCE_INVALID_OR_TENANT_MISMATCH");
  });

  it("performs cryptographic erasure before reporting physical cleanup", async () => {
    const { coordinator, keyManager } = makeHarness();
    const ref = await coordinator.put({ objectId: "obj-erase", tenantId: "tenant-a", plaintext: "retained data" });
    expect(keyManager.keys.has(ref.keyId)).toBe(true);
    const result = await coordinator.erase(ref, "tenant-a");
    expect(result.cryptographicallyErased).toBe(true);
    expect(result.physicalDeletionComplete).toBe(true);
    expect(keyManager.keys.has(ref.keyId)).toBe(false);
    await expect(coordinator.getText(ref, "tenant-a")).rejects.toThrow("TERMINUS_SHARD_QUORUM_UNAVAILABLE");
  });

  it("requires nine distinct providers with explicit quota ceilings", () => {
    const stores = Array.from({ length: 9 }, () => new MemoryShardStore("same-provider"));
    const quotas = Object.fromEntries(stores.map((store) => [store.providerId, { maxBytes: 1000, maxObjects: 10 }]));
    expect(() => new TerminusShardedStore({ stores, quotas, keyManager: new MemoryKeyManager(), ledger: fakeLedger(), admissionGate: noOpAdmissionGate(), maxObjectBytes: 1000 }))
      .toThrow("TERMINUS_REQUIRES_NINE_DISTINCT_STORAGE_PROVIDERS");
  });

  it("rejects an object above the configured byte ceiling before creating a key", async () => {
    const { stores, keyManager, coordinator } = makeHarness([], 5);
    await expect(coordinator.put({ objectId: "too-large", tenantId: "tenant-a", plaintext: "123456" }))
      .rejects.toThrow("TERMINUS_OBJECT_MAX_BYTES_EXCEEDED");
    expect(keyManager.keys.size).toBe(0);
    expect(stores.every((store) => store.entries.size === 0)).toBe(true);
  });
  it("fails before key creation when durable retention admission rejects", async () => {
    const stores = Array.from({ length: 9 }, (_, index) => new MemoryShardStore("provider-" + index));
    const quotas = Object.fromEntries(stores.map((item) => [item.providerId, { maxBytes: 10_000_000, maxObjects: 10 }]));
    const keyManager = new MemoryKeyManager();
    const coordinator = new TerminusShardedStore({
      stores, quotas, keyManager, ledger: fakeLedger(), maxObjectBytes: 1000,
      admissionGate: async () => { throw new Error("TERMINUS_CAPACITY_BLOCKED"); },
    });
    await expect(coordinator.put({ objectId: "denied", tenantId: "tenant-a", plaintext: "not written" }))
      .rejects.toThrow("TERMINUS_CAPACITY_BLOCKED");
    expect(keyManager.keys.size).toBe(0);
    expect(stores.every((item) => item.entries.size === 0)).toBe(true);
  });

});
