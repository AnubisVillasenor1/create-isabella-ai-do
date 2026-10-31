/**
 * REGALO 6 — REMEDIACIÓN DE RECHAZOS (Refusal Remediation).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: un rechazo sin salida es un fracaso del proyecto. Aquí
 * cada rechazo produce "por qué no" y "cómo sí": pasos concretos y una
 * alternativa segura admisible.
 *
 * Invariante (AGENTS.md): explica y orienta; no autoriza, no ejecuta y no promete
 * que la remediación conceda acceso: la autoridad sigue siendo humana.
 */
import type { RiskTier } from '../authority/method-id';
import type { TrafficBand } from '../governance/traffic-light';
import { digest } from './util';

export const REFUSAL_REMEDIATION_VERSION = '1.0.0' as const;
export const REFUSAL_REMEDIATION_METHOD_ID =
  'A.TWINS.LEGACY.refusal_remediation.explain.v1.0.0.LOW.AUTONOMOUS' as const;
export const REFUSAL_REMEDIATION_DISCLAIMER =
  'La remediación explica y orienta; no concede autoridad ni garantiza aprobación. La decisión permanece humana.';

export interface RefusalContext {
  readonly band: TrafficBand;
  readonly riskTier: RiskTier;
  readonly reasons?: readonly string[];
  readonly missing?: readonly string[];
}

export interface Remediation {
  readonly version: typeof REFUSAL_REMEDIATION_VERSION;
  readonly blocked: boolean;
  readonly explanation: string;
  readonly steps: readonly string[];
  readonly safeAlternative: string;
  readonly appealable: boolean;
  readonly digest: string;
  readonly methodId: typeof REFUSAL_REMEDIATION_METHOD_ID;
  readonly disclaimer: typeof REFUSAL_REMEDIATION_DISCLAIMER;
}

const EXPLANATION: Record<TrafficBand, string> = Object.freeze({
  GREEN: 'Flujo admitido por la vía rápida gobernada: riesgo bajo, sin daño colateral.',
  YELLOW: 'Flujo admitido con verificación de contexto: falta respaldo/grounding.',
  ORANGE: 'Flujo retenido: riesgo alto (datos personales o secretos). Requiere salvaguardas.',
  RED: 'Flujo bloqueado: riesgo crítico, destructivo o de alto impacto. Requiere autoridad humana explícita.',
});

function reasonSteps(reasons: readonly string[]): string[] {
  const extra: string[] = [];
  const joined = reasons.join(' ').toUpperCase();
  if (joined.includes('SECRET'))
    extra.push('No compartas secretos ni credenciales; reformula sin datos sensibles.');
  if (joined.includes('PERSONAL_DATA') || joined.includes('PERSONAL'))
    extra.push('Minimiza o anonimiza los datos personales antes de reintentar.');
  if (joined.includes('DESTRUCTIVE'))
    extra.push('Solicita el borrado con una orden firmada y reversible (papelera + ledger).');
  if (joined.includes('HIGH_IMPACT'))
    extra.push('Presenta evaluación de impacto y plan de reversión.');
  if (joined.includes('APPROVAL'))
    extra.push('Incluye aprobación nominal de una persona autorizada.');
  return extra;
}

export function remediateRefusal(context: RefusalContext): Remediation {
  if (!context || !context.band) throw new Error('REFUSAL_BAND_REQUIRED');
  const reasons = context.reasons ?? [];
  const missing = context.missing ?? [];

  let steps: string[];
  let safeAlternative: string;
  let blocked: boolean;

  switch (context.band) {
    case 'GREEN':
      blocked = false;
      steps = ['Continúa: se ejecutan solo los filtros mínimos necesarios.'];
      safeAlternative = 'No requiere alternativa: el flujo ya es admisible.';
      break;
    case 'YELLOW':
      blocked = false;
      steps = [
        'Añade la fuente o el contexto que respalde la solicitud.',
        'Repite con datos verificables o acota el alcance.',
      ];
      safeAlternative =
        'Si no hay fuente, reformula como pregunta informativa que no requiera respaldo.';
      break;
    case 'ORANGE':
      blocked = true;
      steps = [
        'Identifícate ante la persona autorizada correspondiente.',
        'Minimiza los datos personales al mínimo necesario.',
        'Registra evidencia (propósito, base legal, retención).',
      ];
      safeAlternative = 'Formula una consulta informativa sin datos personales ni secretos.';
      break;
    case 'RED':
    default:
      blocked = true;
      steps = [
        'Incluye aprobación explícita y nominal de una persona con autoridad.',
        'Acota el alcance y describe el efecto y su reversibilidad.',
        'Adjunta evidencia y, si aplica, plan de reversión.',
      ];
      safeAlternative = 'Ejecuta primero en modo simulación o solo lectura para validar el plan.';
      break;
  }

  for (const extra of reasonSteps(reasons)) steps.push(extra);
  for (const slot of missing) steps.push(`Proporciona: ${slot}.`);

  return {
    version: REFUSAL_REMEDIATION_VERSION,
    blocked,
    explanation: EXPLANATION[context.band],
    steps: Object.freeze(steps),
    safeAlternative,
    appealable: context.band === 'ORANGE' || context.band === 'RED',
    digest: digest({ band: context.band, riskTier: context.riskTier, reasons, missing, blocked }),
    methodId: REFUSAL_REMEDIATION_METHOD_ID,
    disclaimer: REFUSAL_REMEDIATION_DISCLAIMER,
  };
}
