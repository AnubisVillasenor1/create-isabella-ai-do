/**
 * PERMISSION MAP Ω — mapeo de permisos a nivel de ORDEN y transferencia explícita
 * de responsabilidad.
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: pedir permiso 30 veces por una orden de 30 acciones genera
 * fricción y mata la adopción; ejecutar sin permiso es peligroso. Este módulo toma
 * una **orden de alto nivel** (p. ej. "enviar un email a 30 clientes"), la expande
 * en las operaciones atómicas que exige, **cataloga cada permiso por nivel de riesgo**
 * (NEUTRO · BAJO · MEDIO · ALTO · CRÍTICO), agrega las ocurrencias (el volumen
 * amplifica el riesgo) y produce un **checklist** que el humano revisa y firma.
 *
 * Invariante: **mapear no autoriza; autorizar es un acto explícito y fechado del
 * principal humano.** Isabella transporta y evidencia la orden; la responsabilidad
 * por las consecuencias recae en quien otorga la luz verde. El sobre de autorización
 * queda sellado con un digest determinista y una firma inyectable, y la ejecución es
 * fail-closed: sin sobre válido que cubra TODOS los permisos requeridos, no procede.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { sha256 } from "../skills/canonical-json";

export const PERMISSION_MAP_VERSION = "1.0.0" as const;

export type PermissionRiskLevel = "NEUTRO" | "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

export const PERMISSION_LEVELS: readonly PermissionRiskLevel[] = ["NEUTRO", "BAJO", "MEDIO", "ALTO", "CRITICO"];

const LEVEL_INDEX: Readonly<Record<PermissionRiskLevel, number>> = {
  NEUTRO: 0,
  BAJO: 1,
  MEDIO: 2,
  ALTO: 3,
  CRITICO: 4,
};

function clampLevel(index: number): PermissionRiskLevel {
  const bounded = Math.max(0, Math.min(PERMISSION_LEVELS.length - 1, index));
  return PERMISSION_LEVELS[bounded] ?? "NEUTRO";
}

/** Amplificación por volumen: una acción inocua repetida 30 veces deja de serlo. */
function amplifyRisk(base: PermissionRiskLevel, occurrences: number): PermissionRiskLevel {
  let bump = 0;
  if (occurrences >= 1000) bump = 3;
  else if (occurrences >= 100) bump = 2;
  else if (occurrences >= 10) bump = 1;
  return clampLevel(LEVEL_INDEX[base] + bump);
}

export interface OrderStep {
  readonly stepId: string;
  /** Identidad de método [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK].[GOV]. */
  readonly methodId: string;
  readonly description: string;
  readonly action: string;
  readonly resource: string;
  /** Nº de ejecuciones (p. ej. 30 clientes). Entero ≥ 1. */
  readonly occurrences: number;
  readonly baseRisk: PermissionRiskLevel;
}

export interface OrderIntent {
  readonly orderId: string;
  readonly principalId: string;
  readonly description: string;
  readonly steps: readonly OrderStep[];
}

export interface RequiredPermission {
  readonly permissionId: string;
  readonly methodId: string;
  readonly action: string;
  readonly resource: string;
  readonly description: string;
  readonly occurrences: number;
  readonly baseRisk: PermissionRiskLevel;
  readonly riskLevel: PermissionRiskLevel;
}

export interface PermissionCatalog {
  readonly version: typeof PERMISSION_MAP_VERSION;
  readonly orderId: string;
  readonly principalId: string;
  readonly description: string;
  readonly totalPermissions: number;
  readonly totalAuthorizations: number;
  readonly byLevel: Readonly<Record<PermissionRiskLevel, number>>;
  readonly highestLevel: PermissionRiskLevel;
  readonly requiresHumanAcceptance: boolean;
  readonly permissions: readonly RequiredPermission[];
  readonly checklist: string;
  readonly digest: string;
}

function assertNonEmpty(value: string, code: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(code);
  return trimmed;
}

