import { describe, expect, it } from "vitest";
import { CANONICAL_SKILLS, SkillRegistry, sha256, type SkillDescriptor } from "../../src/skills";

function registry(): SkillRegistry {
  const reg = new SkillRegistry();
  for (const skill of CANONICAL_SKILLS) reg.register(skill);
  return reg;
}

const ctx = (input: unknown, grantedScopes: string[] = [], signals: string[] = []) => ({
  requestId: "req-1",
  traceId: "trace-1",
  input,
  signals,
  grantedScopes,
});

describe("CSF-Ω v2.0.0 canonical catalog", () => {
  it("declares a complete, scoped contract for every skill", () => {
    expect(CANONICAL_SKILLS.length).toBeGreaterThanOrEqual(6);
    for (const skill of CANONICAL_SKILLS) {
      expect(skill.version).toBe("2.0.0");
      expect(skill.contract).toBeDefined();
      expect(skill.contract?.authority.requiredScopes.length).toBeGreaterThan(0);
      expect(skill.contract?.inputSchema).toBeTypeOf("object");
      expect(skill.contract?.outputSchema).toBeTypeOf("object");
      expect(skill.contract?.limits.maxLatencyMs).toBeGreaterThan(0);
      expect(skill.contract?.evidencePolicy.retentionDays).toBeGreaterThan(0);
    }
  });

  it("exposes a stable catalog manifest digest", () => {
    const reg = registry();
    expect(reg.manifest()).toMatch(/^[0-9a-f]{64}$/);
    expect(reg.manifest()).toBe(registry().manifest());
  });

  it("executes territorial_library_synthesis and seals an execution manifest", async () => {
    const result = await registry().invoke("territorial_library_synthesis", ctx({}, ["territory:library:read"]));
    expect(result.status).toBe("ok");
    const output = result.output as { modules: string[]; apiGroups: string[]; tamvModules: string[]; digest: string };
    expect(output.modules.length).toBeGreaterThan(0);
    expect(output.apiGroups.length).toBeGreaterThan(0);
    expect(output.tamvModules.length).toBeGreaterThan(0);
    expect(output.digest).toBe(sha256({ modules: output.modules, apiGroups: output.apiGroups, tamvModules: output.tamvModules }));
    expect(result.evidence?.map((e) => e.type)).toEqual(["input_digest", "output_digest", "execution_manifest"]);
    expect(result.evidence?.[2]?.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("blocks execution when a required scope is missing (fail-closed)", async () => {
    const result = await registry().invoke("territorial_library_synthesis", ctx({}, []));
    expect(result.status).toBe("blocked");
    expect(result.reason).toMatch(/missing required scopes/);
  });

  it("blocks execution when the input contract is violated", async () => {
    const result = await registry().invoke("sovereign_ingestion_pipeline", ctx({ id: "doc-1" }, ["memory:ingest"]));
    expect(result.status).toBe("blocked");
    expect(result.reason).toMatch(/input contract violated/);
  });

  it("runs the sovereign ingestion pipeline and returns a manifest digest", async () => {
    const result = await registry().invoke(
      "sovereign_ingestion_pipeline",
      ctx({ id: "doc-1", content: "contenido limpio", source: "isabella:test" }, ["memory:ingest"]),
    );
    expect(result.status).toBe("ok");
    const output = result.output as { manifestDigest: string };
    expect(output.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("seals an evidence manifest deterministically", async () => {
    const manifest = { kind: "audit", count: 3 };
    const result = await registry().invoke("evidence_manifest_seal", ctx({ manifest }, ["bookpi:evidence:seal"], ["signal.evidence"]));
    expect(result.status).toBe("ok");
    const output = result.output as { sealed: boolean; manifestDigest: string };
    expect(output.sealed).toBe(true);
    expect(output.manifestDigest).toBe(sha256(manifest));
  });

  it("requires step-up approval for medium-risk settlement skills", async () => {
    const result = await registry().invoke(
      "bookpi_royalty_distribution",
      ctx({ totalRevenueWei: "1000", shares: [{ federationId: 1, basisPoints: 10_000, walletAddress: "0xabc" }] }, ["finance:royalties:settle"], ["signal.evidence"]),
    );
    expect(result.status).toBe("blocked");
    expect(result.reason).toMatch(/human approval required/);
  });
});

describe("HyperCore Ω post-execution verification", () => {
  function withContract(handler: SkillDescriptor["handler"]): SkillDescriptor {
    return {
      id: "verify_probe",
      version: "2.0.0",
      methodId: "A.TWINS.E09_MEMORY.verify_probe.v2.0.0.LOW.INSTITUTIONAL",
      riskTier: "LOW",
      requiresEvidence: false,
      contract: {
        inputSchema: { type: "object" },
        outputSchema: { type: "object", required: ["ok"], properties: { ok: { const: true } } },
        authority: { requiredScopes: ["probe:run"], requiresStepUp: false, requiresQuorum: false },
        evidencePolicy: { required: false, piiRedaction: false, retentionDays: 1 },
        limits: { maxLatencyMs: 100, maxMemoryMb: 64, maxCallsPerMinute: 60, maxEnergyUnits: 10 },
        rollback: { supported: false, strategy: "none" },
      },
      handler,
    };
  }

  it("rejects an output that violates the output contract", async () => {
    const reg = new SkillRegistry();
    reg.register(withContract(async () => ({ ok: false })));
    const result = await reg.invoke("verify_probe", ctx({}, ["probe:run"]));
    expect(result.status).toBe("error");
    expect(result.reason).toMatch(/output contract violated/);
  });

  it("fails closed when the execution manifest cannot be sealed", async () => {
    const reg = new SkillRegistry();
    reg.register({
      ...withContract(async () => ({ ok: true, extra: 1n })),
      contract: {
        ...withContract(async () => ({})).contract!,
        outputSchema: { type: "object" },
      },
    });
    const result = await reg.invoke("verify_probe", ctx({}, ["probe:run"]));
    expect(result.status).toBe("error");
    expect(result.reason).toMatch(/manifest could not be sealed/);
  });

  it("reports a handler exception as an error, never as success", async () => {
    const reg = new SkillRegistry();
    reg.register(withContract(async () => {
      throw new Error("boom");
    }));
    const result = await reg.invoke("verify_probe", ctx({}, ["probe:run"]));
    expect(result.status).toBe("error");
    expect(result.reason).toMatch(/handler threw/);
  });
});
