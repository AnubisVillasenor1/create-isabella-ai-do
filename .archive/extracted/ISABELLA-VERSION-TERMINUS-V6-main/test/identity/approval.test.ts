import { describe, expect, it } from "vitest";
import { createPrincipal } from "../../src/identity/principal";
import { createTenantCatalog, isolatedAccess, tenantIsActive } from "../../src/identity/tenant";
import { isRecentApproval, issueHumanApproval } from "../../src/identity/approval";

describe("identity/tenant", () => {
  const catalog = createTenantCatalog([
    { id: "t1", name: "Uno", status: "active" },
    { id: "t2", name: "Dos", status: "active" },
    { id: "sus", name: "Suspendido", status: "suspended" },
  ]);

  it("reporta arrendatarios activos", () => {
    expect(tenantIsActive(catalog, "t1")).toBe(true);
    expect(tenantIsActive(catalog, "sus")).toBe(false);
  });

  it("aislamiento entre arrendatarios salvo SRM explícito", () => {
    expect(isolatedAccess(catalog, "t1", "t2")).toBe(false);
    expect(isolatedAccess(catalog, "t1", "t2", { crossTenantGranted: true })).toBe(true);
    expect(isolatedAccess(catalog, "t1", "sus", { crossTenantGranted: true })).toBe(false);
    expect(isolatedAccess(catalog, undefined, "t1")).toBe(false);
  });
});

describe("identity/approval", () => {
  it("sólo humanos pueden emitir aprobación", () => {
    const machine = createPrincipal({ id: "rob", kind: "machine" });
    expect(() =>
      issueHumanApproval(machine as never, { methodId: "m", action: "x" }, "ALLOW"),
    ).toThrow(/conciencia humana/);
  });

  it("un humano sin rol de aprobación no puede emitir una autorización", () => {
    const human = createPrincipal({ id: "h2", kind: "human", roles: ["viewer"] });
    expect(() => issueHumanApproval(human, { methodId: "m", action: "delete:x" }, "ALLOW"))
      .toThrow(/lacks approval authority/);
  });

  it("emite aprobación y verifica frescura", () => {
    const human = createPrincipal({ id: "h1", kind: "human", roles: ["approver"] });
    const ref = issueHumanApproval(human, { methodId: "m", action: "delete:x" }, "ALLOW");
    expect(ref.decision).toBe("ALLOW");
    expect(isRecentApproval(ref, 60_000)).toBe(true);
  });
});