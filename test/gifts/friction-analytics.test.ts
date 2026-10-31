import { describe, expect, it } from "vitest";
import { FrictionAnalytics, analyzeFriction } from "../../src/gifts/friction-analytics";

describe("Regalo 9 — Analítica de Fricción", () => {
  it("declara saludable un flujo con sobre-bloqueo bajo", () => {
    const report = analyzeFriction([
      { band: "GREEN", admitted: true },
      { band: "GREEN", admitted: true },
      { band: "RED", admitted: false },
    ]);
    expect(report.verdict).toBe("HEALTHY");
    expect(report.blockRate).toBeCloseTo(0.3333, 3);
  });

  it("detecta flujos VERDES bloqueados por mala configuración", () => {
    const report = analyzeFriction([{ band: "GREEN", admitted: false }]);
    expect(report.verdict).toBe("MISCONFIGURED");
    expect(report.greenBlocked).toBe(1);
  });

  it("detecta sobre-bloqueo cuando la tasa supera el máximo", () => {
    const report = analyzeFriction(
      [
        { band: "YELLOW", admitted: false },
        { band: "YELLOW", admitted: false },
        { band: "GREEN", admitted: true },
      ],
      { maxBlockRate: 0.5 },
    );
    expect(report.verdict).toBe("OVER_BLOCKING");
  });

  it("acumula decisiones incrementalmente", () => {
    const analytics = new FrictionAnalytics();
    analytics.record({ band: "GREEN", admitted: true });
    analytics.record({ band: "RED", admitted: false });
    expect(analytics.size()).toBe(2);
    expect(analytics.report().total).toBe(2);
  });
});
