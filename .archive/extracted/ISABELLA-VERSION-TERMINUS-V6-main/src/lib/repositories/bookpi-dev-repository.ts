/**
 * REPOSITORIO BOOKPI — TEST / DEV ADAPTER (src/lib/repositories/bookpi-dev-repository.ts)
 * -----------------------------------------------------------------
 * ADAPTADOR EXCLUSIVO PARA DESARROLLO LOCAL Y PRUEBAS AISLADAS.
 *
 * REMOVIDO DEL FLUJO FINANCIERO DE PRODUCCIÓN:
 * Para producción, transacciones reales y durabilidad inmutable, la única
 * autoridad financiera canónica es PostgreSQL mediante:
 * `createBookpiPostgresRepository()` (src/lib/repositories/bookpi-postgres-repository.ts).
 *
 * Este adaptador se mantiene estrictamente para pruebas unitarias de aislamiento,
 * benchmarks locales y simulación criptográfica desacoplada de la base de datos.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { config, isStorageProviderExplicitlyDeclared } from "../config";
import { canonicalBookPiPayload } from "../bookpi/canonical-payload";
import type { BlockPIBlock, BookPIStoreFile, LedgerCategory, LedgerStatus } from "../bookpi/types";
import { getSigningAlgorithm, signBlockHash, verifyBlockSignature } from "../crypto/bookpi-signer";

export type { BlockPIBlock, BookPIStoreFile, LedgerCategory, LedgerStatus };

const GENESIS_PREVIOUS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
const STORE_PATH = path.join(process.cwd(), "isabella_bookpi_ledger.json");

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function toCents(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Costo inválido.");
  const cents = Math.round(value * 100);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

/** Halla un bloque por índice dentro del tenant (frontera de tenant obligatoria). */
function findTenantBlock(
  blocks: BlockPIBlock[],
  tenantId: string,
  index: number,
): BlockPIBlock | null {
  return blocks.find((b) => b.tenantId === tenantId && b.index === index) ?? null;
}

/**
 * Crea el repositorio BookPI para desarrollo / testing (inyectable).
 */
