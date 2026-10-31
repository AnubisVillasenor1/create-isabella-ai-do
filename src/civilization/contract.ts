/**
 * ISABELLA Ω · COGNITIVE CIVILIZATION RUNTIME (CCR-1) — Contrato Soberano.
 *
 * state: draft | engine-generated.
 *
 * Define la forma canónica de la respuesta del runtime de civilización
 * (`SovereignResponse`, spec CCR-1 §5) y su constructor/validador fail-closed.
 *
 * Invariante (AGENTS.md §1): este contrato TRANSPORTA una decisión de composición
 * —clasificación, camino de razonamiento, evidencia y política— pero NO autoriza,
 * NO ejecuta y NO se declara verdad. `authorityPath` es siempre `FULL` y la
 * conciencia humana decide. `confidence` es una estimación determinista, no una
 * probabilidad calibrada.
 */
import { sha256 } from '../skills/canonical-json';
import type { TrafficBand } from '../governance/traffic-light';

export const SOVEREIGN_CONTRACT_VERSION = '1.0.0' as const;

export const SOVEREIGN_CONTRACT_DISCLAIMER =
  'La respuesta soberana clasifica, explica, evidencia y propone. NO autoriza, NO ejecuta y NO se declara verdad. `authorityPath` permanece FULL: la conciencia humana decide, aprueba y ejecuta.' as const;

export type SovereignDecision = 'ALLOW' | 'DENY' | 'REVIEW';

export interface SovereignSimulation {
  /** Motor de simulación solicitado (p. ej. "reality-twin"). */
  readonly engine: string;
  /** Estado honesto: SIMULATED cuando corre el bridge, NOT_WIRED cuando no existe. */
  readonly status: 'SIMULATED' | 'NOT_WIRED';
  readonly notes: string;
}

export interface SovereignEvolution {
  readonly mode: string;
  readonly controls: number;
  readonly delta: Readonly<Record<string, number>>;
  /** La evolución nunca auto-promueve: requiere aprobador humano (Invariante). */
  readonly humanApprovalRequired: true;
}

export interface SovereignPolicy {
  readonly decision: SovereignDecision;
  readonly band: TrafficBand;
  readonly policyVersion: string;
  /** Invariante: la composición no eleva ni reduce la autoridad. */
  readonly authorityPath: 'FULL';
}

export interface SovereignResponse {
  readonly version: typeof SOVEREIGN_CONTRACT_VERSION;
  /** Resumen gobernado determinista. NO es una respuesta generativa libre. */
  readonly answer: string;
  /** Estimación determinista en [0,1]; NO probabilidad calibrada. */
  readonly confidence: number;
  readonly reasoningPath: readonly string[];
  readonly usedKnowledgeDomains: readonly string[];
  readonly evidence: readonly string[];
  readonly simulation: SovereignSimulation | null;
  readonly evolution: SovereignEvolution | null;
  readonly policy: SovereignPolicy;
  /** SHA-256 canónico del ciclo (integridad BookPI). */
  readonly bookpiHash: string;
  readonly authorityPath: 'FULL';
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
  readonly disclaimer: typeof SOVEREIGN_CONTRACT_DISCLAIMER;
}

export interface BuildSovereignResponseInput {
  readonly answer: string;
  readonly confidence: number;
  readonly reasoningPath: readonly string[];
  readonly usedKnowledgeDomains: readonly string[];
  readonly evidence: readonly string[];
  readonly simulation?: SovereignSimulation | null;
  readonly evolution?: SovereignEvolution | null;
  readonly policy: SovereignPolicy;
}

export interface SovereignResponseValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function freezeResponse(response: SovereignResponse): SovereignResponse {
  return Object.freeze({
    ...response,
    reasoningPath: Object.freeze([...response.reasoningPath]),
    usedKnowledgeDomains: Object.freeze([...response.usedKnowledgeDomains]),
    evidence: Object.freeze([...response.evidence]),
    policy: Object.freeze({ ...response.policy }),
    ...(response.simulation ? { simulation: Object.freeze({ ...response.simulation }) } : {}),
    ...(response.evolution
      ? {
          evolution: Object.freeze({
            ...response.evolution,
            delta: Object.freeze({ ...response.evolution.delta }),
          }),
        }
      : {}),
  });
}

