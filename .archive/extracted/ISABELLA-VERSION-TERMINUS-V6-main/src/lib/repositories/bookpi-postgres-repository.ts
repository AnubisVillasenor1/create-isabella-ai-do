import { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { config } from "../config";
import { canonicalBookPiPayload } from "../bookpi/canonical-payload";
import {
  getSigningAlgorithm,
  isSimulatedAlgorithm,
  signBlockHash,
  verifyBlockSignature,
  type BookPiSignatureAlgorithm,
} from "../crypto/bookpi-signer";
import type { BlockPIBlock, LedgerCategory, LedgerStatus } from "../bookpi/types";

const GENESIS_PREVIOUS_HASH = "0".repeat(128);

function hashBlock(block: Partial<BlockPIBlock>): string {
  return createHash("sha3-512").update(canonicalBookPiPayload(block)).digest("hex");
}

let pool: Pool | null = null;
function getPool(url: string) {
  if (!pool) {
    if (!url) {
      throw new Error(
        "CRITICAL: DATABASE_URL is missing. BookPI Ledger requires a valid PostgreSQL connection.",
      );
    }
    pool = new Pool({
      connectionString: url,
      // P0-16: límites operativos explícitos — nunca esperar indefinidamente.
      max: 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
    });
    pool.on("error", (err) => {
      console.error("Unexpected error on idle BookPI database client", err);
      process.exit(-1);
    });
  }
  return pool;
}

function mapRow(row: Record<string, unknown>): BlockPIBlock {
  return {
    index: Number(row.index),
    timestamp:
      typeof row.timestamp === "string"
        ? row.timestamp
        : new Date(String(row.timestamp)).toISOString(),
    tenantId: String(row.tenant_id),
    userId: String(row.user_id),
    operation: String(row.operation),
    category: row.category as LedgerCategory,
    costDecimal: String(row.cost_decimal),
    tokensConsumed: Number(row.tokens_consumed),
    previousHash: String(row.previous_hash),
    blockHash: String(row.block_hash),
    pqcSignature: row.pqc_signature ? String(row.pqc_signature) : null,
    signatureAlgorithm: String(row.signature_algorithm || "ECDSA-P384"),
    status: row.status as LedgerStatus,
    nonce: String(row.nonce),
  };
}

/**
 * Repositorio BookPI contra la tabla canónica `bookpi_ledger` (FASE 3 / P0-10).
 * Append-only: los refunds se registran como eventos nuevos, nunca como UPDATE
 * del bloque original. La duplicación de refunds se impide con una UNIQUE
 * constraint en `original_event_id` (no búsqueda de texto con carreras).
 */
export function createBookpiPostgresRepository() {
  const cfg = config();
  const pool = getPool(cfg.DATABASE_URL as string);

  /**
   * Listado de bloques por tenant.
   */
  async function list(tenantId: string): Promise<BlockPIBlock[]> {
    return pool
      .query("SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 ORDER BY index ASC", [
        tenantId,
      ])
      .then((r) => r.rows.map(mapRow));
  }

  /**
   * Append con concurrencia segura usando advisory locks.
   */
  async function append(input: {
    tenantId: string;
    userId: string;
    operation: string;
    category: LedgerCategory;
    cost: number;
    tokens: number;
    status?: LedgerStatus;
    metadata?: Record<string, unknown>;
  }) {
    if (!Number.isFinite(input.cost) || input.cost < 0)
      return { success: false as const, error: "Costo inválido." };
    if (!Number.isInteger(input.tokens) || input.tokens < 0)
      return { success: false as const, error: "Tokens inválidos." };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // P1: bloqueo advisory por tenant (evita carrera del primer bloque).
      const tenantHash = createHash("sha256").update(input.tenantId).digest();
      const lockId = tenantHash.readInt32BE(0);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

      // SELECT FOR UPDATE evita carreras sobre el previous hash.
      const { rows: previous } = await client.query(
        "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 ORDER BY index DESC LIMIT 1 FOR UPDATE",
        [input.tenantId],
      );
      const previousBlock = previous[0] ? mapRow(previous[0]) : null;

      const index = previousBlock ? previousBlock.index + 1 : 0;
      const timestamp = new Date().toISOString();
      const costDecimal = input.cost.toFixed(2);
      const status: LedgerStatus = input.status ?? "settled";

      const base: Omit<BlockPIBlock, "blockHash"> = {
        index,
        timestamp,
        tenantId: input.tenantId,
        userId: input.userId,
        operation: input.operation.slice(0, 200),
        category: input.category,
        costDecimal,
        tokensConsumed: input.tokens,
        previousHash: previousBlock?.blockHash ?? GENESIS_PREVIOUS_HASH,
        pqcSignature: null, // se firma sobre el hash, nunca al revés
        signatureAlgorithm: getSigningAlgorithm(),
        status,
        nonce: randomUUID(),
      };

      const blockHash = hashBlock(base);

      // FASE 5 (§6.5/§6.6): firma REAL obligatoria. En producción/staging con
      // algoritmo simulado (ML-DSA-87) signBlockHash lanza fail-closed.
      if (isSimulatedAlgorithm()) {
        throw new Error(
          "CRITICAL_SECURITY_ERROR: algoritmo de firma simulado no permitido para el ledger.",
        );
      }
      const pqcSignature = signBlockHash(blockHash);
      if (!pqcSignature) {
        await client.query("ROLLBACK");
        return {
          success: false as const,
          error: "CRITICAL_SECURITY_ERROR: Failed to sign BookPI block.",
        };
      }

      const { rows } = await client.query(
        `INSERT INTO public.bookpi_ledger
         (index, tenant_id, user_id, operation, category, cost_decimal, tokens_consumed,
         previous_hash, block_hash, status, nonce, signature_algorithm, pqc_signature)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          base.index,
          base.tenantId,
          base.userId,
          base.operation,
          base.category,
          base.costDecimal,
          base.tokensConsumed,
          base.previousHash,
          blockHash,
          status,
          base.nonce,
          base.signatureAlgorithm,
          pqcSignature,
        ],
      );
      await client.query("COMMIT");
      return { success: true as const, block: mapRow(rows[0]!) };
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      return { success: false as const, error: "Fallo transaccional" };
    } finally {
      client.release();
    }
  }

  /**
   * Batch append optimizado: agrupa inputs por tenant para bloqueos por tenant.
   */
  async function batchAppend(
    inputs: Array<{
      tenantId: string;
      userId: string;
      operation: string;
      category: LedgerCategory;
      cost: number;
      tokens: number;
      status?: LedgerStatus;
      metadata?: Record<string, unknown>;
    }>,
  ) {
    if (isSimulatedAlgorithm()) {
      throw new Error(
        "CRITICAL_SECURITY_ERROR: algoritmo de firma simulado no permitido para el ledger.",
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Group inputs by tenant to handle locks correctly and fetch previous hash once per tenant
      const tenantGroups = new Map<string, typeof inputs>();
      for (const input of inputs) {
        if (!tenantGroups.has(input.tenantId)) tenantGroups.set(input.tenantId, []);
        tenantGroups.get(input.tenantId)!.push(input);
      }

      const results: BlockPIBlock[] = [];

      for (const [tenantId, tenantInputs] of tenantGroups.entries()) {
        const tenantHash = createHash("sha256").update(tenantId).digest();
        const lockId = tenantHash.readInt32BE(0);
        await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

        const { rows: previous } = await client.query(
          "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 ORDER BY index DESC LIMIT 1 FOR UPDATE",
          [tenantId],
        );

        let previousBlock = previous[0] ? mapRow(previous[0]) : null;

        for (const input of tenantInputs) {
          if (!Number.isFinite(input.cost) || input.cost < 0) {
            await client.query("ROLLBACK");
            return { success: false as const, error: "Costo inválido." };
          }
          if (!Number.isInteger(input.tokens) || input.tokens < 0) {
            await client.query("ROLLBACK");
            return { success: false as const, error: "Tokens inválidos." };
          }

          const index = previousBlock ? previousBlock.index + 1 : 0;
          const timestamp = new Date().toISOString();
          const costDecimal = input.cost.toFixed(2);
          const status: LedgerStatus = input.status ?? "settled";

          const base: Omit<BlockPIBlock, "blockHash"> = {
            index,
            timestamp,
            tenantId: input.tenantId,
            userId: input.userId,
            operation: input.operation.slice(0, 200),
            category: input.category,
            costDecimal,
            tokensConsumed: input.tokens,
            previousHash: previousBlock?.blockHash ?? GENESIS_PREVIOUS_HASH,
            pqcSignature: null,
            signatureAlgorithm: getSigningAlgorithm(),
            status,
            nonce: randomUUID(),
          };

          const blockHash = hashBlock(base);
          const pqcSignature = signBlockHash(blockHash);
          if (!pqcSignature) {
            await client.query("ROLLBACK");
            return {
              success: false as const,
              error: "Failed to sign BookPI block.",
            };
          }

          const { rows } = await client.query(
            `INSERT INTO public.bookpi_ledger
             (index, tenant_id, user_id, operation, category, cost_decimal, tokens_consumed,
             previous_hash, block_hash, status, nonce, signature_algorithm, pqc_signature)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
              base.index,
              base.tenantId,
              base.userId,
              base.operation,
              base.category,
              base.costDecimal,
              base.tokensConsumed,
              base.previousHash,
              blockHash,
              status,
              base.nonce,
              base.signatureAlgorithm,
              pqcSignature,
            ],
          );

          const newBlock = mapRow(rows[0]!);
          results.push(newBlock);
          previousBlock = newBlock;
        }
      }

      await client.query("COMMIT");
      return { success: true as const, blocks: results };
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      return { success: false as const, error: "Fallo transaccional" };
    } finally {
      client.release();
    }
  }

  /**
   * Query de bloques por tenant con filtros opcionales.
   */
  async function query(
    tenantId: string,
    filter: {
      category?: LedgerCategory;
      userId?: string;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<BlockPIBlock[]> {
    let query = "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1";
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filter.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filter.category);
    }
    if (filter.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(filter.userId);
    }
    if (filter.fromDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(filter.fromDate.toISOString());
    }
    if (filter.toDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(filter.toDate.toISOString());
    }

    query += " ORDER BY index ASC";

    const { rows } = await pool.query(query, params);
    return rows.map(mapRow);
  }

  /**
   * Poda de bloques antiguos por tiempo máximo.
   */
  async function prune(
    tenantId: string,
    maxAgeMs: number,
  ): Promise<{ success: boolean; prunedCount: number; error?: string }> {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tenantHash = createHash("sha256").update(tenantId).digest();
      const lockId = tenantHash.readInt32BE(0);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

      const { rows } = await client.query(
        "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 ORDER BY index ASC",
        [tenantId],
      );
      const blocks = rows.map(mapRow);

      const blocksToKeep = blocks.filter((b) => b.timestamp > cutoff);
      const prunedCount = blocks.length - blocksToKeep.length;
      if (prunedCount === 0) {
        await client.query("COMMIT");
        return { success: true, prunedCount: 0 };
      }

      await client.query("DELETE FROM public.bookpi_ledger WHERE tenant_id = $1", [tenantId]);

      let prevHash = GENESIS_PREVIOUS_HASH;
      for (let i = 0; i < blocksToKeep.length; i++) {
        const block = blocksToKeep[i];
        block.index = i;
        block.previousHash = prevHash;

        const base: Omit<BlockPIBlock, "blockHash"> = {
          index: block.index,
          timestamp: block.timestamp,
          tenantId: block.tenantId,
          userId: block.userId,
          operation: block.operation.slice(0, 200),
          category: block.category,
          costDecimal: block.costDecimal,
          tokensConsumed: block.tokensConsumed,
          previousHash: block.previousHash,
          pqcSignature: null,
          signatureAlgorithm: getSigningAlgorithm(),
          status: block.status,
          nonce: block.nonce,
        };
        const blockHash = hashBlock(base);
        if (isSimulatedAlgorithm()) {
          throw new Error("CRITICAL_SECURITY_ERROR: algoritmo simulado.");
        }
        const pqcSignature = signBlockHash(blockHash);
        if (!pqcSignature) throw new Error("Firma fallida");

        await client.query(
          `INSERT INTO public.bookpi_ledger
           (index, tenant_id, user_id, operation, category, cost_decimal, tokens_consumed,
            previous_hash, block_hash, status, nonce, signature_algorithm, pqc_signature)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            base.index,
            base.tenantId,
            base.userId,
            base.operation,
            base.category,
            base.costDecimal,
            base.tokensConsumed,
            base.previousHash,
            blockHash,
            block.status,
            base.nonce,
            base.signatureAlgorithm,
            pqcSignature,
          ],
        );
        prevHash = blockHash;
      }

      await client.query("COMMIT");
      return { success: true, prunedCount };
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      return { success: false, error: "Fallo transaccional", prunedCount: 0 };
    } finally {
      client.release();
    }
  }

  /**
   * Poda de tenants inactivos (sin bloques recientes).
   */
  async function pruneInactive(
    inactiveDays: number,
  ): Promise<{ success: boolean; prunedTenants: string[]; error?: string }> {
    const inactiveMs = inactiveDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - inactiveMs).toISOString();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find tenants whose latest block is older than cutoffDate
      const { rows } = await client.query(
        `
        SELECT tenant_id
        FROM public.bookpi_ledger
        GROUP BY tenant_id
        HAVING MAX(created_at) < $1
      `,
        [cutoffDate],
      );

      const tenantsToPrune = rows.map((r: { tenant_id: unknown }) => String(r.tenant_id));

      if (tenantsToPrune.length > 0) {
        // Delete all records for these tenants
        await client.query("DELETE FROM public.bookpi_ledger WHERE tenant_id = ANY($1)", [
          tenantsToPrune,
        ]);
      }

      await client.query("COMMIT");
      return { success: true, prunedTenants: tenantsToPrune };
    } catch {
      await client.query("ROLLBACK");
      return {
        success: false,
        prunedTenants: [],
        error: "Fallo transaccional",
      };
    } finally {
      client.release();
    }
  }

  /**
   * Refund como nuevo evento (append-only). NUNCA UPDATE del original.
   * §6.7: la idempotencia del refund la garantiza la UNIQUE PARTIAL index
   * sobre bookpi_ledger.original_event_id. Dos refunds simultáneos →
   * 1 insert + 1 violación de constraint (rollback) — nunca 2 refunds.
   */
  async function refund(
    originalEventId: string,
    requestor: { tenantId: string; userId: string },
    reason: string,
  ) {
    const index = Number(originalEventId);
    if (!Number.isInteger(index) || index < 0)
      return { success: false as const, error: "Índice de bloque inválido." };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tenantHash = createHash("sha256").update(requestor.tenantId).digest();
      const lockId = tenantHash.readInt32BE(0);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

      const byIndex = await client.query(
        "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 AND index = $2 LIMIT 1 FOR UPDATE",
        [requestor.tenantId, originalEventId],
      );
      const original = byIndex.rows[0] ? mapRow(byIndex.rows[0]) : null;
      if (!original) {
        await client.query("ROLLBACK");
        return { success: false as const, error: "Evento original no encontrado." };
      }
      if (original.status === "refunded") {
        await client.query("ROLLBACK");
        return { success: false as const, error: "Evento ya refundido." };
      }
      // Check idempotencia por original_event_id (UNIQUE partial index)
      const dup = await client.query(
        "SELECT index FROM public.bookpi_ledger WHERE original_event_id = $1 LIMIT 1",
        [String(original.index)],
      );
      if (dup.rows[0]) {
        await client.query("ROLLBACK");
        return { success: false as const, error: "Evento ya refundido." };
      }

      const { rows: previous } = await client.query(
        "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 ORDER BY index DESC LIMIT 1 FOR UPDATE",
        [requestor.tenantId],
      );
      const previousBlock = previous[0] ? mapRow(previous[0]) : null;
      const newIndex = previousBlock ? previousBlock.index + 1 : 0;
      const timestamp = new Date().toISOString();
      const costDecimal = original.costDecimal ? Number(original.costDecimal).toFixed(2) : "0.00";
      const base: Omit<BlockPIBlock, "blockHash"> = {
        index: newIndex,
        timestamp,
        tenantId: requestor.tenantId,
        userId: requestor.userId,
        operation: `refund_of_${original.index}_${reason}`.slice(0, 200),
        category: original.category,
        costDecimal,
        tokensConsumed: 0,
        previousHash: previousBlock?.blockHash ?? GENESIS_PREVIOUS_HASH,
        pqcSignature: null,
        signatureAlgorithm: getSigningAlgorithm(),
        status: "refunded" as LedgerStatus,
        nonce: randomUUID(),
      };
      const blockHash = hashBlock(base);
      if (isSimulatedAlgorithm()) {
        throw new Error(
          "CRITICAL_SECURITY_ERROR: algoritmo de firma simulado no permitido para el ledger.",
        );
      }
      const pqcSignature = signBlockHash(blockHash);
      if (!pqcSignature) {
        await client.query("ROLLBACK");
        return {
          success: false as const,
          error: "CRITICAL_SECURITY_ERROR: Failed to sign BookPI block.",
        };
      }
      try {
        const { rows } = await client.query(
          `INSERT INTO public.bookpi_ledger
           (index, tenant_id, user_id, operation, category, cost_decimal, tokens_consumed,
            previous_hash, block_hash, status, nonce, signature_algorithm, pqc_signature, original_event_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING *`,
          [
            base.index,
            base.tenantId,
            base.userId,
            base.operation,
            base.category,
            base.costDecimal,
            base.tokensConsumed,
            base.previousHash,
            blockHash,
            base.status,
            base.nonce,
            base.signatureAlgorithm,
            pqcSignature,
            String(original.index),
          ],
        );
        await client.query("COMMIT");
        return { success: true as const, block: mapRow(rows[0]!) };
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes("uq_bookpi_refund_original") ||
          msg.includes("duplicate") ||
          msg.includes("original_event_id")
        ) {
          return { success: false as const, error: "Evento ya refundido." };
        }
        return { success: false as const, error: "Fallo transaccional" };
      }
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      return { success: false as const, error: "Fallo transaccional" };
    } finally {
      client.release();
    }
  }

  /**
   * Verifica la integridad de la cadena BookPI.
   * §6.1: el hash se recomputa con el MISMO payload canónico que en append().
   * §6.5: verifica la firma real (rechaza bloques sin firma o con firma inválida).
   */
  async function verifyIntegrity(tenantId?: string) {
    let rows: Record<string, unknown>[];
    if (tenantId) {
      const res = await pool.query(
        "SELECT * FROM public.bookpi_ledger WHERE tenant_id = $1 ORDER BY index ASC",
        [tenantId],
      );
      rows = res.rows;
    } else {
      const res = await pool.query(
        "SELECT * FROM public.bookpi_ledger ORDER BY tenant_id ASC, index ASC",
      );
      rows = res.rows;
    }
    let previousTenant = "";
    let previousHash = GENESIS_PREVIOUS_HASH;
    for (const row of rows) {
      const block = mapRow(row);
      if (block.tenantId !== previousTenant) {
        previousTenant = block.tenantId;
        previousHash = GENESIS_PREVIOUS_HASH;
      }
      // §6.1: el hash se recomputa con el MISMO payload canónico que en append().
      if (block.previousHash !== previousHash) {
        return {
          success: false as const,
          error: "Cadena BookPI rota.",
          corruptedIndex: block.index,
        };
      }
      const recomputed = hashBlock(block);
      if (recomputed !== block.blockHash) {
        return {
          success: false as const,
          error: "Cadena BookPI alterada.",
          corruptedIndex: block.index,
        };
      }
      // §6.5: verifica la firma real (rechaza bloques sin firma o con firma inválida).
      if (!verifyBlockSignature(block.blockHash, block.pqcSignature)) {
        return {
          success: false as const,
          error: "Firma BookPI inválida o ausente.",
          corruptedIndex: block.index,
        };
      }
      previousHash = block.blockHash;
    }
    return { success: true as const };
  }

  async function executeMarketplacePurchase(input: {
    tenantId: string;
    buyerUserId: string;
    sellerUserId: string;
    skillId: string;
    title: string;
    costCents: number;
    platformFeeCents: number;
    correlationId: string;
  }) {
    if (!Number.isInteger(input.costCents) || input.costCents <= 0)
      return { success: false as const, error: "INVALID_COST" };
    if (
      !Number.isInteger(input.platformFeeCents) ||
      input.platformFeeCents < 0 ||
      input.platformFeeCents > input.costCents
    )
      return { success: false as const, error: "INVALID_PLATFORM_FEE" };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tenantHash = createHash("sha256").update(input.tenantId).digest();
      await client.query("SELECT pg_advisory_xact_lock($1)", [tenantHash.readInt32BE(0)]);
      const purchaseKey = "marketplace:" + input.skillId + ":" + input.costCents;
      const existing = await client.query(
        "SELECT id FROM public.economic_events WHERE tenant_id=$1 AND idempotency_key=$2 LIMIT 1",
        [input.tenantId, purchaseKey],
      );
      if (existing.rows[0]) {
        await client.query("ROLLBACK");
        return {
          success: false as const,
          duplicate: true as const,
          error: "PURCHASE_ALREADY_PROCESSED",
        };
      }
      const costDecimal = (input.costCents / 100).toFixed(2);
      const debited = await client.query(
        "UPDATE public.tenants SET quota_balance = quota_balance - $2, updated_at = NOW() WHERE id = $1 AND quota_balance >= $2 RETURNING quota_balance",
        [input.tenantId, costDecimal],
      );
      if (!debited.rows[0]) {
        await client.query("ROLLBACK");
        return { success: false as const, error: "INSUFFICIENT_BALANCE" };
      }
      const sellerNetCents = input.costCents - input.platformFeeCents;
      const sellerRows = await client.query(
        "INSERT INTO public.monetization_accounts (user_id, earned_balance_cents, approved_contributions) VALUES ($1,$2,1) ON CONFLICT (user_id) DO UPDATE SET earned_balance_cents = monetization_accounts.earned_balance_cents + EXCLUDED.earned_balance_cents, approved_contributions = monetization_accounts.approved_contributions + 1, updated_at = NOW() RETURNING earned_balance_cents",
        [input.sellerUserId, sellerNetCents],
      );
      const debit = await client.query(
        "INSERT INTO public.economic_events (tenant_id,actor_id,event_type,currency,amount_minor,direction,source,idempotency_key,correlation_id,metadata) VALUES ($1,$2,$3,'USD',$4,'DEBIT','marketplace',$5,$6,$7) RETURNING id",
        [
          input.tenantId,
          input.buyerUserId,
          "MARKETPLACE_PURCHASE:" + input.skillId,
          input.costCents,
          purchaseKey,
          input.correlationId,
          JSON.stringify({
            skillId: input.skillId,
            costCents: input.costCents,
            platformFeeCents: input.platformFeeCents,
            sellerUserId: input.sellerUserId,
          }),
        ],
      );
      await client.query(
        "INSERT INTO public.economic_events (tenant_id,actor_id,event_type,currency,amount_minor,direction,source,idempotency_key,correlation_id,metadata) VALUES ($1,$2,$3,'USD',$4,'CREDIT','marketplace',$5,$6,$7)",
        [
          input.tenantId,
          input.sellerUserId,
          "MARKETPLACE_EARNING:" + input.skillId,
          sellerNetCents,
          "earning:" + input.tenantId + ":" + input.skillId + ":" + input.costCents,
          input.correlationId,
          JSON.stringify({
            skillId: input.skillId,
            costCents: input.costCents,
            platformFeeCents: input.platformFeeCents,
            buyerUserId: input.buyerUserId,
          }),
        ],
      );
      const previous = await client.query(
        "SELECT * FROM public.bookpi_ledger WHERE tenant_id=$1 ORDER BY index DESC LIMIT 1 FOR UPDATE",
        [input.tenantId],
      );
      const previousBlock = previous.rows[0] ? mapRow(previous.rows[0]) : null;
      const base: Omit<BlockPIBlock, "blockHash"> = {
        index: previousBlock ? previousBlock.index + 1 : 0,
        timestamp: new Date().toISOString(),
        tenantId: input.tenantId,
        userId: input.buyerUserId,
        operation: ("MARKETPLACE_PURCHASE: " + input.skillId).slice(0, 200),
        category: "skills",
        costDecimal,
        tokensConsumed: 0,
        previousHash: previousBlock?.blockHash ?? GENESIS_PREVIOUS_HASH,
        pqcSignature: null,
        signatureAlgorithm: getSigningAlgorithm(),
        status: "settled",
        nonce: randomUUID(),
      };
      const blockHash = hashBlock(base);
      if (isSimulatedAlgorithm())
        throw new Error("CRITICAL_SECURITY_ERROR: simulated BookPI signing algorithm");
      const signature = signBlockHash(blockHash);
      if (!signature) throw new Error("CRITICAL_SECURITY_ERROR: BookPI signing failed");
      const blocks = await client.query(
        "INSERT INTO public.bookpi_ledger (index,tenant_id,user_id,operation,category,cost_decimal,tokens_consumed,previous_hash,block_hash,status,nonce,signature_algorithm,pqc_signature) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
        [
          base.index,
          base.tenantId,
          base.userId,
          base.operation,
          base.category,
          base.costDecimal,
          base.tokensConsumed,
          base.previousHash,
          blockHash,
          base.status,
          base.nonce,
          base.signatureAlgorithm,
          signature,
        ],
      );
      await client.query("COMMIT");
      return {
        success: true as const,
        block: mapRow(blocks.rows[0]!),
        buyerRemainingCredits: Number(debited.rows[0].quota_balance),
        sellerEarnedBalanceCents: Number(sellerRows.rows[0].earned_balance_cents),
        economicEventId: String(debit.rows[0].id),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "TRANSACTION_FAILED",
      };
    } finally {
      client.release();
    }
  }

  return {
    list,
    append,
    batchAppend,
    executeMarketplacePurchase,
    query,
    prune,
    pruneInactive,
    refund,
    verifyIntegrity,
  };
}

/**
 * Tipo exportado para consumidores del repositorio.
 */
export type BookpiPostgresRepository = ReturnType<typeof createBookpiPostgresRepository>;
export type { BookPiSignatureAlgorithm };
