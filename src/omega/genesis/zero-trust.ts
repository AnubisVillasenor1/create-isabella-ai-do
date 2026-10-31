// state: draft | engine-generated — Seguridad Ω-Zero Trust (Documento §XI).
// Puerta FAIL-CLOSED de cinco factores: ALLOW = I × A × C × P × E
// (Identity, Authority, Context, Policy, Evidence). Cada factor es booleano; si ALGUNO vale
// 0, el resultado es DENY. Complementa (no reemplaza) la ecuación de legitimidad de 8 factores
// de `../native/legitimacy`: esta es la capa de admisión de request estilo NIST SP 800-207,
// evaluada ANTES de conceder cualquier contexto. No autoriza por sí misma acciones gobernadas:
// la autoridad ejecutiva la decide CROWN + Constitución. Confianza nunca implícita.

export const ZERO_TRUST_FACTORS = [
  'identity',
  'authority',
  'context',
  'policy',
  'evidence',
] as const;
export type ZeroTrustFactor = (typeof ZERO_TRUST_FACTORS)[number];

export interface ZeroTrustSignals {
  /** Identidad verificada (no anónima), p. ej. DID resuelto y principal no vacío. */
  readonly identityVerified: boolean;
  /** Autoridad explícita para la acción (scope/mandato presente). */
  readonly authorityGranted: boolean;
  /** Contexto dentro de límites (territorio, tenant, ventana temporal válidos). */
  readonly contextValid: boolean;
  /** Política vigente evaluada sin violación. */
  readonly policyCompliant: boolean;
  /** Evidencia suficiente adjunta o referenciada. */
  readonly evidencePresent: boolean;
}

export interface ZeroTrustDecision {
  readonly allowed: boolean;
  readonly product: 0 | 1;
  readonly failedFactors: readonly ZeroTrustFactor[];
  readonly evaluatedAt: string;
}

function factorsFrom(signals: ZeroTrustSignals): Record<ZeroTrustFactor, boolean> {
  return {
    identity: signals.identityVerified === true,
    authority: signals.authorityGranted === true,
    context: signals.contextValid === true,
    policy: signals.policyCompliant === true,
    evidence: signals.evidencePresent === true,
  };
}

/**
 * Evalúa la admisión Zero Trust. Fail-closed: `allowed` es true SOLO si los cinco factores
 * valen 1 (producto = 1). Cualquier fallo devuelve la lista de factores fallidos para
 * trazabilidad, sin conceder nada.
 */
export function evaluateZeroTrust(
  signals: ZeroTrustSignals,
  clock: () => string = () => new Date().toISOString()
): ZeroTrustDecision {
  const factors = factorsFrom(signals);
  const failedFactors = ZERO_TRUST_FACTORS.filter((name) => !factors[name]);
  const product: 0 | 1 = failedFactors.length === 0 ? 1 : 0;
  return Object.freeze({
    allowed: product === 1,
    product,
    failedFactors: Object.freeze(failedFactors),
    evaluatedAt: clock(),
  });
}
