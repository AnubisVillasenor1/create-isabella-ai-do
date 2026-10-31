import { describe, expect, it } from "vitest";
import {
  HYPERCORE_OMEGA_MODES,
  createHyperCore,
  createHyperPredict,
  hyperCore,
  hyperPredict,
} from "../../src/hypercore";

describe("HyperCore Ω² barrel", () => {
  it("exposes the process-wide runtime singletons", () => {
    expect(hyperCore).toBeDefined();
    expect(hyperPredict).toBeDefined();
    expect(typeof createHyperCore).toBe("function");
    expect(typeof createHyperPredict).toBe("function");
  });

  it("exposes the Ω² mode envelope", () => {
    expect(HYPERCORE_OMEGA_MODES).toEqual(["ECO", "CRUISE", "BOOST", "HYPERBOOST", "OMEGA"]);
  });
});
