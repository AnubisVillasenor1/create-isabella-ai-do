import { describe, expect, it } from "vitest";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { QuorumSession, signVote, type QuorumProposal, type Voter } from "../../src/governance/quorum";
import { evaluateAutonomy } from "../../src/governance/autonomy";
import { assessRisk, riskScore, riskTier } from "../../src/governance/risk-score";

/** state: draft | engine-generated */
function setup(threshold = 3) {
  const feds = ["IDENTITY", "PATRIMONY", "TOURISM", "ECONOMY", "TWINS"];
  const keys: { publicKey: KeyObject; privateKey: KeyObject }[] = feds.map(() => generateKeyPairSync("ed25519"));
  const voters: Voter[] = feds.map((f, i) => ({ id: `v-${f}`, federation: f, publicKey: (keys[i] as { publicKey: KeyObject }).publicKey }));
  const proposal: QuorumProposal = {
    id: "p1", proposerId: "proposer", action: "deploy", payload: "payload-v1", threshold,
    createdAt: new Date("2026-10-13T00:00:00Z"), expiresAt: new Date("2026-10-14T00:00:00Z"),
  };
  const session = new QuorumSession(proposal, voters);
  const vote = (i: number, d: "APPROVE" | "REJECT" = "APPROVE") => signVote((keys[i] as { privateKey: KeyObject }).privateKey, proposal, (voters[i] as Voter).id, d);
  return { session, vote, proposal, voters, keys };
}
const T = new Date("2026-10-13T12:00:00Z");

describe("QuorumSession", () => {
  it("approves at M distinct federations", () => {
    const { session, vote } = setup(3);
    expect(session.cast(vote(0), T).status).toBe("PENDING");
    expect(session.cast(vote(1), T).status).toBe("PENDING");
    const t = session.cast(vote(2), T);
    expect(t.status).toBe("APPROVED");
    expect(t.approvingFederations).toEqual(["IDENTITY", "PATRIMONY", "TOURISM"]);
  });

  it("rejects once the threshold becomes unreachable", () => {
    const { session, vote } = setup(3);
    session.cast(vote(0, "REJECT"), T);
    expect(session.cast(vote(1, "REJECT"), T).status).toBe("PENDING");
    expect(session.cast(vote(2, "REJECT"), T).status).toBe("REJECTED");
  });

  it("a federation with several voters counts once", () => {
    const a = generateKeyPairSync("ed25519");
    const b = generateKeyPairSync("ed25519");
    const c = generateKeyPairSync("ed25519");
    const voters: Voter[] = [
      { id: "a1", federation: "F1", publicKey: a.publicKey },
      { id: "a2", federation: "F1", publicKey: b.publicKey },
      { id: "b1", federation: "F2", publicKey: c.publicKey },
    ];
    const proposal: QuorumProposal = { id: "p", proposerId: "x", action: "a", payload: "z", threshold: 2, createdAt: new Date(0), expiresAt: new Date(10_000) };
    const s = new QuorumSession(proposal, voters);
    s.cast(signVote(a.privateKey, proposal, "a1", "APPROVE"), new Date(1));
    expect(s.cast(signVote(b.privateKey, proposal, "a2", "APPROVE"), new Date(2)).status).toBe("PENDING");
    expect(s.cast(signVote(c.privateKey, proposal, "b1", "APPROVE"), new Date(3)).status).toBe("APPROVED");
  });

  it("rejects duplicates, forged, replayed-on-other-proposal, expired and outsiders", () => {
    const { session, vote, proposal, keys } = setup(3);
    session.cast(vote(0), T);
    expect(() => session.cast(vote(0), T)).toThrow("already voted");
    // voto firmado por otra clave
    const forged = signVote((keys[4] as { privateKey: import("node:crypto").KeyObject }).privateKey, proposal, "v-IDENTITY", "APPROVE");
    expect(() => setup(3).session.cast(forged, T)).toThrow("invalid vote signature");
    // decisión alterada tras firmar
    const v1 = vote(1, "REJECT");
    expect(() => session.cast({ ...v1, decision: "APPROVE" }, T)).toThrow("invalid vote signature");
    expect(() => session.cast({ ...vote(1), proposalId: "other" }, T)).toThrow("different proposal");
    expect(() => session.cast({ ...vote(1), voterId: "ghost" }, T)).toThrow("not in electorate");
    expect(() => session.cast(vote(1), new Date("2026-10-15T00:00:00Z"))).toThrow("expired");
  });

  it("enforces separation of duties and construction invariants", () => {
    const k = generateKeyPairSync("ed25519");
    const proposal: QuorumProposal = { id: "p", proposerId: "me", action: "a", payload: "z", threshold: 1, createdAt: new Date(0), expiresAt: new Date(10_000) };
    const s = new QuorumSession(proposal, [{ id: "me", federation: "F1", publicKey: k.publicKey }, { id: "o", federation: "F2", publicKey: k.publicKey }]);
    expect(() => s.cast(signVote(k.privateKey, proposal, "me", "APPROVE"), new Date(1))).toThrow("proposer cannot vote");
    expect(() => new QuorumSession({ ...proposal, threshold: 3 }, [{ id: "o", federation: "F2", publicKey: k.publicKey }])).toThrow("fewer distinct");
    expect(() => new QuorumSession({ ...proposal, threshold: 0 }, [])).toThrow();
    expect(() => new QuorumSession({ ...proposal, expiresAt: new Date(0) }, [])).toThrow();
  });
});

