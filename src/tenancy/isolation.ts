/**
 * MULTI-TENANT ISOLATION VERIFIER
 * state: draft | engine-generated (pendiente revisión humana).
 *
 * Verifica aislamiento **a nivel de aplicación** sobre registros que se le
 * entregan: comprueba que el tenant de cada registro coincide con el tenant del
 * principal verificado. NO es una verificación de RLS/seguridad a nivel de base
 * de datos, NO es una frontera a prueba de manipulación, y NO sustituye una
 * auditoría humana ni una política de acceso del proveedor.
 *
 * Invariante: el tenant de un principal se toma de la identidad verificada en
 * backend; un claim de UI nunca es autoridad (ver companion/ui-context-guard).
 */
import type { Principal } from '../identity/principal';

export interface TenantRecord {
  readonly resourceId: string;
  readonly tenantId: string;
}

export type IsolationState = 'ISOLATED' | 'VIOLATION_DETECTED' | 'NOT_ASSESSED';

export type IsolationFindingCode =
  'PRINCIPAL_TENANT_MISSING' | 'RESOURCE_TENANT_MISSING' | 'CROSS_TENANT_ACCESS';

export interface IsolationFinding {
  readonly code: IsolationFindingCode;
  readonly resourceId: string | null;
  readonly resourceTenant: string | null;
}

export interface TenantIsolationReport {
  readonly state: IsolationState;
  readonly principalId: string;
  readonly principalTenant: string | null;
  readonly resourcesChecked: number;
  readonly crossTenantLeaksDetected: number;
  readonly findings: readonly IsolationFinding[];
  readonly coverage: 'APPLICATION_LEVEL_RECORD_TENANT_CHECK';
  readonly databaseRlsVerified: false;
  readonly tamperProofBoundary: false;
  readonly reason: string;
  readonly checkedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Coerciona entradas no confiables a registros de tenant, sin lanzar. */
export function coerceTenantRecords(input: unknown): readonly TenantRecord[] {
  const container = isRecord(input) ? input : undefined;
  const rawList = Array.isArray(input)
    ? input
    : container && Array.isArray(container.resources)
      ? container.resources
      : container && Array.isArray(container.records)
        ? container.records
        : [];

  const records: TenantRecord[] = [];
  rawList.forEach((item, index) => {
    if (!isRecord(item)) return;
    const resourceId =
      readString(item, ['resourceId', 'id', 'workspaceId']) ?? `resource[${index}]`;
    const tenantId = readString(item, ['tenantId', 'tenant', 'workspaceId']) ?? '';
    records.push({ resourceId, tenantId });
  });
  return records;
}

export function verifyTenantIsolation(
  principal: Principal,
  resources: readonly TenantRecord[],
  now: Date = new Date()
): TenantIsolationReport {
  const principalTenant =
    typeof principal.tenantId === 'string' && principal.tenantId.trim().length > 0
      ? principal.tenantId.trim()
      : null;

  const findings: IsolationFinding[] = [];
  if (principalTenant === null) {
    findings.push({ code: 'PRINCIPAL_TENANT_MISSING', resourceId: null, resourceTenant: null });
  }

  for (const resource of resources) {
    if (resource.tenantId.length === 0) {
      findings.push({
        code: 'RESOURCE_TENANT_MISSING',
        resourceId: resource.resourceId,
        resourceTenant: null,
      });
      continue;
    }
    if (principalTenant !== null && resource.tenantId !== principalTenant) {
      findings.push({
        code: 'CROSS_TENANT_ACCESS',
        resourceId: resource.resourceId,
        resourceTenant: resource.tenantId,
      });
    }
  }

  const crossTenantLeaksDetected = findings.filter((f) => f.code === 'CROSS_TENANT_ACCESS').length;
  let state: IsolationState;
  let reason: string;
  if (crossTenantLeaksDetected > 0) {
    state = 'VIOLATION_DETECTED';
    reason = 'CROSS_TENANT_RECORDS_DETECTED';
  } else if (findings.length > 0) {
    state = 'NOT_ASSESSED';
    reason = principalTenant === null ? 'PRINCIPAL_HAS_NO_TENANT' : 'RESOURCE_TENANT_MISSING';
  } else {
    state = 'ISOLATED';
    reason = 'ALL_PROVIDED_RECORDS_MATCH_PRINCIPAL_TENANT';
  }

  return Object.freeze({
    state,
    principalId: principal.id,
    principalTenant,
    resourcesChecked: resources.length,
    crossTenantLeaksDetected,
    findings: Object.freeze(findings),
    coverage: 'APPLICATION_LEVEL_RECORD_TENANT_CHECK' as const,
    databaseRlsVerified: false as const,
    tamperProofBoundary: false as const,
    reason,
    checkedAt: now.toISOString(),
  });
}

/** Falla cerrado si el recurso no pertenece al tenant del principal. */
export function assertTenantScope(principal: Principal, resource: TenantRecord): void {
  const principalTenant = typeof principal.tenantId === 'string' ? principal.tenantId.trim() : '';
  if (principalTenant.length === 0) {
    throw new Error('TENANT_ISOLATION_VIOLATION: el principal no declara tenant (fail-closed).');
  }
  if (resource.tenantId !== principalTenant) {
    throw new Error(
      `TENANT_ISOLATION_VIOLATION: recurso ${resource.resourceId} (tenant=${resource.tenantId || '∅'}) fuera del tenant ${principalTenant}.`
    );
  }
}