export function createBookpiDevRepository(storePath: string = STORE_PATH) {
  const runtime = config();
  const isProductionLike =
    runtime.NODE_ENV === "production" ||
    runtime.ISABELLA_RUNTIME_MODE === "production" ||
    runtime.ISABELLA_RUNTIME_MODE === "staging";
  if (isProductionLike) {
    throw new Error(
      "JSON BookPI persistence is strictly a dev/test adapter disabled in staging and production. Use createBookpiPostgresRepository().",
    );
  }

  if (isStorageProviderExplicitlyDeclared()) {
    const provider = (runtime as unknown as Record<string, unknown>).ISABELLA_STORAGE_PROVIDER;
    const normalized = typeof provider === "string" ? provider.trim().toLowerCase() : "";
    if (["postgres", "neon"].includes(normalized)) {
      throw new Error(
        "JSON BookPI dev adapter is disabled when ISABELLA_STORAGE_PROVIDER is " +
          `${normalized}. Financial state must live in the authoritative PostgreSQL database.`,
      );
    }
  }

  function loadStore(): BookPIStoreFile {
    if (!fs.existsSync(storePath)) {
      return { blocks: [], genesisPreviousHash: GENESIS_PREVIOUS_HASH };
    }
    try {
      const raw = fs.readFileSync(storePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<BookPIStoreFile>;
      const blocks = Array.isArray(parsed.blocks) ? (parsed.blocks as BlockPIBlock[]) : [];
      const genesisPreviousHash =
        typeof parsed.genesisPreviousHash === "string" && parsed.genesisPreviousHash.length === 64
          ? parsed.genesisPreviousHash
          : GENESIS_PREVIOUS_HASH;
      return { blocks, genesisPreviousHash };
    } catch {
      return { blocks: [], genesisPreviousHash: GENESIS_PREVIOUS_HASH };
    }
  }

  function saveStore(store: BookPIStoreFile): void {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${storePath}.tmp.${Date.now()}.${crypto.randomUUID()}`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmp, storePath);
  }

  function computeBlockHash(
    block: Omit<BlockPIBlock, "blockHash" | "pqcSignature" | "signatureAlgorithm">,
  ): string {
    return sha256(canonicalBookPiPayload(block));
  }

  return {
    list(tenantId: string): BlockPIBlock[] {
      if (!tenantId) return [];
      const store = loadStore();
      return store.blocks.filter((b) => b.tenantId === tenantId);
    },

    append(params: {
      tenantId: string;
      userId: string;
      operation: string;
      category: LedgerCategory;
      cost: number;
      tokens: number;
    }): { success: boolean; error?: string; block?: BlockPIBlock } {
      if (!params.tenantId) return { success: false, error: "Tenant requerido." };
      if (!params.userId) return { success: false, error: "Usuario requerido." };
      if (params.cost < 0) return { success: false, error: "Costo negativo no admitido." };

      const store = loadStore();
      const tenantBlocks = store.blocks.filter((b) => b.tenantId === params.tenantId);
      const last = tenantBlocks[tenantBlocks.length - 1];
      const previousHash = last ? last.blockHash : store.genesisPreviousHash;
      const index = tenantBlocks.length;
      const timestamp = new Date().toISOString();
      const costDecimal = toCents(params.cost);
      const nonce = crypto.randomBytes(16).toString("hex");

      const partial = {
        index,
        timestamp,
        tenantId: params.tenantId,
        userId: params.userId,
        operation: params.operation,
        category: params.category,
        costDecimal,
        tokensConsumed: params.tokens,
        previousHash,
        status: "settled" as LedgerStatus,
        nonce,
      };

      const blockHash = computeBlockHash(partial);
      const pqcSignature = signBlockHash(blockHash);
      const signatureAlgorithm = getSigningAlgorithm();

      const block: BlockPIBlock = {
        ...partial,
        blockHash,
        pqcSignature,
        signatureAlgorithm,
      };

      store.blocks.push(block);
      saveStore(store);
      return { success: true, block };
    },

    refund(
      arg1: string | number,
      arg2: string | number,
      reason: string = "refund",
    ): { success: boolean; error?: string; refundBlock?: BlockPIBlock } {
      const tenantId = typeof arg1 === "string" ? arg1 : String(arg2);
      const targetIndex = typeof arg1 === "number" ? arg1 : Number(arg2);
      if (!tenantId) return { success: false, error: "Tenant requerido." };
      const store = loadStore();
      const tenantBlocks = store.blocks.filter((b) => b.tenantId === tenantId);
      const target = findTenantBlock(tenantBlocks, tenantId, targetIndex);
      if (!target) return { success: false, error: "Bloque objetivo no encontrado." };
      if (target.status === "refunded") return { success: false, error: "Bloque ya reembolsado." };

      const alreadyRefunded = tenantBlocks.some(
        (b) =>
          b.operation.startsWith(`REFUND_BLOCK_${targetIndex}_`) ||
          b.operation === `REFUND_BLOCK_${targetIndex}`,
      );
      if (alreadyRefunded) return { success: false, error: "Bloque ya reembolsado." };

      const last = tenantBlocks[tenantBlocks.length - 1];
      const previousHash = last ? last.blockHash : store.genesisPreviousHash;
      const index = tenantBlocks.length;
      const timestamp = new Date().toISOString();
      const costDecimal = `-${target.costDecimal}`;
      const nonce = crypto.randomBytes(16).toString("hex");

      const partial = {
        index,
        timestamp,
        tenantId,
        userId: target.userId,
        operation: `REFUND_BLOCK_${targetIndex}: ${reason}`,
        category: target.category,
        costDecimal,
        tokensConsumed: 0,
        previousHash,
        status: "settled" as LedgerStatus,
        nonce,
      };

      const blockHash = computeBlockHash(partial);
      const pqcSignature = signBlockHash(blockHash);
      const signatureAlgorithm = getSigningAlgorithm();

      const refundBlock: BlockPIBlock = {
        ...partial,
        blockHash,
        pqcSignature,
        signatureAlgorithm,
      };

      target.status = "refunded";
      store.blocks.push(refundBlock);
      saveStore(store);
      return { success: true, refundBlock };
    },

    verifyIntegrity(tenantId: string = ""): {
      success: boolean;
      error?: string;
      corruptedIndex?: number;
    } {
      const store = loadStore();
      const byTenant = new Map<string, BlockPIBlock[]>();
      for (const block of store.blocks) {
        if (!byTenant.has(block.tenantId)) byTenant.set(block.tenantId, []);
        byTenant.get(block.tenantId)!.push(block);
      }

      const tenantsToCheck = tenantId ? [tenantId] : Array.from(byTenant.keys());
      for (const tId of tenantsToCheck) {
        const blocks = byTenant.get(tId) || [];
        let prev = store.genesisPreviousHash;
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          if (block.index !== i) {
            return {
              success: false,
              error: "Índice discontinuo.",
              corruptedIndex: block.index,
            };
          }
          if (block.previousHash !== prev) {
            return {
              success: false,
              error: "Cadena de hashes rota.",
              corruptedIndex: block.index,
            };
          }
          if (computeBlockHash(block) !== block.blockHash) {
            return {
              success: false,
              error: "Bloque alterado.",
              corruptedIndex: block.index,
            };
          }
          if (!verifyBlockSignature(block.blockHash, block.pqcSignature)) {
            return {
              success: false,
              error: "Firma inválida o ausente.",
              corruptedIndex: block.index,
            };
          }
          prev = block.blockHash;
        }
      }
      return { success: true };
    },
  };
}

export const createBookpiRepository = createBookpiDevRepository;
export type BookpiRepository = ReturnType<typeof createBookpiDevRepository>;
export type BookpiDevRepository = BookpiRepository;
export const BOOKPI_DEV_REPOSITORY = {
  create: createBookpiDevRepository,
};