export function mapOrderPermissions(intent: OrderIntent): PermissionCatalog {
  const orderId = assertNonEmpty(intent.orderId, "ORDER_ID_REQUIRED");
  const principalId = assertNonEmpty(intent.principalId, "ORDER_PRINCIPAL_REQUIRED");
  if (!Array.isArray(intent.steps) || intent.steps.length === 0) throw new Error("ORDER_STEPS_REQUIRED");

  const seen = new Set<string>();
  const permissions: RequiredPermission[] = [];
  const byLevel: Record<PermissionRiskLevel, number> = { NEUTRO: 0, BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };

  for (const step of intent.steps) {
    const stepId = assertNonEmpty(step.stepId, "ORDER_STEP_ID_REQUIRED");
    if (seen.has(stepId)) throw new Error("ORDER_STEP_ID_DUPLICATED");
    seen.add(stepId);
    const methodId = assertNonEmpty(step.methodId, "ORDER_STEP_METHOD_REQUIRED");
    const action = assertNonEmpty(step.action, "ORDER_STEP_ACTION_REQUIRED");
    const resource = assertNonEmpty(step.resource, "ORDER_STEP_RESOURCE_REQUIRED");
    if (!Number.isSafeInteger(step.occurrences) || step.occurrences < 1) throw new Error("ORDER_STEP_OCCURRENCES_INVALID");
    if (!PERMISSION_LEVELS.includes(step.baseRisk)) throw new Error("ORDER_STEP_RISK_INVALID");

    const riskLevel = amplifyRisk(step.baseRisk, step.occurrences);
    byLevel[riskLevel] += 1;
    permissions.push({
      permissionId: `${orderId}::${stepId}`,
      methodId,
      action,
      resource,
      description: step.description?.trim() || `${action} sobre ${resource}`,
      occurrences: step.occurrences,
      baseRisk: step.baseRisk,
      riskLevel,
    });
  }

  const highestLevel = permissions.reduce<PermissionRiskLevel>(
    (highest, permission) => (LEVEL_INDEX[permission.riskLevel] > LEVEL_INDEX[highest] ? permission.riskLevel : highest),
    "NEUTRO",
  );
  const totalAuthorizations = permissions.reduce((sum, permission) => sum + permission.occurrences, 0);
  const requiresHumanAcceptance = LEVEL_INDEX[highestLevel] >= LEVEL_INDEX.ALTO;

  const catalog: Omit<PermissionCatalog, "checklist" | "digest"> = {
    version: PERMISSION_MAP_VERSION,
    orderId,
    principalId,
    description: intent.description?.trim() ?? "",
    totalPermissions: permissions.length,
    totalAuthorizations,
    byLevel,
    highestLevel,
    requiresHumanAcceptance,
    permissions,
  };

  return {
    ...catalog,
    checklist: renderChecklist(catalog),
    digest: sha256({ orderId, permissions }),
  };
}

