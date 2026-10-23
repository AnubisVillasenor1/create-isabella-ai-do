import { describe, expect, it } from "vitest";
import { createPrincipal } from "../../src/identity/principal";
import {
  assertTenantScope,
  coerceTenantRecords,
  verifyTenantIsolation,
} from "../../src/tenancy/isolation";

const principal = (tenantId?: string) =>
  createPrincipal({ id: "user-1", kind: "human", tenantId });

describe("verifyTenantIsolation", () => {
  it("marca ISOLATED cuando todo registro pertenece al tenant del principal", () => {
    const report = verifyTenantIsolation(principal("acme"), [
      { resourceId: "r1", tenantId: "acme" },
      { resourceId: "r2", tenantId: "acme" },
    ]);
    expect(report.state).toBe("ISOLATED");
    expect(report.crossTenantLeaksDetected).toBe(0);
    expect(report.resourcesChecked).toBe(2);
    expect(report.findings).toHaveLength(0);
    expect(report.databaseRlsVerified).toBe(false);
    expect(report.tamperProofBoundary).toBe(false);
  });

  it("marca VIOLATION_DETECTED y cuenta las fugas entre tenants", () => {
    const report = verifyTenantIsolation(principal("acme"), [
      { resourceId: "r1", tenantId: "acme" },
      { resourceId: "r2", tenantId: "globex" },
      { resourceId: "r3", tenantId: "initech" },
    ]);
    expect(report.state).toBe("VIOLATION_DETECTED");
    expect(report.crossTenantLeaksDetected).toBe(2);
    expect(report.findings.map((f) => f.code)).toEqual(["CROSS_TENANT_ACCESS", "CROSS_TENANT_ACCESS"]);
    expect(report.reason).toBe("CROSS_TENANT_RECORDS_DETECTED");
  });

  it("marca NOT_ASSESSED si el principal no declara tenant (fail-closed, sin fugas)", () => {
    const report = verifyTenantIsolation(principal(undefined), [
      { resourceId: "r1", tenantId: "acme" },
    ]);
    expect(report.state).toBe("NOT_ASSESSED");
    expect(report.crossTenantLeaksDetected).toBe(0);
    expect(report.findings[0]?.code).toBe("PRINCIPAL_TENANT_MISSING");
    expect(report.reason).toBe("PRINCIPAL_HAS_NO_TENANT");
  });

  it("marca NOT_ASSESSED si un recurso no declara tenant", () => {
    const report = verifyTenantIsolation(principal("acme"), [
      { resourceId: "r1", tenantId: "acme" },
      { resourceId: "r2", tenantId: "" },
    ]);
    expect(report.state).toBe("NOT_ASSESSED");
    expect(report.findings[0]?.code).toBe("RESOURCE_TENANT_MISSING");
    expect(report.reason).toBe("RESOURCE_TENANT_MISSING");
  });

  it("es ISOLATED con lista vacía cuando el principal tiene tenant", () => {
    const report = verifyTenantIsolation(principal("acme"), []);
    expect(report.state).toBe("ISOLATED");
    expect(report.resourcesChecked).toBe(0);
  });
});

describe("coerceTenantRecords", () => {
  it("acepta array directo y contenedores resources/records", () => {
    expect(coerceTenantRecords([{ resourceId: "r1", tenantId: "a" }])).toHaveLength(1);
    expect(coerceTenantRecords({ resources: [{ id: "x", tenantId: "a" }] })[0]).toEqual({
      resourceId: "x",
      tenantId: "a",
    });
    expect(coerceTenantRecords({ records: [{ workspaceId: "w", tenantId: "b" }] })).toHaveLength(1);
  });

  it("ignora entradas no válidas y marca tenant vacío sin lanzar", () => {
    const records = coerceTenantRecords({ resources: [null, 42, { resourceId: "r1" }] });
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ resourceId: "r1", tenantId: "" });
  });

  it("devuelve lista vacía para entradas no reconocidas", () => {
    expect(coerceTenantRecords("nope")).toHaveLength(0);
    expect(coerceTenantRecords(null)).toHaveLength(0);
  });
});

describe("assertTenantScope", () => {
  it("no lanza si el recurso pertenece al tenant del principal", () => {
    expect(() => assertTenantScope(principal("acme"), { resourceId: "r1", tenantId: "acme" })).not.toThrow();
  });

  it("falla cerrado ante fuga entre tenants", () => {
    expect(() => assertTenantScope(principal("acme"), { resourceId: "r1", tenantId: "globex" }))
      .toThrow(/TENANT_ISOLATION_VIOLATION/);
  });

  it("falla cerrado si el principal no declara tenant", () => {
    expect(() => assertTenantScope(principal(undefined), { resourceId: "r1", tenantId: "acme" }))
      .toThrow(/fail-closed/);
  });
});

describe("coerceTenantRecords + verifyTenantIsolation (end-to-end de entrada no confiable)", () => {
  it("detecta una fuga a partir de input crudo", () => {
    const report = verifyTenantIsolation(principal("acme"), coerceTenantRecords({
      resources: [{ id: "ok", tenantId: "acme" }, { id: "leak", tenantId: "globex" }],
    }));
    expect(report.state).toBe("VIOLATION_DETECTED");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.resourceId).toBe("leak");
  });
});
