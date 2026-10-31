import { describe, expect, it } from "vitest";
import { InMemoryBookPiLedger } from "../../src/bookpi/ledger";

describe("BookPI in-memory hash chain", () => {
  it("starts empty without claiming WORM or durable storage", () => {
    const ledger = new InMemoryBookPiLedger();
    expect(ledger.verify()).toMatchObject({
      status: "EMPTY_CHAIN", valid: true, blocksValidated: 0, chainHead: null,
      storage: "VOLATILE_IN_MEMORY", wormEnforced: false, durable: false,
    });
  });

  it("hashes and links appended events deterministically", () => {
    const ledger = new InMemoryBookPiLedger();
    const first = ledger.append({
      id: "evt-1", timestamp: "2026-10-09T00:00:00.000Z", type: "TEST",
      methodId: "test.method", principal: "test:principal", riskTier: "LOW", status: "RECORDED",
    });
    const second = ledger.append({
      id: "evt-2", timestamp: "2026-10-09T00:00:01.000Z", type: "TEST",
      methodId: "test.method", principal: "test:principal", riskTier: "LOW", status: "RECORDED",
    });
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.previousHash).toBe(first.hash);
    expect(ledger.verify()).toMatchObject({ status: "VERIFIED_IN_MEMORY_CHAIN", valid: true, blocksValidated: 2, wormEnforced: false });
  });

  it("does not expose mutable internal event objects", () => {
    const ledger = new InMemoryBookPiLedger();
    const event = ledger.append({
      id: "evt-1", timestamp: "2026-10-09T00:00:00.000Z", type: "TEST",
      methodId: "test.method", principal: "test:principal", riskTier: "LOW", status: "RECORDED",
    });
    (event as { status: string }).status = "TAMPERED";
    expect(ledger.verify().valid).toBe(true);
    expect(ledger.list()[0]?.status).toBe("RECORDED");
  });
});
