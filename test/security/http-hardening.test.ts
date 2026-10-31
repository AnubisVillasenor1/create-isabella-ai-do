import { describe, expect, it } from "vitest";
import { AuthFailureThrottle, classifyHttpError, parseTrustProxy, securityHeadersFor } from "../../src/security/http-hardening";

/** state: draft | engine-generated */
describe("securityHeadersFor", () => {
  it("API paths get strict CSP and no-store; non-API paths do not", () => {
    const api = securityHeadersFor("/api/v1/status", {});
    expect(api["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(api["Cache-Control"]).toContain("no-store");
    expect(securityHeadersFor("/api", {})["Cache-Control"]).toContain("no-store");
    expect(securityHeadersFor("/apiary", {})["Cache-Control"]).toBeUndefined();
    expect(securityHeadersFor("/", {})["Content-Security-Policy"]).toBeUndefined();
  });
  it("HSTS only in production", () => {
    expect(securityHeadersFor("/", { NODE_ENV: "production" })["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(securityHeadersFor("/", { NODE_ENV: "development" })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("classifyHttpError", () => {
  it("maps body-parser errors and never leaks internals", () => {
    expect(classifyHttpError({ type: "entity.parse.failed", message: "Unexpected token at secret" })).toEqual({ status: 400, body: { success: false, error: "INVALID_JSON" } });
    expect(classifyHttpError({ type: "entity.too.large" }).status).toBe(413);
    expect(classifyHttpError({ status: 404 }).status).toBe(404);
    const generic = classifyHttpError(new Error("db password=hunter2"));
    expect(generic.status).toBe(500);
    expect(JSON.stringify(generic)).not.toContain("hunter2");
    expect(classifyHttpError(null).status).toBe(500);
    expect(classifyHttpError({ status: 999 }).status).toBe(500);
  });
});

describe("parseTrustProxy", () => {
  it("accepts only small positive integers", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy(" 2 ")).toBe(2);
    for (const bad of [undefined, "", "0", "true", "11", "-1", "1.5", "loopback", "100"]) expect(parseTrustProxy(bad)).toBe(false);
  });
});

describe("AuthFailureThrottle", () => {
  it("blocks after N failures, expires, and resets on success", () => {
    const t = new AuthFailureThrottle(3, 1000, 5000);
    for (let i = 0; i < 2; i += 1) t.recordFailure("ip", 0);
    expect(t.blockedFor("ip", 1)).toBe(0);
    t.recordFailure("ip", 2);
    expect(t.blockedFor("ip", 3)).toBe(4999);
    expect(t.blockedFor("other", 3)).toBe(0);
    expect(t.blockedFor("ip", 5003)).toBe(0);
    t.recordSuccess("ip");
    t.recordFailure("ip", 6000);
    expect(t.blockedFor("ip", 6001)).toBe(0);
  });
  it("failure window rolls over", () => {
    const t = new AuthFailureThrottle(3, 1000, 5000);
    t.recordFailure("ip", 0);
    t.recordFailure("ip", 10);
    t.recordFailure("ip", 5000);
    expect(t.blockedFor("ip", 5001)).toBe(0);
  });
  it("stays bounded under key flooding; keeps the most recent blocked keys", () => {
    const t = new AuthFailureThrottle(1, 1000, 100_000, 50);
    for (let i = 0; i < 500; i += 1) t.recordFailure(`k${i}`, 1);
    expect(t.size).toBeLessThanOrEqual(50);
    expect(t.blockedFor("k499", 2)).toBeGreaterThan(0);
  });
  it("unblocked failing keys are evicted before blocked ones", () => {
    const t = new AuthFailureThrottle(2, 1000, 100_000, 5);
    t.recordFailure("blocked", 0);
    t.recordFailure("blocked", 0);
    for (let i = 0; i < 20; i += 1) t.recordFailure(`one-${i}`, 1);
    expect(t.blockedFor("blocked", 2)).toBeGreaterThan(0);
  });
  it("validates configuration", () => {
    expect(() => new AuthFailureThrottle(0)).toThrow();
    expect(() => new AuthFailureThrottle(1, 0)).toThrow();
  });
});
