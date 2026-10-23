/** RBAC — control de acceso basado en roles. */

import type { Principal } from "./principal";

export interface RolePolicy {
  name: string;
  permissions: readonly string[];
  inherits?: readonly string[];
}

export interface RbacPolicy {
  roles: ReadonlyArray<Readonly<RolePolicy>>;
}

export function createRbacPolicy(roles: readonly RolePolicy[]): RbacPolicy {
  const byName = new Map(roles.map((r) => [r.name, r]));
  for (const role of roles) {
    for (const parent of role.inherits ?? []) {
      if (!byName.has(parent)) {
        throw new Error(`RBAC: el rol '${role.name}' hereda de '${parent}' inexistente`);
      }
    }
  }
  return { roles };
}

export function resolvePermissions(policy: RbacPolicy, roleName: string): Set<string> {
  const resolved = new Set<string>();
  const visiting = new Set<string>();
  const visit = (name: string): void => {
    if (resolved.has(name) || visiting.has(name)) {
      return; // corta ciclos de herencia
    }
    const role = policy.roles.find((r) => r.name === name);
    if (!role) {
      return;
    }
    visiting.add(name);
    for (const perm of role.permissions) {
      resolved.add(perm);
    }
    for (const parent of role.inherits ?? []) {
      visit(parent);
    }
    visiting.delete(name);
  };
  visit(roleName);
  return resolved;
}

export function principalPermissions(policy: RbacPolicy, principal: Principal): Set<string> {
  const perms = new Set<string>();
  for (const role of principal.roles) {
    for (const perm of resolvePermissions(policy, role)) {
      perms.add(perm);
    }
  }
  return perms;
}

/** Un "*" cubre toda acción; un "ns:*" cubre todas las acciones de un namespace. */
export function permissionGranted(set: ReadonlySet<string>, permission: string): boolean {
  if (set.has(permission) || set.has("*")) {
    return true;
  }
  const namespace = permission.slice(0, permission.indexOf(":"));
  return namespace.length > 0 && set.has(`${namespace}:*`);
}

export function hasPermission(policy: RbacPolicy, principal: Principal, permission: string): boolean {
  return permissionGranted(principalPermissions(policy, principal), permission);
}