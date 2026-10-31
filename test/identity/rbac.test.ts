import { describe, expect, it } from "vitest";
import { createPrincipal } from "../../src/identity/principal";
import {
  createRbacPolicy,
  hasPermission,
  permissionGranted,
  resolvePermissions,
} from "../../src/identity/rbac";

describe("identity/rbac", () => {
  const policy = createRbacPolicy([
    { name: "guest", permissions: ["memory:recall"] },
    { name: "operator", permissions: ["evolution:run"], inherits: ["guest"] },
    { name: "admin", permissions: ["*"] },
  ]);

  it("resuelve herencia sin ciclos", () => {
    expect(hasPermission(policy, createPrincipal({ id: "op", kind: "human", roles: ["operator"] }), "memory:recall")).toBe(true);
    expect(hasPermission(policy, createPrincipal({ id: "op", kind: "human", roles: ["operator"] }), "evolution:run")).toBe(true);
    expect(hasPermission(policy, createPrincipal({ id: "guest", kind: "human", roles: ["guest"] }), "evolution:run")).toBe(false);
  });

  it("rechaza herencia hacia rol inexistente", () => {
    expect(() => createRbacPolicy([{ name: "r", permissions: [], inherits: ["nope"] }])).toThrow(/inexistente/);
  });

  it("wildcard admin cubre todo", () => {
    expect(
      hasPermission(policy, createPrincipal({ id: "a", kind: "human", roles: ["admin"] }), "cualquier.cosa"),
    ).toBe(true);
    expect(permissionGranted(new Set(["evolution:*"]), "evolution:run")).toBe(true);
    expect(permissionGranted(new Set(["evolution:run"]), "memory:recall")).toBe(false);
  });

  it("resuelve permisos por rol", () => {
    const set = resolvePermissions(policy, "operator");
    expect(set.has("evolution:run")).toBe(true);
    expect(set.has("memory:recall")).toBe(true);
  });
});