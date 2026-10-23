import { describe, expect, it } from "vitest";
import {
  ISA_API_STAGES,
  TAP_ACT_TYPES,
  buildTapAct,
  validateTapAct,
  evaluateIsaPipeline,
  requiresHumanReview,
  HIGH_IMPACT_TRIGGERS,
} from "../../src/ingress";

describe("ISA-API v40 pipeline", () => {
  it("declares 12 canonical stages", () => {
    expect(ISA_API_STAGES).toHaveLength(12);
  });

  it("fails closed when required stages are not satisfied", () => {
    expect(evaluateIsaPipeline({}).passed).toBe(false);
    const ok = evaluateIsaPipeline({
      normalization: true,
      correlation: true,
      authentication: true,
      tenant_resolution: true,
      schema_validation: true,
      authorization: true,
      crown: true,
    });
    expect(ok.passed).toBe(true);
  });
});

describe("TAP v1.0 canonical acts", () => {
  it("declares 4 canonical act types", () => {
    expect(TAP_ACT_TYPES).toHaveLength(4);
  });

  it("builds an act with all mandatory controls", () => {
    const act = buildTapAct({
      actType: "AI.QUERY",
      issuer: "did:tamv:example",
      subject: "isabella-core-node-01",
      intent: "analyze",
      scope: "read:audit",
      policyVersion: "KEC-v2026.09",
      payload: { a: 1 },
    });
    expect(act.actId.startsWith("urn:uuid:")).toBe(true);
    expect(act.inputCommitment.startsWith("sha256:")).toBe(true);
    expect(act.nonce).toBeTruthy();
    expect(act.traceId).toBeTruthy();
  });

  it("requires human review for high-impact acts and marks signature unsatisfied", () => {
    expect(requiresHumanReview(["sensitive_data"])).toBe(true);
    expect(HIGH_IMPACT_TRIGGERS.length).toBeGreaterThan(5);

    const act = buildTapAct(
      {
        actType: "AI.EXEC",
        issuer: "did:tamv:example",
        subject: "node",
        intent: "exec",
        scope: "execute:tools",
        policyVersion: "KEC-v2026.09",
        payload: null,
      },
      ["untrusted_code_execution"],
    );
    const validation = validateTapAct(act);
    expect(act.humanReview.required).toBe(true);
    expect(act.humanReview.status).toBe("pending");
    expect(validation.requiresHumanApproval).toBe(true);
    expect(validation.valid).toBe(false);
    expect(validation.signatureSatisfied).toBe(false);
  });

  it("accepts a signed act with approved human review", () => {
    const act = buildTapAct({
      actType: "GOV.VOTE",
      issuer: "did:tamv:example",
      subject: "node",
      intent: "vote",
      scope: "write:governance",
      policyVersion: "KEC-v2026.09",
      payload: { vote: "yes" },
      humanReview: { required: true, status: "approved" },
      signature: { algorithm: "ML-DSA-65", keyId: "did:tamv:example#key-1", proofValue: "sig" },
    });
    const validation = validateTapAct(act);
    expect(validation.valid).toBe(true);
    expect(validation.requiresHumanApproval).toBe(false);
  });
});
