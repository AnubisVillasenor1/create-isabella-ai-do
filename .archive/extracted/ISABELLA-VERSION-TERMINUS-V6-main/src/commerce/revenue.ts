/** COMMERCE — ingresos confirmados, fórmulas estadísticas y niveles de confianza. */

import type { CommerceConfidenceLevel as ConfidenceLevel, RevenueMetric, RevenueSummary } from "./types";

export interface RevenueComponents {
  grossConfirmed: number;
  fees: number;
  refunds: number;
  variableCost: number;
  currency: string;
}

function validAmount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("REVENUE: los importes deben ser finitos y no negativos.");
  }
  return value;
}

export function createRevenueSummary(input: RevenueComponents): RevenueSummary {
  const grossConfirmed = validAmount(input.grossConfirmed);
  const fees = validAmount(input.fees);
  const refunds = validAmount(input.refunds);
  const variableCost = validAmount(input.variableCost);
  if (fees + refunds + variableCost > grossConfirmed) {
    throw new Error("REVENUE: deducciones superan el ingreso bruto confirmado.");
  }
  return {
    grossConfirmed,
    fees,
    refunds,
    variableCost,
    netConfirmed: grossConfirmed - fees - refunds - variableCost,
    currency: input.currency,
    updatedAt: new Date().toISOString(),
  };
}

export function applyRefund(summary: RevenueSummary, amount: number): RevenueSummary {
  const refunds = validAmount(amount);
  return createRevenueSummary({
    grossConfirmed: summary.grossConfirmed,
    fees: summary.fees,
    refunds: summary.refunds + refunds,
    variableCost: summary.variableCost,
    currency: summary.currency,
  });
}

export function conversionRate(confirmedSales: number, qualifiedLeads: number): number {
  if (qualifiedLeads <= 0) return 0;
  return confirmedSales / qualifiedLeads;
}

export function cac(acquisitionCost: number, newCustomers: number): number {
  if (newCustomers <= 0) return 0;
  return acquisitionCost / newCustomers;
}

export function aov(grossSales: number, paidOrders: number): number {
  if (paidOrders <= 0) return 0;
  return grossSales / paidOrders;
}

export function refundRate(refundedOrders: number, paidOrders: number): number {
  if (paidOrders <= 0) return 0;
  return refundedOrders / paidOrders;
}

export function marginContribution(netConfirmed: number, grossConfirmed: number): number {
  if (grossConfirmed <= 0) return 0;
  return netConfirmed / grossConfirmed;
}

export function confidenceLevel(
  observations: number,
  partialAttribution = false,
): ConfidenceLevel {
  if (observations >= 100 && !partialAttribution) return "high";
  if (observations >= 20) return "medium";
  return "low";
}

export function metric(
  name: string,
  value: number,
  observations: number,
  partialAttribution = false,
): RevenueMetric {
  return {
    name,
    value,
    observations,
    confidence: confidenceLevel(observations, partialAttribution),
    partialAttribution,
    updatedAt: new Date().toISOString(),
  };
}
