import { describe, expect, it } from "vitest";
import { computeTrustMesh, type TrustAttestation } from "../../src/omega/trust";

function attestation(
  subject: string,
  weight: number,
  verified: boolean,
  issuer = "issuer",
  claim = "claim",
): TrustAttestation {
  return { subject, issuer, claim, weight, verified };
}

describe("Ω∞-19 Trust Computing Mesh", () => {
  it("un sujeto totalmente verificado obtiene score 1 y grado high", () => {
    const { nodes } = computeTrustMesh([
      attestation("alice", 0.4, true),
      attestation("alice", 0.6, true),
    ]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.score).toBe(1);
    expect(nodes[0]?.grade).toBe("high");
  });

  it("un sujeto parcialmente verificado obtiene el ratio de peso verificado", () => {
    const { nodes } = computeTrustMesh([
      attestation("bob", 0.3, true),
      attestation("bob", 0.7, false),
    ]);
    expect(nodes[0]?.score).toBe(0.3);
    expect(nodes[0]?.grade).toBe("low");
  });

  it("un sujeto sin atestaciones verificadas obtiene score 0 y grado untrusted", () => {
    const { nodes } = computeTrustMesh([
      attestation("carol", 0.2, false),
      attestation("carol", 0.8, false),
    ]);
    expect(nodes[0]?.score).toBe(0);
    expect(nodes[0]?.grade).toBe("untrusted");
  });

  it("peso total cero produce score 0", () => {
    const { nodes } = computeTrustMesh([
      attestation("dave", 0, true),
      attestation("dave", 0, false),
    ]);
    expect(nodes[0]?.score).toBe(0);
    expect(nodes[0]?.grade).toBe("untrusted");
    expect(nodes[0]?.attestationCount).toBe(2);
  });

  it("un peso fuera de rango lanza TRUST_WEIGHT_OUT_OF_RANGE", () => {
    expect(() => computeTrustMesh([attestation("eve", 1.5, true)])).toThrow(
      "TRUST_WEIGHT_OUT_OF_RANGE",
    );
    expect(() => computeTrustMesh([attestation("eve", -0.1, true)])).toThrow(
      "TRUST_WEIGHT_OUT_OF_RANGE",
    );
    expect(() => computeTrustMesh([attestation("eve", Number.NaN, true)])).toThrow(
      "TRUST_WEIGHT_OUT_OF_RANGE",
    );
  });

  it("ordena los nodos por sujeto ascendente con múltiples sujetos", () => {
    const { nodes } = computeTrustMesh([
      attestation("zeta", 1, true),
      attestation("alpha", 1, true),
      attestation("mike", 1, true),
    ]);
    expect(nodes.map((n) => n.subject)).toEqual(["alpha", "mike", "zeta"]);
  });

  it("cuenta todas las atestaciones del sujeto, verificadas o no", () => {
    const { nodes } = computeTrustMesh([
      attestation("nina", 0.5, true),
      attestation("nina", 0.25, false),
      attestation("nina", 0.25, false),
    ]);
    expect(nodes[0]?.attestationCount).toBe(3);
    expect(nodes[0]?.score).toBe(0.5);
    expect(nodes[0]?.grade).toBe("low");
  });
});
