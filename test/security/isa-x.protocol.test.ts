import { describe, expect, it } from "vitest";
import {
  ISA_X_BLOCKED_ALGORITHMS,
  IsaXError,
  canonicalRequest,
  isaXAlgorithmPolicy,
  requireIsaXAlgorithm,
  scopeMatches,
} from "../../src/security/isa-x";
import { PqcBackendUnavailable } from "../../src/security";

describe("ISA-X protocol — deterministic canonical request", () => {
  it("produces the same canonical bytes regardless of header/query ordering or casing", () => {
    const a = canonicalRequest({
      method: "post",
      path: "/api/v1/isabella/mediate",
      query: { b: "2", a: "1" },
      headers: { "X-Trace": "t1", "Content-Type": "application/json" },
      body: new TextEncoder().encode("payload"),
    });
    const b = canonicalRequest({
      method: "  POST ",
      path: "/api/v1/isabella/mediate",
      query: { a: "1", b: "2" },
      headers: { "content-type": "application/json  ", "  x-trace  ": " t1" },
      body: new TextEncoder().encode("payload"),
    });
    expect(a).toBe(b);
  });

  it("changes when the body changes", () => {
    const base = canonicalRequest({ method: "GET", path: "/x", body: new TextEncoder().encode("one") });
    const other = canonicalRequest({ method: "GET", path: "/x", body: new TextEncoder().encode("two") });
    expect(base).not.toBe(other);
  });

  it("rejects a malformed request with a tagged error", () => {
    expect(() => canonicalRequest({ method: "GET", path: "" })).toThrow(IsaXError);
    try {
      canonicalRequest({ method: "GET", path: "" });
    } catch (error) {
      expect((error as IsaXError).code).toBe("ISA_X_MALFORMED");
    }
  });

  it("supports exact and wildcard scope matching", () => {
    expect(scopeMatches("payment:write", "payment:write")).toBe(true);
    expect(scopeMatches("payment:write", "payment:read")).toBe(false);
    expect(scopeMatches("payment:write", "payment:*")).toBe(true);
    expect(scopeMatches("payment:write", "read:*")).toBe(false);
  });
});

describe("ISA-X algorithm policy — honest declared state", () => {
  it("marks only Ed25519 implemented/AVAILABLE", () => {
    const policy = isaXAlgorithmPolicy();
    expect(policy.version).toBe("1.1");
    expect(policy.signingAlgorithm).toBe("Ed25519");
    const ed = policy.entries.find((e) => e.algorithm === "Ed25519");
    expect(ed?.status).toBe("implemented");
    expect(ed?.environment).toBe("AVAILABLE");
    for (const blocked of ISA_X_BLOCKED_ALGORITHMS) {
      const entry = policy.entries.find((e) => e.algorithm === blocked);
      expect(entry?.status).toBe("blocked_environment");
      expect(entry?.environment).toBe("BLOCKED_ENVIRONMENT");
    }
  });

  it("fails closed on every post-quantum algorithm", () => {
    expect(() => requireIsaXAlgorithm("Ed25519")).not.toThrow();
    expect(() => requireIsaXAlgorithm("ML-DSA-65")).toThrow(PqcBackendUnavailable);
    expect(() => requireIsaXAlgorithm("ML-KEM-768")).toThrow(PqcBackendUnavailable);
    expect(() => requireIsaXAlgorithm("SLH-DSA-SHA2-128s")).toThrow(PqcBackendUnavailable);
  });
});