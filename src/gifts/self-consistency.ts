/**
 * REGALO 5 — AUTO-CONSISTENCIA (Self-Consistency Verifier).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: una sola muestra puede alucinar. Dado un conjunto de N
 * respuestas a la misma pregunta, mide el acuerdo entre ellas y selecciona la de
 * mayor consenso. Acuerdo bajo ⇒ no debe entregarse como hecho.
 *
 * Invariante (AGENTS.md): es evidencia computacional, no facultad. No autoriza ni
 * ejecuta; solo agrupa texto por similitud determinista (Jaccard).
 */
import { jaccard, tokenize, digest, round } from './util';

export const SELF_CONSISTENCY_VERSION = '1.0.0' as const;
export const SELF_CONSISTENCY_METHOD_ID =
  'A.TWINS.LEGACY.self_consistency.verify.v1.0.0.LOW.AUTONOMOUS' as const;
export const SELF_CONSISTENCY_DISCLAIMER =
  'La auto-consistencia es evidencia computacional de acuerdo entre muestras; no es facultad ni autoridad verificada.';

export interface ConsistencySample {
  readonly id?: string;
  readonly text: string;
}

export interface ConsistencyCluster {
  readonly representative: string;
  readonly members: readonly string[];
  readonly share: number;
}

export interface ConsistencyOptions {
  /** Umbral de acuerdo para considerar consistente la respuesta final. */
  readonly threshold?: number;
  /** Similitud Jaccard mínima para pertenecer al mismo grupo. */
  readonly clusterThreshold?: number;
  /** Muestras mínimas para emitir juicio. */
  readonly minSamples?: number;
}

export interface ConsistencyResult {
  readonly version: typeof SELF_CONSISTENCY_VERSION;
  readonly sampleCount: number;
  readonly clusters: readonly ConsistencyCluster[];
  readonly consensus?: string;
  readonly agreement: number;
  readonly consistent: boolean;
  readonly threshold: number;
  readonly minSamples: number;
  readonly digest: string;
  readonly methodId: typeof SELF_CONSISTENCY_METHOD_ID;
  readonly disclaimer: typeof SELF_CONSISTENCY_DISCLAIMER;
}

export function verifySelfConsistency(
  samples: readonly ConsistencySample[],
  options: ConsistencyOptions = {}
): ConsistencyResult {
  if (!Array.isArray(samples)) throw new Error('SELF_CONSISTENCY_SAMPLES_REQUIRED');
  const clean = samples.filter((s) => typeof s?.text === 'string' && s.text.trim().length > 0);
  const threshold = options.threshold ?? 0.67;
  const clusterThreshold = options.clusterThreshold ?? 0.6;
  const minSamples = options.minSamples ?? 2;

  if (clean.length === 0) throw new Error('SELF_CONSISTENCY_SAMPLES_EMPTY');

  const groups: { representative: string; centroid: string[]; members: string[] }[] = [];
  for (const sample of clean) {
    const tokens = tokenize(sample.text);
    let placed = false;
    for (const group of groups) {
      if (jaccard(tokens, group.centroid) >= clusterThreshold) {
        group.members.push(sample.text);
        placed = true;
        break;
      }
    }
    if (!placed)
      groups.push({ representative: sample.text, centroid: tokens, members: [sample.text] });
  }

  groups.sort((a, b) => b.members.length - a.members.length);
  const total = clean.length;
  const clusters: ConsistencyCluster[] = groups.map((group) => ({
    representative: group.representative,
    members: Object.freeze([...group.members]),
    share: round(group.members.length / total, 4),
  }));

  const topCluster = clusters[0];
  const agreement = topCluster ? topCluster.share : 0;
  const consistent = clean.length >= minSamples && agreement >= threshold;

  return {
    version: SELF_CONSISTENCY_VERSION,
    sampleCount: total,
    clusters: Object.freeze(clusters),
    consensus: consistent && topCluster ? topCluster.representative : undefined,
    agreement,
    consistent,
    threshold,
    minSamples,
    digest: digest({
      sampleCount: total,
      agreement,
      consistent,
      clusters: clusters.map((c) => c.members.length),
    }),
    methodId: SELF_CONSISTENCY_METHOD_ID,
    disclaimer: SELF_CONSISTENCY_DISCLAIMER,
  };
}
