/**
 * HyperCore Ω — MCP interoperability bridge.
 *
 * Exposes the canonical skill fabric as Model Context Protocol tools over
 * JSON-RPC 2.0. The MCP host discovers capabilities with `tools/list` and
 * invokes them with `tools/call`; every call is routed through HyperCore Ω so
 * that CROWN, triangulation and BookPI still apply. MCP transports intent; it
 * does not grant authority.
 */
import { randomUUID } from 'node:crypto';
import { SkillRegistry } from './registry';
import { HyperCoreEngine, type SkillExecutionRequest } from './hypercore-engine';

export interface JsonRpcRequest {
  readonly jsonrpc?: string;
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: string | number | null;
  readonly result?: unknown;
  readonly error?: JsonRpcError;
}

export interface McpToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly annotations?: Readonly<Record<string, unknown>>;
}

export interface McpCallParams {
  readonly name: string;
  readonly arguments?: unknown;
}

export interface McpIdentity {
  readonly actorId: string;
  readonly tenantId: string;
  readonly federationId: string;
  readonly policyVersion: string;
}

export interface SkillMcpServerOptions {
  readonly registry: SkillRegistry;
  readonly engine: HyperCoreEngine;
  readonly identity: McpIdentity;
  readonly resolveScopes: (skillId: string) => readonly string[];
  readonly serverName?: string;
  readonly serverVersion?: string;
  readonly protocolVersion?: string;
}

const MCP_PROTOCOL_VERSION = '2024-11-05';

export class SkillMcpServer {
  private readonly registry: SkillRegistry;
  private readonly engine: HyperCoreEngine;
  private readonly identity: McpIdentity;
  private readonly resolveScopes: (skillId: string) => readonly string[];
  private readonly serverName: string;
  private readonly serverVersion: string;
  private readonly protocolVersion: string;

  constructor(options: SkillMcpServerOptions) {
    this.registry = options.registry;
    this.engine = options.engine;
    this.identity = options.identity;
    this.resolveScopes = options.resolveScopes;
    this.serverName = options.serverName ?? 'isabella-hypercore-omega';
    this.serverVersion = options.serverVersion ?? '2.0.0';
    this.protocolVersion = options.protocolVersion ?? MCP_PROTOCOL_VERSION;
  }

  listTools(): readonly McpToolDescriptor[] {
    return this.registry.list().map((skill) => ({
      name: skill.id,
      description: `Isabella sovereign skill ${skill.id} (v${skill.version}, risk ${skill.riskTier}).`,
      inputSchema: skill.contract?.inputSchema ?? { type: 'object' },
      annotations: {
        riskTier: skill.riskTier,
        requiresEvidence: skill.requiresEvidence,
        readOnlyHint: !skill.contract?.rollback.supported,
      },
    }));
  }

  async handle(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = request.id ?? null;
    switch (request.method) {
      case 'initialize':
        return { jsonrpc: '2.0', id, result: this.initializeResult() };
      case 'notifications/initialized':
        return { jsonrpc: '2.0', id, result: {} };
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: this.listTools() } };
      case 'tools/call':
        return { jsonrpc: '2.0', id, result: await this.callTool(request.params) };
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
    }
  }

  private initializeResult(): unknown {
    return {
      protocolVersion: this.protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: this.serverName, version: this.serverVersion },
    };
  }

  private async callTool(params: unknown): Promise<unknown> {
    if (typeof params !== 'object' || params === null) {
      return { content: [{ type: 'text', text: 'invalid params' }], isError: true };
    }
    const { name, arguments: args } = params as McpCallParams;
    if (typeof name !== 'string' || !this.registry.has(name)) {
      return { content: [{ type: 'text', text: `unknown tool: ${String(name)}` }], isError: true };
    }

    const request: SkillExecutionRequest = {
      skillId: name,
      actorId: this.identity.actorId,
      tenantId: this.identity.tenantId,
      federationId: this.identity.federationId,
      policyVersion: this.identity.policyVersion,
      traceId: randomUUID(),
      input: args ?? {},
      signals:
        typeof args === 'object' &&
        args !== null &&
        'signals' in args &&
        Array.isArray((args as { signals: unknown }).signals)
          ? (args as { signals: string[] }).signals
          : ['mcp:tool_call'],
      grantedScopes: this.resolveScopes(name),
      approvalProvided: false,
      evidenceHashes: [`mcp:${this.serverName}`],
    };

    const result = await this.engine.execute(request);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: result.status,
            phase: result.phase,
            verdict: result.verdict,
            reason: result.reason,
            manifestHash: result.manifestHash,
            latencyMs: result.latencyMs,
            output: result.output,
          }),
        },
      ],
      isError: result.status !== 'COMPLETED',
    };
  }
}
