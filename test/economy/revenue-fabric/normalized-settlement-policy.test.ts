import { describe, expect, it } from "vitest";
import { normalizeSettlement, validateSettlementInvariants, type SettlementInputs } from "../../../src/economy/revenue-fabric/normalized-settlement";

const base: SettlementInputs = {
  grossAmount: 100,
  directCost: 0,
  taxAmount: 0,
  gatewayFee: 0,
  ietsInputs: { referrals: 70, revenue: 70, retention: 70, skills: 70, agents: 70, reputation: 70, age: 70, compliance: 70 },
  stream: "SKILL_MARKETPLACE",
  currency: "USD",
  idempotencyKey: "normalized-policy-001",
  creatorId: "creator-001",
  creatorWorkspaceId: "workspace-001",
  creatorPlan: "premium",
  creatorSubscriptionStatus: "active",
};

describe("normalized settlement creator policy", () => {
  it("applies the canonical 75/25 default to eligible ISA API revenue", () => {
    const result = normalizeSettlement({ ...base, stream: "ISA_API" });
    expect(result.userRate).toBe(0.75);
    expect(result.platformRate).toBe(0.25);
    expect(result.platformShare).toBe(24.25);
    expect(result.platformPhoenixFund).toBe(4.85);
    expect(result.platformInfrastructure).toBe(7.27);
    expect(result.platformDao).toBe(12.13);
    expect(Math.round((result.platformPhoenixFund + result.platformInfrastructure + result.platformDao) * 100)).toBe(Math.round(result.platformShare * 100));
    expect(result.creatorEligible).toBe(true);
    expect(result.creatorId).toBe("creator-001");
    expect(() => validateSettlementInvariants(result)).not.toThrow();
  });

  it("caps IETS tier shares at 80% and never exceeds the policy ceiling", () => {
    const result = normalizeSettlement(base);
    expect(result.userRate).toBe(0.8);
    expect(result.platformRate).toBe(0.2);
    expect(result.userRate).toBeLessThanOrEqual(0.8);
    expect(() => validateSettlementInvariants(result)).not.toThrow();
  });

  it.each([
    ["free", "active"],
    ["premium", "trialing"],
    ["premium", "past_due"],
    ["premium", "canceled"],
  ] as const)("blocks creator share for %s / %s", (creatorPlan, creatorSubscriptionStatus) => {
    const result = normalizeSettlement({ ...base, creatorPlan, creatorSubscriptionStatus });
    expect(result.creatorEligible).toBe(false);
    expect(result.creatorId).toBeUndefined();
    expect(result.userRate).toBe(0);
    expect(result.platformRate).toBe(1);
    expect(result.userShare).toBe(0);
    expect(result.platformShare).toBe(result.distributablePool);
    expect(() => validateSettlementInvariants(result)).not.toThrow();
  });

  it("keeps subscription revenue platform-only even when a creator is attached", () => {
    const result = normalizeSettlement({ ...base, stream: "SUBSCRIPTION" });
    expect(result.creatorEligible).toBe(false);
    expect(result.userRate).toBe(0);
    expect(result.platformRate).toBe(1);
  });

  it("requires consent and licence evidence for Data Vault creator revenue", () => {
    expect(() => normalizeSettlement({ ...base, stream: "DATA_VAULT" })).toThrow("SETTLEMENT_DATA_VAULT_EVIDENCE_REQUIRED");
    expect(() => normalizeSettlement({
      ...base, stream: "DATA_VAULT", consentEvidenceRef: "consent-001", dataLicenceEvidenceRef: "licence-001", dataVaultCreatorRateBps: 9000,
    })).toThrow("SETTLEMENT_DATA_VAULT_CREATOR_RATE_OUT_OF_POLICY");
  });
});
