import { describe, expect, it } from "vitest";
import { createPassportAuthority } from "../../src/gameover/passport-authority";
import type { AgentIdentity } from "../../src/gameover/types";

const agent: AgentIdentity = {
  id: "agent-1",
  name: "Builder",
  organization: "TAMV",
  owner: "edwin",
  capabilities: ["build"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

function authority(nowIso = "2026-01-01T00:00:00.000Z") {
  let current = new Date(nowIso);
  const authorityInstance = createPassportAuthority({ now: () => current, idFactory: () => "pp-fixed" });
  return {
    authority: authorityInstance,
    advanceTo(iso: string) {
      current = new Date(iso);
    },
  };
}

describe("GAME OVER PassportAuthority", () => {
  it("issues a passport with certification derived from trust score", () => {
    const { authority: a } = authority();
    expect(a.issue({ agent, issuer: "tamv", trustScore: 90, id: "pp-90" }).certification).toBe("CERTIFIED");
    expect(a.issue({ agent, issuer: "tamv", trustScore: 70, id: "pp-70" }).certification).toBe("PROVISIONAL");
    expect(a.issue({ agent, issuer: "tamv", trustScore: 10, id: "pp-10" }).certification).toBe("UNKNOWN");
  });

  it("rejects duplicate passport IDs rather than overwriting identity", () => {
    const { authority: a } = authority();
    a.issue({ agent, issuer: "tamv", trustScore: 90, id: "pp-duplicate" });
    expect(() => a.issue({ agent, issuer: "attacker", trustScore: 90, id: "pp-duplicate" })).toThrow("PASSPORT_ID_DUPLICATE");
    expect(a.get("pp-duplicate")?.issuer).toBe("tamv");
  });

  it("rejects non-finite or out-of-range trust scores", () => {
    const { authority: a } = authority();
    expect(() => a.issue({ agent, issuer: "tamv", trustScore: Number.NaN, id: "pp-nan" })).toThrow("PASSPORT_TRUST_SCORE_INVALID");
    expect(() => a.issue({ agent, issuer: "tamv", trustScore: 101, id: "pp-high" })).toThrow("PASSPORT_TRUST_SCORE_INVALID");
  });

  it("verifies a valid certified passport", () => {
    const { authority: a } = authority();
    a.issue({ agent, issuer: "tamv", trustScore: 90, id: "pp-1" });
    const check = a.verify("pp-1");
    expect(check.valid).toBe(true);
    expect(check.certification).toBe("CERTIFIED");
  });

  it("fails closed for unknown and uncertified passports", () => {
    const { authority: a } = authority();
    expect(a.verify("missing").reason).toBe("PASSPORT_NOT_FOUND");
    a.issue({ agent, issuer: "tamv", trustScore: 10, id: "pp-10" });
    expect(a.verify("pp-10").reason).toBe("PASSPORT_NOT_CERTIFIED");
  });

  it("rejects expired passports", () => {
    const { authority: a, advanceTo } = authority();
    a.issue({ agent, issuer: "tamv", trustScore: 90, id: "pp-1", validityDays: 1 });
    advanceTo("2026-01-03T00:00:00.000Z");
    expect(a.verify("pp-1").reason).toBe("PASSPORT_EXPIRED");
  });

  it("revokes a passport and records the reason", () => {
    const { authority: a } = authority();
    a.issue({ agent, issuer: "tamv", trustScore: 90, id: "pp-1" });
    const revoked = a.revoke("pp-1", "policy breach");
    expect(revoked.certification).toBe("REVOKED");
    expect(revoked.revokedReason).toBe("policy breach");
    expect(a.verify("pp-1").reason).toBe("PASSPORT_REVOKED");
  });
});
