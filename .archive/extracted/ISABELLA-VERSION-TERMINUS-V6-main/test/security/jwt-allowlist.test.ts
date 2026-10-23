import { describe, expect, it } from "vitest";
import { STRICT_JWT_ALGORITHM_POLICY, verifyJwtAlgorithm } from "../../src/security";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function token(header: Record<string, unknown>): string {
  return `${encode(header)}.${encode({ sub: "did:tamv:1" })}.${Buffer.from("signature", "utf8").toString("base64url")}`;
}

describe("JWT algorithm allowlist", () => {
  it("accepts only the strict default algorithms", () => {
    expect(verifyJwtAlgorithm(token({ alg: "ES256", typ: "JWT" })).ok).toBe(true);
    expect(verifyJwtAlgorithm(token({ alg: "EdDSA" })).ok).toBe(true);
    expect(STRICT_JWT_ALGORITHM_POLICY.allowedAlgorithms).toEqual(["ES256", "EdDSA"]);
  });

  it("rejects alg:none even when casing varies", () => {
    const verdict = verifyJwtAlgorithm(token({ alg: "none" }));
    expect(verdict).toMatchObject({ ok: false, reason: "ALG_NONE" });
    expect(verifyJwtAlgorithm(token({ alg: "None" }))).toMatchObject({ ok: false, reason: "ALG_NONE" });
  });

  it("rejects HS256/RS256 under the strict policy", () => {
    expect(verifyJwtAlgorithm(token({ alg: "HS256" }))).toMatchObject({ ok: false, reason: "ALG_NOT_ALLOWED" });
    expect(verifyJwtAlgorithm(token({ alg: "RS256" }))).toMatchObject({ ok: false, reason: "ALG_NOT_ALLOWED" });
  });

  it("rejects malformed tokens and headers", () => {
    expect(verifyJwtAlgorithm("not-a-jwt")).toMatchObject({ ok: false, reason: "MALFORMED_TOKEN" });
    expect(verifyJwtAlgorithm("aaa.bbb")).toMatchObject({ ok: false, reason: "MALFORMED_TOKEN" });
    expect(verifyJwtAlgorithm("!!!.bbb.ccc")).toMatchObject({ ok: false, reason: "MALFORMED_TOKEN" });
    const badHeader = `${Buffer.from("not json", "utf8").toString("base64url")}.${encode({})}.${encode({})}`;
    expect(verifyJwtAlgorithm(badHeader)).toMatchObject({ ok: false, reason: "MALFORMED_HEADER" });
    expect(verifyJwtAlgorithm(token({ typ: "JWT" }))).toMatchObject({ ok: false, reason: "ALG_MISSING" });
  });

  it("rejects unexpected header parameters", () => {
    expect(verifyJwtAlgorithm(token({ alg: "EdDSA", crit: ["exp"] }))).toMatchObject({
      ok: false,
      reason: "UNEXPECTED_HEADER_PARAMETER",
    });
  });

  it("accepts a widened allowlist and header policy", () => {
    const verdict = verifyJwtAlgorithm(token({ alg: "HS256", cty: "JWT" }), {
      allowedAlgorithms: ["HS256"],
      allowedHeaderParameters: ["alg", "cty"],
    });
    expect(verdict).toMatchObject({ ok: true, algorithm: "HS256" });
  });
});
