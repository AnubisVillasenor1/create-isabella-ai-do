import { describe, expect, it } from "vitest";
import {
  boundedMilliseconds,
  extractAssistantText,
  isOpenRouterModelAllowed,
} from "../src/inference/provider-policy";

describe("inference provider policy", () => {
  it("uses a bounded default when a timeout is missing or malformed", () => {
    expect(boundedMilliseconds(undefined, 8_000, 3_000, 30_000)).toBe(8_000);
    expect(boundedMilliseconds("not-a-number", 8_000, 3_000, 30_000)).toBe(8_000);
    expect(boundedMilliseconds("0", 8_000, 3_000, 30_000)).toBe(8_000);
  });

  it("clamps configured timeout and cooldown values to the supported range", () => {
    expect(boundedMilliseconds("100", 8_000, 3_000, 30_000)).toBe(3_000);
    expect(boundedMilliseconds("999999", 8_000, 3_000, 30_000)).toBe(30_000);
    expect(boundedMilliseconds("15000", 60_000, 10_000, 300_000)).toBe(15_000);
  });

  it("rejects invalid bounds rather than silently accepting broken policy", () => {
    expect(() => boundedMilliseconds("5", 8_000, 0, 30_000)).toThrow(/bounds/);
    expect(() => boundedMilliseconds("5", 8_000, 10_000, 1_000)).toThrow(/bounds/);
  });

  it("allows the free router and explicit :free models without paid opt-in", () => {
    expect(isOpenRouterModelAllowed("openrouter/free", false)).toBe(true);
    expect(isOpenRouterModelAllowed("vendor/model:free", false)).toBe(true);
    expect(isOpenRouterModelAllowed(" vendor/model:free ", false)).toBe(true);
  });

  it("rejects paid-looking and empty model IDs unless paid routes are explicitly enabled", () => {
    expect(isOpenRouterModelAllowed("vendor/model", false)).toBe(false);
    expect(isOpenRouterModelAllowed("", true)).toBe(false);
    expect(isOpenRouterModelAllowed("vendor/model", true)).toBe(true);
  });

  it("extracts a non-empty string assistant response", () => {
    expect(extractAssistantText({ choices: [{ message: { content: "  respuesta  " } }] })).toBe("respuesta");
    expect(extractAssistantText({ choices: [{ message: { content: "  " } }] })).toBeNull();
  });

  it("supports text-part content without coercing arbitrary objects", () => {
    expect(extractAssistantText({
      choices: [{ message: { content: [
        { type: "text", text: "parte uno" },
        { type: "image", text: "ignorar" },
        { type: "output_text", text: "parte dos" },
      ] } }],
    })).toBe("parte uno\nparte dos");
    expect(extractAssistantText({ choices: [{ message: { content: [{ type: "text", text: 42 }] } }] })).toBeNull();
    expect(extractAssistantText(null)).toBeNull();
    expect(extractAssistantText({})).toBeNull();
  });
});
