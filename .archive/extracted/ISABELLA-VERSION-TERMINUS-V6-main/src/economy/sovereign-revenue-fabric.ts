import { createHash, randomUUID } from "node:crypto";

/**
 * Isabella Sovereign Revenue Fabric v4 — deterministic domain core.
 *
 * Monetary inputs are decimal strings and are converted to integer minor units.
 * This module is an in-process prototype: its hash chain and idempotency registry
 * are NOT durable across restarts and do not constitute WORM storage or a GAAP
 * general ledger. PSP and tax evidence references are caller-supplied references,
 * not independently verified by this module. No funds are transferred.
 */

export const REVENUE_FABRIC_VERSION = "isabella-revenue-fabric-v4.0.0" as const;

export type RevenueStream =
  | "SUBSCRIPTION"
  | "ISA_API"
  | "SKILL_MARKETPLACE"
  | "AGENT_MARKETPLACE"
  | "AGENT_HOSTING"
  | "AI_CLOUD"
  | "AGENT_REVENUE_SHARING"
  | "HYPERAUTOMATION"
  | "WHITE_LABEL"
  | "CERTIFICATION"
  | "DATA_VAULT"
  | "ECOSYSTEM_TREASURY";

export type IETSTier = "STARTER" | "PROFESSIONAL" | "ADVANCED" | "ELITE" | "SOVEREIGN";
export type PostingDirection = "DEBIT" | "CREDIT";

export interface IETSComponents {
  readonly referrals: number;
  readonly revenue: number;
  readonly retention: number;
  readonly skills: number;
  readonly agents: number;
  readonly reputation: number;
  readonly age: number;
  readonly compliance: number;
}

export interface IETSResult {
  readonly score: number;
  readonly tier: IETSTier;
  readonly policyVersion: string;
  readonly components: Readonly<IETSComponents>;
}

export interface RevenuePolicy {
  readonly version: string;
  readonly emergencyVaultBps: number;
  readonly innovationVaultBps: number;
  readonly treasuryVaultBps: number;
}

export interface SettlementInput {
  readonly idempotencyKey: string;
  readonly revenueStream: RevenueStream;
  readonly currency: string;
  readonly grossAmount: string;
  readonly directCost: string;
  readonly taxAmount: string;
  readonly gatewayFee: string;
  readonly creatorId?: string;
  readonly ietsComponents?: IETSComponents;
  /** Required when gatewayFee is non-zero; must refer to actual PSP settlement evidence. */
  readonly pspSettlementRef?: string;
  /** Required when taxAmount is non-zero; must refer to the external tax determination. */
  readonly taxEvidenceRef?: string;
  /** DATA_VAULT requires consent + licence evidence and an explicit creator share. */
  readonly consentEvidenceRef?: string;
  readonly dataLicenceEvidenceRef?: string;
  readonly dataVaultCreatorRateBps?: number;
}

export interface LedgerPosting {
  readonly account: string;
  readonly direction: PostingDirection;
  readonly amountMinor: string;
  readonly currency: string;
  readonly memo: string;
}

export interface RevenueJournal {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly previousHash: string;
  readonly entryHash: string;
  readonly occurredAt: string;
  readonly postings: readonly LedgerPosting[];
  readonly debitTotalMinor: string;
  readonly creditTotalMinor: string;
}

export interface RevenueSettlement {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly revenueStream: RevenueStream;
  readonly currency: string;
  readonly grossAmount: string;
  readonly directCost: string;
  readonly taxAmount: string;
  readonly gatewayFee: string;
  readonly operatingIncome: string;
  readonly emergencyVault: string;
  readonly innovationVault: string;
  readonly treasuryVault: string;
  readonly distributablePool: string;
  readonly creatorRateBps: number;
  readonly platformRateBps: number;
  readonly creatorShare: string;
  readonly platformShare: string;
  readonly iets: IETSResult | null;
  readonly policyVersion: string;
  readonly journal: RevenueJournal;
  readonly fundsMoved: false;
}

