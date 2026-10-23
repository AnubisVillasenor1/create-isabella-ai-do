import { describe, expect, it } from "vitest";
import {
  PERMISSION_MAP_VERSION,
  buildAllDecisions,
  computeAuthorizationDigest,
  createAuthorizationEnvelope,
  createHmacSigner,
  mapOrderPermissions,
  verifyAuthorizationEnvelope,
  type AuthorizationEnvelope,
  type OrderIntent,
} from "../../src/governance/permission-map";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import type { MagpieEvent } from "../../src/messaging";

const M = "isabella.messaging.email";

const order: OrderIntent = {
  orderId: "ORD-EMAIL-30",
  principalId: "user-1",
  description: "Enviar email personalizado a 30 clientes",
  steps: [
    { stepId: "read-list", methodId: `${M}.read.1.0.0`, description: "Leer la lista de clientes", action: "read", resource: "clientes", occurrences: 1, baseRisk: "BAJO" },
    { stepId: "compose", methodId: `${M}.compose.1.0.0`, description: "Redactar cada correo", action: "compose", resource: "email", occurrences: 30, baseRisk: "NEUTRO" },
    { stepId: "send", methodId: `${M}.send.1.0.0`, description: "Enviar cada correo", action: "send", resource: "email", occurrences: 30, baseRisk: "BAJO" },
    { stepId: "log", methodId: `${M}.log.1.0.0`, description: "Registrar cada envío", action: "log", resource: "bookpi", occurrences: 30, baseRisk: "NEUTRO" },
    { stepId: "grant", methodId: `${M}.grant.1.0.0`, description: "Conceder acceso al panel de facturación", action: "grant", resource: "billing", occurrences: 1, baseRisk: "ALTO" },
  ],
};

