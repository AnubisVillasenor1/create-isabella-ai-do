import { describe, expect, it } from "vitest";
import {
  aov,
  applyRefund,
  cac,
  confidenceLevel,
  conversionRate,
  createRevenueSummary,
  marginContribution,
  metric,
  refundRate,
} from "../../src/commerce/revenue";

describe("commerce/revenue", () => {
  const MXN = "MXN";

  it("calcula el ingreso neto confirmado", () => {
    const summary = createRevenueSummary({
      grossConfirmed: 1000,
      fees: 100,
      refunds: 50,
      variableCost: 150,
      currency: MXN,
    });
    expect(summary.netConfirmed).toBe(700);
    expect(summary.refunds).toBe(50);
  });

  it("impide deducciones que superen el bruto", () => {
    expect(() =>
      createRevenueSummary({ grossConfirmed: 100, fees: 60, refunds: 60, variableCost: 0, currency: MXN }),
    ).toThrow(/deducciones/);
  });

  it("rechaza importes no finitos o negativos", () => {
    expect(() =>
      createRevenueSummary({ grossConfirmed: -1, fees: 0, refunds: 0, variableCost: 0, currency: MXN }),
    ).toThrow(/finitos/);
  });

  it("un reembolso actualiza el neto, no duplica ventas", () => {
    const summary = createRevenueSummary({ grossConfirmed: 500, fees: 50, refunds: 0, variableCost: 0, currency: MXN });
    const updated = applyRefund(summary, 120);
    expect(updated.netConfirmed).toBe(330);
    expect(updated.grossConfirmed).toBe(500);
  });

  it("calcula tasas y razones con guardas de cero", () => {
    expect(conversionRate(10, 100)).toBe(0.1);
    expect(conversionRate(10, 0)).toBe(0);
    expect(cac(1000, 5)).toBe(200);
    expect(cac(1000, 0)).toBe(0);
    expect(aov(3000, 10)).toBe(300);
    expect(aov(3000, 0)).toBe(0);
    expect(refundRate(5, 50)).toBe(0.1);
    expect(marginContribution(700, 1000)).toBe(0.7);
  });

  it("fija niveles de confianza por observaciones", () => {
    expect(confidenceLevel(5)).toBe("low");
    expect(confidenceLevel(50)).toBe("medium");
    expect(confidenceLevel(120)).toBe("high");
    expect(confidenceLevel(120, true)).toBe("medium");
  });

  it("empaqueta métricas con fecha y confianza", () => {
    const m = metric("net_revenue", 700, 5000);
    expect(m.confidence).toBe("high");
    expect(m.name).toBe("net_revenue");
    expect(m.updatedAt).toBeTruthy();
  });
});