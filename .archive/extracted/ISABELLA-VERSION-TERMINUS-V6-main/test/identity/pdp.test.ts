import { describe, expect, it } from "vitest";
import { createConsentRegistry } from "../../src/identity/consent";
import { createPrincipal, assertBalancedAuthority } from "../../src/identity/principal";
import {
  decidePdp,
  isPrivileged,
  overrideWithHumanApproval,
  decidePdp as decide,
  type PdpRequest,
} from "../../src/identity/pdp";
import { createRbacPolicy, type RbacPolicy } from "../../src/identity/rbac";
import { createTenantCatalog } from "../../src/identity/tenant";
import { issueHumanApproval } from "../../src/identity/approval";

const rbac: RbacPolicy = createRbacPolicy([
  { name: "operator", permissions: ["evolution:run", "memory:recall"] },
  { name: "privileged-service", permissions: ["admin:escale"] },
  { name: "admin", permissions: ["*"] },
]);

const tenants = createTenantCatalog([
  { id: "t1", name: "Tenant Uno", status: "active" },
  { id: "t2", name: "Tenant Dos", status: "active" },
  { id: "pend", name: "Pendiente", status: "provisioning" },
]);

function req(partial: Partial<PdpRequest> & { principal: PdpRequest["principal"] }): PdpRequest {
  return { action: "evolution:run", resource: "evolution", methodId: "m", ...partial };
}

describe("identity/pdp", () => {
  const human = createPrincipal({ id: "h1", kind: "human", tenantId: "t1", roles: ["operator"] });
  const machine = createPrincipal({ id: "m1", kind: "machine", tenantId: "t1", roles: ["privileged-service"] });

  it("ALLOW para humano con permiso y arrendatario activo", () => {
    expect(decidePdp({ rbac, tenants }, req({ principal: human })).effect).toBe("ALLOW");
  });

  it("DENY sin permiso", () => {
    const sinPermiso = createPrincipal({ id: "h2", kind: "human", tenantId: "t1", roles: [] });
    expect(decidePdp({ rbac, tenants }, req({ principal: sinPermiso })).effect).toBe("DENY");
  });

  it("DENY si no hay aislamiento de arrendatario", () => {
    const pc = req({ principal: human, tenantId: "t2" });
    expect(decidePdp({ rbac, tenants }, pc).effect).toBe("DENY");
  });

  it("DENY para arrendatario no activo", () => {
    const pc = req({
      principal: createPrincipal({ id: "h3", kind: "human", tenantId: "pend", roles: ["operator"] }),
    });
    expect(decidePdp({ rbac, tenants }, pc).effect).toBe("DENY");
  });

  it("FLAG para máquina con acción privilegiada, incluso con permiso", () => {
    const pc = decidePdp({ rbac, tenants }, req({ principal: machine, action: "admin:escale" }));
    expect(pc.effect).toBe("FLAG");
    expect(pc.admitted).toBe(false);
  });

  it("consentimiento obligatorio para ámbitos sensibles", () => {
    const consent = createConsentRegistry();
    consent.register({
      principalId: "h1",
      purpose: "memoria",
      scope: ["recall"],
      grantedBy: "human",
      grantedAt: new Date().toISOString(),
    });
    const without = decidePdp(
      { rbac, tenants, consent },
      req({ principal: human, consent: { purpose: "memoria", scope: "recall" } }),
    );
    expect(without.effect).toBe("ALLOW");
  });

  it("override de FLAG con aprobación humana → ALLOW admited", () => {
    const flag = decide({ rbac, tenants }, req({ principal: machine, action: "admin:escale" }));
    const approver = createPrincipal({ id: "h9", kind: "human", roles: ["admin"] });
    const approval = issueHumanApproval(approver, { methodId: "m", action: "admin:escale", principalId: machine.id, resource: "evolution" }, "ALLOW");
    const overridden = overrideWithHumanApproval(flag, approval, { methodId: "m", action: "admin:escale", principalId: machine.id, resource: "evolution" });
    expect(overridden.effect).toBe("ALLOW");
    expect(overridden.admitted).toBe(true);
  });

  it("override de ALLOW no cambia nada", () => {
    const allow = decide({ rbac, tenants }, req({ principal: human }));
    expect(overrideWithHumanApproval(allow, undefined, { methodId: "m", action: "read:all", principalId: human.id, resource: "res" }).effect).toBe("ALLOW");
  });
});

describe("identity/principal", () => {
  it("una máquina no puede ostentar admin sin delegación humana", () => {
    expect(() => assertBalancedAuthority(createPrincipal({ id: "rob", kind: "machine", roles: ["admin"] }))).toThrow(/máquina/);
  });

  it("isPrivileged detecta acciones sensibles", () => {
    expect(isPrivileged("delete:dataset")).toBe(true);
    expect(isPrivileged("memory:recall")).toBe(false);
  });
});