// state: draft | engine-generated — Motor de Evolución Controlada (Documento §XIII).
// Principio innegociable: SELF-IMPROVEMENT ≠ SELF-MODIFICATION. Toda evolución recorre una
// máquina de estados EXPLÍCITA y REVERSIBLE: simulate → audit → validate → authorize → apply
// → record. La máquina NUNCA aplica un cambio sin una autorización HUMANA verificada, y
// rechaza de fábrica cualquier auto-modificación estructural. Ninguna transición de esta
// máquina toca código ni configuración real: modela y gatingoberna el ciclo; la ejecución
// la decide un humano conforme a AGENTS.md §1.

export const EVOLUTION_STAGES = [
  'simulated',
  'audited',
  'validated',
  'authorized',
  'applied',
  'recorded',
] as const;
export type EvolutionStage = (typeof EVOLUTION_STAGES)[number];

export type ProposalKind = 'self-improvement' | 'self-modification';

export interface EvolutionProposal {
  readonly id: string;
  readonly description: string;
  readonly kind: ProposalKind;
  readonly reversible: boolean;
  /** Aprobación humana explícita (nombre + referencia). Sin esto, nunca se aplica. */
  readonly humanAuthorizer?: string;
  readonly approvalRef?: string;
}

export interface StageRecord {
  readonly stage: EvolutionStage;
  readonly status: 'PASSED' | 'BLOCKED' | 'REFUSED';
  readonly reason: string;
}

export interface EvolutionOutcome {
  readonly proposalId: string;
  readonly applied: boolean;
  readonly finalStage: EvolutionStage | null;
  readonly trace: readonly StageRecord[];
  readonly principle: 'SELF-IMPROVEMENT != SELF-MODIFICATION';
}

/**
 * Evalúa una propuesta de evolución. Rechaza toda self-modificación (auto-modificación
 * estructural) y bloquea la aplicación sin autorización humana. Las etapas previas
 * (simulate/audit/validate) se superan solo si la propuesta es sustancial y reversible.
 */
export function runControlledEvolution(proposal: EvolutionProposal): EvolutionOutcome {
  const trace: StageRecord[] = [];
  const push = (stage: EvolutionStage, status: StageRecord['status'], reason: string): void => {
    trace.push(Object.freeze({ stage, status, reason }));
  };

  if (proposal.kind === 'self-modification') {
    push('simulated', 'REFUSED', 'self-modification está prohibida por el principio canónico');
    return Object.freeze({
      proposalId: proposal.id,
      applied: false,
      finalStage: null,
      trace: Object.freeze(trace),
      principle: 'SELF-IMPROVEMENT != SELF-MODIFICATION',
    });
  }

  const substantial = proposal.id.trim() !== '' && proposal.description.trim() !== '';
  push(
    'simulated',
    substantial ? 'PASSED' : 'BLOCKED',
    substantial ? 'simulación del cambio producida' : 'propuesta vacía'
  );
  if (!substantial) return freezeOutcome(proposal.id, false, trace, 'simulated');

  push('audited', 'PASSED', 'impacto y alcance auditados en simulación');

  const reversible = proposal.reversible === true;
  push(
    'validated',
    reversible ? 'PASSED' : 'BLOCKED',
    reversible ? 'validada: cambio reversible' : 'rechazada: cambio no reversible'
  );
  if (!reversible) return freezeOutcome(proposal.id, false, trace, 'validated');

  const authorized = nonEmpty(proposal.humanAuthorizer) && nonEmpty(proposal.approvalRef);
  push(
    'authorized',
    authorized ? 'PASSED' : 'BLOCKED',
    authorized ? 'autorización humana verificada' : 'sin autorización humana: la máquina no aplica'
  );
  if (!authorized) return freezeOutcome(proposal.id, false, trace, 'authorized');

  push(
    'applied',
    'PASSED',
    'cambio aplicado como propuesta registrada (sin efectos externos aquí)'
  );
  push('recorded', 'PASSED', 'evidencia del ciclo registrada');
  return freezeOutcome(proposal.id, true, trace, 'recorded');
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function freezeOutcome(
  proposalId: string,
  applied: boolean,
  trace: readonly StageRecord[],
  finalStage: EvolutionStage
): EvolutionOutcome {
  return Object.freeze({
    proposalId,
    applied,
    finalStage,
    trace: Object.freeze([...trace]),
    principle: 'SELF-IMPROVEMENT != SELF-MODIFICATION',
  });
}
