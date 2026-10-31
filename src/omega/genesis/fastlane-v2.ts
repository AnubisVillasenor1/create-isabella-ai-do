// state: draft | engine-generated — Adaptive Semantic Fastlane 2.0 (Documento §IV).
// Reemplaza el "regex puro" por un motor híbrido determinista: (1) regex determinista que
// REUTILIZA el classifier real de `src/inference/local-fast-lane.ts`, (2) una caché de
// similitud semántica por huella de tokens (Jaccard), y (3) reglas deterministas aprendidas.
// NO es un modelo neuronal ni un embedding neural: la "similitud semántica" es un índice
// léxico determinista y reproducible. No abre red, no autoriza, no ejecuta efectos.
import {
  detectLocalIntent,
  normalizeLocalInput,
  type LocalIntent,
} from '../../inference/local-fast-lane';

export type FastLaneSource = 'regex' | 'semantic_cache' | 'learned_rule';

export interface FastLaneDecision {
  readonly intent: LocalIntent;
  readonly source: FastLaneSource;
}

export interface FastLaneResult {
  readonly isFastLane: boolean;
  readonly intent: LocalIntent | null;
  readonly confidence: number;
  readonly source: FastLaneSource | null;
  /** Presupuesto de latencia en ms para esta ruta (determinista, no una medición real). */
  readonly latencyBudgetMs: number;
  readonly reason: string;
}

const STOPWORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'de',
  'del',
  'que',
  'como',
  'me',
  'mi',
  'tu',
  'con',
  'por',
  'para',
  'es',
  'son',
  'se',
  'y',
  'o',
  'a',
  'en',
  'the',
  'a',
  'an',
  'of',
  'to',
  'is',
  'are',
  'and',
  'or',
  'for',
  'on',
  'in',
]);

/** Tokeniza normalizando acentos/case y removiendo stopwords y no-alphanumericos. */
export function tokenize(input: string): string[] {
  return normalizeLocalInput(input)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface CacheEntry {
  readonly intent: LocalIntent;
  readonly tokens: ReadonlySet<string>;
  hits: number;
}

export interface FastlaneOptions {
  /** Similitud mínima (0..1) para aceptar un acierto de la caché semántica. Default 0.97. */
  readonly similarityThreshold?: number;
  /** Nº máximo de entradas de la caché (LRU por inserción + refuerzo por hit). Default 256. */
  readonly maxCacheEntries?: number;
}

/**
 * Fastlane 2.0. Cada turno intenta primero el regex determinista; si no resuelve, consulta
 * la caché semántica; después, las reglas aprendidas. Un acierto de la caché se promueve
 * (hit+1). La escritura a la caché es explícita vía `remember()` para no contaminar la
 * confianza con datos no verificados.
 */
export class AdaptiveSemanticFastlane {
  private readonly similarityThreshold: number;
  private readonly maxCacheEntries: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly learnedRules: Array<{ readonly pattern: RegExp; readonly intent: LocalIntent }> =
    [];

  constructor(options: FastlaneOptions = {}) {
    this.similarityThreshold = options.similarityThreshold ?? 0.97;
    this.maxCacheEntries = options.maxCacheEntries ?? 256;
  }

  /** Registra una regla determinista aprendida (regex → intent). No usa LLM. */
  addLearnedRule(pattern: RegExp, intent: LocalIntent): void {
    this.learnedRules.push({ pattern, intent });
  }

  /** Fija en la caché una huella semántica verificada para un texto dado. */
  remember(input: string, intent: LocalIntent): void {
    const tokens = new Set(tokenize(input));
    if (tokens.size === 0) return;
    const key = [...tokens].sort().join('|');
    if (this.cache.size >= this.maxCacheEntries && !this.cache.has(key)) {
      // Eviction determinista: elimina la entrada con menos hits (y primera en inserción).
      let evictKey: string | null = null;
      let minHits = Number.POSITIVE_INFINITY;
      for (const [candidate, entry] of this.cache) {
        if (entry.hits < minHits) {
          minHits = entry.hits;
          evictKey = candidate;
        }
      }
      if (evictKey !== null) this.cache.delete(evictKey);
    }
    const existing = this.cache.get(key);
    if (existing) this.cache.set(key, { ...existing, hits: existing.hits + 1 });
    else this.cache.set(key, { intent, tokens, hits: 0 });
  }

  evaluate(input: string): FastLaneResult {
    // 1. Regex determinista (O(1) para patrones ya conocidos).
    const regexIntent = detectLocalIntent(input);
    if (regexIntent) {
      return {
        isFastLane: true,
        intent: regexIntent,
        confidence: 1.0,
        source: 'regex',
        latencyBudgetMs: 1,
        reason: 'deterministic regex match',
      };
    }

    // 2. Huella semántica (similitud léxica sobre la caché verificada).
    const tokens = new Set(tokenize(input));
    if (tokens.size > 0) {
      let best: { intent: LocalIntent; similarity: number } | null = null;
      for (const entry of this.cache.values()) {
        const similarity = jaccard(tokens, entry.tokens);
        if (!best || similarity > best.similarity) best = { intent: entry.intent, similarity };
      }
      if (best && best.similarity >= this.similarityThreshold) {
        return {
          isFastLane: true,
          intent: best.intent,
          confidence: best.similarity,
          source: 'semantic_cache',
          latencyBudgetMs: 2,
          reason: `semantic fingerprint similarity ${best.similarity.toFixed(3)} >= ${this.similarityThreshold}`,
        };
      }
    }

    // 3. Reglas deterministas aprendidas.
    const normalized = normalizeLocalInput(input);
    for (const rule of this.learnedRules) {
      if (rule.pattern.test(normalized)) {
        return {
          isFastLane: true,
          intent: rule.intent,
          confidence: 0.95,
          source: 'learned_rule',
          latencyBudgetMs: 1,
          reason: 'learned deterministic rule',
        };
      }
    }

    // Fuera de fastlane: la ruta gobernada (proveedor/agente) mantiene la responsabilidad.
    return {
      isFastLane: false,
      intent: null,
      confidence: 0,
      source: null,
      latencyBudgetMs: 0,
      reason: 'no deterministic path; defer to governed provider/agent route',
    };
  }
}
