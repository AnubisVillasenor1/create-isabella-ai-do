/**
 * TURBO ROUTE PLANNER Ω — planificador de ruta de baja latencia, federado y ético.
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: el repositorio ya sabe acelerar (adaptive-router decide
 * complejidad y modo; el caché semántico gobernado reutiliza respuestas; el MoE
 * soberano enruta expertos), pero **nada decide, de forma auditable, QUÉ filtros
 * gobernados deben ejecutarse antes de entregar la respuesta al usuario y cuáles
 * pueden evitarse con seguridad**. Cada filtro interno (AEGIS, CROWN, VIGIA,
 * anclaje, contradicción, permisos, saneamiento) consume tiempo; el usuario pidió
 * un "mega turbo" que reduzca la latencia real sin degradar la garantía.
 *
 * Este planificador compone las piezas existentes y produce un `TurboPlan`
 * determinista: una ruta (`FAST | GROUNDED | AGENT | HUMAN_REVIEW`), la lista de
 * filtros obligatorios vs. omitibles, la política de caché y el ámbito federado.
 *
 * Invariante (AGENTS.md): planificar una ruta **NO autoriza ni ejecuta**. La ruta
 * es una recomendación de flujo; CROWN sigue autorizando, AEGIS sigue filtrando y
 * BookPI sigue evidenciando. `authorityPath` permanece `FULL` siempre.
 *
 * Fail-closed: riesgo HIGH/CRITICAL o cualquier disparador de alto impacto fuerza
 * `HUMAN_REVIEW` con TODOS los filtros obligatorios y sin reutilización de caché.
 * Sin ámbito federado declarado, la reutilización de caché se desactiva (no se
 * puede violar el aislamiento entre inquilinos/federaciones).
 */
import { HIGH_IMPACT_TRIGGERS, type HighImpactTrigger } from "../ingress/isa-api";
import type { RiskTier } from "../authority/method-id";
import { sha256 } from "../skills/canonical-json";
import { planExecution, type ComplexityClass, type AdaptivePlan } from "./adaptive-router";

export const TURBO_PLANNER_VERSION = "1.0.0" as const;

/** Identidad de método canónica (AGENTS.md §5). */
export const TURBO_PLANNER_METHOD_ID =
  "A.IDENTITY.E00_TURBO.plan_route.v1.0.0.MEDIUM.OPERATIONAL" as const;

export const TURBO_PLANNER_DISCLAIMER =
  "El planificador de ruta asigna CÓMO acelerar sin conceder autoridad: la ruta es una recomendación de flujo, no una autorización ni una ejecución. La autoridad permanece en CROWN y la evidencia en BookPI." as const;

/** Rutas de ejecución, de la más barata (FAST) a la más deliberativa (HUMAN_REVIEW). */
export const TURBO_ROUTES = ["FAST", "GROUNDED", "AGENT", "HUMAN_REVIEW"] as const;
export type TurboRoute = (typeof TURBO_ROUTES)[number];

/** Filtros gobernados que pueden ejecutarse antes de entregar una respuesta. */
export const TURBO_FILTERS = [
  "AEGIS",
  "CROWN",
  "SANITIZATION",
  "VIGIA",
  "GROUNDING",
  "CONTRADICTION",
  "PERMISSION_MAP",
] as const;
export type TurboFilter = (typeof TURBO_FILTERS)[number];

/** Política de reutilización de caché (fail-closed: NONE no reutiliza nada). */
export const TURBO_CACHE_POLICIES = ["NONE", "PREFIX", "SEMANTIC"] as const;
export type TurboCachePolicy = (typeof TURBO_CACHE_POLICIES)[number];

export interface TurboRequest {
  readonly intent: string;
  readonly inputTokens: number;
  readonly expectedOutputTokens?: number;
  /** Presión de carga 0..1 (por defecto 0). */
  readonly pressure?: number;
  readonly riskTier: RiskTier;
  readonly requiresTools?: boolean;
  readonly requiresMemory?: boolean;
  readonly highImpactTriggers?: readonly HighImpactTrigger[];
  /** Ámbito federado TAMV (1..7). Sin él, la caché no se reutiliza. */
  readonly federationId?: number;
  readonly territory?: string;
  readonly principalId: string;
}

