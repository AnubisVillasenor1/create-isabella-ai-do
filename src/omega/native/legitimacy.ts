// state: draft | engine-generated — Ecuación de legitimidad Ω∞ (Documento §I).
// Es la capa que hace EJECUTABLE la ecuación canónica reutilizando la Constitución ya
// existente (src/omega/constitution.ts). No añade autoridad: compone los ocho factores
// del documento y los diez artículos constitucionales; si algún factor vale 0 o la
// Constitución devuelve allowed=false, el resultado es DENY (fail-closed).
import {
  evaluateConstitution,
  type ConstitutionalAssertion,
  type ConstitutionalDecision,
} from '../constitution';
import { LEGITIMACY_FACTORS, type LegitimacyFactorName, type LegitimacyFactors } from './contracts';

export interface NativeAssurance {
  readonly requestId: string;
  readonly actorDid: string;
  readonly principalKind: 'human' | 'machine' | 'service';
  readonly mandate: string;
  readonly policyVersion: string;
  readonly humanOverrideAvailable: boolean;
  readonly territory: string;
  readonly explanation: string;
  readonly recoveryPlan: string;
  readonly learningRecord: string;
  readonly economicJustification: string;
  readonly governanceGranted: boolean;
  readonly evidencePresent: boolean;
  readonly tracePresent: boolean;
  readonly executionAuthorized: boolean;
}

export interface LegitimacyEvaluation {
  readonly factors: LegitimacyFactors;
  readonly product: 0 | 1;
  readonly missingFactors: readonly LegitimacyFactorName[];
  readonly constitution: ConstitutionalDecision;
  readonly allowed: boolean;
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Deriva los ocho factores de la ecuación desde condiciones reales. La identidad exige un
 * DID y un principal no anónimo; la autoridad un mandato; la gobernanza el veredicto de
 * CROWN; la supervisión humana debe declararse explícitamente disponible.
 */
export function computeLegitimacyFactors(a: NativeAssurance): LegitimacyFactors {
  return Object.freeze({
    identity: nonEmpty(a.actorDid),
    authority: nonEmpty(a.mandate),
    policy: nonEmpty(a.policyVersion),
    evidence: a.evidencePresent,
    execution: a.executionAuthorized,
    traceability: nonEmpty(a.requestId) && a.tracePresent,
    governance: a.governanceGranted,
    humanOversight: a.humanOverrideAvailable === true,
  });
}

/** Traduce la operación nativa a las etapas y campos que exige la Constitución. */
export function buildConstitutionalAssertions(
  a: NativeAssurance,
  evidenceRefs: readonly string[],
  auditTrail: readonly string[]
): ConstitutionalAssertion[] {
  return [
    { stage: 'constitution', territory: a.territory },
    { stage: 'policy' },
    { stage: 'mandate', identity: a.actorDid, authority: a.mandate },
    {
      stage: 'capability',
      explanation: a.explanation,
      humanOverrideAvailable: a.humanOverrideAvailable,
    },
    {
      stage: 'execution',
      evidence: evidenceRefs,
      auditTrail,
      economicJustification: a.economicJustification,
      recoveryPlan: a.recoveryPlan,
      learningRecord: a.learningRecord,
    },
  ];
}

/**
 * Evalúa la legitimidad de una operación nativa. `allowed` solo es true cuando el producto
 * de los ocho factores es 1 Y la Constitución no declara ninguna violación.
 */
export function computeLegitimacy(
  a: NativeAssurance,
  evidenceRefs: readonly string[],
  auditTrail: readonly string[],
  clock: () => string = () => new Date().toISOString()
): LegitimacyEvaluation {
  const factors = computeLegitimacyFactors(a);
  const missingFactors = LEGITIMACY_FACTORS.filter((name) => !factors[name]);
  const product: 0 | 1 = missingFactors.length === 0 ? 1 : 0;
  const constitution = evaluateConstitution(
    buildConstitutionalAssertions(a, evidenceRefs, auditTrail),
    clock
  );
  return Object.freeze({
    factors,
    product,
    missingFactors,
    constitution,
    allowed: product === 1 && constitution.allowed,
  });
}
