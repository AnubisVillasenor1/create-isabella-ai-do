import { describe, expect, it } from "vitest";
import {
  beginSpan,
  createTraceContext,
  isTraceWellFormed,
  propagateTrace,
} from "../../src/ingress/trace";
import {
  checkBodySize,
  createBodyBudget,
  consumeBodyBudget,
} from "../../src/ingress/limits";
import {
  createConsentRegistry,
} from "../../src/identity/consent";

describe("ingress/trace", () => {
  it("rastrea spans por etapa", () => {
    const ctx = createTraceContext("abc123", "req-1");
    const span = beginSpan(ctx, "INGRESS");
    span.end(12);
    expect(ctx.spans[0]?.stage).toBe("INGRESS");
    expect(ctx.spans[0]?.durationMs).toBe(12);
  });

  it("propaga trazas bien formadas y cae a fallback", () => {
    expect(isTraceWellFormed("a1b2c3d4-e5f6-4a5b-8c9d-000000000000")).toBe(true);
    expect(propagateTrace(undefined)).toMatch(/^[0-9a-f-]{36}$/);
    expect(propagateTrace("mal!")).not.toBe("mal!");
  });
});

describe("ingress/limits", () => {
  it("controla el presupuesto de cuerpo", () => {
    checkBodySize("hola", 1024);
    expect(() => checkBodySize("hola".repeat(1000), 1024)).toThrow(/excede/);
    const budget = createBodyBudget(100);
    consumeBodyBudget(budget, "hola");
    expect(budget.consumedBytes).toBe(4);
    expect(() => consumeBodyBudget(budget, "x".repeat(200))).toThrow(/agotado/);
  });
});

describe("identity/consent", () => {
  it("consentimiento por propósito/ámbito y revocación", () => {
    const registry = createConsentRegistry();
    registry.register({
      principalId: "p1",
      purpose: "memoria",
      scope: ["recall"],
      grantedBy: "human",
      grantedAt: new Date().toISOString(),
    });
    expect(registry.check("p1", "memoria", "recall")).toBe(true);
    registry.revoke("p1", "memoria", "recall");
    expect(registry.check("p1", "memoria", "recall")).toBe(false);
  });

  it("rechaza consentimiento sin origen humano explícito", () => {
    const registry = createConsentRegistry();
    expect(() =>
      registry.register({
        principalId: "p1",
        purpose: "memoria",
        scope: [],
        grantedBy: "machine" as never,
        grantedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});