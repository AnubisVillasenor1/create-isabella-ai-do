/** COMMERCE — señales antifraude; solo aumentan revisión, no deciden irreversible. */

import type { CommerceRiskLevel, FraudCategory, FraudDecision, FraudSignal, FraudVerdict } from "./types";

export interface FraudInput {
  selfPurchase?: boolean;
  duplicateConversion?: boolean;
  automatedClicks?: boolean;
  duplicatedLead?: boolean;
  relatedAccounts?: boolean;
  anomalousTraffic?: boolean;
  regionChange?: boolean;
  highRetryRate?: boolean;
  highCancellationRate?: boolean;
  pendingCommissionsMisreportedAsPaid?: boolean;
  missingConsent?: boolean;
  rateLimitExceeded?: boolean;
  unverifiedContact?: boolean;
  credentialReuse?: boolean;
}

function signal(category: FraudCategory, name: string, weight: number, detail: string): FraudSignal {
  return { category, name, weight, detail };
}

const BLOCKING: Readonly<Array<[name: string, category: FraudCategory, input: keyof FraudInput, detail: string]>> = [
  ["SELF_PURCHASE", "affiliate", "selfPurchase", "compra realizada por el propio afiliado"],
  ["DUPLICATE_CONVERSION", "affiliate", "duplicateConversion", "conversión duplicada en atribución"],
];

const REVIEW: Readonly<Array<[name: string, category: FraudCategory, input: keyof FraudInput, detail: string]>> = [
  ["AUTOMATED_CLICKS", "device", "automatedClicks", "clics automatizados detectados"],
  ["DUPLICATE_LEAD", "lead", "duplicatedLead", "lead duplicado sin deduplicación"],
  ["RELATED_ACCOUNTS", "affiliate", "relatedAccounts", "cuentas relacionadas en la misma conversión"],
  ["ANOMALOUS_TRAFFIC", "device", "anomalousTraffic", "tráfico anómalo en la campaña"],
  ["REGION_CHANGE", "device", "regionChange", "cambio de región inconsistente con el historial"],
  ["HIGH_RETRY_RATE", "device", "highRetryRate", "elevada tasa de reintentos de pago"],
  ["HIGH_CANCELLATION_RATE", "revenue", "highCancellationRate", "alta tasa de cancelación"],
  ["PENDING_COMMISSIONS_AS_PAID", "revenue", "pendingCommissionsMisreportedAsPaid", "comisiones pendientes presentadas como pagadas"],
  ["CONSENT_MISSING", "lead", "missingConsent", "lead procesado sin consentimiento válido"],
  ["RATE_LIMIT_EXCEEDED", "lead", "rateLimitExceeded", "límite de contacto superado"],
  ["UNVERIFIED_CONTACT", "lead", "unverifiedContact", "contacto sin verificación"],
  ["CREDENTIAL_REUSE", "identity", "credentialReuse", "reutilización de credenciales entre cuentas"],
];

export function assessFraud(input: FraudInput): FraudVerdict {
  const signals: FraudSignal[] = [];
  const now = new Date().toISOString();

  for (const [name, category, key, detail] of BLOCKING) {
    if (input[key as keyof FraudInput] === true) {
      signals.push(signal(category, name, 3, detail));
    }
  }
  for (const [name, category, key, detail] of REVIEW) {
    if (input[key as keyof FraudInput] === true) {
      signals.push(signal(category, name, 1, detail));
    }
  }

  const blockingCount = signals.filter((s) => s.weight >= 3).length;
  const reviewCount = signals.filter((s) => s.weight === 1).length;

  let decision: FraudDecision = "allow";
  let level: CommerceRiskLevel = "low";
  if (blockingCount > 0) {
    decision = "block";
    level = reviewCount > 0 ? "critical" : "high";
  } else if (reviewCount >= 2) {
    decision = "review";
    level = "medium";
  } else if (reviewCount === 1) {
    decision = "review";
    level = "low";
  }

  return { level, decision, signals, reviewedAt: now };
}