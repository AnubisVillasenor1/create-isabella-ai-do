import { createHash } from 'node:crypto';
import type { RiskTier } from '../authority/method-id';
import { parseMethodId } from '../authority/method-id';
import type { ApprovalRef } from '../identity/approval';
import { verifyHumanApproval } from '../identity/approval';
import type { Principal } from '../identity/principal';
import { inspectAegisInput } from '../security/aegis';

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
  status: 'ok' | 'error' | 'blocked';
}

/**
 * Evento canónico de BookPI (`BookPiEventInput`, siete cadenas). El registro no importa
 * `src/bookpi` para no acoplar el plano de ejecución al adaptador de almacenamiento: quien
 * construye el registro inyecta el sumidero que elija (ledger en memoria, JSONL, Postgres).
 */
export interface ToolSealEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly methodId: string;
  readonly principal: string;
  readonly riskTier: string;
  readonly status: string;
}

export interface ToolRegistryOptions {
  readonly seal?: (event: ToolSealEvent) => void | Promise<void>;
  readonly newEventId?: () => string;
}

export interface ToolRegistryDiagnostics {
  readonly configured: boolean;
  readonly sealedEvents: number;
  readonly sealFailures: number;
  readonly withheldResults: number;
  readonly tools: number;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();
  private seal?: (event: ToolSealEvent) => void | Promise<void>;
  private newEventId?: () => string;
  private sealedEvents = 0;
  private sealFailures = 0;
  private withheldResults = 0;

  constructor(options: ToolRegistryOptions = {}) {
    this.seal = options.seal;
    this.newEventId = options.newEventId;
  }

  /**
   * El runtime Genesis construye el registro mucho antes de que el servidor elija el
   * almacenamiento de BookPI, así que el sello se adjunta al montar. Se adjunta una sola vez:
   * reemplazarlo en caliente permitiría silenciar la evidencia de las ejecuciones en curso.
   */
  attachEvidenceSeal(seal: (event: ToolSealEvent) => void | Promise<void>): void {
    if (this.seal !== undefined) throw new Error('TOOLS: evidence seal is already attached');
    this.seal = seal;
  }

  register(tool: ToolDescriptor): void {
    if (this.tools.has(tool.id)) throw new Error(`TOOLS: duplicate tool ${tool.id}`);
    if (!tool.id || !tool.methodId || !tool.owner || !tool.description)
      throw new Error('TOOLS: descriptor metadata is incomplete.');
    if (tool.scopes.length === 0) throw new Error(`TOOLS: ${tool.id} requires at least one scope.`);
    // §5 AGENTS.md: el methodId es la llave de la trazabilidad. Un id que no parsea produce
    // eventos de evidencia ilegibles para cualquier verificador, así que se rechaza aquí,
    // donde todavía es barato, y no dentro del ledger, donde ya es historia.
    try {
      parseMethodId(tool.methodId);
    } catch (error) {
      throw new Error(
        `TOOLS: ${tool.id} declares a non-canonical methodId '${tool.methodId}' (${
          error instanceof Error ? error.message : String(error)
        })`
      );
    }
    this.tools.set(tool.id, Object.freeze({ ...tool }));
  }

