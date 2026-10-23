/**
 * SEMÁFORO DE FLUJO GOBERNADO Ω (Governed Flow Traffic Light).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: el repositorio ya clasifica la intención (CROWN), decide
 * una ruta de baja latencia (turbo-planner) y filtra por riesgo (AEGIS/CROWN), pero
 * nada expresaba esa decisión en el vocabulario operativo del usuario: un semáforo
 * (verde / amarillo / naranja / rojo) que diga, de forma determinista y auditable,
 * CUÁNTO gobierno debe aplicarse y CUÁN RÁPIDO puede fluir la respuesta.
 *
 * Este módulo NO duplica lógica: compone `assessIntent` (CROWN) y `planTurboRoute`
 * (turbo-planner) y traduce su salida a bandas de semáforo con un perfil de fricción:
 *
 *   - VERDE  (GREEN)  → ruta FAST        → riesgo bajo/negligible sin daño colateral
 *                                        → filtros mínimos (AEGIS, CROWN, saneamiento)
 *                                        → vía rápida gobernada.
 *   - AMARILLO(YELLOW)→ ruta GROUNDED    → riesgo medio (acción externa, gobernanza)
 *                                        → comienza el filtrado (GROUNDING).
 *   - NARANJA (ORANGE)→ ruta AGENT       → riesgo alto (datos personales, secretos)
 *                                        → gobierno reforzado (VIGIA, contradicción, permisos).
 *   - ROJO    (RED)   → ruta HUMAN_REVIEW→ riesgo crítico / destructivo / alto impacto
 *                                        → todos los filtros, sin caché, revisión humana.
 *
 * Invariante (AGENTS.md): clasificar un flujo **NO** concede autoridad, **NO** ejecuta
 * y **NO** amplía permisos. Verde significa "solo se ejecutan los filtros mínimos
 * necesarios porque el riesgo es bajo", NO "se saltan CROWN, AEGIS, la evidencia
 * BookPI o el saneamiento". `authorityPath` permanece `FULL` en todas las bandas.
 *
 * Fail-closed: una entrada vacía se rechaza; un riesgo desconocido cae en la banda
 * más restrictiva de su ruta. Omitir el ámbito federado desactiva la reutilización
 * de caché (no se puede violar el aislamiento entre inquilinos/federaciones).
 */
import type { RiskTier } from "../authority/method-id";
import { assessIntent, type IntentAssessment, type IntentCategory } from "../crown/intent";
import type { HighImpactTrigger } from "../ingress/isa-api";
import {
  planTurboRoute,
  type TurboCachePolicy,
  type TurboFilter,
  type TurboRoute,
} from "../intelligence/turbo-planner";
import { sha256 } from "../skills/canonical-json";

export const TRAFFIC_LIGHT_VERSION = "1.0.0" as const;

/** Identidad de método canónica (AGENTS.md §5). */
export const TRAFFIC_LIGHT_METHOD_ID =
  "A.TWINS.E00_TURBO.classify_flow.v1.0.0.LOW.AUTONOMOUS" as const;

export const TRAFFIC_LIGHT_DISCLAIMER =
  "El semáforo clasifica el flujo y decide cuántos filtros gobernados corren; NO concede autoridad, NO ejecuta y NO amplía permisos. Verde ejecuta solo los filtros mínimos (AEGIS, CROWN, saneamiento) porque el riesgo es bajo; CROWN sigue autorizando, AEGIS sigue filtrando y BookPI sigue evidenciando en todas las bandas." as const;

/** Bandas de semáforo, de la vía más rápida (GREEN) a la más deliberativa (RED). */
export const TRAFFIC_BANDS = ["GREEN", "YELLOW", "ORANGE", "RED"] as const;
export type TrafficBand = (typeof TRAFFIC_BANDS)[number];

/** Nivel de fricción gobernada asociado a cada banda. */
export const TRAFFIC_FRICTION_LEVELS = ["MINIMAL", "MODERATE", "ELEVATED", "MAXIMAL"] as const;
export type TrafficFriction = (typeof TRAFFIC_FRICTION_LEVELS)[number];

export const TRAFFIC_BAND_LABELS: Record<TrafficBand, string> = {
  GREEN: "Verde — vía rápida gobernada",
  YELLOW: "Amarillo — filtrado en curso",
  ORANGE: "Naranja — gobierno reforzado",
  RED: "Rojo — todos los filtros y revisión humana",
};

const ROUTE_TO_BAND: Record<TurboRoute, TrafficBand> = {
  FAST: "GREEN",
  GROUNDED: "YELLOW",
  AGENT: "ORANGE",
  HUMAN_REVIEW: "RED",
};

const BAND_TO_FRICTION: Record<TrafficBand, TrafficFriction> = {
  GREEN: "MINIMAL",
  YELLOW: "MODERATE",
  ORANGE: "ELEVATED",
  RED: "MAXIMAL",
};

