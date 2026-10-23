import { createHash, generateKeyPairSync, sign, verify, KeyObject } from "node:crypto";
import { randomUUID } from "node:crypto";
import { checkPermission, ROLES, type Role } from "./rbac";
import { permissionFor, RESOURCES, ACTIONS, type Resource, type Action } from "./permission-matrix";
import { evaluateAbac, type AttributeContext } from "./abac";
import { canonicalize } from "./igds/canonical";
import { isProductionLike, resolveRuntimeMode } from "./runtime-mode";

/**
 * C.R.O.W.N. / A.R.G.U.S. - PDP (Policy Decision Point)
 * Versión 3.0 (Isabella-Enhanced Hardened)
 *
 * Implementa firma ECDSA (preparado para ML-DSA-87), hash chaining (SHA3-512),
 * y aislamiento de decisiones para garantizar No Repudio y Auditoría Inmutable.
 */

// ============================================================================
// CONFIGURACIÓN CRIPTOGRÁFICA
// ============================================================================
const HASH_ALGORITHM = "sha3-512";
const SIGNATURE_ALGORITHM = "SHA384"; // Used with ECDSA
const CURVE = "secp384r1"; // High security curve

export interface AuthorizationDecision {
  decision_id: string;
  tenant_id: string;
  subject_id: string;
  action: string;
  resource: string;
  allow: boolean;
  obligations: string[];
  policy_version: string;
  issued_at: string;
  expires_at: string;
  signature: string;
  signature_chain: string;
  previous_decision_hash: string;
}

export interface AuthorizationContext {
  tenant_id: string;
  subject_id: string;
  action: string;
  resource: string;
  /** Rol resuelto de la identidad (requerido para decisión real). */
  role?: string;
  /** Si el request está autenticado (requerido para decisión real). */
  authenticated?: boolean;
  /**
   * Tenant al que pertenece el recurso objetivo. Sin esta información la
   * política ABAC `isolation:territorial` no puede aplicarse (quedaría en
   * `notApplied`), por lo que debe entregarse cuando el recurso tenga tenant
   * propio; un tenant distinto del sujeto produce `abac-deny`.
   */
  resource_tenant_id?: string;
  /** Propietario del recurso objetivo (para `data:personal`); vacío si no aplica. */
  resource_owner?: string;
  context: {
    ip_address: string;
    user_agent: string;
    timestamp: Date;
    geo_ip?: string;
    device_fingerprint?: string;
    behavior_score?: number;
  };
}

// ============================================================================
// GESTIÓN DE CLAVES (Clave ECDSA software + cadena durable en Postgres)
// Cadena de custodia por tenant con advisory lock sobre `hsm_signature_chain`.
// LIMITACIÓN DECLARADA: no hay HSM/KMS físico; la clave efímera por proceso
// no es verificable entre procesos (ver production-capabilities.json).
// ============================================================================
class CryptoManager {
  private privateKey: KeyObject;
  private publicKey: KeyObject;
  private keyId: string;

