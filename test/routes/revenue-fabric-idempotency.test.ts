import { describe, expect, it } from "vitest";
import { parseIdempotencyKey } from "../../src/routes/revenue-fabric";

describe("financial write idempotency keys", () => {
  it("accepts stable keys within the documented length and character contract", () => {
    expect(parseIdempotencyKey("settlement:invoice_2026-10-23")).toBe("settlement:invoice_2026-10-23");
    expect(parseIdempotencyKey("  request-12345678  ")).toBe("request-12345678");
    expect(parseIdempotencyKey("x".repeat(200))).toBe("x".repeat(200));
  });

  it("rejects absent, non-string, short, overlong and unsafe keys", () => {
    expect(parseIdempotencyKey(undefined)).toBeNull();
    expect(parseIdempotencyKey(12345678)).toBeNull();
    expect(parseIdempotencyKey("short")).toBeNull();
    expect(parseIdempotencyKey("x".repeat(201))).toBeNull();
    expect(parseIdempotencyKey("settlement key with spaces")).toBeNull();
    expect(parseIdempotencyKey("key/with/slash")).toBeNull();
  });
});
