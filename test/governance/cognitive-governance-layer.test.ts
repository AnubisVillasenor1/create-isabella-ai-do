import { describe, expect, it } from "vitest";
import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import {
  CognitiveGovernanceLayer,
  EvidenceValidator,
  PolicyEngine,
  QualityGatesEngine,
  type Evidence,
  type EvidenceMetadata,
  type GovernancePolicy,
  type PolicyRule,
  type Provenance,
  type ProvenanceLink,
} from "../../src/governance/cognitive/cognitive-governance";

const PUBLIC_METADATA: EvidenceMetadata = {
  tags: [],
  classification: "public",
  retention: 30,
  jurisdiction: ["MX"],
};

const CONTEXT = {
  requestId: "req-test",
  evaluator: "vitest",
  environment: "test",
  roles: ["analyst"],
  resource: "model:isabella",
  metadata: {},
};

function makeLink(
  from: string,
  to: string,
  transformation: string,
  timestamp: number
): ProvenanceLink {
  return {
    from,
    to,
    transformation,
    timestamp,
    hash: createHash("sha256")
      .update(`${from}:${to}:${transformation}:${timestamp}`)
      .digest("hex"),
  };
}

function provenance(chain: ProvenanceLink[] = [makeLink("origin", "evidence", "extract", 1)]): Provenance {
  return { source: "origin", author: "vitest", createdAt: 1, chain };
}

type EvidenceOverrides = Partial<Pick<Evidence, "id" | "provenance" | "integrity" | "metadata">>;

function evidenceFor(content: unknown, overrides: EvidenceOverrides = {}): Evidence {
  const hash = createHash("sha3-512").update(JSON.stringify(content)).digest("hex");
  return {
    id: overrides.id ?? "evidence-1",
    type: "document",
    content,
    provenance: overrides.provenance ?? provenance(),
    integrity: overrides.integrity ?? { algorithm: "sha3-512", hash },
    metadata: overrides.metadata ?? PUBLIC_METADATA,
  };
}

function withSignature(evidence: Evidence, privateKey: KeyObject, publicKey: string): Evidence {
  const signature = sign(
    null,
    Buffer.from(evidence.integrity.hash, "utf8"),
    privateKey
  ).toString("base64");
  return {
    ...evidence,
    integrity: { ...evidence.integrity, publicKey, signature },
  };
}

function testPolicy(
  condition: string,
  action: PolicyRule["action"],
  domain: GovernancePolicy["domain"] = "authority"
): GovernancePolicy {
  return {
    id: `policy-${domain}-${condition.slice(0, 12)}`,
    name: "Test policy",
    domain,
    type: "access",
    version: "1.0.0",
    rules: [
      {
        id: "rule-1",
        condition,
        action,
        message: "test rule matched",
        severity: "critical",
        metadata: {},
      },
    ],
    metadata: {
      description: "policy used by the test suite",
      tags: [],
      references: [],
      applicability: {
        domains: [domain],
        environments: ["*"],
        roles: ["*"],
        resources: ["*"],
      },
    },
    createdAt: 1,
    updatedAt: 1,
    createdBy: "vitest",
  };
}

describe("EvidenceValidator", () => {
  it("accepts signed, registered evidence with a valid provenance chain", async () => {
    const keys = generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    const validator = new EvidenceValidator();
    validator.registerTrustedKey("test-key", publicKey);

    const result = await validator.submitEvidence(
      withSignature(evidenceFor({ answer: 42 }), keys.privateKey, publicKey)
    );

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects signatures from keys that are not registered trust anchors", async () => {
    const keys = generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    const validator = new EvidenceValidator();

    const result = await validator.submitEvidence(
      withSignature(evidenceFor({ answer: 42 }), keys.privateKey, publicKey)
    );

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("SIGNATURE_VERIFICATION_FAILED");
  });

  it("detects tampered content and unsupported hash algorithms", async () => {
    const validator = new EvidenceValidator();
    const original = evidenceFor({ answer: 42 });

    const tampered = await validator.submitEvidence({ ...original, content: { answer: 43 } });
    expect(tampered.issues).toContain("INTEGRITY_CHECK_FAILED");

    const unsupported = await validator.submitEvidence(
      evidenceFor({ answer: 42 }, {
        integrity: {
          algorithm: "blake3",
          hash: createHash("sha256").update(JSON.stringify({ answer: 42 })).digest("hex"),
        },
      })
    );
    expect(unsupported.issues).toContain("INTEGRITY_CHECK_FAILED");
  });

  it("honors a sha256 integrity proof", async () => {
    const validator = new EvidenceValidator();
    const content = { answer: 42 };
    const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");

    const result = await validator.submitEvidence(
      evidenceFor(content, { integrity: { algorithm: "sha256", hash } })
    );

    expect(result.accepted).toBe(true);
  });

  it("rejects empty or discontinuous provenance chains", async () => {
    const validator = new EvidenceValidator();

    const empty = await validator.submitEvidence(
      evidenceFor({ answer: 42 }, { provenance: provenance([]) })
    );
    expect(empty.issues).toContain("PROVENANCE_CHAIN_INVALID");

    const discontinuous = await validator.submitEvidence(
      evidenceFor(
        { answer: 42 },
        {
          provenance: provenance([
            makeLink("origin", "intermediate", "extract", 1),
            makeLink("different", "evidence", "derive", 2),
          ]),
        }
      )
    );
    expect(discontinuous.issues).toContain("PROVENANCE_CHAIN_INVALID");
  });

  it("requires clearance and a signature for restricted evidence", async () => {
    const keys = generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    const validator = new EvidenceValidator();
    validator.registerTrustedKey("test-key", publicKey);
    const restricted: EvidenceMetadata = { ...PUBLIC_METADATA, classification: "restricted" };

    const unsigned = await validator.submitEvidence(
      evidenceFor({ secret: true }, { metadata: restricted })
    );
    expect(unsigned.issues).toContain("SIGNATURE_REQUIRED");
    expect(unsigned.issues).toContain("INSUFFICIENT_CLEARANCE");

    const signed = withSignature(
      evidenceFor({ secret: true }, { metadata: restricted }),
      keys.privateKey,
      publicKey
    );
    const insufficient = await validator.submitEvidence(signed, { clearance: "confidential" });
    expect(insufficient.issues).toContain("INSUFFICIENT_CLEARANCE");

    const cleared = await validator.submitEvidence(signed, { clearance: "restricted" });
    expect(cleared.accepted).toBe(true);
  });
});

