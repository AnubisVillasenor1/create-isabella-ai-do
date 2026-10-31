import { createHash } from 'node:crypto';

export const AGENTIC_WORLD_VERSION = 'AW-0-inspired-1.0.0' as const;

export const ISABELLA_PRIMITIVES = [
  'observe',
  'pick',
  'place',
  'move',
  'rotate',
  'handover',
  'release',
  'wait',
  'verify',
] as const;
export type IsabellaPrimitive = (typeof ISABELLA_PRIMITIVES)[number];

export interface SkillStep {
  readonly primitive: IsabellaPrimitive;
  readonly target?: string;
  readonly parameters?: Readonly<Record<string, string | number | boolean>>;
  readonly expectedObservation?: string;
}

export interface SkillProgram {
  readonly id: string;
  readonly goal: string;
  readonly steps: readonly SkillStep[];
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
  readonly confidence: number;
  readonly digest: string;
}

export interface SkillValidation {
  readonly valid: boolean;
  readonly executable: boolean;
  readonly reasons: readonly string[];
}

export interface HybridExecutionDecision {
  readonly mode: 'PROGRAM' | 'ACTION_CHUNK' | 'HUMAN_REVIEW';
  readonly reason: string;
  readonly programDigest: string;
  readonly requiresConfirmation: boolean;
}

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function validateStep(step: SkillStep, index: number, reasons: string[]): void {
  if (!ISABELLA_PRIMITIVES.includes(step.primitive)) {
    reasons.push(`STEP_${index}_UNKNOWN_PRIMITIVE`);
  }
  if (!['observe', 'wait', 'verify'].includes(step.primitive) && !step.target?.trim()) {
    reasons.push(`STEP_${index}_TARGET_REQUIRED`);
  }
  if (step.expectedObservation !== undefined && !step.expectedObservation.trim()) {
    reasons.push(`STEP_${index}_EXPECTED_OBSERVATION_EMPTY`);
  }
}

export function validateSkillProgram(program: SkillProgram): SkillValidation {
  const reasons: string[] = [];
  if (!program.goal.trim()) reasons.push('GOAL_REQUIRED');
  if (!program.steps.length) reasons.push('STEPS_REQUIRED');
  if (program.steps.length > 32) reasons.push('STEP_LIMIT_EXCEEDED');
  program.steps.forEach((step, index) => validateStep(step, index, reasons));
  if (!Number.isFinite(program.confidence) || program.confidence < 0 || program.confidence > 1) {
    reasons.push('CONFIDENCE_OUT_OF_RANGE');
  }
  const hasVerification = program.steps.some((step) => step.primitive === 'verify');
  if (!hasVerification) reasons.push('POSTCONDITION_VERIFICATION_REQUIRED');
  return Object.freeze({
    valid: reasons.length === 0,
    executable: reasons.length === 0 && program.confidence >= 0.7,
    reasons: Object.freeze(reasons),
  });
}

export function compileSkillProgram(input: {
  goal: string;
  steps: readonly SkillStep[];
  preconditions?: readonly string[];
  postconditions?: readonly string[];
  confidence?: number;
}): SkillProgram {
  const goal = input.goal.trim();
  if (!goal) throw new Error('ISABELLA_SKILL_GOAL_REQUIRED');
  const steps = input.steps.map((step) => ({
    ...step,
    target: step.target?.trim(),
    expectedObservation: step.expectedObservation?.trim(),
  }));
  const digest = hash({
    version: AGENTIC_WORLD_VERSION,
    goal,
    steps,
    preconditions: [...(input.preconditions ?? [])],
    postconditions: [...(input.postconditions ?? [])],
  });
  const program: SkillProgram = Object.freeze({
    id: `skill_${digest.slice(0, 20)}`,
    goal,
    steps: Object.freeze(steps),
    preconditions: Object.freeze([...(input.preconditions ?? [])]),
    postconditions: Object.freeze([...(input.postconditions ?? [])]),
    confidence: clamp01(input.confidence ?? 0.5),
    digest,
  });
  const validation = validateSkillProgram(program);
  if (!validation.valid) throw new Error(`ISABELLA_SKILL_INVALID:${validation.reasons.join(',')}`);
  return program;
}

export function arbitrateHybridExecution(input: {
  program: SkillProgram;
  actionChunkAvailable: boolean;
  observationConfident: boolean;
  progressConfirmed: boolean;
  highImpact: boolean;
}): HybridExecutionDecision {
  const validation = validateSkillProgram(input.program);
  if (input.highImpact) {
    return {
      mode: 'HUMAN_REVIEW',
      reason: 'HIGH_IMPACT_REQUIRES_HUMAN_REVIEW',
      programDigest: input.program.digest,
      requiresConfirmation: true,
    };
  }
  if (validation.executable && input.observationConfident && input.progressConfirmed) {
    return {
      mode: 'PROGRAM',
      reason: 'VALID_PROGRAM_AND_GROUNDED_PROGRESS_CONFIRMED',
      programDigest: input.program.digest,
      requiresConfirmation: false,
    };
  }
  if (input.actionChunkAvailable) {
    return {
      mode: 'ACTION_CHUNK',
      reason: validation.reasons[0] ?? 'PROGRAM_GROUNDING_NOT_CONFIRMED',
      programDigest: input.program.digest,
      requiresConfirmation: false,
    };
  }
  return {
    mode: 'HUMAN_REVIEW',
    reason: 'NO_SAFE_EXECUTION_FALLBACK_AVAILABLE',
    programDigest: input.program.digest,
    requiresConfirmation: true,
  };
}
