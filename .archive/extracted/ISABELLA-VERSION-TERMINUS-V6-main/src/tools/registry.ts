import { createHash } from "node:crypto";
import type { RiskTier } from "../authority/method-id";
import type { ApprovalRef } from "../identity/approval";
import { verifyHumanApproval } from "../identity/approval";
import type { Principal } from "../identity/principal";
import { inspectAegisInput } from "../security/aegis";

export interface ToolDescriptor {
  id: string;
  version: string;
  methodId: string;
  owner: string;
  riskTier: RiskTier;
  scopes: readonly string[];
  description: string;
  execute: (input: unknown, principal: Principal) => Promise<unknown>;
}

export interface ToolAuthorization {
  approval?: ApprovalRef;
  contextHash?: string;
  policyVersion?: string;
}

export interface ToolReceipt {
  receiptId: string;
  toolId: string;
  methodId: string;
  principalId: string;
  inputHash: string;
  outputHash: string;
  startedAt: string;
  completedAt: string;
  status: "ok" | "error" | "blocked";
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();

  register(tool: ToolDescriptor): void {
    if (this.tools.has(tool.id)) throw new Error(`TOOLS: duplicate tool ${tool.id}`);
    if (!tool.id || !tool.methodId || !tool.owner || !tool.description) throw new Error("TOOLS: descriptor metadata is incomplete.");
    if (tool.scopes.length === 0) throw new Error(`TOOLS: ${tool.id} requires at least one scope.`);
    this.tools.set(tool.id, Object.freeze({ ...tool }));
  }

  get(id: string): ToolDescriptor {
    const tool = this.tools.get(id);
    if (!tool) throw new Error(`TOOLS: unknown tool ${id}`);
    return tool;
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  async execute(
    id: string,
    input: unknown,
    principal: Principal,
    scope: string,
    authorization: ToolAuthorization = {},
  ): Promise<{ output: unknown; receipt: ToolReceipt }> {
    const tool = this.get(id);
    if (!tool.scopes.includes(scope)) throw new Error(`TOOLS: scope denied for ${id}`);

    const inspection = inspectAegisInput(input);
    const serializedInput = inspection.serialized ?? "[UNSERIALIZABLE_INPUT]";
    const aegis = inspection.verdict;
    const startedAt = new Date().toISOString();
    const inputHash = hashSerialized(serializedInput);

    if (aegis.decision !== "ALLOW") {
      const receipt = makeReceipt(tool, principal, inputHash, serializedInput, startedAt, "blocked");
      throw Object.assign(new Error(`TOOLS: AEGIS blocked execution; AEGIS ${aegis.decision} requires review; execution denied for ${id}`), { receipt, findings: aegis.findings });
    }

    const privileged = tool.riskTier === "HIGH" || tool.riskTier === "CRITICAL";
    if (privileged) {
      const validApproval =
        authorization.approval?.decision === "ALLOW" &&
        verifyHumanApproval(authorization.approval, {
          methodId: tool.methodId,
          action: `tool:${tool.id}`,
          resource: `tool:${tool.id}`,
          principalId: principal.id,
          contextHash: authorization.contextHash,
          policyVersion: authorization.policyVersion,
        });

      if (!validApproval) {
        const receipt = makeReceipt(tool, principal, inputHash, "approval-required", startedAt, "blocked");
        throw Object.assign(new Error(`TOOLS: human approval required for ${id}`), { receipt });
      }
    }

    try {
      const output = await tool.execute(input, principal);
      const receipt = makeReceipt(tool, principal, inputHash, output, startedAt, "ok");
      return { output, receipt };
    } catch (error) {
      const receipt = makeReceipt(tool, principal, inputHash, String(error), startedAt, "error");
      throw Object.assign(new Error("TOOLS: execution failed"), { cause: error, receipt });
    }
  }

  list(): readonly ToolDescriptor[] { return [...this.tools.values()]; }
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "[UNSERIALIZABLE_INPUT]";
  } catch {
    return "[UNSERIALIZABLE_INPUT]";
  }
}

function hashSerialized(serialized: string): string {
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

function hash(value: unknown): string {
  return hashSerialized(safeSerialize(value));
}
function makeReceipt(
  tool: ToolDescriptor,
  principal: Principal,
  inputHash: string,
  output: unknown,
  startedAt: string,
  status: ToolReceipt["status"],
): ToolReceipt {
  return {
    receiptId: `tr_${hash({ tool: tool.id, principal: principal.id, inputHash, startedAt }).slice(0, 24)}`,
    toolId: tool.id,
    methodId: tool.methodId,
    principalId: principal.id,
    inputHash,
    outputHash: hash(output),
    startedAt,
    completedAt: new Date().toISOString(),
    status,
  };
}
