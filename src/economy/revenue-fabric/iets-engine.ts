/**
 * Isabella Economic Trust Score (IETS) Engine v5
 * state: engine-generated
 * Replaces fixed 5-referral requirement with dynamic multi-factor economic trust scoring.
 */

import type { RevenueStream } from './types';
import { creatorShareBpsForTier } from '../../commerce/revenue-share';

export const IETS_WEIGHTS = {
  referrals: 0.15,
  revenue: 0.25,
  retention: 0.15,
  skills: 0.1,
  agents: 0.1,
  reputation: 0.15,
  age: 0.05,
  compliance: 0.05,
} as const;

export type IETSInputs = {
  readonly referrals: number;
  readonly revenue: number;
  readonly retention: number;
  readonly skills: number;
  readonly agents: number;
  readonly reputation: number;
  readonly age: number;
  readonly compliance: number;
};

export type IETSTier = 'STARTER' | 'PROFESSIONAL' | 'ADVANCED' | 'ELITE' | 'SOVEREIGN';

export type IETSResult = {
  readonly score: number;
  readonly tier: IETSTier;
  readonly userRate: number;
  readonly platformRate: number;
  readonly breakdown: Record<keyof IETSInputs, number>;
  readonly calculatedAt: string;
};

const TIER_THRESHOLDS: Record<IETSTier, { min: number; max: number }> = {
  STARTER: { min: 0, max: 20 },
  PROFESSIONAL: { min: 21, max: 40 },
  ADVANCED: { min: 41, max: 60 },
  ELITE: { min: 61, max: 80 },
  SOVEREIGN: { min: 81, max: 100 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateIETS(inputs: IETSInputs): IETSResult {
  const clampedInputs: IETSInputs = {
    referrals: clamp(inputs.referrals, 0, 100),
    revenue: clamp(inputs.revenue, 0, 100),
    retention: clamp(inputs.retention, 0, 100),
    skills: clamp(inputs.skills, 0, 100),
    agents: clamp(inputs.agents, 0, 100),
    reputation: clamp(inputs.reputation, 0, 100),
    age: clamp(inputs.age, 0, 100),
    compliance: clamp(inputs.compliance, 0, 100),
  };

  const score = round2(
    clampedInputs.referrals * IETS_WEIGHTS.referrals +
      clampedInputs.revenue * IETS_WEIGHTS.revenue +
      clampedInputs.retention * IETS_WEIGHTS.retention +
      clampedInputs.skills * IETS_WEIGHTS.skills +
      clampedInputs.agents * IETS_WEIGHTS.agents +
      clampedInputs.reputation * IETS_WEIGHTS.reputation +
      clampedInputs.age * IETS_WEIGHTS.age +
      clampedInputs.compliance * IETS_WEIGHTS.compliance
  );

  const finalScore = clamp(score, 0, 100);

  let tier: IETSTier = 'STARTER';
  for (const [t, threshold] of Object.entries(TIER_THRESHOLDS)) {
    if (finalScore >= threshold.min && finalScore <= threshold.max) {
      tier = t as IETSTier;
      break;
    }
  }

  const userRate = creatorShareBpsForTier(tier) / 10_000;
  const platformRate = 1 - userRate;

  return {
    score: finalScore,
    tier,
    userRate,
    platformRate,
    breakdown: {
      referrals: round2(clampedInputs.referrals * IETS_WEIGHTS.referrals),
      revenue: round2(clampedInputs.revenue * IETS_WEIGHTS.revenue),
      retention: round2(clampedInputs.retention * IETS_WEIGHTS.retention),
      skills: round2(clampedInputs.skills * IETS_WEIGHTS.skills),
      agents: round2(clampedInputs.agents * IETS_WEIGHTS.agents),
      reputation: round2(clampedInputs.reputation * IETS_WEIGHTS.reputation),
      age: round2(clampedInputs.age * IETS_WEIGHTS.age),
      compliance: round2(clampedInputs.compliance * IETS_WEIGHTS.compliance),
    },
    calculatedAt: new Date().toISOString(),
  };
}

export function getTierBenefits(tier: IETSTier): string[] {
  const benefits: Record<IETSTier, string[]> = {
    STARTER: ['Acceso básico al marketplace', 'Payouts mensuales'],
    PROFESSIONAL: ['Payouts semanales', 'Analítica básica'],
    ADVANCED: ['Prioridad en descubrimiento', 'Soporte prioritario'],
    ELITE: ['Payouts express', 'Co-marketing', 'Acceso beta'],
    SOVEREIGN: ['Payouts express', 'Co-marketing', 'Acceso beta', 'Gobernanza económica'],
  };
  return benefits[tier] || [];
}
