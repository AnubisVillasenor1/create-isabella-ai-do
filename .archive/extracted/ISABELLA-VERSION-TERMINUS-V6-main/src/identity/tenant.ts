/** Aislamiento de arrendatario (IDENTITY & AUTHORITY — tenant isolation). */

export interface Tenant {
  id: string;
  name: string;
  status: "active" | "suspended" | "provisioning";
}

export interface TenantCatalog {
  tenants: ReadonlyMap<string, Tenant>;
}

export function createTenantCatalog(tenants: readonly Tenant[]): TenantCatalog {
  return { tenants: new Map(tenants.map((t) => [t.id, t])) };
}

export function tenantIsActive(catalog: TenantCatalog, tenantId: string): boolean {
  return catalog.tenants.get(tenantId)?.status === "active";
}

/**
 * La memoria no puede convertirse en canal de contexto entre arrendatarios:
 * un principal sólo accede a su arrendatario salvo SRM explícito.
 */
export function isolatedAccess(
  catalog: TenantCatalog,
  principalTenantId: string | undefined,
  targetTenantId: string,
  opts: { crossTenantGranted?: boolean } = {},
): boolean {
  if (!principalTenantId) {
    return false; // sin arrendatario conocido no hay acceso aislado
  }
  if (principalTenantId === targetTenantId) {
    return tenantIsActive(catalog, targetTenantId);
  }
  return opts.crossTenantGranted === true && tenantIsActive(catalog, targetTenantId);
}