import { describe, expect, it } from "vitest";
import { InMemoryBookPiLedger } from "../../src/bookpi/ledger";
import { createAuditService } from "../../src/gameover/audit";

describe("GAME OVER AuditService", () => {
  it("appends decisions to the ledger and exposes a hash + sequence", () => {
    const ledger = new InMemoryBookPiLedger();
    const audit = createAuditService({ ledger, idFactory: () => "evt-1", now: () => new Date("2026-01-01T00:00:00.000Z") });
    const entry = audit.record({ principal: "agent-1", riskTier: "LOW", status: "GOVERNANCE_ACCEPT" });
    expect(entry.sequence).toBe(1);
    expect(entry.hash).toHaveLength(64);
    expect(entry.type).toBe("gameover.governance.decision");
  });

  it("keeps a bounded in-memory view and reads ledger status", () => {
    const ledger = new InMemoryBookPiLedger();
    const audit = createAuditService({ ledger });
    audit.record({ principal: "a", riskTier: "LOW", status: "GOVERNANCE_ACCEPT" });
    audit.record({ principal: "b", riskTier: "HIGH", status: "GOVERNANCE_REJECT" });
    expect(audit.list().length).toBe(2);
    expect(audit.list(1).length).toBe(1);
    const snapshot = audit.snapshot();
    expect(snapshot.valid).toBe(true);
    expect(snapshot.count).toBe(2);
  });
});
