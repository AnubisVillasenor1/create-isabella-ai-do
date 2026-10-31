import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { parseMethodId } from "../../src/authority/method-id";
import { REINA_METHOD_ID, ReinaGovernor, ReinaIdempotencyConflictError, type ReinaRequest } from "../../src/reina/governor";
import { createReinaRuntime } from "../../src/reina/runtime";
import { KillSwitch, signKillCommand } from "../../src/security/kill-switch";
import { verifyConsistency, verifyInclusion } from "../../src/bookpi/transparency";

/** state: draft | engine-generated */
const NOW = Date.parse("2026-10-13T12:00:00Z");
const low = { C: 0.1, S: 0.1, F: 0.1, P: 0.1, U: 0.1 };
const req = (over: Partial<ReinaRequest> = {}): ReinaRequest => ({
  requestId: "r-1", actor: "anubis", action: "publish_notice", scope: "federation:TOURISM", impact: "LOW",
  autonomyLevel: "A4", irreversible: false, humanConfirmed: false, dualControl: false, rollbackPlan: true, risk: low, ...over,
});
const gov = (envFlag = false) => new ReinaGovernor({ killSwitch: new KillSwitch({ authorizedKeys: new Map(), envFlag }), now: () => NOW });

describe("ReinaGovernor", () => {
  it("method id is canonical", () => {
    expect(() => parseMethodId(REINA_METHOD_ID)).not.toThrow();
  });

  it("PERMIT for low-risk bounded action, sealed in a verifiable log", async () => {
    const g = gov();
    const d = await g.adjudicate(req());
    expect(d.verdict).toBe("PERMIT");
    expect(d.riskTier).toBe("OBSERVE");
    expect(verifyInclusion({ leafHash: d.evidence.leafHash, index: d.evidence.logIndex, treeSize: d.evidence.treeSize, proof: g.log.inclusionProof(d.evidence.logIndex), rootHash: d.evidence.rootHash })).toBe(true);
  });

  it("log is append-only and consistent across decisions", async () => {
    const g = gov();
    const d1 = await g.adjudicate(req({ requestId: "a" }));
    await g.adjudicate(req({ requestId: "b" }));
    const d3 = await g.adjudicate(req({ requestId: "c", autonomyLevel: "A1" }));
    expect(verifyConsistency({ firstSize: d1.evidence.treeSize, secondSize: d3.evidence.treeSize, firstRoot: d1.evidence.rootHash, secondRoot: d3.evidence.rootHash, proof: g.log.consistencyProof(d1.evidence.treeSize, d3.evidence.treeSize) })).toBe(true);
  });

  it("evidence stores digests, not actor/action in clear", async () => {
    const g = gov();
    await g.adjudicate(req({ actor: "persona-secreta", action: "accion-secreta" }));
    const sink: string[] = [];
    sink.push(JSON.stringify(g.status()));
    expect(sink[0]).not.toContain("persona-secreta");
  });

  it("HALTED when the kill switch env flag is on", async () => {
    expect((await gov(true).adjudicate(req())).verdict).toBe("HALTED");
  });

  it("HALTED after a signed ENGAGE on the scope", async () => {
    const k = generateKeyPairSync("ed25519");
    const ks = new KillSwitch({ authorizedKeys: new Map([["op", k.publicKey]]) });
    const g = new ReinaGovernor({ killSwitch: ks, now: () => NOW });
    ks.engage(signKillCommand(k.privateKey, { action: "ENGAGE", scope: "federation:TOURISM", issuer: "op", issuedAt: new Date(NOW).toISOString(), nonce: "nonce-12345678", reason: "drill" }), NOW);
    expect((await g.adjudicate(req())).verdict).toBe("HALTED");
    expect((await g.adjudicate(req({ scope: "federation:ECONOMY" }))).verdict).toBe("PERMIT");
  });

  it("EPIC risk blocks until verified human approval", async () => {
    const hot = { C: 1, S: 1, F: 1, P: 0.8, U: 0.8 };
    const g = gov();
    const blocked = await g.adjudicate(req({ risk: hot, impact: "MEDIUM" }));
    expect(blocked.verdict).toBe("REQUIRE_HUMAN_APPROVAL");
    expect(blocked.riskTier).toBe("EPIC");
    // aprobación humana verificada pero sin quórum: sigue exigiendo quórum
    const needsQuorum = await g.adjudicate(req({ risk: hot, impact: "MEDIUM", humanApprovalVerified: true }));
    expect(needsQuorum.verdict).toBe("REQUIRE_QUORUM");
    const ok = await g.adjudicate(req({ risk: hot, impact: "MEDIUM", humanApprovalVerified: true, quorum: { status: "APPROVED", approvals: 3, rejections: 0, approvingFederations: ["A", "B", "C"], threshold: 3, electorate: 5 } }));
    expect(ok.verdict).toBe("PERMIT");
    const rejected = await g.adjudicate(req({ risk: hot, impact: "MEDIUM", humanApprovalVerified: true, quorum: { status: "REJECTED", approvals: 0, rejections: 3, approvingFederations: [], threshold: 3, electorate: 5 } }));
    expect(rejected.verdict).toBe("DENY");
    expect(rejected.reasons).toContain("QUORUM_REJECTED");
  });

  it("autonomy rules: A5 on HIGH is denied, A2 asks for confirmation", async () => {
    const g = gov();
    expect((await g.adjudicate(req({ autonomyLevel: "A5", impact: "HIGH" }))).verdict).toBe("DENY");
    expect((await g.adjudicate(req({ autonomyLevel: "A2" }))).verdict).toBe("REQUIRE_CONFIRMATION");
    expect((await g.adjudicate(req({ autonomyLevel: "A2", humanConfirmed: true }))).verdict).toBe("PERMIT");
  });

  it("CRITICAL impact needs quorum even at low numeric risk", async () => {
    const g = gov();
    expect((await g.adjudicate(req({ impact: "CRITICAL", autonomyLevel: "A2", humanConfirmed: true }))).verdict).toBe("REQUIRE_QUORUM");
  });

  it("invalid input fails closed and is still logged", async () => {
    const g = gov();
    const before = g.log.size;
    expect((await g.adjudicate(req({ actor: " " }))).verdict).toBe("DENY");
    expect((await g.adjudicate(req({ risk: { ...low, C: 5 } }))).reasons).toContain("INVALID_RISK_INPUTS");
    expect((await g.adjudicate(req({ scope: "bad scope" }))).reasons).toContain("INVALID_SCOPE");
    expect(g.log.size).toBe(before + 3);
  });

  it("idempotency: same key replays the sealed decision; different body conflicts", async () => {
    const g = gov();
    const a = await g.adjudicate(req({ idempotencyKey: "idem-key-0001" }));
    const b = await g.adjudicate(req({ idempotencyKey: "idem-key-0001" }));
    expect(b).toEqual(a);
    expect(g.log.size).toBe(1);
    await expect(g.adjudicate(req({ idempotencyKey: "idem-key-0001", action: "otra" }))).rejects.toThrow(ReinaIdempotencyConflictError);
    expect((await g.adjudicate(req({ idempotencyKey: "x" }))).reasons).toContain("INVALID_IDEMPOTENCY_KEY");
  });

  it("evidence sink failure never changes the verdict", async () => {
    const g = new ReinaGovernor({ killSwitch: new KillSwitch({ authorizedKeys: new Map() }), now: () => NOW, evidenceSink: () => { throw new Error("sink down"); } });
    expect((await g.adjudicate(req())).verdict).toBe("PERMIT");
  });

  it("status is honest and runtime honors ISA_KILL_SWITCH", async () => {
    const s = gov().status();
    expect(s.disclaimers.join(" ")).toContain("No ejecuta acciones");
    expect(s.state).toBe("draft | engine-generated");
    expect((await createReinaRuntime({ ISA_KILL_SWITCH: "1" }).adjudicate(req())).verdict).toBe("HALTED");
    expect((await createReinaRuntime({}).adjudicate(req())).verdict).toBe("PERMIT");
  });
});
