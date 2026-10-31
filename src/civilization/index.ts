/**
 * ISABELLA Ω · COGNITIVE CIVILIZATION RUNTIME (CCR-1) — superficie pública.
 *
 * state: draft | engine-generated.
 *
 * Unifica en una sola capa de composición las 13 capas Ω y los 20 regalos Ω del
 * spec CCR-1, el contrato soberano y el ciclo gobernado de 9 pasos. Es una capa de
 * COMPOSICIÓN: clasifica, explica y evidencia; NO autoriza ni ejecuta.
 */
export {
  CCR_SPEC_ID,
  CCR_VERSION,
  CCR_STATE,
  CCR_DECLARED_LAYERS,
  CIVILIZATION_LAYERS,
  CIVILIZATION_LAYER_COUNT,
  CIVILIZATION_LAYER_STATUSES,
  type CivilizationLayer,
  type CivilizationLayerStatus,
  layerById,
  layerSummary,
} from './layers';

export {
  CIVILIZATION_GIFTS,
  CIVILIZATION_GIFT_COUNT,
  type CivilizationGift,
  civilizationGiftById,
  giftsForLayer,
} from './gifts';

export {
  SOVEREIGN_CONTRACT_VERSION,
  SOVEREIGN_CONTRACT_DISCLAIMER,
  type SovereignResponse,
  type SovereignPolicy,
  type SovereignSimulation,
  type SovereignEvolution,
  type SovereignDecision,
  type SovereignResponseValidation,
  type BuildSovereignResponseInput,
  buildSovereignResponse,
  validateSovereignResponse,
} from './contract';

export {
  CIVILIZATION_METHOD_ID,
  CIVILIZATION_POLICY_VERSION,
  CIVILIZATION_DISCLAIMER,
  runCivilizationCycle,
  type CivilizationCycleInput,
  type CivilizationCycleResult,
  type CivilizationDeps,
  type CivilizationStep,
  type CivilizationStepStatus,
} from './runtime';

import { CCR_DECLARED_LAYERS, CCR_VERSION, CIVILIZATION_LAYERS, layerSummary } from './layers';
import { CIVILIZATION_GIFTS } from './gifts';

/** Resumen honesto de la civilización cognitiva: conteos y estado por capa. */
export function civilizationSummary() {
  return Object.freeze({
    spec: 'isabella-core-ccr',
    version: CCR_VERSION,
    layers: CIVILIZATION_LAYERS.length,
    declaredLayers: CCR_DECLARED_LAYERS,
    gifts: CIVILIZATION_GIFTS.length,
    layerStatus: layerSummary(),
  });
}

export * from './evidence-graph';
