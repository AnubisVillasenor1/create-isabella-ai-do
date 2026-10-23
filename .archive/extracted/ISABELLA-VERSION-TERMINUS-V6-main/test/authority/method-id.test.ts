import { describe, expect, it } from "vitest";
import {
  buildMethodId,
  CANONICAL_EXAMPLE_METHOD_ID,
  formatMethodId,
  isValidModule,
  parseMethodId,
  type MethodId,
} from "../../src/authority/method-id";

const valid: MethodId = {
  tina: "T",
  yun: "TOURISM",
  module: "E06_UX",
  function: "recommend_route.synthesize",
  version: "v1.0.0",
  riskTier: "MEDIUM",
  governanceTier: "TERRITORIAL",
};

describe("authority/method-id", () => {
  it("formatea los siete segmentos canónicos", () => {
    expect(formatMethodId(valid)).toBe(
      "T.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM.TERRITORIAL",
    );
  });

  it("parsea el ejemplo canónico del canon v40", () => {
    const parsed = parseMethodId(CANONICAL_EXAMPLE_METHOD_ID);
    expect(parsed).toMatchObject({
      tina: "T",
      yun: "TOURISM",
      module: "E06_UX",
      function: "recommend_route.synthesize",
      version: "v1.0.0",
      riskTier: "MEDIUM",
      governanceTier: "TERRITORIAL",
    });
  });

  it("roundtrip parse→format es estable", () => {
    expect(formatMethodId(parseMethodId(formatMethodId(valid)))).toBe(formatMethodId(valid));
  });

  it("buildMethodId construye identificadores válidos", () => {
    expect(buildMethodId(valid)).toBe(formatMethodId(valid));
  });

  it("acepta motores arquitectónicos como módulo", () => {
    expect(isValidModule("CROWN")).toBe(true);
    expect(isValidModule("BOOKPI")).toBe(true);
    expect(isValidModule("MOE_ROUTER")).toBe(true);
  });

  it("valida el rango E00-E23 y la nomenclatura de expertos", () => {
    expect(isValidModule("E00_ATLAS")).toBe(true);
    expect(isValidModule("E23_IDENTITY_COHERENCE")).toBe(true);
    expect(isValidModule("E24_X")).toBe(false);
    expect(isValidModule("E-1")).toBe(false);
  });

  it.each([
    "X.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM.TERRITORIAL",
    "T.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM",
    "T.BOGUS.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM.TERRITORIAL",
    "T.TOURISM.E06_UX.recommend_route.synthesize.v1.MEDIUM.TERRITORIAL",
    "T.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.RIDICULOUS.TERRITORIAL",
    "T.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM.AD_HOC",
  ])("rechaza identificadores inválidos: %s", (input) => {
    expect(() => parseMethodId(input)).toThrow();
  });
});