/**
 * Normalized Settlement Engine - IFRF v4
 * state: engine-generated
 * Sovereign Revenue Fabric: Normalized financial model with vaults and dynamic splitting.
 */

import type { RevenueStream, IETSTier } from "./types";
import { calculateIETS, type IETSInputs, type IETSResult } from "./iets-engine";

export type SettlementPolicy = {
  readonly version: string;
  readonly emergencyRate: number;
  readonly innovationRate: number;
  readonly treasuryRate: number;
};

export const DEFAULT_POLICY: SettlementPolicy = {
  version: "isabella-ifrf-v4.0.0",
  emergencyRate: 0.01,
  innovationRate: 0.01,
  treasuryRate: 0.01,
};

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
  readonly ietsScore: number;
  readonly ietsTier: IETSTier;
  readonly policyVersion: string;
  readonly occurredAt: string;
  readonly externalPaymentId?: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeSettlement(inputs: SettlementInputs): SettlementResult {
  const policy = inputs.policy || DEFAULT_POLICY;

  const gross = round2(inputs.grossAmount);
  const directCost = round2(inputs.directCost);
  const tax = round2(inputs.taxAmount);
  const gateway = round2(inputs.gatewayFee);

  if (gross <= 0) {
    throw new Error("SETTLEMENT: grossAmount must be positive");
  }
  if (directCost < 0 || tax < 0 || gateway < 0) {
    throw new Error("SETTLEMENT: costs cannot be negative");
  }

  const operatingIncome = round2(gross - directCost - tax - gateway);
  const effectiveOperatingIncome = Math.max(0, operatingIncome);

  const emergency = round2(effectiveOperatingIncome * policy.emergencyRate);
  const innovation = round2(effectiveOperatingIncome * policy.innovationRate);
  const treasury = round2(effectiveOperatingIncome * policy.treasuryRate);

  const distributablePool = round2(effectiveOperatingIncome - emergency - innovation - treasury);

  const iets = calculateIETS(inputs.ietsInputs);
  const { userRate, platformRate, tier } = iets;

  const userShare = round2(distributablePool * userRate);
  const platformShare = round2(distributablePool - userShare);

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
    ietsScore: iets.score,
    ietsTier: tier,
    policyVersion: policy.version,
    occurredAt: inputs.occurredAt || new Date().toISOString(),
    externalPaymentId: inputs.externalPaymentId,
  };
}

export function validateSettlementInvariants(result: SettlementResult): void {
  const totalVaults = result.emergencyAmount + result.innovationAmount + result.treasuryAmount;
  const reconstructedOI = round2(totalVaults + result.distributablePool);
  if (reconstructedOI !== result.operatingIncome) {
    throw new Error(`SETTLEMENT_INVARIANT_FAILED: vaults + pool (${reconstructedOI}) !== operatingIncome (${result.operatingIncome})`);
  }

  const reconstructedPool = round2(result.userShare + result.platformShare);
  if (reconstructedPool !== result.distributablePool) {
    throw new Error(`SETTLEMENT_INVARIANT_FAILED: userShare + platformShare (${reconstructedPool}) !== distributablePool (${result.distributablePool})`);
  }

  const reconstructedGross = round2(
    result.directCost + result.taxAmount + result.gatewayFee +
    result.emergencyAmount + result.innovationAmount + result.treasuryAmount +
    result.userShare + result.platformShare
  );
  if (reconstructedGross !== result.grossAmount) {
    throw new Error(`SETTLEMENT_INVARIANT_FAILED: reconstruction (${reconstructedGross}) !== grossAmount (${result.grossAmount})`);
  }
}