export interface TurboFilterPlan {
  readonly filter: TurboFilter;
  readonly required: boolean;
  readonly reason: string;
}

export interface TurboPlan {
  readonly version: typeof TURBO_PLANNER_VERSION;
  readonly route: TurboRoute;
  readonly complexity: ComplexityClass;
  readonly mode: AdaptivePlan["hypercore"]["mode"];
  readonly filters: readonly TurboFilterPlan[];
  readonly requiredFilters: readonly TurboFilter[];
  readonly skippedFilters: readonly TurboFilter[];
  readonly cachePolicy: TurboCachePolicy;
  readonly federationId: number | null;
  readonly territory: string;
  /** Invariante: la ruta nunca eleva ni reduce la autoridad. */
  readonly authorityPath: "FULL";
  readonly humanReviewRequired: boolean;
  readonly highImpactTriggered: boolean;
  readonly reasons: readonly string[];
  readonly digest: string;
  readonly methodId: typeof TURBO_PLANNER_METHOD_ID;
  readonly disclaimer: typeof TURBO_PLANNER_DISCLAIMER;
}

/** Filtros obligatorios por ruta; el resto son omitibles con seguridad. */
const REQUIRED_BY_ROUTE: Record<TurboRoute, readonly TurboFilter[]> = {
  FAST: ["AEGIS", "CROWN", "SANITIZATION"],
  GROUNDED: ["AEGIS", "CROWN", "SANITIZATION", "GROUNDING"],
  AGENT: ["AEGIS", "CROWN", "SANITIZATION", "VIGIA", "GROUNDING", "CONTRADICTION", "PERMISSION_MAP"],
  HUMAN_REVIEW: TURBO_FILTERS,
};

const HIGH_RISK: readonly RiskTier[] = ["HIGH", "CRITICAL"];

function validate(request: TurboRequest): void {
  if (!request || typeof request.intent !== "string" || request.intent.trim().length === 0) {
    throw new Error("TURBO_INTENT_REQUIRED");
  }
  if (!Number.isInteger(request.inputTokens) || request.inputTokens < 0) {
    throw new Error("TURBO_INPUT_TOKENS_INVALID");
  }
  if (request.expectedOutputTokens !== undefined &&
    (!Number.isInteger(request.expectedOutputTokens) || request.expectedOutputTokens < 0)) {
    throw new Error("TURBO_OUTPUT_TOKENS_INVALID");
  }
  if (request.pressure !== undefined &&
    (!Number.isFinite(request.pressure) || request.pressure < 0 || request.pressure > 1)) {
    throw new Error("TURBO_PRESSURE_INVALID");
  }
  if (!request.principalId || !request.principalId.trim()) {
    throw new Error("TURBO_PRINCIPAL_REQUIRED");
  }
  if (request.federationId !== undefined &&
    (!Number.isInteger(request.federationId) || request.federationId < 1 || request.federationId > 7)) {
    throw new Error("TURBO_FEDERATION_INVALID");
  }
}

function chooseRoute(plan: AdaptivePlan, request: TurboRequest, reasons: string[]): TurboRoute {
  const highImpact = (request.highImpactTriggers ?? []).filter((trigger) =>
    (HIGH_IMPACT_TRIGGERS as readonly string[]).includes(trigger),
  );
  if (request.riskTier === "CRITICAL") {
    reasons.push("CRITICAL_RISK_REQUIRES_HUMAN_REVIEW");
    return "HUMAN_REVIEW";
  }
  if (highImpact.length > 0) {
    reasons.push(`HIGH_IMPACT_TRIGGER:${highImpact.join(",")}`);
    return "HUMAN_REVIEW";
  }
  if (plan.complexity === "DEEP" || request.requiresTools === true || request.riskTier === "HIGH") {
    reasons.push("DEEP_OR_TOOLED_OR_HIGH_RISK_ROUTES_TO_AGENT");
    return "AGENT";
  }
  if (plan.complexity === "STANDARD" || request.requiresMemory === true || request.riskTier === "MEDIUM") {
    reasons.push("STANDARD_OR_MEMORY_OR_MEDIUM_RISK_ROUTES_TO_GROUNDED");
    return "GROUNDED";
  }
  reasons.push("TRIVIAL_LOW_RISK_ROUTES_TO_FAST");
  return "FAST";
}

