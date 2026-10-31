/**
 * ISABELLA FOUNDATIONAL SKILLS Ω — the five foundational cognitive skills.
 *
 * state: draft | engine-generated.
 *
 * ORION, SOPHIA, ARGUS, MNEMOS and LUMEN are declared in the canonical master
 * document (`Documento Maestro: Skills de Isabella`) as the foundational layer.
 * Each is implemented here as a governed CSF-Ω capability contract over a REAL
 * existing faculty — never as an invented result:
 *
 *   ORION  — provenance orientation (wraps `src/memory/provenance`).
 *   SOPHIA — knowledge confidence consolidation (wraps provenance claims).
 *   ARGUS  — multi-verifier consensus (wraps `src/hypercore/veritas-omega`).
 *   MNEMOS — deterministic memory seal (wraps canonical SHA-256).
 *   LUMEN  — authority illumination (wraps `src/skills/crown-policy`).
 *
 * A skill suggests, computes and evaluates. It never authorizes or executes a
 * governed side effect: CROWN authorizes, HyperCore executes, BookPI evidences.
 */
import { sha256 } from './canonical-json';
import type { SkillDescriptor } from './registry';
import {
  hashContent,
  validateClaim,
  type ProvenanceClaim,
  type ProvenanceSource,
} from '../memory/provenance';
import { deriveChecks, verifyCandidate } from '../hypercore/veritas-omega';
import type { RiskClass } from '../hypercore/types';
import { evaluateCrownPolicy } from './crown-policy';
import type { SkillContract } from './contracts';
import type { RiskTier } from '../authority/method-id';

const SHA256_HEX = '^[0-9a-f]{64}$';
const EPOCH = '1970-01-01T00:00:00.000Z';

interface RawSource {
  sourceId: string;
  content: string;
  trustTier?: ProvenanceSource['trustTier'];
}

interface RawClaim {
  claimId: string;
  text: string;
  sourceIds: string[];
}

function toSource(raw: RawSource): ProvenanceSource {
  return {
    sourceId: raw.sourceId,
    contentHash: hashContent(raw.content),
    retrievedAt: EPOCH,
    trustTier: raw.trustTier ?? 'USER_PROVIDED',
  };
}

const PROVENANCE_INPUT = {
  type: 'object',
  required: ['sources', 'claim'],
  additionalProperties: true,
  properties: {
    sources: { type: 'array', minItems: 1 },
    claim: { type: 'object' },
  },
} as const;

