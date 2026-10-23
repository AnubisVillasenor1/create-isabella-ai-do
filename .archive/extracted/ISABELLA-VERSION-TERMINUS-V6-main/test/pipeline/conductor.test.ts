import { describe, expect, it } from "vitest";
import { createJsonlStorage } from "../../src/bookpi/storage-jsonl";
import { createCapabilityGate } from "../../src/crown/capability";
import { conductPipeline } from "../../src/pipeline/conductor";
import { createConsentRegistry } from "../../src/identity/consent";
import { createPrincipal } from "../../src/identity/principal";
import { issueHumanApproval } from "../../src/identity/approval";
import { generateControls } from "../../src/evolution/catalog";

const MEMORIA = "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS";
const BORRAR = "T.TWINS.E08_DATA.remove.permanent_delete.v1.0.0.CRITICAL.CONSTITUTIONAL";
const SNAPSHOT = generateControls().filter((c) => c.domain === "durable_memory");

async function storageFor(label: string) {
  return await createJsonlStorage(
    `${process.env.TEMP ?? "."}/opencode/conductor-${label}-${crypto.randomUUID()}.jsonl`,
  );
}

function gateWith() {
  return createCapabilityGate([
    {
      methodId: MEMORIA,
      owner: "isabella",
      allowedRoles: ["operator"],
      riskTier: "LOW",
      governanceTier: "AUTONOMOUS",
      humanApprovalRequired: false,
    },
  ]);
}

function consentWithMemory(principalId: string) {
  const registry = createConsentRegistry();
  registry.register({
    principalId,
    purpose: "memoria",
    scope: ["recall"],
    grantedAt: new Date().toISOString(),
    grantedBy: "human",
  });
  return registry;
}

describe("pipeline/conductor", () => {
  it("recorre las 6 etapas y sella ledger para una solicitud válida", async () => {
    const storage = await storageFor("ok");
    const result = await conductPipeline({
      principal: createPrincipal({ id: "h1", kind: "human", tenantId: "t1", roles: ["operator"] }),
      input: "elabora el resumen de la última fase",
      methodId: MEMORIA,
      gate: gateWith(),
      bookpi: storage,
      controlsSnapshot: SNAPSHOT,
      consent: consentWithMemory("h1"),
    });

    expect(result.passed).toBe(true);
    expect(result.verdicts).toHaveLength(6);
    expect(result.ledger).toBeDefined();
    expect(result.verdicts.at(-1)).toMatchObject({ stage: "BOOKPI_IGDS", passed: true });
    expect((await storage.verifyChain()).valid).toBe(true);
  });

  it("bloquea en INGRESS con método inválido", async () => {
    const result = await conductPipeline({
      principal: createPrincipal({ id: "h1", kind: "human", roles: ["operator"] }),
      input: "hola",
      methodId: "NO.VÁLIDO",
      gate: gateWith(),
      bookpi: await storageFor("bad"),
      controlsSnapshot: generateControls(),
    });
    expect(result.passed).toBe(false);
    expect(result.verdicts.find((v) => v.stage === "ARGUS_CROWN")?.passed).toBe(false);
    expect(result.ledger).toBeUndefined();
  });

  it("exige consentimiento de memoria en SOPHIA_ERI", async () => {
    const consent = createConsentRegistry(); // vacío: sin consentimiento
    const result = await conductPipeline({
      principal: createPrincipal({ id: "h1", kind: "human", roles: ["operator"] }),
      input: "consulta mi historial",
      methodId: MEMORIA,
      gate: gateWith(),
      bookpi: await storageFor("consent"),
      controlsSnapshot: SNAPSHOT,
      consent,
    });
    expect(result.verdicts.find((v) => v.stage === "SOPHIA_ERI")?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("rechaza invocación crítica sin aprobación humana", async () => {
    const storage = await storageFor("critical");
    const result = await conductPipeline({
      principal: createPrincipal({ id: "h1", kind: "human", roles: ["operator"] }),
      input: "borra todo",
      methodId: BORRAR,
      gate: createCapabilityGate([
        {
          methodId: BORRAR,
          owner: "isabella",
          allowedRoles: ["operator"],
          riskTier: "CRITICAL",
          governanceTier: "CONSTITUTIONAL",
          humanApprovalRequired: true,
        },
      ]),
      bookpi: storage,
      controlsSnapshot: SNAPSHOT,
    });
    expect(result.verdicts.find((v) => v.stage === "ARGUS_CROWN")?.passed).toBe(false);
    expect(result.passed).toBe(false);
    expect((await storage.listEvents()).length).toBe(0);
  });

  it("admite invocación crítica con aprobación humana registrada", async () => {
    const human = createPrincipal({ id: "adm", kind: "human", roles: ["admin"] });
    const approval = issueHumanApproval(
      human,
      { methodId: BORRAR, action: "execute", resource: BORRAR, principalId: human.id },
      "ALLOW",
    );
    const storage = await storageFor("approved");

    const gate = createCapabilityGate([
      {
        methodId: BORRAR,
        owner: "isabella",
        allowedRoles: ["admin"],
        riskTier: "CRITICAL",
        governanceTier: "CONSTITUTIONAL",
        humanApprovalRequired: true,
      },
    ]);

    const result = await conductPipeline({
      principal: human,
      input: "ejecuta la limpieza aprobada",
      methodId: BORRAR,
      gate,
      bookpi: storage,
      approval,
      controlsSnapshot: SNAPSHOT,
    });
    expect(result.passed).toBe(true);
    expect(result.ledger).toBeDefined();
  });
});