/**
 * Construye un plan de ruta turbo determinista y fail-closed. No ejecuta ni
 * autoriza nada; solo decide qué filtros deben correr y si la caché puede
 * reutilizarse para este principal/federación.
 */
export function planTurboRoute(request: TurboRequest): TurboPlan {
  validate(request);

  const reasons: string[] = [];
  const adaptive = planExecution({
    inputTokens: request.inputTokens,
    expectedOutputTokens: request.expectedOutputTokens ?? 0,
    pressure: request.pressure ?? 0,
    riskTier: request.riskTier,
    requiresTools: request.requiresTools === true,
    requiresMemory: request.requiresMemory === true,
  });

  const route = chooseRoute(adaptive, request, reasons);
  const required = REQUIRED_BY_ROUTE[route];
  const requiredSet = new Set<TurboFilter>(required);

  const filters: TurboFilterPlan[] = TURBO_FILTERS.map((filter) => {
    const isRequired = requiredSet.has(filter);
    return {
      filter,
      required: isRequired,
      reason: isRequired
        ? `obligatorio en ruta ${route}`
        : `omitible con seguridad en ruta ${route}`,
    };
  });
  const requiredFilters = TURBO_FILTERS.filter((filter) => requiredSet.has(filter));
  const skippedFilters = TURBO_FILTERS.filter((filter) => !requiredSet.has(filter));

  const highRisk = HIGH_RISK.includes(request.riskTier);
  const federationId = request.federationId ?? null;
  let cachePolicy: TurboCachePolicy;
  if (route === "HUMAN_REVIEW" || highRisk) {
    cachePolicy = "NONE";
    reasons.push("CACHE_DISABLED_HIGH_RISK_OR_HUMAN_REVIEW");
  } else if (federationId === null) {
    cachePolicy = "NONE";
    reasons.push("CACHE_DISABLED_NO_FEDERATION_SCOPE");
  } else if (route === "FAST") {
    cachePolicy = "SEMANTIC";
  } else {
    cachePolicy = "PREFIX";
  }

  const territory = request.territory?.trim() || "global";
  const humanReviewRequired = route === "HUMAN_REVIEW";
  const highImpactTriggered = reasons.some((reason) => reason.startsWith("HIGH_IMPACT_TRIGGER"));

  const digest = sha256({
    version: TURBO_PLANNER_VERSION,
    intent: request.intent.trim(),
    principalId: request.principalId.trim(),
    inputTokens: request.inputTokens,
    expectedOutputTokens: request.expectedOutputTokens ?? 0,
    pressure: request.pressure ?? 0,
    riskTier: request.riskTier,
    requiresTools: request.requiresTools === true,
    requiresMemory: request.requiresMemory === true,
    highImpactTriggers: [...(request.highImpactTriggers ?? [])].sort(),
    route,
    complexity: adaptive.complexity,
    mode: adaptive.hypercore.mode,
    requiredFilters,
    skippedFilters,
    cachePolicy,
    federationId,
    territory,
    humanReviewRequired,
  });

  return Object.freeze({
    version: TURBO_PLANNER_VERSION,
    route,
    complexity: adaptive.complexity,
    mode: adaptive.hypercore.mode,
    filters: Object.freeze(filters),
    requiredFilters: Object.freeze(requiredFilters),
    skippedFilters: Object.freeze(skippedFilters),
    cachePolicy,
    federationId,
    territory,
    authorityPath: "FULL",
    humanReviewRequired,
    highImpactTriggered,
    reasons: Object.freeze(reasons),
    digest,
    methodId: TURBO_PLANNER_METHOD_ID,
    disclaimer: TURBO_PLANNER_DISCLAIMER,
  });
}

/** ¿La ruta exige ejecutar este filtro? */
export function routeRequiresFilter(plan: TurboPlan, filter: TurboFilter): boolean {
  return plan.requiredFilters.includes(filter);
}
