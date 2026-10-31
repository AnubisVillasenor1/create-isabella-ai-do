import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { Application, Request, Response } from "express";
import {
  BlackoutController,
  assessConstitutionalIntegrity,
  type BlackoutEvidenceEvent,
} from "../../src/governance/blackout";
import { registerBlackoutRoutes } from "../../src/routes/governance-blackout";
import { KillSwitch, signKillCommand, type KillCommand } from "../../src/security/kill-switch";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";

/**
 * state: draft | engine-generated — arnés in-process de las rutas de blackout y legitimidad.
 * No se levanta un servidor: se registra contra una `app` falsa y se invocan los handlers, como
 * en el resto de test/routes. La firma es real (Ed25519 generado en el test) porque la puerta
 * que se prueba es precisamente que sin firma no hay apagado.
 */

type Handler = (req: Request, res: Response) => void | Promise<void>;
const NOW = Date.parse("2026-10-29T12:00:00Z");

function makeKillSwitch() {
  const alice = generateKeyPairSync("ed25519");
  const bob = generateKeyPairSync("ed25519");
  const ks = new KillSwitch({
    authorizedKeys: new Map([
      ["alice", alice.publicKey],
      ["bob", bob.publicKey],
    ]),
    maxDurationMs: 10_000,
  });
  let counter = 0;
  const command = (issuer: string, action: "ENGAGE" | "RELEASE", scope: string): KillCommand => {
    counter += 1;
    const pair = issuer === "bob" ? bob : alice;
    return signKillCommand(pair.privateKey, {
      action,
      scope,
      issuer,
      issuedAt: new Date(NOW).toISOString(),
      nonce: `nonce-${counter}-route-test`,
      reason: "prueba de superficie",
    });
  };
  return { ks, command };
}

function harness(
  opts: { denyAdmin?: boolean; denyRate?: boolean; sealFails?: boolean; ledgerValid?: boolean } = {}
) {
  const handlers = new Map<string, Handler>();
  const reg = (m: string) => (p: string, h: Handler) => handlers.set(`${m} ${p}`, h);
  const app = {
    get: reg("GET"),
    post: reg("POST"),
  } as unknown as Application;

  const sealed: BlackoutEvidenceEvent[] = [];
  const { ks, command } = makeKillSwitch();
  const controller = new BlackoutController({
    killSwitch: ks,
    recordEvidence: (event) => {
      if (opts.sealFails === true) throw new Error("BOOKPI_MAINTENANCE_RECOVERY_REQUIRED");
      sealed.push(event);
    },
    newEventId: () => `evt-${sealed.length + 1}`,
    now: () => NOW,
  });

  registerBlackoutRoutes({
    app,
    controller,
    assess: () =>
      assessConstitutionalIntegrity({
        verifyLedger: () =>
          opts.ledgerValid === false
            ? { valid: false, status: "INTEGRITY_FAILURE", diagnostics: ["hash mismatch"] }
            : { valid: true, status: "VERIFIED_IN_MEMORY_CHAIN", diagnostics: [] },
        readinessErrors: [],
        envHalted: false,
        halted: (scope) => ks.isHalted(scope, NOW),
      }),
    enforceRateLimit: () => opts.denyRate !== true,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => {
      if (opts.denyAdmin === true) {
        res.status(401).json({ success: false, error: "UNAUTHORIZED" });
        return false;
      }
      return true;
    },
    recordEvidence: (event) => {
      if (opts.sealFails === true) throw new Error("ledger unavailable");
      sealed.push(event);
    },
    newEventId: () => `evt-legit-${sealed.length + 1}`,
  });

  return { handlers, ks, command, sealed };
}

async function call(
  handlers: Map<string, Handler>,
  key: string,
  body?: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  const handler = handlers.get(key);
  if (handler === undefined) throw new Error(`ruta no registrada: ${key}`);
  let status = 200;
  let responseBody: Record<string, unknown> = {};
  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    json(payload: unknown) {
      responseBody = payload as Record<string, unknown>;
      return res;
    },
  } as unknown as Response;
  await handler({ body, method: key.split(" ")[0], ip: "127.0.0.1", path: "/" } as unknown as Request, res);
  return { status, body: responseBody };
}

