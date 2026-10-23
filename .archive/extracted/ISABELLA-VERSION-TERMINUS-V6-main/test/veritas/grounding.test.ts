import { describe, expect, it } from "vitest";
import { GROUNDING_METHOD, GROUNDING_VERSION, assessGrounding } from "../../src/veritas/grounding";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import type { MagpieEvent } from "../../src/messaging";

describe("Evidence Grounding Guard Ω", () => {
  it("accepts an answer fully anchored in the provided evidence", () => {
    const report = assessGrounding("isabella sistema soberano", [
      { id: "e1", text: "isabella es un sistema soberano y gobernado" },
    ]);
    expect(report.verdict).toBe("ACCEPTED");
    expect(report.groundedness).toBe(1);
    expect(report.unsupportedClaimCount).toBe(0);
    expect(report.method).toBe(GROUNDING_METHOD);
    expect(report.version).toBe(GROUNDING_VERSION);
  });

  it("blocks when an assertion has no lexical support (fail-closed)", () => {
    const report = assessGrounding("cuantico garantizado", [{ id: "e1", text: "isabella sistema soberano" }]);
    expect(report.verdict).toBe("BLOCKED");
    expect(report.claims[0]?.verdict).toBe("UNSUPPORTED");
    expect(report.unsupportedClaimCount).toBe(1);
    expect(report.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never accepts an answer without evidence", () => {
    const report = assessGrounding("isabella es real", []);
    expect(report.verdict).toBe("BLOCKED");
    expect(report.notes.join(" ")).toMatch(/Sin evidencia/);
  });

  it("classifies partial support and attributes evidence ids", () => {
    const report = assessGrounding("sistema cuantico", [
      { id: "e2", text: "cubo" },
      { id: "e1", text: "sistema distribuido" },
    ]);
    expect(report.claims[0]?.verdict).toBe("PARTIAL");
    expect(report.claims[0]?.supportRatio).toBeCloseTo(0.5);
    expect(report.claims[0]?.supportingEvidenceIds).toEqual(["e1"]);
    expect(report.claims[0]?.unsupportedTokens).toEqual(["cuantico"]);
  });

  it("is diacritic-insensitive and deterministic", () => {
    const a = assessGrounding("cognición soberana", [{ id: "e1", text: "cognicion soberana total" }]);
    const b = assessGrounding("cognición soberana", [{ id: "e1", text: "cognicion soberana total" }]);
    expect(a.claims[0]?.verdict).toBe("SUPPORTED");
    expect(a.digest).toBe(b.digest);
  });

  it("fails closed on invalid input and options", () => {
    expect(() => assessGrounding("   ", [])).toThrow(/GROUNDING_ANSWER_REQUIRED/);
    expect(() => assessGrounding("hola mundo", [], { minGroundedness: 2 })).toThrow(/GROUNDING_OPTIONS_INVALID/);
    expect(() => assessGrounding("hola mundo", [], { partialThreshold: 0.9, supportedThreshold: 0.2 })).toThrow(/GROUNDING_OPTIONS_INVALID/);
    expect(() => assessGrounding("hola mundo", [{ id: "  ", text: "x" }])).toThrow(/GROUNDING_EVIDENCE_ID_REQUIRED/);
  });

  it("is wired into the runtime as hsf.truth.grounding and emits a governed event", () => {
    const runtime = new IsabellaGenesisRuntime();
    expect(runtime.capabilities.list().map((c) => c.id)).toContain("hsf.truth.grounding");

    const seen: MagpieEvent[] = [];
    runtime.subscribeEvent("truth.grounding.assessed", (event) => seen.push(event));
    const report = runtime.assessGrounding("isabella sistema soberano", [{ id: "e1", text: "isabella sistema soberano gobernado" }]);

    expect(report.verdict).toBe("ACCEPTED");
    expect(seen).toHaveLength(1);
    expect((seen[0]?.payload as { digest: string }).digest).toBe(report.digest);
  });
});
