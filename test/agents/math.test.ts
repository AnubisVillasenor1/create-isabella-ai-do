import { describe, expect, it } from "vitest";
import { evaluateArithmetic } from "../../src/agents/math";

describe("evaluateArithmetic", () => {
  it("honours precedence and parentheses", () => {
    expect(evaluateArithmetic("2+3*4")).toEqual({ ok: true, value: 14 });
    expect(evaluateArithmetic("(2+3)*4")).toEqual({ ok: true, value: 20 });
    expect(evaluateArithmetic("18*7+15/3")).toEqual({ ok: true, value: 131 });
    expect(evaluateArithmetic("10%4")).toEqual({ ok: true, value: 2 });
  });

  it("supports unary signs, decimals and exponents", () => {
    expect(evaluateArithmetic("-3 + +2")).toEqual({ ok: true, value: -1 });
    expect(evaluateArithmetic("1.5 * 2")).toEqual({ ok: true, value: 3 });
    expect(evaluateArithmetic("2^3^2")).toEqual({ ok: true, value: 512 });
    expect(evaluateArithmetic("-(2+3)^2")).toEqual({ ok: true, value: -25 });
  });

  it("rejects division by zero and invalid syntax", () => {
    expect(evaluateArithmetic("1/0")).toEqual({ ok: false, error: "DIVISION_BY_ZERO" });
    expect(evaluateArithmetic("2+")).toEqual({ ok: false, error: "EXPRESSION_UNEXPECTED_TOKEN" });
    expect(evaluateArithmetic("(2+3")).toEqual({ ok: false, error: "EXPRESSION_UNBALANCED_PARENTHESIS" });
    expect(evaluateArithmetic("2 3")).toEqual({ ok: false, error: "EXPRESSION_TRAILING_INPUT" });
  });

  it("never evaluates identifiers, calls or property access", () => {
    expect(evaluateArithmetic("process.exit(1)")).toMatchObject({ ok: false });
    expect(evaluateArithmetic("globalThis")).toMatchObject({ ok: false });
    expect(evaluateArithmetic("require('fs')")).toMatchObject({ ok: false });
    expect(evaluateArithmetic("1;2")).toMatchObject({ ok: false });
  });

  it("bounds expression length and result magnitude", () => {
    expect(evaluateArithmetic("1".repeat(121))).toEqual({ ok: false, error: "EXPRESSION_TOO_LONG" });
    expect(evaluateArithmetic("")).toEqual({ ok: false, error: "EXPRESSION_EMPTY" });
    expect(evaluateArithmetic("10^16")).toEqual({ ok: false, error: "EXPRESSION_RESULT_OUT_OF_RANGE" });
  });
});
