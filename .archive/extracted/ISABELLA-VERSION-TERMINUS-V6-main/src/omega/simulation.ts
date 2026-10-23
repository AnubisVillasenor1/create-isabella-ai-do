// Ω∞-17 · HYPER SIMULATION FABRIC (state: draft | engine-generated).
// Antes de ejecutar, todo mandato se simula: mejor escenario, escenario esperado,
// peor escenario, riesgo residual e impacto. Determinista y puro. Simular NO
// autoriza: sólo produce un informe explicable para la decisión humana.

export interface HyperSimulationReport {
  bestCase: number;
  expectedCase: number;
  worstCase: number;
  confidence: number;
  economicImpact: number;
  socialImpact: number;
  riskResidual: number;
}

export interface SimulationInput {
  readonly base: number;
  readonly volatility: number;
  readonly confidence: number;
  readonly economicImpact?: number;
  readonly socialImpact?: number;
  readonly riskMitigation?: number;
}

function bounded(value: number, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`SIMULATION_${name}_OUT_OF_RANGE`);
  }
  return value;
}

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`SIMULATION_${name}_INVALID`);
  return value;
}

/**
 * Ejecuta una simulación determinista del mandato. `worstCase` nunca baja de 0;
 * `riskResidual` es la volatilidad no mitigada, acotada a [0,1].
 */
export function runHyperSimulation(input: SimulationInput): HyperSimulationReport {
  const base = finite(input.base, "BASE");
  if (base < 0) throw new Error("SIMULATION_BASE_INVALID");
  const volatility = bounded(input.volatility, "VOLATILITY", 0, 1);
  const confidence = bounded(input.confidence, "CONFIDENCE", 0, 1);
  const economicImpact = finite(input.economicImpact ?? 0, "ECONOMIC_IMPACT");
  const socialImpact = finite(input.socialImpact ?? 0, "SOCIAL_IMPACT");
  const riskMitigation = bounded(input.riskMitigation ?? 0, "RISK_MITIGATION", 0, 1);

  const bestCase = Math.max(0, Math.round(base * (1 + volatility)));
  const worstCase = Math.max(0, Math.round(base * (1 - volatility)));
  const expectedCase = Math.round(base);
  const riskResidual = Math.round(volatility * (1 - riskMitigation) * 10000) / 10000;

  return {
    bestCase,
    expectedCase,
    worstCase,
    confidence,
    economicImpact,
    socialImpact,
    riskResidual,
  };
}
