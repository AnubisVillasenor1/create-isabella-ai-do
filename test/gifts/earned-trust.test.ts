import { describe, expect, it } from "vitest";
import { EarnedTrustLedger, type TrustOutcome } from "../../src/gifts/earned-trust";

describe("Regalo 1 — Confianza Ganada", () => {
  it("eleva la reputación con la evidencia y ensancha la vía rápida de AMARILLO a VERDE", () => {
    const ledger = new EarnedTrustLedger();
    for (let i = 0; i < 5; i += 1) ledger.record("user-1", "cap-a", "ALLOWED");
    const snapshot = ledger.snapshot("user-1", "cap-a");
    expect(snapshot.tier).toBe("TRUSTED");
    expect(snapshot.score).toBeGreaterThanOrEqual(80);

    const widened = ledger.reduceFriction("user-1", "cap-a", "YELLOW");
    expect(widened.adjusted).toBe(true);
    expect(widened.band).toBe("GREEN");
    expect(widened.reason).toBe("EARNED_TRUST_WIDENS_FAST_LANE");
  });

  it("nunca relaja ROJO ni NARANJA, aunque la confianza sea alta", () => {
    const ledger = new EarnedTrustLedger();
    for (let i = 0; i < 10; i += 1) ledger.record("user-1", "cap-a", "ALLOWED");
    const red = ledger.reduceFriction("user-1", "cap-a", "RED");
    expect(red.band).toBe("RED");
    expect(red.adjusted).toBe(false);
    expect(red.reason).toBe("RED_NEVER_RELAXED_BY_TRUST");
    const orange = ledger.reduceFriction("user-1", "cap-a", "ORANGE");
    expect(orange.band).toBe("ORANGE");
    expect(orange.reason).toBe("HIGH_RISK_NEVER_RELAXED_BY_TRUST");
  });

  it("no ensancha sin muestra suficiente y es fail-closed", () => {
    const ledger = new EarnedTrustLedger();
    const result = ledger.reduceFriction("user-nuevo", "cap-a", "YELLOW");
    expect(result.adjusted).toBe(false);
    expect(result.reason).toBe("INSUFFICIENT_EARNED_TRUST");
    expect(() => ledger.record("", "cap-a", "ALLOWED")).toThrow();
    expect(() => ledger.record("user-1", "cap-a", "NOPE" as unknown as TrustOutcome)).toThrow();
  });

  it("castiga el rechazo por encima del éxito", () => {
    const ledger = new EarnedTrustLedger();
    ledger.record("user-1", "cap-a", "ALLOWED");
    const afterSuccess = ledger.score("user-1", "cap-a");
    ledger.record("user-1", "cap-a", "DENIED");
    expect(ledger.score("user-1", "cap-a")).toBeLessThan(afterSuccess);
  });
});
