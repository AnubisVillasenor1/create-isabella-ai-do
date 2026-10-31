/**
 * EVIDENCE GROUNDING GUARD Ω — verificación de anclaje de una respuesta a su evidencia.
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: el verificador determinista existente elige el "mejor"
 * candidato por puntaje, pero **nada comprueba que lo afirmado esté sostenido por
 * la evidencia**. Este guard descompone una respuesta en afirmaciones y mide,
 * para cada una, qué fracción de su contenido léxico aparece en la evidencia
 * aportada, y de qué fuentes proviene.
 *
 * Honestidad radical (invariante del repositorio): el método es un **anclaje
 * léxico** (`LEXICAL_SUPPORT_HEURISTIC`), NO entailment semántico ni verificación
 * de verdad. Un token compartido demuestra coincidencia de vocabulario, no que la
 * afirmación se siga de la fuente. Por eso el veredicto es fail-closed: ante
 * afirmaciones sin soporte devuelve `BLOCKED`, nunca un `ACCEPTED` implícito.
 *
 * El guard **transporta** un juicio epistémico; no concede verdad, ni autoridad,
 * ni producción. Cada reporte lleva un digest determinista para auditoría.
 */
import { sha256 } from '../skills/canonical-json';

export const GROUNDING_METHOD = 'LEXICAL_SUPPORT_HEURISTIC' as const;
export const GROUNDING_VERSION = '1.0.0' as const;

export interface GroundingEvidence {
  readonly id: string;
  readonly text: string;
}

export interface GroundingOptions {
  /** Fracción mínima de groundedness para `ACCEPTED`. Por defecto 0.6. */
  readonly minGroundedness?: number;
  /** Umbral por afirmación: por debajo → UNSUPPORTED. Por defecto 0.35. */
  readonly partialThreshold?: number;
  /** Umbral por afirmación: por encima → SUPPORTED. Por defecto 0.6. */
  readonly supportedThreshold?: number;
  /** Palabras vacías adicionales (además de las ES/EN por defecto). */
  readonly stopwords?: readonly string[];
}

export type GroundingClaimVerdict = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';
export type GroundingVerdict = 'ACCEPTED' | 'REVIEW' | 'BLOCKED';

export interface GroundingClaimResult {
  readonly claim: string;
  readonly supportRatio: number;
  readonly verdict: GroundingClaimVerdict;
  readonly supportingEvidenceIds: readonly string[];
  readonly unsupportedTokens: readonly string[];
}

export interface GroundingReport {
  readonly verdict: GroundingVerdict;
  readonly method: typeof GROUNDING_METHOD;
  readonly version: typeof GROUNDING_VERSION;
  readonly groundedness: number;
  readonly claimCount: number;
  readonly unsupportedClaimCount: number;
  readonly claims: readonly GroundingClaimResult[];
  readonly digest: string;
  readonly notes: readonly string[];
}

const DEFAULT_STOPWORDS: readonly string[] = [
  // Español
  'de',
  'la',
  'que',
  'el',
  'en',
  'y',
  'a',
  'los',
  'del',
  'se',
  'las',
  'por',
  'un',
  'para',
  'con',
  'una',
  'su',
  'al',
  'es',
  'lo',
  'como',
  'más',
  'mas',
  'pero',
  'sus',
  'le',
  'ya',
  'o',
  'este',
  'sí',
  'si',
  'porque',
  'esta',
  'entre',
  'cuando',
  'muy',
  'sin',
  'sobre',
  'también',
  'tambien',
  'me',
  'hasta',
  'hay',
  'donde',
  'quien',
  'desde',
  'todo',
  'nos',
  'durante',
  'todos',
  'uno',
  'les',
  'ni',
  'contra',
  'otros',
  'ese',
  'eso',
  'ante',
  'ellos',
  'e',
  'esto',
  'mí',
  'mi',
  'antes',
  'algunos',
  'qué',
  'que',
  'unos',
  'yo',
  'otro',
  'otras',
  'otra',
  'él',
  'el',
  'tanto',
  'esa',
  'estos',
  'mucho',
  'quienes',
  'nada',
  'muchos',
  'cual',
  'poco',
  'ella',
  'estar',
  'estas',
  'algunas',
  'algo',
  'nosotros',
  'mi',
  'mis',
  'tú',
  'te',
  // English
  'the',
  'of',
  'and',
  'to',
  'in',
  'a',
  'is',
  'that',
  'it',
  'for',
  'on',
  'as',
  'with',
  'are',
  'be',
  'this',
  'by',
  'or',
  'an',
  'was',
  'were',
  'from',
  'at',
  'which',
  'but',
  'not',
  'have',
  'has',
  'had',
  'will',
  'would',
  'there',
  'their',
  'they',
  'you',
  'we',
  'i',
  'he',
  'she',
  'his',
  'her',
  'its',
  'our',
  'your',
  'them',
  'us',
  'me',
  'my',
  'than',
  'then',
  'so',
  'if',
  'into',
  'about',
  'can',
  'could',
  'should',
  'may',
  'might',
  'do',
  'does',
  'did',
  'doesn',
  'don',
  'no',
  'yes',
];

const MAX_CLAIM_TOKENS = 400;