export function renderChecklist(catalog: Omit<PermissionCatalog, "checklist" | "digest">): string {
  const header =
    `Tu orden «${catalog.orderId}» requiere ${catalog.totalPermissions} permisos ` +
    `(${catalog.totalAuthorizations} autorizaciones totales). Nivel más alto: ${catalog.highestLevel}. ` +
    (catalog.requiresHumanAcceptance ? "Requiere aceptación humana explícita." : "Sin permisos ALTO/CRÍTICO.");
  const lines: string[] = [header, ""];
  for (const level of [...PERMISSION_LEVELS].reverse()) {
    const group = catalog.permissions.filter((permission) => permission.riskLevel === level);
    if (group.length === 0) continue;
    lines.push(`## ${level} (${group.length})`);
    for (const permission of group) {
      lines.push(`- [ ] (${permission.riskLevel}) ${permission.action} → ${permission.resource} (x${permission.occurrences}) — ${permission.description}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export interface PermissionDecision {
  readonly permissionId: string;
  readonly authorized: boolean;
}

export interface ResponsibilityRecord {
  readonly acceptedBy: string;
  readonly acceptedAt: string;
  readonly totalPermissions: number;
  readonly criticalAccepted: readonly string[];
  readonly clause: string;
}

export interface AuthorizationEnvelope {
  readonly version: typeof PERMISSION_MAP_VERSION;
  readonly orderId: string;
  readonly principalId: string;
  readonly catalogDigest: string;
  readonly decisions: readonly PermissionDecision[];
  readonly acceptedAt: string;
  readonly responsibility: ResponsibilityRecord;
  readonly digest: string;
  readonly signature?: string;
}

export interface AuthorizationSigner {
  readonly sign: (digest: string) => string;
  readonly verify: (digest: string, signature: string) => boolean;
}

export function computeAuthorizationDigest(envelope: Omit<AuthorizationEnvelope, "digest" | "signature">): string {
  return sha256({
    version: envelope.version,
    orderId: envelope.orderId,
    principalId: envelope.principalId,
    catalogDigest: envelope.catalogDigest,
    decisions: [...envelope.decisions].sort((a, b) => a.permissionId.localeCompare(b.permissionId)),
    acceptedAt: envelope.acceptedAt,
    responsibility: envelope.responsibility,
  });
}

export function createAuthorizationEnvelope(
  catalog: PermissionCatalog,
  input: {
    readonly principalId: string;
    readonly decisions: readonly PermissionDecision[];
    readonly acceptedAt?: string;
    readonly signer?: AuthorizationSigner;
  },
): AuthorizationEnvelope {
  const principalId = assertNonEmpty(input.principalId, "AUTHORIZATION_PRINCIPAL_REQUIRED");
  if (principalId !== catalog.principalId) throw new Error("AUTHORIZATION_PRINCIPAL_MISMATCH");
  if (!Array.isArray(input.decisions)) throw new Error("AUTHORIZATION_DECISIONS_REQUIRED");

  const known = new Set(catalog.permissions.map((permission) => permission.permissionId));
  const provided = new Map<string, boolean>();
  for (const decision of input.decisions) {
    if (!known.has(decision.permissionId)) throw new Error("AUTHORIZATION_UNKNOWN_PERMISSION");
    provided.set(decision.permissionId, decision.authorized === true);
  }

  const decisions: PermissionDecision[] = catalog.permissions
    .map((permission) => ({ permissionId: permission.permissionId, authorized: provided.get(permission.permissionId) === true }))
    .sort((a, b) => a.permissionId.localeCompare(b.permissionId));

  const acceptedAt = input.acceptedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(acceptedAt))) throw new Error("AUTHORIZATION_TIMESTAMP_INVALID");

  const criticalAccepted = catalog.permissions
    .filter((permission) => LEVEL_INDEX[permission.riskLevel] >= LEVEL_INDEX.ALTO && provided.get(permission.permissionId) === true)
    .map((permission) => permission.permissionId)
    .sort();

  const clause =
    `El principal humano «${principalId}» revisó y aceptó el checklist de ${catalog.totalPermissions} permisos ` +
    `(${criticalAccepted.length} de nivel ALTO/CRÍTICO) el ${acceptedAt}. Isabella transportó y evidenció la orden; ` +
    `la autorización y sus consecuencias recaen en el principal humano.`;

  const responsibility: ResponsibilityRecord = {
    acceptedBy: principalId,
    acceptedAt,
    totalPermissions: catalog.totalPermissions,
    criticalAccepted,
    clause,
  };

  const base = {
    version: PERMISSION_MAP_VERSION,
    orderId: catalog.orderId,
    principalId,
    catalogDigest: catalog.digest,
    decisions,
    acceptedAt,
    responsibility,
  } as const;

  const digest = computeAuthorizationDigest(base);
  const signature = input.signer ? input.signer.sign(digest) : undefined;

  return { ...base, digest, ...(signature !== undefined ? { signature } : {}) };
}

export type AuthorizationStatus = "AUTHORIZED" | "PARTIAL" | "DENIED" | "INVALID";

export interface AuthorizationVerification {
  readonly status: AuthorizationStatus;
  readonly mayProceed: boolean;
  readonly authorizedPermissions: readonly string[];
  readonly deniedPermissions: readonly string[];
  readonly uncoveredPermissions: readonly string[];
  readonly digestValid: boolean;
  readonly signatureValid: boolean | "not-configured";
  readonly reason: string;
  readonly responsibility: ResponsibilityRecord | null;
}

export function verifyAuthorizationEnvelope(
  envelope: AuthorizationEnvelope,
  catalog: PermissionCatalog,
  verifier?: (digest: string, signature: string) => boolean,
): AuthorizationVerification {
  const empty = { authorizedPermissions: [] as string[], deniedPermissions: [] as string[], uncoveredPermissions: [] as string[] };

  if (envelope.orderId !== catalog.orderId || envelope.catalogDigest !== catalog.digest) {
    return { status: "INVALID", mayProceed: false, ...empty, digestValid: false, signatureValid: "not-configured", reason: "CATALOG_MISMATCH", responsibility: null };
  }

  const recomputed = computeAuthorizationDigest({
    version: envelope.version,
    orderId: envelope.orderId,
    principalId: envelope.principalId,
    catalogDigest: envelope.catalogDigest,
    decisions: envelope.decisions,
    acceptedAt: envelope.acceptedAt,
    responsibility: envelope.responsibility,
  });
  const digestValid = recomputed === envelope.digest;
  const signatureValid: boolean | "not-configured" = verifier && envelope.signature !== undefined
    ? verifier(recomputed, envelope.signature)
    : "not-configured";

  if (!digestValid || signatureValid === false) {
    return { status: "INVALID", mayProceed: false, ...empty, digestValid, signatureValid, reason: digestValid ? "SIGNATURE_INVALID" : "DIGEST_TAMPERED", responsibility: null };
  }

  const decisions = new Map(envelope.decisions.map((decision) => [decision.permissionId, decision.authorized]));
  const authorizedPermissions: string[] = [];
  const deniedPermissions: string[] = [];
  const uncoveredPermissions: string[] = [];
  for (const permission of catalog.permissions) {
    const decision = decisions.get(permission.permissionId);
    if (decision === undefined) uncoveredPermissions.push(permission.permissionId);
    else if (decision) authorizedPermissions.push(permission.permissionId);
    else deniedPermissions.push(permission.permissionId);
  }

  if (uncoveredPermissions.length > 0) {
    return { status: "INVALID", mayProceed: false, authorizedPermissions, deniedPermissions, uncoveredPermissions, digestValid, signatureValid, reason: "UNCOVERED_PERMISSIONS", responsibility: null };
  }

  const status: AuthorizationStatus = authorizedPermissions.length === 0
    ? "DENIED"
    : deniedPermissions.length > 0
      ? "PARTIAL"
      : "AUTHORIZED";

  return {
    status,
    mayProceed: status === "AUTHORIZED",
    authorizedPermissions,
    deniedPermissions,
    uncoveredPermissions,
    digestValid,
    signatureValid,
    reason: status === "AUTHORIZED" ? "ALL_PERMISSIONS_AUTHORIZED" : status === "PARTIAL" ? "PARTIAL_AUTHORIZATION" : "DENIED_BY_PRINCIPAL",
    responsibility: envelope.responsibility,
  };
}

/** Guard de ejecución fail-closed: solo procede con autorización completa y válida. */
export function authorizeExecution(
  envelope: AuthorizationEnvelope,
  catalog: PermissionCatalog,
  verifier?: (digest: string, signature: string) => boolean,
): AuthorizationVerification {
  return verifyAuthorizationEnvelope(envelope, catalog, verifier);
}

export function buildAllDecisions(catalog: PermissionCatalog, authorized: boolean): PermissionDecision[] {
  return catalog.permissions.map((permission) => ({ permissionId: permission.permissionId, authorized }));
}

/** Firma HMAC-SHA256 con comparación en tiempo constante (SEC-04). */
export function createHmacSigner(secret: string): AuthorizationSigner {
  if (!secret || secret.length < 8) throw new Error("PERMISSION_MAP_SECRET_REQUIRED");
  const mac = (digest: string): string => createHmac("sha256", secret).update(digest, "utf8").digest("hex");
  return {
    sign: (digest: string) => mac(digest),
    verify: (digest: string, signature: string) => {
      const expected = Buffer.from(mac(digest), "utf8");
      const given = Buffer.from(signature, "utf8");
      return expected.length === given.length && timingSafeEqual(expected, given);
    },
  };
}
