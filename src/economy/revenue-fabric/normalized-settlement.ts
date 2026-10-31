/**
 * Normalized Settlement Engine - IFRF v5
 * state: engine-generated
 * Sovereign Revenue Fabric: Normalized financial model with vaults and dynamic splitting.
 */

import type { RevenueStream, IETSTier } from './types';
import { calculateIETS, type IETSInputs, type IETSResult } from './iets-engine';
import {
  canEarn,
  creatorShareBpsForTier,
  MAX_USER_SHARE_BPS,
  MIN_USER_SHARE_BPS,
  splitPlatformRevenue,
  USER_SHARE_BPS,
} from '../../commerce/revenue-share';
import type { PlanId, SubscriptionStatus } from '../../commerce/types';

export type SettlementPolicy = {
  readonly version: string;
  readonly emergencyRate: number;
  readonly innovationRate: number;
  readonly treasuryRate: number;
};

export const DEFAULT_POLICY: SettlementPolicy = {
  version: 'isabella-ifrf-v5.0.0',
  emergencyRate: 0.01,
  innovationRate: 0.01,
  treasuryRate: 0.01,
};

const VALID_REVENUE_STREAMS = new Set<RevenueStream>([
  'SUBSCRIPTION',
  'ISA_API',
  'SKILL_MARKETPLACE',
  'AGENT_MARKETPLACE',
  'AGENT_HOSTING',
  'AI_CLOUD',
  'AGENT_REVENUE_SHARING',
  'HYPERAUTOMATION',
  'WHITE_LABEL',
  'CERTIFICATION',
  'DATA_VAULT',
  'ECOSYSTEM_TREASURY',
]);

export type SettlementInputs = {
  readonly grossAmount: number;
  readonly directCost: number;
  readonly taxAmount: number;
  readonly gatewayFee: number;
  readonly ietsInputs: IETSInputs;
  readonly policy?: SettlementPolicy;
  readonly stream: RevenueStream;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly externalPaymentId?: string;
  readonly occurredAt?: string;
  readonly creatorId?: string;
  readonly creatorWorkspaceId?: string;
  readonly creatorPlan?: PlanId;
  readonly creatorSubscriptionStatus?: SubscriptionStatus;
  readonly consentEvidenceRef?: string;
  readonly dataLicenceEvidenceRef?: string;
  readonly dataVaultCreatorRateBps?: number;
};

export type SettlementResult = {
  readonly idempotencyKey: string;
  readonly stream: RevenueStream;
  readonly currency: string;
  readonly grossAmount: number;
  readonly directCost: number;
  readonly taxAmount: number;
  readonly gatewayFee: number;
  readonly operatingIncome: number;
  readonly emergencyAmount: number;
  readonly innovationAmount: number;
  readonly treasuryAmount: number;
  readonly distributablePool: number;
  readonly userRate: number;
  readonly platformRate: number;
  readonly userShare: number;
  readonly platformShare: number;
  readonly platformPhoenixFund: number;
  readonly platformInfrastructure: number;
  readonly platformDao: number;
  readonly ietsScore: number;
  readonly ietsTier: IETSTier;
  readonly policyVersion: string;
  readonly occurredAt: string;
  readonly externalPaymentId?: string;
  readonly creatorId?: string;
  readonly creatorEligible: boolean;
  readonly creatorEligibilityReason: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMinorUnits(amount: number): number {
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor) || minor < 0 || Math.abs(minor / 100 - amount) > 0.000001) {
    throw new Error('SETTLEMENT_MINOR_UNITS_INVALID');
  }
  return minor;
}

