/**
 * POLICY AS CODE — GATE DE CAPA DB (src/lib/db-policy-gate.ts)
 * -----------------------------------------------------------------
 * Overlay de las reglas versionadas de `isabella_policies` sobre la decisión
 * del motor ARGUS (`policy-engine.ts`).
 *
 * Semántica (§4.2 fail-closed, integración de nodo-cero-isabella):
 *  - La capa DB sólo puede ENDURECER la decisión de código (monótona):
 *    denied > requires_approval > allowed. Nunca relaja un denied ni convierte
 *    un requires_approval en allowed.
 *  - Primera regla que coincide gana (orden determinista: priority, policyKey).
 *  - Sin regla que coincida = "no_override": manda la decisión de código.
 *  - Store no configurado (sin DATABASE_URL) = se omite la capa y se registra
 *    el motivo; no se inventa un allow.
 *  - Store indisponible (error de lectura/DB) = fail-closed: herramientas
 *    sensibles (requiresApproval, riesgo high/critical o categoría
 *    identity/ledger/network) pasan a requires_approval; el resto conserva la
 *    decisión de código pero queda marcado como degradado. Ninguna mutación
 *    obtiene un allow nuevo por esta vía.
 *
 * Módulo puro (sin `pg`, sin `config`, sin red): la parte testeable vive aquí
 * y el I/O queda en `repositories/policy-repository.ts`.
 */

import type { RegisteredTool } from "./tool-registry";
import type { DbPolicyRule, DbPolicyStatus, StoredPolicy } from "./repositories/policy-repository";

export type CodeDecision = DbPolicyStatus;

export type DbRuleStatus = CodeDecision | "no_override";

export interface DbRuleOutcome {
  status: DbRuleStatus;
  reason: string;
  policyKey?: string;
}

export interface DbPolicyEvaluationInput {
  tool: Pick<RegisteredTool, "name" | "risk" | "category" | "territorialBoundary">;
  authenticated: boolean;
}

export type DbGateSource = "db" | "no_override" | "unavailable" | "not_configured";

export interface DbGateResult {
  status: CodeDecision;
  reason: string;
  policyKey?: string;
  source: DbGateSource;
  /** true = la capa DB no pudo consultarse y se degradó la decisión. */
  degraded: boolean;
}

const SEVERITY: Record<CodeDecision, number> = {
  allowed: 1,
  requires_approval: 2,
  denied: 3,
};

function ruleMatches(when: DbPolicyRule["when"], input: DbPolicyEvaluationInput): boolean {
  // Sin `when` (o vacío) = la regla aplica a todo (patrón nodo-cero).
  if (!when || Object.keys(when).length === 0) return true;
  if (when.tool !== undefined && when.tool !== input.tool.name) return false;
  if (when.risk !== undefined && when.risk !== input.tool.risk) return false;
  if (when.category !== undefined && when.category !== input.tool.category) return false;
  if (when.territorialBoundary !== undefined) {
    if (when.territorialBoundary !== input.tool.territorialBoundary) return false;
  }
  if (when.authenticated !== undefined) {
    if (when.authenticated !== input.authenticated) return false;
  }
  return true;
}

/**
 * Evalúa las políticas en orden (priority, policyKey) y devuelve la primera
 * regla que coincide. Sin coincidencia = `no_override`.
 */
export function evaluateDbPolicyRules(
  policies: readonly StoredPolicy[],
  input: DbPolicyEvaluationInput,
): DbRuleOutcome {
  const ordered = [...policies].sort(
    (a, b) => a.priority - b.priority || a.policyKey.localeCompare(b.policyKey),
  );
  for (const policy of ordered) {
    if (!Array.isArray(policy.rules)) continue;
    for (const rule of policy.rules) {
      if (!ruleMatches(rule.when, input)) continue;
      const status: DbRuleStatus = rule.then?.status ?? "allowed";
      return {
        status,
        reason: rule.then?.reason ?? `politica_${policy.policyKey}`,
        policyKey: policy.policyKey,
      };
    }
  }
  return { status: "no_override", reason: "sin_regla_que_coincida" };
}

/**
 * Combina la decisión de código con la de la capa DB de forma monótona
 * (sólo endurecimiento).
 */
export function overlayDbDecision(
  codeDecision: CodeDecision,
  outcome: DbRuleOutcome,
): DbGateResult {
  if (outcome.status === "no_override") {
    return {
      status: codeDecision,
      reason: "sin_override_db",
      source: "no_override",
      degraded: false,
    };
  }
  const status: CodeDecision =
    SEVERITY[outcome.status] > SEVERITY[codeDecision] ? outcome.status : codeDecision;
  const tightened = status !== codeDecision;
  return {
    status,
    reason: tightened ? `${outcome.reason}` : `no_refuerza:${codeDecision}`,
    policyKey: outcome.policyKey,
    source: "db",
    degraded: false,
  };
}
/** Mapeo de indisponibilidad: fail-closed para herramientas sensibles. */
const SENSITIVE_CATEGORIES = new Set(["identity", "ledger", "network"]);

export function unavailableDbGate(
  codeDecision: CodeDecision,
  tool: Pick<RegisteredTool, "name" | "risk" | "category" | "requiresApproval">,
  error: unknown,
): DbGateResult {
  const detail = error instanceof Error ? error.message : String(error);
  const sensitive =
    tool.requiresApproval ||
    tool.risk === "high" ||
    tool.risk === "critical" ||
    SENSITIVE_CATEGORIES.has(tool.category);
  if (sensitive) {
    return {
      status: "requires_approval",
      reason: `db-policy-unavailable:${detail}`,
      source: "unavailable",
      degraded: true,
    };
  }
  return {
    status: codeDecision,
    reason: `db-policy-unavailable:degradado:${detail}`,
    source: "unavailable",
    degraded: true,
  };
}

export interface ApplyDbPolicyGateParams {
  /** Store inyectado. Sin store o con `load() === null` = no configurado. */
  store?: { load(): Promise<StoredPolicy[] | null> };
  codeDecision: CodeDecision;
  tool: RegisteredTool;
  authenticated: boolean;
}

/**
 * Orquesta la capa DB: carga reglas, evalúa y produce la decisión final.
 * Nunca lanza: los errores se convierten en estado `unavailable` (fail-closed).
 */
export async function applyDbPolicyGate(params: ApplyDbPolicyGateParams): Promise<DbGateResult> {
  const { codeDecision, tool, authenticated } = params;
  if (!params.store) {
    return {
      status: codeDecision,
      reason: "db-policy-store-no-inyectado",
      source: "not_configured",
      degraded: false,
    };
  }
  let policies: StoredPolicy[] | null;
  try {
    policies = await params.store.load();
  } catch (error) {
    return unavailableDbGate(codeDecision, tool, error);
  }
  if (policies === null) {
    return {
      status: codeDecision,
      reason: "db-policy-sin-database-url",
      source: "not_configured",
      degraded: false,
    };
  }
  const outcome = evaluateDbPolicyRules(policies, { tool, authenticated });
  return overlayDbDecision(codeDecision, outcome);
}