const IETS_POLICY_VERSION = "iets-v4.0.0";
const IETS_WEIGHTS: Readonly<Record<keyof IETSComponents, number>> = Object.freeze({
  referrals: 1500,
  revenue: 2500,
  retention: 1500,
  skills: 1000,
  agents: 1000,
  reputation: 1500,
  age: 500,
  compliance: 500,
});

const TIER_CREATOR_RATES: Readonly<Record<IETSTier, number>> = Object.freeze({
  STARTER: 5000,
  PROFESSIONAL: 6000,
  ADVANCED: 7000,
  ELITE: 8000,
  SOVEREIGN: 9000,
});

const HYPERAUTOMATION_CREATOR_RATES: Readonly<Record<IETSTier, number>> = Object.freeze({
  STARTER: 8500,
  PROFESSIONAL: 8200,
  ADVANCED: 8000,
  ELITE: 7800,
  SOVEREIGN: 7500,
});

const DYNAMIC_STREAMS = new Set<RevenueStream>([
  "SKILL_MARKETPLACE",
  "AGENT_MARKETPLACE",
  "AGENT_REVENUE_SHARING",
  "HYPERAUTOMATION",
]);

const REVENUE_STREAMS = new Set<RevenueStream>([
  "SUBSCRIPTION", "ISA_API", "SKILL_MARKETPLACE", "AGENT_MARKETPLACE",
  "AGENT_HOSTING", "AI_CLOUD", "AGENT_REVENUE_SHARING", "HYPERAUTOMATION",
  "WHITE_LABEL", "CERTIFICATION", "DATA_VAULT", "ECOSYSTEM_TREASURY",
]);

const ZERO = 0n;
const BPS = 10_000n;

function assertNonBlank(value: string, field: string, max = 256): void {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new RangeError(`REVENUE_${field.toUpperCase()}_INVALID`);
  }
}

