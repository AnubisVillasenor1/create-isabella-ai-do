/** IDENTITY & AUTHORITY — PrincipalContext (who asks). */
export type PrincipalKind = "human" | "machine" | "service";

export interface Principal {
  id: string;
  kind: PrincipalKind;
  displayName?: string;
  tenantId?: string;
  roles: readonly string[];
  attributes: Readonly<Record<string, string | number | boolean>>;
  approvalKeyId?: string;
}

export interface PrincipalContext {
  principal: Principal;
  scope: string;
  methodId: string;
  requestId?: string;
  traceId?: string;
}

export function createPrincipal(partial: Omit<Principal, "roles" | "attributes"> & {
  roles?: readonly string[];
  attributes?: Record<string, string | number | boolean>;
}): Principal {
  return Object.freeze({
    id: partial.id, kind: partial.kind, displayName: partial.displayName, tenantId: partial.tenantId,
    roles: partial.roles ?? [], attributes: partial.attributes ?? {}, approvalKeyId: partial.approvalKeyId,
  }) as Principal;
}

export function isHuman(p: Principal): boolean { return p.kind === "human"; }

export function assertBalancedAuthority(p: Principal): void {
  if (p.kind !== "human" && p.roles.includes("admin")) {
    throw new Error("IDENTITY: una máquina o principal no humano no puede ostentar admin sin delegación humana (non-human principals cannot hold admin without explicit human delegation).");
  }
}