/**
 * Construye una `SovereignResponse` fail-closed: exige respuesta, política y un
 * `confidence` finito; sella un `bookpiHash` canónico sobre el contenido. Nunca
 * marca autorización ni ejecución.
 */
export function buildSovereignResponse(input: BuildSovereignResponseInput): SovereignResponse {
  const answer = typeof input.answer === 'string' ? input.answer.trim() : '';
  if (!answer) throw new Error('SOVEREIGN_ANSWER_REQUIRED');

  const confidence = Number.isFinite(input.confidence)
    ? Math.min(1, Math.max(0, input.confidence))
    : 0;

  const bookpiHash = sha256({
    version: SOVEREIGN_CONTRACT_VERSION,
    answer,
    confidence,
    reasoningPath: input.reasoningPath,
    usedKnowledgeDomains: input.usedKnowledgeDomains,
    evidence: input.evidence,
    simulation: input.simulation ?? null,
    evolution: input.evolution ?? null,
    policy: input.policy,
  });

  return freezeResponse({
    version: SOVEREIGN_CONTRACT_VERSION,
    answer,
    confidence,
    reasoningPath: input.reasoningPath,
    usedKnowledgeDomains: input.usedKnowledgeDomains,
    evidence: input.evidence,
    simulation: input.simulation ?? null,
    evolution: input.evolution ?? null,
    policy: input.policy,
    bookpiHash,
    authorityPath: 'FULL',
    authorizationPerformed: false,
    executionPerformed: false,
    disclaimer: SOVEREIGN_CONTRACT_DISCLAIMER,
  });
}

/**
 * Valida una respuesta soberana fail-closed. Rechaza cualquier intento de
 * declarar autorización/ejecución o de romper el invariante de autoridad.
 */
export function validateSovereignResponse(value: unknown): SovereignResponseValidation {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null) {
    return { valid: false, errors: ['SOVEREIGN_RESPONSE_NOT_OBJECT'] };
  }
  const r = value as Partial<SovereignResponse>;

  if (r.version !== SOVEREIGN_CONTRACT_VERSION) errors.push('SOVEREIGN_VERSION_UNSUPPORTED');
  if (typeof r.answer !== 'string' || !r.answer.trim()) errors.push('SOVEREIGN_ANSWER_REQUIRED');
  if (
    typeof r.confidence !== 'number' ||
    !Number.isFinite(r.confidence) ||
    r.confidence < 0 ||
    r.confidence > 1
  ) {
    errors.push('SOVEREIGN_CONFIDENCE_INVALID');
  }
  if (!Array.isArray(r.reasoningPath)) errors.push('SOVEREIGN_REASONING_PATH_INVALID');
  if (!Array.isArray(r.usedKnowledgeDomains)) errors.push('SOVEREIGN_DOMAINS_INVALID');
  if (!Array.isArray(r.evidence)) errors.push('SOVEREIGN_EVIDENCE_INVALID');
  if (typeof r.bookpiHash !== 'string' || !r.bookpiHash)
    errors.push('SOVEREIGN_BOOKPI_HASH_REQUIRED');
  if (r.authorityPath !== 'FULL') errors.push('SOVEREIGN_AUTHORITY_PATH_MUST_BE_FULL');
  if (r.authorizationPerformed !== false) errors.push('SOVEREIGN_MUST_NOT_AUTHORIZE');
  if (r.executionPerformed !== false) errors.push('SOVEREIGN_MUST_NOT_EXECUTE');
  if (typeof r.policy !== 'object' || r.policy === null) errors.push('SOVEREIGN_POLICY_REQUIRED');
  else if ((r.policy as SovereignPolicy).authorityPath !== 'FULL')
    errors.push('SOVEREIGN_POLICY_AUTHORITY_PATH_MUST_BE_FULL');

  return { valid: errors.length === 0, errors };
}
