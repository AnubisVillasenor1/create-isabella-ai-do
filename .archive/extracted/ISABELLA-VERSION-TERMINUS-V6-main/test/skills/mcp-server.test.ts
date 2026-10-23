import { describe, expect, it } from "vitest";
import {
  CANONICAL_SKILLS,
  HyperCoreEngine,
  SkillMcpServer,
  SkillRegistry,
} from "../../src/skills";

const SCOPES: Record<string, string[]> = {
  territorial_library_synthesis: ["territory:library:read"],
  sovereign_ingestion_pipeline: ["memory:ingest"],
};

function server(grantAll = true): SkillMcpServer {
  const registry = new SkillRegistry();
  for (const skill of CANONICAL_SKILLS) registry.register(skill);
  const engine = new HyperCoreEngine(registry, { signingKey: "mcp-key" });
  return new SkillMcpServer({
    registry,
    engine,
    identity: { actorId: "human-1", tenantId: "tamv", federationId: "f1", policyVersion: "CROWN-v20" },
    resolveScopes: (skillId) => (grantAll ? (SCOPES[skillId] ?? []) : []),
    serverName: "isabella-hypercore-omega",
    serverVersion: "2.0.0",
  });
}

describe("SkillMcpServer (JSON-RPC 2.0)", () => {
  it("answers initialize with protocol version and server info", async () => {
    const response = await server().handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(response.error).toBeUndefined();
    expect((response.result as { protocolVersion: string }).protocolVersion).toBe("2024-11-05");
  });

  it("lists canonical skills as MCP tools", async () => {
    const response = await server().handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tools = (response.result as { tools: { name: string }[] }).tools;
    expect(tools.some((tool) => tool.name === "territorial_library_synthesis")).toBe(true);
    expect(tools).toHaveLength(CANONICAL_SKILLS.length);
  });

  it("executes a tool call through HyperCore Ω", async () => {
    const response = await server().handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "territorial_library_synthesis", arguments: {} },
    });
    const result = response.result as { isError: boolean; content: { text: string }[] };
    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.content[0]!.text) as { status: string; manifestHash: string };
    expect(payload.status).toBe("COMPLETED");
    expect(payload.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reports a denied tool call as an error result", async () => {
    const response = await server(false).handle({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "territorial_library_synthesis", arguments: {} },
    });
    const result = response.result as { isError: boolean };
    expect(result.isError).toBe(true);
  });

  it("returns method-not-found for unknown methods", async () => {
    const response = await server().handle({ jsonrpc: "2.0", id: 5, method: "prompts/list" });
    expect(response.error?.code).toBe(-32601);
  });

  it("returns an error result for an unknown tool", async () => {
    const response = await server().handle({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "ghost", arguments: {} },
    });
    expect((response.result as { isError: boolean }).isError).toBe(true);
  });
});
