import { describe, expect, it } from "vitest";
import { scoreTrust } from "../../src/gameover/trust-engine";

describe("GAME OVER TrustEngine", () => {
  it("weights all-exemplary metrics to 100 / EXEMPLARY", () => {
    const card = scoreTrust({
      integrity: 100,
      competence: 100,
      alignment: 100,
      transparency: 100,
      humanOversight: 100,
      incidentRecord: 100,
    });
    expect(card.score).toBe(100);
    expect(card.level).toBe("EXEMPLARY");
  });

  it("treats missing metrics as zero (fail-closed)", () => {
    const card = scoreTrust({});
    expect(card.score).toBe(0);
    expect(card.level).toBe("UNTRUSTED");
    expect(card.metrics.integrity).toBe(0);
  });

  it("applies the declared weights (integrity 0.30)", () => {
    const card = scoreTrust({ integrity: 100 });
    expect(card.score).toBe(30);
    expect(card.level).toBe("LOW");
  });

  it("clamps out-of-range metrics to 0..100", () => {
    const card = scoreTrust({ integrity: 150, competence: -20 });
    expect(card.metrics.integrity).toBe(100);
    expect(card.metrics.competence).toBe(0);
    expect(card.score).toBe(30);
  });
});
