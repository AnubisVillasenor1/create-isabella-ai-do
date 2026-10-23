import { describe, expect, it } from "vitest";
import { evaluateMandate, TerminusRuntime, type TerminusMandate, type TerminusPolicy } from "../../src/terminus/mandate";
import type { BookPiEventRecord, BookPiEventSeed, BookPiStorage } from "../../src/bookpi/types";

const now = Date.parse("2026-10-12T12:00:00.000Z");
const policy: TerminusPolicy = {
  version: "v1", maxTtlMs: 3_600_000, maxExecutionsPerMandate: 5, maxEvidenceReferences: 4, escalationRiskThreshold: 80,
  riskLimits: { legal: 50, financial: 50, operational: 60, reputational: 50, cybersecurity: 50, privacy: 90, humanSafety: 40, systemic: 40 },
  budgetLimits: { latencyMs: 1500, toolCalls: 10, bytes: 1_000_000, energyMilliJoules: 50_000 },
  allowedOperationsByCapability: { "database.read": ["SELECT"] }, hardDeniedCapabilities: ["payment.execute"],
  hardDeniedOperations: ["DROP", "DELETE"],
};
function makeMandate(): TerminusMandate {
  return {
    id: "mandate-1", tenantId: "tenant-1", subjectId: "requester", identityAuthenticated: true,
    capability: "database.read", resources: ["records:tenant-1"], purpose: "Validate consistency", operations: ["SELECT"],
    evidence: [{ id: "evidence-1", sha256: "a".repeat(64), source: "control-plane" }],
    risk: { legal: 10, financial: 5, operational: 20, reputational: 10, cybersecurity: 15, privacy: 20, humanSafety: 0, systemic: 5 },
    authorityChain: { requester: "requester", technicalReviewer: "tech", legalReviewer: "legal", securityReviewer: "security",
      approver: "approver", executor: "executor", supervisor: "supervisor", auditor: "auditor" },
    policyVersion: "v1", issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60_000).toISOString(),
    maxExecutions: 2, remainingExecutions: 2, budget: { latencyMs: 500, toolCalls: 2, bytes: 4096, energyMilliJoules: 1000 },
  };
}
function fakeLedger(onAppend?: (seed: BookPiEventSeed) => void): BookPiStorage {
  let sequence = 0;
  const events: BookPiEventRecord[] = [];
  return {
    getLastEvent: async () => events.at(-1) ?? null,
    appendEvent: async (seed) => {
      sequence += 1;
      onAppend?.(seed);
      const record = {
        ...seed, id: "bookpi-" + sequence, type: seed.header.type, sequence,
        prevHash: events.at(-1)?.hash ?? "0".repeat(64), timestamp: new Date(now).toISOString(),
        integrity: "test-integrity", hash: sequence.toString(16).padStart(64, "0"), canonical: JSON.stringify(seed),
      } as BookPiEventRecord;
      events.push(record);
      return record;
    },
    listEvents: async () => [...events],
    verifyChain: async () => ({ valid: true, count: events.length, failures: [] }),
  };
}
function mandateWithApproval(): TerminusMandate {
  const mandate = makeMandate();
  mandate.risk.privacy = 85;
  mandate.humanApproval = {
    approverId: mandate.authorityChain.approver,
    evidenceId: mandate.evidence[0]!.id,
    approvedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
  };
  return mandate;
}

describe("Terminus method mandate", () => {
  it("allows bounded scoped requests with distinct authority actors", () => {
    expect(evaluateMandate(makeMandate(), policy, now).verdict).toBe("ALLOW");
  });
  it("denies expired mandates", () => {
    const mandate = makeMandate();
    mandate.expiresAt = new Date(now - 1).toISOString();
    expect(evaluateMandate(mandate, policy, now).reasonCodes).toContain("MANDATE_EXPIRED_OR_INVALID");
  });
  it("denies duplicated authority actors", () => {
    const mandate = makeMandate();
    mandate.authorityChain.auditor = mandate.authorityChain.requester;
    expect(evaluateMandate(mandate, policy, now).reasonCodes).toContain("AUTHORITY_SEPARATION_VIOLATION");
  });
  it("escalates high risk without a linked human approval", () => {
    const mandate = makeMandate();
    mandate.risk.privacy = 85;
    const result = evaluateMandate(mandate, policy, now);
    expect(result.verdict).toBe("ESCALATE");
    expect(result.dossierHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("denies forbidden operations independently of the capability name", () => {
    const mandate = makeMandate();
    mandate.operations = ["DELETE"];
    expect(evaluateMandate(mandate, policy, now).reasonCodes).toContain("OPERATION_NOT_ALLOWED");
  });

  it("does not reserve execution if a high-risk human approval proof fails verification", async () => {
    let reservations = 0;
    let auditEvents = 0;
    const runtime = new TerminusRuntime({
      policy,
      ledger: fakeLedger(() => { auditEvents += 1; }),
      verifyIdentity: async () => true,
      verifyHumanApproval: async () => false,
      verifyEvidence: async () => true,
      executionCounter: { consumeOne: async () => { reservations += 1; return true; } },
      clock: () => now,
    });
    const result = await runtime.authorize(mandateWithApproval());
    expect(result.verdict).toBe("DENY");
    expect(result.reasonCodes).toContain("HUMAN_APPROVAL_PROOF_INVALID");
    expect(reservations).toBe(0);
    expect(auditEvents).toBe(1);
  });

  it("authorizes a high-risk mandate only after all proofs and BookPI succeed", async () => {
    let reservations = 0;
    let auditEvents = 0;
    const runtime = new TerminusRuntime({
      policy,
      ledger: fakeLedger(() => { auditEvents += 1; }),
      verifyIdentity: async () => true,
      verifyHumanApproval: async () => true,
      verifyEvidence: async () => true,
      executionCounter: { consumeOne: async () => { reservations += 1; return true; } },
      clock: () => now,
    });
    const result = await runtime.authorize(mandateWithApproval());
    expect(result.verdict).toBe("ALLOW");
    expect(reservations).toBe(1);
    expect(auditEvents).toBe(1);
  });
});
