// state: draft | engine-generated — Observabilidad Cognitiva (Documento §XV).
// Agregadores deterministas de métricas COGNITIVAS sobre una corriente de observaciones por
// turno: puntuación de alucinación, exactitud de razonamiento, rendimiento de herramientas,
// cumplimiento de política, índice de riesgo y consistencia de memoria. Se oferta como capa
// compatible con el stack OTel + Prometheus + Grafana, pero AQUÍ solo agrega datos que
// recibe; no instrumenta procesos ni mide telemetría real. Un valor agregado es una
// capacidad computacional, NO una certificación de calidad (AGENTS.md §1).

export type RiskLabel = 'low' | 'medium' | 'high' | 'critical';

const RISK_WEIGHT: Readonly<Record<RiskLabel, number>> = Object.freeze({
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1,
});

export interface TurnObservation {
  readonly traceId: string;
  readonly hallucinated: boolean;
  readonly reasoningVerified: boolean;
  readonly toolLatencyMs: number;
  readonly policyCompliant: boolean;
  readonly risk: RiskLabel;
  readonly memoryConsistent: boolean;
}

export interface CognitiveMetrics {
  readonly turns: number;
  readonly hallucinationScore: number; // 0..1, mayor = más alucinación
  readonly reasoningAccuracy: number; // 0..1
  readonly policyCompliance: number; // 0..1
  readonly memoryConsistency: number; // 0..1
  readonly meanToolLatencyMs: number;
  readonly p95ToolLatencyMs: number;
  readonly riskIndex: number; // 0..1
}

/** Percentil determinista (nearest-rank) sobre valores ordenados ascendentes. */
function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil(p * sortedAsc.length);
  const idx = Math.min(sortedAsc.length, Math.max(1, rank));
  return sortedAsc[idx - 1] ?? 0;
}

/** Acumulador de observaciones por turno; `compute` produce el agregado del periodo. */
export class CognitiveObservability {
  private readonly observations: TurnObservation[] = [];

  record(observation: TurnObservation): void {
    if (!observation.traceId.trim()) throw new Error('OBSERVATION_TRACE_ID_REQUIRED');
    if (!(observation.toolLatencyMs >= 0)) throw new Error('OBSERVATION_LATENCY_INVALID');
    this.observations.push(Object.freeze({ ...observation }));
  }

  size(): number {
    return this.observations.length;
  }

  compute(): CognitiveMetrics {
    const n = this.observations.length;
    if (n === 0) {
      return Object.freeze({
        turns: 0,
        hallucinationScore: 0,
        reasoningAccuracy: 0,
        policyCompliance: 0,
        memoryConsistency: 0,
        meanToolLatencyMs: 0,
        p95ToolLatencyMs: 0,
        riskIndex: 0,
      });
    }
    let hallucinated = 0;
    let verified = 0;
    let compliant = 0;
    let consistent = 0;
    let latencySum = 0;
    let riskSum = 0;
    const latencies: number[] = [];
    for (const obs of this.observations) {
      if (obs.hallucinated) hallucinated += 1;
      if (obs.reasoningVerified) verified += 1;
      if (obs.policyCompliant) compliant += 1;
      if (obs.memoryConsistent) consistent += 1;
      latencySum += obs.toolLatencyMs;
      latencies.push(obs.toolLatencyMs);
      riskSum += RISK_WEIGHT[obs.risk];
    }
    latencies.sort((a, b) => a - b);
    return Object.freeze({
      turns: n,
      hallucinationScore: hallucinated / n,
      reasoningAccuracy: verified / n,
      policyCompliance: compliant / n,
      memoryConsistency: consistent / n,
      meanToolLatencyMs: latencySum / n,
      p95ToolLatencyMs: percentile(latencies, 0.95),
      riskIndex: riskSum / n,
    });
  }
}