export function normalizeSettlement(inputs: SettlementInputs): SettlementResult {
  if (!inputs || typeof inputs !== 'object') throw new Error('SETTLEMENT_INPUT_REQUIRED');
  const policy = inputs.policy || DEFAULT_POLICY;
  if (!policy.version.trim() || policy.version.length > 128)
    throw new Error('SETTLEMENT_POLICY_VERSION_INVALID');
  for (const rate of [policy.emergencyRate, policy.innovationRate, policy.treasuryRate]) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1)
      throw new Error('SETTLEMENT_POLICY_RATE_INVALID');
  }
  if (policy.emergencyRate + policy.innovationRate + policy.treasuryRate > 1) {
    throw new Error('SETTLEMENT_POLICY_RATES_EXCEED_100_PERCENT');
  }
  if (!VALID_REVENUE_STREAMS.has(inputs.stream)) throw new Error('SETTLEMENT_STREAM_INVALID');
  if (
    typeof inputs.idempotencyKey !== 'string' ||
    !inputs.idempotencyKey.trim() ||
    inputs.idempotencyKey.length > 200
  ) {
    throw new Error('SETTLEMENT_IDEMPOTENCY_KEY_INVALID');
  }
  if (typeof inputs.currency !== 'string' || !/^[A-Z]{3}$/.test(inputs.currency)) {
    throw new Error('SETTLEMENT_CURRENCY_INVALID');
  }
  if (inputs.occurredAt && !Number.isFinite(Date.parse(inputs.occurredAt)))
    throw new Error('SETTLEMENT_OCCURRED_AT_INVALID');
  for (const [field, value] of [
    ['grossAmount', inputs.grossAmount],
    ['directCost', inputs.directCost],
    ['taxAmount', inputs.taxAmount],
    ['gatewayFee', inputs.gatewayFee],
  ] as const) {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      Math.abs(Math.round(value * 100) / 100 - value) > 0.000001
    ) {
      throw new Error('SETTLEMENT_AMOUNT_INVALID:' + field);
    }
  }

  const gross = round2(inputs.grossAmount);
  const directCost = round2(inputs.directCost);
  const tax = round2(inputs.taxAmount);
  const gateway = round2(inputs.gatewayFee);

  if (gross <= 0) throw new Error('SETTLEMENT_GROSS_MUST_BE_POSITIVE');
  if (directCost + tax + gateway > gross) throw new Error('SETTLEMENT_DEDUCTIONS_EXCEED_GROSS');

  const operatingIncome = round2(gross - directCost - tax - gateway);
  const effectiveOperatingIncome = Math.max(0, operatingIncome);

  const emergency = round2(effectiveOperatingIncome * policy.emergencyRate);
  const innovation = round2(effectiveOperatingIncome * policy.innovationRate);
  const treasury = round2(effectiveOperatingIncome * policy.treasuryRate);

  const distributablePool = round2(effectiveOperatingIncome - emergency - innovation - treasury);

  const iets = calculateIETS(inputs.ietsInputs);
  const creatorStreams = new Set<RevenueStream>([
    'ISA_API',
    'SKILL_MARKETPLACE',
    'AGENT_MARKETPLACE',
    'AGENT_REVENUE_SHARING',
    'HYPERAUTOMATION',
    'DATA_VAULT',
  ]);
  const creatorStream = creatorStreams.has(inputs.stream);
  const eligibility =
    inputs.creatorPlan && inputs.creatorSubscriptionStatus
      ? canEarn(inputs.creatorPlan, inputs.creatorSubscriptionStatus)
      : null;
  const creatorEligible =
    creatorStream && Boolean(inputs.creatorId) && eligibility?.eligible === true;
  const creatorEligibilityReason = !creatorStream
    ? 'PLATFORM_ONLY_STREAM'
    : !inputs.creatorId
      ? 'CREATOR_ID_MISSING'
      : !eligibility
        ? 'SUBSCRIPTION_STATE_MISSING'
        : eligibility.eligible
          ? 'ELIGIBLE'
          : (eligibility.reason ?? 'INELIGIBLE').toUpperCase();

  if (inputs.stream === 'DATA_VAULT') {
    if (!inputs.consentEvidenceRef?.trim() || !inputs.dataLicenceEvidenceRef?.trim()) {
      throw new Error('SETTLEMENT_DATA_VAULT_EVIDENCE_REQUIRED');
    }
    const explicitRate = inputs.dataVaultCreatorRateBps ?? -1;
    if (
      !Number.isInteger(explicitRate) ||
      explicitRate < MIN_USER_SHARE_BPS ||
      explicitRate > MAX_USER_SHARE_BPS
    ) {
      throw new Error('SETTLEMENT_DATA_VAULT_CREATOR_RATE_OUT_OF_POLICY');
    }
  }

  let creatorRateBps = 0;
  if (creatorEligible) {
    if (inputs.stream === 'ISA_API') creatorRateBps = USER_SHARE_BPS;
    else if (inputs.stream === 'DATA_VAULT')
      creatorRateBps = inputs.dataVaultCreatorRateBps as number;
    else
      creatorRateBps = creatorShareBpsForTier(
        iets.tier,
        inputs.stream === 'HYPERAUTOMATION' ? 'hyperautomation' : 'standard'
      );
  }
  const userRate = creatorRateBps / 10_000;
  const platformRate = round2(1 - userRate);
  const { tier } = iets;

  const userShare = round2(distributablePool * userRate);
  const platformShare = round2(distributablePool - userShare);
  const platformAllocation = splitPlatformRevenue(toMinorUnits(platformShare));

  return {
    idempotencyKey: inputs.idempotencyKey,
    stream: inputs.stream,
    currency: inputs.currency,
    grossAmount: gross,
    directCost,
    taxAmount: tax,
    gatewayFee: gateway,
    operatingIncome: effectiveOperatingIncome,
    emergencyAmount: emergency,
    innovationAmount: innovation,
    treasuryAmount: treasury,
    distributablePool,
    userRate,
    platformRate,
    userShare,
    platformShare,
    platformPhoenixFund: platformAllocation.phoenixFundCents / 100,
    platformInfrastructure: platformAllocation.infrastructureCents / 100,
    platformDao: platformAllocation.daoCents / 100,
    ietsScore: iets.score,
    ietsTier: tier,
    policyVersion: policy.version,
    occurredAt: inputs.occurredAt || new Date().toISOString(),
    externalPaymentId: inputs.externalPaymentId,
    creatorId: creatorEligible ? inputs.creatorId : undefined,
    creatorEligible,
    creatorEligibilityReason,
  };
}

export function validateSettlementInvariants(result: SettlementResult): void {
  const totalVaults = result.emergencyAmount + result.innovationAmount + result.treasuryAmount;
  const reconstructedOI = round2(totalVaults + result.distributablePool);
  if (reconstructedOI !== result.operatingIncome) {
    throw new Error(
      `SETTLEMENT_INVARIANT_FAILED: vaults + pool (${reconstructedOI}) !== operatingIncome (${result.operatingIncome})`
    );
  }

  const reconstructedPool = round2(result.userShare + result.platformShare);
  if (reconstructedPool !== result.distributablePool) {
    throw new Error(
      `SETTLEMENT_INVARIANT_FAILED: userShare + platformShare (${reconstructedPool}) !== distributablePool (${result.distributablePool})`
    );
  }

  const reconstructedGross = round2(
    result.directCost +
      result.taxAmount +
      result.gatewayFee +
      result.emergencyAmount +
      result.innovationAmount +
      result.treasuryAmount +
      result.userShare +
      result.platformShare
  );
  if (reconstructedGross !== result.grossAmount) {
    throw new Error(
      `SETTLEMENT_INVARIANT_FAILED: reconstruction (${reconstructedGross}) !== grossAmount (${result.grossAmount})`
    );
  }
}