describe("Permission Map Ω", () => {
  it("maps a high-level order into a leveled permission catalog", () => {
    const catalog = mapOrderPermissions(order);
    expect(catalog.version).toBe(PERMISSION_MAP_VERSION);
    expect(catalog.orderId).toBe("ORD-EMAIL-30");
    expect(catalog.totalPermissions).toBe(5);
    expect(catalog.totalAuthorizations).toBe(92);
    expect(catalog.byLevel.BAJO).toBe(3);
    expect(catalog.byLevel.MEDIO).toBe(1);
    expect(catalog.byLevel.ALTO).toBe(1);
    expect(catalog.highestLevel).toBe("ALTO");
    expect(catalog.requiresHumanAcceptance).toBe(true);
    expect(catalog.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("amplifies risk by volume (30 → +1, 300 → +2)", () => {
    const catalog = mapOrderPermissions({
      orderId: "ORD-AMP",
      principalId: "u",
      description: "escala",
      steps: [
        { stepId: "a", methodId: M, description: "x", action: "send", resource: "email", occurrences: 30, baseRisk: "BAJO" },
        { stepId: "b", methodId: M, description: "y", action: "send", resource: "sms", occurrences: 300, baseRisk: "BAJO" },
      ],
    });
    expect(catalog.permissions.find((p) => p.permissionId.endsWith("::a"))?.riskLevel).toBe("MEDIO");
    expect(catalog.permissions.find((p) => p.permissionId.endsWith("::b"))?.riskLevel).toBe("ALTO");
  });

  it("renders a checklist grouped by level with critical first", () => {
    const { checklist } = mapOrderPermissions(order);
    expect(checklist).toContain("5 permisos");
    expect(checklist).toContain("92 autorizaciones");
    expect(checklist).toContain("## ALTO");
    expect(checklist).toContain("## MEDIO");
    expect(checklist.indexOf("## ALTO")).toBeLessThan(checklist.indexOf("## MEDIO"));
  });

  it("produces a deterministic digest", () => {
    expect(mapOrderPermissions(order).digest).toBe(mapOrderPermissions(order).digest);
  });

  it("fails closed on malformed input", () => {
    expect(() => mapOrderPermissions({ ...order, orderId: "  " })).toThrow(/ORDER_ID_REQUIRED/);
    expect(() => mapOrderPermissions({ ...order, steps: [] })).toThrow(/ORDER_STEPS_REQUIRED/);
    expect(() => mapOrderPermissions({ ...order, steps: [{ ...order.steps[0]!, occurrences: 0 }] })).toThrow(/ORDER_STEP_OCCURRENCES_INVALID/);
    expect(() => mapOrderPermissions({ ...order, steps: [order.steps[0]!, order.steps[0]!] })).toThrow(/ORDER_STEP_ID_DUPLICATED/);
  });

  it("authorizes fully and attributes responsibility to the human principal", () => {
    const catalog = mapOrderPermissions(order);
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, true) });
    const verification = verifyAuthorizationEnvelope(envelope, catalog);
    expect(verification.status).toBe("AUTHORIZED");
    expect(verification.mayProceed).toBe(true);
    expect(verification.responsibility?.acceptedBy).toBe("user-1");
    expect(verification.responsibility?.criticalAccepted).toHaveLength(1);
    expect(verification.responsibility?.clause).toMatch(/recaen en el principal humano/);
  });

  it("defaults unmarked permissions to denied and reports PARTIAL", () => {
    const catalog = mapOrderPermissions(order);
    const critical = catalog.permissions.find((p) => p.riskLevel === "ALTO")!;
    const decisions = buildAllDecisions(catalog, true).map((d) => (d.permissionId === critical.permissionId ? { ...d, authorized: false } : d));
    const verification = verifyAuthorizationEnvelope(createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions }), catalog);
    expect(verification.status).toBe("PARTIAL");
    expect(verification.mayProceed).toBe(false);
    expect(verification.deniedPermissions).toContain(critical.permissionId);
  });

  it("reports DENIED when nothing is authorized", () => {
    const catalog = mapOrderPermissions(order);
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, false) });
    expect(verifyAuthorizationEnvelope(envelope, catalog).status).toBe("DENIED");
  });

  it("detects a tampered decision via the digest (fail-closed)", () => {
    const catalog = mapOrderPermissions(order);
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, true) });
    const tampered: AuthorizationEnvelope = { ...envelope, decisions: envelope.decisions.map((d, i) => (i === 0 ? { ...d, authorized: false } : d)) };
    const verification = verifyAuthorizationEnvelope(tampered, catalog);
    expect(verification.status).toBe("INVALID");
    expect(verification.reason).toBe("DIGEST_TAMPERED");
  });

  it("rejects an envelope built for another catalog", () => {
    const catalog = mapOrderPermissions(order);
    const other = mapOrderPermissions({ ...order, orderId: "ORD-OTHER" });
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, true) });
    expect(verifyAuthorizationEnvelope(envelope, other).reason).toBe("CATALOG_MISMATCH");
  });

  it("blocks when a required permission has no decision (uncovered)", () => {
    const catalog = mapOrderPermissions(order);
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, true) });
    const forgedBase = { ...envelope, decisions: envelope.decisions.slice(0, -1) };
    const forged: AuthorizationEnvelope = { ...forgedBase, digest: computeAuthorizationDigest(forgedBase) };
    const verification = verifyAuthorizationEnvelope(forged, catalog);
    expect(verification.status).toBe("INVALID");
    expect(verification.reason).toBe("UNCOVERED_PERMISSIONS");
    expect(verification.uncoveredPermissions).toHaveLength(1);
  });

  it("seals and verifies with HMAC (timing-safe) and rejects a wrong key", () => {
    const signer = createHmacSigner("super-secret-key");
    const catalog = mapOrderPermissions(order);
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, true), signer });
    const ok = verifyAuthorizationEnvelope(envelope, catalog, signer.verify);
    expect(ok.status).toBe("AUTHORIZED");
    expect(ok.signatureValid).toBe(true);
    const wrong = verifyAuthorizationEnvelope(envelope, catalog, createHmacSigner("another-secret-key").verify);
    expect(wrong.status).toBe("INVALID");
    expect(wrong.reason).toBe("SIGNATURE_INVALID");
  });

  it("is wired into the runtime and emits governed events", () => {
    const runtime = new IsabellaGenesisRuntime();
    const ids = runtime.capabilities.list().map((c) => c.id);
    expect(ids).toContain("hsf.governance.permission-map");
    expect(ids).toContain("hsf.governance.consent-envelope");

    const seen: MagpieEvent[] = [];
    runtime.subscribeEvent("governance.permissions.mapped", (e) => seen.push(e));
    runtime.subscribeEvent("governance.permissions.authorized", (e) => seen.push(e));

    const catalog = runtime.mapOrderPermissions(order);
    expect(catalog.totalPermissions).toBe(5);
    const envelope = createAuthorizationEnvelope(catalog, { principalId: "user-1", decisions: buildAllDecisions(catalog, true) });
    const verification = runtime.verifyOrderAuthorization(envelope, catalog);
    expect(verification.mayProceed).toBe(true);
    expect(seen.map((e) => e.topic)).toEqual(["governance.permissions.mapped", "governance.permissions.authorized"]);
  });
});