function parseMinor(value: string, field: string): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new RangeError(`REVENUE_${field.toUpperCase()}_INVALID_DECIMAL`);
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function formatMinor(value: bigint): string {
  const sign = value < ZERO ? "-" : "";
  const absolute = value < ZERO ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function roundedRatio(amount: bigint, rateBps: number): bigint {
  return (amount * BigInt(rateBps) + BPS / 2n) / BPS;
}

function validateRate(rate: number, field: string): void {
  if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) {
    throw new RangeError(`REVENUE_${field.toUpperCase()}_BPS_INVALID`);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class IsabellaEconomicTrustScore {
  static calculate(components: IETSComponents): IETSResult {
    const keys = Object.keys(IETS_WEIGHTS) as (keyof IETSComponents)[];
    let weighted = 0;
    for (const key of keys) {
      const value = components[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
        throw new RangeError(`IETS_${key.toUpperCase()}_MUST_BE_INTEGER_0_100`);
      }
      weighted += value * IETS_WEIGHTS[key];
    }
    // Hundredths of a point, rounded once to avoid cumulative floating rounding.
    const score = Math.round(weighted / 100) / 100;
    const tier: IETSTier =
      score <= 20 ? "STARTER" :
      score <= 40 ? "PROFESSIONAL" :
      score <= 60 ? "ADVANCED" :
      score <= 80 ? "ELITE" : "SOVEREIGN";
    return Object.freeze({
      score,
      tier,
      policyVersion: IETS_POLICY_VERSION,
      components: Object.freeze({ ...components }),
    });
  }
}

export class IsabellaSovereignRevenueFabric {
  private readonly settlements = new Map<string, RevenueSettlement>();
  private readonly journals: RevenueJournal[] = [];
  private previousHash = "GENESIS";

  constructor(private readonly policy: RevenuePolicy = {
    version: REVENUE_FABRIC_VERSION,
    emergencyVaultBps: 100,
    innovationVaultBps: 100,
    treasuryVaultBps: 100,
  }) {
    assertNonBlank(policy.version, "policy_version", 128);
    validateRate(policy.emergencyVaultBps, "emergency_vault");
    validateRate(policy.innovationVaultBps, "innovation_vault");
    validateRate(policy.treasuryVaultBps, "treasury_vault");
    if (policy.emergencyVaultBps + policy.innovationVaultBps + policy.treasuryVaultBps > 10_000) {
      throw new RangeError("REVENUE_VAULT_RATES_EXCEED_100_PERCENT");
    }
  }

  settle(input: SettlementInput): RevenueSettlement {
    this.validateInput(input);
    const amounts = {
      gross: parseMinor(input.grossAmount, "gross_amount"),
      directCost: parseMinor(input.directCost, "direct_cost"),
      tax: parseMinor(input.taxAmount, "tax_amount"),
      gatewayFee: parseMinor(input.gatewayFee, "gateway_fee"),
    };
    if (amounts.gross <= ZERO) throw new RangeError("REVENUE_GROSS_MUST_BE_POSITIVE");
    const deductions = amounts.directCost + amounts.tax + amounts.gatewayFee;
    if (deductions > amounts.gross) throw new RangeError("REVENUE_DEDUCTIONS_EXCEED_GROSS");
    const fingerprint = sha256(canonicalJson({
      revenueStream: input.revenueStream,
      currency: input.currency,
      grossMinor: amounts.gross.toString(),
      directCostMinor: amounts.directCost.toString(),
      taxMinor: amounts.tax.toString(),
      gatewayFeeMinor: amounts.gatewayFee.toString(),
      creatorId: input.creatorId ?? null,
      ietsComponents: input.ietsComponents ?? null,
      pspSettlementRef: input.pspSettlementRef ?? null,
      taxEvidenceRef: input.taxEvidenceRef ?? null,
      consentEvidenceRef: input.consentEvidenceRef ?? null,
      dataLicenceEvidenceRef: input.dataLicenceEvidenceRef ?? null,
      dataVaultCreatorRateBps: input.dataVaultCreatorRateBps ?? null,
    }));
    const prior = this.settlements.get(input.idempotencyKey);
    if (prior) {
      if (this.fingerprintForSettlement.get(input.idempotencyKey) !== fingerprint) {
        throw new Error("REVENUE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
      }
      return prior;
    }

    const operatingIncomeMinor = amounts.gross - deductions;
    const emergencyMinor = roundedRatio(operatingIncomeMinor, this.policy.emergencyVaultBps);
    const innovationMinor = roundedRatio(operatingIncomeMinor, this.policy.innovationVaultBps);
    const treasuryMinor = roundedRatio(operatingIncomeMinor, this.policy.treasuryVaultBps);
    const distributableMinor = operatingIncomeMinor - emergencyMinor - innovationMinor - treasuryMinor;
    const iets = input.ietsComponents ? IsabellaEconomicTrustScore.calculate(input.ietsComponents) : null;
    const creatorRateBps = this.resolveCreatorRate(input, iets);
    const platformRateBps = 10_000 - creatorRateBps;
    const creatorShareMinor = roundedRatio(distributableMinor, creatorRateBps);
    const platformShareMinor = distributableMinor - creatorShareMinor;

    const allocationTotal = amounts.directCost + amounts.tax + amounts.gatewayFee +
      emergencyMinor + innovationMinor + treasuryMinor + creatorShareMinor + platformShareMinor;
    if (allocationTotal !== amounts.gross) throw new Error("REVENUE_ALLOCATION_INVARIANT_FAILED");

    const postings: LedgerPosting[] = [
      this.posting("SETTLEMENT_CLEARING", "DEBIT", amounts.gross, input.currency, "Gross received; allocation clearing"),
      this.posting("DIRECT_COST_ALLOCATED", "CREDIT", amounts.directCost, input.currency, "Verified attributable direct cost"),
      this.posting("TAX_PAYABLE", "CREDIT", amounts.tax, input.currency, "Externally determined tax amount"),
      this.posting("PSP_FEE_ALLOCATED", "CREDIT", amounts.gatewayFee, input.currency, "PSP fee from settlement evidence"),
      this.posting("EMERGENCY_VAULT", "CREDIT", emergencyMinor, input.currency, "Emergency reserve"),
      this.posting("INNOVATION_VAULT", "CREDIT", innovationMinor, input.currency, "Innovation reserve"),
      this.posting("TREASURY_VAULT", "CREDIT", treasuryMinor, input.currency, "Treasury reserve"),
      this.posting("CREATOR_PAYABLE", "CREDIT", creatorShareMinor, input.currency, "Creator/provider share"),
      this.posting("PLATFORM_ALLOCATION", "CREDIT", platformShareMinor, input.currency, "Platform allocation"),
    ].filter((posting) => BigInt(posting.amountMinor) > ZERO);

    const debitTotal = postings.filter((p) => p.direction === "DEBIT").reduce((n, p) => n + BigInt(p.amountMinor), ZERO);
    const creditTotal = postings.filter((p) => p.direction === "CREDIT").reduce((n, p) => n + BigInt(p.amountMinor), ZERO);
    if (debitTotal !== creditTotal) throw new Error("REVENUE_LEDGER_NOT_BALANCED");

    const occurredAt = new Date().toISOString();
    const journalBody = {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      previousHash: this.previousHash,
      occurredAt,
      postings,
      debitTotalMinor: debitTotal.toString(),
      creditTotalMinor: creditTotal.toString(),
    };
    const journal: RevenueJournal = Object.freeze({
      ...journalBody,
      postings: Object.freeze(postings.map((p) => Object.freeze({ ...p }))),
      entryHash: sha256(canonicalJson(journalBody)),
    });
    const settlement: RevenueSettlement = Object.freeze({
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      revenueStream: input.revenueStream,
      currency: input.currency,
      grossAmount: formatMinor(amounts.gross),
      directCost: formatMinor(amounts.directCost),
      taxAmount: formatMinor(amounts.tax),
      gatewayFee: formatMinor(amounts.gatewayFee),
      operatingIncome: formatMinor(operatingIncomeMinor),
      emergencyVault: formatMinor(emergencyMinor),
      innovationVault: formatMinor(innovationMinor),
      treasuryVault: formatMinor(treasuryMinor),
      distributablePool: formatMinor(distributableMinor),
      creatorRateBps,
      platformRateBps,
      creatorShare: formatMinor(creatorShareMinor),
      platformShare: formatMinor(platformShareMinor),
      iets,
      policyVersion: this.policy.version,
      journal,
      fundsMoved: false,
    });

    this.journals.push(journal);
    this.previousHash = journal.entryHash;
    this.settlements.set(input.idempotencyKey, settlement);
    this.fingerprintForSettlement.set(input.idempotencyKey, fingerprint);
    return settlement;
  }

  private readonly fingerprintForSettlement = new Map<string, string>();

  private validateInput(input: SettlementInput): void {
    if (!input || typeof input !== "object") throw new RangeError("REVENUE_INPUT_REQUIRED");
    assertNonBlank(input.idempotencyKey, "idempotency_key", 200);
    if (!REVENUE_STREAMS.has(input.revenueStream)) throw new RangeError("REVENUE_STREAM_INVALID");
    if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)) throw new RangeError("REVENUE_CURRENCY_INVALID");
    parseMinor(input.grossAmount, "gross_amount");
    parseMinor(input.directCost, "direct_cost");
    parseMinor(input.taxAmount, "tax_amount");
    parseMinor(input.gatewayFee, "gateway_fee");
    if (input.gatewayFee !== "0" && input.gatewayFee !== "0.0" && input.gatewayFee !== "0.00") {
      assertNonBlank(input.pspSettlementRef ?? "", "psp_settlement_ref", 512);
    }
    if (input.taxAmount !== "0" && input.taxAmount !== "0.0" && input.taxAmount !== "0.00") {
      assertNonBlank(input.taxEvidenceRef ?? "", "tax_evidence_ref", 512);
    }
    if (input.revenueStream === "DATA_VAULT") {
      assertNonBlank(input.consentEvidenceRef ?? "", "consent_evidence_ref", 512);
      assertNonBlank(input.dataLicenceEvidenceRef ?? "", "data_licence_evidence_ref", 512);
      validateRate(input.dataVaultCreatorRateBps ?? -1, "data_vault_creator");
    }
    if (DYNAMIC_STREAMS.has(input.revenueStream) && !input.ietsComponents) {
      throw new RangeError("REVENUE_IETS_REQUIRED_FOR_DYNAMIC_STREAM");
    }
    if (input.ietsComponents) IsabellaEconomicTrustScore.calculate(input.ietsComponents);
    if (input.revenueStream === "ISA_API" || input.revenueStream === "DATA_VAULT" ||
        (DYNAMIC_STREAMS.has(input.revenueStream) && this.rateFor(input.revenueStream, input.ietsComponents ? IsabellaEconomicTrustScore.calculate(input.ietsComponents) : null) > 0)) {
      assertNonBlank(input.creatorId ?? "", "creator_id", 256);
    }
  }

  private resolveCreatorRate(input: SettlementInput, iets: IETSResult | null): number {
    if (input.revenueStream === "DATA_VAULT") return input.dataVaultCreatorRateBps as number;
    return this.rateFor(input.revenueStream, iets);
  }

  private rateFor(stream: RevenueStream, iets: IETSResult | null): number {
    switch (stream) {
      case "ISA_API": return 7000;
      case "SKILL_MARKETPLACE":
      case "AGENT_MARKETPLACE":
      case "AGENT_REVENUE_SHARING":
        if (!iets) throw new Error("REVENUE_IETS_REQUIRED_FOR_DYNAMIC_STREAM");
        return TIER_CREATOR_RATES[iets.tier];
      case "HYPERAUTOMATION":
        if (!iets) throw new Error("REVENUE_IETS_REQUIRED_FOR_DYNAMIC_STREAM");
        return HYPERAUTOMATION_CREATOR_RATES[iets.tier];
      case "DATA_VAULT": return 0; // Overridden by the explicit, consent-bound rate.
      default: return 0;
    }
  }

  private posting(account: string, direction: PostingDirection, amount: bigint, currency: string, memo: string): LedgerPosting {
    return Object.freeze({ account, direction, amountMinor: amount.toString(), currency, memo });
  }

  journalsSnapshot(): readonly RevenueJournal[] {
    return Object.freeze([...this.journals]);
  }

  settlementByIdempotencyKey(key: string): RevenueSettlement | undefined {
    return this.settlements.get(key);
  }

  verifyLedgerIntegrity(): { readonly valid: boolean; readonly journalCount: number; readonly headHash: string } {
    let previousHash = "GENESIS";
    for (const journal of this.journals) {
      if (journal.previousHash !== previousHash) return { valid: false, journalCount: this.journals.length, headHash: this.previousHash };
      const { entryHash, ...body } = journal;
      if (sha256(canonicalJson(body)) !== entryHash) return { valid: false, journalCount: this.journals.length, headHash: this.previousHash };
      const debits = journal.postings.filter((p) => p.direction === "DEBIT").reduce((n, p) => n + BigInt(p.amountMinor), ZERO);
      const credits = journal.postings.filter((p) => p.direction === "CREDIT").reduce((n, p) => n + BigInt(p.amountMinor), ZERO);
      if (debits !== credits || debits.toString() !== journal.debitTotalMinor || credits.toString() !== journal.creditTotalMinor) {
        return { valid: false, journalCount: this.journals.length, headHash: this.previousHash };
      }
      previousHash = entryHash;
    }
    return { valid: previousHash === this.previousHash, journalCount: this.journals.length, headHash: this.previousHash };
  }
}
