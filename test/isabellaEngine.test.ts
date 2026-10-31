import { describe, expect, it } from "vitest";
import { IsabellaEngine } from "../src/isabella";

describe("IsabellaEngine v2", () => {
  it("is deterministic for identical hypotheses", () => {
    const a = new IsabellaEngine();
    const b = new IsabellaEngine();
    const ra = a.procesarSimulacionEpistemologica("hipótesis soberana territorial", true);
    const rb = b.procesarSimulacionEpistemologica("hipótesis soberana territorial", true);
    expect(ra.resultado.validacionHeptafederada).toEqual(rb.resultado.validacionHeptafederada);
  });
  it("detects entropy and rejects an empty probability mass", () => {
    const engine = new IsabellaEngine();
    expect(engine.evaluarEntropia([0.5,0.5]).resultado.mitigacionRequerida).toBe(false);
    expect(engine.evaluarEntropia([1,1,1,1]).resultado.mitigacionRequerida).toBe(true);
    expect(() => engine.evaluarEntropia([0,0])).toThrow();
  });
  it("records auditable operations", () => {
    const engine = new IsabellaEngine();
    const audit = engine.ejecutarContraAuditoria("La teoría jamás fue validada", "El investigador resolvió el problema");
    expect(audit.resultado.tensionDetectada).toBe(0.95);
    engine.procesarSimulacionEpistemologica("hipótesis", true);
    expect(engine.listLedger()).toHaveLength(3);
  });
  it("keeps repeated evaluations stable without Math.random", () => {
    const engine = new IsabellaEngine();
    const one = engine.procesarSimulacionEpistemologica("misma hipótesis", false).resultado.validacionHeptafederada;
    const two = engine.procesarSimulacionEpistemologica("misma hipótesis", false).resultado.validacionHeptafederada;
    expect(one).toEqual(two);
  });
});
