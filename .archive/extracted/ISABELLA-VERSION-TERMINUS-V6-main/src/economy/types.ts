// ── SCER · Sovereign Cognitive Economy Runtime — dominios base ──
// state: draft | engine-generated
//
// Contratos de datos del núcleo económico de Isabella (Isabella Monetization Hub
// Ω∞). Este módulo es *puro*: sólo tipos. Todo cálculo vive en `valuation.ts`,
// `pricing.ts`, `royalty.ts` y `ledger.ts`. Estos tipos NO otorgan autoridad, NO
// mueven dinero y NO ejecutan efectos externos (CAPABILITY ≠ AUTHORITY ≠ EXECUTION).

/** Categoría de activo cognitivo monetizable (Cognitive Asset Fabric). */
export type CognitiveAssetKind =
  | "reasoning"
  | "agent"
  | "dataset"
  | "audit"
  | "evaluation"
  | "governance"
  | "skill"
  | "pipeline";

/** Señales de entrada al motor de valuación (cada una en 0..100). */
export interface ValuationSignals {
  readonly quality: number;
  readonly demand: number;
  readonly scarcity: number;
  readonly evidenceCoverage: number;
}

/** Resultado determinista de valuación de un activo cognitivo. */
export interface Valuation {
  readonly score: number;
  readonly baseValueMinor: number;
  readonly confidence: number;
  readonly components: Readonly<Record<string, number>>;
}

/** Límites admitidos para cada multiplicador de precio dinámico. */
export interface MultiplierBound {
  readonly min: number;
  readonly max: number;
}

/** Entradas del motor de precios dinámicos. */
export interface PricingInput {
  readonly basePriceMinor: number;
  readonly demandMultiplier?: number;
  readonly computeMultiplier?: number;
  readonly scarcityMultiplier?: number;
  readonly riskMultiplier?: number;
  readonly loyaltyDiscount?: number;
}

/** Un factor aplicado (o no) durante el cálculo de precio. */
export interface PricingFactor {
  readonly factor: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly applied: boolean;
}

/** Cotización de precio con desglose auditable completo. */
export interface PricingQuote {
  readonly basePriceMinor: number;
  readonly discount: number;
  readonly finalPriceMinor: number;
  readonly breakdown: readonly PricingFactor[];
}

/** Rol económico en un reparto de regalías (Royalty Network). */
export type RoyaltyRole =
  | "creator"
  | "affiliate"
  | "dataset"
  | "platform"
  | "reserve"
  | "federation"
  | "distribution";

/** Parte con derecho a una fracción de las regalías (basis points, 1/100 %). */
export interface RoyaltyParty {
  readonly partyId: string;
  readonly role: RoyaltyRole;
  readonly basisPoints: number;
}

/** Participación calculada y liquidable de una parte. */
export interface RoyaltyShare {
  readonly partyId: string;
  readonly role: RoyaltyRole;
  readonly basisPoints: number;
  readonly amountMinor: string;
}

/** Plan de distribución exacto (sin pérdida por redondeo). */
export interface RoyaltyPlan {
  readonly totalMinor: string;
  readonly distributedMinor: string;
  readonly remainderMinor: string;
  readonly shares: readonly RoyaltyShare[];
}

/** Tipo de asiento en el libro económico append-only. */
export type EconomicEventKind =
  | "valuation"
  | "pricing.quote"
  | "royalty.plan"
  | "settlement.computed"
  | "treasury.credit"
  | "treasury.debit"
  | "affiliate.commission"
  | "fraud.analysis";

/** Asiento del libro económico con encadenamiento por hash (BookPI-style). */
export interface EconomicEvent {
  readonly sequence: number;
  readonly id: string;
  readonly kind: EconomicEventKind;
  readonly occurredAt: string;
  readonly payloadHash: string;
  readonly previousHash: string;
  readonly hash: string;
}
