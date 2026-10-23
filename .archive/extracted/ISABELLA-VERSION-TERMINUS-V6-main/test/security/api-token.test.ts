import { describe, expect, it } from "vitest";
import { verifyBearerToken } from "../../src/security/api-token";

const token = "a".repeat(40);

describe("service bearer-token authentication", () => {
  it("fails closed when the token is missing or too weak", () => {
    expect(verifyBearerToken("Bearer " + token, undefined)).toBe("NOT_CONFIGURED");
    expect(verifyBearerToken("Bearer short", "short")).toBe("NOT_CONFIGURED");
  });

  it("accepts only an exact bearer token", () => {
    expect(verifyBearerToken("Bearer " + token, token)).toBe("AUTHORIZED");
    expect(verifyBearerToken("Bearer " + "b".repeat(40), token)).toBe("INVALID");
    expect(verifyBearerToken(token, token)).toBe("INVALID");
  });
});
