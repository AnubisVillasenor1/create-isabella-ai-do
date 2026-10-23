/**
 * MOE SOBERANO — combine ponderado y fallback (combine.ts).
 * state: draft | auto_generated (pendiente revisión humana).
 *
 * ISA-006: combina salidas como suma ponderada por los pesos del gate,
 *   conservando trazabilidad por contribución. Orden determinista (rango del
 *   gate) para que la suma en punto flotante sea reproducible.
 * ISA-001: camino de fallback determinista cuando no hay expertos disponibles.
 */
import type { ExpertId } from "./contract";
import type { MoeGateDecision } from "./router";

export interface ExpertContribution {
  readonly expertId: ExpertId;
  readonly weight: number;
  readonly contribution: readonly number[];
}

export interface CombineResult {
  readonly routing: "experts" | "fallback";
  readonly vector: readonly number[];
  readonly contributions: readonly ExpertContribution[];
  readonly usedFallback: boolean;
}

export function combine(
  decision: MoeGateDecision,
  outputs: readonly ExpertContribution[],
): CombineResult {
  if (outputs.length === 0) throw new Error("MOE: combine sin salidas");

  const dim = outputs[0]?.contribution.length ?? 0;
  for (const output of outputs) {
    if (output.contribution.length !== dim) {
      throw new Error("MOE: dimensionalidad inconsistente entre contribuciones");
    }
  }

  if (decision.routing === "fallback") {
    if (outputs.length !== 1) throw new Error("MOE: el fallback requiere exactamente una contribución");
    const single = outputs[0];
    const expected = decision.contributions[0];
    if (!single || !expected || single.expertId !== expected.expertId) {
      throw new Error("MOE: contribución de fallback desalineada con el gate");
    }
    return Object.freeze({
      routing: "fallback",
      vector: Object.freeze([...single.contribution]),
      contributions: Object.freeze([Object.freeze({ ...single })]),
      usedFallback: true,
    });
  }

  const weightById = new Map<string, number>();
  for (const contribution of decision.contributions) weightById.set(contribution.expertId, contribution.weight);
  for (const output of outputs) {
    if (!weightById.has(output.expertId)) {
      throw new Error(`MOE: salida de experto no planificado '${output.expertId}'`);
    }
  }

  const ordered: ExpertContribution[] = decision.contributions.map((contribution) => {
    const output = outputs.find((candidate) => candidate.expertId === contribution.expertId);
    if (!output) throw new Error(`MOE: falta la salida del experto planificado '${contribution.expertId}'`);
    return Object.freeze({
      expertId: contribution.expertId,
      weight: contribution.weight,
      contribution: Object.freeze([...output.contribution]),
    });
  });

  const vector = Array.from({ length: dim }, (_, j) => {
    let acc = 0;
    for (const item of ordered) {
      const value = item.contribution[j];
      if (value === undefined) throw new Error("MOE: valor de contribución ausente");
      acc += item.weight * value;
    }
    return acc;
  });

  return Object.freeze({
    routing: "experts",
    vector: Object.freeze(vector),
    contributions: Object.freeze(ordered),
    usedFallback: false,
  });
}