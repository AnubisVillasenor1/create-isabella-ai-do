import { describe, expect, it } from "vitest";
import { classifyIntent, comprehend, createComprehensionPipeline, DECLARED_COMPREHENSION_LIMITS } from "../../src/cognition/native-comprehension";

describe("native-comprehension (ISA-077)", () => {
  it("is deterministic: same input yields identical output", () => {
    const pipeline = createComprehensionPipeline();
    const a = pipeline.comprehend({ id: "t1", utterance: "  Dame el ESTADO del sistema  " });
    const b = pipeline.comprehend({ id: "t1", utterance: "  Dame el ESTADO del sistema  " });
    expect(a).toEqual(b);
    expect(a.mode).toBe("DETERMINISTIC");
  });

  it("normalizes, tokenizes and classifies intent deterministically", () => {
    const result = comprehend({ id: "t2", utterance: "Dame el estado del sistema" });
    expect(result.utteranceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.tokens).toContain("estado");
    expect(result.intent).toBe("QUERY");
  });

  it("never claims generative capability", () => {
    const result = comprehend({ id: "t3", utterance: "hola" });
    expect(result.generatesText).toBe(false);
    expect(result.generation).toBe("NONE");
    expect(createComprehensionPipeline().generationStatus()).toBe("NONE");
    expect(DECLARED_COMPREHENSION_LIMITS.some((limit) => limit.toLowerCase().includes("genera texto"))).toBe(true);
  });

  it("rejects blank utterances and ids", () => {
    expect(() => comprehend({ id: "t4", utterance: "   " })).toThrow(/utterance/);
    expect(() => comprehend({ id: "", utterance: "hola" })).toThrow(/id/);
  });

  it("classifies command and statement intents", () => {
    expect(classifyIntent(["actualiza", "el", "perfil"])).toBe("COMMAND");
    expect(classifyIntent(["la", "tierra", "gira"])).toBe("STATEMENT");
    expect(classifyIntent([])).toBe("UNKNOWN");
  });
});