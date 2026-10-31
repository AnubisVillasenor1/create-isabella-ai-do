// state: draft | engine-generated
//
// Predict-time feature contract. Training and serving can silently diverge when
// a caller reorders, renames or omits features; a linear model will happily
// multiply the wrong columns and emit a confident, meaningless number. This
// binds a model to an ordered, typed schema and validates every inference
// vector against it before any prediction is produced. It is a guardrail, not a
// substitute for monitoring or human sign-off.

import { createHash } from 'node:crypto';

export type FeatureType = 'number' | 'bounded' | 'categorical';

export interface FeatureSpec {
  name: string;
  type: FeatureType;
  /** For 'bounded': inclusive numeric range. */
  min?: number;
  max?: number;
  /** For 'categorical': the closed set of allowed string values. */
  allowed?: readonly string[];
}

export interface FeatureContract {
  readonly fields: readonly FeatureSpec[];
  readonly contractHash: string;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function defineContract(fields: readonly FeatureSpec[]): FeatureContract {
  if (fields.length === 0) throw new Error('empty_contract');
  const names = new Set<string>();
  for (const f of fields) {
    if (!f.name) throw new Error('feature_name_required');
    if (names.has(f.name)) throw new Error('duplicate_feature_name');
    names.add(f.name);
    if (f.type === 'bounded') {
      if (f.min === undefined || f.max === undefined || f.min > f.max)
        throw new Error('invalid_bounds');
    }
    if (f.type === 'categorical' && (!f.allowed || f.allowed.length === 0))
      throw new Error('categorical_requires_allowed_set');
  }
  return { fields: Object.freeze([...fields]), contractHash: hash(fields) };
}

export interface ValidationIssue {
  field: string;
  code: string;
}

/** Validate one observation (positional numeric/label vector) against the contract. */
export function validateRow(
  contract: FeatureContract,
  row: readonly (number | string)[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (row.length !== contract.fields.length) {
    return [{ field: '*', code: `arity_mismatch_expected_${contract.fields.length}` }];
  }
  for (let i = 0; i < contract.fields.length; i++) {
    const spec = contract.fields[i]!;
    const value = row[i]!;
    if (spec.type === 'categorical') {
      if (typeof value !== 'string' || !spec.allowed!.includes(value))
        issues.push({ field: spec.name, code: 'value_not_in_allowed_set' });
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ field: spec.name, code: 'non_finite_number' });
        continue;
      }
      if (spec.type === 'bounded') {
        if (value < spec.min! || value > spec.max!)
          issues.push({ field: spec.name, code: 'out_of_bounds' });
      }
    }
  }
  return issues;
}

/**
 * Fail-closed numeric guard: returns the row as numbers only if every field is
 * numeric and in-contract; otherwise throws with the first offending field so a
 * misaligned request cannot reach the predictor.
 */
export function coerceNumericRow(
  contract: FeatureContract,
  row: readonly (number | string)[]
): number[] {
  const issues = validateRow(contract, row);
  if (issues.length > 0) {
    const first = issues[0]!;
    throw new Error(`feature_contract_${first.code}:${first.field}`);
  }
  return row.map((v) => Number(v));
}

export function contractCompatible(a: FeatureContract, b: FeatureContract): boolean {
  return a.contractHash === b.contractHash;
}
