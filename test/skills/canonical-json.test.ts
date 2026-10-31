import { describe, expect, it } from "vitest";
import { canonicalJson, manifestDigest, sha256, sha256Hex } from "../../src/skills/canonical-json";

describe("canonical JSON (RFC 8785 style)", () => {
  it("is independent of object key insertion order", () => {
    const left = { b: 2, a: 1, nested: { y: true, x: false } };
    const right = { nested: { x: false, y: true }, a: 1, b: 2 };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(sha256(left)).toBe(sha256(right));
  });

  it("sorts keys by UTF-16 code unit", () => {
    expect(canonicalJson({ b: 1, B: 2, a: 3 })).toBe('{"B":2,"a":3,"b":1}');
  });

  it("drops undefined properties but keeps null in arrays", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalJson([1, undefined, 2])).toBe("[1,null,2]");
  });

  it("produces a stable 64-char SHA-256 hex digest", () => {
    const digest = sha256({ hello: "mundo" });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256({ hello: "mundo" })).toBe(digest);
  });

  it("rejects non-finite numbers and bigint", () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ n: 10n })).toThrow(/bigint/);
  });

  it("chains part digests through manifestDigest", () => {
    const digest = manifestDigest(["a", "b"]);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(manifestDigest(["a", "b"])).not.toBe(manifestDigest(["b", "a"]));
  });

  it("hashes raw strings byte-exactly", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
