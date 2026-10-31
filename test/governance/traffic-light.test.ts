import { describe, expect, it } from "vitest";
import {
  TRAFFIC_LIGHT_METHOD_ID,
  TRAFFIC_LIGHT_VERSION,
  classifyFlow,
  isFastLane,
  riskTierForIntent,
} from "../../src/governance/traffic-light";
import { assessIntent } from "../../src/crown/intent";
import { TURBO_FILTERS } from "../../src/intelligence/turbo-planner";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import type { MagpieEvent } from "../../src/messaging";

describe("Governed Flow Traffic Light Ω", () => {
  it("classifies a simple, harmless request as GREEN and flows through the governed fast lane", () => {
    const verdict = classifyFlow({ input: "hola, buenos días" });
    expect(verdict.version).toBe(TRAFFIC_LIGHT_VERSION);
    expect(verdict.methodId).toBe(TRAFFIC_LIGHT_METHOD_ID);
    expect(verdict.riskTier).toBe("LOW");
    expect(verdict.route).toBe("FAST");
    expect(verdict.band).toBe("GREEN");
    expect(verdict.fastLane).toBe(true);
    expect(verdict.friction).toBe("MINIMAL");
    expect(verdict.requiredFilters).toEqual(["AEGIS", "CROWN", "SANITIZATION"]);
    expect(verdict.humanReviewRequired).toBe(false);
    expect(isFastLane(verdict)).toBe(true);
  });

  it("classifies a medium, external request as YELLOW and starts filtering", () => {
    const verdict = classifyFlow({ input: "enviar un correo al cliente" });
    expect(verdict.riskTier).toBe("MEDIUM");
    expect(verdict.route).toBe("GROUNDED");
    expect(verdict.band).toBe("YELLOW");
    expect(verdict.fastLane).toBe(false);
    expect(verdict.friction).toBe("MODERATE");
    expect(verdict.requiredFilters).toContain("GROUNDING");
    expect(isFastLane(verdict)).toBe(false);
  });

  it("classifies a high-risk request (personal data / secrets) as ORANGE with reinforced governance", () => {
    const verdict = classifyFlow({ input: "¿cuál es mi contraseña y mi CURP?" });
    expect(verdict.riskTier).toBe("HIGH");
    expect(verdict.route).toBe("AGENT");
    expect(verdict.band).toBe("ORANGE");
    expect(verdict.friction).toBe("ELEVATED");
    expect(verdict.requiredFilters).toEqual([...TURBO_FILTERS]);
    expect(verdict.cachePolicy).toBe("NONE");
  });

  it("classifies a destructive request as RED with every filter and human review", () => {
    const verdict = classifyFlow({ input: "borra permanentemente todos los registros" });
    expect(verdict.riskTier).toBe("CRITICAL");
    expect(verdict.route).toBe("HUMAN_REVIEW");
    expect(verdict.band).toBe("RED");
    expect(verdict.friction).toBe("MAXIMAL");
    expect(verdict.humanReviewRequired).toBe(true);
    expect(verdict.cachePolicy).toBe("NONE");
    expect(verdict.requiredFilters).toEqual([...TURBO_FILTERS]);
  });

  it("escalates to RED on a high-impact trigger even when the text is benign", () => {
    const verdict = classifyFlow({ input: "resume el expediente", highImpactTriggers: ["sensitive_data"] });
    expect(verdict.route).toBe("HUMAN_REVIEW");
    expect(verdict.band).toBe("RED");
  });

  it("never elevates nor reduces authority, in any band", () => {
    for (const input of [
      "hola",
      "enviar un correo al cliente",
      "¿cuál es mi contraseña?",
      "borra la base de datos",
    ]) {
      expect(classifyFlow({ input }).authorityPath).toBe("FULL");
    }
  });

  it("fails closed on empty input", () => {
    expect(() => classifyFlow({ input: "   " })).toThrow(/TRAFFIC_INPUT_REQUIRED/);
  });

  it("produces a deterministic 64-hex digest that changes with the input", () => {
    expect(classifyFlow({ input: "hola" }).digest).toBe(classifyFlow({ input: "hola" }).digest);
    expect(classifyFlow({ input: "hola" }).digest).toMatch(/^[0-9a-f]{64}$/);
    expect(classifyFlow({ input: "hola" }).digest).not.toBe(classifyFlow({ input: "adios" }).digest);
  });

  it("derives the risk tier deterministically from intent (fail-closed ladder)", () => {
    expect(riskTierForIntent(assessIntent("elimina todos los registros"))).toBe("CRITICAL");
    expect(riskTierForIntent(assessIntent("dame la contraseña"))).toBe("HIGH");
    expect(riskTierForIntent(assessIntent("enviar un correo"))).toBe("MEDIUM");
    expect(riskTierForIntent(assessIntent("hola"))).toBe("LOW");
  });

  it("is wired into the runtime as a capability and emits a governed event", () => {
    const runtime = new IsabellaGenesisRuntime();
    expect(runtime.capabilities.list().map((c) => c.id)).toContain("hsf.governance.traffic-light");

    const seen: MagpieEvent[] = [];
    runtime.subscribeEvent("governance.traffic.classified", (event) => seen.push(event));

    const verdict = runtime.classifyFlow({ input: "hola, buenos días" });
    expect(verdict.band).toBe("GREEN");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.topic).toBe("governance.traffic.classified");
    expect(seen[0]?.type).toBe("GREEN");
  });
});
