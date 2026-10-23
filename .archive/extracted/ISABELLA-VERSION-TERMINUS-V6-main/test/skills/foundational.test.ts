import { describe, expect, it } from "vitest";
import { FOUNDATIONAL_SKILLS, SkillRegistry } from "../../src/skills";

function registry(): SkillRegistry {
  const reg = new SkillRegistry();
  for (const skill of FOUNDATIONAL_SKILLS) reg.register(skill);
  return reg;
}

const ctx = (input: unknown, grantedScopes: string[] = [], signals: string[] = []) => ({
  requestId: "req-1",
  traceId: "trace-1",
  input,
  signals,
  grantedScopes,
});

const SOURCES = [{ sourceId: "src-1", content: "informe territorial", trustTier: "PRIMARY" as const }];
const CLAIM = { claimId: "c-1", text: "El territorio X tiene acervo", sourceIds: ["src-1"] };

describe("foundational skills Ω (ORION/SOPHIA/ARGUS/MNEMOS/LUMEN)", () => {
  it("declares exactly five governed, scoped contracts", () => {
    expect(FOUNDATIONAL_SKILLS).toHaveLength(5);
    for (const skill of FOUNDATIONAL_SKILLS) {
      expect(skill.contract).toBeDefined();
      expect(skill.contract?.authority.requiredScopes.length).toBeGreaterThan(0);
      expect(skill.contract?.limits.maxLatencyMs).toBeGreaterThan(0);
      expect(skill.contract?.evidencePolicy.retentionDays).toBeGreaterThan(0);
    }
  });

  it("ORION orients provenance and validates the claim (fail-closed on unknown source)", async () => {
    const ok = await registry().invoke(
      "orion_provenance_orientation",
      ctx({ sources: SOURCES, claim: CLAIM }, ["cognition:provenance:orient"]),
    );
    expect(ok.status).toBe("ok");
    expect((ok.output as { valid: boolean }).valid).toBe(true);

    const bad = await registry().invoke(
      "orion_provenance_orientation",
      ctx({ sources: SOURCES, claim: { ...CLAIM, sourceIds: ["missing"] } }, ["cognition:provenance:orient"]),
    );
    expect((bad.output as { valid: boolean }).valid).toBe(false);
  });

  it("SOPHIA consolidates confidence to CORROBORATED with a primary source", async () => {
    const result = await registry().invoke(
      "sophia_knowledge_consolidation",
      ctx({ sources: SOURCES, claim: CLAIM }, ["cognition:knowledge:consolidate"]),
    );
    expect(result.status).toBe("ok");
    expect((result.output as { confidence: string }).confidence).toBe("CORROBORATED");
  });

  it("ARGUS returns a verifier consensus verdict", async () => {
    const result = await registry().invoke(
      "argus_verification_consensus",
      ctx({ risk: "high", candidate: { safety: "pass", policy: "pass", security: "pass", evidence: ["e"], factuality: "pass", financialExecution: false } }, ["cognition:verification:consensus"]),
    );
    expect(result.status).toBe("ok");
    expect((result.output as { verdict: string }).verdict).toBe("ALLOW");
  });

  it("MNEMOS seals a memory record deterministically", async () => {
    const result = await registry().invoke("mnemos_memory_seal", ctx({ record: { id: "m-1" } }, ["memory:seal"]));
    expect(result.status).toBe("ok");
    expect((result.output as { digest: string }).digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("LUMEN illuminates authority: allow, deny and degrade", async () => {
    const allow = await registry().invoke(
      "lumen_authority_illumination",
      ctx({ requiredScopes: ["a"], grantedScopes: ["a"], riskTier: "LOW", approvalProvided: false, callsThisWindow: 0, maxCallsPerMinute: 10 }, ["authority:illuminate"]),
    );
    expect((allow.output as { verdict: string }).verdict).toBe("ALLOW");

    const deny = await registry().invoke(
      "lumen_authority_illumination",
      ctx({ requiredScopes: ["a"], grantedScopes: [], riskTier: "LOW", approvalProvided: false, callsThisWindow: 0, maxCallsPerMinute: 10 }, ["authority:illuminate"]),
    );
    expect((deny.output as { verdict: string }).verdict).toBe("DENY");

    const degrade = await registry().invoke(
      "lumen_authority_illumination",
      ctx({ requiredScopes: ["a"], grantedScopes: ["a"], riskTier: "LOW", approvalProvided: false, callsThisWindow: 10, maxCallsPerMinute: 10 }, ["authority:illuminate"]),
    );
    expect((degrade.output as { verdict: string }).verdict).toBe("DEGRADE");
  });

  it("blocks every foundational skill when its scope is missing (fail-closed)", async () => {
    for (const skill of FOUNDATIONAL_SKILLS) {
      const result = await registry().invoke(skill.id, ctx({}, []));
      expect(result.status).toBe("blocked");
      expect(result.reason).toMatch(/missing required scopes/);
    }
  });
});
