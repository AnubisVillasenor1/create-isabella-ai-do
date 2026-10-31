/**
 * REGALO 3 — COMPILADOR DE INTENCIÓN (Intent Compiler).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: un usuario no habla en MethodId. Este módulo traduce
 * texto libre a un candidato canónico (methodId + capabilityId realista de la
 * base) con confianza y un respaldo seguro (solo lectura) sin imponer la forma
 * a la interacción.
 *
 * Invariante (AGENTS.md): solo calcula una sugerencia de destino; no autoriza,
 * no ejecuta. La ambigüedad se marca explícitamente. Fallback es read-only.
 */
import { jaccard, clamp, digest, round, tokenize } from './util';

export const INTENT_COMPILER_VERSION = '1.0.0' as const;
export const INTENT_COMPILER_METHOD_ID =
  'A.TWINS.LEGACY.intent_compiler.compile.v1.0.0.LOW.AUTONOMOUS' as const;
export const INTENT_COMPILER_DISCLAIMER =
  'La compilación de intención sugiere un destino canónico; no concede autoridad ni ejecuta ninguna acción.';

export interface KnownMethod {
  readonly methodId: string;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly capabilityId: string;
  readonly readOnly: boolean;
}

export const KNOWN_METHODS: readonly KnownMethod[] = Object.freeze([
  {
    methodId: 'A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS',
    label: 'Recuperar/sintetizar recuerdo',
    keywords: ['recordar', 'recuerdo', 'historial', 'qué', 'hicimos', 'resumir', 'resumen'],
    capabilityId: 'hsf.memory.fabric',
    readOnly: true,
  },
  {
    methodId: 'A.TWINS.E00_INTENT.turbo_plan.propose.v1.0.0.LOW.AUTONOMOUS',
    label: 'Planificar ruta turbo',
    keywords: ['plan', 'planear', 'ruta', 'agilizar', 'velocidad', 'turbo'],
    capabilityId: 'hsf.intelligence.turbo-planner',
    readOnly: true,
  },
  {
    methodId: 'A.TWINS.E01_TRUTH.grounding.request.v1.0.0.LOW.AUTONOMOUS',
    label: 'Verificación/grounding',
    keywords: ['verifica', 'demuestra', 'fuente', 'cita', 'grounding'],
    capabilityId: 'hsf.truth.grounding',
    readOnly: true,
  },
  {
    methodId: 'A.TWINS.E02_SEC.seal.propose.v1.0.0.LOW.AUTONOMOUS',
    label: 'Proponer sello de documento',
    keywords: ['sellar', 'sello', 'documento', 'firmar', 'evidencia'],
    capabilityId: 'hsf.security.document-seal',
    readOnly: true,
  },
  {
    methodId: 'A.TWINS.E03_GOV.perms.map.v1.0.0.LOW.AUTONOMOUS',
    label: 'Mapear permisos',
    keywords: ['permiso', 'permiso', 'autorizacion', 'roles', 'mapear'],
    capabilityId: 'hsf.governance.permission-map',
    readOnly: true,
  },
  {
    methodId: 'A.TWINS.E04_TWINS.classify.propose.v1.0.0.LOW.AUTONOMOUS',
    label: 'Clasificar flujo (semáforo)',
    keywords: ['triar', 'triage', 'clasificar', 'semáforo', 'verde', 'rojo'],
    capabilityId: 'hsf.governance.traffic-light',
    readOnly: true,
  },
  {
    methodId: 'T.TWINS.E08_DATA.remove.permanent_delete.v1.0.0.CRITICAL.CONSTITUTIONAL',
    label: 'Eliminación permanente (destructivo)',
    keywords: ['borrar', 'elimina', 'eliminar', 'remover', 'delete', 'destruir'],
    capabilityId: 'data.remove.permanent_delete',
    readOnly: false,
  },
]);

export interface CompileCandidate {
  readonly methodId: string;
  readonly label: string;
  readonly capabilityId: string;
  readonly readOnly: boolean;
  readonly score: number;
  readonly matched: readonly string[];
}

export interface IntentCompilation {
  readonly version: typeof INTENT_COMPILER_VERSION;
  readonly input: string;
  readonly normalizedTokens: readonly string[];
  readonly candidates: readonly CompileCandidate[];
  readonly best?: CompileCandidate;
  readonly confidence: number;
  readonly ambiguous: boolean;
  readonly fallbackMethodId: (typeof KNOWN_METHODS)[number]['methodId'];
  readonly fallbackLabel: (typeof KNOWN_METHODS)[number]['label'];
  readonly suggestion: string;
  readonly digest: string;
  readonly methodId: typeof INTENT_COMPILER_METHOD_ID;
  readonly disclaimer: typeof INTENT_COMPILER_DISCLAIMER;
}

export function compileIntent(input: string): IntentCompilation {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) throw new Error('INTENT_COMPILER_INPUT_REQUIRED');
  const tokens = tokenize(text);

  const candidates: CompileCandidate[] = [];
  for (const km of KNOWN_METHODS) {
    const matched = km.keywords.filter((k) => {
      const kt = tokenize(k);
      return kt.length > 0 ? jaccard(kt, tokens) > 0.3 || tokens.includes(kt.join(' ')) : false;
    });
    const keywordTokens = km.keywords.flatMap(tokenize);
    const base = jaccard(keywordTokens, tokens);
    const boost =
      matched.length > 0 ? clamp(matched.length / Math.max(1, km.keywords.length), 0, 1) * 0.4 : 0;
    const score = round(clamp(base * 0.6 + boost, 0, 1), 4);
    candidates.push({
      methodId: km.methodId,
      label: km.label,
      capabilityId: km.capabilityId,
      readOnly: km.readOnly,
      score,
      matched: Object.freeze(matched),
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  const positive = candidates.filter((c) => c.score > 0);
  const best = positive[0];
  const runnerUp = positive[1];
  const confidence = best ? best.score : 0;
  const ambiguous = !best
    ? false
    : runnerUp
      ? best.score - runnerUp.score <= 0.1 && best.score < 0.7
      : confidence < 0.5;

  const fallback = KNOWN_METHODS[0];
  if (!fallback) throw new Error('INTENT_COMPILER_NO_KNOWN_METHODS');
  const suggestion = best
    ? `Parece que quieres: ${best.label} (capacidad ${best.capabilityId}, readOnly=${best.readOnly}).`
    : `No reconocí la intención; usaré fallback seguro: ${fallback.label} (${fallback.capabilityId}).`;

  return {
    version: INTENT_COMPILER_VERSION,
    input: text,
    normalizedTokens: Object.freeze(tokens),
    candidates: Object.freeze(candidates.slice(0, 5)),
    best: best ? Object.freeze(best) : undefined,
    confidence,
    ambiguous,
    fallbackMethodId: fallback.methodId,
    fallbackLabel: fallback.label,
    suggestion,
    digest: digest({ text, tokens, best, confidence }),
    methodId: INTENT_COMPILER_METHOD_ID,
    disclaimer: INTENT_COMPILER_DISCLAIMER,
  };
}
