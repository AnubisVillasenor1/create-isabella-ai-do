/**
 * Protocolo de Registro y Alineación de Métodos (canon v40).
 *
 * Identificador de 7 segmentos:
 *   [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK_TIER].[GOVERNANCE_TIER]
 *
 * Ejemplo canónico:
 *   T.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM.TERRITORIAL
 */

export const TINA_TYPES = ["T", "I", "N", "A"] as const;
export type TinaType = (typeof TINA_TYPES)[number];

export const TINA_TYPE_LABELS: Record<TinaType, string> = {
  T: "Territorial",
  I: "Institucional",
  N: "Normativa",
  A: "Auto-cognitiva",
};

export const YUN_FEDERATIONS = [
  "IDENTITY",
  "PATRIMONY",
  "TOURISM",
  "ECONOMY",
  "TWINS",
  "COLLECTIVE_INTELLIGENCE",
  "RESILIENCE",
] as const;
export type YunFederation = (typeof YUN_FEDERATIONS)[number];

export const RISK_TIERS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const GOVERNANCE_TIERS = [
  "CONSTITUTIONAL",
  "TERRITORIAL",
  "INSTITUTIONAL",
  "OPERATIONAL",
  "AUTONOMOUS",
] as const;
export type GovernanceTier = (typeof GOVERNANCE_TIERS)[number];

export const REGISTRATION_PHASES = [
  "proposal",
  "design",
  "validation",
  "registration",
  "operation",
] as const;
export type RegistrationPhase = (typeof REGISTRATION_PHASES)[number];

/** E00..E23 — 24 módulos expertos del MoE Genesis Turbo (canon v40). */
export type ExpertModule = string;

export const EXPERT_MODULE_COUNT = 24;

export const ARCHITECTURAL_ENGINES = [
  "CROWN",
  "AEGIS",
  "NCUA",
  "BOOKPI",
  "MOE_ROUTER",
  "TRINITY_VLLM",
  "TURBO_PIPELINE",
  "NATIVE_ML",
  "HDCVSA_MEMORY",
] as const;

const EXPERT_MODULE_RE = /^E\d{2}(?:_[A-Z][A-Z0-9_]*)?$/;
const FUNCTION_RE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;
const VERSION_RE = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface MethodId {
  tina: TinaType;
  yun: YunFederation;
  module: ExpertModule;
  function: string;
  version: string;
  riskTier: RiskTier;
  governanceTier: GovernanceTier;
}

export function formatMethodId(m: MethodId): string {
  return [
    m.tina,
    m.yun,
    m.module,
    m.function,
    m.version,
    m.riskTier,
    m.governanceTier,
  ].join(".");
}

export function isValidModule(module: ExpertModule): boolean {
  if (ARCHITECTURAL_ENGINES.includes(module as (typeof ARCHITECTURAL_ENGINES)[number])) {
    return true;
  }
  if (!EXPERT_MODULE_RE.test(module)) {
    return false;
  }
  const idx = Number(module.slice(1, 3));
  return Number.isInteger(idx) && idx >= 0 && idx < EXPERT_MODULE_COUNT;
}

export function parseMethodId(input: string): MethodId {
  const tokens = input.split(".");
  if (tokens.length < 7) {
    throw new Error(`MethodId inválido: se esperaban al menos 7 segmentos, se recibieron ${tokens.length}`);
  }

  const tina = tokens[0] as MethodId["tina"];
  const yun = tokens[1] as MethodId["yun"];
  const module = tokens[2] as MethodId["module"];
  const governanceTier = tokens.at(-1) as MethodId["governanceTier"];
  const riskTier = tokens.at(-2) as MethodId["riskTier"];

  // Región [FUNCION + VERSION]: entre el módulo (índice 3) y el risque tier.
  // La versión es el sufijo más largo de la región que cumple semver; permite
  // versiones con más de un token (ej. v1.0.0 → "v1","0","0").
  const regionStart = 3;
  const regionEnd = tokens.length - 2;
  if (regionEnd <= regionStart) {
    throw new Error(`MethodId inválido: región [FUNCION|VERSION] vacía`);
  }
  const region = tokens.slice(regionStart, regionEnd);
  let versionIndexInRegion = -1;
  for (let suffixLen = region.length; suffixLen >= 1; suffixLen -= 1) {
    const candidate = region.slice(region.length - suffixLen).join(".");
    if (VERSION_RE.test(candidate)) {
      versionIndexInRegion = region.length - suffixLen;
      break;
    }
  }
  if (versionIndexInRegion <= 0) {
    throw new Error(`MethodId inválido: no se halló segmento de versión semver`);
  }
  const fn = region.slice(0, versionIndexInRegion).join(".");
  const version = region.slice(versionIndexInRegion).join(".");

  if (!TINA_TYPES.includes(tina)) {
    throw new Error(`MethodId inválido: TINA tipo desconocido '${tina}'`);
  }
  if (!YUN_FEDERATIONS.includes(yun)) {
    throw new Error(`MethodId inválido: federación desconocida '${yun}'`);
  }
  if (!isValidModule(module)) {
    throw new Error(`MethodId inválido: módulo fuera de rango E00-E23 '${module}'`);
  }
  if (!FUNCTION_RE.test(fn)) {
    throw new Error(`MethodId inválido: función '${fn}' no cumple el patrón`);
  }
  if (!RISK_TIERS.includes(riskTier)) {
    throw new Error(`MethodId inválido: risk tier desconocido '${riskTier}'`);
  }
  if (!GOVERNANCE_TIERS.includes(governanceTier)) {
    throw new Error(`MethodId inválido: governance tier desconocido '${governanceTier}'`);
  }

  return { tina, yun, module, function: fn, version, riskTier, governanceTier };
}

export function buildMethodId(parts: Omit<MethodId, "function"> & { function: string }): string {
  return formatMethodId({
    ...parts,
    function: parts.function,
  });
}

export const CANONICAL_EXAMPLE_METHOD_ID =
  "T.TOURISM.E06_UX.recommend_route.synthesize.v1.0.0.MEDIUM.TERRITORIAL";

/** Principios de alineación para registro de métodos. */
export const ALIGNMENT_PRINCIPLES = [
  "traceability",
  "minimum_authority",
  "reversibility",
  "ethical_consistency",
  "radical_transparency",
] as const;
export type AlignmentPrinciple = (typeof ALIGNMENT_PRINCIPLES)[number];