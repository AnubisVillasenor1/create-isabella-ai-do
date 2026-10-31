import { describe, expect, it } from "vitest";
import { createLocalAgent, LOCAL_AGENT_ID } from "../../src/agents/runtime";
import { KNOWLEDGE_ENTRIES } from "../../src/agents/knowledge";
import type { AgentAuditEvent } from "../../src/agents/types";

function buildAgent() {
  const proposals: Array<{ subject: string; predicate: string; object: string; sourceUri: string | null }> = [];
  const audits: AgentAuditEvent[] = [];
  const agent = createLocalAgent({
    knowledge: KNOWLEDGE_ENTRIES,
    platformStatus: () => ({
      runtime: "isabella-genesis-tina",
      bookpi: "ledger-active",
      providers: "sin proveedor externo",
      turbo: "hypercore-turbo-v2",
      readiness: "consulta /api/v1/readyz",
      skills: 9,
      summary: "Lectura local acotada.",
    }),
    skills: () => [
      { id: "territorial_synthesis", version: "1.0.0", riskTier: "LOW", methodId: "T.TOURISM.E06_UX.synthesize.v1.0.0.LOW.TERRITORIAL" },
    ],
    submitMemoryProposal: (proposal) => {
      proposals.push(proposal);
      return { id: "proposal-test", proposalHash: "a".repeat(64), status: "PENDING_ADMIN_REVIEW" };
    },
    onAudit: (event) => audits.push(event),
  });
  return { agent, proposals, audits };
}

describe("LocalAgentRuntime", () => {
  it("describes itself as free, deterministic and network-free", () => {
    const { agent } = buildAgent();
    const description = agent.describe();
    expect(description.id).toBe(LOCAL_AGENT_ID);
    expect(description.modelRequired).toBe(false);
    expect(description.networkRequired).toBe(false);
    expect(description.free).toBe(true);
    expect(description.tools.map((tool) => tool.id)).toContain("math.calculate");
    expect(description.tools.map((tool) => tool.id)).toContain("memory.proposal");
  });

  it("answers arithmetic with a bounded local tool and records an audit event", async () => {
    const { agent, audits } = buildAgent();
    const result = await agent.run({ input: "calcula (18*7)+15/3", approvalGranted: false });
    expect(result.success).toBe(true);
    expect(result.answer).toContain("131");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ toolId: "math.calculate", status: "OK", sideEffect: "read" });
    expect(result.policy).toMatchObject({
      authority: "none",
      execution: "local-tools-only",
      modelUsed: false,
      externalNetworkUsed: false,
      writesPerformed: 0,
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ status: "COMPLETED", riskTier: "LOW", toolIds: ["math.calculate"] });
  });

  it("answers time, platform status and skills without external calls", async () => {
    const { agent } = buildAgent();
    const time = await agent.run({ input: "¿qué hora es?", approvalGranted: false });
    expect(time.answer).toContain("America/Mexico_City");
    const status = await agent.run({ input: "estado del nodo", approvalGranted: false });
    expect(status.answer).toContain("hypercore-turbo-v2");
    const skills = await agent.run({ input: "skills disponibles", approvalGranted: false });
    expect(skills.answer).toContain("territorial_synthesis");
  });

  it("summarises text locally and discloses the extractive method", async () => {
    const { agent } = buildAgent();
    const text = "La gobernanza exige evidencia verificable. BookPI registra eventos encadenados. " +
      "Los agentes locales no usan red externa. Las escrituras requieren aprobación humana. " +
      "La latencia se mide localmente por proceso.";
    const result = await agent.run({ input: `resume: ${text}`, approvalGranted: false });
    expect(result.success).toBe(true);
    expect(result.answer).toContain("Resumen extractivo local");
    expect(result.steps[0]?.toolId).toBe("text.summarize");
  });

  it("blocks canonical memory writes without a server-verified approval", async () => {
    const { agent, proposals } = buildAgent();
    const command = '/proponer {"subject":"Isabella","predicate":"usa","object":"HyperCore Turbo","sourceUri":"https://example.com/source"}';
    const result = await agent.run({ input: command, approvalGranted: false });
    expect(result.success).toBe(true);
    expect(result.answer).toContain("aprobación administrativa");
    expect(result.policy.approvalRequired).toBe(true);
    expect(result.policy.blockedActions).toBe(1);
    expect(result.policy.writesPerformed).toBe(0);
    expect(result.steps[0]?.status).toBe("BLOCKED");
    expect(proposals).toHaveLength(0);
  });

  it("executes an approved memory proposal without mutating canonical memory", async () => {
    const { agent, proposals } = buildAgent();
    const command = '/proponer {"subject":"Isabella","predicate":"usa","object":"HyperCore Turbo","sourceUri":"https://example.com/source"}';
    const result = await agent.run({ input: command, approvalGranted: true });
    expect(result.success).toBe(true);
    expect(result.policy.writesPerformed).toBe(1);
    expect(result.policy.approvalGranted).toBe(true);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ subject: "Isabella", predicate: "usa", object: "HyperCore Turbo" });
    expect(result.answer).toContain("no");
    expect(result.answer.toLowerCase()).toContain("memoria canónica");
  });

  it("rejects unknown agents, empty input and oversized input", async () => {
    const { agent } = buildAgent();
    const unknown = await agent.run({ agentId: "shell-agent", input: "hola", approvalGranted: false });
    expect(unknown.success).toBe(false);
    expect(unknown.error).toBe("AGENT_NOT_FOUND");
    const empty = await agent.run({ input: "  ", approvalGranted: false });
    expect(empty.error).toBe("AGENT_INPUT_REQUIRED");
    const oversized = await agent.run({ input: "a".repeat(4_001), approvalGranted: false });
    expect(oversized.error).toBe("AGENT_INPUT_TOO_LARGE");
  });

  it("answers from the curated knowledge base without claiming web access", async () => {
    const { agent } = buildAgent();
    const result = await agent.run({ input: "¿qué es HyperCore Turbo?", approvalGranted: false });
    expect(result.success).toBe(true);
    expect(result.answer).toContain("Base de conocimiento local");
    expect(result.answer).toContain("sin búsqueda web");
    expect(result.policy.externalNetworkUsed).toBe(false);
  });

  it("never exposes executable identifiers through the math path", async () => {
    const { agent } = buildAgent();
    const result = await agent.run({ input: "calcula process.exit(1)", approvalGranted: false });
    expect(result.success).toBe(true);
    expect(result.answer).toMatch(/no pude interpretar|no es válida/i);
    expect(result.answer).not.toContain("exit(1) =");
  });
});
