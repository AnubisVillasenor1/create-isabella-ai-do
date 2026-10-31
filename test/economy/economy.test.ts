import { describe, expect, it } from "vitest";
import {
  EconomicLedger,
  ROYALTY_TOTAL_BASIS_POINTS,
  VALUATION_UNIT_MINOR,
  planRoyaltyDistribution,
  quotePrice,
  valuateAsset,
  type RoyaltyParty,
} from "../../src/economy";

describe("SCER cognitive asset valuation", () => {
  it("valúa un activo perfecto al valor unitario máximo", () => {
    const valuation = valuateAsset({ quality: 100, demand: 100, scarcity: 100, evidenceCoverage: 100 });
    expect(valuation.score).toBe(100);
    expect(valuation.baseValueMinor).toBe(VALUATION_UNIT_MINOR);
    expect(valuation.confidence).toBe(1);
  });

  it("valúa un activo nulo en cero", () => {
    const valuation = valuateAsset({ quality: 0, demand: 0, scarcity: 0, evidenceCoverage: 0 });
    expect(valuation.score).toBe(0);
    expect(valuation.baseValueMinor).toBe(0);
    expect(valuation.confidence).toBe(0);
  });

  it("es determinista y pondera las señales", () => {
    const signals = { quality: 100, demand: 0, scarcity: 0, evidenceCoverage: 0 };
    const first = valuateAsset(signals);
    const second = valuateAsset(signals);
    expect(second).toEqual(first);
    expect(first.score).toBeCloseTo(0.35 * 100, 5);
    expect(first.baseValueMinor).toBe(Math.round(0.35 * VALUATION_UNIT_MINOR));
  });

  it("rechaza señales fuera de rango o no finitas", () => {
    expect(() => valuateAsset({ quality: 101, demand: 0, scarcity: 0, evidenceCoverage: 0 })).toThrow();
    expect(() => valuateAsset({ quality: -1, demand: 0, scarcity: 0, evidenceCoverage: 0 })).toThrow();
    expect(() =>
      valuateAsset({ quality: Number.NaN, demand: 0, scarcity: 0, evidenceCoverage: 0 }),
    ).toThrow();
  });
});

describe("SCER dynamic pricing", () => {
  it("cotiza el precio base cuando todos los factores son 1", () => {
    const quote = quotePrice({ basePriceMinor: 5_000 });
    expect(quote.finalPriceMinor).toBe(5_000);
    expect(quote.discount).toBe(0);
    expect(quote.breakdown.every((factor) => factor.applied === false)).toBe(true);
  });

  it("aplica y limita los multiplicadores", () => {
    const quote = quotePrice({ basePriceMinor: 1_000, demandMultiplier: 99, scarcityMultiplier: 5 });
    expect(quote.finalPriceMinor).toBe(1_000 * 2.5 * 5);
    const demand = quote.breakdown.find((factor) => factor.factor === "demand");
    expect(demand?.value).toBe(2.5);
    expect(demand?.max).toBe(2.5);
  });

  it("limita el descuento de fidelidad a 0.5", () => {
    const quote = quotePrice({ basePriceMinor: 1_000, loyaltyDiscount: 0.9 });
    expect(quote.discount).toBe(0.5);
    expect(quote.finalPriceMinor).toBe(500);
  });

  it("nunca produce precios negativos y rechaza bases inválidas", () => {
    expect(quotePrice({ basePriceMinor: 0 }).finalPriceMinor).toBe(0);
    expect(() => quotePrice({ basePriceMinor: -1 })).toThrow();
    expect(() => quotePrice({ basePriceMinor: 1.5 })).toThrow();
  });
});

const party = (partyId: string, role: RoyaltyParty["role"], basisPoints: number): RoyaltyParty => ({
  partyId,
  role,
  basisPoints,
});

describe("SCER royalty distribution", () => {
  it("reparte exactamente el total sin pérdida por redondeo", () => {
    const plan = planRoyaltyDistribution(100n, [
      party("creator", "creator", 3_334),
      party("affiliate", "affiliate", 3_333),
      party("platform", "platform", 3_333),
    ]);
    const sum = plan.shares.reduce((acc, share) => acc + BigInt(share.amountMinor), 0n);
    expect(sum).toBe(100n);
    expect(plan.distributedMinor).toBe("100");
    expect(plan.shares[0]?.amountMinor).toBe("34");
  });

  it("respeta una división simple por basis points", () => {
    const plan = planRoyaltyDistribution(1_000n, [
      party("a", "creator", 7_000),
      party("b", "platform", 3_000),
    ]);
    expect(plan.shares).toEqual([
      { partyId: "a", role: "creator", basisPoints: 7_000, amountMinor: "700" },
      { partyId: "b", role: "platform", basisPoints: 3_000, amountMinor: "300" },
    ]);
  });

  it("exige que los basis points sumen 10000", () => {
    expect(ROYALTY_TOTAL_BASIS_POINTS).toBe(10_000);
    expect(() => planRoyaltyDistribution(100n, [party("a", "creator", 5_000)])).toThrow();
  });

  it("rechaza partes duplicadas o con rol desconocido", () => {
    expect(() =>
      planRoyaltyDistribution(100n, [party("a", "creator", 5_000), party("a", "platform", 5_000)]),
    ).toThrow();
    expect(() => planRoyaltyDistribution(100n, [party("a", "wizard" as never, 10_000)])).toThrow();
  });
});

describe("SCER economic ledger", () => {
  it("encadena asientos y verifica integridad", () => {
    const ledger = new EconomicLedger(() => "2026-01-01T00:00:00.000Z");
    const first = ledger.append({ kind: "valuation", payload: { score: 42 } });
    const second = ledger.append({ kind: "settlement.computed", payload: { total: "100" } });
    expect(ledger.size()).toBe(2);
    expect(second.previousHash).toBe(first.hash);
    expect(first.previousHash).toBe("GENESIS");
    expect(ledger.verifyIntegrity()).toBe(true);
    expect(ledger.head()?.sequence).toBe(1);
  });

  it("canonicaliza payloads (orden de claves irrelevante)", () => {
    const ledger = new EconomicLedger(() => "2026-01-01T00:00:00.000Z");
    const a = ledger.append({ kind: "pricing.quote", payload: { x: 1, y: 2 } });
    const b = ledger.append({ kind: "pricing.quote", payload: { y: 2, x: 1 } });
    expect(a.payloadHash).toBe(b.payloadHash);
  });
});
