/**
 * BOOKPI — DEV / TEST ADAPTER (src/lib/bookpi-dev-adapter.ts)
 * -----------------------------------------------------------------
 * ADAPTADOR EXCLUSIVO PARA DESARROLLO LOCAL Y PRUEBAS UNITARIAS.
 * NO FORMA PARTE DEL FLUJO FINANCIERO DE PRODUCCIÓN.
 *
 * Para producción y entornos distribuidos, la única fuente autoritativa
 * y duradera de persistencia es `createBookpiPostgresRepository()`
 * (src/lib/repositories/bookpi-postgres-repository.ts).
 *
 * Este adaptador se mantiene estrictamente para pruebas unitarias, benchmarks
 * locales y entornos de desarrollo desacoplados de PostgreSQL.
 */

import {
  createBookpiDevRepository,
  type BookpiDevRepository,
} from "./repositories/bookpi-dev-repository";
import type { BlockPIBlock, LedgerCategory } from "./bookpi/types";

export interface BookpiWriteRequest {
  tenantId: string;
  userId: string;
  operation: string;
  category: LedgerCategory;
  cost: number;
  tokens: number;
}

export interface BookpiRefundRequest {
  index: number;
  tenantId: string;
}

/**
 * Crea el motor BookPI para desarrollo / testing con un repositorio inyectable.
 */
export function createBookpiDevEngine(
  repository: BookpiDevRepository = createBookpiDevRepository(),
) {
  return {
    list(tenantId: string): BlockPIBlock[] {
      return repository.list(tenantId);
    },

    record(request: BookpiWriteRequest): {
      success: boolean;
      error?: string;
      block?: BlockPIBlock;
    } {
      if (!request.tenantId) return { success: false, error: "Tenant requerido." };
      if (!request.userId) return { success: false, error: "Usuario requerido." };
      if (request.cost < 0) return { success: false, error: "Costo negativo no admitido." };
      const write = repository.append({
        tenantId: request.tenantId,
        userId: request.userId,
        operation: request.operation,
        category: request.category,
        cost: request.cost,
        tokens: request.tokens,
      });
      if (!write.success) return { success: false, error: write.error };
      return { success: true, block: write.block };
    },

    batchAppend(requests: BookpiWriteRequest[]): {
      success: boolean;
      error?: string;
      blocks?: BlockPIBlock[];
    } {
      if (requests.length === 0) return { success: true, blocks: [] };
      for (const req of requests) {
        if (!req.tenantId) return { success: false, error: "Tenant requerido en batch." };
        if (!req.userId) return { success: false, error: "Usuario requerido en batch." };
        if (req.cost < 0) return { success: false, error: "Costo negativo no admitido." };
      }
      const blocks: BlockPIBlock[] = [];
      for (const req of requests) {
        const write = repository.append({
          tenantId: req.tenantId,
          userId: req.userId,
          operation: req.operation,
          category: req.category,
          cost: req.cost,
          tokens: req.tokens,
        });
        if (!write.success) {
          return { success: false, error: write.error, blocks };
        }
        if (write.block) blocks.push(write.block);
      }
      return { success: true, blocks };
    },

    aggregate(params: {
      tenantId: string;
      userId?: string;
      from?: string;
      to?: string;
      category?: LedgerCategory;
      operation?: string;
      status?: string;
    }): {
      totalCostUsd: number;
      totalTokens: number;
      settledCount: number;
      refundedCount: number;
      pendingCount: number;
      prunedCount: number;
      uniqueUsers: number;
      operations: Record<string, { count: number; costUsd: number; tokens: number }>;
      categories: Record<string, { count: number; costUsd: number; tokens: number }>;
    } {
      const all = repository.list(params.tenantId);
      let totalCostUsd = 0;
      let totalTokens = 0;
      let settledCount = 0;
      let refundedCount = 0;
      let pendingCount = 0;
      let prunedCount = 0;
      const userSet = new Set<string>();
      const operations: Record<string, { count: number; costUsd: number; tokens: number }> = {};
      const categories: Record<string, { count: number; costUsd: number; tokens: number }> = {};

      for (const b of all) {
        if (params.userId && b.userId !== params.userId) continue;
        if (params.category && b.category !== params.category) continue;
        if (params.operation && b.operation !== params.operation) continue;
        if (params.status && b.status !== params.status) continue;
        if (params.from && b.timestamp < params.from) continue;
        if (params.to && b.timestamp > params.to) continue;

        const cost = parseFloat(b.costDecimal) || 0;
        totalCostUsd += cost;
        totalTokens += b.tokensConsumed;
        userSet.add(b.userId);

        if (b.status === "settled") settledCount++;
        else if (b.status === "refunded") refundedCount++;
        else if (b.status === "pending") pendingCount++;
        else if (b.status === "pruned") prunedCount++;

        const op = b.operation;
        if (!operations[op]) operations[op] = { count: 0, costUsd: 0, tokens: 0 };
        operations[op].count++;
        operations[op].costUsd += cost;
        operations[op].tokens += b.tokensConsumed;

        const cat = b.category;
        if (!categories[cat]) categories[cat] = { count: 0, costUsd: 0, tokens: 0 };
        categories[cat].count++;
        categories[cat].costUsd += cost;
        categories[cat].tokens += b.tokensConsumed;
      }

      return {
        totalCostUsd: Math.round(totalCostUsd * 100) / 100,
        totalTokens,
        settledCount,
        refundedCount,
        pendingCount,
        prunedCount,
        uniqueUsers: userSet.size,
        operations,
        categories,
      };
    },

    pruneInactiveTenants(inactiveDays: number): {
      success: boolean;
      prunedTenants?: string[];
      error?: string;
    } {
      if (inactiveDays <= 0) return { success: false, error: "inactiveDays must be > 0" };
      return {
        success: false,
        error: "pruneInactive not supported by dev adapter repository",
      };
    },

    refund(request: BookpiRefundRequest): { success: boolean; error?: string } {
      return repository.refund(request.tenantId, request.index, "Solicitud de reembolso dev");
    },

    verifyIntegrity(): {
      success: boolean;
      error?: string;
      corruptedIndex?: number;
    } {
      return repository.verifyIntegrity("");
    },
  };
}

export const createBookpiEngine = createBookpiDevEngine;
export type BookpiDevEngine = ReturnType<typeof createBookpiDevEngine>;
export type BookpiEngine = BookpiDevEngine;

export const BOOKPI_DEV_ENGINE = {
  create: createBookpiDevEngine,
};
export const BOOKPI_ENGINE = BOOKPI_DEV_ENGINE;
