import { describe, expect, it } from "vitest";
import {
  AffiliateLedger,
  EconomicLedger,
  TreasuryRuntime,
  analyzeFraudGraph,
} from "../../src/economy";

describe("SCER treasury runtime", () => {
  it("acredita, debita y mantiene saldos no negativos", () => {
    const ledger = new EconomicLedger(() => "2026-01-01T00:00:00.000Z");
    const treasury = new TreasuryRuntime(ledger);
    expect(treasury.credit("creator", 1_000n).balanceMinor).toBe("1000");
    expect(treasury.debit("creator", 400n).balanceMinor).toBe("600");
    expect(treasury.balance("creator")).toBe(600n);
    expect(ledger.size()).toBe(2);
    expect(ledger.verifyIntegrity()).toBe(true);
  });

  it("falla cerrado si el saldo es insuficiente", () => {
    const treasury = new TreasuryRuntime(new EconomicLedger(() => "t"));
    treasury.credit("p", 100n);
    expect(() => treasury.debit("p", 1_000n)).toThrow("TREASURY_INSUFFICIENT_FUNDS");
    expect(treasury.balance("p")).toBe(100n);
  });

  it("rechaza importes o partes inválidas", () => {
    const treasury = new TreasuryRuntime(new EconomicLedger(() => "t"));
    expect(() => treasury.credit("p", 0n)).toThrow("TREASURY_AMOUNT_INVALID");
    expect(() => treasury.credit("", 10n)).toThrow("TREASURY_PARTY_REQUIRED");
  });

  it("reporta un snapshot ordenado y el total", () => {
    const treasury = new TreasuryRuntime(new EconomicLedger(() => "t"));
    treasury.credit("b", 2n);
    treasury.credit("a", 1n);
    expect(Object.keys(treasury.snapshot())).toEqual(["a", "b"]);
    expect(treasury.totalMinor()).toBe(3n);
  });
});

describe("SCER affiliate network", () => {
  it("acredita comisión por basis points en una atribución limpia", () => {
    const ledger = new EconomicLedger(() => "t");
    const affiliates = new AffiliateLedger(ledger);
    affiliates.register("aff", 2_000);
    const result = affiliates.attribute({ affiliateId: "aff", orderMinor: 10_000n });
    expect(result.status).toBe("pending");
    expect(result.commissionMinor).toBe("2000");
    expect(affiliates.snapshot()).toEqual({ aff: "2000" });
    expect(ledger.verifyIntegrity()).toBe(true);
  });

  it("bloquea la comisión ante señales antifraude irreversibles", () => {
    const affiliates = new AffiliateLedger(new EconomicLedger(() => "t"));
    affiliates.register("aff", 5_000);
    const result = affiliates.attribute({ affiliateId: "aff", orderMinor: 10_000n, selfPurchase: true });
    expect(result.status).toBe("blocked");
    expect(result.commissionMinor).toBe("0");
    expect(result.verdict.decision).toBe("block");
    expect(affiliates.snapshot()).toEqual({ aff: "0" });
  });

  it("rechaza afiliados no registrados y basis points inválidos", () => {
    const affiliates = new AffiliateLedger(new EconomicLedger(() => "t"));
    expect(() => affiliates.register("x", 20_000)).toThrow();
    expect(() => affiliates.attribute({ affiliateId: "nope", orderMinor: 10n })).toThrow("AFFILIATE_NOT_REGISTERED");
  });
});

describe("SCER fraud graph", () => {
  it("no marca nada cuando no hay relaciones", () => {
    const analysis = analyzeFraudGraph([{ id: "a1", kind: "account" }], [], () => "t");
    expect(analysis.metrics.clusters).toBe(1);
    expect(analysis.verdict.decision).toBe("allow");
  });

  it("eleva a revisión cuando dos cuentas comparten dispositivo", () => {
    const analysis = analyzeFraudGraph(
      [
        { id: "a1", kind: "account" },
        { id: "a2", kind: "account" },
        { id: "d1", kind: "device" },
      ],
      [
        { from: "a1", to: "d1", relation: "shares_device" },
        { from: "a2", to: "d1", relation: "shares_device" },
      ],
    );
    expect(analysis.metrics.linkedAccounts).toBe(1);
    expect(analysis.clusters[0]?.accounts).toBe(2);
    expect(analysis.verdict.decision).toBe("review");
  });

  it("detecta reutilización de credenciales con varias cuentas en un pago", () => {
    const analysis = analyzeFraudGraph(
      [
        { id: "a1", kind: "account" },
        { id: "a2", kind: "account" },
        { id: "c1", kind: "payment" },
      ],
      [
        { from: "a1", to: "c1", relation: "shares_card" },
        { from: "a2", to: "c1", relation: "shares_card" },
      ],
    );
    expect(analysis.metrics.linkedAccounts).toBe(1);
    expect(analysis.verdict.decision).toBe("review");
  });

  it("rechaza aristas hacia entidades desconocidas", () => {
    expect(() =>
      analyzeFraudGraph([{ id: "a", kind: "account" }], [{ from: "a", to: "ghost", relation: "shares_ip" }]),
    ).toThrow("FRAUD_EDGE_UNKNOWN_ENTITY");
  });
});
