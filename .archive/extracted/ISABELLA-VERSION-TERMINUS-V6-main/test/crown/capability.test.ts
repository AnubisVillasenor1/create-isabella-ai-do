import { describe, expect, it } from "vitest";
import { createCapabilityGate, callGate, approvalRequiredForGate, type CapabilityDescriptor } from "../../src/crown/capability";
import { createPrincipal } from "../../src/identity/principal";
import { issueHumanApproval } from "../../src/identity/approval";

const MEMORIA = "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS";
const COURIER = "T.ECONOMY.E03_SUPPLY.transfer_asset.synthesize.v1.0.0.HIGH.TERRITORIAL";

function gate(): ReturnType<typeof createCapabilityGate> {
  const descriptors: CapabilityDescriptor[] = [
    {
      methodId: MEMORIA,
      owner: "isabella",
      allowedRoles: ["operator"],
      riskTier: "LOW",
      governanceTier: "AUTONOMOUS",
      humanApprovalRequired: false,
    },
    {
      methodId: COURIER,
      owner: "isabella",
      allowedRoles: ["operator"],
      riskTier: "HIGH",
      governanceTier: "TERRITORIAL",
      humanApprovalRequired: true,
    },
  ];
  return createCapabilityGate(descriptors);
}

describe("crown/capability", () => {
  const operator = createPrincipal({ id: "h1", kind: "human", roles: ["operator"] });

  it("permite una capacidad registrada no privilegiada", () => {
    const v = callGate(gate(), MEMORIA, { principal: operator, action: "memory:recall", resource: "memory" });
    expect(v.granted).toBe(true);
  });

  it("deniega capacidades sin registro (fail-closed)", () => {
    const v = callGate(gate(), "T.TWINS.E00_X.no_op.v1.0.0.LOW.AUTONOMOUS", { principal: operator, action: "memory:recall", resource: "memory" });
    expect(v.granted).toBe(false);
  });

  it("deniega si el principal no tiene rol autorizado", () => {
    const guest = createPrincipal({ id: "g", kind: "human", roles: [] });
    expect(callGate(gate(), MEMORIA, { principal: guest, action: "memory:recall", resource: "memory" }).granted).toBe(false);
  });

  it("deniega una capacidad con lista de roles vacía (fail-closed)", () => {
    const emptyRoleGate = createCapabilityGate([{
      methodId: MEMORIA,
      owner: "isabella",
      allowedRoles: [],
      riskTier: "LOW",
      governanceTier: "AUTONOMOUS",
      humanApprovalRequired: false,
    }]);
    expect(callGate(emptyRoleGate, MEMORIA, { principal: operator, action: "memory:recall", resource: "memory" }).granted).toBe(false);
  });

  it("exige aprobación humana para HIGH/CRITICAL", () => {
    const sinAprobacion = callGate(gate(), COURIER, { principal: operator, action: "transfer_asset", resource: "asset:123" });
    expect(sinAprobacion.granted).toBe(false);

    const approving = issueHumanApproval(
      createPrincipal({ id: "adm", kind: "human", roles: ["admin"] }),
      { methodId: COURIER, action: "transfer_asset", resource: "asset:123", principalId: operator.id },
      "ALLOW",
    );
    const conAprobacion = callGate(gate(), COURIER, { principal: operator, approval: approving, action: "transfer_asset", resource: "asset:123" });
    expect(conAprobacion.granted).toBe(true);
    expect(conAprobacion.evidenceRef).toBe(approving.evidenceId);
  });

  it("no acepta una aprobación para otra acción o recurso aunque el método coincida", () => {
    const approving = issueHumanApproval(
      createPrincipal({ id: "adm", kind: "human", roles: ["admin"] }),
      { methodId: COURIER, action: "transfer_asset", resource: "asset:123", principalId: operator.id },
      "ALLOW",
    );
    expect(callGate(gate(), COURIER, {
      principal: operator,
      approval: approving,
      action: "transfer_asset",
      resource: "asset:999",
    }).granted).toBe(false);
  });

  it("no acepta una aprobación para otro método", () => {
    const approving = issueHumanApproval(
      createPrincipal({ id: "adm", kind: "human", roles: ["admin"] }),
      { methodId: "OTRO", action: "x" },
      "ALLOW",
    );
    expect(callGate(gate(), COURIER, { principal: operator, approval: approving, action: "transfer_asset", resource: "asset:123" }).granted).toBe(false);
  });

  it("marca aprobación requerida por riesgo", () => {
    expect(approvalRequiredForGate(gate().descriptors.get(COURIER)!)).toBe(true);
    expect(approvalRequiredForGate(gate().descriptors.get(MEMORIA)!)).toBe(false);
  });
});