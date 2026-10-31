import { describe, expect, it } from "vitest";
import { InMemoryBookPiLedger } from "../../src/bookpi/ledger";
import { createAuditService } from "../../src/gameover/audit";
import { createUagpGateway } from "../../src/gameover/gateway";
import { createPassportAuthority } from "../../src/gameover/passport-authority";
import type { AgentIdentity, TrustMetrics, UagpRequestInput } from "../../src/gameover/types";

const agent: AgentIdentity = {
  id: "agent-1",
  name: "Builder",
  organization: "TAMV",
  owner: "edwin",
  capabilities: ["build"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const fullTrust: TrustMetrics = {
  integrity: 100,
  competence: 100,
  alignment: 100,
  transparency: 100,
  humanOversight: 100,
  incidentRecord: 100,
};

function harness() {
  const ledger = new InMemoryBookPiLedger();
  const passportAuthority = createPassportAuthority({
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    idFactory: () => "pp-certified",
  });
  const audit = createAuditService({ ledger });
  const gateway = createUagpGateway({ passportAuthority, audit });
  passportAuthority.issue({ agent: { ...agent, capabilities: ["build", "deploy"] }, issuer: "tamv", trustScore: 90, id: "pp-certified" });
  return { gateway, audit, passportAuthority };
}

function request(overrides: Partial<UagpRequestInput> = {}): UagpRequestInput {
  return {
    protocol: "UAGP-1",
    requestId: "req-1",
    passportId: "pp-certified",
    objectiveTitle: "build container image",
    actions: ["build"],
    criticality: "LOW",
    agent,
    trustMetrics: fullTrust,
    ...overrides,
  };
}

describe("GAME OVER UagpGateway", () => {
  it("accepts a low-risk, certified, evidencefree request", () => {
    const { gateway } = harness();
    const result = gateway.govern(request());
    expect(result.outcome).toBe("ACCEPT");
    expect(result.allowed).toBe(true);
    expect(result.passport.valid).toBe(true);
  });

  it("does not let the request disable approval for a medium-risk action", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ criticality: "MEDIUM", humanApprovalRequired: false }));
    expect(result.outcome).toBe("ESCALATE");
    expect(result.decision.humanApprovalRequired).toBe(true);
    expect(result.allowed).toBe(false);
  });

  it("does not let the request disable approval for a high-risk action", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ actions: ["deploy"], agent: { ...agent, capabilities: ["deploy"] }, humanApprovalRequired: false }));
    expect(result.outcome).toBe("ESCALATE");
    expect(result.decision.humanApprovalRequired).toBe(true);
  });

  it("rejects malformed runtime input without throwing", () => {
    const { gateway } = harness();
    const result = gateway.govern(null as unknown as UagpRequestInput);
    expect(result.outcome).toBe("REJECT");
    expect(result.validation.valid).toBe(false);
    expect(result.allowed).toBe(false);
  });

  it("caps request-supplied trust metrics at the issuer-assigned passport score", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ trustMetrics: fullTrust }));
    expect(result.trust.score).toBe(90);
    expect(result.decision.trustScore).toBe(90);
  });

  it("rejects an unsupported protocol", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ protocol: "UAGP-0" }));
    expect(result.outcome).toBe("REJECT");
    expect(result.decision.rationale).toContain("INVALID:PROTOCOL_UNSUPPORTED");
  });

  it("rejects a request that declares an action outside its capabilities", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ actions: ["deploy"] }));
    expect(result.outcome).toBe("REJECT");
    expect(result.decision.rationale).toContain("ACTION_CAPABILITY_NOT_DECLARED:deploy");
  });

  it("rejects a passport used by a different agent identity", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ agent: { ...agent, id: "attacker-agent" } }));
    expect(result.outcome).toBe("REJECT");
    expect(result.decision.rationale).toContain("PASSPORT_AGENT_OR_CAPABILITY_MISMATCH");
  });

  it("rejects a missing/unknown passport", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ passportId: "nope" }));
    expect(result.outcome).toBe("REJECT");
    expect(result.decision.rationale).toContain("PASSPORT:PASSPORT_NOT_FOUND");
  });

  it("escalates a high-risk action when no human approver is recorded", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ actions: ["deploy"], agent: { ...agent, capabilities: ["deploy"] } }));
    expect(result.outcome).toBe("ESCALATE");
    expect(result.decision.humanApprovalRequired).toBe(true);
    expect(result.allowed).toBe(false);
  });

  it("does not accept a self-asserted approver without an authenticated principal", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ actions: ["deploy"], agent: { ...agent, capabilities: ["deploy"] }, humanApprover: "edwin" }));
    expect(result.outcome).toBe("ESCALATE");
    expect(result.decision.rationale).toContain("HUMAN_AUTHENTICATED_PRINCIPAL_REQUIRED");
    expect(result.allowed).toBe(false);
  });

  it("accepts a high-risk action when a matching human approver is recorded", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ actions: ["deploy"], agent: { ...agent, capabilities: ["deploy"] }, humanApprover: "edwin" }), { authenticatedPrincipal: "edwin" });
    expect(result.outcome).toBe("ACCEPT");
    expect(result.decision.humanApprover).toBe("edwin");
  });

  it("escalates critical risk at high trust, then accepts with approval", () => {
    const { gateway } = harness();
    const escalated = gateway.govern(request({ criticality: "CRITICAL" }));
    expect(escalated.outcome).toBe("ESCALATE");
    const accepted = gateway.govern(request({ criticality: "CRITICAL", humanApprover: "edwin" }), { authenticatedPrincipal: "edwin" });
    expect(accepted.outcome).toBe("ACCEPT");
  });

  it("rejects an approver mismatch (fail-closed)", () => {
    const { gateway } = harness();
    const result = gateway.govern(request({ actions: ["deploy"], agent: { ...agent, capabilities: ["deploy"] }, humanApprover: "someone-else" }), { authenticatedPrincipal: "edwin" });
    expect(result.outcome).toBe("ESCALATE");
    expect(result.decision.rationale).toContain("HUMAN_APPROVER_MISMATCH");
  });

  it("records every decision to the audit ledger", () => {
    const { gateway, audit } = harness();
    gateway.govern(request());
    gateway.govern(request({ requestId: "req-2" }));
    expect(audit.list().length).toBe(2);
    expect(audit.list()[0]?.status).toBe("GOVERNANCE_ACCEPT");
    expect(audit.snapshot().valid).toBe(true);
  });
});