describe("evaluateAutonomy", () => {
  const base = { impact: "LOW", irreversible: false, humanConfirmed: false, dualControl: false, rollbackPlan: true } as const;
  it("A5 prohibited for HIGH/CRITICAL regardless of confirmations", () => {
    for (const impact of ["HIGH", "CRITICAL"] as const) {
      const d = evaluateAutonomy({ ...base, level: "A5", impact, humanConfirmed: true, dualControl: true });
      expect(d.allowed).toBe(false);
      expect(d.needsHuman).toBe(false);
      expect(d.reasons).toContain("A5_PROHIBITED_FOR_HIGH_IMPACT");
    }
  });
  it("A0/A1 never execute; A2 needs per-act approval; A4 ok on LOW", () => {
    expect(evaluateAutonomy({ ...base, level: "A0" }).allowed).toBe(false);
    expect(evaluateAutonomy({ ...base, level: "A1" }).allowed).toBe(false);
    const a2 = evaluateAutonomy({ ...base, level: "A2" });
    expect(a2.allowed).toBe(false);
    expect(a2.needsHuman).toBe(true);
    expect(evaluateAutonomy({ ...base, level: "A2", humanConfirmed: true }).allowed).toBe(true);
    expect(evaluateAutonomy({ ...base, level: "A4" }).allowed).toBe(true);
  });
  it("caps level by impact", () => {
    expect(evaluateAutonomy({ ...base, level: "A3", impact: "CRITICAL" }).reasons).toContain("LEVEL_EXCEEDS_CAP_A2_FOR_CRITICAL");
    expect(evaluateAutonomy({ ...base, level: "A5", impact: "NEGLIGIBLE" }).allowed).toBe(true);
  });
  it("irreversible acts need confirmation, dual control, time limit and rollback", () => {
    const req = { ...base, level: "A3", impact: "MEDIUM", irreversible: true } as const;
    const d = evaluateAutonomy(req);
    expect(d.allowed).toBe(false);
    expect(d.reasons).toEqual(expect.arrayContaining(["IRREVERSIBLE_REQUIRES_CONFIRMATION", "IRREVERSIBLE_REQUIRES_DUAL_CONTROL", "IRREVERSIBLE_REQUIRES_TIME_LIMIT"]));
    expect(evaluateAutonomy({ ...req, humanConfirmed: true, dualControl: true, timeLimitMs: 60_000 }).allowed).toBe(true);
    expect(evaluateAutonomy({ ...req, humanConfirmed: true, dualControl: true, timeLimitMs: 60_000, rollbackPlan: false }).allowed).toBe(false);
    expect(evaluateAutonomy({ ...req, humanConfirmed: true, dualControl: true, timeLimitMs: Number.NaN }).allowed).toBe(false);
  });
});

describe("risk score", () => {
  it("weights sum to 1 and compute R exactly", () => {
    expect(riskScore({ C: 1, S: 1, F: 1, P: 1, U: 1 })).toBe(1);
    expect(riskScore({ C: 0, S: 0, F: 0, P: 0, U: 0 })).toBe(0);
    expect(riskScore({ C: 1, S: 0, F: 0, P: 0, U: 0 })).toBe(0.25);
    expect(riskScore({ C: 0.5, S: 0.5, F: 0.5, P: 0.5, U: 0.5 })).toBe(0.5);
  });
  it("tier boundaries follow the spec (0.35 / 0.65 / 0.85)", () => {
    expect(riskTier(0.3499)).toBe("OBSERVE");
    expect(riskTier(0.35)).toBe("SELECTIVE");
    expect(riskTier(0.6499)).toBe("SELECTIVE");
    expect(riskTier(0.65)).toBe("RELEVANT_HEADS");
    expect(riskTier(0.8499)).toBe("RELEVANT_HEADS");
    expect(riskTier(0.85)).toBe("EPIC");
  });
  it("EPIC requires human approval; invalid inputs fail closed", () => {
    expect(assessRisk({ C: 1, S: 1, F: 1, P: 0.5, U: 0.5 }).requiresHumanApproval).toBe(true);
    expect(assessRisk({ C: 0.1, S: 0.1, F: 0.1, P: 0.1, U: 0.1 }).requiresHumanApproval).toBe(false);
    expect(() => riskScore({ C: 2, S: 0, F: 0, P: 0, U: 0 })).toThrow();
    expect(() => riskScore({ C: Number.NaN, S: 0, F: 0, P: 0, U: 0 })).toThrow();
    expect(() => riskScore({ C: -0.1, S: 0, F: 0, P: 0, U: 0 })).toThrow();
    expect(() => riskTier(1.2)).toThrow();
  });
});
