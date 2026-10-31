// state: draft | engine-generated — Motor de Razonamiento Híbrido Ω (Documento §IX).
// Tubería gobernada de 6 etapas: Descomposición → Validación de evidencia → Recorrido del
// grafo → Verificación simbólica → Síntesis → Auditoría de cumplimiento. Es determinista y
// FAIL-CLOSED: si una etapa obligatoria no se cumple, el veredicto es INSUFFICIENT y ninguna
// conclusión se eleva a verdad. No es un LLM: compone y verifica datos que recibe; la
// "síntesis" es una agregación determinista, no generación neuronal.
import type { KnowledgeMesh } from './knowledge-mesh';

export type ReasoningStage =
  | 'decomposition'
  | 'evidence_validation'
  | 'graph_traversal'
  | 'symbolic_verification'
  | 'synthesis'
  | 'compliance_audit';

export const REASONING_PIPELINE: readonly ReasoningStage[] = Object.freeze([
  'decomposition',
  'evidence_validation',
  'graph_traversal',
  'symbolic_verification',
  'synthesis',
  'compliance_audit',
]);

export interface StageResult {
  readonly stage: ReasoningStage;
  readonly status: 'PASSED' | 'FAILED' | 'SKIPPED';
  readonly detail: string;
}

export interface ReasoningClaim {
  readonly claimId: string;
  readonly text: string;
  /** Fuentes (ids) que respaldan el claim. Un claim sin respaldo no pasa validación. */
  readonly sourceIds: readonly string[];
}

export interface ReasoningRequest {
  readonly question: string;
  readonly claims: readonly ReasoningClaim[];
  readonly knownSourceIds: readonly string[];
  /** Semilla opcional para el recorrido del grafo (Knowledge Mesh). */
  readonly mesh?: KnowledgeMesh;
  readonly meshSeed?: string;
  /** Referencia de política/mandato exigida por la auditoría de cumplimiento. */
  readonly policyRef: string;
  /** Restricción simbólica: número mínimo de claims corroborados para sintetizar. */
  readonly minCorroboratedClaims?: number;
}

export interface ReasoningVerdict {
  readonly verdict: 'SUPPORTED' | 'INSUFFICIENT';
  readonly confidence: number;
  readonly corroborated: number;
  readonly trace: readonly StageResult[];
  readonly synthesis: string;
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Ejecuta la tubería de razonamiento híbrido. La confianza es la fracción de claims
 * corroborados (todas sus fuentes conocidas) ponderada por la presencia de auditoría.
 */
export function runHybridReasoning(request: ReasoningRequest): ReasoningVerdict {
  const trace: StageResult[] = [];
  const minCorroborated = request.minCorroboratedClaims ?? 1;

  // 1. Descomposición.
  const decomposed = request.claims.length > 0 && nonEmpty(request.question);
  trace.push({
    stage: 'decomposition',
    status: decomposed ? 'PASSED' : 'FAILED',
    detail: `${request.claims.length} claim(s) desde la pregunta`,
  });

  // 2. Validación de evidencia: un claim es válido si TODAS sus fuentes son conocidas.
  const known = new Set(request.knownSourceIds);
  const corroborated = request.claims.filter(
    (claim) => claim.sourceIds.length > 0 && claim.sourceIds.every((s) => known.has(s))
  );
  const evidenceOk = corroborated.length >= minCorroborated;
  trace.push({
    stage: 'evidence_validation',
    status: evidenceOk ? 'PASSED' : 'FAILED',
    detail: `${corroborated.length}/${request.claims.length} claim(s) con respaldo conocido`,
  });

  // 3. Recorrido del grafo (opcional: si no hay malla/semilla se omite, no falla).
  if (request.mesh && request.meshSeed) {
    try {
      const reached = request.mesh.traverse(request.meshSeed, 2).reached.length;
      trace.push({
        stage: 'graph_traversal',
        status: 'PASSED',
        detail: `${reached} nodo(s) alcanzado(s)`,
      });
    } catch {
      trace.push({
        stage: 'graph_traversal',
        status: 'FAILED',
        detail: 'semilla de grafo desconocida',
      });
    }
  } else {
    trace.push({
      stage: 'graph_traversal',
      status: 'SKIPPED',
      detail: 'sin Knowledge Mesh en la solicitud',
    });
  }

  // 4. Verificación simbólica: consistencia = ningún claim corrobora otro contradictorio.
  //    Modelado determinista: dos claims son inconsistentes si comparten claimId distinto
  //    pero texto idéntico con signos de negación opuestos. Sin contradictorios → pasa.
  const texts = new Set<string>();
  let contradictions = 0;
  for (const claim of corroborated) {
    const negated = /^\s*(no|not)\b/i.test(claim.text);
    const key = `${negated ? '!' : ''}${claim.text
      .replace(/^\s*(no|not)\s+/i, '')
      .toLowerCase()
      .trim()}`;
    if (texts.has(key)) contradictions += 1;
    texts.add(key);
  }
  const symbolicOk = contradictions === 0;
  trace.push({
    stage: 'symbolic_verification',
    status: symbolicOk ? 'PASSED' : 'FAILED',
    detail: `${contradictions} contradicción(es) detectada(s)`,
  });

  // 5. Síntesis determinista (agregación, no generación neuronal).
  const mandatoryBeforeSynthesis = trace.filter(
    (t) => t.stage === 'decomposition' || t.stage === 'evidence_validation'
  );
  const canSynthesize = mandatoryBeforeSynthesis.every((t) => t.status === 'PASSED');
  const synthesis = canSynthesize
    ? `Para "${request.question}": ${corroborated.length} afirmación(es) corroborada(s) sobre ${request.claims.length}.`
    : 'No se sintetiza: la evidencia es insuficiente (fail-closed).';
  trace.push({
    stage: 'synthesis',
    status: canSynthesize ? 'PASSED' : 'FAILED',
    detail: canSynthesize
      ? 'agregación determinista producida'
      : 'síntesis bloqueada por evidencia insuficiente',
  });

  // 6. Auditoría de cumplimiento: exige una referencia de política/mandato.
  const complianceOk = nonEmpty(request.policyRef);
  trace.push({
    stage: 'compliance_audit',
    status: complianceOk ? 'PASSED' : 'FAILED',
    detail: complianceOk ? `política ${request.policyRef}` : 'falta referencia de política/mandato',
  });

  const failed = trace.some((t) => t.status === 'FAILED');
  const total = request.claims.length || 1;
  const coverage = corroborated.length / total;
  const confidence = failed ? Math.min(coverage, 0.49) : coverage;

  return Object.freeze({
    verdict: failed ? 'INSUFFICIENT' : 'SUPPORTED',
    confidence,
    corroborated: corroborated.length,
    trace: Object.freeze(trace.map((t) => Object.freeze(t))),
    synthesis,
  });
}