const ENGAGE_PATH = "POST /api/v1/governance/blackout/engage";
const RELEASE_PATH = "POST /api/v1/governance/blackout/release";
const STATUS_PATH = "GET /api/v1/governance/blackout/status";
const LEGITIMACY_PATH = "POST /api/v1/governance/legitimacy/evaluate";

describe("routes/governance-blackout — apagado gobernado", () => {
  it("exige el gate de administración antes de cualquier decisión", async () => {
    const { handlers } = harness({ denyAdmin: true });
    const response = await call(handlers, ENGAGE_PATH, { command: {} });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  it("rechaza una orden incompleta sin tocar el kill switch", async () => {
    const { handlers, ks } = harness();
    const response = await call(handlers, ENGAGE_PATH, {
      command: { action: "ENGAGE", scope: "LLM_INFERENCE" },
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("BLACKOUT_COMMAND_INCOMPLETE");
    expect(ks.isHalted("LLM_INFERENCE", NOW)).toBe(false);
  });

  it("apaga con firma válida, responde la transición y la sella", async () => {
    const { handlers, ks, command, sealed } = harness();
    const response = await call(handlers, ENGAGE_PATH, {
      command: command("alice", "ENGAGE", "LLM_INFERENCE"),
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      capabilityChanged: true,
      evidenceSealed: true,
      scope: "LLM_INFERENCE",
      issuer: "alice",
    });
    expect(ks.isHalted("LLM_INFERENCE", NOW)).toBe(true);
    expect(sealed.map((e) => e.type)).toContain("BLACKOUT_ENGAGED");
  });

  it("no finge evidencia: si el libro falla, lo reporta en la misma respuesta", async () => {
    const { handlers, ks, command } = harness({ sealFails: true });
    const response = await call(handlers, ENGAGE_PATH, {
      command: command("alice", "ENGAGE", "PAYMENTS"),
    });
    expect(response.status).toBe(200);
    expect(response.body.evidenceSealed).toBe(false);
    expect(String(response.body.sealError)).toContain("BOOKPI_MAINTENANCE_RECOVERY_REQUIRED");
    // Dirección segura: el apagado se aplica aunque la evidencia no entre.
    expect(ks.isHalted("PAYMENTS", NOW)).toBe(true);
  });

  it("rechaza una orden que no es ENGAGE en la puerta de apagado", async () => {
    const { handlers, command } = harness();
    const response = await call(handlers, ENGAGE_PATH, {
      command: command("alice", "RELEASE", "PAYMENTS"),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("BLACKOUT_EXPECTED_ENGAGE");
  });

  it("respeta el límite de peticiones", async () => {
    const { handlers, command } = harness({ denyRate: true });
    const response = await call(handlers, ENGAGE_PATH, {
      command: command("alice", "ENGAGE", "PAYMENTS"),
    });
    expect(response.body).toEqual({});
  });

  it("exige dos emisores para reactivar GLOBAL y no reactiva sin ellos", async () => {
    const { handlers, ks, command, sealed } = harness();
    await call(handlers, ENGAGE_PATH, { command: command("alice", "ENGAGE", "GLOBAL") });
    sealed.length = 0;
    const single = await call(handlers, RELEASE_PATH, {
      commands: [command("alice", "RELEASE", "GLOBAL")],
    });
    expect(single.status).toBe(400);
    expect(String(single.body.error)).toMatch(/2 distinct issuers/);
    expect(ks.isHalted("GLOBAL", NOW)).toBe(true);

    const dual = await call(handlers, RELEASE_PATH, {
      commands: [command("alice", "RELEASE", "GLOBAL"), command("bob", "RELEASE", "GLOBAL")],
    });
    expect(dual.status).toBe(200);
    expect(dual.body).toMatchObject({ success: true, capabilityChanged: true, sealed: true });
    expect(ks.isHalted("GLOBAL", NOW)).toBe(false);
    expect(sealed.map((e) => e.type)).toContain("BLACKOUT_RELEASE_REQUESTED");
  });

  it("informa el estado y la integridad constitucional sin efectos", async () => {
    const { handlers } = harness();
    const response = await call(handlers, STATUS_PATH);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.governableScopes).toContain("LLM_INFERENCE");
    const assessment = response.body.assessment as Record<string, unknown>;
    expect(assessment.posture).toBe("CLEAN");
  });

  it("la cadena rota se anuncia como CORRUPTED en el propio estado", async () => {
    const { handlers } = harness({ ledgerValid: false });
    const response = await call(handlers, STATUS_PATH);
    const assessment = response.body.assessment as Record<string, unknown>;
    expect(assessment.posture).toBe("CORRUPTED");
    expect(assessment.engagementSuggested).toBe(true);
  });
});

describe("routes/governance-blackout — ecuación de legitimidad en seco", () => {
  const fullAssurance = {
    requestId: "req-1",
    actorDid: "did:web:isabella.example",
    principalKind: "human",
    mandate: "mandato-2026-10",
    policyVersion: "v40",
    territory: "E06",
    explanation: "explicación",
    recoveryPlan: "plan",
    learningRecord: "record",
    economicJustification: "justificación",
    humanOverrideAvailable: true,
    governanceGranted: true,
    evidencePresent: true,
    tracePresent: true,
    executionAuthorized: true,
  };

  it("exige cada factor declarable: no acepta un assurance parcial", async () => {
    const { handlers } = harness();
    const missing = { ...fullAssurance };
    delete (missing as Record<string, unknown>).mandate;
    const response = await call(handlers, LEGITIMACY_PATH, {
      assurance: missing,
      evidenceRefs: ["e1"],
      auditTrail: ["a1"],
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("LEGITIMACY_FIELD_REQUIRED:mandate");
  });

  it("un booleano pasado como string se rechaza en vez de evaluarse como false", async () => {
    const { handlers } = harness();
    const response = await call(handlers, LEGITIMACY_PATH, {
      assurance: { ...fullAssurance, evidencePresent: "true" },
      evidenceRefs: ["e1"],
      auditTrail: ["a1"],
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("LEGITIMACY_FLAG_MUST_BE_BOOLEAN:evidencePresent");
  });

  it("evalúa la cuenta completa y declara que no autorizó ni ejecutó", async () => {
    const { handlers, sealed } = harness();
    const response = await call(handlers, LEGITIMACY_PATH, {
      assurance: fullAssurance,
      evidenceRefs: ["sha256:evidencia-1"],
      auditTrail: ["hitos-1"],
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
      approvalPerformed: false,
      evidenceSealed: true,
    });
    const evaluation = response.body.evaluation as { product: number; factors: Record<string, boolean> };
    expect(evaluation.product).toBe(1);
    expect(Object.values(evaluation.factors).every(Boolean)).toBe(true);
    expect(["ALLOW", "DENY"]).toContain(response.body.verdict);
    expect(sealed.map((e) => e.type)).toContain("LEGITIMACY_EVALUATED");
  });

  it("un factor en cero rompe el producto: el veredicto es DENY", async () => {
    const { handlers } = harness();
    const response = await call(handlers, LEGITIMACY_PATH, {
      assurance: { ...fullAssurance, humanOverrideAvailable: false },
      evidenceRefs: ["sha256:evidencia-1"],
      auditTrail: ["hitos-1"],
    });
    expect(response.status).toBe(200);
    expect(response.body.verdict).toBe("DENY");
    const evaluation = response.body.evaluation as { product: number; missingFactors: string[] };
    expect(evaluation.product).toBe(0);
    expect(evaluation.missingFactors).toContain("humanOversight");
  });

  it("acota las listas de evidencia: una request no amplía el trail sin límite", async () => {
    const { handlers } = harness();
    const response = await call(handlers, LEGITIMACY_PATH, {
      assurance: fullAssurance,
      evidenceRefs: "no-es-lista",
      auditTrail: [],
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("BLACKOUT_REF_LISTS_INVALID_OR_UNBOUNDED");
  });
});
