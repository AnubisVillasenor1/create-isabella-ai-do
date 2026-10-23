import { describe, expect, it } from "vitest";
import { buildKeylessFreeMessages, extractKeylessFreeText, resolveKeylessFreeProvider } from "../../src/inference/provider-policy";

describe("keyless free provider policy", () => {
  it("stays off unless the operator explicitly enables it", () => {
    expect(resolveKeylessFreeProvider({})).toBeNull();
    expect(resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: "" })).toBeNull();
    expect(resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: "off" })).toBeNull();
    expect(resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: "false" })).toBeNull();
  });

  it("accepts the documented opt-in aliases case-insensitively", () => {
    for (const flag of ["pollinations", "on", "ON", "true", "1", "  pollinations  "]) {
      const config = resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: flag });
      expect(config, flag).not.toBeNull();
      expect(config?.name).toBe("pollinations");
      expect(config?.endpoint).toBe("https://text.pollinations.ai");
      expect(config?.model).toBe("openai");
    }
  });

  it("honors endpoint and model overrides and normalizes trailing slashes", () => {
    const config = resolveKeylessFreeProvider({
      ISABELLA_KEYLESS_FREE_PROVIDER: "on",
      KEYLESS_FREE_PROVIDER_URL: "https://example.invalid/free///",
      KEYLESS_FREE_PROVIDER_MODEL: "  mistral  ",
    });
    expect(config?.endpoint).toBe("https://example.invalid/free");
    expect(config?.model).toBe("mistral");
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("builds a bounded system + history + user message list", () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn-${index}`,
    }));
    const messages = buildKeylessFreeMessages("system", "current", history);
    expect(messages).toHaveLength(10);
    expect(messages[0]).toEqual({ role: "system", content: "system" });
    expect(messages[1]?.content).toBe("turn-4");
    expect(messages.at(-1)).toEqual({ role: "user", content: "current" });
  });

  it("bounds forwarded content so no single field is unbounded", () => {
    const [system, user] = buildKeylessFreeMessages("x".repeat(5_000), "y".repeat(9_000));
    expect(system?.content).toHaveLength(2_000);
    expect(user?.content).toHaveLength(4_000);
  });

  it("normalizes provider plain text and rejects empty output", () => {
    expect(extractKeylessFreeText("  hola\r\nmundo  ")).toBe("hola\nmundo");
    expect(extractKeylessFreeText("   ")).toBeNull();
    expect(extractKeylessFreeText("abcdef", 3)).toBe("abc");
  });
});
