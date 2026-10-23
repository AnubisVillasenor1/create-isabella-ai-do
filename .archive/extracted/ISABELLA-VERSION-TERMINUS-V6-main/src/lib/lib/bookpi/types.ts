/**
 * BOOKPI CANONICAL TYPES (src/lib/bookpi/types.ts)
 * -----------------------------------------------------------------
 * Tipos canónicos del libro mayor inmutable BookPI.
 * Utilizados en común por la autoridad de producción (PostgreSQL)
 * y los adaptadores de desarrollo/test aislados.
 */

export type LedgerCategory = "inference" | "processing" | "apis" | "skills" | "other";
export type LedgerStatus = "settled" | "pending" | "refunded" | "pruned";

export interface BlockPIBlock {
  index: number;
  timestamp: string;
  tenantId: string;
  userId: string;
  operation: string;
  category: LedgerCategory;
  costDecimal: string;
  tokensConsumed: number;
  previousHash: string;
  blockHash: string;
  pqcSignature: string | null;
  signatureAlgorithm: string;
  status: LedgerStatus;
  nonce: string;
}

export interface BookPIStoreFile {
  blocks: BlockPIBlock[];
  genesisPreviousHash: string;
}
