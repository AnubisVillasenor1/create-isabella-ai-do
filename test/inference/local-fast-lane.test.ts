import { describe, expect, it } from "vitest";
import { detectLocalIntent, extractMathExpression, isAgentableIntent, isConversationalIntent } from "../../src/inference/local-fast-lane";

describe("detectLocalIntent", () => {
  it("recognises short conversational intents with and without accents", () => {
    expect(detectLocalIntent("Hola")).toBe("greeting");
    expect(detectLocalIntent("¿Qué hora es?")).toBe("time");
    expect(detectLocalIntent("quien eres")).toBe("identity");
    expect(detectLocalIntent("que puedes hacer")).toBe("capabilities");
    expect(detectLocalIntent("gracias")).toBe("thanks");
    expect(detectLocalIntent("estado del nodo")).toBe("platform-status");
    expect(detectLocalIntent("Dame un resumen breve del estado del nodo.")).toBe("platform-status");
    expect(detectLocalIntent("skills disponibles")).toBe("skills");
  });

  it("recognises curated platform questions without claiming a web search", () => {
    expect(detectLocalIntent("¿Qué es HyperCore Turbo?")).toBe("knowledge");
    expect(detectLocalIntent("explica gobernanza")).toBe("knowledge");
    expect(detectLocalIntent("explica la fotosíntesis")).toBeNull();
  });

  it("sees arithmetic as calculation only with a valid expression", () => {
    expect(detectLocalIntent("calcula (18*7)+15/3")).toBe("calculation");
    expect(detectLocalIntent("cuanto es 2+2")).toBe("calculation");
    expect(detectLocalIntent("calcula 18 * 27 + 14 y explica el resultado")).toBe("calculation");
    expect(detectLocalIntent("calcula esto mañana")).toBeNull();
  });

  it("returns null for long or ambiguous prompts so the governed path keeps control", () => {
    expect(detectLocalIntent("hola, necesito que analices este documento largo sobre gobernanza y riesgos")).toBeNull();
    expect(detectLocalIntent("")).toBeNull();
    expect(detectLocalIntent("x".repeat(241))).toBeNull();
    expect(detectLocalIntent("dime algo interesante")).toBeNull();
  });
});

describe("extractMathExpression", () => {
  it("extracts bounded expressions from calculation requests", () => {
    expect(extractMathExpression("calcula (18*7)+15/3")).toBe("(18*7)+15/3");
    expect(extractMathExpression("¿cuánto es 10 % 3?")).toBe("10%3");
    expect(extractMathExpression("resuelve 2 ^ 8")).toBe("2^8");
  });

  it("rejects expressions with identifiers or without operators", () => {
    expect(extractMathExpression("calcula process.exit(1)")).toBeNull();
    expect(extractMathExpression("cuanto es 42")).toBeNull();
    expect(extractMathExpression("2+2")).toBe("2+2");
    expect(extractMathExpression("2026-10-24")).toBeNull();
    expect(extractMathExpression(`calcula ${"1+".repeat(70)}1`)).toBeNull();
  });

  it("stops at the first non-arithmetic token instead of rejecting the request", () => {
    expect(extractMathExpression("calcula 18 * 27 + 14 y explica el resultado")).toBe("18*27+14");
    expect(extractMathExpression("cuanto es (2+3)*4, por favor")).toBe("(2+3)*4");
  });
});

describe("intent classification", () => {
  it("separates conversational intents from agentable ones", () => {
    expect(isConversationalIntent("greeting")).toBe(true);
    expect(isConversationalIntent("calculation")).toBe(false);
    expect(isAgentableIntent("time")).toBe(true);
    expect(isAgentableIntent("knowledge")).toBe(true);
    expect(isAgentableIntent("privacy")).toBe(false);
    expect(isAgentableIntent(null)).toBe(false);
  });
});
