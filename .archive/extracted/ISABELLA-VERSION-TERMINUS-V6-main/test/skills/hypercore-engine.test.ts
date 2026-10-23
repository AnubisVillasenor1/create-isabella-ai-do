import { describe, expect, it } from "vitest";
import { InMemoryBookPiLedger } from "../../src/bookpi/ledger";
import {
  CANONICAL_SKILLS,
  HyperCoreEngine,
  SkillRegistry,
  type SkillContract,
  type SkillDescriptor,
  type SkillExecutionRequest,
} from "../../src/skills";

function registry(): SkillRegistry {
  const reg = new SkillRegistry();
  for (const skill of CANONICAL_SKILLS) reg.register(skill);
  return reg;
}

function input(overrides: Partial<SkillExecutionRequest> = {}): SkillExecutionRequest {
  return {
    skillId: "territorial_library_synthesis",
    actorId: "human-1",
    tenantId: "tamv",
    federationId: "federation-1",
    traceId: "trace-1",
    policyVersion: "CROWN-v20",
    input: {},
    signals: ["source:verified"],
    grantedScopes: ["territory:library:read"],
    ...overrides,
  };
}

function contract(overrides: Partial<SkillContract> = {}): SkillContract {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object", required: ["ok"], properties: { ok: { const: true } } },
    authority: { requiredScopes: ["probe:run"], requiresStepUp: false, requiresQuorum: false },
    evidencePolicy: { required: false, piiRedaction: false, retentionDays: 1 },
    limits: { maxLatencyMs: 1000, maxMemoryMb: 64, maxCallsPerMinute: 60, maxEnergyUnits: 10 },
    rollback: { supported: false, strategy: "none" },
    ...overrides,
  };
}

function probe(handler: SkillDescriptor["handler"], overrides: Partial<SkillContract> = {}): SkillRegistry {
  const reg = new SkillRegistry();
  reg.register({
    id: "probe",
    version: "2.0.0",
    methodId: "A.TWINS.E09_MEMORY.probe.v2.0.0.LOW.INSTITUTIONAL",
    riskTier: "LOW",
    requiresEvidence: false,
    contract: contract(overrides),
    handler,
  });
  return reg;
}

describe("HyperCore Ω execution runtime", () => {
  it("completes a governed skill and seals a signed manifest", async () => {
    const ledger = new InMemoryBookPiLedger();
    const engine = new HyperCoreEngine(registry(), { ledger, signingKey: "test-key" });
    const result = await engine.execute(input());
    expect(result.status).toBe("COMPLETED");
    expect(result.phase).toBe(8);
    expect(result.verdict).toBe("ALLOW");
    expect(result.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(result.triangulation?.valid).toBe(true);
    expect(ledger.verify().valid).toBe(true);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0]?.type).toBe("hypercore.execution.completed");
  });

  it("verifies a sealed manifest signature in constant time", async () => {
    const engine = new HyperCoreEngine(registry(), { signingKey: "test-key" });
    const result = await engine.execute(input());
    expect(result.manifestHash).toBeDefined();
    expect(engine.verifySignature(result.manifestHash!, result.signature!)).toBe(true);
    expect(engine.verifySignature(result.manifestHash!, "0".repeat(64))).toBe(false);
    expect(engine.verifySignature(result.manifestHash!, result.signature!.slice(0, -1) + "0")).toBe(false);
  });

  it("blocks at phase 0 when identity is missing", async () => {
    const engine = new HyperCoreEngine(registry());
    const result = await engine.execute(input({ tenantId: "" }));
    expect(result.status).toBe("BLOCKED");
    expect(result.phase).toBe(0);
  });

  it("blocks at phase 1 for an unknown skill", async () => {
    const engine = new HyperCoreEngine(registry());
    const result = await engine.execute(input({ skillId: "nope" }));
    expect(result.status).toBe("BLOCKED");
    expect(result.phase).toBe(1);
  });

  it("blocks at phase 2 when the input violates the contract", async () => {
    const engine = new HyperCoreEngine(registry());
    const result = await engine.execute(
      input({ skillId: "sovereign_ingestion_pipeline", grantedScopes: ["memory:ingest"], input: { id: "x" } }),
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.phase).toBe(2);
  });

  it("blocks at phase 3 when scopes are missing (DENY)", async () => {
    const engine = new HyperCoreEngine(registry());
    const result = await engine.execute(input({ grantedScopes: [] }));
    expect(result.status).toBe("BLOCKED");
    expect(result.phase).toBe(3);
    expect(result.verdict).toBe("DENY");
  });

  it("blocks at phase 3 when a high-risk skill lacks approval (ESCALATE)", async () => {
    const engine = new HyperCoreEngine(registry());
    const result = await engine.execute(
      input({ skillId: "deployment_readiness_arbiter", grantedScopes: ["deployment:assess"], input: {} }),
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.phase).toBe(3);
    expect(result.verdict).toBe("ESCALATE");
  });

  it("blocks at phase 6 when the output violates the triangulation contract", async () => {
    const engine = new HyperCoreEngine(probe(async () => ({ ok: false })));
    const result = await engine.execute(input({ skillId: "probe", grantedScopes: ["probe:run"] }));
    expect(result.status).toBe("BLOCKED");
    expect(result.phase).toBe(6);
    expect(result.triangulation?.contract.outputValid).toBe(false);
  });

  it("fails at phase 5 when the handler throws", async () => {
    const engine = new HyperCoreEngine(
      probe(async () => {
        throw new Error("boom");
      }),
    );
    const result = await engine.execute(input({ skillId: "probe", grantedScopes: ["probe:run"] }));
    expect(result.status).toBe("FAILED");
    expect(result.phase).toBe(5);
  });

  it("fails at phase 5 when the handler exceeds its latency budget", async () => {
    const engine = new HyperCoreEngine(
      probe(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { ok: true };
      }),
    );
    const result = await engine.execute(
      input({ skillId: "probe", grantedScopes: ["probe:run"], budget: { maxLatencyMs: 10 } }),
    );
    expect(result.status).toBe("FAILED");
    expect(result.phase).toBe(5);
  });

  it("fails at phase 8 when BookPI cannot append", async () => {
    const engine = new HyperCoreEngine(registry(), {
      ledger: {
        append() {
          throw new Error("bookpi down");
        },
      },
    });
    const result = await engine.execute(input());
    expect(result.status).toBe("FAILED");
    expect(result.phase).toBe(8);
  });
});
