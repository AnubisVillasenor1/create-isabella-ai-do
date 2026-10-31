// Ω∞ Master Equation (state: draft | engine-generated).
// CivilizationalValue = Intelligence × Governance × Evidence × Trust × Economy ×
// Memory × Resilience × TerritorialImpact. Si CUALQUIER factor es cero, el valor
// civilizatorio es cero (fail-closed civilizatorio).

export interface CivilizationFactors {
  readonly intelligence: number;
  readonly governance: number;
  readonly evidence: number;
  readonly trust: number;
  readonly economy: number;
  readonly memory: number;
  readonly resilience: number;
  readonly territorialImpact: number;
}

export interface CivilizationValue {
  readonly value: number;
  readonly zeroFactors: readonly string[];
  readonly factors: Readonly<Record<string, number>>;
}

const FACTOR_NAMES = [
  'intelligence',
  'governance',
  'evidence',
  'trust',
  'economy',
  'memory',
  'resilience',
  'territorialImpact',
] as const;

function unit(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`CIVILIZATION_FACTOR_INVALID:${name}`);
  }
  return value;
}

/**
 * Ecuación maestra Ω∞: producto de los ocho factores en [0,1]. Si cualquiera es
 * cero, el valor civilizatorio es 0 (un solo cero anula el sistema). Devuelve
 * además qué factores quedaron en cero para explicabilidad.
 */
export function civilizationalValue(factors: Record<string, number>): CivilizationValue {
  const resolved: Record<string, number> = {};
  const zeroFactors: string[] = [];
  let product = 1;
  for (const name of FACTOR_NAMES) {
    const value = unit(factors[name] as number, name);
    resolved[name] = value;
    if (value === 0) zeroFactors.push(name);
    product *= value;
  }
  return { value: zeroFactors.length > 0 ? 0 : product, zeroFactors, factors: resolved };
}
