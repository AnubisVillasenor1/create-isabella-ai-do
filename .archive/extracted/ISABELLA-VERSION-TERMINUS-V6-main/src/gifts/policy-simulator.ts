/**
 * REGALO 10 — SIMULADOR DE POLÍTICA (Policy Simulator).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: cambiar reglas a ciegas es cómo se ahoga la adopción.
 * Antes de desplegar, este módulo simula el efecto de los interruptores de
 * política sobre una carga de casos y advierte si bloquearía demasiado o si
 * abriría un riesgo constitucional.
 *
 * Invariante (AGENTS.md): predecir no es decidir. El simulador no despliega ni
 * autoriza; solo proyecta consecuencias para arbitraje humano.
 */
import { TRAFFIC_BANDS, type TrafficBand } from "../governance/traffic-light";
import { digest, round } from "./util";

export const POLICY_SIMULATOR_VERSION = "1.0.0" as const;
export const POLICY_SIMULATOR_METHOD_ID =
  "A.TWINS.LEGACY.policy_simulator.simulate.v1.0.0.LOW.AUTONOMOUS" as const;
export const POLICY_SIMULATOR_DISCLAIMER =
  "El simulador de política proyecta consecuencias; no despliega, no autoriza ni modifica configuración.";

export interface PolicyKnobs {
  /** Vía rápida activa para flujos VERDES. */
  readonly fastLaneEnabled?: boolean;
  /** Los flujos AMARILLOS requieren aprobación (por defecto no). */
  readonly yellowRequiresApproval?: boolean;
  /** Los flujos NARANJA requieren aprobación (por defecto sí). */
  readonly orangeRequiresApproval?: boolean;
  /** Los flujos ROJOS siempre se bloquean (por defecto sí; desactivarlo es riesgo constitucional). */
  readonly redAlwaysBlocked?: boolean;
  /** La confianza ganada puede ensanchar la vía rápida. */
  readonly trustWidening?: boolean;
}

export interface SimulationCase {
  readonly band: TrafficBand;
  readonly count?: number;
}

export interface BandSimulation {
  readonly total: number;
  readonly admitted: number;
  readonly blocked: number;
}

export type PolicyVerdict = "HEALTHY" | "TOO_RESTRICTIVE" | "CONSTITUTIONAL_RISK";

export interface PolicySimulation {
  readonly version: typeof POLICY_SIMULATOR_VERSION;
  readonly knobs: Required<PolicyKnobs>;
  readonly total: number;
  readonly admitted: number;
  readonly blocked: number;
  readonly predictedBlockRate: number;
  readonly predictedAdmitRate: number;
  readonly byBand: Readonly<Record<TrafficBand, BandSimulation>>;
  readonly verdict: PolicyVerdict;
  readonly warnings: readonly string[];
  readonly digest: string;
  readonly methodId: typeof POLICY_SIMULATOR_METHOD_ID;
  readonly disclaimer: typeof POLICY_SIMULATOR_DISCLAIMER;
}

const DEFAULT_KNOBS: Required<PolicyKnobs> = Object.freeze({
  fastLaneEnabled: true,
  yellowRequiresApproval: false,
  orangeRequiresApproval: true,
  redAlwaysBlocked: true,
  trustWidening: false,
});

function admitsUnder(band: TrafficBand, knobs: Required<PolicyKnobs>): boolean {
  switch (band) {
    case "GREEN":
      return knobs.fastLaneEnabled;
    case "YELLOW":
      return !knobs.yellowRequiresApproval;
    case "ORANGE":
      return !knobs.orangeRequiresApproval;
    case "RED":
    default:
      return !knobs.redAlwaysBlocked;
  }
}

function emptySim(): Record<TrafficBand, BandSimulation> {
  return {
    GREEN: { total: 0, admitted: 0, blocked: 0 },
    YELLOW: { total: 0, admitted: 0, blocked: 0 },
    ORANGE: { total: 0, admitted: 0, blocked: 0 },
    RED: { total: 0, admitted: 0, blocked: 0 },
  };
}

export function simulatePolicy(
  knobs: PolicyKnobs,
  cases: readonly SimulationCase[],
): PolicySimulation {
  if (!Array.isArray(cases)) throw new Error("POLICY_SIMULATOR_CASES_REQUIRED");
  const list: readonly SimulationCase[] = cases;
  const resolved: Required<PolicyKnobs> = { ...DEFAULT_KNOBS, ...knobs };
  const byBand = emptySim();
  let total = 0;
  let admitted = 0;

  for (const item of list) {
    if (!(TRAFFIC_BANDS as readonly string[]).includes(item.band)) {
      throw new Error("POLICY_SIMULATOR_BAND_INVALID");
    }
    const count = item.count === undefined ? 1 : item.count;
    if (!Number.isInteger(count) || count < 0) throw new Error("POLICY_SIMULATOR_COUNT_INVALID");
    const admits = admitsUnder(item.band, resolved);
    const current = byBand[item.band];
    byBand[item.band] = {
      total: current.total + count,
      admitted: current.admitted + (admits ? count : 0),
      blocked: current.blocked + (admits ? 0 : count),
    };
    total += count;
    if (admits) admitted += count;
  }

  const blocked = total - admitted;
  const predictedBlockRate = total > 0 ? round(blocked / total, 4) : 0;
  const predictedAdmitRate = total > 0 ? round(admitted / total, 4) : 0;

  const warnings: string[] = [];
  if (resolved.redAlwaysBlocked === false) {
    warnings.push("CONSTITUCIONAL: flujos ROJOS admitidos sin bloqueo obligatorio.");
  }
  if (resolved.orangeRequiresApproval === false) {
    warnings.push("Riesgo alto (NARANJA) admitido sin aprobación.");
  }
  if (resolved.fastLaneEnabled === false) {
    warnings.push("Vía rápida desactivada: los flujos VERDES pasarán por filtrado adicional (más lento).");
  }
  if (predictedBlockRate > 0.5) {
    warnings.push(`La política bloquearía ${round(predictedBlockRate * 100, 2)}% del tráfico: demasiado dura.`);
  }
  const verdict: PolicyVerdict =
    resolved.redAlwaysBlocked === false
      ? "CONSTITUTIONAL_RISK"
      : predictedBlockRate > 0.5
        ? "TOO_RESTRICTIVE"
        : "HEALTHY";

  return {
    version: POLICY_SIMULATOR_VERSION,
    knobs: resolved,
    total,
    admitted,
    blocked,
    predictedBlockRate,
    predictedAdmitRate,
    byBand: Object.freeze(byBand),
    verdict,
    warnings: Object.freeze(warnings),
    digest: digest({ knobs: resolved, cases, total, admitted, blocked }),
    methodId: POLICY_SIMULATOR_METHOD_ID,
    disclaimer: POLICY_SIMULATOR_DISCLAIMER,
  };
}
