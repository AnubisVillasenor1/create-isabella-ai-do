import { describe, expect, it } from "vitest";
import { canonicalJson, normalizeText, sha256Hex, sha3Hex, tokenize } from "../../src/hypercore/canonical";

describe("HyperCore canonical primitives", () => {
  it("serializes objects with sorted keys deterministically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: [{ y: 1, x: 2 }] })).toBe('{"a":[{"x":2,"y":1}]}');
  });

  it("produces stable, distinct hashes", () => {
    expect(sha256Hex("isabella")).toBe(sha256Hex("isabella"));
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
    expect(sha256Hex("isabella")).toHaveLength(64);
    expect(sha3Hex("isabella")).toHaveLength(64);
  });

  it("normalizes and tokenizes text without short tokens", () => {
    expect(normalizeText("  Hola   Mundo  ")).toBe("hola mundo");
    expect(tokenize("generate an API endpoint")).toEqual(["generate", "api", "endpoint"]);
  });
});
