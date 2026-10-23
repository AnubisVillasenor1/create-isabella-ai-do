// Ω∞-19 Trust Computing Mesh (state: draft | engine-generated).
// Malla de cómputo de confianza agregada por sujeto: sólo las atestaciones
// verificadas aportan al puntaje. Fail-closed: lo no verificado no cuenta.
// Determinista y puro; no concede autoridad ni ejecución.

export interface TrustAttestation {
  subject: string;
  issuer: string;
  claim: string;
  weight: number;
  verified: boolean;
}

export interface TrustNode {
  subject: string;
  score: number;
  grade: "high" | "medium" | "low" | "untrusted";
  attestationCount: number;
}

interface Accumulator {
  totalWeight: number;
  verifiedWeight: number;
  count: number;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function gradeFor(score: number): TrustNode["grade"] {
  if (score >= 0.9) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.3) return "low";
  return "untrusted";
}

export function computeTrustMesh(attestations: TrustAttestation[]): { nodes: TrustNode[] } {
  const bySubject = new Map<string, Accumulator>();

  for (const attestation of attestations) {
    const weight = attestation.weight;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new Error("TRUST_WEIGHT_OUT_OF_RANGE");
    }
    const current = bySubject.get(attestation.subject) ?? {
      totalWeight: 0,
      verifiedWeight: 0,
      count: 0,
    };
    current.totalWeight += weight;
    if (attestation.verified) {
      current.verifiedWeight += weight;
    }
    current.count += 1;
    bySubject.set(attestation.subject, current);
  }

  const nodes: TrustNode[] = [];
  for (const [subject, acc] of bySubject) {
    const score = acc.totalWeight === 0 ? 0 : round4(acc.verifiedWeight / acc.totalWeight);
    nodes.push({
      subject,
      score,
      grade: gradeFor(score),
      attestationCount: acc.count,
    });
  }

  nodes.sort((a, b) => (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0));

  return { nodes };
}
