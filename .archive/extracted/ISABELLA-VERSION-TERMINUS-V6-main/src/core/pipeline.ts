import {
  EVOLUTION_AUTHORITY_CHAIN,
  EXECUTION_PIPELINE,
  PRODUCTION_AUTHORITY_CHAIN,
  type ExecutionStage,
  type StageVerdict,
  type StageVerifier,
} from "./types";

export const pipelineDefinition = (): readonly ExecutionStage[] => EXECUTION_PIPELINE;

export const productionAuthorityChain = (): readonly string[] =>
  PRODUCTION_AUTHORITY_CHAIN;

export const evolutionAuthorityChain = (): readonly string[] =>
  EVOLUTION_AUTHORITY_CHAIN;

/**
 * Ejecuta las etapas en orden canónico. Ninguna etapa de aceleración puede
 * saltar de la entrada a efectos externos: toda etapa debe pasar su verificación
 * antes de continuar.
 */
export async function runPipeline<T>(
  verifiers: ReadonlyArray<StageVerifier<ExecutionStage, T>>,
  initial: T,
): Promise<{ verdicts: StageVerdict[]; passed: boolean; payload: T }> {
  const byStage = new Map(verifiers.map((v) => [v.stage, v]));
  const verdicts: StageVerdict[] = [];
  let payload = initial;

  for (const stage of EXECUTION_PIPELINE) {
    const verifier = byStage.get(stage);
    if (!verifier) {
      continue;
    }
    const verdict = await verifier.verify(payload);
    verdicts.push(verdict);
    if (!verdict.passed) {
      return { verdicts, passed: false, payload };
    }
  }

  return { verdicts, passed: true, payload };
}