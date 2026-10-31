// state: draft | engine-generated — Gemelo Digital Cognitivo (Documento §XIV).
// Representación digital, READ-ONLY y DETERMINISTA del estado del sistema: conocimiento,
// capacidad, memoria, riesgo y salud. Produce una clasificación de salud, un índice de
// riesgo agregado y una huella canónica (SHA-256) reproducible para simulación, forecasting,
// stress testing y capacity planning. NO ejecuta ni predice por ML: deriva métricas por
// composición determinista de señales que recibe. No abre red ni mide telemetría real.
import { sha256 } from '../../skills/canonical-json';

export interface TwinSignals {
  readonly availabilityRatio: number; // 0..1
  readonly errorRate: number; // 0..1
  readonly queueDepthRatio: number; // 0..1 (ocupación frente a capacidad)
  readonly memoryUsageRatio: number; // 0..1
  readonly trustMean: number; // 0..1 (confianza media de la sociedad de agentes)
  readonly policyCompliance: number; // 0..1 (fracción de decisiones gobernanles conformes)
  readonly evidenceChainValid: boolean;
}

export type TwinHealth = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export interface TwinSnapshot {
  readonly health: TwinHealth;
  readonly riskIndex: number; // 0..1, mayor = más riesgo
  readonly capacityHeadroom: number; // 0..1, margen de capacidad disponible
  readonly alerts: readonly string[];
  readonly fingerprint: string; // SHA-256 determinista del estado
  readonly observedAt: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function assertSignals(s: TwinSignals): void {
  const ratios = [
    s.availabilityRatio,
    s.errorRate,
    s.queueDepthRatio,
    s.memoryUsageRatio,
    s.trustMean,
    s.policyCompliance,
  ];
  for (const r of ratios) {
    if (!Number.isFinite(r) || r < 0 || r > 1) throw new Error('TWIN_SIGNAL_OUT_OF_RANGE');
  }
}

/**
 * Construye una instantánea del gemelo. El índice de riesgo combina de forma determinista
 * error, saturación, uso de memoria y pérdida de confianza/cumplimiento. `capacityHeadroom`
 * es la fracción de capacidad no consumida (1 − máximo de las presiones de recursos).
 */
export function buildCognitiveTwin(
  signals: TwinSignals,
  clock: () => string = () => new Date().toISOString()
): TwinSnapshot {
  assertSignals(signals);
  const alerts: string[] = [];

  const resourcePressure = Math.max(signals.queueDepthRatio, signals.memoryUsageRatio);
  const riskIndex = clamp01(
    0.3 * signals.errorRate +
      0.2 * resourcePressure +
      0.2 * (1 - signals.trustMean) +
      0.2 * (1 - signals.policyCompliance) +
      0.1 * (1 - signals.availabilityRatio) +
      (signals.evidenceChainValid ? 0 : 0.25)
  );

  if (!signals.evidenceChainValid) alerts.push('evidence_chain_invalid');
  if (signals.errorRate > 0.1) alerts.push('elevated_error_rate');
  if (signals.availabilityRatio < 0.95) alerts.push('availability_below_slo');
  if (resourcePressure > 0.85) alerts.push('resource_saturation');
  if (signals.policyCompliance < 0.9) alerts.push('policy_compliance_below_threshold');

  const health: TwinHealth =
    riskIndex >= 0.6 ? 'CRITICAL' : riskIndex >= 0.3 ? 'DEGRADED' : 'HEALTHY';
  const observedAt = clock();
  const fingerprint = sha256({ ...signals, observedAt });

  return Object.freeze({
    health,
    riskIndex,
    capacityHeadroom: clamp01(1 - resourcePressure),
    alerts: Object.freeze(alerts),
    fingerprint,
    observedAt,
  });
}
