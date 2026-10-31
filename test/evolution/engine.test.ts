import { describe, expect, it } from "vitest";
import { createEngine, applyControlState } from "../../src/evolution/engine";
import { generateControls } from "../../src/evolution/catalog";
import { evolveControlState } from "../../src/evolution/state-machine";

describe("evolution/engine", () => {
  it("registra 7,000 controles", () => {
    const engine = createEngine();
    expect(engine.controls.size).toBe(7000);
  });

  it("negativa a auto-cablear: sin aprobación humana, un control no pasa a wired", () => {
    const control = generateControls().find((c) => c.state === "declared");
    expect(control).toBeDefined();
    expect(() => applyControlState(control!, "wired")).toThrow(/aprobación humana/);
  });

  it("permite wired sólo con aprobador humano", () => {
    const control = generateControls().find((c) => c.state === "declared");
    const result = applyControlState(control!, "wired", {
      evidenceRef: "test/evolution/engine.test.ts",
      humanApprover: "Anubis Villaseñor",
    });
    expect(result.previousState).toBe("declared");
    expect(result.nextState).toBe("wired");
    expect(result.humanApprover).toBe("Anubis Villaseñor");
  });

  it("rechaza transiciones que degradan evidencia", () => {
    const control = generateControls().find((c) => c.state === "blocked");
    expect(control).toBeDefined();
    expect(() => applyControlState(control!, "verified")).toThrow(/Transición inválida/);
  });

  it("la evolución no puede auto-registrar un control como confiable", () => {
    expect(() => evolveControlState("blocked", "verified")).toThrow();
    expect(evolveControlState("declared", "wired")).toBe("wired");
  });
});