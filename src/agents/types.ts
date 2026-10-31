export type ToolSideEffect = 'read' | 'write' | 'admin';

export interface AgentToolContext {
  readonly requestId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly approvalGranted: boolean;
}

export interface AgentToolResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly output: Record<string, unknown>;
}

export interface AgentTool {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sideEffect: ToolSideEffect;
  readonly requiresApproval: boolean;
  readonly maxInputBytes: number;
  readonly inputSchema: Record<string, unknown>;
  run(input: Record<string, unknown>, context: AgentToolContext): Promise<AgentToolResult>;
}

export interface AgentToolDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sideEffect: ToolSideEffect;
  readonly requiresApproval: boolean;
  readonly inputSchema: Record<string, unknown>;
}

export type AgentStepStatus = 'OK' | 'BLOCKED' | 'ERROR';

export interface AgentStep {
  readonly toolId: string;
  readonly status: AgentStepStatus;
  readonly latencyMs: number;
  readonly summary: string;
  readonly inputHash: string;
  readonly outputHash: string | null;
  readonly sideEffect: ToolSideEffect;
}

export interface AgentPolicyReport {
  readonly authority: 'none';
  readonly execution: 'local-tools-only';
  readonly modelUsed: false;
  readonly externalNetworkUsed: false;
  readonly approvalRequired: boolean;
  readonly approvalGranted: boolean;
  readonly writesPerformed: number;
  readonly blockedActions: number;
  readonly limits: {
    readonly maxInputChars: number;
    readonly maxToolCalls: number;
    readonly toolTimeoutMs: number;
  };
}

export interface AgentAuditEvent {
  readonly requestId: string;
  readonly agentId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly status: 'COMPLETED' | 'BLOCKED' | 'ERROR';
  readonly riskTier: 'LOW';
  readonly toolIds: readonly string[];
  readonly approvalGranted: boolean;
  readonly latencyMs: number;
}

export interface AgentRunInput {
  readonly agentId?: string;
  readonly input: string;
  readonly approvalGranted: boolean;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly tenantId?: string;
}

export interface AgentRunResult {
  readonly success: boolean;
  readonly agentId: string;
  readonly answer: string;
  readonly engine: 'local-deterministic';
  readonly requestId: string;
  readonly latencyMs: number;
  readonly steps: readonly AgentStep[];
  readonly policy: AgentPolicyReport;
  readonly disclaimers: readonly string[];
  readonly error?: string;
}
