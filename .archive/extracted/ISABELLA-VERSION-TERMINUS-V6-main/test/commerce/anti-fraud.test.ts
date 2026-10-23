import { describe, expect, it } from "vitest";
import { assessFraud } from "../../src/commerce/anti-fraud";

describe("commerce/anti-fraud", () => {
  it("permite cuando no hay señales", () => {
    const verdict = assessFraud({});
    expect(verdict.decision).toBe("allow");
    expect(verdict.level).toBe("low");
    expect(verdict.signals).toHaveLength(0);
  });

  it("bloquea self-purchase (compra propia del afiliado)", () => {
    const verdict = assessFraud({ selfPurchase: true });
    expect(verdict.decision).toBe("block");
    expect(verdict.level).toBe("high");
    expect(verdict.signals.some((s) => s.name === "SELF_PURCHASE")).toBe(true);
  });

  it("bloquea conversión duplicada", () => {
    const verdict = assessFraud({ duplicateConversion: true });
    expect(verdict.decision).toBe("block");
  });

  it("sube a crítico cuando conviven bloqueo y señales de revisión", () => {
    const verdict = assessFraud({ selfPurchase: true, regionChange: true, highRetryRate: true });
    expect(verdict.decision).toBe("block");
    expect(verdict.level).toBe("critical");
  });

  it("solo eleva a revisión con señales ambientes (no decisión irreversible)", () => {
    const verdict = assessFraud({ anomalousTraffic: true, regionChange: true });
    expect(verdict.decision).toBe("review");
    expect(verdict.level).toBe("medium");
  });

  it("una señal única genera revisión baja", () => {
    const verdict = assessFraud({ credentialReuse: true });
    expect(verdict.decision).toBe("review");
    expect(verdict.level).toBe("low");
  });

  it("las señales de revisión nunca bloquean por sí solas", () => {
    const verdict = assessFraud({ missingConsent: true, duplicatedLead: true, highCancellationRate: true });
    expect(verdict.decision).toBe("review");
    expect(verdict.level).toBe("medium");
  });
});