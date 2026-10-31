/**
 * Isabella Native Monetization Streams Ω (state: draft | engine-generated).
 *
 * Extends the economy core with NEW, metered revenue methods that are specific
 * to Isabella's real runtime surfaces (native LLM, MoE router, native TTS,
 * evidence ledger, sovereign data vault, federation capacity). Everything here
 * is deterministic integer arithmetic over minor units (centavos): the same
 * inputs always yield the same quote and the same split.
 *
 * Invariants (CAPABILITY ≠ AUTHORITY ≠ EXECUTION):
 * - Quoting computes a price. It does NOT charge, debit or transfer anything.
 *   Every result declares `fundsMoved: false`.
 * - Splits are exact: `creatorMinor + platformMinor === totalMinor`, with the
 *   rounding remainder assigned to the platform (owner of the pool), never
 *   dropped or invented.
 * - The creator share is clamped to the repo-wide policy band 50–80% and the
 *   ratio is expressed in basis points so no floating point enters the ledger.
 */
import { MAX_USER_SHARE_BPS, MIN_USER_SHARE_BPS } from '../commerce/revenue-share';

/** Metering units the native runtime can actually count. */
export type MonetizationUnit =
  | 'inference_token'
  | 'moe_route'
  | 'tts_character'
  | 'asr_second'
  | 'evidence_seal'
  | 'vault_gb_month'
  | 'federation_hour'
  | 'agent_task';

export type MonetizationCadence = 'usage' | 'recurring' | 'one-time' | 'event';

export interface MonetizationStreamSpec {
  readonly id: string;
  readonly name: string;
  /** Minor units (centavos) charged per single `unit`. */
  readonly unitPriceMinor: number;
  readonly unit: MonetizationUnit;
  readonly cadence: MonetizationCadence;
  /** Creator share in basis points (1/100 %). Clamped to the policy band. */
  readonly creatorShareBps: number;
  readonly description: string;
  /** Regulatory review is mandatory for money-movement-adjacent streams. */
  readonly regulatoryReviewRequired: boolean;
}

export interface MonetizationQuoteInput {
  readonly streamId: string;
  readonly quantity: number;
  /** Optional loyalty discount in basis points (0..5000 = 0..50%). */
  readonly loyaltyDiscountBps?: number;
  /** Optional demand multiplier in basis points (10000 = 1.0x). */
  readonly demandMultiplierBps?: number;
}

export interface MonetizationQuote {
  readonly streamId: string;
  readonly unit: MonetizationUnit;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly grossMinor: number;
  readonly discountMinor: number;
  readonly totalMinor: number;
  readonly creatorMinor: number;
  readonly platformMinor: number;
  readonly creatorShareBps: number;
  readonly currency: 'USD';
  readonly fundsMoved: false;
  readonly authorizationPerformed: false;
}

/** Hard ceiling for a loyalty discount (50%). */
export const MAX_LOYALTY_DISCOUNT_BPS = 5000;
/** Hard ceiling for a demand multiplier (3.0x). */
export const MAX_DEMAND_MULTIPLIER_BPS = 30000;
/** Maximum billable quantity per single quote (guards against overflow). */
export const MAX_QUOTE_QUANTITY = 1_000_000_000;

function clampShare(bps: number): number {
  return Math.min(MAX_USER_SHARE_BPS, Math.max(MIN_USER_SHARE_BPS, Math.round(bps)));
}

/**
 * The native monetization catalog. Prices are configuration references, NOT a
 * verified market average and NOT a guarantee of revenue.
 */
export const MONETIZATION_STREAMS: readonly MonetizationStreamSpec[] = Object.freeze([
  Object.freeze({
    id: 'M-21-native-llm-tokens',
    name: 'LLM nativo por token',
    unitPriceMinor: 2,
    unit: 'inference_token',
    cadence: 'usage',
    creatorShareBps: 7500,
    description: 'Cobro por token generado por el motor LLM nativo de Isabella.',
    regulatoryReviewRequired: false,
  }),
  Object.freeze({
    id: 'M-22-moe-routing',
    name: 'Enrutamiento MoE por consulta',
    unitPriceMinor: 5,
    unit: 'moe_route',
    cadence: 'usage',
    creatorShareBps: 7500,
    description: 'Cobro por decisión de enrutamiento del motor MoE con traza auditable.',
    regulatoryReviewRequired: false,
  }),
  Object.freeze({
    id: 'M-23-native-tts-chars',
    name: 'TTS nativo por carácter',
    unitPriceMinor: 1,
    unit: 'tts_character',
    cadence: 'usage',
    creatorShareBps: 7500,
    description: 'Cobro por carácter sintetizado por el motor TTS nativo (es-MX).',
    regulatoryReviewRequired: false,
  }),
  Object.freeze({
    id: 'M-24-native-asr-seconds',
    name: 'ASR nativo por segundo',
    unitPriceMinor: 3,
    unit: 'asr_second',
    cadence: 'usage',
    creatorShareBps: 7500,
    description: 'Cobro por segundo transcrito por el motor de reconocimiento de voz nativo.',
    regulatoryReviewRequired: false,
  }),
  Object.freeze({
    id: 'M-25-evidence-seals',
    name: 'Sellos de evidencia BookPI',
    unitPriceMinor: 10,
    unit: 'evidence_seal',
    cadence: 'usage',
    creatorShareBps: 7500,
    description: 'Cobro por sello de evidencia encadenado por hash en el ledger.',
    regulatoryReviewRequired: false,
  }),
  Object.freeze({
    id: 'M-26-sovereign-data-vault',
    name: 'Bóveda de datos soberana',
    unitPriceMinor: 120,
    unit: 'vault_gb_month',
    cadence: 'recurring',
    creatorShareBps: 7000,
    description: 'Cobro mensual por GB alojado en la bóveda de datos con consentimiento explícito.',
    regulatoryReviewRequired: true,
  }),
  Object.freeze({
    id: 'M-27-federation-capacity',
    name: 'Capacidad de federación',
    unitPriceMinor: 90,
    unit: 'federation_hour',
    cadence: 'recurring',
    creatorShareBps: 7000,
    description: 'Cobro por hora de capacidad de cómputo federada compartida entre nodos CROWN.',
    regulatoryReviewRequired: true,
  }),
  Object.freeze({
    id: 'M-28-agent-tasks',
    name: 'Tareas de agente',
    unitPriceMinor: 15,
    unit: 'agent_task',
    cadence: 'event',
    creatorShareBps: 7500,
    description: 'Cobro por tarea de agente completada y verificada con evidencia.',
    regulatoryReviewRequired: false,
  }),
]);