  // En memoria solo como cache L1; fuente de verdad es Postgres `hsm_signature_chain` (ver `getAndAdvanceChainDurable`)
  private signatureChainState = new Map<string, string>(); // tenant_id -> last_hash (cache)

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: CURVE,
    });
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.keyId = `key_${randomUUID().replace(/-/g, "")}`;
    // Honestidad (AGENTS §0.1): esto NO es un HSM ni un KMS. Es una clave
    // software efimera por proceso; sin KMS persistente las firmas de este
    // proceso no son verificables por otro proceso (limitación declarada en
    // production-capabilities.json, no oculta).
    console.info(
      `[CryptoManager] Clave ECDSA software efimera generada (${CURVE}, keyId=${this.keyId}). ` +
        `Sin HSM/KMS fisico: la cadena de firmas durable vive en Postgres hsm_signature_chain en runtime productivo.`,
    );
    // Informa si el runtime exige cadena durable (la exigencia real se
    // evalúa en cada llamada a getAndAdvanceChainDurable, fail-closed).
    this.logDurableMode().catch(() => {});
  }

  private async logDurableMode(): Promise<void> {
    try {
      const { config } = await import("./config");
      const cfg = config();
      if (isProductionLike(resolveRuntimeMode(cfg.ISABELLA_RUNTIME_MODE))) {
        console.info(
          "[CryptoManager] Runtime productivo: cadena de firmas exige Postgres hsm_signature_chain (sin fallback a memoria).",
        );
      }
    } catch {
      // No se pudo resolver la configuración; getAndAdvanceChainDurable asume productivo (fail-closed).
    }
  }

  /**
   * Digest canónico. Usa la canonicalización JCS (RFC 8785) de IGDS para que
   * el mismo payload produzca siempre los mismos bytes, sin importar el orden
   * de construcción de las claves. Antes se usaba
   * `JSON.stringify(payload, Object.keys(payload).sort())`, cuyo parámetro
   * `replacer` sólo FILTRA claves y no las reordena (hash no canónico).
   */
  public calculateHash(payload: Record<string, unknown>): string {
    return createHash(HASH_ALGORITHM).update(canonicalize(payload), "utf8").digest("hex");
  }

  public signPayload(payload: Record<string, unknown>): string {
    const raw = canonicalize(payload);
    const signature = sign(SIGNATURE_ALGORITHM, Buffer.from(raw), this.privateKey);
    return signature.toString("base64url");
  }

  public verifySignature(payload: Record<string, unknown>, signatureB64: string): boolean {
    const raw = canonicalize(payload);
    return verify(
      SIGNATURE_ALGORITHM,
      Buffer.from(raw),
      this.publicKey,
      Buffer.from(signatureB64, "base64url"),
    );
  }

  public getAndAdvanceChain(
    tenantId: string,
    newDecisionHash: string,
    newSignature: string,
  ): { previousHash: string; signatureChain: string } {
    // Fast path: si durable está habilitado, la cadena se gestiona vía DB con advisory lock
    // Aquí mantenemos compatibilidad sync para callers existentes; la versión durable async es getAndAdvanceChainDurable
    const previousHash = this.signatureChainState.get(tenantId) || "genesis_hash_0000000000000000";
    const previousSigChain =
      this.signatureChainState.get(`sigchain_${tenantId}`) || "genesis_sigchain_00000000";
    const nextSigChain = createHash(HASH_ALGORITHM)
      .update(previousSigChain + newSignature)
      .digest("hex");
    this.signatureChainState.set(tenantId, newDecisionHash);
    this.signatureChainState.set(`sigchain_${tenantId}`, nextSigChain);
    return { previousHash, signatureChain: nextSigChain };
  }

  /**
   * Versión durable de la cadena de firmas: Postgres `hsm_signature_chain`
   * con `pg_advisory_xact_lock` por tenant.
   *
   * Fail-closed (AGENTS §4.2): en runtime productivo/staging la cadena jamás
   * cae a memoria local. Si falta `DATABASE_URL` o la transacción falla se
   * lanza `HsmDurableUnavailableError` y el PDP responde DENY. El fallback a
   * la cadena en memoria queda reservado para development/test.
   */
  public async getAndAdvanceChainDurable(
    tenantId: string,
    newDecisionHash: string,
    newSignature: string,
  ): Promise<{ previousHash: string; signatureChain: string }> {
    const productionLike = await this.isProductionLikeRuntime();
    if (!productionLike) {
      return this.getAndAdvanceChain(tenantId, newDecisionHash, newSignature);
    }
    const { createHash: createHash2 } = await import("node:crypto");
    let pool: import("pg").Pool | null = null;
    let release: (() => void) | null = null;
    try {
      const { config } = await import("./config");
      const cfg = config();
      if (!cfg.DATABASE_URL) {
        throw new HsmDurableUnavailableError(
          "DATABASE_URL ausente: la cadena durable de firmas no existe en este runtime productivo.",
        );
      }
      const { Pool } = await import("pg");
      pool = new Pool({ connectionString: cfg.DATABASE_URL, max: 1 });
      const client = await pool.connect();
      release = () => client.release();
      await client.query("BEGIN");
      const lockId = createHash2("sha256").update(tenantId).digest().readInt32BE(0);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);
      // Crea tabla si no existe (idempotente)
      await client.query(`
          CREATE TABLE IF NOT EXISTS hsm_signature_chain (
            tenant_id VARCHAR(64) PRIMARY KEY,
            last_hash VARCHAR(128) NOT NULL,
            sigchain VARCHAR(128) NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
      const res = await client.query(
        "SELECT last_hash, sigchain FROM hsm_signature_chain WHERE tenant_id = $1 FOR UPDATE",
        [tenantId],
      );
      const previousHash = res.rows[0]?.last_hash ?? "genesis_hash_0000000000000000";
      const previousSigChain = res.rows[0]?.sigchain ?? "genesis_sigchain_00000000";
      const nextSigChain = createHash(HASH_ALGORITHM)
        .update(previousSigChain + newSignature)
        .digest("hex");
      await client.query(
        `INSERT INTO hsm_signature_chain (tenant_id, last_hash, sigchain) VALUES ($1,$2,$3)
           ON CONFLICT (tenant_id) DO UPDATE SET last_hash = EXCLUDED.last_hash, sigchain = EXCLUDED.sigchain, updated_at = NOW()`,
        [tenantId, newDecisionHash, nextSigChain],
      );
      await client.query("COMMIT");
      // Actualiza cache L1 (la fuente de verdad sigue siendo Postgres)
      this.signatureChainState.set(tenantId, newDecisionHash);
      this.signatureChainState.set(`sigchain_${tenantId}`, nextSigChain);
      return { previousHash, signatureChain: nextSigChain };
    } catch (e) {
      if (e instanceof HsmDurableUnavailableError) throw e;
      throw new HsmDurableUnavailableError(
        `hsm_signature_chain inaccesible en runtime productivo: ${(e as Error).message}`,
      );
    } finally {
      release?.();
      if (pool) await pool.end().catch(() => {});
    }
  }

  /** Determina si el runtime exige cadena durable. Si no se puede determinar, se asume productivo (fail-closed). */
  private async isProductionLikeRuntime(): Promise<boolean> {
    try {
      const { config } = await import("./config");
      return isProductionLike(resolveRuntimeMode(config().ISABELLA_RUNTIME_MODE));
    } catch (error) {
      console.error(
        "[CryptoManager] No se pudo resolver ISABELLA_RUNTIME_MODE; se asume runtime productivo:",
        (error as Error).message,
      );
      return true;
    }
  }
}

/**
 * La cadena durable de firmas no está disponible en un runtime que la exige.
 * El PDP traduce este error en DENY: nunca se emite un `allow` sin cadena
 * durable verificable (AGENTS §4.2 y §8.3).
 */
export class HsmDurableUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HsmDurableUnavailableError";
  }
}

const hsm = new CryptoManager();

/**
 * Instancia canónica del gestor de claves del PDP, expuesta para pruebas de
 * canonicalización (hash independiente del orden de claves) y verificación de
 * firmas. No expone claves privadas.
 */
export const authorizationCrypto = hsm;

// ============================================================================
// EVALUADOR PDP (Policy Decision Point)
// ============================================================================

/**
 * Evalúa las políticas de C.R.O.W.N. para una acción dada.
 * Motor real: RBAC (matriz recurso×acción) + ABAC (deny-overrides) +
 * anomalía de comportamiento. Fail-closed en cada etapa: cualquier
 * condición no demostrable niega. Retorna decisión firmada (ECDSA
 * P-384) con hash chaining.
 */
export async function evaluateAuthorization(
  ctx: AuthorizationContext,
): Promise<AuthorizationDecision> {
  const decisionId = `dec_${randomUUID().replace(/-/g, "")}`;
  const now = new Date();

  let allow = false;
  const obligations: string[] = [];
  let denyReason = "deny-by-default";

  // Etapa 0: identidad mínima demostrable.
  if (!ctx.subject_id || !ctx.tenant_id) {
    denyReason = "missing-identity";
  } else if (ctx.context.behavior_score !== undefined && ctx.context.behavior_score > 80) {
    // Etapa 1: anomalía de comportamiento bloquea (fail-closed).
    denyReason = "behavior-anomaly";
  } else if (ctx.role === undefined || !ROLES.includes(ctx.role as Role)) {
    // Etapa 2: rol desconocido o ausente → deny (nunca allow implícito).
    denyReason = "unknown-role";
  } else {
    // Etapa 3: normalizar (recurso, acción) a la matriz canónica.
    // Los skills (`skill:<id>`) y herramientas (`tool:<id>`) requieren tool:execute.
    let resource: Resource | null = null;
    let action: Action | null = null;
    if (ctx.resource.startsWith("skill:") || ctx.resource.startsWith("tool:")) {
      resource = "tool";
      action = "execute";
    } else if (
      (RESOURCES as readonly string[]).includes(ctx.resource) &&
      (ACTIONS as readonly string[]).includes(ctx.action)
    ) {
      resource = ctx.resource as Resource;
      action = ctx.action as Action;
    }
    if (resource === null || action === null) {
      denyReason = "unknown-operation";
    } else {
      const derived = permissionFor(resource, action);
      if (derived.permission === null) {
        denyReason = `forbidden-operation:${derived.reason}`;
      } else {
        // Etapa 4: RBAC real contra el catálogo + herencia.
        const rbac = checkPermission({ role: ctx.role as Role }, derived.permission);
        if (!rbac.allowed) {
          denyReason = `rbac-deny:${rbac.reason}`;
        } else {
          // Etapa 5: ABAC real (deny-overrides) sobre atributos del request.
          const risk =
            ctx.context.behavior_score === undefined
              ? 0.5
              : Math.min(Math.max(ctx.context.behavior_score / 100, 0), 1);
          const attr: AttributeContext = {
            role: ctx.role as Role,
            subjectTenant: ctx.tenant_id,
            resource: ctx.resource,
            action: ctx.action,
            // Tenant del recurso: sólo se afirma si el llamador lo entrega.
            // Si se omitiera y se rellenara con ctx.tenant_id la política
            // territorial sería una tautología (siempre notApplied).
            resourceTenant: ctx.resource_tenant_id ?? "",
            resourceOwner: ctx.resource_owner ?? "",
            subject: ctx.subject_id,
            risk,
            authenticated: ctx.authenticated ?? false,
            timezone: "UTC",
          };
          const abac = evaluateAbac(attr);
          if (abac.decision === "deny") {
            denyReason = `abac-deny:${abac.policy ?? "unknown"}:${abac.reason}`;
          } else {
            allow = true;
            obligations.push("log_verbose", "pqc_signature_required");
          }
        }
      }
    }
  }

  if (!allow) obligations.push(`deny:${denyReason}`);

  const basePayload = {
    decision_id: decisionId,
    tenant_id: ctx.tenant_id,
    subject_id: ctx.subject_id,
    action: ctx.action,
    resource: ctx.resource,
    allow,
    obligations,
    policy_version: "v4.0.0-real",
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 5 * 60000).toISOString(), // 5 min TTL
  };

  // 2. Firmar el payload principal
  const signature = hsm.signPayload(basePayload);

  // 3. Hash Chaining & Signature Chain — cadena DURABLE (Postgres). En
  // runtime productivo no hay fallback a memoria: si la cadena no está
  // disponible la decisión se reescribe como DENY (fail-closed, AGENTS §4.2).
  const decisionHash = hsm.calculateHash(basePayload);
  let chain: { previousHash: string; signatureChain: string };
  try {
    chain = await hsm.getAndAdvanceChainDurable(ctx.tenant_id, decisionHash, signature);
  } catch (error) {
    if (!(error instanceof HsmDurableUnavailableError)) throw error;
    const deniedPayload = {
      ...basePayload,
      allow: false,
      obligations: [...obligations, "deny:hsm-durable-unavailable"],
    };
    console.error(
      `[PDP] Cadena durable de firmas no disponible; decisión convertida en DENY: ${error.message}`,
    );
    return {
      ...deniedPayload,
      signature: hsm.signPayload(deniedPayload),
      signature_chain: "unavailable:hsm-durable",
      previous_decision_hash: "unavailable:hsm-durable",
    };
  }

  // 4. Retornar Decisión Inmutable
  const finalDecision: AuthorizationDecision = {
    ...basePayload,
    signature,
    signature_chain: chain.signatureChain,
    previous_decision_hash: chain.previousHash,
  };

  return finalDecision;
}
