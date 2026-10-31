/**
 * Isabella Local Agent — free, deterministic, tool-using runtime.
 * state: wired | tested (unit).
 *
 * It works without an LLM, API key or outbound network. The agent can only call
 * tools registered in this process. Writes require an approval flag decided by the
 * HTTP layer from a verified administrative bearer token; the request body cannot
 * grant approval. Every run is designed to be sealed into BookPI by the caller.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  detectLocalIntent,
  extractMathExpression,
  normalizeLocalInput,
  type LocalIntent,
} from '../inference/local-fast-lane';
import { KNOWLEDGE_ENTRIES } from './knowledge';
import { createAgentTools, type AgentToolDependencies } from './tools';
import type {
  AgentAuditEvent,
  AgentPolicyReport,
  AgentRunInput,
  AgentRunResult,
  AgentStep,
  AgentStepStatus,
  AgentTool,
  AgentToolResult,
} from './types';

export const LOCAL_AGENT_ID = 'isabella-local';
export const MAX_AGENT_INPUT_CHARS = 4_000;
const MAX_TOOL_CALLS = 3;
const TOOL_TIMEOUT_MS = 1_500;

export interface LocalAgentDependencies extends AgentToolDependencies {
  readonly onAudit?: (event: AgentAuditEvent) => void;
}

function hashValue(value: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
  } catch {
    return createHash('sha256').update('unserializable').digest('hex').slice(0, 16);
  }
}

function boundedId(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim().slice(0, 80);
  return /^[a-zA-Z0-9._:-]+$/.test(trimmed) ? trimmed : fallback;
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('TOOL_TIMEOUT')), milliseconds);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toolSummaryLine(toolId: string, result: AgentToolResult): string {
  return `${toolId}: ${result.summary}`;
}

function buildKnowledgeAnswer(output: Record<string, unknown>): string {
  const results = Array.isArray(output.results) ? output.results : [];
  if (results.length === 0) {
    return [
      'No encontré una entrada relevante en la base local curada de Isabella.',
      '',
      'Puedo resolver ahora mismo: hora del servidor, aritmética, resumen extractivo de un texto, estado del nodo, catálogo de skills y consultas a esa base local. Para una pregunta general, el motor Auto consultará un proveedor externo solo si está configurado; no voy a inventar una respuesta ni afirmar que consulté la web.',
    ].join('\n');
  }
  const lines = [
    '**Base de conocimiento local de Isabella** — resultados curados, sin búsqueda web:',
    '',
    ...results.slice(0, 3).flatMap((raw, index) => {
      if (!raw || typeof raw !== 'object') return [];
      const entry = raw as Record<string, unknown>;
      const title = typeof entry.title === 'string' ? entry.title : 'Entrada';
      const snippet = typeof entry.snippet === 'string' ? entry.snippet : '';
      const source = typeof entry.source === 'string' ? entry.source : '';
      return [`${index + 1}. **${title}**`, snippet, source ? `   _Fuente: ${source}_` : '', ''];
    }),
    'Esta respuesta proviene de una base acotada mantenida en el repositorio; no es una búsqueda web ni memoria personal.',
  ];
  return lines
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n')
    .trim();
}

function buildPlatformAnswer(output: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    runtime: 'Runtime',
    version: 'Versión',
    bookpi: 'BookPI',
    providers: 'Proveedores (configuración)',
    turbo: 'HyperCore Turbo',
    readiness: 'Readiness',
    skills: 'Skills',
  };
  const lines = Object.entries(labels).flatMap(([key, label]) => {
    const value = output[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return [`- **${label}:** ${value}`];
    }
    return [];
  });
  return [
    '**Estado del nodo** — lectura local acotada, no un certificado de producción:',
    '',
    ...(lines.length > 0 ? lines : ['- No hay datos de estado disponibles en este proceso.']),
  ].join('\n');
}

function buildSkillsAnswer(output: Record<string, unknown>): string {
  const skills = Array.isArray(output.skills) ? output.skills : [];
  const total = typeof output.count === 'number' ? output.count : skills.length;
  if (skills.length === 0)
    return 'El registro de skills no tiene entradas disponibles en este proceso.';
  const lines = skills.slice(0, 12).map((raw) => {
    if (!raw || typeof raw !== 'object') return '- Skill sin metadatos';
    const skill = raw as Record<string, unknown>;
    const id = typeof skill.id === 'string' ? skill.id : 'skill';
    const version = typeof skill.version === 'string' ? skill.version : '?';
    const risk = typeof skill.riskTier === 'string' ? skill.riskTier : '?';
    return `- \`${id}\` · v${version} · riesgo ${risk}`;
  });
  return [
    `**Skills registradas:** ${total}. Mostrando ${Math.min(12, skills.length)}.`,
    '',
    ...lines,
    '',
    'Listar una skill no la ejecuta ni concede autoridad.',
  ].join('\n');
}

function buildMathAnswer(output: Record<string, unknown>): string {
  if (output.valid !== true || typeof output.value !== 'number') {
    const error = typeof output.error === 'string' ? output.error : 'EXPRESSION_INVALID';
    return `La expresión aritmética no es válida (${error}). Puedes usar números, +, -, *, /, %, ^ y paréntesis.`;
  }
  const expression = typeof output.expression === 'string' ? output.expression : 'expresión';
  return `**Cálculo local:** \`${expression}\` = **${output.value}**\n\nCalculado por \`math.calculate\` sin modelo generativo ni acceso a red.`;
}

function buildClockAnswer(output: Record<string, unknown>): string {
  const utc = typeof output.utc === 'string' ? output.utc : 'desconocida';
  const mexicoCity = typeof output.mexicoCity === 'string' ? output.mexicoCity : 'desconocida';
  return `**Hora del servidor:** ${utc}\n\n**America/Mexico_City:** ${mexicoCity}\n\nLectura local de la herramienta \`clock.now\`.`;
}

function buildAnswer(toolId: string, result: AgentToolResult): string {
  if (toolId === 'math.calculate') return buildMathAnswer(result.output);
  if (toolId === 'clock.now') return buildClockAnswer(result.output);
  if (toolId === 'knowledge.search') return buildKnowledgeAnswer(result.output);
  if (toolId === 'platform.status') return buildPlatformAnswer(result.output);
  if (toolId === 'skills.list') return buildSkillsAnswer(result.output);
  if (toolId === 'text.summarize') {
    const summary =
      typeof result.output.summary === 'string' ? result.output.summary : result.summary;
    return [
      '**Resumen extractivo local**',
      '',
      summary,
      '',
      '_Método: selección de oraciones por frecuencia; no es un resumen generado por un LLM._',
    ].join('\n');
  }
  if (toolId === 'memory.proposal') {
    const hash =
      typeof result.output.proposalHash === 'string' ? result.output.proposalHash : 'sin hash';
    return [
      result.summary,
      '',
      `Hash de la propuesta: \`${hash}\`.`,
      'La memoria canónica **no** fue modificada. La propuesta requiere revisión humana.',
    ].join('\n');
  }
  return result.summary;
}

function guidanceAnswer(): string {
  return [
    'Soy el agente local determinista de Isabella. Puedo ejecutar herramientas acotadas sin shell, sin red externa y sin modelo generativo:',
    '',
    '- **Hora:** «¿qué hora es?».',
    '- **Aritmética:** «calcula (18*7)+15/3».',
    '- **Resumen:** «resume: …» con un texto de 40 a 4 000 caracteres.',
    '- **Estado:** «estado del nodo».',
    '- **Skills:** «skills disponibles».',
    '- **Conocimiento:** preguntas sobre capacidades, límites, API, precios y gobernanza de Isabella.',
    '- **Propuesta de memoria (admin):** `/proponer {"subject":"…","predicate":"…","object":"…"}`.',
    '',
    'Para preguntas generales no cubiertas, el motor Auto puede consultar un proveedor configurado; si no existe, Isabella responde con el fallback soberano y lo declara. No afirmo acceso a web, archivos privados o memoria personal.',
  ].join('\n');
}

interface ExecutedStep {
  readonly step: AgentStep;
  readonly result: AgentToolResult | null;
}

export class LocalAgentRuntime {
  private readonly tools = new Map<string, AgentTool>();
  private readonly onAudit?: (event: AgentAuditEvent) => void;

  constructor(dependencies: LocalAgentDependencies) {
    for (const tool of createAgentTools(dependencies)) this.tools.set(tool.id, tool);
    this.onAudit = dependencies.onAudit;
  }

  describe(): {
    id: string;
    name: string;
    engine: 'local-deterministic';
    modelRequired: false;
    free: true;
    networkRequired: false;
    tools: ReadonlyArray<{
      id: string;
      name: string;
      description: string;
      sideEffect: string;
      requiresApproval: boolean;
      inputSchema: Record<string, unknown>;
    }>;
    approval: string;
  } {
    return {
      id: LOCAL_AGENT_ID,
      name: 'Isabella Local Agent',
      engine: 'local-deterministic',
      modelRequired: false,
      free: true,
      networkRequired: false,
      tools: [...this.tools.values()].map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        sideEffect: tool.sideEffect,
        requiresApproval: tool.requiresApproval,
        inputSchema: tool.inputSchema,
      })),
      approval:
        'Las herramientas de escritura requieren un bearer token administrativo verificado por el servidor; el cuerpo HTTP no puede conceder aprobación.',
    };
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const startedAt = Date.now();
    const requestId = boundedId(input.requestId, `agent-${randomUUID()}`);
    const agentId = input.agentId?.trim() || LOCAL_AGENT_ID;
    const actorId = boundedId(input.actorId, 'human:public-session');
    const tenantId = boundedId(input.tenantId, 'public');
    const text = typeof input.input === 'string' ? input.input.trim() : '';
    const steps: AgentStep[] = [];
    let blockedActions = 0;
    let writesPerformed = 0;
    let approvalRequired = false;
    const toolIds: string[] = [];

    const finish = (success: boolean, answer: string, error?: string): AgentRunResult => {
      const latencyMs = Date.now() - startedAt;
      const policy: AgentPolicyReport = {
        authority: 'none',
        execution: 'local-tools-only',
        modelUsed: false,
        externalNetworkUsed: false,
        approvalRequired,
        approvalGranted: input.approvalGranted,
        writesPerformed,
        blockedActions,
        limits: {
          maxInputChars: MAX_AGENT_INPUT_CHARS,
          maxToolCalls: MAX_TOOL_CALLS,
          toolTimeoutMs: TOOL_TIMEOUT_MS,
        },
      };
      this.onAudit?.({
        requestId,
        agentId,
        actorId,
        tenantId,
        status: success ? 'COMPLETED' : 'ERROR',
        riskTier: 'LOW',
        toolIds,
        approvalGranted: input.approvalGranted,
        latencyMs,
      });
      return {
        success,
        agentId,
        answer,
        engine: 'local-deterministic',
        requestId,
        latencyMs,
        steps,
        policy,
        disclaimers: [
          'Agente local determinista: no usa un modelo de lenguaje ni red externa.',
          'Una lectura o propuesta no concede autoridad ni modifica la memoria canónica.',
        ],
        ...(error ? { error } : {}),
      };
    };

    if (agentId !== LOCAL_AGENT_ID) {
      return finish(
        false,
        'El agente solicitado no está registrado en este proceso.',
        'AGENT_NOT_FOUND'
      );
    }
    if (!text) return finish(false, 'La entrada del agente está vacía.', 'AGENT_INPUT_REQUIRED');
    if (text.length > MAX_AGENT_INPUT_CHARS) {
      return finish(
        false,
        `La entrada excede el límite de ${MAX_AGENT_INPUT_CHARS} caracteres.`,
        'AGENT_INPUT_TOO_LARGE'
      );
    }

    const execute = async (
      toolId: string,
      args: Record<string, unknown>
    ): Promise<ExecutedStep | null> => {
      if (toolIds.length >= MAX_TOOL_CALLS) return null;
      const tool = this.tools.get(toolId);
      const inputHash = hashValue({ toolId, args });
      if (!tool) {
        steps.push({
          toolId,
          status: 'ERROR',
          latencyMs: 0,
          summary: 'Herramienta no registrada.',
          inputHash,
          outputHash: null,
          sideEffect: 'read',
        });
        return null;
      }
      toolIds.push(toolId);
      if (tool.sideEffect === 'admin') {
        blockedActions += 1;
        steps.push({
          toolId,
          status: 'BLOCKED',
          latencyMs: 0,
          summary: 'Herramienta administrativa bloqueada en el agente público.',
          inputHash,
          outputHash: null,
          sideEffect: tool.sideEffect,
        });
        return null;
      }
      if (tool.requiresApproval && !input.approvalGranted) {
        approvalRequired = true;
        blockedActions += 1;
        steps.push({
          toolId,
          status: 'BLOCKED',
          latencyMs: 0,
          summary: 'Requiere aprobación administrativa verificada por el servidor.',
          inputHash,
          outputHash: null,
          sideEffect: tool.sideEffect,
        });
        return { step: steps[steps.length - 1]!, result: null };
      }
      const bytes = Buffer.byteLength(JSON.stringify(args), 'utf8');
      if (bytes > tool.maxInputBytes) {
        steps.push({
          toolId,
          status: 'ERROR',
          latencyMs: 0,
          summary: `Entrada de herramienta excede ${tool.maxInputBytes} bytes.`,
          inputHash,
          outputHash: null,
          sideEffect: tool.sideEffect,
        });
        return null;
      }
      const toolStartedAt = Date.now();
      try {
        const result = await withTimeout(
          tool.run(args, {
            requestId,
            actorId,
            tenantId,
            approvalGranted: input.approvalGranted,
          }),
          TOOL_TIMEOUT_MS
        );
        const latencyMs = Date.now() - toolStartedAt;
        const status: AgentStepStatus = result.ok ? 'OK' : 'ERROR';
        if (result.ok && tool.sideEffect === 'write') writesPerformed += 1;
        const step: AgentStep = {
          toolId,
          status,
          latencyMs,
          summary: result.summary.slice(0, 300),
          inputHash,
          outputHash: hashValue(result.output),
          sideEffect: tool.sideEffect,
        };
        steps.push(step);
        return { step, result };
      } catch (error) {
        const latencyMs = Date.now() - toolStartedAt;
        const summary =
          error instanceof Error && error.message === 'TOOL_TIMEOUT'
            ? 'Tiempo de herramienta agotado.'
            : 'La herramienta falló sin exponer detalles internos.';
        steps.push({
          toolId,
          status: 'ERROR',
          latencyMs,
          summary,
          inputHash,
          outputHash: null,
          sideEffect: tool.sideEffect,
        });
        return null;
      }
    };

    const memoryCommand = /^\/proponer\s+([\s\S]+)$/.exec(text);
    if (memoryCommand) {
      let parsed: Record<string, unknown> | null = null;
      try {
        const candidate = JSON.parse(memoryCommand[1] ?? '');
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate))
          parsed = candidate as Record<string, unknown>;
      } catch {
        parsed = null;
      }
      if (!parsed) {
        return finish(
          true,
          'Formato esperado: `/proponer {"subject":"…","predicate":"…","object":"…","sourceUri":"https://…"}`. No se ejecutó ninguna escritura.'
        );
      }
      const executed = await execute('memory.proposal', parsed);
      if (!executed || !executed.result) {
        return finish(
          true,
          executed
            ? 'La propuesta requiere aprobación administrativa. No se modificó la memoria canónica.'
            : 'No se pudo procesar la propuesta.'
        );
      }
      return finish(executed.result.ok, buildAnswer('memory.proposal', executed.result));
    }

    const summarizeCommand = /^(?:resume|resumen)\s*:\s*([\s\S]+)$/i.exec(text);
    if (summarizeCommand) {
      const candidate = (summarizeCommand[1] ?? '').trim();
      if (candidate.length < 40)
        return finish(true, 'Comparte al menos 40 caracteres de texto para resumir.');
      const executed = await execute('text.summarize', { text: candidate });
      return finish(
        true,
        executed?.result
          ? buildAnswer('text.summarize', executed.result)
          : 'No pude resumir el texto en este intento.'
      );
    }

    const intent: LocalIntent | null = detectLocalIntent(text);
    if (intent === 'calculation') {
      const expression = extractMathExpression(text);
      if (expression) {
        const executed = await execute('math.calculate', { expression });
        if (executed?.result) return finish(true, buildAnswer('math.calculate', executed.result));
      }
      return finish(
        true,
        'No pude interpretar la expresión aritmética. Usa números y operadores + - * / % ^ con paréntesis.'
      );
    }
    if (intent === 'time') {
      const executed = await execute('clock.now', {});
      if (executed?.result) return finish(true, buildAnswer('clock.now', executed.result));
      return finish(true, 'No pude leer la hora del servidor.');
    }
    if (intent === 'platform-status') {
      const executed = await execute('platform.status', {});
      if (executed?.result) return finish(true, buildAnswer('platform.status', executed.result));
      return finish(true, 'No pude obtener el estado del nodo.');
    }
    if (intent === 'skills') {
      const executed = await execute('skills.list', {});
      if (executed?.result) return finish(true, buildAnswer('skills.list', executed.result));
      return finish(true, 'No pude leer el catálogo de skills.');
    }
    if (
      /^(?:calcula|calcular|cuanto es|cuanto da|resuelve|resolver)\b/.test(
        normalizeLocalInput(text)
      )
    ) {
      return finish(
        true,
        'No pude interpretar la expresión aritmética. Usa números y operadores + - * / % ^ con paréntesis; el agente no evalúa código ni identificadores.'
      );
    }

    const executed = await execute('knowledge.search', { query: text });
    if (executed?.result) {
      const hasResults =
        Array.isArray(executed.result.output.results) && executed.result.output.results.length > 0;
      return finish(
        true,
        hasResults ? buildAnswer('knowledge.search', executed.result) : guidanceAnswer()
      );
    }
    return finish(true, guidanceAnswer());
  }
}

export function createLocalAgent(dependencies: LocalAgentDependencies): LocalAgentRuntime {
  return new LocalAgentRuntime(dependencies);
}

export { KNOWLEDGE_ENTRIES };
