/**
 * ISABELLA CANONICAL SKILL FABRIC Ω — CSF-Ω v2.0.0
 *
 * Catalog of governed capability contracts. Each skill declares identity,
 * risk tier, authority (scopes / step-up / quorum), evidence policy, limits and
 * rollback, and produces deterministic SHA-256 digests so that execution,
 * verification and audit are inseparable.
 *
 * Governed by CROWN Ω, evidenced by BookPI Ω, executed by HyperCore Ω².
 */
import { sha256 } from './canonical-json';
import type { SkillDescriptor } from './registry';
import { assessDeployment } from '../governance/deployment-gates';
import { evaluateQualityGates, type QualityGateInput } from '../governance/quality-gates';
import { sanitizeDocument, type RawDocument, type SanitizedDocument } from '../sanitization';
import { settleRoyalties, type FederationShare, type RoyaltySettlement } from '../bookpi/royalties';
import { listIsabellaModules, ISABELLA_API_GROUPS } from '../isabella/library';
import { TAMV_INTEGRATION_MAP } from '../territory/tamv-integration';

interface IngestionInput extends RawDocument {
  source?: string;
  territory?: string;
  language?: string;
}

const SHA256_HEX = '^[0-9a-f]{64}$';
const DIGITS = '^[0-9]+$';

