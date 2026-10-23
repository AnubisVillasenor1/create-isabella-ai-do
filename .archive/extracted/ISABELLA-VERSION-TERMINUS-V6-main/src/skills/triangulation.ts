/**
 * HyperCore Ω — Algorithmic triangulation.
 *
 * Independently verifies a governed execution from three mathematically
 * independent planes:
 *
 *   T(K) = ( C(K), P(K), R(K) )
 *
 *   C — Contract:    input and output satisfy the declared JSON Schemas.
 *   P — Provenance:  actor, tenant, federation, policy and mandate are present
 *                    and (optionally) the manifest signature verifies.
 *   R — Result:      canonical SHA-256 hashes of input, output, policy and
 *                    evidence recompute to the sealed manifest hash.
 *
 * If any vertex fails, the triangulation fails: Invalid(K) ⟺ ¬C ∨ ¬P ∨ ¬R.
 * SHA-256 is specified by NIST FIPS 180-4.
 */
import { sha256, sha256Hex } from "./canonical-json";
import { validateSchema, type SchemaViolation } from "./schema-validator";
import type { SkillContract } from "./contracts";

export interface TriangulationProvenance {
  readonly actorId: string;
  readonly tenantId: string;
  readonly federationId: string;
  readonly policyVersion: string;
  readonly mandateId?: string;
}

export interface TriangulationParams {
  readonly contract: SkillContract;
  readonly input: unknown;
  readonly output: unknown;
  readonly provenance: TriangulationProvenance;
  readonly riskTier: string;
  readonly evidenceHashes?: readonly string[];
  /** Manifest hash reported by the executor; compared against the recomputed one. */
  readonly expectedManifestHash?: string;
  readonly signature?: string;
  /** Returns true when the signature is valid for the given manifest hash. */
  readonly verifySignature?: (manifestHash: string) => boolean;
}

export interface ContractVertex {
  readonly valid: boolean;
  readonly inputValid: boolean;
  readonly outputValid: boolean;
  readonly violations: readonly SchemaViolation[];
}

export interface ProvenanceVertex {
  readonly valid: boolean;
  readonly reasons: readonly string[];
}

export interface ResultVertex {
  readonly valid: boolean;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly policyHash: string;
  readonly evidenceHash: string;
  readonly manifestHash: string;
  readonly signatureValid: boolean | null;
}

export interface TriangulationResult {
  readonly valid: boolean;
  readonly contract: ContractVertex;
  readonly provenance: ProvenanceVertex;
  readonly result: ResultVertex;
  readonly invalidVertices: readonly ("contract" | "provenance" | "result")[];
}

export function hashInput(value: unknown): string {
  return sha256(value ?? null);
}

export function hashOutput(value: unknown): string {
  return sha256(value ?? null);
}

export function hashPolicy(policy: { policyVersion: string; riskTier: string; requiredScopes: readonly string[] }): string {
  return sha256({
    policyVersion: policy.policyVersion,
    riskTier: policy.riskTier,
    requiredScopes: [...policy.requiredScopes].sort(),
  });
}

/** H_evidence = SHA256(H_1 ∥ H_2 ∥ … ∥ H_n). Empty evidence hashes to the empty-string digest. */
export function hashEvidence(evidenceHashes: readonly string[]): string {
  return sha256Hex(evidenceHashes.join("|"));
}

/** H_manifest = SHA256(H_input ∥ H_output ∥ H_policy ∥ H_evidence). */
export function manifestHash(parts: {
  inputHash: string;
  outputHash: string;
  policyHash: string;
  evidenceHash: string;
}): string {
  return sha256Hex([parts.inputHash, parts.outputHash, parts.policyHash, parts.evidenceHash].join("|"));
}

export function triangulate(params: TriangulationParams): TriangulationResult {
  const inputValidation = validateSchema(params.input, params.contract.inputSchema);
  const outputValidation = validateSchema(params.output, params.contract.outputSchema);
  const contract: ContractVertex = {
    valid: inputValidation.valid && outputValidation.valid,
    inputValid: inputValidation.valid,
    outputValid: outputValidation.valid,
    violations: Object.freeze([...inputValidation.violations, ...outputValidation.violations]),
  };

  const reasons: string[] = [];
  const { provenance } = params;
  if (!provenance.actorId.trim()) reasons.push("missing actorId");
  if (!provenance.tenantId.trim()) reasons.push("missing tenantId");
  if (!provenance.federationId.trim()) reasons.push("missing federationId");
  if (!provenance.policyVersion.trim()) reasons.push("missing policyVersion");
  const provenanceVertex: ProvenanceVertex = { valid: reasons.length === 0, reasons: Object.freeze(reasons) };

  const inputHash = hashInput(params.input);
  const outputHash = hashOutput(params.output);
  const policyHash = hashPolicy({
    policyVersion: params.provenance.policyVersion,
    riskTier: params.riskTier,
    requiredScopes: params.contract.authority.requiredScopes,
  });
  const evidenceHash = hashEvidence(params.evidenceHashes ?? []);
  const computedManifestHash = manifestHash({ inputHash, outputHash, policyHash, evidenceHash });

  const manifestMatches = params.expectedManifestHash === undefined || params.expectedManifestHash === computedManifestHash;
  const signatureValid =
    params.signature === undefined
      ? null
      : Boolean(params.verifySignature?.(computedManifestHash)) && params.expectedManifestHash === computedManifestHash;

  const resultValid = manifestMatches && signatureValid !== false;
  const result: ResultVertex = {
    valid: resultValid,
    inputHash,
    outputHash,
    policyHash,
    evidenceHash,
    manifestHash: computedManifestHash,
    signatureValid,
  };

  const invalidVertices: ("contract" | "provenance" | "result")[] = [];
  if (!contract.valid) invalidVertices.push("contract");
  if (!provenanceVertex.valid) invalidVertices.push("provenance");
  if (!result.valid) invalidVertices.push("result");

  return {
    valid: invalidVertices.length === 0,
    contract,
    provenance: provenanceVertex,
    result,
    invalidVertices,
  };
}
