import { describe, expect, it } from "vitest";
import { createOsirisSentinel, type OsirisAuditLedger } from "../../src/osiris/sentinel";

class FakeLedger implements OsirisAuditLedger {
  readonly entries: Array<Record<string, string>> = [];
  append(input: Record<string, string>) {
    this.entries.push(input);
    return { hash: `h${this.entries.length}`, sequence: this.entries.length };
  }
  verify() {
    return {
      valid: true,
      blocksValidated: this.entries.length,
      chainHead: this.entries.length === 0 ? null : `h${this.entries.length}`,
      storage: "FAKE_IN_MEMORY",
      durable: false,
    };
  }
}

const signal = {
  id: "sig-001",
  timestamp: "2026-10-11T12:00:00.000Z",
  source: "http",
  actorId: "human:analyst",
  features: { failedAuthAttempts: 12 },
};

describe("OSIRIS sentinel", () => {
  it("inspects a signal, returns an advisory result and records one audit event", () => {
    const ledger = new FakeLedger();
    const sentinel = createOsirisSentinel({ ledger });
    const result = sentinel.inspect(signal);
    expect(result.findings.some((f) => f.category === "credential_abuse")).toBe(true);
    expect(result.recommendation).toBe("REVIEW");
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]?.type).toBe("osiris.detection");
    expect(ledger.entries[0]?.methodId).toContain("OSIRIS");
    expect(ledger.entries[0]?.riskTier).toBe("HIGH");
  });

  it("accumulates metrics and exposes them in a snapshot", () => {
    const ledger = new FakeLedger();
    const sentinel = createOsirisSentinel({ ledger, now: () => new Date("2026-10-11T12:00:00.000Z") });
    sentinel.inspect(signal);
    sentinel.inspect({ ...signal, id: "sig-002", features: { requestRatePerMinute: 5 } });
    const snapshot = sentinel.getSnapshot();
    expect(snapshot.module).toBe("OSIRIS");
    expect(snapshot.metrics.signalsInspected).toBe(2);
    expect(snapshot.metrics.findingsBySeverity.high).toBeGreaterThanOrEqual(1);
    expect(snapshot.metrics.lastSignalAt).toBe("2026-10-11T12:00:00.000Z");
  });

  it("reflects ledger verification and injected posture in the snapshot", () => {
    const ledger = new FakeLedger();
    const sentinel = createOsirisSentinel({ ledger, posture: () => ({ pqcAvailable: true }) });
    sentinel.inspect(signal);
    const snapshot = sentinel.getSnapshot();
    expect(snapshot.ledger.count).toBe(1);
    expect(snapshot.ledger.valid).toBe(true);
    expect(snapshot.ledger.storage).toBe("FAKE_IN_MEMORY");
    expect(snapshot.posture.controls.find((c) => c.control === "post_quantum_readiness")?.state).toBe("active");
    expect(snapshot.disclaimer).toMatch(/does not block/);
  });

  it("rejects malformed signals without recording", () => {
    const ledger = new FakeLedger();
    const sentinel = createOsirisSentinel({ ledger });
    expect(() => sentinel.inspect({ ...signal, timestamp: "yesterday" })).toThrow(/timestamp/);
    expect(() => sentinel.inspect({ ...signal, id: "  " })).toThrow(/id/);
    expect(ledger.entries).toHaveLength(0);
  });

  it("bounds the findings history", () => {
    const ledger = new FakeLedger();
    const sentinel = createOsirisSentinel({ ledger, historyLimit: 2 });
    sentinel.inspect(signal);
    sentinel.inspect({ ...signal, id: "sig-002" });
    sentinel.inspect({ ...signal, id: "sig-003" });
    expect(sentinel.listFindings()).toHaveLength(2);
    expect(sentinel.listFindings(1)).toHaveLength(1);
  });
});