describe("PolicyEngine rule DSL", () => {
  it("evaluates comparisons and boolean operators without executing code", async () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy("input.count >= 2 && input.mode === 'strict'", "deny"));

    const blocked = await engine.evaluate("authority", { count: 3, mode: "strict" }, CONTEXT);
    expect(blocked.status).toBe("denied");

    const allowed = await engine.evaluate("authority", { count: 1, mode: "strict" }, CONTEXT);
    expect(allowed.status).toBe("approved");
  });

  it("evaluates both sides of short-circuited boolean expressions", async () => {
    const engine = new PolicyEngine();
    engine.addPolicy(
      testPolicy("input.allowed === true || input.blocked === true", "deny")
    );

    const truthyLeft = await engine.evaluate(
      "authority",
      { allowed: true, blocked: false },
      CONTEXT
    );
    expect(truthyLeft.status).toBe("denied");

    const bothFalse = await engine.evaluate(
      "authority",
      { allowed: false, blocked: false },
      CONTEXT
    );
    expect(bothFalse.status).toBe("approved");

    const andEngine = new PolicyEngine();
    andEngine.addPolicy(
      testPolicy("input.blocked === true && input.allowed === true", "deny")
    );
    const falsyLeft = await andEngine.evaluate(
      "authority",
      { allowed: true, blocked: false },
      CONTEXT
    );
    expect(falsyLeft.status).toBe("approved");
  });

  it("treats missing paths as null so negated safeguards still fire", async () => {
    const engine = new PolicyEngine();
    engine.addPolicy(testPolicy("!input.evidenceProvided", "deny", "execution"));

    const decision = await engine.evaluate("execution", {}, CONTEXT);
    expect(decision.status).toBe("denied");
  });

  it("denies by default when no policy applies", async () => {
    const engine = new PolicyEngine();
    const decision = await engine.evaluate("authority", { requestsAuthority: false }, CONTEXT);

    expect(decision.status).toBe("denied");
    expect(decision.output.allowed).toBe(false);
  });

  it("does not evaluate arbitrary JavaScript from a rule condition", async () => {
    const globalRecord = globalThis as unknown as Record<string, unknown>;
    delete globalRecord.__isabella_eval_ran;

    const engine = new PolicyEngine();
    engine.addPolicy(
      testPolicy("(() => { globalThis.__isabella_eval_ran = true; return true; })()", "deny")
    );
    await engine.evaluate("authority", {}, CONTEXT);

    expect(globalRecord.__isabella_eval_ran).toBeUndefined();
  });
});

describe("default cognitive governance", () => {
  it("applies wildcard scopes and enforces capability != authority", async () => {
    const layer = new CognitiveGovernanceLayer();

    const denied = await layer.policyEngine.evaluate(
      "authority",
      { requestsAuthority: true, hasExplicitAuthority: false },
      CONTEXT
    );
    expect(denied.status).toBe("denied");

    const approved = await layer.policyEngine.evaluate(
      "authority",
      { requestsAuthority: false },
      CONTEXT
    );
    expect(approved.status).toBe("approved");
  });

  it("requires evidence before execution", async () => {
    const layer = new CognitiveGovernanceLayer();
    const decision = await layer.policyEngine.evaluate(
      "execution",
      { action: "execute", evidenceProvided: false },
      CONTEXT
    );

    expect(decision.status).toBe("denied");
  });

  it("flags a decision without an accountable party", async () => {
    const layer = new CognitiveGovernanceLayer();
    const evaluation = await layer.ethicsEngine.evaluate("subject-1", "decision", {}, "vitest");

    expect(evaluation.verdict).not.toBe("compliant");
  });
});

describe("QualityGatesEngine", () => {
  it("fails a gate that declares no checks", async () => {
    const gates = new QualityGatesEngine();
    gates.registerGate({
      id: "empty-gate",
      name: "Empty gate",
      domain: "evidence",
      checks: [],
      threshold: { minimumScore: 0.8, criticalChecks: [], warningThreshold: 0.9 },
      metadata: {},
    });

    const result = await gates.runGate(
      "empty-gate",
      { id: "artifact-1", type: "code", content: "", metadata: {} },
      { environment: "test", metadata: {} }
    );

    expect(result.status).toBe("failed");
    expect(result.score).toBe(0);
  });
});
