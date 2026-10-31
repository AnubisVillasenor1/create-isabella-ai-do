// Ω∞-21 Autonomous Research Engine (state: draft | engine-generated).
// Ciclo de investigación con cuatro agentes LUMINA (escaneo/novelty), ORACLE
// (pronóstico/feasibility+risk), AXIOM (verificación/evidence) y PRISMA (ranking).
// Fail-closed: sin evidencia suficiente no se selecciona ninguna hipótesis.

export interface ResearchHypothesis {
  id: string;
  statement: string;
  novelty: number;
  feasibility: number;
  evidence: number;
  risk: number;
}

export interface ResearchEvaluation {
  id: string;
  statement: string;
  score: number;
  stage: 'scan' | 'forecast' | 'verify' | 'rank';
  recommendation: 'pursue' | 'gather_evidence' | 'reject';
}

const DEFAULT_EVIDENCE_THRESHOLD = 0.5;
const PURSUE_SCORE_FLOOR = 0.5;
const WEIGHT_NOVELTY = 0.3;
const WEIGHT_FEASIBILITY = 0.3;
const WEIGHT_EVIDENCE = 0.3;
const WEIGHT_RISK = 0.1;

function unit(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('RESEARCH_FACTOR_OUT_OF_RANGE');
  }
  return value;
}

function thresholdUnit(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('RESEARCH_THRESHOLD_OUT_OF_RANGE');
  }
  return value;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function byScoreThenId(a: ResearchEvaluation, b: ResearchEvaluation): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function stageFor(
  recommendation: ResearchEvaluation['recommendation']
): ResearchEvaluation['stage'] {
  if (recommendation === 'pursue') return 'rank';
  if (recommendation === 'gather_evidence') return 'verify';
  return 'forecast';
}

export function runResearchCycle(
  hypotheses: ResearchHypothesis[],
  options?: { evidenceThreshold?: number }
): { evaluations: ResearchEvaluation[]; selectedId: string | null } {
  const providedThreshold = options?.evidenceThreshold;
  const evidenceThreshold =
    providedThreshold === undefined ? DEFAULT_EVIDENCE_THRESHOLD : thresholdUnit(providedThreshold);

  const seen = new Set<string>();
  for (const hypothesis of hypotheses) {
    unit(hypothesis.novelty);
    unit(hypothesis.feasibility);
    unit(hypothesis.evidence);
    unit(hypothesis.risk);
    if (seen.has(hypothesis.id)) throw new Error('RESEARCH_DUPLICATE_ID');
    seen.add(hypothesis.id);
  }

  const evaluations: ResearchEvaluation[] = hypotheses.map((hypothesis) => {
    const score = round4(
      hypothesis.novelty * WEIGHT_NOVELTY +
        hypothesis.feasibility * WEIGHT_FEASIBILITY +
        hypothesis.evidence * WEIGHT_EVIDENCE +
        (1 - hypothesis.risk) * WEIGHT_RISK
    );
    const recommendation: ResearchEvaluation['recommendation'] =
      hypothesis.evidence < evidenceThreshold
        ? 'gather_evidence'
        : score >= PURSUE_SCORE_FLOOR
          ? 'pursue'
          : 'reject';
    return {
      id: hypothesis.id,
      statement: hypothesis.statement,
      score,
      stage: stageFor(recommendation),
      recommendation,
    };
  });

  evaluations.sort(byScoreThenId);

  const pursuing = evaluations.filter((evaluation) => evaluation.recommendation === 'pursue');
  const selectedId = pursuing.length > 0 ? (pursuing[0]?.id ?? null) : null;

  return { evaluations, selectedId };
}
