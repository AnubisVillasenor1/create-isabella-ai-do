import { describe, expect, it } from "vitest";
import { ImmutableLedger } from "../../../src/economy/revenue-fabric/immutable-ledger";
import { normalizeSettlement, type SettlementInputs } from "../../../src/economy/revenue-fabric/normalized-settlement";

const input: SettlementInputs = {
  grossAmount: 10.25,
  directCost: 1.15,
  taxAmount: 0.10,
  gatewayFee: 0.25,
  ietsInputs: { referrals: 70, revenue: 70, retention: 70, skills: 70, agents: 70, reputation: 70, age: 70, compliance: 70 },
  stream: "ISA_API",
  currency: "USD",
  idempotencyKey: "ledger-minor-units-001",
  creatorId: "creator-001",
  creatorWorkspaceId: "workspace-001",
  creatorPlan: "premium",
  creatorSubscriptionStatus: "active",
};

describe("immutable ledger integer units and restore", () => {
  it("records exact cents for decimal currency amounts", () => {
    const settlement = normalizeSettlement(input);
    const ledger = new ImmutableLedger();
    const journal = ledger.post(settlement);
    const clearing = journal.postings.find((posting) => posting.account === "GATEWAY_CLEARING" && posting.direction === "DEBIT");
    expect(clearing?.amount).toBe(1025);
    expect(journal.postings.every((posting) => Number.isSafeInteger(posting.amount))).toBe(true);
    expect(ledger.verifyChain()).toBe(true);
  });

  it("restores the chain in previous-hash order independent of input order", () => {
    const ledger = new ImmutableLedger();
    const first = ledger.post(normalizeSettlement(input));
    const second = ledger.post(normalizeSettlement({ ...input, grossAmount: 20.50, idempotencyKey: "ledger-minor-units-002" }));
    const restored = new ImmutableLedger();
    restored.restore([second, first]);
    expect(restored.verifyChain()).toBe(true);
    expect(restored.getAllJournals().map((journal) => journal.idempotencyKey)).toEqual([
      "ledger-minor-units-001",
      "ledger-minor-units-002",
    ]);
  });

  it("rejects reuse of a key with a changed amount", () => {
    const ledger = new ImmutableLedger();
    ledger.post(normalizeSettlement(input));
    expect(() => ledger.post(normalizeSettlement({ ...input, grossAmount: 11.25 }))).toThrow(
      "LEDGER_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
    );
  });
});