export const CANONICAL_SKILLS: readonly SkillDescriptor[] = [
  {
    id: 'sovereign_ingestion_pipeline',
    version: '2.0.0',
    methodId: 'A.TWINS.E09_MEMORY.ingest_governed.v2.0.0.LOW.INSTITUTIONAL',
    riskTier: 'LOW',
    requiresEvidence: false,
    contract: {
      inputSchema: {
        type: 'object',
        required: ['id', 'content'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' },
          content: { type: 'string', minLength: 1, maxLength: 1_000_000 },
          source: { type: 'string' },
          territory: { type: 'string' },
          language: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['sanitized', 'signals', 'manifestDigest'],
        additionalProperties: true,
        properties: {
          sanitized: { type: 'object' },
          signals: { type: 'array' },
          manifestDigest: { type: 'string', pattern: SHA256_HEX },
        },
      },
      authority: {
        requiredScopes: ['memory:ingest'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: false, piiRedaction: true, retentionDays: 365 },
      limits: { maxLatencyMs: 2_500, maxMemoryMb: 256, maxCallsPerMinute: 60, maxEnergyUnits: 500 },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const raw = ctx.input as IngestionInput;
      const sanitized: SanitizedDocument = sanitizeDocument(raw);
      const manifest = {
        source: raw.source ?? raw.id,
        contentHash: sha256(raw.content),
        territory: raw.territory ?? null,
        language: raw.language ?? null,
      };
      return { sanitized, signals: [...ctx.signals], manifestDigest: sha256(manifest) };
    },
  },

  {
    id: 'bookpi_royalty_distribution',
    version: '2.0.0',
    methodId: 'A.TWINS.E08_DATA.distribute_royalties.v2.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: true,
    contract: {
      inputSchema: {
        type: 'object',
        required: ['totalRevenueWei', 'shares'],
        additionalProperties: false,
        properties: {
          totalRevenueWei: { type: 'string', pattern: DIGITS },
          shares: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['federationId', 'basisPoints', 'walletAddress'],
              additionalProperties: false,
              properties: {
                federationId: { type: 'integer', minimum: 1, maximum: 7 },
                basisPoints: { type: 'integer', minimum: 0, maximum: 10_000 },
                walletAddress: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['totalRevenueWei', 'splits', 'distributedWei', 'remainderWei'],
        additionalProperties: true,
        properties: {
          totalRevenueWei: { type: 'string', pattern: DIGITS },
          splits: { type: 'array', minItems: 1 },
          distributedWei: { type: 'string', pattern: DIGITS },
          remainderWei: { type: 'string', pattern: DIGITS },
        },
      },
      authority: {
        requiredScopes: ['finance:royalties:settle'],
        requiresStepUp: true,
        requiresQuorum: false,
      },
      evidencePolicy: { required: true, piiRedaction: false, retentionDays: 3650 },
      limits: {
        maxLatencyMs: 5_000,
        maxMemoryMb: 256,
        maxCallsPerMinute: 12,
        maxEnergyUnits: 1_000,
      },
      rollback: { supported: true, strategy: 'compensating-action' },
    },
    handler: async (ctx) => {
      const input = ctx.input as { totalRevenueWei: string; shares: FederationShare[] };
      const settlement: RoyaltySettlement = settleRoyalties(
        BigInt(input.totalRevenueWei),
        input.shares
      );
      return settlement;
    },
  },

  {
    id: 'quality_gate_arbiter',
    version: '2.0.0',
    methodId: 'N.IDENTITY.E03_GOVERNANCE.arbitrate_quality.v2.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: true,
    contract: {
      inputSchema: { type: 'object', additionalProperties: true },
      outputSchema: {
        type: 'object',
        required: ['passed', 'results', 'blockers'],
        additionalProperties: true,
        properties: {
          passed: { type: 'boolean' },
          results: { type: 'array' },
          blockers: { type: 'array' },
        },
      },
      authority: {
        requiredScopes: ['governance:quality:arbitrate'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: true, piiRedaction: false, retentionDays: 1825 },
      limits: { maxLatencyMs: 3_000, maxMemoryMb: 256, maxCallsPerMinute: 30, maxEnergyUnits: 400 },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => evaluateQualityGates(ctx.input as QualityGateInput),
  },

  {
    id: 'deployment_readiness_arbiter',
    version: '2.0.0',
    methodId: 'N.IDENTITY.E03_GOVERNANCE.arbitrate_deployment.v2.0.0.HIGH.CONSTITUTIONAL',
    riskTier: 'HIGH',
    requiresEvidence: true,
    contract: {
      inputSchema: { type: 'object', additionalProperties: true },
      outputSchema: {
        type: 'object',
        required: ['target', 'deployable', 'blockers', 'reports'],
        additionalProperties: true,
        properties: {
          target: { type: 'object' },
          deployable: { type: 'boolean' },
          blockers: { type: 'array' },
          reports: { type: 'array' },
        },
      },
      authority: {
        requiredScopes: ['deployment:assess'],
        requiresStepUp: true,
        requiresQuorum: true,
        quorumSize: 3,
      },
      evidencePolicy: { required: true, piiRedaction: false, retentionDays: 3650 },
      limits: {
        maxLatencyMs: 8_000,
        maxMemoryMb: 512,
        maxCallsPerMinute: 6,
        maxEnergyUnits: 2_000,
      },
      rollback: { supported: true, strategy: 'manual-approval' },
    },
    handler: async (ctx) => {
      const input = (ctx.input ?? {}) as {
        target?: Parameters<typeof assessDeployment>[0];
        gates?: Parameters<typeof assessDeployment>[1];
        opts?: Parameters<typeof assessDeployment>[2];
      };
      return assessDeployment(
        input.target ?? { layer: 'tamv-app', provider: 'github' },
        input.gates ?? {},
        input.opts
      );
    },
  },

  {
    id: 'territorial_library_synthesis',
    version: '2.0.0',
    methodId: 'T.TOURISM.E06_UX.synthesize_library.v2.0.0.LOW.TERRITORIAL',
    riskTier: 'LOW',
    requiresEvidence: false,
    contract: {
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      outputSchema: {
        type: 'object',
        required: ['modules', 'apiGroups', 'tamvModules', 'digest'],
        additionalProperties: true,
        properties: {
          modules: { type: 'array' },
          apiGroups: { type: 'array' },
          tamvModules: { type: 'array' },
          digest: { type: 'string', pattern: SHA256_HEX },
        },
      },
      authority: {
        requiredScopes: ['territory:library:read'],
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
    handler: async () => {
      const manifest = {
        modules: listIsabellaModules().map((module) => module.id),
        apiGroups: ISABELLA_API_GROUPS.map((group) => group.id),
        tamvModules: Object.keys(TAMV_INTEGRATION_MAP),
      };
      return { ...manifest, digest: sha256(manifest) };
    },
  },

  {
    id: 'evidence_manifest_seal',
    version: '2.0.0',
    methodId: 'N.PATRIMONY.E11_VERITAS.seal_manifest.v2.0.0.MEDIUM.INSTITUTIONAL',
    riskTier: 'MEDIUM',
    requiresEvidence: true,
    contract: {
      inputSchema: {
        type: 'object',
        required: ['manifest'],
        additionalProperties: false,
        properties: { manifest: { type: 'object' } },
      },
      outputSchema: {
        type: 'object',
        required: ['sealed', 'manifestDigest', 'sealedAt'],
        additionalProperties: true,
        properties: {
          sealed: { const: true },
          manifestDigest: { type: 'string', pattern: SHA256_HEX },
          sealedAt: { type: 'string', minLength: 20 },
        },
      },
      authority: {
        requiredScopes: ['bookpi:evidence:seal'],
        requiresStepUp: false,
        requiresQuorum: false,
      },
      evidencePolicy: { required: true, piiRedaction: false, retentionDays: 3650 },
      limits: { maxLatencyMs: 2_000, maxMemoryMb: 128, maxCallsPerMinute: 60, maxEnergyUnits: 300 },
      rollback: { supported: false, strategy: 'none' },
    },
    handler: async (ctx) => {
      const input = ctx.input as { manifest: unknown };
      const manifestHash = sha256(input.manifest);
      return {
        sealed: true,
        manifestDigest: manifestHash,
        sealedAt: new Date().toISOString(),
        signals: [...ctx.signals],
      };
    },
  },
];
