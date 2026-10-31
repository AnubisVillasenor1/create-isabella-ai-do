import { describe, expect, it } from "vitest";
import {
  IsabellaEconomicTrustScore,
  IsabellaSovereignRevenueFabric,
  type IETSComponents,
  type SettlementInput,
} from "../../src/economy/sovereign-revenue-fabric";

const components = (score: number): IETSComponents => ({
  referrals: score,
  revenue: score,
  retention: score,
  skills: score,
  agents: score,
  reputation: score,
  age: score,
  compliance: score,
});

const eliteSettlement: SettlementInput = {
  idempotencyKey: "settlement-001",
  revenueStream: "SKILL_MARKETPLACE",
  currency: "MXN",
  grossAmount: "10000.00",
  directCost: "500.00",
  taxAmount: "1600.00",
  gatewayFee: "350.00",
  creatorId: "creator-001",
  creatorPlan: "premium",
  creatorSubscriptionStatus: "active",
  ietsComponents: components(70),
  pspSettlementRef: "psp-settlement-001",
  taxEvidenceRef: "tax-determination-001",
};

describe("Isabella Sovereign Revenue Fabric v5", () => {
  it("calculates the weighted IETS score and tier deterministically", () => {
    expect(IsabellaEconomicTrustScore.calculate(components(70))).toMatchObject({
      score: 70,
      tier: "ELITE",
      policyVersion: "iets-v5.0.0",
    });
    expect(() => IsabellaEconomicTrustScore.calculate({ ...components(50), compliance: 101 })).toThrow();
    expect(() => IsabellaEconomicTrustScore.calculate({ ...components(50), referrals: 1.5 })).toThrow();
  });

  it("settles exact decimal amounts and balances the double-entry allocation journal", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    const result = fabric.settle(eliteSettlement);
    expect(result.operatingIncome).toBe("7550.00");
    expect(result.emergencyVault).toBe("75.50");
    expect(result.innovationVault).toBe("75.50");
    expect(result.treasuryVault).toBe("75.50");
    expect(result.distributablePool).toBe("7323.50");
    expect(result.creatorShare).toBe("5858.80");
    expect(result.platformShare).toBe("1464.70");
    expect(result.platformPhoenixFund).toBe("292.94");
    expect(result.platformInfrastructure).toBe("439.41");
    expect(result.platformDao).toBe("732.35");
    expect(Number(result.platformPhoenixFund) + Number(result.platformInfrastructure) + Number(result.platformDao)).toBe(Number(result.platformShare));
    expect(result.creatorRateBps + result.platformRateBps).toBe(10_000);
    expect(result.journal.debitTotalMinor).toBe("1000000");
    expect(result.journal.creditTotalMinor).toBe("1000000");
    expect(result.fundsMoved).toBe(false);
    expect(fabric.verifyLedgerIntegrity().valid).toBe(true);
  });

  it("applies the 75/25 ISA API split and keeps platform-only streams at 100%", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    const api = fabric.settle({
      ...eliteSettlement,
      idempotencyKey: "api-001",
      revenueStream: "ISA_API",
    });
    expect(api.creatorRateBps).toBe(7500);
    expect(api.platformRateBps).toBe(2500);

    const subscription = fabric.settle({
      idempotencyKey: "subscription-001",
      revenueStream: "SUBSCRIPTION",
      currency: "MXN",
      grossAmount: "100.00",
      directCost: "0.00",
      taxAmount: "0.00",
      gatewayFee: "0.00",
    });
    expect(subscription.creatorRateBps).toBe(0);
    expect(subscription.platformShare).toBe(subscription.distributablePool);
    expect(fabric.verifyLedgerIntegrity()).toMatchObject({ valid: true, journalCount: 2 });
  });

  it("blocks creator revenue for free, trialing and past-due accounts", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    const ineligible = fabric.settle({
      ...eliteSettlement,
      idempotencyKey: "free-creator-001",
      creatorPlan: "free",
      creatorSubscriptionStatus: "active",
    });
    expect(ineligible.creatorRateBps).toBe(0);
    expect(ineligible.creatorShare).toBe("0.00");
    expect(ineligible.platformShare).toBe(ineligible.distributablePool);

    const trialing = fabric.settle({
      ...eliteSettlement,
      idempotencyKey: "trial-creator-001",
      creatorSubscriptionStatus: "trialing",
    });
    expect(trialing.creatorRateBps).toBe(0);
    expect(trialing.creatorShare).toBe("0.00");

    expect(() => fabric.settle({
      ...eliteSettlement,
      idempotencyKey: "missing-eligibility-001",
      creatorSubscriptionStatus: undefined,
    })).toThrow("REVENUE_CREATOR_ELIGIBILITY_REQUIRED");
  });

  it("is idempotent for equal payloads and rejects key reuse with different amounts", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    const first = fabric.settle(eliteSettlement);
    const repeated = fabric.settle(eliteSettlement);
    expect(repeated).toBe(first);
    expect(fabric.journalsSnapshot()).toHaveLength(1);
    expect(() => fabric.settle({ ...eliteSettlement, grossAmount: "10001.00" })).toThrow(
      "REVENUE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
    );
    expect(fabric.journalsSnapshot()).toHaveLength(1);
  });

  it("fails closed when deductions exceed gross or evidence references are missing", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    expect(() => fabric.settle({ ...eliteSettlement, directCost: "9000.00" })).toThrow(
      "REVENUE_DEDUCTIONS_EXCEED_GROSS",
    );
    expect(() => fabric.settle({ ...eliteSettlement, idempotencyKey: "no-psp-ref", pspSettlementRef: "" })).toThrow(
      "REVENUE_PSP_SETTLEMENT_REF_INVALID",
    );
    expect(() => fabric.settle({ ...eliteSettlement, idempotencyKey: "bad-decimal", grossAmount: "10.999" })).toThrow();
    expect(fabric.journalsSnapshot()).toHaveLength(0);
  });

  it("requires consent and licence evidence for Data Vault settlements", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    expect(() => fabric.settle({
      idempotencyKey: "data-vault-missing-evidence",
      revenueStream: "DATA_VAULT",
      currency: "MXN",
      grossAmount: "100.00",
      directCost: "0.00",
      taxAmount: "0.00",
      gatewayFee: "0.00",
      dataVaultCreatorRateBps: 5000,
    })).toThrow("REVENUE_CONSENT_EVIDENCE_REF_INVALID");
    const result = fabric.settle({
      idempotencyKey: "data-vault-with-evidence",
      revenueStream: "DATA_VAULT",
      currency: "MXN",
      grossAmount: "100.00",
      directCost: "0.00",
      taxAmount: "0.00",
      gatewayFee: "0.00",
      creatorId: "dataset-owner",
      creatorPlan: "premium",
      creatorSubscriptionStatus: "active",
      dataVaultCreatorRateBps: 5000,
      consentEvidenceRef: "consent-record-1",
      dataLicenceEvidenceRef: "licence-record-1",
    });
    expect(result.creatorRateBps).toBe(5000);
  });

  it("verifies the hash chain across multiple distinct settlements", () => {
    const fabric = new IsabellaSovereignRevenueFabric();
    fabric.settle(eliteSettlement);
    fabric.settle({ ...eliteSettlement, idempotencyKey: "settlement-002", grossAmount: "200.00", directCost: "10.00", taxAmount: "0.00", gatewayFee: "0.00", taxEvidenceRef: undefined, pspSettlementRef: undefined });
    expect(fabric.verifyLedgerIntegrity()).toMatchObject({ valid: true, journalCount: 2 });
  });
});