  diagnostics(): ToolRegistryDiagnostics {
    return {
      configured: this.seal !== undefined,
      sealedEvents: this.sealedEvents,
      sealFailures: this.sealFailures,
      withheldResults: this.withheldResults,
      tools: this.tools.size,
    };
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
    authorization: ToolAuthorization = {}
  ): Promise<{ output: unknown; receipt: ToolReceipt }> {
    const tool = this.get(id);
    if (!tool.scopes.includes(scope)) throw new Error(`TOOLS: scope denied for ${id}`);

    const inspection = inspectAegisInput(input);
    const serializedInput = inspection.serialized ?? '[UNSERIALIZABLE_INPUT]';
    const aegis = inspection.verdict;
    const startedAt = new Date().toISOString();
    const inputHash = hashSerialized(serializedInput);

    if (aegis.decision !== 'ALLOW') {
      const receipt = makeReceipt(
        tool,
        principal,
        inputHash,
        serializedInput,
        startedAt,
        'blocked'
      );
      await this.sealEvent(receipt, tool, `AEGIS_${aegis.decision}`);
      throw Object.assign(
        new Error(
          `TOOLS: AEGIS blocked execution; AEGIS ${aegis.decision} requires review; execution denied for ${id}`
        ),
        { receipt, findings: aegis.findings }
      );
    }

    const privileged = tool.riskTier === 'HIGH' || tool.riskTier === 'CRITICAL';
    if (privileged) {
      const validApproval =
        authorization.approval?.decision === 'ALLOW' &&
        verifyHumanApproval(authorization.approval, {
          methodId: tool.methodId,
          action: `tool:${tool.id}`,
          resource: `tool:${tool.id}`,
          principalId: principal.id,
          contextHash: authorization.contextHash,
          policyVersion: authorization.policyVersion,
        });

      if (!validApproval) {
        const receipt = makeReceipt(
          tool,
          principal,
          inputHash,
          'approval-required',
          startedAt,
          'blocked'
        );
        await this.sealEvent(receipt, tool, 'APPROVAL_REQUIRED');
        throw Object.assign(new Error(`TOOLS: human approval required for ${id}`), { receipt });
      }
    }

    let output: unknown;
    try {
      output = await tool.execute(input, principal);
    } catch (error) {
      const receipt = makeReceipt(tool, principal, inputHash, String(error), startedAt, 'error');
      await this.sealEvent(receipt, tool, 'EXECUTION_FAILED');
      throw Object.assign(new Error('TOOLS: execution failed'), { cause: error, receipt });
    }

    const receipt = makeReceipt(tool, principal, inputHash, output, startedAt, 'ok');
    // El sello va ANTES de entregar la salida: una ejecución con efectos reales y sin
    // evidencia no se convierte en autoridad del llamador (§1 AGENTS.md).
    const seal = await this.sealEvent(receipt, tool, 'EXECUTED');
    if (!seal.ok) {
      this.withheldResults += 1;
      throw Object.assign(
        new Error(
          `TOOLS: execution of ${id} produced an effect that BookPI could not record; result withheld (${seal.error})`
        ),
        { cause: seal.cause, receipt, evidence: this.diagnostics() }
      );
    }
    return { output, receipt };
  }

  list(): readonly ToolDescriptor[] {
    return [...this.tools.values()];
  }

  /**
   * Escribe la evidencia y dice en serio si quedó en el libro. Sin sumidero inyectado la
   * ejecución sigue siendo válida —es el comportamiento histórico del registro— pero queda
   * visible en `diagnostics().configured === false`: capacidad sin evidencia, no evidencia falsa.
   */
  private async sealEvent(
    receipt: ToolReceipt,
    tool: ToolDescriptor,
    outcome: string
  ): Promise<{ ok: boolean; error?: string; cause?: unknown }> {
    const seal = this.seal;
    if (seal === undefined) return { ok: true };
    const event: ToolSealEvent = {
      id: this.newEventId?.() ?? `tool-${receipt.receiptId}`,
      timestamp: receipt.completedAt,
      type: 'TOOL_EXECUTION',
      methodId: tool.methodId,
      principal: receipt.principalId,
      riskTier: tool.riskTier,
      status: `${outcome}:${receipt.status}`,
    };
    try {
      await seal(event);
      this.sealedEvents += 1;
      return { ok: true };
    } catch (error) {
      this.sealFailures += 1;
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        cause: error,
      };
    }
  }
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '[UNSERIALIZABLE_INPUT]';
  } catch {
    return '[UNSERIALIZABLE_INPUT]';
  }
}

function hashSerialized(serialized: string): string {
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
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
  status: ToolReceipt['status']
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
