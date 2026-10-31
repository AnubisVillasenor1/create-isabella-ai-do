import { describe, expect, it } from "vitest";
import {
  isInvariantPreserved,
  invariantViewModel,
  INVARIANT_DIAGRAM,
} from "../../src/core/invariants";

describe("core/invariants", () => {
  it("el modelo por defecto preserva la independencia de roles", () => {
    expect(isInvariantPreserved()).toBe(true);
  });

  it("rechaza que dos roles ocupen el mismo valor", () => {
    const broken = { ...invariantViewModel, capability: invariantViewModel.authority };
    expect(isInvariantPreserved(broken)).toBe(false);
  });

  it("rechaza roles vacíos o autoconcedidos", () => {
    expect(
      isInvariantPreserved({ ...invariantViewModel, execution: "" }),
    ).toBe(false);
    expect(
      isInvariantPreserved({ ...invariantViewModel, authority: "self_granted" }),
    ).toBe(false);
  });

  it("documenta el diagrama del invariante", () => {
    expect(INVARIANT_DIAGRAM).toBe(
      "CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION",
    );
  });
});