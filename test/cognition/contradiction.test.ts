import { describe, expect, it } from "vitest";
import { detectContradictions, type CanonicalClaim } from "../../src/cognition/contradiction";

const claim = (over: Partial<CanonicalClaim> & Pick<CanonicalClaim, "claimId">): CanonicalClaim => ({
  subject: "montaña",
  relation: "altura",
  object: "3000m",
  ...over,
});

describe("contradiction engine", () => {
  it("detects opposite polarity on the same fact", () => {
    const report = detectContradictions([
      claim({ claimId: "a", polarity: "affirm" }),
      claim({ claimId: "b", polarity: "deny" }),
    ]);
    expect(report.count).toBe(1);
    expect(report.consistent).toBe(false);
    expect(report.unresolved).toBe(1);
    expect(report.contradictions[0]).toMatchObject({ left: "a", right: "b", reason: "opposite_polarity", resolution: "UNRESOLVED" });
  });

  it("resolves by trust tier when sources differ", () => {
    const report = detectContradictions([
      claim({ claimId: "weak", polarity: "affirm", trustTier: "USER_PROVIDED" }),
      claim({ claimId: "strong", polarity: "deny", trustTier: "PRIMARY" }),
    ]);
    expect(report.unresolved).toBe(0);
    expect(report.contradictions[0]).toMatchObject({ resolution: "RESOLVED_BY_TRUST_TIER", winner: "strong" });
  });

  it("treats differing objects as contradictory only for functional relations", () => {
    const functional = detectContradictions(
      [claim({ claimId: "a", object: "3000m" }), claim({ claimId: "b", object: "4000m" })],
      { functionalRelations: ["altura"] },
    );
    expect(functional.contradictions[0]).toMatchObject({ reason: "opposite_object" });

    const nonFunctional = detectContradictions([claim({ claimId: "a" }), claim({ claimId: "b", object: "4000m" })]);
    expect(nonFunctional.consistent).toBe(true);
  });

  it("reports consistency and a stable digest for unrelated claims", () => {
    const first = detectContradictions([claim({ claimId: "a" }), claim({ claimId: "b", subject: "río" })]);
    const second = detectContradictions([claim({ claimId: "a" }), claim({ claimId: "b", subject: "río" })]);
    expect(first.consistent).toBe(true);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.digest).toBe(second.digest);
  });
});
