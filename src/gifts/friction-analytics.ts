/**
 * REGALO 9 — ANALÍTICA DE FRICCIÓN (Friction Analytics).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: el miedo central del proyecto es que las reglas internas
 * bloqueen casi todo ("si cada petición bloquea, el proyecto fracasa"). Este
 * módulo agrega decisiones reales y detecta sobre-bloqueo y flujos VERDES
 * bloqueados por error de configuración.
 *
 * Invariante (AGENTS.md): mide y recomienda; no cambia políticas por sí mismo ni
 * concede autoridad. La corrección es decisión humana.
 */
import { TRAFFIC_BANDS, type TrafficBand } from '../governance/traffic-light';
import { digest, round } from './util';

export const FRICTION_ANALYTICS_VERSION = '1.0.0' as const;
export const FRICTION_ANALYTICS_METHOD_ID =
  'A.TWINS.LEGACY.friction_analytics.observe.v1.0.0.LOW.AUTONOMOUS' as const;
export const FRICTION_ANALYTICS_DISCLAIMER =
  'La analítica de fricción mide y recomienda; no modifica políticas ni concede autoridad.';

export interface DecisionSample {
  readonly band: TrafficBand;
  readonly admitted: boolean;
}

export interface FrictionOptions {
  /** Tasa de bloqueo máxima tolerada antes de sobre-bloqueo. */
  readonly maxBlockRate?: number;
}

export type FrictionVerdict = 'HEALTHY' | 'OVER_BLOCKING' | 'MISCONFIGURED';

export interface BandBreakdown {
  readonly total: number;
  readonly admitted: number;
  readonly blocked: number;
}

export interface FrictionReport {
  readonly version: typeof FRICTION_ANALYTICS_VERSION;
  readonly total: number;
  readonly allowed: number;
  readonly blocked: number;
  readonly blockRate: number;
  readonly byBand: Readonly<Record<TrafficBand, BandBreakdown>>;
  readonly greenBlocked: number;
  readonly overBlocking: boolean;
  readonly maxBlockRate: number;
  readonly misconfigured: boolean;
  readonly verdict: FrictionVerdict;
  readonly recommendations: readonly string[];
  readonly digest: string;
  readonly methodId: typeof FRICTION_ANALYTICS_METHOD_ID;
  readonly disclaimer: typeof FRICTION_ANALYTICS_DISCLAIMER;
}

function emptyBreakdown(): Record<TrafficBand, BandBreakdown> {
  return {
    GREEN: { total: 0, admitted: 0, blocked: 0 },
    YELLOW: { total: 0, admitted: 0, blocked: 0 },
    ORANGE: { total: 0, admitted: 0, blocked: 0 },
    RED: { total: 0, admitted: 0, blocked: 0 },
  };
}

export function analyzeFriction(
  samples: readonly DecisionSample[],
  options: FrictionOptions = {}
): FrictionReport {
  if (!Array.isArray(samples)) throw new Error('FRICTION_SAMPLES_REQUIRED');
  const list: readonly DecisionSample[] = samples;
  const maxBlockRate = options.maxBlockRate ?? 0.5;
  const byBand = emptyBreakdown();
  let allowed = 0;
  let blocked = 0;

  for (const sample of list) {
    if (!(TRAFFIC_BANDS as readonly string[]).includes(sample.band)) {
      throw new Error('FRICTION_BAND_INVALID');
    }
    const current = byBand[sample.band];
    byBand[sample.band] = {
      total: current.total + 1,
      admitted: current.admitted + (sample.admitted ? 1 : 0),
      blocked: current.blocked + (sample.admitted ? 0 : 1),
    };
    if (sample.admitted) allowed += 1;
    else blocked += 1;
  }

  const total = list.length;
  const blockRate = total > 0 ? round(blocked / total, 4) : 0;
  const greenBlocked = byBand.GREEN.blocked;
  const overBlocking = blockRate > maxBlockRate;
  const misconfigured = greenBlocked > 0;

  const verdict: FrictionVerdict = misconfigured
    ? 'MISCONFIGURED'
    : overBlocking
      ? 'OVER_BLOCKING'
      : 'HEALTHY';

  const recommendations: string[] = [];
  if (misconfigured) {
    recommendations.push(
      'Hay flujos VERDES bloqueados: revisa la configuración del semáforo y el ensanchado por confianza ganada.'
    );
  }
  if (overBlocking) {
    recommendations.push(
      `Tasa de bloqueo ${round(blockRate * 100, 2)}% > máximo ${round(maxBlockRate * 100, 2)}%: activa confianza ganada y revisa filtros obligatorios.`
    );
  }
  if (byBand.RED.blocked === byBand.RED.total && byBand.RED.total > 0) {
    recommendations.push(
      'Todo lo ROJO está bloqueado (correcto): ofrece remediación para convertirlo en una ruta admisible.'
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Fricción sana: la mayoría del flujo fluye y lo rojo se contiene.');
  }

  return {
    version: FRICTION_ANALYTICS_VERSION,
    total,
    allowed,
    blocked,
    blockRate,
    byBand: Object.freeze(byBand),
    greenBlocked,
    overBlocking,
    maxBlockRate,
    misconfigured,
    verdict,
    recommendations: Object.freeze(recommendations),
    digest: digest({ total, allowed, blocked, blockRate, byBand }),
    methodId: FRICTION_ANALYTICS_METHOD_ID,
    disclaimer: FRICTION_ANALYTICS_DISCLAIMER,
  };
}

/** Acumulador incremental de decisiones. */
export class FrictionAnalytics {
  private readonly samples: DecisionSample[] = [];

  record(sample: DecisionSample): void {
    if (!(TRAFFIC_BANDS as readonly string[]).includes(sample.band)) {
      throw new Error('FRICTION_BAND_INVALID');
    }
    this.samples.push({ band: sample.band, admitted: sample.admitted === true });
  }

  size(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples.length = 0;
  }

  report(options: FrictionOptions = {}): FrictionReport {
    return analyzeFriction(this.samples, options);
  }
}