/** NFKC + minúsculas + sin diacríticos, para comparación léxica determinista. */
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text: string, stopwords: ReadonlySet<string>): string[] {
  const matches = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens: string[] = [];
  for (const raw of matches) {
    const isNumber = /^[0-9]+$/.test(raw);
    if (!isNumber && raw.length < 2) continue;
    if (!isNumber && stopwords.has(raw)) continue;
    tokens.push(raw);
  }
  return tokens;
}

function splitClaims(answer: string): string[] {
  return answer
    .split(/[.!?;\n]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function validateOptions(
  options: GroundingOptions | undefined
): Required<Pick<GroundingOptions, 'minGroundedness' | 'partialThreshold' | 'supportedThreshold'>> {
  const minGroundedness = options?.minGroundedness ?? 0.6;
  const partialThreshold = options?.partialThreshold ?? 0.35;
  const supportedThreshold = options?.supportedThreshold ?? 0.6;
  for (const value of [minGroundedness, partialThreshold, supportedThreshold]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('GROUNDING_OPTIONS_INVALID');
    }
  }
  if (partialThreshold > supportedThreshold) throw new Error('GROUNDING_OPTIONS_INVALID');
  return { minGroundedness, partialThreshold, supportedThreshold };
}

/**
 * Evalúa el anclaje de `answer` contra `evidence`.
 * Fail-closed: sin evidencia, toda afirmación queda `UNSUPPORTED` → `BLOCKED`.
 */
export function assessGrounding(
  answer: string,
  evidence: readonly GroundingEvidence[],
  options?: GroundingOptions
): GroundingReport {
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    throw new Error('GROUNDING_ANSWER_REQUIRED');
  }
  const { minGroundedness, partialThreshold, supportedThreshold } = validateOptions(options);

  const stopwords = new Set<string>([
    ...DEFAULT_STOPWORDS,
    ...(options?.stopwords ?? []).map((word) => normalize(word.trim())),
  ]);

  const evidenceTokens = new Map<string, Set<string>>();
  const globalTokens = new Set<string>();
  for (const item of evidence) {
    const id = item.id.trim();
    if (!id) throw new Error('GROUNDING_EVIDENCE_ID_REQUIRED');
    const tokens = new Set(tokenize(item.text, stopwords));
    evidenceTokens.set(id, tokens);
    for (const token of tokens) globalTokens.add(token);
  }

  const notes: string[] = [
    `${GROUNDING_METHOD}: coincidencia léxica de vocabulario, NO entailment semántico ni verificación de verdad.`,
  ];
  if (evidence.length === 0)
    notes.push('Sin evidencia aportada: ninguna afirmación puede anclarse (fail-closed).');

  const claims: GroundingClaimResult[] = [];
  for (const rawClaim of splitClaims(answer)) {
    const claimTokens = [...new Set(tokenize(rawClaim, stopwords))].slice(0, MAX_CLAIM_TOKENS);
    if (claimTokens.length === 0) continue;

    const present = claimTokens.filter((token) => globalTokens.has(token));
    const unsupportedTokens = claimTokens.filter((token) => !globalTokens.has(token));
    const supportRatio = Math.min(1, present.length / claimTokens.length);

    const supportingEvidenceIds: string[] = [];
    for (const [id, tokens] of evidenceTokens) {
      if (claimTokens.some((token) => tokens.has(token))) supportingEvidenceIds.push(id);
    }
    supportingEvidenceIds.sort();

    const verdict: GroundingClaimVerdict =
      supportRatio < partialThreshold
        ? 'UNSUPPORTED'
        : supportRatio < supportedThreshold
          ? 'PARTIAL'
          : 'SUPPORTED';

    claims.push({
      claim: rawClaim,
      supportRatio,
      verdict,
      supportingEvidenceIds,
      unsupportedTokens,
    });
  }

  const claimCount = claims.length;
  const unsupportedClaimCount = claims.filter((claim) => claim.verdict === 'UNSUPPORTED').length;
  const groundedness =
    claimCount === 0 ? 0 : claims.reduce((sum, claim) => sum + claim.supportRatio, 0) / claimCount;

  let verdict: GroundingVerdict;
  if (claimCount === 0) {
    verdict = 'REVIEW';
    notes.push(
      'NO_CONTENT_CLAIMS: la respuesta no contiene afirmaciones evaluables (solo vacías o palabras stop).'
    );
  } else if (unsupportedClaimCount > 0) {
    verdict = 'BLOCKED';
  } else if (groundedness < minGroundedness) {
    verdict = 'REVIEW';
  } else {
    verdict = 'ACCEPTED';
  }

  const digest = sha256({
    method: GROUNDING_METHOD,
    version: GROUNDING_VERSION,
    verdict,
    groundedness,
    claims: claims.map((claim) => ({
      claim: claim.claim,
      supportRatio: claim.supportRatio,
      verdict: claim.verdict,
      supportingEvidenceIds: claim.supportingEvidenceIds,
    })),
  });

  return {
    verdict,
    method: GROUNDING_METHOD,
    version: GROUNDING_VERSION,
    groundedness,
    claimCount,
    unsupportedClaimCount,
    claims,
    digest,
    notes,
  };
}
