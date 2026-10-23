import { describe, expect, it } from "vitest";
import { evaluateAdmission, type AdmissionRule } from "../../src/ingress/admission";

describe("ingress/admission", () => {
  const context = {
    methodId: "A.TWINS.E18_PLANNING.decompose_task.synthesize.v1.0.0.MEDIUM.INSTITUTIONAL",
    rateKey: "tenant-1",
  };

  it("fail-closed por defecto: sin reglas → DENY", () => {
    expect(evaluateAdmission(context, []).effect).toBe("DENY");
  });

  it("acede cuando una regla aprueba", () => {
    const rule: AdmissionRule = {
      name: "allow-known-method",
      test: (ctx) => ctx.methodId.startsWith("A."),
      effect: "ALLOW",
      reason: "método registrado",
    };
    expect(evaluateAdmission(context, [rule]).effect).toBe("ALLOW");
  });

  it("fail-open cuando se omite fail-closed", () => {
    expect(evaluateAdmission(context, [], { failClosed: false }).effect).toBe("ALLOW");
  });

  it("una excepción de regla se trata como no-aprobación", () => {
    const bad: AdmissionRule = {
      name: "explota",
      test: () => {
        throw new Error("boom");
      },
      effect: "ALLOW",
      reason: "nunca",
    };
    expect(evaluateAdmission(context, [bad]).effect).toBe("DENY");
  });
});