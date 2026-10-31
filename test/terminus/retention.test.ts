import { describe, expect, it } from "vitest";
import { checkWriteCapacity, createRetentionAdmissionGate, planRetention, runRetentionSweep, type RetentionObject, type RetentionPolicy } from "../../src/terminus/retention";

const now = Date.parse("2026-10-12T12:00:00.000Z");
const policy: RetentionPolicy = {
  version: "retention-v1", maxObjects: 3, maxBytes: 100, maxAgeMs: 5000, minimumAgeMs: 1000, batchSize: 10,
};

function item(id: string, ageMs: number, extras: Partial<RetentionObject> = {}): RetentionObject {
  return { id, createdAt: new Date(now - ageMs).toISOString(), byteLength: 10, ...extras };
}

describe("BookPI bounded retention", () => {
  it("reports the exact projected count and bytes when capacity is available", () => {
    const current = [item("existing", 100)];
    expect(checkWriteCapacity(current, 12, {
      ...policy, maxObjects: 5, maxBytes: 1000, maxAgeMs: 100_000, minimumAgeMs: 1000,
    }, now)).toEqual({
      admitted: true,
      requiresRetentionSweep: false,
      reason: "CAPACITY_AVAILABLE",
      currentObjects: 1,
      projectedObjects: 2,
      currentBytes: 10,
      projectedBytes: 22,
      candidateIds: [],
    });
  });

  it("returns the candidate list instead of deleting during admission", () => {
    const decision = checkWriteCapacity([item("expired-a", 20_000)], 12, policy, now);
    expect(decision.reason).toBe("RETENTION_REQUIRED_BEFORE_ADMISSION");
    expect(decision.candidateIds).toEqual(["expired-a"]);
    expect(decision.admitted).toBe(false);
  });

  it("selects an eligible oldest object when the incoming object would exceed the current count cap", () => {
    const constrained = { ...policy, maxObjects: 1, maxBytes: 100, maxAgeMs: 100_000, minimumAgeMs: 1000 };
    const decision = checkWriteCapacity([item("eligible-old", 5000)], 10, constrained, now);
    expect(decision).toMatchObject({
      admitted: false,
      requiresRetentionSweep: true,
      reason: "RETENTION_REQUIRED_BEFORE_ADMISSION",
      candidateIds: ["eligible-old"],
      projectedObjects: 1,
      projectedBytes: 10,
    });
  });

  it("rejects projected byte overflow", () => {
    const oversized = { ...policy, maxObjects: 10, maxBytes: Number.MAX_SAFE_INTEGER, maxAgeMs: 100_000, minimumAgeMs: 100_000 };
    expect(() => checkWriteCapacity([item("near-limit", 100, { byteLength: Number.MAX_SAFE_INTEGER - 3 })], 10, oversized, now))
      .toThrow("BOOKPI_PROJECTED_BYTES_OVERFLOW");
  });


  it("prunes expired/oldest eligible payloads while protecting legal holds", () => {
    const objects = [
      item("expired-old", 20_000),
      item("expired-mid", 8_000),
      item("recent", 500),
      item("hold", 20_000, { legalHold: true }),
    ];
    const plan = planRetention(objects, policy, now);
    expect(plan.candidates.map((candidate) => candidate.id)).toEqual(["expired-old", "expired-mid"]);
    expect(plan.capacitySatisfied).toBe(true);
    expect(plan.candidates.some((candidate) => candidate.id === "hold")).toBe(false);
  });

  it("blocks writes at the hard object ceiling until an audited sweep is completed", () => {
    const fullPolicy = { ...policy, maxObjects: 1, maxBytes: 100, maxAgeMs: 100_000, minimumAgeMs: 100_000 };
    const decision = checkWriteCapacity([item("only", 100)], 10, fullPolicy, now);
    expect(decision.admitted).toBe(false);
    expect(decision.reason).toBe("CAPACITY_BLOCKED");
  });

  it("does not delete anything when the immutable-ledger intent append fails", async () => {
    let deleteCount = 0;
    const repository = {
      listObjects: async () => [item("expired", 50_000)],
      erasePayload: async () => { deleteCount += 1; return { physicalDeletionComplete: true }; },
    };
    const audit = { append: async () => { throw new Error("ledger unavailable"); } };
    await expect(runRetentionSweep(repository, audit, policy, now)).rejects.toThrow("ledger unavailable");
    expect(deleteCount).toBe(0);
  });

  it("records request and completion around payload deletion", async () => {
    const auditEvents: string[] = [];
    const deleted: string[] = [];
    const repository = {
      listObjects: async () => [item("expired", 50_000)],
      erasePayload: async (id: string) => { deleted.push(id); return { physicalDeletionComplete: true }; },
    };
    const audit = { append: async (type: string) => { auditEvents.push(type); } };
    const result = await runRetentionSweep(repository, audit, policy, now);
    expect(result.erased).toEqual(["expired"]);
    expect(deleted).toEqual(["expired"]);
    expect(auditEvents).toEqual(["bookpi.retention.requested", "bookpi.retention.completed"]);
  });

  it("audits and erases an eligible payload when the incoming object alone would exceed capacity", async () => {
    const objects = [item("eligible-old", 5000)];
    const auditEvents: string[] = [];
    const erased: string[] = [];
    const reserved: string[] = [];
    const repository = {
      listObjects: async () => [...objects],
      erasePayload: async (id: string) => {
        erased.push(id);
        objects.splice(objects.findIndex((candidate) => candidate.id === id), 1);
        return { physicalDeletionComplete: true };
      },
      reserveAdmission: async (request: { id: string; tenantFingerprint: string; byteLength: number }) => {
        reserved.push(request.id);
        return { commit: async () => {}, release: async () => {} };
      },
    };
    const audit = { append: async (type: string) => { auditEvents.push(type); } };
    const gatePolicy = { ...policy, maxObjects: 1, maxBytes: 100, maxAgeMs: 100_000, minimumAgeMs: 1000, batchSize: 5 };
    const gate = createRetentionAdmissionGate(repository, audit, gatePolicy, () => now);
    const reservation = await gate({ id: "new-object", tenantFingerprint: "tenant-hash", byteLength: 20 });
    expect(erased).toEqual(["eligible-old"]);
    expect(reserved).toEqual(["new-object"]);
    expect(auditEvents).toEqual(["bookpi.retention.requested", "bookpi.retention.completed"]);
    await reservation.release();
  });

  it("sweeps expired payloads with tenant scope before reserving new capacity", async () => {
    const objects = [item("expired", 20_000, { legalHold: false })];
    const auditEvents: string[] = [];
    const erased: string[] = [];
    const reservations: string[] = [];
    const repository = {
      listObjects: async (tenantFingerprint?: string) => {
        expect(tenantFingerprint).toBe("tenant-hash-a");
        return [...objects];
      },
      erasePayload: async (id: string, tenantFingerprint?: string) => {
        expect(tenantFingerprint).toBe("tenant-hash-a");
        erased.push(id);
        objects.splice(objects.findIndex((candidate) => candidate.id === id), 1);
        return { physicalDeletionComplete: true };
      },
      reserveAdmission: async (request: { id: string; tenantFingerprint: string; byteLength: number }) => {
        reservations.push(request.id);
        return { commit: async () => {}, release: async () => {} };
      },
    };
    const audit = { append: async (type: string) => { auditEvents.push(type); } };
    const gate = createRetentionAdmissionGate(repository, audit, {
      ...policy, maxObjects: 3, maxBytes: 100, maxAgeMs: 5000, minimumAgeMs: 1000, batchSize: 5,
    }, () => now);
    const reservation = await gate({ id: "new-object", tenantFingerprint: "tenant-hash-a", byteLength: 10 });
    expect(erased).toEqual(["expired"]);
    expect(reservations).toEqual(["new-object"]);
    expect(auditEvents).toEqual(["bookpi.retention.requested", "bookpi.retention.completed"]);
    await reservation.release();
  });

  it("fails closed when the repository has no atomic durable reservation", async () => {
    const repository = { listObjects: async () => [], erasePayload: async () => ({ physicalDeletionComplete: true }) };
    const gate = createRetentionAdmissionGate(repository, { append: async () => {} }, policy, () => now);
    await expect(gate({ id: "new", tenantFingerprint: "tenant-hash", byteLength: 10 }))
      .rejects.toThrow("TERMINUS_ATOMIC_ADMISSION_RESERVATION_REQUIRED");
  });

  it("does not admit the object when capacity remains blocked after retention", async () => {
    const objects = [item("held", 50_000, { legalHold: true })];
    const repository = {
      listObjects: async () => [...objects],
      erasePayload: async () => ({ physicalDeletionComplete: true }),
      reserveAdmission: async () => ({ commit: async () => {}, release: async () => {} }),
    };
    const gate = createRetentionAdmissionGate(repository, { append: async () => {} }, {
      ...policy, maxObjects: 1, maxBytes: 100, maxAgeMs: 100_000, minimumAgeMs: 100_000,
    }, () => now);
    await expect(gate({ id: "new", tenantFingerprint: "tenant-hash", byteLength: 10 }))
      .rejects.toThrow("TERMINUS_CAPACITY_BLOCKED");
  });

});
