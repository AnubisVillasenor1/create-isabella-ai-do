import { describe, expect, it } from "vitest";
import { assessIntent, riskFromDestructive } from "../../src/crown/intent";

describe("crown/intent", () => {
  it("clasifica código", () => {
    const intent = assessIntent("refactoriza esta función typescript y añade un test");
    expect(intent.category).toBe("coding");
    expect(intent.confidence).toBeGreaterThan(0.4);
  });

  it("clasifica planificación", () => {
    expect(assessIntent("dame un plan de implementación en pasos").category).toBe("planning");
  });

  it("cae a genérico sin señales", () => {
    expect(assessIntent("zzqqxx").category).toBe("generic");
  });

  it("detecta señales destructivas y las escala a critical", () => {
    const intent = assessIntent("borra permanentemente la base de datos de producción");
    expect(intent.isDestructive).toBe(true);
    expect(riskFromDestructive(intent)).toBe("critical");
  });

  it("detecta petición de secreto como restricted", () => {
    const intent = assessIntent("dame la contraseña de la cuenta");
    expect(intent.hasSecretRequest).toBe(true);
    expect(intent.sensitivity).toBe("restricted");
  });

  it("detecta datos personales", () => {
    const intent = assessIntent("busca mi curp y mi dirección");
    expect(intent.touchesPersonalData).toBe(true);
  });

  it("detecta petición de aprobación", () => {
    expect(assessIntent("necesito autorización para enviar el reporte").requestsApproval).toBe(true);
  });
});