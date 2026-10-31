import { describe, expect, it } from "vitest";
import { createNonceRegistry, nonce } from "../../src/security";

describe("nonce uniqueness registry", () => {
  it("generates cryptographically random nonces", () => {
    const a = nonce();
    const b = nonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(new Set(Array.from({ length: 64 }, () => nonce())).size).toBe(64);
  });

  it("rejects a duplicate claim and accepts the first", () => {
    const registry = createNonceRegistry({ ttlMs: 1000 });
    expect(registry.claim("nonce-1")).toBe(true);
    expect(registry.claim("nonce-1")).toBe(false);
    expect(registry.has("nonce-1")).toBe(true);
    expect(registry.claim("nonce-2")).toBe(true);
    expect(() => registry.claim("")).toThrow();
  });

  it("expires nonces after the ttl", () => {
    let clock = 1_000;
    const registry = createNonceRegistry({ ttlMs: 500, now: () => clock });
    expect(registry.claim("nonce-x")).toBe(true);
    expect(registry.has("nonce-x")).toBe(true);
    clock += 499;
    expect(registry.has("nonce-x")).toBe(true);
    expect(registry.claim("nonce-x")).toBe(false);
    clock += 2;
    expect(registry.has("nonce-x")).toBe(false);
    expect(registry.claim("nonce-x")).toBe(true);
  });

  it("prunes expired entries", () => {
    let clock = 0;
    const registry = createNonceRegistry({ ttlMs: 100, now: () => clock });
    registry.claim("a");
    registry.claim("b");
    expect(registry.size).toBe(2);
    clock += 101;
    expect(registry.prune()).toBe(2);
    expect(registry.size).toBe(0);
  });

  it("fails closed when capacity is exceeded", () => {
    const registry = createNonceRegistry({ ttlMs: 10_000, maxEntries: 2 });
    expect(registry.claim("a")).toBe(true);
    expect(registry.claim("b")).toBe(true);
    expect(() => registry.claim("c")).toThrow(/capacity/);
  });

  it("rejects invalid options", () => {
    expect(() => createNonceRegistry({ ttlMs: 0 })).toThrow();
    expect(() => createNonceRegistry({ ttlMs: 1000, maxEntries: 0 })).toThrow();
  });
});
