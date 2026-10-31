/**
 * Context Compiler for HyperCore Ω² (state: draft).
 *
 * Compresses a raw request into a compact canonical cognitive state. This is a
 * DETERMINISTIC, extraction-based reduction (entities/objectives/constraints),
 * NOT a neural semantic distillation. The compression ratio is computed from
 * token estimates, not measured tokenizer output.
 */
import { tokenize } from './canonical';
import type { CognitiveState, HyperCoreTask } from './types';

export interface ContextCompilerOptions {
  readonly policyVersion?: string;
}

const CONSTRAINT_MARKERS = [
  'no ',
  'not ',
  'never',
  'without',
  'sin ',
  'must not',
  'prohibido',
  'forbid',
  'only',
  'solo ',
];
const MAX_ENTITIES = 12;
const MAX_LINES = 5;

function extractEntities(prompt: string, domain: string): readonly string[] {
  const found = new Set<string>();
  const quoted = prompt.match(/"([^"]+)"/g) ?? [];
  for (const raw of quoted) {
    const value = raw.replace(/"/g, '').trim();
    if (value) found.add(value);
  }
  const capitalized = prompt.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ0-9]{2,}\b/g) ?? [];
  for (const value of capitalized) {
    if (value.toLowerCase() !== value) found.add(value);
  }
  if (domain) found.add(domain);
  return Object.freeze([...found].slice(0, MAX_ENTITIES));
}

function splitClauses(prompt: string): readonly string[] {
  return prompt
    .split(/[.;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function extractObjectives(clauses: readonly string[]): readonly string[] {
  return Object.freeze(clauses.slice(0, MAX_LINES));
}

function extractConstraints(clauses: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    if (CONSTRAINT_MARKERS.some((marker) => lower.includes(marker))) out.push(clause);
    if (out.length >= MAX_LINES) break;
  }
  return Object.freeze(out);
}

function estimateCompiledTokens(state: {
  entities: readonly string[];
  objectives: readonly string[];
  constraints: readonly string[];
  memory: readonly string[];
}): number {
  return (
    24 +
    state.entities.length * 3 +
    state.objectives.length * 10 +
    state.constraints.length * 8 +
    state.memory.length * 6
  );
}

export function compileContext(
  task: HyperCoreTask,
  memory: readonly string[] = [],
  options: ContextCompilerOptions = {}
): CognitiveState {
  const clauses = splitClauses(task.prompt);
  const entities = extractEntities(task.prompt, task.domain);
  const objectives = extractObjectives(clauses);
  const constraints = extractConstraints(clauses);
  const originalTokens = Math.max(0, Math.floor(task.contextTokens));
  const estimated = estimateCompiledTokens({ entities, objectives, constraints, memory });
  const compiledTokens = originalTokens > 0 ? Math.min(originalTokens, estimated) : estimated;
  const compressionRatio =
    originalTokens > 0
      ? Math.max(0, Math.min(1, (originalTokens - compiledTokens) / originalTokens))
      : 0;

  return Object.freeze({
    intent: task.intent,
    domain: task.domain,
    entities,
    objectives,
    constraints,
    memory: Object.freeze([...memory]),
    risk: task.risk,
    policyVersion: options.policyVersion ?? 'unversioned',
    originalTokens,
    compiledTokens,
    compressionRatio,
  });
}

export function cognitiveStateTokens(state: CognitiveState): number {
  return tokenize(
    state.entities.join(' ') + ' ' + state.objectives.join(' ') + ' ' + state.constraints.join(' ')
  ).length;
}