export interface TrafficLightInput {
  /** Texto de la solicitud del usuario. Obligatorio y no vacío. */
  readonly input: string;
  readonly inputTokens?: number;
  readonly expectedOutputTokens?: number;
  readonly principalId?: string;
  /** Ámbito federado TAMV (1..7). Sin él, la caché no se reutiliza. */
  readonly federationId?: number;
  readonly territory?: string;
  readonly requiresTools?: boolean;
  readonly requiresMemory?: boolean;
  readonly highImpactTriggers?: readonly HighImpactTrigger[];
}

export interface TrafficLightVerdict {
  readonly version: typeof TRAFFIC_LIGHT_VERSION;
  readonly band: TrafficBand;
  readonly label: string;
  readonly friction: TrafficFriction;
  readonly riskTier: RiskTier;
  readonly category: IntentCategory;
  readonly route: TurboRoute;
  /** true solo en la banda verde: la vía rápida gobernada. */
  readonly fastLane: boolean;
  readonly requiredFilters: readonly TurboFilter[];
  readonly skippedFilters: readonly TurboFilter[];
  readonly cachePolicy: TurboCachePolicy;
  readonly humanReviewRequired: boolean;
  /** Invariante: la clasificación nunca eleva ni reduce la autoridad. */
  readonly authorityPath: "FULL";
  readonly reasons: readonly string[];
  readonly digest: string;
  readonly methodId: typeof TRAFFIC_LIGHT_METHOD_ID;
  readonly disclaimer: typeof TRAFFIC_LIGHT_DISCLAIMER;
}

/**
 * Deriva el `RiskTier` de método a partir de la intención evaluada. Determinista y
 * fail-closed: lo destructivo siempre es CRITICAL; secretos y datos personales son
 * HIGH; acciones externas y gobernanza son MEDIUM; el resto es LOW.
 */
export function riskTierForIntent(intent: IntentAssessment): RiskTier {
  if (intent.isDestructive) return "CRITICAL";
  if (intent.hasSecretRequest || intent.touchesPersonalData || intent.category === "security") {
    return "HIGH";
  }
  if (intent.isExternalAction || intent.category === "external_action" || intent.category === "governance") {
    return "MEDIUM";
  }
  return "LOW";
}

/**
 * Clasifica una solicitud en una banda de semáforo y produce el plan de filtros
 * gobernados que corresponde. No autoriza ni ejecuta: solo enruta el flujo.
 */
export function classifyFlow(input: TrafficLightInput): TrafficLightVerdict {
  const text = typeof input?.input === "string" ? input.input.trim() : "";
  if (!text) throw new Error("TRAFFIC_INPUT_REQUIRED");

  const intent = assessIntent(text);
  const riskTier = riskTierForIntent(intent);

  const plan = planTurboRoute({
    intent: text,
    inputTokens: input.inputTokens ?? Math.max(1, Math.ceil(text.length / 4)),
    expectedOutputTokens: input.expectedOutputTokens ?? 256,
    riskTier,
    principalId: input.principalId?.trim() || "human:anonymous",
    requiresTools: input.requiresTools === true,
    requiresMemory: input.requiresMemory === true,
    highImpactTriggers: input.highImpactTriggers ?? [],
    ...(input.federationId !== undefined ? { federationId: input.federationId } : {}),
    ...(input.territory ? { territory: input.territory } : {}),
  });

  const band = ROUTE_TO_BAND[plan.route];
  const fastLane = band === "GREEN";

  const reasons = [
    `intent:${intent.category}`,
    `riskTier:${riskTier}`,
    `route:${plan.route}`,
    ...plan.reasons,
  ];

  const digest = sha256({
    version: TRAFFIC_LIGHT_VERSION,
    input: text,
    band,
    riskTier,
    category: intent.category,
    route: plan.route,
    requiredFilters: plan.requiredFilters,
    skippedFilters: plan.skippedFilters,
    cachePolicy: plan.cachePolicy,
    federationId: plan.federationId,
    territory: plan.territory,
    humanReviewRequired: plan.humanReviewRequired,
  });

  return Object.freeze({
    version: TRAFFIC_LIGHT_VERSION,
    band,
    label: TRAFFIC_BAND_LABELS[band],
    friction: BAND_TO_FRICTION[band],
    riskTier,
    category: intent.category,
    route: plan.route,
    fastLane,
    requiredFilters: plan.requiredFilters,
    skippedFilters: plan.skippedFilters,
    cachePolicy: plan.cachePolicy,
    humanReviewRequired: plan.humanReviewRequired,
    authorityPath: "FULL",
    reasons: Object.freeze(reasons),
    digest,
    methodId: TRAFFIC_LIGHT_METHOD_ID,
    disclaimer: TRAFFIC_LIGHT_DISCLAIMER,
  });
}

/** ¿La clasificación habilita la vía rápida gobernada, sin degradar la autoridad? */
export function isFastLane(verdict: TrafficLightVerdict): boolean {
  return verdict.fastLane && verdict.band === "GREEN" && verdict.authorityPath === "FULL";
}
