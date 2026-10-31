import { describe, expect, it } from "vitest";
import {
  Ihec,
  SovereignKernelError,
  createIhec,
  ihecSummary,
  runWithIhec,
} from "../../src/ihec";

describe("IHEC · orquestador", () => {
  it("expone los 12 subsistemas", () => {
    const ihec = createIhec();
    expect(ihec).toBeInstanceOf(Ihec);
    expect(typeof ihec.sentinel.detect).toBe("function");
    expect(typeof ihec.rag.search).toBe("function");
    expect(typeof ihec.omegaMode.rebuildAndRespond).toBe("function");
  });

  it("camino feliz: devuelve resultado + regalos, sin autorizar ni ejecutar", () => {
    const ihec = createIhec();
    const outcome = runWithIhec(ihec, { summary: "hola" }, () => 42);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result).toBe(42);
      expect(outcome.gifts.prisma.approvalStatus).toBe("PENDING_REVIEW");
      expect(outcome.authorizationPerformed).toBe(false);
      expect(outcome.executionPerformed).toBe(false);
      expect(outcome.authorityPath).toBe("FULL");
    }
  });

  it("fallo soberano: failover + recuperación + crisis + guarda", () => {
    const ihec = createIhec();
    const outcome = runWithIhec(ihec, { summary: "x" }, () => {
      throw new SovereignKernelError("fed-1", "KERNEL_FAIL");
    });
    expect(outcome.status).toBe("degraded");
    if (outcome.status === "degraded") {
      expect(outcome.reason).toBe("KERNEL_FAIL");
      expect(outcome.response.authorizationPerformed).toBe(false);
      expect(outcome.topology.federation).toBe("fed-1");
    }
    expect(ihec.crisisMemory.all()).toHaveLength(1);
    expect(ihec.crisisMemory.all()[0]?.mode).toBe("FAILOVER");
    expect(ihec.immuneMutation.all()[0]?.severity).toBe("normal");
    expect(ihec.governance.trail()).toHaveLength(1);
  });

  it("fallo genérico: Omega Mode + crisis OMEGA + guarda crítica", () => {
    const ihec = createIhec();
    const outcome = runWithIhec(ihec, { summary: "x" }, () => {
      throw new Error("boom");
    });
    expect(outcome.status).toBe("omega");
    if (outcome.status === "omega") {
      expect(outcome.response.status).toBe("omega");
      expect(outcome.response.authorizationPerformed).toBe(false);
    }
    expect(ihec.omegaMode.active()).toBe(true);
    expect(ihec.crisisMemory.all()[0]?.mode).toBe("OMEGA");
    expect(ihec.immuneMutation.all()[0]?.severity).toBe("critical");
  });

  it("resumen honesto de IHEC v3.1", () => {
    const summary = ihecSummary();
    expect(summary.spec).toBe("isabella-core-ccr-ihec-perplexity");
    expect(summary.version).toBe("3.1.0");
    expect(summary.subsystems).toBe(12);
    expect(summary.layers).toBe(2);
    expect(summary.gifts).toBe(10);
    expect(summary.divergences).toBeGreaterThanOrEqual(3);
  });
});