const STREAM_INDEX: ReadonlyMap<string, MonetizationStreamSpec> = new Map(
  MONETIZATION_STREAMS.map((stream) => [stream.id, stream] as const)
);

export function getMonetizationStream(id: string): MonetizationStreamSpec | undefined {
  return STREAM_INDEX.get(id.trim());
}

export function listMonetizationStreams(): readonly MonetizationStreamSpec[] {
  return MONETIZATION_STREAMS;
}

/**
 * Computes a governed quote for a metered stream. Pure and deterministic:
 * no network, no clock, no randomness. Returns `fundsMoved: false` always.
 */
export function quoteMonetization(input: MonetizationQuoteInput): MonetizationQuote {
  const stream = STREAM_INDEX.get(input.streamId.trim());
  if (!stream) throw new Error('MONETIZATION_STREAM_NOT_FOUND');
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new Error('MONETIZATION_QUANTITY_INVALID');
  }
  if (input.quantity > MAX_QUOTE_QUANTITY) throw new Error('MONETIZATION_QUANTITY_TOO_LARGE');

  const discountBps = input.loyaltyDiscountBps ?? 0;
  if (
    !Number.isSafeInteger(discountBps) ||
    discountBps < 0 ||
    discountBps > MAX_LOYALTY_DISCOUNT_BPS
  ) {
    throw new Error('MONETIZATION_DISCOUNT_INVALID');
  }
  const demandBps = input.demandMultiplierBps ?? 10_000;
  if (
    !Number.isSafeInteger(demandBps) ||
    demandBps < 10_000 ||
    demandBps > MAX_DEMAND_MULTIPLIER_BPS
  ) {
    throw new Error('MONETIZATION_DEMAND_MULTIPLIER_INVALID');
  }

  const grossMinor = stream.unitPriceMinor * input.quantity;
  const demandAdjusted = Math.round((grossMinor * demandBps) / 10_000);
  const discountMinor = Math.round((demandAdjusted * discountBps) / 10_000);
  const totalMinor = demandAdjusted - discountMinor;

  const creatorShareBps = clampShare(stream.creatorShareBps);
  const creatorMinor = Math.round((totalMinor * creatorShareBps) / 10_000);
  // The platform absorbs the rounding remainder so the split is exact.
  const platformMinor = totalMinor - creatorMinor;

  return Object.freeze({
    streamId: stream.id,
    unit: stream.unit,
    quantity: input.quantity,
    unitPriceMinor: stream.unitPriceMinor,
    grossMinor,
    discountMinor,
    totalMinor,
    creatorMinor,
    platformMinor,
    creatorShareBps,
    currency: 'USD' as const,
    fundsMoved: false as const,
    authorizationPerformed: false as const,
  });
}

export interface MonetizationStreamSummary {
  readonly streams: number;
  readonly usageStreams: number;
  readonly recurringStreams: number;
  readonly regulatoryReviewRequired: number;
  readonly units: readonly MonetizationUnit[];
}

export function monetizationSummary(): MonetizationStreamSummary {
  return Object.freeze({
    streams: MONETIZATION_STREAMS.length,
    usageStreams: MONETIZATION_STREAMS.filter((s) => s.cadence === 'usage').length,
    recurringStreams: MONETIZATION_STREAMS.filter((s) => s.cadence === 'recurring').length,
    regulatoryReviewRequired: MONETIZATION_STREAMS.filter((s) => s.regulatoryReviewRequired).length,
    units: Object.freeze([...new Set(MONETIZATION_STREAMS.map((s) => s.unit))]),
  });
}