export const FOUNDATIONAL_SKILLS: readonly SkillDescriptor[] = [
  {
    id: 'orion_provenance_orientation',
    version: '1.0.0',
    methodId: 'T.TWINS.E01_ORION.orient_provenance.v1.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: false,
    contract: {
      inputSchema: PROVENANCE_INPUT,
      outputSchema: {
        type: 'object',
        required: ['valid', 'claimId', 'sourceCount', 'sourceDigest'],
        additionalProperties: true,
        properties: {
          valid: { type: 'boolean' },
          claimId: { type: 'string' },
          sourceCount: { type: 'integer', minimum: 0 },
          sourceDigest: { type: 'string', pattern: SHA256_HEX },
        },
      },
      authority: {
        requiredScopes: ['cognition:provenance:orient'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: false, piiRedaction: false, retentionDays: 365 },
      limits: {
        maxLatencyMs: 1_000,
        maxMemoryMb: 128,
        maxCallsPerMinute: 120,
        maxEnergyUnits: 200,
      },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const input = ctx.input as { sources: RawSource[]; claim: RawClaim };
      const sources = input.sources.map(toSource);
      const claim: ProvenanceClaim = {
        claimId: input.claim.claimId,
        text: input.claim.text,
        sourceIds: input.claim.sourceIds,
        observedAt: EPOCH,
        confidence: 'UNVERIFIED',
      };
      const valid = validateClaim(claim, sources);
      return {
        valid,
        claimId: claim.claimId,
        sourceCount: sources.length,
        sourceDigest: sha256(sources.map((source) => source.contentHash)),
      };
    },
  },

  {
    id: 'sophia_knowledge_consolidation',
    version: '1.0.0',
    methodId: 'N.TWINS.E02_SOPHIA.consolidate_knowledge.v1.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: false,
    contract: {
      inputSchema: PROVENANCE_INPUT,
      outputSchema: {
        type: 'object',
        required: ['confidence', 'valid', 'digest'],
        additionalProperties: true,
        properties: {
          confidence: { type: 'string' },
          valid: { type: 'boolean' },
          digest: { type: 'string', pattern: SHA256_HEX },
        },
      },
      authority: {
        requiredScopes: ['cognition:knowledge:consolidate'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: false, piiRedaction: false, retentionDays: 365 },
      limits: {
        maxLatencyMs: 1_000,
        maxMemoryMb: 128,
        maxCallsPerMinute: 120,
        maxEnergyUnits: 200,
      },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const input = ctx.input as { sources: RawSource[]; claim: RawClaim };
      const sources = input.sources.map(toSource);
      const claim: ProvenanceClaim = {
        claimId: input.claim.claimId,
        text: input.claim.text,
        sourceIds: input.claim.sourceIds,
        observedAt: EPOCH,
        confidence: 'UNVERIFIED',
      };
      const valid = validateClaim(claim, sources);
      const primary = sources.some((source) => source.trustTier === 'PRIMARY');
      const confidence = !valid ? 'UNVERIFIED' : primary ? 'CORROBORATED' : 'INFERRED';
      return {
        confidence,
        valid,
        digest: sha256({
          claimId: claim.claimId,
          confidence,
          sources: sources.map((s) => s.contentHash),
        }),
      };
    },
  },

  {
    id: 'argus_verification_consensus',
    version: '1.0.0',
    methodId: 'N.TWINS.E03_ARGUS.verify_candidate.v1.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: false,
    contract: {
      inputSchema: {
        type: 'object',
        required: ['risk', 'candidate'],
        additionalProperties: true,
        properties: {
          risk: { type: 'string' },
          candidate: { type: 'object' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['verdict', 'approvals', 'required', 'reason'],
        additionalProperties: true,
        properties: {
          verdict: { type: 'string' },
          approvals: { type: 'integer', minimum: 0 },
          required: { type: 'integer', minimum: 0 },
          reason: { type: 'string' },
        },
      },
      authority: {
        requiredScopes: ['cognition:verification:consensus'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: false, piiRedaction: false, retentionDays: 365 },
      limits: { maxLatencyMs: 2_000, maxMemoryMb: 256, maxCallsPerMinute: 60, maxEnergyUnits: 300 },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const input = ctx.input as { risk: RiskClass; candidate: Record<string, unknown> };
      const checks = deriveChecks(input.candidate, input.risk);
      const verdict = verifyCandidate({ checks, risk: input.risk });
      return {
        verdict: verdict.verdict,
        approvals: verdict.approvals,
        required: verdict.required,
        reason: verdict.reason,
      };
    },
  },

  {
    id: 'mnemos_memory_seal',
    version: '1.0.0',
    methodId: 'A.TWINS.E04_MNEMOS.seal_memory.v1.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: false,
    contract: {
      inputSchema: {
        type: 'object',
        required: ['record'],
        additionalProperties: true,
        properties: { record: { type: 'object' } },
      },
      outputSchema: {
        type: 'object',
        required: ['sealed', 'digest', 'sealedAt'],
        additionalProperties: true,
        properties: {
          sealed: { const: true },
          digest: { type: 'string', pattern: SHA256_HEX },
          sealedAt: { type: 'string', minLength: 20 },
        },
      },
      authority: { requiredScopes: ['memory:seal'], requiresStepUp: false, requiresQuorum: false },
      evidencePolicy: { required: false, piiRedaction: false, retentionDays: 3650 },
      limits: {
        maxLatencyMs: 1_000,
        maxMemoryMb: 128,
        maxCallsPerMinute: 120,
        maxEnergyUnits: 200,
      },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const input = ctx.input as { record: Record<string, unknown> };
      return { sealed: true, digest: sha256(input.record), sealedAt: new Date().toISOString() };
    },
  },

  {
    id: 'lumen_authority_illumination',
    version: '1.0.0',
    methodId: 'N.TWINS.E05_LUMEN.illuminate_authority.v1.0.0.LOW.INSTITUTIONAL',
    riskTier: 'LOW',
    requiresEvidence: false,
    contract: {
      inputSchema: {
        type: 'object',
        required: [
          'requiredScopes',
          'grantedScopes',
          'riskTier',
          'approvalProvided',
          'callsThisWindow',
          'maxCallsPerMinute',
        ],
        additionalProperties: true,
        properties: {
          requiredScopes: { type: 'array' },
          grantedScopes: { type: 'array' },
          riskTier: { type: 'string' },
          approvalProvided: { type: 'boolean' },
          callsThisWindow: { type: 'integer', minimum: 0 },
          maxCallsPerMinute: { type: 'integer', minimum: 1 },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['verdict', 'reason', 'missingScopes'],
        additionalProperties: true,
        properties: {
          verdict: { type: 'string' },
          reason: { type: 'string' },
          missingScopes: { type: 'array' },
        },
      },
      authority: {
        requiredScopes: ['authority:illuminate'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: false, piiRedaction: false, retentionDays: 365 },
      limits: { maxLatencyMs: 500, maxMemoryMb: 64, maxCallsPerMinute: 240, maxEnergyUnits: 100 },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const input = ctx.input as {
        requiredScopes: string[];
        grantedScopes: string[];
        riskTier: RiskTier;
        approvalProvided: boolean;
        callsThisWindow: number;
        maxCallsPerMinute: number;
      };
      const target: SkillContract = {
        inputSchema: {},
        outputSchema: {},
        authority: {
          requiredScopes: input.requiredScopes,
          requiresStepUp: false,
          requiresQuorum: false,
        },
        evidencePolicy: { required: false, piiRedaction: false, retentionDays: 1 },
        limits: {
          maxLatencyMs: 1_000,
          maxMemoryMb: 64,
          maxCallsPerMinute: input.maxCallsPerMinute,
          maxEnergyUnits: 1,
        },
        rollback: { supported: false, strategy: 'none' },
      };
      const decision = evaluateCrownPolicy({
        contract: target,
        riskTier: input.riskTier,
        grantedScopes: input.grantedScopes,
        approvalProvided: input.approvalProvided,
        callsThisWindow: input.callsThisWindow,
      });
      return {
        verdict: decision.verdict,
        reason: decision.reason,
        missingScopes: decision.missingScopes,
      };
    },
  },
];
