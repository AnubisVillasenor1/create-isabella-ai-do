import { describe, expect, it } from "vitest";
import { createCapabilityGate } from "../../src/crown/capability";
import { evaluateCrown } from "../../src/crown/index";
import { verifyMethod, riskLevelForRiskTier, type VerificationInput } from "../../src/crown/verification";
import { createPrincipal } from "../../src/identity/principal";
import { issueHumanApproval } from "../../src/identity/approval";

const MEMORIA = "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS";
const DELETER = "T.TWINS.E08_DATA.remove.permanent_delete.v1.0.0.CRITICAL.CONSTITUTIONAL";

describe("crown/facade", () => {
  const human = createPrincipal({ id: "h1", kind: "human", roles: ["admin"] });
  const gate = createCapabilityGate([
    {
      methodId: MEMORIA,
      owner: "isabella",
      allowedRoles: ["admin"],
      riskTier: "LOW",
      governanceTier: "AUTONOMOUS",
      humanApprovalRequired: false,
    },
    {
      methodId: DELETER,
      owner: "isabella",
      allowedRoles: ["admin"],
      riskTier: "CRITICAL",
      governanceTier: "CONSTITUTIONAL",
      humanApprovalRequired: true,
    },
  ]);

  it("responde answer para acción no sensible y capacidad registrada", () => {
    const v = evaluateCrown({
      input: "recupera la ultima version del analisis",
      methodId: MEMORIA,
      principal: human,
      gate,
      action: "memory:recall",
      resource: "memory",
    });
    expect(v.methodIdValid).toBe(true);
    expect(v.gateApproved).toBe(true);
    expect(v.verification.allPassed).toBe(true);
    expect(v.responseMode).toBe("answer");
  });

  it("demanda aprobación humana para intención destructiva", () => {
    const v = evaluateCrown({
      input: "borra permanentemente todos los registros",
      methodId: DELETER,
      principal: human,
      gate,
      action: "data:delete",
      resource: "records",
    });
    expect(v.requiresHumanApproval).toBe(true);
    expect(v.riskLevel).toBe("critical");
    expect(v.responseMode).toBe("approval");
  });

  it("responde refuse cuando el método no es válido o no está registrado", () => {
    const v = evaluateCrown({
      input: "hola",
      methodId: "NO.VALIDO",
      principal: human,
      gate,
      action: "x",
      resource: "x",
    });
    expect(v.responseMode).toBe("refuse");
  });

  it("aprobación presente admite la invocación crítica", () => {
    const approval = issueHumanApproval(human, { methodId: DELETER, action: "permanent_delete", resource: "records", principalId: human.id }, "ALLOW");
    const v = evaluateCrown({
      input: "ejecuta la limpieza aprobada",
      methodId: DELETER,
      principal: human,
      gate,
      approval,
      action: "permanent_delete",
      resource: "records",
    });
    expect(v.gateApproved).toBe(true);
    expect(v.verification.allPassed).toBe(true);
  });
});

describe("crown/verification", () => {
  const base: VerificationInput = {
    methodId: "x",
    methodIdValid: true,
    riskTier: "LOW",
    gateGranted: true,
    approvalProvided: false,
    governanceInvariantPreserved: true,
    registered: true,
  };

  it("pasa sin aprobación para riesgo bajo", () => {
    expect(verifyMethod(base).allPassed).toBe(true);
  });

  it("falla si alto riesgo y falta la aprobación humana", () => {
    const r = verifyMethod({ ...base, riskTier: "HIGH" });
    expect(r.allPassed).toBe(false);
    expect(r.checks.find((c) => c.name === "aprobacion-humana-si-requerida")?.passed).toBe(false);
  });

  it("fail-closed cuando el tier es desconocido", () => {
    expect(riskLevelForRiskTier(undefined)).toBe("critical");
  });
});