/**
 * Allowlisted tools for the free local agent. state: wired | tested (unit).
 * No shell, no filesystem, no outbound network, no environment access. Each tool
 * validates its own bounded input and returns plain data. Write tools declare
 * requiresApproval and are blocked by the runtime unless an operator approved them.
 */
import { evaluateArithmetic } from './math';
import type { KnowledgeEntry } from './knowledge';
import type { AgentTool, AgentToolContext, AgentToolResult } from './types';

export interface AgentToolDependencies {
  readonly knowledge: readonly KnowledgeEntry[];
  readonly platformStatus: () => Record<string, unknown>;
  readonly skills: () => ReadonlyArray<{
    id: string;
    version: string;
    riskTier: string;
    methodId: string;
  }>;
  readonly submitMemoryProposal?: (proposal: {
    subject: string;
    predicate: string;
    object: string;
    sourceUri: string | null;
  }) => { id: string; proposalHash: string; status: string };
}

const STOPWORDS = new Set([
  'de',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'en',
  'por',
  'para',
  'con',
  'sin',
  'que',
  'como',
  'cual',
  'cuales',
  'es',
  'son',
  'esta',
  'este',
  'estos',
  'estas',
  'mi',
  'mis',
  'tu',
  'tus',
  'su',
  'sus',
  'al',
  'del',
  'se',
  'lo',
  'le',
  'me',
  'te',
  'nos',
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'on',
  'for',
  'and',
  'or',
  'is',
  'are',
  'what',
  'how',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stem(token: string): string {
  if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function tokenizeForSearch(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9ñ]+/)
    .map(stem)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function stringField(input: Record<string, unknown>, key: string, maxChars: number): string | null {
  const value = input[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxChars);
}

function clip(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 1)}…`;
}

// ICU bootstrap costs ~300 ms on first construction; pay it at import, not on the
// first user request, and reuse the formatter for every clock call.
const mexicoCityFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  dateStyle: 'full',
  timeStyle: 'long',
});

function formatMexicoCity(now: Date): string {
  return mexicoCityFormatter.format(now);
}

function summarizeText(text: string): {
  summary: string;
  sentencesUsed: number;
  originalChars: number;
} {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const sentences =
    cleaned
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
  if (sentences.length <= 3) {
    return {
      summary: clip(sentences.join(' ') || cleaned, 700),
      sentencesUsed: Math.min(3, sentences.length),
      originalChars: cleaned.length,
    };
  }
  const frequencies = new Map<string, number>();
  for (const token of tokenizeForSearch(cleaned))
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  const scored = sentences.map((sentence, index) => {
    const tokens = tokenizeForSearch(sentence);
    const score =
      tokens.reduce((total, token) => total + (frequencies.get(token) ?? 0), 0) /
      Math.max(1, tokens.length);
    return { sentence, index, score };
  });
  const selected = [...scored]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);
  return {
    summary: clip(selected.map((entry) => entry.sentence).join(' '), 900),
    sentencesUsed: selected.length,
    originalChars: cleaned.length,
  };
}

interface IndexedKnowledgeEntry {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly source: string;
  readonly titleTokens: ReadonlySet<string>;
  readonly tagTokens: ReadonlySet<string>;
  readonly bodyTokens: ReadonlySet<string>;
}

function indexKnowledge(entries: readonly KnowledgeEntry[]): IndexedKnowledgeEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    snippet: clip(entry.body, 340),
    source: entry.source,
    titleTokens: new Set(tokenizeForSearch(entry.title)),
    tagTokens: new Set(tokenizeForSearch(entry.tags.join(' '))),
    bodyTokens: new Set(tokenizeForSearch(entry.body)),
  }));
}

function searchKnowledge(
  entries: readonly IndexedKnowledgeEntry[],
  query: string
): Array<{ id: string; title: string; snippet: string; source: string; score: number }> {
  const queryTokens = tokenizeForSearch(query);
  if (queryTokens.length === 0) return [];
  return entries
    .map((entry) => {
      let score = 0;
      for (const token of queryTokens) {
        if (entry.titleTokens.has(token)) score += 5;
        else if (entry.tagTokens.has(token)) score += 3;
        else if (entry.bodyTokens.has(token)) score += 1;
      }
      return {
        id: entry.id,
        title: entry.title,
        snippet: entry.snippet,
        source: entry.source,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3);
}

const CLOCK_TOOL: AgentTool = {
  id: 'clock.now',
  name: 'Hora del servidor',
  description: 'Devuelve la hora UTC y la fecha/hora de America/Mexico_City del proceso.',
  sideEffect: 'read',
  requiresApproval: false,
  maxInputBytes: 512,
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  async run(): Promise<AgentToolResult> {
    const now = new Date();
    return {
      ok: true,
      summary: `Hora del servidor: ${now.toISOString()}`,
      output: {
        utc: now.toISOString(),
        mexicoCity: formatMexicoCity(now),
        unixMs: now.getTime(),
      },
    };
  },
};

const MATH_TOOL: AgentTool = {
  id: 'math.calculate',
  name: 'Calculadora segura',
  description:
    'Evalúa aritmética con + - * / % ^ y paréntesis sin usar eval() ni acceder al runtime.',
  sideEffect: 'read',
  requiresApproval: false,
  maxInputBytes: 1_024,
  inputSchema: {
    type: 'object',
    required: ['expression'],
    additionalProperties: false,
    properties: { expression: { type: 'string', maxLength: 120 } },
  },
  async run(input): Promise<AgentToolResult> {
    const expression = stringField(input, 'expression', 120);
    if (!expression)
      return { ok: false, summary: 'Falta la expresión aritmética.', output: { valid: false } };
    const result = evaluateArithmetic(expression);
    if (!result.ok) {
      return {
        ok: true,
        summary: `La expresión no es válida (${result.error}).`,
        output: { valid: false, expression, error: result.error },
      };
    }
    return {
      ok: true,
      summary: `${expression} = ${result.value}`,
      output: { valid: true, expression, value: result.value },
    };
  },
};

const SUMMARIZE_TOOL: AgentTool = {
  id: 'text.summarize',
  name: 'Resumen extractivo',
  description:
    'Resume localmente un texto corto seleccionando sus oraciones con mayor densidad de términos.',
  sideEffect: 'read',
  requiresApproval: false,
  maxInputBytes: 6_000,
  inputSchema: {
    type: 'object',
    required: ['text'],
    additionalProperties: false,
    properties: { text: { type: 'string', minLength: 40, maxLength: 4_000 } },
  },
  async run(input): Promise<AgentToolResult> {
    const text = stringField(input, 'text', 4_000);
    if (!text || text.length < 40)
      return {
        ok: false,
        summary: 'El texto es demasiado corto para resumir.',
        output: { valid: false },
      };
    const result = summarizeText(text);
    return {
      ok: true,
      summary: result.summary,
      output: { valid: true, ...result, method: 'extractive-frequency' },
    };
  },
};

const KNOWLEDGE_QUERY_CACHE_LIMIT = 128;

function createKnowledgeTool(entries: readonly KnowledgeEntry[]): AgentTool {
  const index = indexKnowledge(entries);
  const cache = new Map<string, ReturnType<typeof searchKnowledge>>();
  return {
    id: 'knowledge.search',
    name: 'Base de conocimiento local',
    description:
      'Busca en una base curada y versionada del repositorio; no consulta internet ni memoria privada.',
    sideEffect: 'read',
    requiresApproval: false,
    maxInputBytes: 2_048,
    inputSchema: {
      type: 'object',
      required: ['query'],
      additionalProperties: false,
      properties: { query: { type: 'string', maxLength: 500 } },
    },
    async run(input): Promise<AgentToolResult> {
      const query = stringField(input, 'query', 500);
      if (!query) return { ok: false, summary: 'Falta la consulta.', output: { results: [] } };
      const cacheKey = query.toLowerCase();
      let results = cache.get(cacheKey);
      if (!results) {
        results = searchKnowledge(index, query);
        if (cache.size >= KNOWLEDGE_QUERY_CACHE_LIMIT) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(cacheKey, results);
      }
      return {
        ok: true,
        summary:
          results.length > 0
            ? `${results.length} entradas locales encontradas.`
            : 'Sin coincidencias en la base local.',
        output: { query, results, corpus: 'curated-local', externalNetworkUsed: false },
      };
    },
  };
}

function createPlatformStatusTool(status: () => Record<string, unknown>): AgentTool {
  return {
    id: 'platform.status',
    name: 'Estado del nodo',
    description:
      'Devuelve un resumen acotado del estado del runtime, BookPI, proveedores y HyperCore Turbo.',
    sideEffect: 'read',
    requiresApproval: false,
    maxInputBytes: 512,
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    async run(): Promise<AgentToolResult> {
      const snapshot = status();
      return {
        ok: true,
        summary:
          typeof snapshot.summary === 'string' ? snapshot.summary : 'Estado del nodo disponible.',
        output: snapshot,
      };
    },
  };
}

function createSkillsTool(skills: AgentToolDependencies['skills']): AgentTool {
  return {
    id: 'skills.list',
    name: 'Catálogo de skills',
    description: 'Lista las skills registradas con su versión, riesgo y método; no las ejecuta.',
    sideEffect: 'read',
    requiresApproval: false,
    maxInputBytes: 512,
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    async run(): Promise<AgentToolResult> {
      const all = skills();
      const listed = all.slice(0, 24);
      return {
        ok: true,
        summary: `${all.length} skills registradas; ${listed.length} mostradas.`,
        output: { count: all.length, skills: listed, execution: 'not-performed' },
      };
    },
  };
}

function createMemoryProposalTool(deps: AgentToolDependencies): AgentTool {
  return {
    id: 'memory.proposal',
    name: 'Propuesta de memoria',
    description:
      'Envía una propuesta a la cola de revisión; no modifica la memoria canónica y requiere aprobación.',
    sideEffect: 'write',
    requiresApproval: true,
    maxInputBytes: 2_048,
    inputSchema: {
      type: 'object',
      required: ['subject', 'predicate', 'object'],
      additionalProperties: false,
      properties: {
        subject: { type: 'string', maxLength: 200 },
        predicate: { type: 'string', maxLength: 200 },
        object: { type: 'string', maxLength: 200 },
        sourceUri: { type: 'string', maxLength: 500 },
      },
    },
    async run(input, context: AgentToolContext): Promise<AgentToolResult> {
      if (!deps.submitMemoryProposal)
        return { ok: false, summary: 'La cola de propuestas no está disponible.', output: {} };
      const subject = stringField(input, 'subject', 200);
      const predicate = stringField(input, 'predicate', 200);
      const object = stringField(input, 'object', 200);
      if (!subject || !predicate || !object)
        return { ok: false, summary: 'subject, predicate y object son requeridos.', output: {} };
      const sourceUri = stringField(input, 'sourceUri', 500);
      if (sourceUri && !/^https?:\/\//i.test(sourceUri)) {
        return { ok: false, summary: 'sourceUri debe ser una URL http(s) o omitirse.', output: {} };
      }
      try {
        const stored = deps.submitMemoryProposal({ subject, predicate, object, sourceUri });
        return {
          ok: true,
          summary: `Propuesta ${stored.id} registrada para revisión humana.`,
          output: {
            ...stored,
            canonicalMemoryMutated: false,
            persistence: 'IN_MEMORY_REVIEW_QUEUE',
            approvalContext: context.approvalGranted,
          },
        };
      } catch (error) {
        return {
          ok: false,
          summary: 'La propuesta no pudo registrarse.',
          output: { error: error instanceof Error ? error.message : 'MEMORY_PROPOSAL_FAILED' },
        };
      }
    },
  };
}

export function createAgentTools(deps: AgentToolDependencies): AgentTool[] {
  return [
    CLOCK_TOOL,
    MATH_TOOL,
    SUMMARIZE_TOOL,
    createKnowledgeTool(deps.knowledge),
    createPlatformStatusTool(deps.platformStatus),
    createSkillsTool(deps.skills),
    createMemoryProposalTool(deps),
  ];
}
